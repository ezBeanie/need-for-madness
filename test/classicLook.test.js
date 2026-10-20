import { expect, test } from "vitest";
import { canvasCalls } from "./harness/browserStubs.js";
import { startRace } from "./harness/race.js";

test("L switches a race to the original game's look and back", async () => {
  const { ctx, step, key } = await startRace({ stage: 1, car: 5 });
  const pressL = () => {
    key(76, true);
    key(76, false);
  };
  const filled = () => {
    let fills = 0;
    canvasCalls.listener = (name, args, call) => {
      if (name === "fill" || name === "fillRect") {
        fills++;
      }
      return call();
    };
    step();
    canvasCalls.listener = null;
    return fills;
  };
  const modern = filled();

  pressL();
  expect(ctx.look.current).toBe(ctx.LOOK.classic);
  // the original's models arrive, then the sky, the ground and the stage's polygons
  for (let i = 0; i < 5; i++) {
    step();
  }
  expect(filled()).toBeGreaterThan(modern + 100);

  pressL();
  expect(ctx.look.current).toBe(ctx.LOOK.modern);
  expect(filled()).toBeLessThan(modern + 100);
});
