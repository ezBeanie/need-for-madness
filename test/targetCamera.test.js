import { afterEach, expect, test, vi } from "vitest";
import { autopilot, raceState, startRace } from "./harness/race.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const press = (key, code) => {
  key(code, true);
  key(code, false);
};

// A race on stage 3 past its countdown, driven by the autopilot, with the arrow at the
// cars, the target camera on or off and F pressed so often (once: car 1 chosen). Returns
// the camera's view of car 1 at every tick.
const race = async (aiming, chosen = 1) => {
  const game = await startRace({ stage: 3, car: 5 });
  const { ctx, step, key } = game;
  if (aiming) {
    press(key, 84);
  }
  for (let i = 0; i < chosen; i++) {
    press(key, 70);
  }
  press(key, 81);
  const views = [];
  const states = [];
  for (let i = 0; i < 400; i++) {
    autopilot(ctx);
    step();
    if (ctx.raceEvents.countdown <= 0) {
      const own = ctx.car[ctx.game.player];
      const aimed = ctx.car[1];
      // how straight the camera looks at the aimed car past its own: 1 straight at it
      const dx = aimed.x - own.x;
      const dz = aimed.z - own.z;
      const yaw = (ctx.camera.yaw * Math.PI) / 180;
      views.push(
        (dx * Math.sin(yaw) - dz * Math.cos(yaw)) / Math.hypot(dx, dz),
      );
      states.push(JSON.stringify(raceState(ctx)));
    }
  }
  return { ...game, ctx, views, states };
};

test("T turns the camera behind the car to the car chosen with F", async () => {
  const { ctx, views } = await race(true);
  expect(ctx.camera.aims).toBe(true);
  expect(ctx.camera.lockedCar).toBe(1);
  // once it has turned, it keeps looking at the car within a few degrees
  expect(Math.min(...views.slice(60))).toBeGreaterThan(Math.cos(0.15));
});

test("the target camera leaves the race as it is", async () => {
  const aiming = await race(true);
  const behind = await race(false);
  expect(behind.ctx.camera.aimYaw).toBe(0);
  expect(Math.min(...behind.views.slice(60))).toBeLessThan(Math.cos(0.15));
  expect(aiming.states).toEqual(behind.states);
});

test("with no car chosen the target camera stays behind the car, wherever the arrow points", async () => {
  const { ctx, views } = await race(true, 0);
  expect(ctx.camera.lockedCar).toBe(-1);
  expect(ctx.camera.aimedCar).not.toBe(-1);
  expect(ctx.camera.aimYaw).toBe(0);
  expect(Math.min(...views.slice(60))).toBeLessThan(Math.cos(0.15));
});

test("F chooses the other cars in turn, then none", async () => {
  const { ctx, key } = await startRace({ stage: 3, car: 5 });
  const chosen = [];
  for (let i = 0; i < ctx.game.carCount; i++) {
    press(key, 70);
    chosen.push(ctx.camera.lockedCar);
  }
  expect(chosen).toEqual([1, 2, 3, 4, 5, 6, -1]);
  ctx.lockNext(-1);
  expect(ctx.camera.lockedCar).toBe(6);
});
