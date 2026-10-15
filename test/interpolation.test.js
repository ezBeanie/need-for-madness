import { beforeEach, expect, test } from "vitest";
import { loadGame } from "./harness/loadGame.js";

let ctx;
let rad;

// Draws rad as it would be drawn right after the given logic tick.
const drawAt = (tick, alpha, x, rotationDeg) => {
  ctx.tickcount = tick;
  ctx.tickalpha = alpha;
  rad.x = x;
  ctx.mat4.identity(rad.mat);
  ctx.mat4.rotateY(rad.mat, rad.mat, (rotationDeg * Math.PI) / 180);
  ctx.placemodel(rad);
  const m = ctx.drawmat;
  return { x: m[12], angle: (Math.atan2(m[8], m[0]) * 180) / Math.PI };
};

beforeEach(() => {
  ({ ctx } = loadGame());
  rad = { x: 0, y: 0, z: 0, mat: ctx.mat4.create() };
});

test("position and rotation are interpolated between the last two ticks", () => {
  drawAt(1, 0, 0, 0);
  const drawn = drawAt(2, 0.25, 20, 40);
  expect(drawn.x).toBeCloseTo(5);
  expect(drawn.angle).toBeCloseTo(10);
});

test("redrawing within the same tick only moves along with alpha", () => {
  drawAt(1, 0, 0, 0);
  drawAt(2, 0.25, 20, 40);
  expect(drawAt(2, 0.75, 20, 40).x).toBeCloseTo(15);
});

test("teleports are drawn at their new place right away", () => {
  drawAt(1, 0, 0, 0);
  expect(drawAt(2, 0.5, 5000, 0).x).toBe(5000);
});

test("objects not drawn in the previous tick are drawn where they are", () => {
  drawAt(1, 0, 0, 0);
  expect(drawAt(3, 0.5, 20, 0).x).toBe(20);
});

test("one matrix drawn at two places in the same tick is not interpolated", () => {
  drawAt(1, 0, 0, 0);
  drawAt(2, 0.5, 20, 0);
  expect(drawAt(2, 0.5, 60, 0).x).toBe(60);
});
