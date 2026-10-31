// The relay between the games of a race (see src/net/link.js): each message a game sends
// goes to the other games in its room, as it is. It keeps nothing and logs nothing, so no
// player's address is stored.

import { WebSocket, WebSocketServer } from "ws";

export const RELAY_PATH = "/net";
const ROOM_NAME = /^[a-z0-9-]{1,32}$/i;
const MOST_IN_ROOM = 8;
const MOST_ROOMS = 200;
// a tick of a race with 20 cars is far below this
const MOST_BYTES = 256 * 1024;
// a game sends about 30 messages a second
const MOST_PER_SECOND = 120;
// a game this far behind in receiving misses messages instead of piling them up
const MOST_BUFFERED_BYTES = 1024 * 1024;
const PING_EVERY_MS = 30_000;

// Lets the http server take the relay's connections; the others (e.g. Vite's own) it
// leaves alone.
export const attachRelay = (httpServer) => {
  const rooms = new Map();
  // (the ticks of a race, as JSON, shrink to a fraction compressed)
  const relay = new WebSocketServer({
    noServer: true,
    maxPayload: MOST_BYTES,
    perMessageDeflate: true,
  });

  const join = (socket, name) => {
    const room = rooms.get(name) ?? new Set();
    rooms.set(name, room);
    room.add(socket);
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
      if (room.size == 0) {
        rooms.delete(name);
      }
    });
  };

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url, "http://relay");
    if (url.pathname != RELAY_PATH) {
      return;
    }
    const name = url.searchParams.get("room") ?? "";
    const full =
      (rooms.get(name)?.size ?? 0) >= MOST_IN_ROOM ||
      (!rooms.has(name) && rooms.size >= MOST_ROOMS);
    if (!ROOM_NAME.test(name) || full) {
      socket.destroy();
      return;
    }
    relay.handleUpgrade(request, socket, head, (ws) => join(ws, name));
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
};
