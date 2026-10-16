import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// A race on stage 3 with all stages unlocked, past the countdown.
const racing = async (page, frames = 200) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.settle();
  await page.evaluate(() => {
    const s = window.gameState;
    s.track.stage = 3;
    s.stageloadtyp = 0;
    s.stageload = 0;
    s.menu.redraw = true;
    s.game.phase = 3;
  });
  await game.advanceUntil(PHASE.stageSelect);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    window.gameState.game.mode = 0;
    window.gameState.startflash();
  });
  await game.advanceUntil(PHASE.race);
  await game.advance(frames);
  return game;
};

const set = (page, change) => page.evaluate(change);

test("hud: countdown numbers", async ({ page }) => {
  const game = await racing(page, 140);
  await expect.soft(page).toHaveScreenshot("hud-countdown-two.png");
  await game.advance(45);
  await expect.soft(page).toHaveScreenshot("hud-countdown-go.png");
});

test("hud: power low and the arrow at the cars", async ({ page }) => {
  const game = await racing(page);
  await set(page, () => {
    const r = window.gameState.racers[0];
    r.power = 30;
  });
  await game.advance(3);
  await expect.soft(page).toHaveScreenshot("hud-power-low.png");
  await game.tap("q");
  await game.advance(2);
  await expect.soft(page).toHaveScreenshot("hud-arrow-at-cars.png");
});

test("hud: race won", async ({ page }) => {
  const game = await racing(page);
  await set(page, () => {
    const s = window.gameState;
    s.track.clear[0] = s.track.nlaps * s.track.nsp;
    s.racers[0].clear = s.track.nlaps * s.track.nsp;
  });
  await game.advance(30);
  await expect.soft(page).toHaveScreenshot("hud-race-won.png");
});

test("hud: all opponents wasted", async ({ page }) => {
  const game = await racing(page);
  await set(page, () => {
    const s = window.gameState;
    for (let c = 1; c < s.game.carCount; c++) {
      // damage comes from hits, which shape the dents first; fixcar does that too
      s.fixcar(c);
      s.racers[c].hitmag = 1e9;
    }
  });
  await game.advance(60);
  await expect.soft(page).toHaveScreenshot("hud-all-wasted.png");
});

test("hud: player wasted", async ({ page }) => {
  const game = await racing(page);
  await set(page, () => {
    const s = window.gameState;
    s.fixcar(0);
    s.racers[0].hitmag = 1e9;
  });
  await game.advance(60);
  await expect.soft(page).toHaveScreenshot("hud-player-wasted.png");
});
