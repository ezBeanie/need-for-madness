import { expect, test } from "vitest";
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

test("the classic stage preview draws pieces out to the window's sides, not only within the original's 670 x 400", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  const rad = ctx.parseRad(SQUARE);
  ctx.tintModel(rad, () => 0.5);
  Object.assign(ctx.medium, { w: 2000, h: 450, cx: 1000, cy: 225, trk: 1 });
  // looking along -z, a focal length of half the height
  const projection = new Float32Array(16);
  projection[0] = 1;
  projection[5] = 1;
  projection[11] = -1;
  ctx.setView(projection);
  // 100 ahead, as far right as to show at about x 1600: past the original's frame
  // (1000 + 335), well within the window
  const drawnAt = (x, z) => {
    const matrix = new Float32Array(16);
    matrix[0] = matrix[5] = matrix[10] = matrix[15] = 1;
    matrix[12] = x;
    matrix[14] = z;
    ctx.startBatch();
    ctx.drawObject(rad, matrix);
    return verticesFlushed(ctx);
  };
  expect(drawnAt(-267, -100)).toBeGreaterThan(0);
  // (behind the camera it stays out)
  expect(drawnAt(-267, 100)).toBe(0);
  ctx.medium.trk = 0;
});
