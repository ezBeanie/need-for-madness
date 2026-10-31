import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// what a key does, the options' buttons do without one (phones and tablets)
test("the options switch the look and the classic polygons without a keyboard", async ({
  page,
}) => {
  const game = await openGame(page, { storage: { unlocked: "17" } });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  const look = () => page.evaluate(() => window.gameState.look);
  await page.locator("#optionsButton").click();
  await expect(page.locator("#options")).toBeVisible();
  const lookSwitch = page.locator("#option-toggleLook");
  await expect(lookSwitch).toHaveAttribute("aria-pressed", "false");
  await lookSwitch.click();
  expect((await look()).current).toBe(1);
  await expect(lookSwitch).toHaveAttribute("aria-pressed", "true");
  await expect(lookSwitch.locator(".state")).toHaveText("Classic");
  const depth = (await look()).depth;
  await page.locator("#option-toggleDepth").click();
  expect((await look()).depth).toBe(!depth);
  const menus = page.locator("#option-toggleClassicMenus");
  await expect(menus.locator(".state")).toHaveText("Modern");
  await menus.click();
  expect((await look()).menus).toBe(true);
  await expect(menus.locator(".state")).toHaveText("Classic");
  await page.locator("#optionsClose").click();
  await expect(page.locator("#options")).toBeHidden();
});
