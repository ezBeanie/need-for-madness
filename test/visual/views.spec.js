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

test("the other cars' sounds are half the effects' volume until a slider sets them, the voices all of it", async ({
  page,
}) => {
  await toMainMenu(page);
  await page.locator("#menuOptions").click();
  const others = page.getByLabel("Other cars' volume");
  const voices = page.getByLabel("Voices volume");
  await expect(others).toHaveValue("50");
  await expect(voices).toHaveValue("100");
  await others.fill("30");
  await voices.fill("70");
  await expect(page.locator("#otherCarsVolumeShown")).toHaveText("30%");
  await expect(page.locator("#voiceVolumeShown")).toHaveText("70%");
  expect(
    await page.evaluate(() => {
      const { audio } = window.gameState;
      return {
        others: audio.otherCarsVolume,
        voices: audio.voiceVolume,
        otherCarsVolume: localStorage.getItem("otherCarsVolume"),
        voiceVolume: localStorage.getItem("voiceVolume"),
      };
    }),
  ).toEqual({
    others: 0.3,
    voices: 0.7,
    otherCarsVolume: "30",
    voiceVolume: "70",
  });
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
  await page.locator("#multiplayerBot0").selectOption("3");
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

// the box around what a card shows, in pixels
const shownBox = (page, index) =>
  page.evaluate((i) => {
    const canvas = document.querySelectorAll("#multiplayer canvas.car-preview")[
      i
    ];
    const { data, width, height } = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height);
    const box = { left: width, right: -1, top: height, bottom: -1 };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 0) {
          box.left = Math.min(box.left, x);
          box.right = Math.max(box.right, x);
          box.top = Math.min(box.top, y);
          box.bottom = Math.max(box.bottom, y);
        }
      }
    }
    return { ...box, width, height };
  }, index);

test("the lobby's biggest cars fit their cards all the way round", async ({
  page,
}) => {
  const game = await toMainMenu(page);
  await page.locator("#menuMultiplayer").click();
  await page.getByRole("button", { name: "Host a race" }).click();
  await page.getByRole("button", { name: "Add a bot" }).click();
  // Ice Cream, Tragdor, EL KING, M A S H E E N, Radical One, DR Monstaa
  for (const car of [9, 7, 14, 16, 17, 18]) {
    await page.locator("#multiplayerBot0").selectOption(String(car));
    // (3 degrees a tick: once round in 120)
    for (let turn = 0; turn < 120; turn += 6) {
      await game.advance(6);
      const box = await shownBox(page, 1);
      expect(box.left, `car ${car}`).toBeGreaterThan(0);
      expect(box.top, `car ${car}`).toBeGreaterThan(0);
      expect(box.right, `car ${car}`).toBeLessThan(box.width - 1);
      expect(box.bottom, `car ${car}`).toBeLessThan(box.height - 1);
    }
  }
});

test("the lobby draws all its cars with one read back a tick, none between ticks", async ({
  page,
}) => {
  const game = await toMainMenu(page);
  await page.locator("#menuMultiplayer").click();
  await page.getByRole("button", { name: "Host a race" }).click();
  // (more than a row of the drawing's tiles)
  const cars = [0, 2, 4, 6, 8, 10, 12];
  for (const [i, car] of cars.entries()) {
    await page.getByRole("button", { name: "Add a bot" }).click();
    await page.locator(`#multiplayerBot${i}`).selectOption(String(car));
  }
  await game.advance(2);
  await page.evaluate(() => {
    window.readBacks = 0;
    const read = WebGLRenderingContext.prototype.readPixels;
    WebGLRenderingContext.prototype.readPixels = function (...args) {
      window.readBacks++;
      return read.apply(this, args);
    };
  });
  const readBacks = () => page.evaluate(() => window.readBacks);
  await game.advance(3);
  expect(await readBacks()).toBe(3);
  // (frames a quarter tick apart: one in four turns the cars)
  await game.advance(8, 35 / 4);
  expect(await readBacks()).toBe(5);
  for (let card = 0; card <= cars.length; card++) {
    const box = await shownBox(page, card);
    expect(box.right - box.left, `card ${card}`).toBeGreaterThan(60);
  }
});

