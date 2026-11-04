import { afterEach, expect, test } from "vitest";
import { startRace } from "./harness/race.js";

let reset = null;
afterEach(() => reset?.());

test("racing only, a car hit takes no damage and keeps its shape", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  reset = () => (ctx.raceSetup.mode = ctx.RACE_MODE.normal);
  for (let i = 0; i < 3; i++) {
    step();
  }
  const hit = () => {
    const before = ctx.racers[1].damage;
    ctx.regn(ctx.HIT.alongZ, 1, 60, 1);
    return ctx.racers[1].damage - before;
  };
  // (a normal race: the hit damages)
  expect(hit()).toBeGreaterThan(0);
  ctx.raceSetup.mode = ctx.RACE_MODE.onlyRacing;
  const shape = Array.from(ctx.racers[1].body.dvert ?? []);
  expect(hit()).toBe(0);
  expect(Array.from(ctx.racers[1].body.dvert ?? [])).toEqual(shape);
});

test("a race of any other kind is a normal one, whatever the room raced before", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  ctx.raceSetup.mode = ctx.RACE_MODE.onlyRacing;
  ctx.chooseRaceKind(ctx.RACE_KIND.quickRace);
  expect(ctx.raceSetup.mode).toBe(ctx.RACE_MODE.normal);
});
