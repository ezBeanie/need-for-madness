import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// Web Audio kept (the driver takes it away, see driver.js), and the loops playing counted.
const countLoops = () => {
  window.playing = new Set();
  Object.defineProperty(window, "AudioContext", {
    value: window.AudioContext,
    writable: true,
    configurable: false,
  });
  const { start, stop } = AudioBufferSourceNode.prototype;
  AudioBufferSourceNode.prototype.start = function (...args) {
    if (this.loop) {
      window.playing.add(this);
    }
    return start.apply(this, args);
  };
  AudioBufferSourceNode.prototype.stop = function (...args) {
    window.playing.delete(this);
    return stop.apply(this, args);
  };
};

for (const [name, look] of [
  ["modern", "0"],
  ["classic", "1"],
]) {
  test(`engines: in the ${name} look the other cars' engines are heard too`, async ({
    page,
  }) => {
    await page.addInitScript(countLoops);
    const game = await openGame(page, {
      storage: { carsel: "5", unlocked: "17", look },
    });
    await game.advanceUntil(PHASE.mainMenu);
    await game.settle();
    // (a click allows audio)
    await page.mouse.click(5, 5);
    await page.evaluate(() => {
      const s = window.gameState;
      s.track.stage = 3;
      s.stageloadtyp = 0;
      s.stageload = 0;
      s.menu.redraw = true;
      s.game.phase = 3;
    });
    await game.advanceUntil(PHASE.stageSelect);
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      window.gameState.game.mode = 0;
      const { flashIntoRace } = await import("/src/race/countdown.js");
      flashIntoRace();
    });
    await game.advanceUntil(PHASE.race);
    const cars = await page.evaluate(() => window.gameState.game.carCount);
    // the player's engine and the others', near at the start (and the music)
    await expect
      .poll(async () => {
        await game.advance(10);
        return page.evaluate(() => window.playing.size);
      })
      .toBeGreaterThanOrEqual(cars);
  });
}
