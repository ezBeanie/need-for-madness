// The games opened, for admin.html: each game tells VISIT_PATH once as it starts (see
// src/net/visit.js) its version, the kind of device and whether it is installed. Kept is
// when, the network (its address cut short, see shortAddress) and the country (see
// geo.js), never the whole address; for 90 days, in a file if there is one. An address
// opening the game again within REPEAT_MS counts once.

import { keepRecent, shortAddress } from "./sessions.js";

export const VISIT_PATH = "/net/visit";
export const DEVICES = ["phone", "tablet", "desktop"];
const REPEAT_MS = 10 * 60 * 1000;
const MOST_VISITS = 20000;
const MOST_BYTES = 512;
// the newest visits the report lists one by one
const LISTED = 100;

const isVisit = (visit) =>
  visit != null &&
  typeof visit.version == "string" &&
  /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(visit.version) &&
  DEVICES.includes(visit.device) &&
  typeof visit.installed == "boolean";

// counted per key, the most first
const counts = (visits, keyOf) => {
  const counted = new Map();
  for (const visit of visits) {
    const key = keyOf(visit);
    counted.set(key, (counted.get(key) ?? 0) + 1);
  }
  return [...counted].sort((a, b) => b[1] - a[1]);
};

const dayOf = (time) => new Date(time).toISOString().slice(0, 10);

export const keepVisits = (file, countryOf) => {
  const visits = keepRecent(file, (visit) => visit.at, MOST_VISITS);
  // (whole addresses, in memory only and only for REPEAT_MS)
  const lastSeen = new Map();

  const answer = (request, response) => {
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
      let visit = null;
      try {
        visit = JSON.parse(body);
      } catch {
        // answered below as not a visit
      }
      if (!isVisit(visit)) {
        response.writeHead(400);
        response.end();
        return;
      }
      const address =
        request.headers["x-real-ip"] ?? request.socket.remoteAddress ?? "";
      const now = Date.now();
      for (const [seen, at] of lastSeen) {
        if (now - at >= REPEAT_MS) {
          lastSeen.delete(seen);
        }
      }
      if (!lastSeen.has(address)) {
        lastSeen.set(address, now);
        visits.add({
          at: now,
          network: shortAddress(address),
          country: countryOf(address) ?? "?",
          device: visit.device,
          installed: visit.installed,
          version: visit.version,
        });
      }
      response.writeHead(204, { "Cache-Control": "no-store" });
      response.end();
    });
  };

  // What the report tells: the visits by day, country and device, and the newest ones.
  const summary = () => {
    const past = visits.past();
    return {
      total: past.length,
      byDay: counts(past, (visit) => dayOf(visit.at)).sort((a, b) =>
        a[0] < b[0] ? 1 : -1,
      ),
      byCountry: counts(past, (visit) => visit.country),
      byDevice: counts(
        past,
        (visit) => `${visit.device}${visit.installed ? " (app)" : ""}`,
      ),
      latest: past.slice(-LISTED).reverse(),
    };
  };
  return { answer, summary };
};
