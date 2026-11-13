import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// Starts a race on stage and ends it right away as given, at the race end screen.
const endRace = async (page, { stage, unlocked, winner, cars = 7 }) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: String(unlocked), career: "1" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.settle();
  await page.evaluate((stage) => {
    const s = window.gameState;
    s.track.stage = stage;
    s.stageloadtyp = 0;
    s.stageload = 0;
    s.menu.redraw = true;
    s.game.phase = 3;
  }, stage);
  await game.advanceUntil(PHASE.stageSelect);
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    window.gameState.game.mode = 0;
    const { flashIntoRace } = await import("/src/race/countdown.js");
    flashIntoRace();
  });
  await game.advanceUntil(PHASE.race);
  await game.advance(20);
  await page.evaluate(
    async ({ unlocked, winner, cars, raceEnd }) => {
      const s = window.gameState;
      // the module the game uses, as the dev server serves it
      const { startRaceEnd } = await import("/src/screens/raceEnd.js");
      s.game.unlocked = unlocked;
      s.raceEvents.winner = winner;
      s.game.carCount = cars;
      startRaceEnd();
      s.game.phase = raceEnd;
    },
    { unlocked, winner, cars, raceEnd: PHASE.raceEnd },
  );
  return game;
};

test("race end after winning a stage that unlocks a car", async ({ page }) => {
  const game = await endRace(page, { stage: 2, unlocked: 2, winner: true });
  await game.advance(30);
  await expect.soft(page).toHaveScreenshot("race-end-fading-in.png");
  await game.advance(40);
  await expect.soft(page).toHaveScreenshot("race-end-unlocked-car.png");
});

test("race end after losing", async ({ page }) => {
  const game = await endRace(page, { stage: 5, unlocked: 9, winner: false });
  await game.advance(60);
  await expect.soft(page).toHaveScreenshot("race-end-lost.png");
});

test("race end after winning the last stage", async ({ page }) => {
  const game = await endRace(page, { stage: 17, unlocked: 17, winner: true });
  await game.advance(70);
  await expect.soft(page).toHaveScreenshot("race-end-confetti.png");
});

test("race end after practice", async ({ page }) => {
  const game = await endRace(page, {
    stage: 1,
    unlocked: 1,
    winner: false,
    cars: 1,
  });
  await game.advance(60);
  await expect.soft(page).toHaveScreenshot("race-end-practice.png");
});

// A room's race of twenty cars: every car's result in sight, above the buttons under the
// table, in both looks and on a phone held sideways too.
for (const [width, height] of [
  [1280, 720],
  [844, 390],
]) {
  test(`the results of twenty cars fit a screen of ${width}x${height}`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.drawnTexts = [];
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
        const { width } = this.measureText(text);
        window.drawnTexts.push({ text: String(text), x, y, width });
        return fillText.call(this, text, x, y);
      };
    });
    const game = await openGame(page);
    await game.advanceUntil(PHASE.mainMenu);
    await page.setViewportSize({ width, height });
    await game.advance();
    for (const classic of [false, true]) {
      const drawn = await page.evaluate((classic) => {
        const { drawResults, look, LOOK, view, KILL_HEADS, killRow } =
          window.gameState;
        look.current = classic ? LOOK.classic : LOOK.modern;
        look.menus = classic;
        // (most kills' table, as wide as it gets: long names, big numbers)
        const names = Array.from(
          { length: 20 },
          (_, c) => `Radical One ${c + 1}`,
        );
        window.drawnTexts = [];
        drawResults(
          KILL_HEADS,
          names.map((name, place) => ({
            ...killRow(
              { c: 0, kills: 12, assists: 10, dealt: 12.5, deaths: 11 },
              place,
            ),
            cells: [`${place + 1}th`, name, "12", "10", "1250%", "11"],
            line: `${place + 1}th  ${name}  12 kills, 10 assists, 1250% damage, wasted 11`,
          })),
        );
        // (the buttons' top: see afterRaceOver in ui/hud.js)
        const buttonsTop = view.height - 90 * view.scale - 40 * view.scaleY;
        return names.map((name) => {
          const at = window.drawnTexts.find(({ text }) =>
            classic ? text.includes(`  ${name}  `) : text == name,
          );
          return (
            at != undefined &&
            at.y > 0 &&
            at.y < buttonsTop &&
            at.x - (classic ? at.width / 2 : 0) >= 0 &&
            at.x + at.width / (classic ? 2 : 1) <= view.width &&
            // (the numbers, right aligned, in sight too)
            window.drawnTexts.every(({ x }) => x >= 0 && x <= view.width)
          );
        });
      }, classic);
      expect(drawn).toEqual(Array(20).fill(true));
    }
  });
}
