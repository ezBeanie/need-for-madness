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

test("cars crash solid without ramps unless chosen otherwise in the options, and a room hosted begins with the choice", async ({
  page,
}) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17" },
    url: "/?host=crashes",
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await page.locator("#menuOptions").click();
  const chosen = page.locator("#options").getByLabel("Collisions");
  await expect(chosen).toHaveValue("2");
  await chosen.selectOption("Solid");
  expect(await page.evaluate(() => localStorage.getItem("collisions"))).toBe(
    "1",
  );
  await page.locator("#optionsClose").click();
  // (the room was opened with the page, before the choice: hosted anew it has it)
  await page.evaluate(() => window.gameState.hostRoom("crashes-again"));
  await page.locator("#menuMultiplayer").click();
  await expect(page.locator("#lobbyCollisions")).toHaveValue("1");
});

test("the options say the game's version, and what changed in each one when asked", async ({
  page,
}) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await page.locator("#menuOptions").click();
  const version = await page.evaluate(() => window.gameState.VERSION);
  await expect(page.locator("#gameVersion")).toHaveText(`Version ${version}`);
  const changes = page.locator("#changelog h4").first();
  await expect(changes).toBeHidden();
  await page.getByText("What's new").click();
  await expect(changes).toHaveText(
    new RegExp(`^${version.replaceAll(".", "\\.")} `),
  );
});

test("the game is English until German is chosen in the options, then all of it at once, and English again", async ({
  page,
}) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#menuMultiplayer")).toHaveText("Multiplayer");
  await page.locator("#menuOptions").click();
  const chosen = page.locator("#options").getByLabel("Game language");
  await expect(chosen).toHaveValue("en");
  await chosen.selectOption("de");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.locator("#optionsTitle")).toHaveText("Optionen");
  await expect(page.locator("#optionsClose")).toHaveText("Zurück");
  // (what the game writes itself)
  await expect(page.locator("#option-toggleAiming .state")).toHaveText("Aus");
  await expect(page.locator("#gameVersion")).toHaveText(/^Version /);
  expect(await page.evaluate(() => localStorage.getItem("language"))).toBe(
    "de",
  );
  await page.locator("#optionsClose").click();
  await game.advance(2);
  await expect(page.locator("#menuMultiplayer")).toHaveText("Mehrspieler");
  await expect(page.locator("#menuOptions")).toHaveText("Optionen");
  await page.locator("#menuOptions").click();
  await page.locator("#options").getByLabel("Spielsprache").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#optionsTitle")).toHaveText("Options");
  await expect(page.locator("#option-toggleAiming .state")).toHaveText("Off");
  await page.locator("#optionsClose").click();
  await game.advance(2);
  await expect(page.locator("#menuMultiplayer")).toHaveText("Multiplayer");
});

// Every text a page draws on its canvas, to see what its HUD says.
const recordDrawnTexts = (page) =>
  page.addInitScript(() => {
    window.drawnTexts = new Set();
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
      window.drawnTexts.add(String(text));
      return fillText.call(this, text, ...rest);
    };
  });

test("a game started in German races with its HUD in German", async ({
  page,
}) => {
  await recordDrawnTexts(page);
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17", language: "de" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.locator("#menuCampaign")).toHaveText("Kampagne");
  await page.evaluate(() => {
    const s = window.gameState;
    s.track.stage = 3;
    s.menu.redraw = true;
    s.game.phase = 3;
  });
  await game.advanceUntil(PHASE.stageSelect);
  await page.evaluate(async () => {
    window.gameState.game.mode = 0;
    const { flashIntoRace } = await import("/src/race/countdown.js");
    flashIntoRace();
  });
  await game.advanceUntil(PHASE.race);
  await game.advance(200);
  const texts = await page.evaluate(() => [...window.drawnTexts]);
  expect(texts).toEqual(expect.arrayContaining(["Runde", "Schaden"]));
  expect(texts).not.toContain("Lap");
});
