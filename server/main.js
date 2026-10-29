// The relay on its own, for the server the game is published on: node server/main.js,
// listening on PORT (8787 if not set). The web server in front passes /net on to it.

import { createServer } from "node:http";
import { RELAY_PATH, attachRelay } from "./relay.js";

const port = Number(process.env.PORT ?? 8787);
const server = createServer((request, response) => {
  response.writeHead(404);
  response.end();
});
attachRelay(server);
// (no other connections are taken here)
server.on("upgrade", (request, socket) => {
  if (new URL(request.url, "http://relay").pathname != RELAY_PATH) {
    socket.destroy();
  }
});
server.listen(port);
