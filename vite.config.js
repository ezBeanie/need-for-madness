import { defineConfig } from "vite";
import { exposeGameState } from "./test/harness/exposeState.js";

export default defineConfig({
  // Only for the browser tests: lets them read the game state (see playwright.config.js).
  plugins: process.env.EXPOSE_GAME_STATE ? [exposeGameState()] : [],
});
