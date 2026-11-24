import { afterEach, expect, test } from "vitest";
import { glCalls } from "./harness/browserStubs.js";
import { startRace } from "./harness/race.js";

// A red square, 20 wide, standing across the view (the original's units: ten times ours).
const SQUARE = `<p>
c(255,0,0)
p(-100,-100,0)
p(100,-100,0)
p(100,100,0)
p(-100,100,0)
</p>`;

let reset = null;
afterEach(() => reset?.());

// How many vertices the batch hands to WebGL.
const verticesFlushed = (ctx) => {
  let vertices = 0;
  glCalls.listener = (name, args) => {
    if (name === "bufferData" && args[1] instanceof Float32Array) {
      vertices = args[1].length / 4;
    }
  };
  ctx.flushBatch(ctx.medium.w, ctx.medium.h);
  glCalls.listener = null;
  return vertices;
};

test("higher graphics keep the classic look's objects and outlines farther away than the original did", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  const { QUALITY, chooseQuality, graphics } = await import(
    "../src/render/graphics.js"
  );
  reset = () => chooseQuality(QUALITY.medium, false);
  expect(graphics.detail).toBe(1);
  const rad = ctx.parseRad(SQUARE);
  ctx.tintModel(rad, () => 0.5);
  Object.assign(ctx.medium, { w: 800, h: 450, cx: 400, cy: 225, trk: 0 });
  ctx.medium.adv = 500;
  ctx.fadeFrom(3000);
  const projection = new Float32Array(16);
  projection[0] = 1;
  projection[5] = 1;
  projection[11] = -1;
  ctx.setView(projection);
  const drawnAt = (z) => {
    const matrix = new Float32Array(16);
    matrix[0] = matrix[5] = matrix[10] = matrix[15] = 1;
    matrix[14] = z;
    ctx.startBatch();
    ctx.drawObject(rad, matrix);
    return verticesFlushed(ctx);
  };
  // beyond the original's farthest fog band (a model's fades at band 14): gone, unless
  // the detail goes farther
  expect(drawnAt(-3000)).toBe(0);
  // 500 away the original draws it without its outline
  const plain = drawnAt(-500);
  expect(plain).toBeGreaterThan(0);
  chooseQuality(QUALITY.high, false);
  expect(drawnAt(-3000)).toBeGreaterThan(0);
  expect(drawnAt(-500)).toBeGreaterThan(plain);
});

test("the graphics quality sets the 3D picture's pixels", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  const { QUALITY, chooseQuality, graphics } = await import(
    "../src/render/graphics.js"
  );
  reset = () => chooseQuality(QUALITY.medium, false);
  chooseQuality(QUALITY.low, false);
  expect(graphics.resolution).toBeLessThan(1);
  ctx.fitCanvas3D();
  expect(ctx.canvas3D.width).toBe(Math.round(ctx.view.width * 0.6));
  chooseQuality(QUALITY.medium, false);
  ctx.fitCanvas3D();
  expect(ctx.canvas3D.width).toBe(ctx.view.width);
});
