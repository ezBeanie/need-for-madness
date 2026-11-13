// The relay between the games of a race (see src/net/link.js): each message a game sends
// goes to the other games in its room, as it is. It logs nothing; of a player's address it
// keeps only the network of a room's host, for the rooms' history (see sessions.js).
// A host may list its room for everyone to join (see PUBLIC_PATH): the one message the
// relay reads itself, which goes to no game.

import { createHash, timingSafeEqual } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { keepSessions, shortAddress } from "./sessions.js";

export const RELAY_PATH = "/net";
// what the rooms are like right now and were, for lobbies.html: no room names (they let one
// in) and no whole addresses
export const ROOMS_PATH = "/net/rooms";
// the rooms their hosts listed, with their names, for the game's room browser: what the
// host chose to show and how many games are in it, nothing of who they are
export const PUBLIC_PATH = "/net/public";
// what a host lists its room with (none: no longer), as text: {"relay":"listing",
// "listing":{name, mode, stage, players, bots, racing}}
const LISTING = '{"relay":"listing"';
const MOST_LISTING_BYTES = 1024;
const ROOM_NAME = /^[a-z0-9-]{1,32}$/i;
const MOST_IN_ROOM = 8;
// what a game coming into a full room is closed with, to tell it so (see src/net/link.js)
export const ROOM_FULL = 4001;
const MOST_ROOMS = 200;
// a tick of a race with 20 cars is far below this
const MOST_BYTES = 256 * 1024;
// a game sends about 30 messages a second
const MOST_PER_SECOND = 120;
// a game this far behind in receiving misses messages instead of piling them up
const MOST_BUFFERED_BYTES = 1024 * 1024;
const PING_EVERY_MS = 30_000;
// games racing send keys all the time, in a lobby they are quiet
const RACING_IF_HEARD_MS = 3000;
// a lobby says a few dozen things, a race thirty a second for each game
const RACED_IF_MESSAGES = 300;

// What a host lists its room with, as it may be shown: short texts without control
// characters, small counts; null for none.
const listingOf = (given) => {
  if (given === null || typeof given != "object") {
    return null;
  }
  const text = (value, most) =>
    typeof value == "string"
      ? value.replace(/[\p{Cc}\p{Cf}]/gu, " ").slice(0, most)
      : "";
  const count = (value, most) =>
    Number.isInteger(value) && value >= 0 && value <= most ? value : 0;
  return {
    name: text(given.name, 16),
    mode: text(given.mode, 24),
    stage: text(given.stage, 40),
    players: count(given.players, MOST_IN_ROOM),
    bots: count(given.bots, 20),
    racing: given.racing === true,
  };
};

// The listing a game sent, or undefined for a message to pass on.
const listingSent = (data, isBinary) => {
  if (isBinary || data.length > MOST_LISTING_BYTES) {
    return undefined;
  }
  const text = String(data);
  if (!text.startsWith(LISTING)) {
    return undefined;
  }
  try {
    return listingOf(JSON.parse(text).listing);
  } catch {
    return null;
  }
};

