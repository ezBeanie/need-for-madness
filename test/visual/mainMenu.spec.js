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
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
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
