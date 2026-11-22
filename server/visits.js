// The games opened and what was played in them, for admin.html. Each game tells VISIT_PATH
// as it starts (see src/net/activity.js) its player (a random id the browser keeps), its
// session (a random id of this opening), the player's name, version, kind of device and
// whether it is installed; then EVENT_PATH what it does (a race begun or ended, a room
// hosted or joined, ...). Kept besides: when, the network (its address cut short, see
// shortAddress) and the country (see geo.js), never the whole address; for 90 days, in
// files if there are any. An address telling more than MOST_PER_ADDRESS within
// ADDRESS_MS is not heard for the rest of it.

import { keepRecent, shortAddress } from "./sessions.js";

export const VISIT_PATH = "/net/visit";
export const EVENT_PATH = "/net/event";
export const DEVICES = ["phone", "tablet", "desktop"];
export const EVENTS = ["race", "result", "host", "join", "editor", "replay"];
const MOST_VISITS = 20000;
const MOST_EVENTS = 50000;
const MOST_BYTES = 1024;
const ADDRESS_MS = 10 * 60 * 1000;
const MOST_PER_ADDRESS = 200;
// what the report lists one by one: the players seen last, the sessions played last
const PLAYERS_LISTED = 100;
const SESSIONS_LISTED = 50;
const DETAIL_KEYS = 8;
const DETAIL_CHARS = 40;

const isId = (id) => typeof id == "string" && /^[0-9a-f]{8,32}$/.test(id);
const isName = (name) => typeof name == "string" && name.length <= 16;

const isVisit = (visit) =>
  visit != null &&
  isId(visit.player) &&
  isId(visit.session) &&
  isName(visit.name) &&
  typeof visit.version == "string" &&
  /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(visit.version) &&
  DEVICES.includes(visit.device) &&
  typeof visit.installed == "boolean";

const isDetail = (detail) =>
  detail != null &&
  typeof detail == "object" &&
  !Array.isArray(detail) &&
  Object.keys(detail).length <= DETAIL_KEYS &&
  Object.entries(detail).every(
    ([key, value]) =>
      key.length <= DETAIL_CHARS &&
      ((typeof value == "string" && value.length <= DETAIL_CHARS) ||
        Number.isFinite(value)),
  );

const isEvent = (event) =>
  event != null &&
  isId(event.player) &&
  isId(event.session) &&
  isName(event.name) &&
  EVENTS.includes(event.kind) &&
  isDetail(event.detail);

// counted per key, the most first
const counts = (list, keyOf) => {
  const counted = new Map();
  for (const item of list) {
    const key = keyOf(item);
    counted.set(key, (counted.get(key) ?? 0) + 1);
  }
  return [...counted].sort((a, b) => b[1] - a[1]);
};

const dayOf = (time) => new Date(time).toISOString().slice(0, 10);

// The JSON a request posts, if it is what isValid takes: then answer(it, address), else 400.
const takePosted = (request, response, isValid, answer) => {
  if (request.method != "POST") {
    response.writeHead(405, { Allow: "POST" });
    response.end();
    return;
  }
  let body = "";
  let tooLong = false;
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > MOST_BYTES) {
      tooLong = true;
      request.destroy();
    }
  });
  request.on("end", () => {
    if (tooLong) {
      return;
    }
    let posted = null;
    try {
      posted = JSON.parse(body);
    } catch {
      // answered below as not one
    }
    if (!isValid(posted)) {
      response.writeHead(400);
      response.end();
      return;
    }
    answer(
      posted,
      request.headers["x-real-ip"] ?? request.socket.remoteAddress ?? "",
    );
    response.writeHead(204, { "Cache-Control": "no-store" });
    response.end();
  });
};

