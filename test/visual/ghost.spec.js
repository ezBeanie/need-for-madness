import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// A race of time attack on stage 3, past the countdown, the car standing on the grid.
const timeAttack = async (page, look) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17", look },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.settle();
  await page.evaluate(() => {
    const s = window.gameState;
    s.chooseRaceKind(s.RACE_KIND.timeAttack);
    s.track.stage = 3;
    s.stageloadtyp = 0;
    s.stageload = 0;
    s.menu.redraw = true;
    s.game.phase = 3;
  });
  await game.advanceUntil(PHASE.stageSelect);
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    const s = window.gameState;
    s.game.mode = 0;
    s.game.carCount = 1;
    const { flashIntoRace } = await import("/src/race/countdown.js");
    flashIntoRace();
  });
  await game.advanceUntil(PHASE.race);
  return game;
};

// Where the ghost stands: ahead of the car and to its left.
const GHOST_AT = { x: 480, y: 320, width: 140, height: 110 };

for (const [name, look] of [
  ["modern", "0"],
  ["classic", "1"],
]) {
  test(`time attack's ghost shows in the ${name} look`, async ({ page }) => {
    const game = await timeAttack(page, look);
    // a ghost of another car, standing where the car stands, ahead and to the side
    await page.evaluate(() => {
      const s = window.gameState;
      const c = s.car[0];
      const tape = {};
      for (const field of ["x", "y", "z", "xy", "xz", "zy", "wzy", "wxz"]) {
        const at = field == "x" ? c.x + 14 : field == "z" ? c.z + 25 : c[field];
        tape[field] = Array.from({ length: 600 }, () => at);
      }
      Object.assign(s.ghost, { tape, ticks: 600, type: 2 });
      s.car[s.GHOST].typ = 2;
      s.car[s.GHOST].mat ??= mat4.create();
    });
    await game.advance(200);
    const withGhost = await page.screenshot({ clip: GHOST_AT });
    await page.evaluate(() => {
      window.gameState.ghost.tape = null;
    });
    await game.advance(1);
    const without = await page.screenshot({ clip: GHOST_AT });
    expect(withGhost.equals(without)).toBe(false);
  });
}
