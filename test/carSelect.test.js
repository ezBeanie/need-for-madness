import { expect, test } from "vitest";
import { openCarSelect } from "./harness/race.js";

// Browsing on while a car still flies out does not wait for it: the cars go by as fast as
// they are asked for.
test("the car select goes on to the next car at once while the last one still moves", async () => {
  const { ctx, key, step, stepUntil } = await openCarSelect();
  ctx.game.unlocked = 17;
  const hovering = () => ctx.showcase.motion == ctx.SHOWCASE.hovering;
  stepUntil(hovering, 200, "the first car landed");
  const first = ctx.game.carTypes[0];
  const right = () => {
    key(39, true);
    step();
    key(39, false);
  };
  right();
  step();
  step();
  right();
  let ticks = 0;
  while (!hovering() && ticks < 200) {
    step();
    ticks++;
  }
  expect(ctx.game.carTypes[0]).toBe(first + 2);
  // (before, one car flying out and the next dropping in took longer than that)
  expect(ticks).toBeLessThan(25);
});
