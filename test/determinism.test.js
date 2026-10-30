import { expect, test } from "vitest";
import { PHASE } from "../src/core/state.js";
import { loadGame } from "./harness/loadGame.js";

// The fixed race of ?determinism (see src/net/determinism.js), as Node's V8 computes it.
const FINGERPRINTS = ["960c1fb5", "53514a92", "ff2012ca", "7d6cd087"];

// seed: the game's randomness before the check, waited: ticks in the stage select before
// the race (in the browser, as many as the screen gets): neither may matter
const fingerprintRace = async (seed, waited) => {
  const { ctx, stepUntil } = await loadGame({ seed });
  stepUntil(() => ctx.game.phase === PHASE.mainMenu, 400, "main menu");
  ctx.startFingerprintRace();
  stepUntil(() => ctx.game.phase === PHASE.stageSelect, 400, "stage select");
  for (let t = 0; t < waited; t++) {
    ctx.runTick();
  }
  const start = ctx.car.map(({ x, z }) => ({ x, z }));
  const prints = ctx.finishFingerprintRace(ctx.runTick);
  for (let c = 0; c < ctx.game.carCount; c++) {
    expect(
      Math.hypot(ctx.car[c].x - start[c].x, ctx.car[c].z - start[c].z),
    ).toBeGreaterThan(100);
  }
  return prints;
};

test("the determinism check races its fixed race, every car driving", async () => {
  expect(await fingerprintRace(7, 0)).toEqual(FINGERPRINTS);
  expect(await fingerprintRace(3, 3)).toEqual(FINGERPRINTS);
});
