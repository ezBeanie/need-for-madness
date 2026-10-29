import { expect, test } from "vitest";
import { autopilot, raceState, startRace } from "./harness/race.js";
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
  const fields = {
    ...(await import("../src/race/raceTape.js")),
    RECORDED_PER_TICK: (await import("../src/race/recording.js"))
      .RECORDED_PER_TICK,
  };
  const whole = lastTicksOf(fields, raceTape, from);
  expect(whole).toEqual(lastTicksOf(fields, recording.tape, 0));
  // (opponents crash into each other on stage 5)
  expect(whole.cars.some((car) => car.hits.length)).toBe(true);
  expect(whole.cars.some((car) => car.dust.length)).toBe(true);
  // the cars' skids and scrapes as heard, each in a tick of the race
  const sounds = raceTape.cars.flatMap((car) => car.soundAt);
  expect(sounds.length).toBeGreaterThan(0);
  expect(sounds.every((at) => at >= 0 && at < raceTape.length)).toBe(true);
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
    expect(tape.soundAt.every((at) => at <= resumedAt)).toBe(true);
    expect(tape.soundAt).toHaveLength(tape.soundCount);
  }
  for (let i = 0; i < 50; i++) {
    Object.assign(ctx.racers[0].u, autopilot(ctx));
    step();
  }
  expect(ctx.raceTape.cars[0].x).toHaveLength(resumedAt + 51);
});

// Runs the race on: n ticks, the autopilot driving.
const drive = (ctx, step, n) => {
  const states = [];
  for (let i = 0; i < n && ctx.game.phase === PHASE.race; i++) {
    Object.assign(ctx.racers[0].u, autopilot(ctx));
    step();
    states.push(JSON.stringify(raceState(ctx)));
  }
  return states;
};

test("a replay watched in the pause menu leaves the race as it was", async () => {
  const plain = await race(1200);
  const goesOn = drive(plain.ctx, plain.step, 600);

  const watched = await race(1200);
  const { ctx, step } = watched;
  ctx.game.phase = PHASE.paused;
  ctx.openReplay(ctx.VIEWER_FROM.pauseMenu, 0);
  expect(ctx.game.phase).toBe(PHASE.replay);
  for (let i = 0; i < 200; i++) {
    ctx.replayViewerTick(0);
  }
  ctx.seekReplay(100);
  ctx.changeSpeed(2);
  for (let i = 0; i < 100; i++) {
    ctx.replayViewerTick(i < 40 ? -1 : 0);
  }
  ctx.closeReplay();
  expect(ctx.game.phase).toBe(PHASE.paused);
  ctx.game.phase = PHASE.race;
  expect(drive(ctx, step, 600)).toEqual(goesOn);
});

test("the viewer shows each frame of the race where the cars were", async () => {
  const { ctx } = await race(800);
  ctx.game.phase = PHASE.paused;
  ctx.openReplay(ctx.VIEWER_FROM.pauseMenu, 0);
  for (let i = 0; i < 300; i++) {
    ctx.replayViewerTick(0);
  }
  expect(ctx.viewer.frame).toBe(300);
  expect(ctx.car[3].x).toBe(ctx.raceTape.cars[3].x[300]);
  ctx.seekReplay(50);
  expect(ctx.car[2].z).toBe(ctx.raceTape.cars[2].z[50]);
  // played to its end it stops there
  ctx.changeSpeed(2);
  for (let i = 0; i < 400; i++) {
    ctx.replayViewerTick(0);
  }
  expect(ctx.viewer.frame).toBe(ctx.raceTape.length - 1);
  expect(ctx.viewer.playing).toBe(false);
  ctx.closeReplay();
});

// all the numbers of a race tape, as 8 bytes each
const rawSize = (tape) =>
  8 *
  (tape.cars.reduce(
    (sum, car) =>
      sum +
      16 * tape.length +
      5 * car.hitCount +
      car.fixCount +
      11 * car.dustCount,
    0,
  ) +
    9 * tape.sparks.count +
    2 * tape.length);