// Lets the http server take the relay's connections; the others (e.g. Vite's own) it
// leaves alone. Gives back what the rooms are like and were (report, see answerRooms),
// the past ones kept in historyFile, if given, and the rooms listed (listed, see
// answerPublic).
export const attachRelay = (httpServer, historyFile) => {
  const rooms = new Map();
  const sessions = keepSessions(historyFile);
  // (the ticks of a race, as JSON, shrink to a fraction compressed)
  const relay = new WebSocketServer({
    noServer: true,
    maxPayload: MOST_BYTES,
    perMessageDeflate: true,
  });

  // (the first game in a room is its host's; the web server in front says whose it is)
  const join = (socket, name, address) => {
    const room =
      rooms.get(name) ??
      Object.assign(new Set(), {
        since: Date.now(),
        host: shortAddress(address),
        mostGames: 0,
        messages: 0,
      });
    rooms.set(name, room);
    room.add(socket);
    room.mostGames = Math.max(room.mostGames, room.size);
    let second = Date.now();
    let sentThisSecond = 0;
    socket.alive = true;
    socket.on("pong", () => (socket.alive = true));
    // a broken message (e.g. data that does not inflate) closes only its game's
    // connection; unheard, the error would end the whole server
    socket.on("error", () => socket.terminate());
    socket.on("message", (data, isBinary) => {
      const now = Date.now();
      if (now - second >= 1000) {
        second = now;
        sentThisSecond = 0;
      }
      if (++sentThisSecond > MOST_PER_SECOND) {
        return;
      }
      // (the first game to list the room lists it, until it leaves)
      const listing = listingSent(data, isBinary);
      if (listing !== undefined) {
        if (!room.lister || room.lister == socket) {
          room.lister = listing ? socket : null;
          room.listing = listing;
        }
        return;
      }
      room.heard = now;
      room.messages++;
      for (const other of room) {
        if (
          other != socket &&
          other.readyState == WebSocket.OPEN &&
          other.bufferedAmount < MOST_BUFFERED_BYTES
        ) {
          other.send(data, { binary: isBinary });
        }
      }
    });
    socket.on("close", () => {
      room.delete(socket);
      if (room.lister == socket) {
        room.lister = null;
        room.listing = null;
      }
      if (room.size == 0) {
        rooms.delete(name);
        sessions.add({
          since: room.since,
          until: Date.now(),
          host: room.host,
          mostGames: room.mostGames,
          raced: room.messages >= RACED_IF_MESSAGES,
        });
      }
    });
  };

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url, "http://relay");
    if (url.pathname != RELAY_PATH) {
      return;
    }
    const name = url.searchParams.get("room") ?? "";
    if (
      !ROOM_NAME.test(name) ||
      (!rooms.has(name) && rooms.size >= MOST_ROOMS)
    ) {
      socket.destroy();
      return;
    }
    const full = (rooms.get(name)?.size ?? 0) >= MOST_IN_ROOM;
    relay.handleUpgrade(request, socket, head, (ws) =>
      full
        ? ws.close(ROOM_FULL, "full")
        : join(
            ws,
            name,
            request.headers["x-real-ip"] ?? request.socket.remoteAddress,
          ),
    );
  });

  // games gone without closing (a laptop shut) are dropped
  const pings = setInterval(() => {
    for (const socket of relay.clients) {
      if (!socket.alive) {
        socket.terminate();
        continue;
      }
      socket.alive = false;
      socket.ping();
    }
  }, PING_EVERY_MS);
  httpServer.on("close", () => clearInterval(pings));

  const report = () => {
    const now = Date.now();
    return {
      rooms: [...rooms.values()].map((room) => ({
        games: room.size,
        since: room.since,
        host: room.host,
        racing: now - (room.heard ?? 0) < RACING_IF_HEARD_MS,
      })),
      past: sessions.past(),
    };
  };
  const listed = () =>
    [...rooms]
      .filter(([, room]) => room.listing)
      .map(([name, room]) => ({
        room: name,
        ...room.listing,
        full: room.size >= MOST_IN_ROOM,
      }));
  return { report, listed };
};

// (hashed first: timingSafeEqual wants alike lengths, and the time taken tells nothing)
const sameToken = (given, token) =>
  typeof given == "string" &&
  timingSafeEqual(
    createHash("sha256").update(given).digest(),
    createHash("sha256").update(`Bearer ${token}`).digest(),
  );

// The answer to a request for PUBLIC_PATH: the rooms listed, to anyone.
export const answerPublic = (listed) => (request, response) => {
  response.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify({ rooms: listed() }));
};

// The answer to a request for ROOMS_PATH, from what attachRelay gave back: only to whoever
// sends the token as "Authorization: Bearer <token>". Without a token set the report is off.
export const answerRooms = (report, token) => (request, response) => {
  if (!token || !sameToken(request.headers.authorization, token)) {
    response.writeHead(token ? 401 : 404, { "Cache-Control": "no-store" });
    response.end();
    return;
  }
  response.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify({ now: Date.now(), ...report() }));
};
