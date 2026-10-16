import { defineConfig } from "@playwright/test";

const PORT = 5181;

export default defineConfig({
  testDir: "test/visual",
  testMatch: "*.spec.js",
  // the screens share one dev server and each test loads the whole game
  workers: 2,
  timeout: 120_000,
  snapshotPathTemplate: "test/visual/__screenshots__/{arg}{ext}",
  expect: {
    // screenshots of the WebGL canvas can take a while on a busy machine
    timeout: 20_000,
    // Runs on the same machine render pixel-identical; the interpolation bugs found so far
    // changed more than 1000 pixels. References are per machine and Chromium version.
    toHaveScreenshot: { maxDiffPixels: 200 },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    env: { EXPOSE_GAME_STATE: "1" },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});
