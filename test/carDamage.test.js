import { expect, test } from "vitest";
import { autopilot, raceState, startRace } from "./harness/race.js";
import { PHASE } from "../src/core/state.js";

// Opponents wreck each other on stage 5. Dents, scratches and burns must reach the GPU,
// without reading textures back from it: that waits for all queued drawing and made
// frames take hundreds of milliseconds when many cars collided.
test("car damage is shown without reading textures back from the GPU", async () => {
  const { ctx, step } = await startRace({ stage: 5, car: 15 });
  let readBacks = 0;
  const { readPixels } = ctx.gl;
  ctx.gl.readPixels = (...args) => {
    readBacks++;
    return readPixels(...args);
  };
  for (let frame = 0; frame < 3000 && ctx.game.phase === PHASE.race; frame++) {
    Object.assign(ctx.racers[0].u, autopilot(ctx));
    step();
  }
  expect(readBacks).toBe(0);

  const damaged = ctx.car
    .slice(0, ctx.game.carCount)
    .map((car) => ctx.carModels[car.typ])
    .filter((model) => model.iscar == 2);
  expect(damaged.length).toBeGreaterThan(3);
  for (const model of damaged) {
    // drawn since the last hit, so the GPU texture shows the simulated damage
    expect(model.damagedPixels).toBe(false);
    expect(model.texture[1].pixels).toEqual(model.damagePixels);
  }
});

// The scratches are only seen: painting them with other randomness, or later, must not
// change the race.
test("scratching car damage does not change the race", async () => {
  const race = async (scratchSeed) => {
    const { ctx, step } = await startRace({ stage: 5, car: 15 });
    let a = scratchSeed;
    ctx.random.scratch = () => {
      a = (a * 16807) % 2147483647;
      return a / 2147483647;
    };
    const states = [];
    for (
      let frame = 0;
      frame < 2000 && ctx.game.phase === PHASE.race;
      frame++
    ) {
      Object.assign(ctx.racers[0].u, autopilot(ctx));
      step();
      states.push(JSON.stringify(raceState(ctx)));
    }
    const texture = ctx.carModels[ctx.car[1].typ].damagePixels;
    return { states, texture };
  };
  const first = await race(7);
  const second = await race(4242);
  expect(second.texture).not.toEqual(first.texture);
  expect(second.states).toEqual(first.states);
});
