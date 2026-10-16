import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// Starts a race on stage and ends it right away as given, at the race end screen.
const endRace = async (page, { stage, unlocked, winner, cars = 7 }) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: String(unlocked) },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.settle();
  await page.evaluate((stage) => {
    const s = window.gameState;
    s.track.stage = stage;
    s.stageloadtyp = 0;
    s.stageload = 0;
    s.menu.redraw = true;
    s.game.phase = 3;
  }, stage);
  await game.advanceUntil(PHASE.stageSelect);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    window.gameState.game.mode = 0;
    window.gameState.startflash();
  });
  await game.advanceUntil(PHASE.race);
  await game.advance(20);
  await page.evaluate(
    async ({ unlocked, winner, cars, raceEnd }) => {
      const s = window.gameState;
      // the module the game uses, as the dev server serves it
      const { startRaceEnd } = await import("/src/screens/raceEnd.js");
      s.game.unlocked = unlocked;
      s.raceEvents.winner = winner;
      s.game.carCount = cars;
      startRaceEnd();
      s.game.phase = raceEnd;
    },
    { unlocked, winner, cars, raceEnd: PHASE.raceEnd },
  );
  return game;
};

test("race end after winning a stage that unlocks a car", async ({ page }) => {
  const game = await endRace(page, { stage: 2, unlocked: 2, winner: true });
  await game.advance(30);
  await expect.soft(page).toHaveScreenshot("race-end-fading-in.png");
  await game.advance(40);
  await expect.soft(page).toHaveScreenshot("race-end-unlocked-car.png");
});

test("race end after losing", async ({ page }) => {
  const game = await endRace(page, { stage: 5, unlocked: 9, winner: false });
  await game.advance(60);
  await expect.soft(page).toHaveScreenshot("race-end-lost.png");
});

test("race end after winning the last stage", async ({ page }) => {
  const game = await endRace(page, { stage: 17, unlocked: 17, winner: true });
  await game.advance(70);
  await expect.soft(page).toHaveScreenshot("race-end-confetti.png");
});

test("race end after practice", async ({ page }) => {
  const game = await endRace(page, {
    stage: 1,
    unlocked: 1,
    winner: false,
    cars: 1,
  });
  await game.advance(60);
  await expect.soft(page).toHaveScreenshot("race-end-practice.png");
});
