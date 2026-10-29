import { expect, test } from "vitest";
import { PHASE } from "../src/core/state.js";
import { autopilot, startRace, steerAlongPath } from "./harness/race.js";

// MISSED.following of src/race/racers.js, which needs the game loaded to be imported
const FOLLOWING = -1;

// Races with the player in car 0 and a second person in car 1, both steered by the test;
// without a secondDriver the second person presses nothing.
const raceTwoPeople = async (frames, secondDriver) => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  ctx.game.humans = [0, 1];
  const start = { x: ctx.car[1].x, z: ctx.car[1].z };
  const following = new Set();
  for (
    let frame = 0;
    frame < frames && ctx.game.phase === PHASE.race;
    frame++
  ) {
    Object.assign(ctx.racers[0].u, autopilot(ctx));
    if (secondDriver) {
      Object.assign(ctx.racers[1].u, secondDriver(ctx));
    }
    step();
    for (let c = 0; c < ctx.game.carCount; c++) {
      if (ctx.racers[c].missedCheckpoint == FOLLOWING) {
        following.add(c);
      }
    }
  }
  const moved = Math.hypot(ctx.car[1].x - start.x, ctx.car[1].z - start.z);
  return { ctx, moved, following };
};

test("the AI leaves a car that a person drives alone", async () => {
  const { ctx, moved } = await raceTwoPeople(600);
  expect(ctx.game.phase).toBe(PHASE.race);
  expect(moved).toBeLessThan(5);
  expect(ctx.racers[1].clear).toBe(0);
});

test("a second person races by the player's rules", async () => {
  const { ctx, moved, following } = await raceTwoPeople(500, (ctx) =>
    steerAlongPath(ctx, 1),
  );
  expect(moved).toBeGreaterThan(300);
  expect(ctx.racers[1].point).toBeGreaterThan(0);
  // only people follow the path without a checkpoint in focus
  expect([...following]).toEqual([0, 1]);
});

test("without humans the AI drives car 1 as before", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  const start = { x: ctx.car[1].x, z: ctx.car[1].z };
  for (let frame = 0; frame < 600; frame++) {
    Object.assign(ctx.racers[0].u, autopilot(ctx));
    step();
  }
  expect(ctx.game.humans).toEqual([]);
  expect(
    Math.hypot(ctx.car[1].x - start.x, ctx.car[1].z - start.z),
  ).toBeGreaterThan(300);
});
