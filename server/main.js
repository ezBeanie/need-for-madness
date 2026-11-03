// The relay on its own, for the server the game is published on: node server/main.js,
// listening on PORT (8787 if not set). The web server in front passes /net on to it, the
// rooms report (ROOMS_PATH) too, and says in X-Real-IP whose a connection is. The rooms'
// history is kept in HISTORY_FILE, if set.

import { createServer } from "node:http";
import { RELAY_PATH, ROOMS_PATH, answerRooms, attachRelay } from "./relay.js";

const port = Number(process.env.PORT ?? 8787);
const server = createServer();
const rooms = answerRooms(attachRelay(server, process.env.HISTORY_FILE));
server.on("request", (request, response) => {
  if (new URL(request.url, "http://relay").pathname == ROOMS_PATH) {
    rooms(request, response);
    return;
  }
  response.writeHead(404);
  response.end();
});
// (no other connections are taken here)
server.on("upgrade", (request, socket) => {
  if (new URL(request.url, "http://relay").pathname != RELAY_PATH) {
    socket.destroy();
  }
});
server.listen(port);
