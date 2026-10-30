import { expect, test } from "vitest";
import { PHASE } from "../src/core/state.js";
import { loadGame } from "./harness/loadGame.js";

// (through JSON, as it would go to the other game)
const stateOf = (ctx) => JSON.stringify(ctx.saveRace());

// all but the dents, which stay: compared after the last of the ticks, they show (and the
// thousands of numbers of every tick's would make the test slow)
const stateWithoutDents = (ctx) => {
  const { cars, ...rest } = ctx.saveRace();
  return JSON.stringify({
    ...rest,
    cars: cars.map(({ dents, ...car }) => car),
  });
};

// the race's states after each of its next ticks, the last one whole; drawn: as many frames between ticks as
// the screen gets, each drawing effects at random
const runTicks = (ctx, ticks, drawn = 0) => {
  const states = [];
  for (let t = 0; t < ticks; t++) {
    ctx.fingerprintRaceTick(ctx.runTick);
    for (let frame = 0; frame < drawn; frame++) {
      ctx.random.fx();
    }
    states.push(t == ticks - 1 ? stateOf(ctx) : stateWithoutDents(ctx));
  }
  return states;
};

test("a race restored to a kept tick runs on exactly as it did from there, wrecks and dents too", async () => {
  const { ctx, stepUntil } = await loadGame({ seed: 5 });
  stepUntil(() => ctx.game.phase === PHASE.mainMenu, 400, "main menu");
  ctx.startFingerprintRace();
  stepUntil(() => ctx.game.phase === PHASE.stageSelect, 400, "stage select");
  ctx.beginFingerprintRace();
  // (the two white frames it flashes in with, which set it up)
  runTicks(ctx, 2);
  expect(ctx.game.phase).toBe(PHASE.race);
  // every tick of the race run again, from the countdown on: kept every 100 ticks
  for (let point = 0; point < 55; point++) {
    const kept = JSON.parse(stateOf(ctx));
    const ranOn = runTicks(ctx, 100);
    ctx.restoreRace(kept);
    expect(stateOf(ctx)).toEqual(JSON.stringify(kept));
    const ranAgain = runTicks(ctx, 100, 1);
    ranAgain.forEach((state, t) =>
      expect(state, `tick ${point * 100 + t + 1}`).toEqual(ranOn[t]),
    );
  }
  const cars = ctx.racers.slice(0, ctx.game.carCount);
  expect(cars.some((racer) => racer.wasted)).toBe(true);
  expect(cars.every((racer) => racer.body.iscar == 2)).toBe(true);
}, 60000);
