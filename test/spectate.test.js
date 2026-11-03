import { expect, test } from "vitest";
import { startRace } from "./harness/race.js";
import { PHASE } from "../src/core/state.js";

// (damage past what the car takes: it burns out; fixed first, as a car hit has its dents)
const waste = (ctx, c) => {
  ctx.fixcar(c);
  ctx.racers[c].damage = ctx.carStats.maxmag[ctx.car[c].typ];
};

// Racing together (game.humans), the player's car wasted: the camera stays on the wreck a
// while, then follows the cars still racing, a further one each time the player steers.
test("a player whose car is wasted watches the cars still racing", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5, cars: 4 });
  ctx.game.humans = [0];
  const stepWith = (input = {}) => {
    Object.assign(ctx.racers[0].u, { left: false, right: false }, input);
    step();
  };
  // (past the countdown, which shows the field)
  while (ctx.raceEvents.countdown > 0) {
    stepWith();
  }
  stepWith();
  expect(ctx.camera.target).toBe(0);
  waste(ctx, 0);
  while (!ctx.racers[0].wasted) {
    stepWith();
  }
  for (let i = 0; i < 30; i++) {
    stepWith();
  }
  // (the wreck first)
  expect(ctx.camera.target).toBe(0);
  for (let i = 0; i < 20; i++) {
    stepWith();
  }
  expect(ctx.game.phase).toBe(PHASE.race);
  expect(ctx.camera.target).toBe(1);
  stepWith({ right: true });
  stepWith({ right: true });
  expect(ctx.camera.target).toBe(2);
  stepWith({ left: true });
  expect(ctx.camera.target).toBe(1);
  // one wasted is left for the next still racing
  waste(ctx, 1);
  while (!ctx.racers[1].wasted) {
    stepWith();
  }
  stepWith();
  expect(ctx.camera.target).toBe(2);
});

test("a player racing alone sees its wreck, not the others", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5, cars: 4 });
  while (ctx.raceEvents.countdown > 0) {
    step();
  }
  waste(ctx, 0);
  for (let i = 0; i < 120; i++) {
    step();
  }
  expect(ctx.camera.target).toBe(0);
});
