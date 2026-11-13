import { afterEach, expect, test } from "vitest";
import { startRace } from "./harness/race.js";

let reset = null;
afterEach(() => reset?.());

// A room's race with these collisions, past the countdown, cars 1 and 2 standing still
// sunk halfway into each other side by side: how far apart they are after a while.
const sunkIn = async (collisions) => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  reset = () => {
    ctx.game.humans = [];
    ctx.raceSetup.rules = ctx.roomRules();
  };
  ctx.game.humans = [0, 1, 2];
  ctx.raceSetup.rules = { ...ctx.roomRules(), collisions };
  ctx.raceEvents.countdown = 0;
  for (let i = 0; i < 20; i++) {
    ctx.drive();
  }
  ctx.car[2].x = ctx.car[1].x + 6;
  ctx.car[2].z = ctx.car[1].z;
  ctx.car[2].y = ctx.car[1].y;
  for (let i = 0; i < 30; i++) {
    ctx.drive();
  }
  return Math.abs(ctx.car[2].x - ctx.car[1].x);
};

test("solid cars sunk into each other are pushed apart, as the original's stay in each other", async () => {
  const { COLLISIONS } = await import("../src/core/state.js");
  expect(await sunkIn(COLLISIONS.original)).toBeLessThan(8);
  expect(await sunkIn(COLLISIONS.solid)).toBeGreaterThan(12);
});

// Car 1 ramming car 2 from behind at speed in a room's race with these collisions: how
// fast car 2 was lifted at most.
const rammed = async (collisions) => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  reset = () => {
    ctx.game.humans = [];
    ctx.raceSetup.rules = ctx.roomRules();
  };
  ctx.game.humans = [0, 1];
  ctx.raceSetup.rules = { ...ctx.roomRules(), collisions };
  ctx.raceEvents.countdown = 0;
  for (let i = 0; i < 20; i++) {
    ctx.drive();
  }
  ctx.car[2].x = ctx.car[1].x;
  ctx.car[2].z = ctx.car[1].z + 20;
  ctx.racers[1].speed = 25;
  for (let k = 0; k < 4; k++) {
    ctx.racers[1].wheelSpeedZ[k] = 25;
  }
  let most = 0;
  for (let i = 0; i < 8; i++) {
    ctx.drive();
    most = Math.min(most, ...ctx.racers[2].wheelSpeedY);
  }
  return most;
};

test("solid cars without ramps crash without lifting each other", async () => {
  const { COLLISIONS } = await import("../src/core/state.js");
  // (negative: up)
  expect(await rammed(COLLISIONS.original)).toBeLessThan(-1);
  expect(await rammed(COLLISIONS.solid)).toBeLessThan(-1);
  expect(await rammed(COLLISIONS.solidNoRamps)).toBeGreaterThan(-0.5);
});
