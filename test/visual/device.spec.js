import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// iOS keeps no page sideways, whatever the manifest says: held upright, a phone is asked
// to be turned, a desktop window as tall is not.
test("a phone held upright is asked to be turned sideways", async ({
  browser,
  baseURL,
}) => {
  const hint = async (options) => {
    const context = await browser.newContext({ ...options, baseURL });
    const page = await context.newPage();
    await page.goto("/");
    const visible = await page.locator("#turnDevice").isVisible();
    await context.close();
    return visible;
  };
  const phone = { isMobile: true, hasTouch: true, deviceScaleFactor: 3 };
  expect(await hint({ ...phone, viewport: { width: 390, height: 844 } })).toBe(
    true,
  );
  expect(await hint({ ...phone, viewport: { width: 844, height: 390 } })).toBe(
    false,
  );
  expect(await hint({ viewport: { width: 700, height: 900 } })).toBe(false);
});

// (the browser's wake lock and audio as the game asks for them)
const recordRequests = (page) =>
  page.addInitScript(() => {
    window.wakeLocks = 0;
    window.played = 0;
    Object.defineProperty(navigator, "wakeLock", {
      value: {
        request: async () => {
          window.wakeLocks++;
          const sentinel = new EventTarget();
          return sentinel;
        },
      },
    });
    HTMLMediaElement.prototype.play = async function () {
      window.played++;
    };
  });

test("a touch keeps the screen on, and a click in a dialog allows the music", async ({
  page,
}) => {
  await recordRequests(page);
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  expect(await page.evaluate(() => window.played)).toBe(0);
  await page.locator("#menuOptions").click();
  await page.locator("#optionsClose").click();
  expect(await page.evaluate(() => window.played)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.wakeLocks)).toBe(1);
  // (held already: not asked again)
  await page.mouse.click(640, 700);
  expect(await page.evaluate(() => window.wakeLocks)).toBe(1);
});
