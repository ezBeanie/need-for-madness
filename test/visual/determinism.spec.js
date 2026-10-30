import { expect, test } from "@playwright/test";
import { FINGERPRINTS } from "../fixtures/fingerprints.js";

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

// Every browser races the fixed race of ?determinism as Node does, whatever the screen:
// the game's own sin, cos, atan and acos (see src/core/exactMath.js) round alike everywhere,
// where the engines' own differ in the last bit (Node's Math.cos from Chromium's).
test("the determinism check races as Node does, in a desktop window and on a phone", async ({
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
  const expected = FINGERPRINTS.map(
    (print, i) => `tick ${[250, 500, 1000, 2000][i]}: ${print}`,
  );
  expect(desktop).toEqual(expected);
  expect(phone).toEqual(expected);
});
