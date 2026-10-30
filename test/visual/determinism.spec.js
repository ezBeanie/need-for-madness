import { expect, test } from "@playwright/test";

const fingerprints = async (browser, baseURL, options) => {
  const context = await browser.newContext({ ...options, baseURL });
  const page = await context.newPage();
  await page.goto("/?determinism");
  const status = page.locator("#determinism");
  await expect(status).toContainText("tick 2000", { timeout: 90_000 });
  const prints = (await status.textContent()).match(/tick \d+: [0-9a-f]{8}/g);
  await context.close();
  return prints;
};

// ?determinism compares browsers, not window sizes: whatever the screen, a browser races
// alike. (Node's V8 races otherwise, see test/determinism.test.js: its Math.cos differs from
// Chromium's in the last bit.)
test("the determinism check races alike in a desktop window and on a phone", async ({
  browser,
  baseURL,
}) => {
  const desktop = await fingerprints(browser, baseURL, {
    viewport: { width: 1280, height: 720 },
  });
  const phone = await fingerprints(browser, baseURL, {
    viewport: { width: 780, height: 360 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  expect(desktop).toHaveLength(4);
  expect(phone).toEqual(desktop);
});
