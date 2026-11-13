import { expect, test } from "vitest";
import { autopilot, startRace } from "./harness/race.js";

// A saved race shares the bodies' dents instead of copying them (a race together keeps one
// for every frame it guesses keys in): the dents it has stay as they were when the cars are
// dented on, and its fingerprint, found once for each body's dents, follows the dents.
test("a saved race's dents stay as saved while the cars are dented on", async () => {
  const { ctx, step } = await startRace({ stage: 5, car: 5, cars: 20 });
  const drive = (until) => {
    for (let f = 0; f < 3000 && !until(); f++) {
      Object.assign(ctx.racers[0].u, autopilot(ctx));
      step();
    }
    expect(until()).toBe(true);
  };
  drive(() => ctx.saveRace().cars.some(({ dents }) => dents));
  const saved = ctx.saveRace();
  const c = saved.cars.findIndex(({ dents }) => dents);
  const written = JSON.stringify(saved.cars[c].dents);
  const { print } = ctx.printOf(saved);
  drive(() => JSON.stringify(ctx.racers[c].body.dvert) != written);

  expect(JSON.stringify(saved.cars[c].dents)).toBe(written);
  expect(ctx.printOf(saved).print).toBe(print);
  const now = ctx.sharedRace();
  expect(ctx.printOf(now).print).not.toBe(print);
  // (the same race with copies of the dents: no fingerprint kept for them yet)
  expect(ctx.printOf(structuredClone(now)).print).toBe(ctx.printOf(now).print);
}, 120000);
