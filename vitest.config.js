import { defineConfig } from "vitest/config";
import { exposeGameState } from "./test/harness/exposeState.js";

export default defineConfig({
  plugins: [exposeGameState()],
  test: {
    include: ["test/**/*.test.js"],
    testTimeout: 60_000,
  },
});
