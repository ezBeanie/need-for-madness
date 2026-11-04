import { expect, test } from "vitest";
import { glCalls } from "./harness/browserStubs.js";
import { startRace } from "./harness/race.js";

// The vertices the batch hands to WebGL: x and y on the screen.
const flushedCorners = (ctx) => {
  let words = null;
  glCalls.listener = (name, args) => {
    if (name === "bufferData" && args[1] instanceof Float32Array) {
      words = Float32Array.from(args[1]);
    }
  };
  ctx.flushBatch(ctx.medium.w, ctx.medium.h);
  glCalls.listener = null;
  const corners = [];
  for (let i = 0; i < words.length; i += 4) {
    corners.push([words[i], words[i + 1]]);
  }
  return corners;
};

// (the original took a corner nearer than its projection holds as if it were that far
// across but not up and down, bending what reached past the screen's side)
test("in the classic look a ground patch reaching near the camera at the side is cut off there, not bent", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  Object.assign(ctx.medium, { w: 800, h: 450, cx: 400, cy: 225 });
  // looking along -z, a focal length of half the height
  const projection = new Float32Array(16);
  projection[0] = 1;
  projection[5] = 1;
  projection[11] = -1;
  ctx.setView(projection);
  // a patch on the ground 250 below the eye, off to one side, from 500 ahead to 20 ahead
  // (nearer than cz, 50; the original's z points back)
  const below = 250;
  const across = [200, 400];
  ctx.placeOrig(0, across[0], below, -500);
  ctx.placeOrig(1, across[1], below, -500);
  ctx.placeOrig(2, across[1], below, -20);
  ctx.placeOrig(3, across[0], below, -20);
  // each corner seen back on the ground: within the patch's sides or not
  const onPatch = ([x, y]) => {
    const seenAcross = Math.abs(((x - 400) * below) / (y - 225));
    return seenAcross > across[0] - 0.5 && seenAcross < across[1] + 0.5;
  };
  ctx.startBatch();
  ctx.fillNear([0, 1, 2, 3], 4, 255, 0, 0);
  const corners = flushedCorners(ctx);
  expect(corners.length).toBeGreaterThan(0);
  expect(corners.every(onPatch)).toBe(true);
  // as the original drew it, its near end bent towards the middle
  const { X, Y, Z, xs, ys } = ctx;
  const order = [0, 1, 2, 3];
  ctx.startBatch();
  ctx.fillPolygon(
    order.map((i) => xs(X[i], Z[i])),
    order.map((i) => ys(Y[i], Z[i])),
    4,
    255,
    0,
    0,
  );
  expect(flushedCorners(ctx).every(onPatch)).toBe(false);
});
