import { expect, test } from "vitest";
import { autopilot, raceState, startRace } from "./harness/race.js";
import { PHASE } from "../src/core/state.js";

const race = async (otherCars, ticks = 1500) => {
  const { ctx, step } = await startRace({ stage: 5, car: 15 });
  ctx.audio.otherCars = otherCars;
  let heard = 0;
  const sound = ctx.random.sound;
  ctx.random.sound = () => {
    heard++;
    return sound();
  };
  const states = [];
  for (let i = 0; i < ticks && ctx.game.phase === PHASE.race; i++) {
    Object.assign(ctx.racers[0].u, autopilot(ctx));
    step();
    states.push(JSON.stringify(raceState(ctx)));
  }
  return { ctx, states, heard };
};

test("hearing the other cars never changes the race", async () => {
  const off = await race(false);
  const on = await race(true);
  // (opponents crash, scrape and skid on stage 5: their sounds were picked)
  expect(off.heard).toBe(0);
  expect(on.heard).toBeGreaterThan(0);
  expect(on.states).toEqual(off.states);
});

test("another car is heard on the side of the screen it is seen on", async () => {
  const { ctx } = await race(true, 400);
  let checked = 0;
  for (let c = 1; c < ctx.game.carCount; c++) {
    const { x, y, z } = ctx.car[c];
    const { side } = ctx.heardFrom(x, z);
    // where the drawing puts it: the camera's matrix on its place relative to the camera
    const m = ctx.camera.matrix;
    const [dx, dy, dz] = [x - ctx.camera.x, y - ctx.camera.y, z - ctx.camera.z];
    const clipX = m[0] * dx + m[4] * dy + m[8] * dz + m[12];
    const clipW = m[3] * dx + m[7] * dy + m[11] * dz + m[15];
    if (clipW > 0 && Math.abs(clipX / clipW) > 0.2) {
      expect(Math.sign(side), `car ${c}`).toBe(Math.sign(clipX));
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(0);
});

test("another car is heard before or behind as it is before or behind the camera", async () => {
  const { ctx } = await race(true, 400);
  const ways = new Set();
  for (let c = 0; c < ctx.game.carCount; c++) {
    const { x, y, z } = ctx.car[c];
    const { front } = ctx.heardFrom(x, z);
    const m = ctx.camera.matrix;
    const [dx, dy, dz] = [x - ctx.camera.x, y - ctx.camera.y, z - ctx.camera.z];
    const clipW = m[3] * dx + m[7] * dy + m[11] * dz + m[15];
    if (Math.abs(front) > 0.3) {
      expect(Math.sign(front), `car ${c}`).toBe(Math.sign(clipW));
      ways.add(Math.sign(front));
    }
  }
  // (the followed car at least is before the camera)
  expect(ways.has(1)).toBe(true);
});