test("the lobby's car is chosen in the car select, every car there, Back keeping the one before; gun game has none to choose", async ({
  page,
}) => {
  const game = await openGame(page, { storage: { carsel: "5" } });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await page.locator("#menuMultiplayer").click();
  await page.getByRole("button", { name: "Host a race" }).click();
  const carButton = page.getByRole("button", { name: /^Your car/ });
  await expect(carButton).toHaveText("MAX Revenge");
  const phase = () => page.evaluate(() => window.gameState.game.phase);
  const choose = async (type, leave) => {
    await carButton.click();
    await game.advanceUntil(PHASE.carSelect);
    await expect(page.locator("#multiplayer")).toBeHidden();
    // (M A S H E E N: locked for a new player, not in a room)
    await page.evaluate((t) => (window.gameState.game.carTypes[0] = t), type);
    await game.advance(40);
    await leave();
    await game.advanceUntil(PHASE.mainMenu);
    await game.advance(2);
    await expect(page.locator("#multiplayer")).toBeVisible();
    await expect(carButton).toBeFocused();
  };
  // Back (at the bottom left): the car before kept
  await choose(16, async () => {
    await page.mouse.move(110, 655);
    await page.mouse.down();
    await game.advance(2);
    await page.mouse.up();
    await game.advance(2);
  });
  expect(await phase()).toBe(PHASE.mainMenu);
  await expect(carButton).toHaveText("MAX Revenge");
  await choose(16, () => game.tap("Enter"));
  await expect(carButton).toHaveText("M A S H E E N");
  expect(await page.evaluate(() => localStorage.getItem("carsel"))).toBe("16");
  await expect(page.locator("#multiplayer canvas.car-preview")).toHaveAttribute(
    "data-car",
    "16",
  );

  await page.getByLabel("Mode", { exact: true }).selectOption("Gun game");
  await game.advance(2);
  await expect(carButton).toBeHidden();
  await expect(page.locator("#multiplayer canvas.car-preview")).toHaveAttribute(
    "data-car",
    "0",
  );
});

test("the lobby lights its cars anew after the game was away from the menus", async ({
  page,
}) => {
  const game = await toMainMenu(page);
  await page.locator("#menuMultiplayer").click();
  await page.getByRole("button", { name: "Host a race" }).click();
  await game.advance(2);
  const MENU_LIGHT = [0, -0.05, 0.6];
  const tint = () => page.evaluate(() => window.gameState.scene.tint);
  expect(await tint()).toEqual(MENU_LIGHT);
  // away (as in a race, which lights its stage), then back in the lobby at once (as the
  // main menu opens it after a race of the room)
  await page.evaluate(() => {
    const s = window.gameState;
    s.game.phase = s.PHASE.instructions;
  });
  await game.advance();
  await page.evaluate(() => {
    const s = window.gameState;
    s.scene.tint = [0.3, 0.3, 0.3];
    s.game.phase = s.PHASE.mainMenu;
    s.openMultiplayer();
  });
  await game.advance(2);
  expect(await tint()).toEqual(MENU_LIGHT);
});

test("the views' buttons show the keyboard's focus also hovered", async ({
  page,
}) => {
  await toMainMenu(page);
  await page.locator("#menuOptions").click();
  const back = page.getByRole("button", { name: "Back" }).first();
  await back.hover();
  // (by the keyboard, so the focus shows: back from the first choice)
  await page.locator("#languageChosen").focus();
  await page.keyboard.press("Shift+Tab");
  await expect(back).toBeFocused();
  const face = await back.evaluate((button) => {
    const style = getComputedStyle(button);
    return [style.backgroundImage, style.backgroundColor];
  });
  expect(face).toEqual(["none", "rgb(255, 255, 255)"]);
});

// The classic look's cars are flat polygons of few colours, the modern look's textured.
test("the lobby shows the cars in the look chosen", async ({ page }) => {
  const game = await toMainMenu(page);
  await page.locator("#menuMultiplayer").click();
  await page.getByRole("button", { name: "Host a race" }).click();
  await game.advance(4);
  const colours = () =>
    page.evaluate(() => {
      const canvas = document.querySelector("#multiplayer canvas.car-preview");
      const { data } = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height);
      const seen = new Set();
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
          seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        }
      }
      return seen.size;
    });
  const modern = await colours();
  await page.evaluate(() => window.gameState.toggleLook());
  // (the classic models load first)
  await expect
    .poll(async () => {
      await game.advance();
      return colours();
    })
    .toBeGreaterThan(5);
  const classic = await colours();
  expect(classic * 4).toBeLessThan(modern);
});

test("a bot's paint chosen shows on its card", async ({ page }) => {
  const game = await toMainMenu(page);
  await page.locator("#menuMultiplayer").click();
  await page.getByRole("button", { name: "Host a race" }).click();
  await page.getByRole("button", { name: "Add a bot" }).click();
  await page.locator("#multiplayerBot0").selectOption("5");
  await game.advance(4);
  // the reddest share of the card's car
  const red = () =>
    page.evaluate(() => {
      const canvas = document.querySelectorAll(
        "#multiplayer canvas.car-preview",
      )[1];
      const { data } = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height);
      let seen = 0;
      let reddish = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
          seen++;
          if (data[i] > data[i + 1] + 40 && data[i] > data[i + 2] + 40) {
            reddish++;
          }
        }
      }
      return reddish / seen;
    });
  const before = await red();
  await page.locator("#multiplayerBotSkin0").selectOption("Red");
  await game.advance(2);
  expect(await red()).toBeGreaterThan(before + 0.1);
});
