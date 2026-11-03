import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

const toMainMenu = async (page, storage = {}) => {
  const game = await openGame(page, { storage: { carsel: "5", ...storage } });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  return game;
};

test("the options' sliders set the music's and the effects' volume, and keep it", async ({
  page,
}) => {
  await toMainMenu(page);
  await page.locator("#menuOptions").click();
  const music = page.getByLabel("Music volume");
  const effects = page.getByLabel("Effects volume");
  await expect(music).toHaveValue("100");
  await expect(effects).toHaveValue("100");
  await music.focus();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("ArrowLeft");
  }
  await effects.fill("25");
  await expect(page.locator("#musicVolumeShown")).toHaveText("40%");
  await expect(page.locator("#soundVolumeShown")).toHaveText("25%");
  expect(
    await page.evaluate(() => ({
      music: window.gameState.audio.musicVolume,
      sound: window.gameState.audio.soundVolume,
    })),
  ).toEqual({ music: 0.4, sound: 0.25 });

  // (kept for the next start)
  const again = await page.context().newPage();
  const stored = await page.evaluate(() => ({
    musicVolume: localStorage.getItem("musicVolume"),
    soundVolume: localStorage.getItem("soundVolume"),
  }));
  expect(stored).toEqual({ musicVolume: "40", soundVolume: "25" });
  await toMainMenu(again, stored);
  await again.locator("#menuOptions").click();
  await expect(again.getByLabel("Music volume")).toHaveValue("40");
  await expect(again.getByLabel("Effects volume")).toHaveValue("25");
});

test("the car select's Back leads to the main menu, which alone has Multiplayer", async ({
  page,
}) => {
  const game = await toMainMenu(page);
  await page.locator("#menuQuickRace").click();
  await game.advanceUntil(PHASE.carSelect);
  await game.advance(2);
  await expect(page.locator("#optionsButton")).toBeVisible();
  await expect(page.locator("#multiplayerButton")).toBeHidden();
  // (Back sits low on the left, where the stage select has its own)
  await page.mouse.move(110, 650);
  await page.mouse.down();
  await game.advance(2);
  await page.mouse.up();
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await expect(page.locator("#mainMenu")).toBeVisible();
});

// The cars on the lobby's cards turn: a card's canvas shows the car chosen, drawn anew
// as it turns.
test("the lobby shows each player's and bot's car on its card", async ({
  page,
}) => {
  const game = await toMainMenu(page);
  await page.locator("#menuMultiplayer").click();
  await expect(page.getByRole("dialog", { name: "Multiplayer" })).toBeVisible();
  await page.getByRole("button", { name: "Host a race" }).click();
  await page.getByRole("button", { name: "Add a bot" }).click();
  await page.getByLabel("Bot 1", { exact: true }).selectOption("3");
  await game.advance(4);
  const cards = page.locator("#multiplayer canvas.car-preview");
  await expect(cards).toHaveCount(2);
  const drawn = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("#multiplayer canvas.car-preview")].map(
        (canvas) => {
          const { data } = canvas
            .getContext("2d")
            .getImageData(0, 0, canvas.width, canvas.height);
          let seen = 0;
          let sum = 0;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) {
              seen++;
              sum += data[i - 3] * 3 + data[i - 2] * 5 + data[i - 1] * 7;
            }
          }
          return { car: canvas.dataset.car, seen, sum };
        },
      ),
    );
  const before = await drawn();
  expect(before.map(({ car }) => car)).toEqual(["5", "3"]);
  for (const { seen } of before) {
    expect(seen).toBeGreaterThan(500);
  }
  await game.advance(5);
  const after = await drawn();
  expect(after.map(({ sum }) => sum)).not.toEqual(before.map(({ sum }) => sum));
  // (no cards, no cars drawn: off the lobby, the frame is the game's alone)
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await game.advance();
  expect(await page.evaluate(() => window.gameState.previews.root)).toBeNull();
});
