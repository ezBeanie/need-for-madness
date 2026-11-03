import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

const focused = (page) => page.evaluate(() => document.activeElement.id);

test("the main menu's buttons are gone through with the keys and open what they name", async ({
  page,
}) => {
  const game = await openGame(page, { storage: { carsel: "5" } });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await expect(page.locator("#mainMenu")).toBeVisible();
  // (the gear and the other buttons of the screens after it are the menu's here)
  await expect(page.locator("#optionsButton")).toBeHidden();
  await expect(page.locator("#multiplayerButton")).toBeHidden();
  await expect(page.locator("#stageEditorButton")).toBeHidden();
  await expect(page.locator("#menuReset")).toBeHidden();
  expect(await focused(page)).toBe("menuCampaign");
  // round at the ends, past the hidden Reset Game
  await page.keyboard.press("ArrowUp");
  expect(await focused(page)).toBe("menuReplay");
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press("ArrowDown");
  }
  expect(await focused(page)).toBe("menuOptions");
  await page.keyboard.press("Enter");
  await expect(page.locator("#options")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#options")).toBeHidden();
  expect(await focused(page)).toBe("menuOptions");

  // Enter with the focus outside the menu (as a gamepad's button) chooses the focused one
  // last chosen: Options again, then Campaign
  await page.evaluate(() => document.activeElement.blur());
  await game.tap("Enter");
  await expect(page.locator("#options")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("#menuCampaign").click();
  await game.advanceUntil(PHASE.carSelect);
  await expect(page.locator("#mainMenu")).toBeHidden();
  await expect(page.locator("#optionsButton")).toBeVisible();
});

test("the main menu offers to reset the game once the last stage was won", async ({
  page,
}) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17", career: "1" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await page.locator("#menuReset").click();
  await game.advance();
  expect(await game.phase()).toBe(PHASE.resetQuestion);
  await expect(page.locator("#mainMenu")).toBeHidden();
});

test("the original's menus keep their own main menu, with the buttons beside it", async ({
  page,
}) => {
  const game = await openGame(page, {
    storage: { carsel: "5", look: "1", classicMenus: "1" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await expect(page.locator("#mainMenu")).toBeHidden();
  await expect(page.locator("#optionsButton")).toBeVisible();
  await expect(page.locator("#multiplayerButton")).toBeVisible();
  await expect(page.locator("#stageEditorButton")).toBeVisible();
});

// From the main menu's button to the car select, then on with the keys (the clicked
// button, hidden with the menu, keeps none of them).
const toStageSelect = async (page, game, button) => {
  await page.locator(button).click();
  await game.advanceUntil(PHASE.carSelect);
  await game.advance(60);
  await game.tap("Enter");
  await game.advanceUntil(PHASE.stageSelect);
  await game.advance(60);
};

test("a quick race opens every stage, with the field size and the opponents' strength", async ({
  page,
}) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "2" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await toStageSelect(page, game, "#menuQuickRace");
  const state = () =>
    page.evaluate(() => ({
      stage: window.gameState.track.stage,
      raceCars: window.gameState.game.raceCars,
      strength: localStorage.getItem("strength"),
    }));
  expect((await state()).stage).toBe(2);
  // past the stages the campaign opened
  await game.tap("ArrowRight");
  // (the next stage loads first)
  await game.advanceUntil(PHASE.stageLoading);
  await game.advanceUntil(PHASE.stageSelect);
  await game.advance(60);
  expect((await state()).stage).toBe(3);
  await game.tap("c");
  await game.tap("b");
  expect(await state()).toMatchObject({ raceCars: 10, strength: "2" });
  await game.tap("Enter");
  await game.advanceUntil(PHASE.race);
  expect(await page.evaluate(() => window.gameState.game.carCount)).toBe(10);
});

test("the campaign races the stages it opened with the original's field, practice alone", async ({
  page,
}) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "2", racecars: "15" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await toStageSelect(page, game, "#menuCampaign");
  const stage = () => page.evaluate(() => window.gameState.track.stage);
  expect(await stage()).toBe(2);
  await game.tap("ArrowRight");
  await game.tap("c");
  await game.advance(5);
  expect(await stage()).toBe(2);
  expect(await page.evaluate(() => window.gameState.game.raceCars)).toBe(7);
  await game.tap("Enter");
  await game.advanceUntil(PHASE.race);
  expect(await page.evaluate(() => window.gameState.game.carCount)).toBe(7);

  // back in the main menu, practice: alone on any stage
  await page.evaluate(() => {
    window.gameState.menu.continuesToCarSelect = false;
    window.gameState.menu.animation = 0;
    window.gameState.game.phase = 1;
  });
  await game.advance(2);
  await toStageSelect(page, game, "#menuPractice");
  await game.tap("Enter");
  await game.advanceUntil(PHASE.race);
  expect(await page.evaluate(() => window.gameState.game.carCount)).toBe(1);
});

test("the arrow keys go through the menu with the focus outside it, as a gamepad's stick", async ({
  page,
}) => {
  const game = await openGame(page, { storage: { carsel: "5" } });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await page.evaluate(() => document.activeElement.blur());
  await game.tap("ArrowDown");
  expect(await focused(page)).toBe("menuQuickRace");
  await game.tap("ArrowUp");
  await game.tap("ArrowUp");
  expect(await focused(page)).toBe("menuReplay");
});
