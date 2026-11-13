import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// iOS keeps no page sideways, whatever the manifest says: held upright, a phone shows the
// game turned a quarter, a desktop window as tall does not, nor an unfolded foldable's
// almost square screen.
test("a phone held upright shows the game turned sideways, a tap where it shows", async ({
  browser,
  baseURL,
}) => {
  // (touched, the game goes on to choosing a car)
  const open = async (options) => {
    const context = await browser.newContext({ ...options, baseURL });
    const page = await context.newPage();
    const game = await openGame(page);
    await game.advanceUntil(PHASE.carSelect);
    await game.advance(2);
    return { context, page };
  };
  const turned = async (options) => {
    const { context, page } = await open(options);
    const seen = await page.evaluate(() => ({
      turned: document.documentElement.classList.contains("turned"),
      width: document.querySelector("#canvas2D").width,
    }));
    await context.close();
    return seen;
  };
  const phone = { isMobile: true, hasTouch: true, deviceScaleFactor: 3 };
  expect(
    await turned({ ...phone, viewport: { width: 390, height: 844 } }),
  ).toEqual({ turned: true, width: 844 });
  expect(
    await turned({ ...phone, viewport: { width: 844, height: 390 } }),
  ).toEqual({ turned: false, width: 844 });
  expect(await turned({ viewport: { width: 700, height: 900 } })).toEqual({
    turned: false,
    width: 700,
  });
  expect(
    await turned({ ...phone, viewport: { width: 674, height: 748 } }),
  ).toEqual({ turned: false, width: 674 });

  // the Options button lies on the turned page's top right: the screen's bottom right
  const { context, page } = await open({
    ...phone,
    viewport: { width: 390, height: 844 },
  });
  // a finger on the screen's left lies on the turned page's bottom
  await page.touchscreen.tap(100, 600);
  expect(
    await page.evaluate(() => {
      const { pointer } = window.gameState;
      return [pointer.x[0], pointer.y[0]];
    }),
  ).toEqual([600, 290]);
  const box = await page.locator("#optionsButton").boundingBox();
  expect(box.y).toBeGreaterThan(844 / 2);
  expect(box.height).toBeGreaterThan(box.width);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("#options")).toBeVisible();
  await context.close();
});

test("lost graphics come back with the game started anew, the room's link kept", async ({
  page,
}) => {
  const game = await openGame(page, { url: "/?join=again" });
  await game.advanceUntil(PHASE.mainMenu);
  await page.evaluate(() => {
    window.before = true;
    const gl = document.querySelector("#canvas3D").getContext("webgl");
    const lose = gl.getExtension("WEBGL_lose_context");
    lose.loseContext();
    setTimeout(() => lose.restoreContext(), 50);
  });
  await page.waitForFunction(() => window.before === undefined);
  expect(new URL(page.url()).search).toBe("?join=again");
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
    // (Web Audio kept, which the driver takes away, see driver.js: the music plays on it)
    Object.defineProperty(window, "AudioContext", {
      value: window.AudioContext,
      writable: true,
      configurable: false,
    });
    const { start } = AudioBufferSourceNode.prototype;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer?.duration > 20) {
        window.played++;
      }
      return start.apply(this, args);
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
  await expect
    .poll(async () => {
      await game.advance();
      return page.evaluate(() => window.played);
    })
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.wakeLocks)).toBe(1);
  // (held already: not asked again)
  await page.mouse.click(640, 700);
  expect(await page.evaluate(() => window.wakeLocks)).toBe(1);
});
