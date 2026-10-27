import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// what a page's race tape and field hold
const raced = (page) =>
  page.evaluate(() => {
    const s = window.gameState;
    return {
      length: s.raceTape.length,
      x: s.raceTape.cars.map((car) => car.x[100]),
      cars: s.game.carTypes.slice(0, s.game.carCount),
    };
  });

test("a replay saved from the viewer opens again from the main menu", async ({
  page,
  browser,
}, testInfo) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.settle();
  await page.evaluate(() => {
    const s = window.gameState;
    s.track.stage = 5;
    s.menu.redraw = true;
    s.game.phase = 3;
  });
  await game.advanceUntil(PHASE.stageSelect);
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    window.gameState.game.mode = 0;
    const { flashIntoRace } = await import("/src/race/countdown.js");
    flashIntoRace();
  });
  await game.advanceUntil(PHASE.race);
  await page.keyboard.down("ArrowUp");
  await game.advance(400);
  await page.keyboard.up("ArrowUp");
  const race = await raced(page);
  await page.evaluate((paused) => {
    const s = window.gameState;
    s.game.phase = paused;
    s.openReplay(s.VIEWER_FROM.pauseMenu, 0);
  }, PHASE.paused);
  await game.advance(5);
  // Save, the second button from the right of eight
  const download = page.waitForEvent("download");
  await page.mouse.move((6.5 * 1280) / 8, 720 - 57);
  await page.mouse.down();
  await game.advance(1);
  await page.mouse.up();
  await game.advance(1);
  const file = testInfo.outputPath("race.nfmreplay");
  await (await download).saveAs(file);

  const other = await browser.newPage();
  const game2 = await openGame(other, {
    storage: { carsel: "3", unlocked: "17" },
  });
  await game2.advanceUntil(PHASE.mainMenu);
  const chooser = other.waitForEvent("filechooser");
  await other.evaluate(async () =>
    (await import("/src/screens/replays.js")).chooseReplayFile(),
  );
  await (await chooser).setFiles(file);
  await game2.advanceUntil(PHASE.replay);
  expect(await raced(other)).toEqual(race);
  await game2.tap("Enter");
  await game2.advance(2);
  expect(await game2.phase()).toBe(PHASE.mainMenu);
  // the player's own car again
  expect(await other.evaluate(() => window.gameState.game.carTypes[0])).toBe(3);
});