// the speeds only send the fire of a burning wreck off: a file keeps them from then on
const SPEEDS = ["speedX", "speedY", "speedZ"];
// (and which hit wasted it, which only picks the highlight while racing)
const withoutSpeedsBeforeWasted = (car, length) => {
  const { playerHitTicks, ...kept } = car;
  const from = Math.min(car.wastedAt, length);
  for (const field of SPEEDS) {
    kept[field] = car[field].map((v, i) => (i < from ? 0 : v));
  }
  return kept;
};

test("a replay file gives the race tape back to its last bit, and is small", async () => {
  const { ctx } = await race(1500);
  const tape = structuredClone(ctx.raceTape);
  const raced = { stage: 5, name: "x", carTypes: [15, 1, 2], player: 0 };
  const file = await ctx.encodeReplay(raced);
  expect(file.length).toBeLessThan(rawSize(tape) / 2);
  const decoded = await ctx.decodeReplay(new Blob([file]));
  expect(decoded.race).toEqual(raced);
  // every number to its last bit (toEqual also tells 0 from -0)
  tape.cars.forEach((car, c) =>
    expect(decoded.tape.cars[c]).toMatchObject(
      withoutSpeedsBeforeWasted(car, tape.length),
    ),
  );
  expect(decoded.tape.sparks).toEqual(tape.sparks);
  expect(decoded.tape.length).toBe(tape.length);
  expect(decoded.tape.checkpoint).toEqual(tape.checkpoint);
  expect(decoded.tape.lastCheck).toEqual(tape.lastCheck);
  await expect(ctx.decodeReplay(new Blob(["no replay"]))).rejects.toThrow(
    "not a replay",
  );
});

test("the replay's effects fly as fast as it plays, and stand while it stands", async () => {
  const { ctx, step } = await race(900);
  ctx.game.phase = PHASE.paused;
  ctx.openReplay(ctx.VIEWER_FROM.pauseMenu, 300);
  for (let i = 0; i < 40; i++) {
    step();
  }
  // what the effects are like: where the dust and fire are, how far on
  const effectsNow = () =>
    JSON.stringify({
      dust: ctx.effects.dustClouds
        .slice(0, ctx.effects.dustCount)
        .map(({ x, z, stg, mag }) => [x, z, stg, mag]),
      fire: ctx.effects.explosions
        .slice(0, ctx.effects.explosionCount)
        .map(({ x, y, z, ani }) => [x, y, z, ani]),
    });
  ctx.togglePlaying();
  step();
  const standing = effectsNow();
  for (let i = 0; i < 30; i++) {
    step();
  }
  expect(effectsNow()).toBe(standing);

  // in slow motion a tick moves them part of a tick, fast forward several
  const paces = [];
  for (const speed of [1, 3]) {
    ctx.viewer.speed = speed;
    ctx.viewer.playing = true;
    step();
    const moves = [];
    ctx.atReplayPace(() => moves.push([ctx.effects.step, ctx.tick.scale]));
    paces.push(moves);
  }
  expect(paces).toEqual([
    [[0.5, 0.35]],
    [
      [1, 0.7],
      [1, 0.7],
    ],
  ]);
  // and the race's own time step is back after
  expect([ctx.effects.step, ctx.tick.scale]).toEqual([1, 0.7]);
  ctx.closeReplay();
});

test("the camera flies to the next car followed instead of jumping there", async () => {
  const { ctx, step } = await race(600);
  ctx.game.phase = PHASE.paused;
  ctx.openReplay(ctx.VIEWER_FROM.pauseMenu, 200);
  ctx.camera.mode = ctx.CAMERA.behind;
  ctx.togglePlaying();
  for (let i = 0; i < 5; i++) {
    step();
  }
  const near = (c) =>
    Math.hypot(ctx.camera.x - ctx.car[c].x, ctx.camera.z - ctx.car[c].z);
  const before = near(0);
  ctx.nextCar();
  step();
  // on its way: still far from the car it goes to
  expect(near(1)).toBeGreaterThan(before * 2);
  for (let i = 0; i < 20; i++) {
    step();
  }
  // there: behind it, as far as behind the first
  expect(Math.abs(near(1) - before)).toBeLessThan(1);
  ctx.closeReplay();
});
