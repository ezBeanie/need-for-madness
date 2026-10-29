import { defineConfig } from "vite";
import { attachRelay } from "./server/relay.js";
import { exposeGameState } from "./test/harness/exposeState.js";

// The relay of multiplayer races runs in the dev and preview servers too.
const relay = () => ({
  name: "nfm-relay",
  configureServer: (server) => attachRelay(server.httpServer),
  configurePreviewServer: (server) => attachRelay(server.httpServer),
});

export default defineConfig({
  plugins: [
    relay(),
    // Only for the browser tests: lets them read the game state (see playwright.config.js).
    ...(process.env.EXPOSE_GAME_STATE ? [exposeGameState()] : []),
  ],
});