export const keepVisits = (visitsFile, eventsFile, countryOf) => {
  const visits = keepRecent(visitsFile, (visit) => visit.at, MOST_VISITS);
  const events = keepRecent(eventsFile, (event) => event.at, MOST_EVENTS);
  // (whole addresses, in memory only and only for ADDRESS_MS)
  const heard = new Map();
  const tooMany = (address) => {
    const now = Date.now();
    for (const [other, { since }] of heard) {
      if (now - since >= ADDRESS_MS) {
        heard.delete(other);
      }
    }
    const told = heard.get(address) ?? { since: now, count: 0 };
    told.count++;
    heard.set(address, told);
    return told.count > MOST_PER_ADDRESS;
  };

  const answerVisit = (request, response) =>
    takePosted(request, response, isVisit, (visit, address) => {
      // (once a session)
      if (
        tooMany(address) ||
        visits.past().some(({ session }) => session == visit.session)
      ) {
        return;
      }
      visits.add({
        at: Date.now(),
        player: visit.player,
        session: visit.session,
        name: visit.name,
        network: shortAddress(address),
        country: countryOf(address) ?? "?",
        device: visit.device,
        installed: visit.installed,
        version: visit.version,
      });
    });

  const answerEvent = (request, response) =>
    takePosted(request, response, isEvent, (event, address) => {
      if (tooMany(address)) {
        return;
      }
      events.add({
        at: Date.now(),
        player: event.player,
        session: event.session,
        name: event.name,
        kind: event.kind,
        detail: event.detail,
      });
    });

  // The players, the one seen last first: each with its last name, when first and last
  // seen, how often it opened the game and raced, and where and on what it played last.
  const players = (opened, done) => {
    const byPlayer = new Map();
    for (const visit of opened) {
      const player = byPlayer.get(visit.player) ?? {
        player: visit.player,
        first: visit.at,
        visits: 0,
        races: 0,
      };
      Object.assign(player, {
        last: visit.at,
        name: visit.name || player.name || "",
        country: visit.country,
        device: `${visit.device}${visit.installed ? " (app)" : ""}`,
      });
      player.visits++;
      byPlayer.set(visit.player, player);
    }
    for (const event of done) {
      const player = byPlayer.get(event.player);
      if (player && event.kind == "race") {
        player.races++;
      }
      if (player && event.at > player.last) {
        player.last = event.at;
      }
    }
    return [...byPlayer.values()].sort((a, b) => b.last - a.last);
  };

  // The sessions played last, newest first, each with its opening and what was done in it.
  const sessions = (opened, done) => {
    const visitOf = new Map(opened.map((visit) => [visit.session, visit]));
    const bySession = new Map();
    for (let i = done.length - 1; i >= 0; i--) {
      const event = done[i];
      if (!bySession.has(event.session)) {
        if (bySession.size == SESSIONS_LISTED) {
          continue;
        }
        bySession.set(event.session, {
          ...(visitOf.get(event.session) ?? {
            session: event.session,
            player: event.player,
          }),
          events: [],
        });
      }
      const session = bySession.get(event.session);
      session.name = session.name || event.name;
      session.events.unshift({
        at: event.at,
        kind: event.kind,
        detail: event.detail,
      });
    }
    return [...bySession.values()];
  };

  // What the report tells: the games opened and the players by day, country and device,
  // the players seen last and the sessions played last.
  const summary = () => {
    const opened = visits.past();
    const done = events.past();
    const all = players(opened, done);
    const byDay = new Map();
    const firstDay = new Map();
    for (const { first, player } of all) {
      firstDay.set(player, dayOf(first));
    }
    for (const visit of opened) {
      const day = dayOf(visit.at);
      const entry = byDay.get(day) ?? { opened: 0, players: new Set() };
      entry.opened++;
      entry.players.add(visit.player);
      byDay.set(day, entry);
    }
    return {
      total: opened.length,
      players: all.length,
      byDay: [...byDay]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([day, { opened: count, players: seen }]) => [
          day,
          count,
          seen.size,
          [...seen].filter((player) => firstDay.get(player) == day).length,
        ]),
      byCountry: counts(all, (player) => player.country),
      byDevice: counts(all, (player) => player.device),
      byEvent: counts(done, (event) =>
        event.kind == "race" ? `race: ${event.detail.kind}` : event.kind,
      ),
      latestPlayers: all.slice(0, PLAYERS_LISTED),
      sessions: sessions(opened, done),
    };
  };
  return { answerVisit, answerEvent, summary };
};
