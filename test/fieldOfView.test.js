import { expect, test } from "vitest";
import { loadGame } from "./harness/loadGame.js";

test("a window narrower than 16:9 sees as much at the sides as 16:9 does, more above and below", async () => {
  const { ctx } = await loadGame({ seed: 1 });
  const fov = (55 * Math.PI) / 180;
  // half the width seen at a distance of 1
  const sides = (aspect) => {
    ctx.view.aspect = aspect;
    return Math.tan(ctx.fitFieldOfView(fov) / 2) * aspect;
  };
  const wide = sides(16 / 9);
  expect(ctx.fitFieldOfView(fov)).toBe(fov);
  expect(sides(4 / 3)).toBeCloseTo(wide, 10);
  expect(sides(1)).toBeCloseTo(wide, 10);
  // wider: the same height, more at the sides
  ctx.view.aspect = 21 / 9;
  expect(ctx.fitFieldOfView(fov)).toBe(fov);
  ctx.view.aspect = 16 / 9;
});
