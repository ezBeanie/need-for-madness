import { expect, test } from "vitest";
import { loadGame } from "./harness/loadGame.js";

test("a window narrower than 4:3 sees as much at the sides as 4:3 does, more above and below", async () => {
  const { ctx } = await loadGame({ seed: 1 });
  const fov = (55 * Math.PI) / 180;
  // half the width seen at a distance of 1
  const sides = (aspect) => {
    ctx.view.aspect = aspect;
    return Math.tan(ctx.fitFieldOfView(fov) / 2) * aspect;
  };
  const narrowest = sides(4 / 3);
  expect(ctx.fitFieldOfView(fov)).toBe(fov);
  expect(sides(1)).toBeCloseTo(narrowest, 10);
  expect(sides(0.8)).toBeCloseTo(narrowest, 10);
  // from 4:3 on: the same height, more at the sides the wider
  for (const aspect of [3 / 2, 16 / 9, 21 / 9]) {
    ctx.view.aspect = aspect;
    expect(ctx.fitFieldOfView(fov)).toBe(fov);
  }
  ctx.view.aspect = 16 / 9;
});

test("backdrops know how much more or less than 16:9 the view shows, to cover the window", async () => {
  const { ctx } = await loadGame({ seed: 1 });
  const seen = (aspect) => {
    ctx.view.aspect = aspect;
    return [ctx.seenWidth(), ctx.seenHeight()];
  };
  expect(seen(16 / 9)).toEqual([1, 1]);
  // wider: more at the sides only
  expect(seen(21 / 9)[0]).toBeCloseTo(21 / 16, 10);
  expect(seen(21 / 9)[1]).toBe(1);
  // 4:3: less at the sides, the same height
  expect(seen(4 / 3)[0]).toBeCloseTo(0.75, 10);
  expect(seen(4 / 3)[1]).toBe(1);
  // square: the 4:3's width, a third higher
  expect(seen(1)[0]).toBeCloseTo(0.75, 10);
  expect(seen(1)[1]).toBeCloseTo(4 / 3, 10);
  ctx.view.aspect = 16 / 9;
});
