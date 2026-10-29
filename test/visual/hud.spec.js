import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// A race on stage 3 with all stages unlocked, past the countdown.
const racing = async (page, frames = 200, storage = {}) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17", ...storage },
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
  await page.evaluate(async () => {
    window.gameState.game.mode = 0;
    const { flashIntoRace } = await import("/src/race/countdown.js");
    flashIntoRace();
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

test("hud: classic countdown numbers", async ({ page }) => {
  const game = await racing(page, 0, { look: "1" });
  // (the classic pictures load once the HUD first asks for them)
  for (let i = 0; i < 15; i++) {
    await game.advance(10);
    await page.waitForTimeout(100);
  }
  await expect.soft(page).toHaveScreenshot("hud-classic-countdown-two.png");
});

test("hud: the replay viewer", async ({ page }) => {
  const game = await racing(page, 300);
  await set(page, () => {
    const s = window.gameState;
    s.game.phase = 11;
    s.openReplay(s.VIEWER_FROM.pauseMenu, 0);
  });
  await game.advance(60);
  // (the controls show only when asked for)
  await game.tap("h");
  await expect.soft(page).toHaveScreenshot("hud-replay-viewer.png");
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
  await set(page, async () => {
    const s = window.gameState;
    const { fixcar } = await import("/src/race/physics.js");
    for (let c = 1; c < s.game.carCount; c++) {
      // damage comes from hits, which shape the dents first; fixcar does that too
      fixcar(c);
      s.racers[c].damage = 1e9;
    }
  });
  await game.advance(60);
  await expect.soft(page).toHaveScreenshot("hud-all-wasted.png");
});

test("hud: player wasted", async ({ page }) => {
  const game = await racing(page);
  await set(page, async () => {
    const s = window.gameState;
    const { fixcar } = await import("/src/race/physics.js");
    fixcar(0);
    s.racers[0].damage = 1e9;
  });
  await game.advance(60);
  await expect.soft(page).toHaveScreenshot("hud-player-wasted.png");
});
