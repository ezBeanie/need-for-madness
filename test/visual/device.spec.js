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
  // (touched, the game goes on to choosing a car; not fullscreen, which keeps the window as
  // large as it is)
  const open = async (options) => {
    const context = await browser.newContext({ ...options, baseURL });
    const page = await context.newPage();
    const game = await openGame(page, {
      storage: { fullscreenOnTouch: "0" },
    });
    await game.advanceUntil(PHASE.carSelect);
    await game.advance(2);
    return { context, page, game };
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
  const { context, page, game } = await open({
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

  // a dialog open while the screen turns or a foldable opens fills the screen as it is then
  // (the page's units in pixels: Samsung Internet keeps a dialog's viewport units of before)
  const fills = async (width, height) => {
    await page.setViewportSize({ width, height });
    await game.advance();
    const units = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return ["--vw", "--vh"].map((name) =>
        style.getPropertyValue(name).trim(),
      );
    });
    const shown = await page.locator("#options").boundingBox();
    return { units, shown: [shown.width, shown.height] };
  };
  expect(await fills(844, 390)).toEqual({
    units: ["8.44px", "3.9px"],
    shown: [844, 390],
  });
  expect(await fills(390, 844)).toEqual({
    units: ["8.44px", "3.9px"],
    shown: [390, 844],
  });
  expect(await fills(884, 820)).toEqual({
    units: ["8.84px", "8.2px"],
    shown: [884, 820],
  });
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

// as games on the web do: a phone's browser goes fullscreen at a touch, a mouse's click
// does not; turned off in the options, a touch no more
test("a touch makes a phone's game fullscreen, until the options turn it off", async ({
  browser,
  baseURL,
}) => {
  const fullscreen = (page) =>
    page.evaluate(() => document.fullscreenElement != null);
  const phone = await browser.newContext({
    baseURL,
    isMobile: true,
    hasTouch: true,
    viewport: { width: 844, height: 390 },
  });
  const page = await phone.newPage();
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  expect(await fullscreen(page)).toBe(false);
  await page.touchscreen.tap(200, 200);
  await expect.poll(() => fullscreen(page)).toBe(true);

  await page.locator("#menuOptions").tap();
  const option = page.locator("#fullscreenShown");
  await expect(option).toHaveAttribute("aria-pressed", "true");
  await option.tap();
  await expect.poll(() => fullscreen(page)).toBe(false);
  await expect(option).toHaveAttribute("aria-pressed", "false");
  await page.locator("#optionsClose").tap();
  await page.touchscreen.tap(200, 200);
  await game.advance(2);
  expect(await fullscreen(page)).toBe(false);
  expect(
    await page.evaluate(() => localStorage.getItem("fullscreenOnTouch")),
  ).toBe("0");
  await phone.close();

  // a mouse's click does not, the options' switch does
  const desktop = await browser.newContext({ baseURL });
  const other = await desktop.newPage();
  const otherGame = await openGame(other, {
    storage: { carsel: "5", unlocked: "17" },
  });
  await otherGame.advanceUntil(PHASE.mainMenu);
  await otherGame.advance(2);
  await other.mouse.click(640, 700);
  expect(await fullscreen(other)).toBe(false);
  await other.locator("#menuOptions").click();
  await other.locator("#fullscreenShown").click();
  await expect.poll(() => fullscreen(other)).toBe(true);
  await desktop.close();
});
