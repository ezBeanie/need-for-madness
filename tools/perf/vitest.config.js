import { defineConfig } from "vitest/config";
import { exposeGameState } from "../../test/harness/exposeState.js";

// Runs the CPU benchmarks of tools/perf with the test harness (no browser, no GPU).
// usage: npx vitest run --config tools/perf/vitest.config.js
export default defineConfig({
  plugins: [exposeGameState()],
  test: {
    include: ["tools/perf/**/*.bench.test.js"],
    testTimeout: 600_000,
  },
});
