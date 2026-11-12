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

// The other cars, the nearest to the player's first.
const byDistance = (ctx) => {
  const own = ctx.car[ctx.game.player];
  const distance = (c) =>
    Math.hypot(ctx.car[c].x - own.x, ctx.car[c].z - own.z);
  return Array.from({ length: ctx.game.carCount }, (_, c) => c)
    .filter((c) => c != ctx.game.player && !ctx.racers[c].wasted)
    .sort((a, b) => distance(a) - distance(b) || a - b);
};

const shift = (ctx, down) =>
  ctx.handleKey({ keyCode: 16, code: "ShiftLeft" }, down, ctx.onKey);

test("F chooses the other cars from the nearest to the farthest, then none; Shift+F the other way", async () => {
  const { ctx, key } = await startRace({ stage: 3, car: 5 });
  // the last on the grid put beside the player's
  const own = ctx.car[ctx.game.player];
  ctx.car[6].x = own.x + 50;
  ctx.car[6].z = own.z;
  const order = byDistance(ctx);
  expect(order[0]).toBe(6);
  const chosen = [];
  for (let i = 0; i < ctx.game.carCount; i++) {
    press(key, 70);
    chosen.push(ctx.camera.lockedCar);
  }
  expect(chosen).toEqual([...order, -1]);
  shift(ctx, true);
  press(key, 70);
  expect(ctx.camera.lockedCar).toBe(order.at(-1));
  press(key, 70);
  expect(ctx.camera.lockedCar).toBe(order.at(-2));
  shift(ctx, false);
  press(key, 70);
  expect(ctx.camera.lockedCar).toBe(order.at(-1));
});

test("a wasted car cannot be chosen, and the car chosen wasted lets the camera go to none", async () => {
  const { ctx, key, step } = await startRace({ stage: 3, car: 5 });
  const [nearest, second] = byDistance(ctx);
  ctx.racers[nearest].wasted = true;
  press(key, 70);
  expect(ctx.camera.lockedCar).toBe(second);
  ctx.lockCar(nearest);
  expect(ctx.camera.lockedCar).toBe(-1);
  ctx.lockCar(second);
  ctx.racers[second].wasted = true;
  step();
  expect(ctx.camera.lockedCar).toBe(-1);
});

// A gamepad at rest but for what is given.
const pad = ({ axes = [0, 0, 0, 0], pressed = [] } = {}) => ({
  connected: true,
  axes,
  buttons: Array.from({ length: 16 }, (_, i) => ({
    pressed: pressed.includes(i),
  })),
});

test("with the target camera on, the right stick to a side chooses the next car that way and a click on the left stick none, without steering", async () => {
  const { ctx, key, step } = await startRace({ stage: 3, car: 5 });
  const pads = [pad()];
  globalThis.navigator.getGamepads = () => pads;
  ctx.lookForGamepads();
  press(key, 84);
  const order = byDistance(ctx);
  const hold = (state, frames = 3) => {
    pads[0] = state;
    for (let i = 0; i < frames; i++) {
      step();
    }
  };
  hold(pad({ axes: [0, 0, 0.9, 0] }));
  // (once per tilt, however long it is held)
  expect(ctx.camera.lockedCar).toBe(order[0]);
  expect(ctx.racers[ctx.game.player].u.right).toBe(false);
  hold(pad());
  hold(pad({ axes: [0, 0, 0.9, 0] }));
  expect(ctx.camera.lockedCar).toBe(order[1]);
  hold(pad());
  hold(pad({ axes: [0, 0, -0.9, 0] }));
  expect(ctx.camera.lockedCar).toBe(order[0]);
  hold(pad({ pressed: [10] }));
  expect(ctx.camera.lockedCar).toBe(-1);
  expect(ctx.confirm.state).toBeFalsy();
  // with the target camera off, the right stick steers as before
  hold(pad());
  press(key, 84);
  hold(pad({ axes: [0, 0, 0.9, 0] }));
  expect(ctx.camera.lockedCar).toBe(-1);
  expect(ctx.racers[ctx.game.player].u.right).toBe(true);
});
