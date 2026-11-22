import { expect, test } from "vitest";
import { startRace } from "./harness/race.js";

// The original's y points down, its z forward (our model's +z, see placeCorner).
test("in the classic look a wheel rolling forward turns its top forward", async () => {
  await startRace({ stage: 1, car: 5 });
  const { spun, turnWheels } = await import("../src/classic/draw.js");
  // (driving forward our spin goes down, see rollWheels in physics.js)
  turnWheels(0, -10);
  const [down, forward] = spun(-1, 0);
  expect(down).toBeLessThan(0);
  expect(forward).toBeGreaterThan(0);
});
