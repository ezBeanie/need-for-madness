import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// The stage select of a quick race, on stage 3.
const quickRaceStages = async (page) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await page.evaluate(() => {
    const s = window.gameState;
    s.chooseRaceKind(s.RACE_KIND.quickRace);
    s.track.stage = 3;
    s.stageloadtyp = 0;
    s.stageload = 0;
    s.menu.redraw = true;
    s.game.phase = 3;
  });
  await game.advanceUntil(PHASE.stageSelect);
  await page.waitForLoadState("networkidle");
  await game.advance(30);
  return game;
};

test("the stage select goes through the collections with the arrows round their name, or a tap on it", async ({
  page,
}) => {
  const game = await quickRaceStages(page);
  const collection = () =>
    page.evaluate(() => {
      const s = window.gameState;
      return s.collections()[s.collectionOf(s.track.stage)];
    });
  const tap = async (x, y) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await game.advance();
    await page.mouse.up();
    await game.advance();
    await page.waitForLoadState("networkidle");
    await game.advance(10);
  };
  const ARROW_Y = 265;
  expect(await collection()).toBe("Modern");
  await tap(640 + 130, ARROW_Y);
  expect(await collection()).toBe("NFM 1");
  await tap(640 - 130, ARROW_Y);
  await tap(640 - 130, ARROW_Y);
  // round to the last
  expect(await collection()).toBe("NFM MP");
  await tap(640, ARROW_Y);
  expect(await collection()).toBe("Modern");
});
