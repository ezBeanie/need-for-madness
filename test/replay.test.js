import { expect, test } from "vitest";
import { autopilot, startRace } from "./harness/race.js";
import { PHASE } from "../src/core/state.js";

const TAPE_TICKS = 430;

// The events of a tape (hits, fixes, dust, sparks) within the last TAPE_TICKS, each as
// [time in that window, ...its fields], sorted; from is where the window starts on it.
const eventsOf = (tape, fields, count, from) =>
  Array.from({ length: tape[count] }, (_, i) =>
    fields.map((field, k) => (k == 0 ? tape[field][i] - from : tape[field][i])),
  )
    .filter(([at]) => at >= 0 && at < TAPE_TICKS)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);

// Everything of the last TAPE_TICKS a tape holds, the race tape's from its tick from.
const lastTicksOf = ({ DUST, HIT, RECORDED_PER_TICK, SPARK }, tape, from) => ({
  cars: tape.cars.map((car) => ({
    perTick: RECORDED_PER_TICK.map((field) =>
      car[field].slice(from, from + TAPE_TICKS),
    ),
    hits: eventsOf(car, HIT, "hitCount", from),
    fixes: eventsOf(car, ["fixAt"], "fixCount", from),
    dust: eventsOf(car, DUST, "dustCount", from),
    wasted:
      car.wastedAt - from >= 0 && car.wastedAt - from < TAPE_TICKS
        ? car.wastedAt - from
        : null,
  })),
  sparks: eventsOf(tape.sparks, SPARK, "count", from),
  checkpoint: tape.checkpoint.slice(from, from + TAPE_TICKS),
});

const race = async (ticks) => {
  const game = await startRace({ stage: 5, car: 15 });
  const { ctx, step } = game;
  let raced = 0;
  for (let i = 0; i < ticks && ctx.game.phase === PHASE.race; i++) {
    Object.assign(ctx.racers[0].u, autopilot(ctx));
    if (ctx.raceEvents.countdown == 0 && ctx.raceEvents.raceOverTicks < 100) {
      raced++;
    }
    step();
  }
  return { ...game, raced };
};

test("the whole race is recorded, its last ticks as the instant replay has them", async () => {
  const { ctx, raced } = await race(1500);
  const { raceTape, recording } = ctx;
  expect(raceTape.length).toBe(raced);
  const from = raceTape.length - TAPE_TICKS;
  // (the module needs the browser stand-ins the game was loaded with)
  const fields = await import("../src/race/raceTape.js");
  const whole = lastTicksOf(fields, raceTape, from);
  expect(whole).toEqual(lastTicksOf(fields, recording.tape, 0));
  // (opponents crash into each other on stage 5)
  expect(whole.cars.some((car) => car.hits.length)).toBe(true);
  expect(whole.cars.some((car) => car.dust.length)).toBe(true);
  expect(raceTape.cars[0].x.slice(0, 5)).not.toEqual(whole.cars[0].perTick[0]);
});

test("time wound back takes back what the race tape had recorded since", async () => {
  const { ctx, step } = await race(900);
  ctx.startTimeRewind();
  while (ctx.game.phase === PHASE.timeRewind) {
    step();
  }
  expect(ctx.game.phase).toBe(PHASE.race);
  const resumedAt = ctx.raceTape.length - 1;
  // the race goes on from the last tick kept, where the cars were put
  expect(ctx.raceTape.cars[0].x[resumedAt]).toBe(ctx.car[0].x);
  expect(ctx.raceTape.cars[0].z[resumedAt]).toBe(ctx.car[0].z);
  for (const tape of ctx.raceTape.cars) {
    expect(tape.x).toHaveLength(ctx.raceTape.length);
    expect(tape.hitAt.every((at) => at <= resumedAt)).toBe(true);
  }
  for (let i = 0; i < 50; i++) {
    Object.assign(ctx.racers[0].u, autopilot(ctx));
    step();
  }
  expect(ctx.raceTape.cars[0].x).toHaveLength(resumedAt + 51);
});
