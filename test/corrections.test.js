import { expect, test } from "vitest";
import { startRace } from "./harness/race.js";

// Where car c is drawn now (with the camera at the world's middle), and which way its
// model's x axis points.
const drawn = (ctx, c) => {
  ctx.interpolation.alpha = 1;
  ctx.drawCamera.x = ctx.drawCamera.y = ctx.drawCamera.z = 0;
  ctx.placeModel(ctx.car[c]);
  const m = ctx.drawMatrix;
  return { x: m[12], y: m[13], z: m[14], axis: [m[0], m[1], m[2]] };
};

test("a car the race moved on going back is drawn from where it was seen, easing to where it is", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  for (let i = 0; i < 5; i++) {
    step();
  }
  const c = 1;
  const racer = ctx.car[c];
  const seenAt = { x: racer.x, z: racer.z };
  ctx.noteBeforeRollback();
  // the race run again: the car 20 farther along x and turned a quarter about y
  racer.x += 20;
  mat4.rotateY(racer.mat, racer.mat, Math.PI / 2);
  const kept = { x: racer.x, mat: Float32Array.from(racer.mat) };
  ctx.interpolation.tick++;
  ctx.fadeCorrections(0);
  ctx.noteAfterRollback();
  ctx.fadeCorrections(0);
  const first = drawn(ctx, c);
  expect(first.x).toBeCloseTo(seenAt.x, 3);
  expect(first.z).toBeCloseTo(seenAt.z, 3);
  // eased in: halfway there in less than a tenth of a second, all there soon after
  ctx.fadeCorrections(60);
  const easing = drawn(ctx, c);
  expect(easing.x - seenAt.x).toBeGreaterThan(5);
  expect(easing.x - seenAt.x).toBeLessThan(15);
  ctx.fadeCorrections(1000);
  const there = drawn(ctx, c);
  expect(there.x).toBeCloseTo(racer.x, 3);
  for (let i = 0; i < 3; i++) {
    expect(there.axis[i]).toBeCloseTo(kept.mat[i], 3);
  }
  // only the drawing: the race keeps the car where it is
  expect(racer.x).toBe(kept.x);
  expect(Array.from(racer.mat.slice(0, 12))).toEqual(
    Array.from(kept.mat.slice(0, 12)),
  );
});

test("a car put somewhere far (fixed, reset) is drawn there at once", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  step();
  const racer = ctx.car[1];
  ctx.noteBeforeRollback();
  racer.x += 1000;
  ctx.interpolation.tick++;
  ctx.noteAfterRollback();
  ctx.fadeCorrections(0);
  expect(drawn(ctx, 1).x).toBeCloseTo(racer.x, 3);
});
