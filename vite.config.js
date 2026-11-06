import { defineConfig } from "vite";
import { ROOMS_PATH, answerRooms, attachRelay } from "./server/relay.js";
import { ICE_PATH, answerIce } from "./server/ice.js";
import { exposeGameState } from "./test/harness/exposeState.js";
import { writeOfflineList } from "./tools/offline/list.js";

// The relay of multiplayer races runs in the dev and preview servers too (its rooms report
// with ROOMS_TOKEN set, the voice chat's TURN server with TURN_HOST and TURN_SECRET).
// (gives back nothing: a function given back would be taken for a hook after Vite's own)
const withRelay = (server) => {
  server.middlewares.use(
    ROOMS_PATH,
    answerRooms(attachRelay(server.httpServer), process.env.ROOMS_TOKEN),
  );
  server.middlewares.use(
    ICE_PATH,
    answerIce(process.env.TURN_HOST, process.env.TURN_SECRET),
  );
};
const relay = () => ({
  name: "nfm-relay",
  configureServer: withRelay,
  configurePreviewServer: withRelay,
});

// The built game's files listed for the service worker (see tools/offline/list.js).
const offlineList = () => {
  let outDir;
  return {
    name: "nfm-offline-list",
    apply: "build",
    configResolved: (config) => {
      outDir = config.build.outDir;
    },
    closeBundle: async () => {
      await writeOfflineList(outDir);
    },
  };
};

export default defineConfig({
  plugins: [
    relay(),
    offlineList(),
    // Only for the browser tests: lets them read the game state (see playwright.config.js).
    ...(process.env.EXPOSE_GAME_STATE ? [exposeGameState()] : []),
  ],
});
