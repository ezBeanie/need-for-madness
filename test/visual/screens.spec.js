import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

const HALF_TICK_MS = 17.5;

// One walk from the main menu into a race, comparing the screen at fixed frames with
// reference screenshots. Half-tick frames check what interpolation draws between ticks.
test("screens from the main menu into a race", async ({ page }) => {
  // a returning player (no intro skip) who has unlocked the first stages
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "3", career: "1" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.settle();
  await game.advance(60);
  await expect.soft(page).toHaveScreenshot("main-menu.png");

  await game.tap("Enter");
  await game.advanceUntil(PHASE.carSelect);
  await game.advance(40);
  await expect.soft(page).toHaveScreenshot("car-select.png");
  await game.advance(1, HALF_TICK_MS);
  await expect.soft(page).toHaveScreenshot("car-select-between-ticks.png");

  await game.tap("Enter");
  await game.advanceUntil(PHASE.stageSelect);
  await game.advance(40);
  await expect.soft(page).toHaveScreenshot("stage-select-swoop.png");
  await game.advance(1, HALF_TICK_MS);
  await expect.soft(page).toHaveScreenshot("stage-select-between-ticks.png");
  await game.advance(150);
  await expect.soft(page).toHaveScreenshot("stage-select-overview.png");

  await game.tap("Enter");
  await game.advanceUntil(PHASE.race);
  await game.advance(100);
  await expect.soft(page).toHaveScreenshot("race-countdown.png");

  // full speed down the start straight, the opponents close by
  await game.advance(86);
  await page.keyboard.down("ArrowUp");
  await game.advance(60);
  await expect.soft(page).toHaveScreenshot("race-driving.png");
  await game.advance(1, HALF_TICK_MS);
  await expect.soft(page).toHaveScreenshot("race-driving-between-ticks.png");
  await game.advance(60);
  await expect.soft(page).toHaveScreenshot("race-crashing.png");
  await page.keyboard.up("ArrowUp");

  await game.tap("Escape");
  await game.advanceUntil(PHASE.paused);
  await game.advance(20);
  await expect.soft(page).toHaveScreenshot("pause-menu.png");
});
