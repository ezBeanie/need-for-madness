import { expect, test } from "vitest";
import { startRace } from "./harness/race.js";

// The fields of an object in the other order, as a game that set them otherwise has them.
const reversed = (object) =>
  Object.fromEntries(Object.entries(object).reverse());

test("two games' races alike print alike, whatever order their cars' fields were set in", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  for (let i = 0; i < 10; i++) {
    step();
  }
  const race = ctx.sharedRace();
  const otherRace = {
    ...race,
    cars: race.cars.map((saved) => ({
      ...saved,
      car: reversed(saved.car),
      racer: reversed(saved.racer),
      driver: reversed(saved.driver),
    })),
  };
  // (written as they are, the two would differ)
  expect(ctx.encode(otherRace)).not.toBe(ctx.encode(race));
  expect(ctx.printOf(otherRace).print).toBe(ctx.printOf(race).print);
  // a race really apart still prints apart
  const apart = { ...race, cars: race.cars.slice() };
  apart.cars[1] = { ...race.cars[1], car: { ...race.cars[1].car, x: 1 } };
  expect(ctx.printOf(apart).print).not.toBe(ctx.printOf(race).print);
});
