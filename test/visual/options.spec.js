import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// what a key does, the options' buttons do without one (phones and tablets)
test("the options switch the look and the classic polygons without a keyboard", async ({
  page,
}) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  const look = () => page.evaluate(() => window.gameState.look);
  await page.locator("#menuOptions").click();
  await expect(page.locator("#options")).toBeVisible();
  const lookSwitch = page.locator("#option-toggleLook");
  await expect(lookSwitch).toHaveAttribute("aria-pressed", "false");
  await lookSwitch.click();
  expect((await look()).current).toBe(1);
  await expect(lookSwitch).toHaveAttribute("aria-pressed", "true");
  await expect(lookSwitch.locator(".state")).toHaveText("Classic");
  const menus = page.locator("#option-toggleClassicMenus");
  await expect(menus.locator(".state")).toHaveText("Modern");
  await menus.click();
  expect((await look()).menus).toBe(true);
  await expect(menus.locator(".state")).toHaveText("Classic");
  await page.locator("#optionsClose").click();
  await expect(page.locator("#options")).toBeHidden();
});

test("the name typed in the options is kept at once, though the game is left before the field is", async ({
  page,
}) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await page.locator("#menuOptions").click();
  await page.getByLabel("Your name").pressSequentially("Hosti");
  // (gone at once, as a phone's app swiped away: the field never loses its focus)
  await page.reload();
  await page.waitForFunction(() => window.advanceFrames !== undefined);
  expect(await page.evaluate(() => localStorage.getItem("playerName"))).toBe(
    "Hosti",
  );
});
