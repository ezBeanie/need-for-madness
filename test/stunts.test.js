import { expect, test } from "vitest";
import { startRace } from "./harness/race.js";

const FLYING = 2;

test("a player stunting by key begins a stunt in the air with the handbrake only, else with an arrow too", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  ctx.raceEvents.countdown = 0;
  // whether the car, just off the ground with these keys, flies a stunt a tick on
  const flies = (keys) => {
    const racer = ctx.racers[0];
    racer.stunt = 0;
    racer.wheelsTouch = false;
    for (const key of ["up", "down", "left", "right"]) {
      racer[`${key}HeldFromGround`] = false;
    }
    racer.handbrakeHeldOnGround = false;
    Object.assign(racer.u, {
      up: false,
      down: false,
      left: false,
      right: false,
      handb: false,
      ...keys,
    });
    ctx.drive();
    return racer.stunt == FLYING;
  };
  expect(flies({ up: true, stuntKey: false })).toBe(true);
  expect(flies({ up: true, stuntKey: true })).toBe(false);
  expect(flies({ handb: true, stuntKey: true })).toBe(true);
  expect(flies({ stuntKey: true })).toBe(false);
});

test("how the player stunts goes with the keys each tick", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  const { stunts } = await import("../src/input/controls.js");
  const { KEYS } = await import("../src/net/lockstep.js");
  expect(KEYS).toContain("stuntKey");
  stunts.byKey = true;
  step();
  expect(ctx.racers[0].u.stuntKey).toBe(true);
  stunts.byKey = false;
  step();
  expect(ctx.racers[0].u.stuntKey).toBe(false);
});
