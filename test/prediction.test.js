import { expect, test } from "vitest";
import { startRace, steerAlongPath } from "./harness/race.js";

const GUEST_CAR = 1;
const POSE = ["x", "y", "z", "xy", "xz", "zy", "wxz", "wzy"];

const poseOf = (ctx, c) =>
  Object.fromEntries(POSE.map((f) => [f, ctx.car[c][f]]));

// The guest's car on the host: driven by a person (the test), the others by the AI.
const hostRace = async () => {
  const game = await startRace({ stage: 1, car: 5 });
  game.ctx.game.humans = [0, GUEST_CAR];
  return game;
};

test("the guest drives its car on from the host's state as the host drives it", async () => {
  const { ctx, step } = await hostRace();
  const drive = () => {
    Object.assign(ctx.racers[GUEST_CAR].u, steerAlongPath(ctx, GUEST_CAR));
    step();
  };
  // (past the countdown, in which no car drives)
  for (let t = 0; t < 300; t++) {
    drive();
  }
  // the state as it reaches the guest
  const sent = JSON.parse(JSON.stringify(ctx.copyCarState(GUEST_CAR)));
  const inputs = [];
  for (let t = 0; t < 6; t++) {
    inputs.push({ ...steerAlongPath(ctx, GUEST_CAR) });
    drive();
  }
  const onHost = poseOf(ctx, GUEST_CAR);

  // the guest, whose player the car is, drives on from the sent state with the same keys
  ctx.game.player = GUEST_CAR;
  ctx.restoreCarState(GUEST_CAR, sent);
  for (const keys of inputs) {
    Object.assign(ctx.racers[GUEST_CAR].u, keys);
    ctx.predictCar(GUEST_CAR);
  }
  const predicted = poseOf(ctx, GUEST_CAR);
  for (const f of POSE) {
    expect(predicted[f]).toBeCloseTo(onHost[f], 6);
  }
  // (and it moved: the test drives, not stands)
  expect(
    Math.hypot(onHost.x - sent.car.x, onHost.z - sent.car.z),
  ).toBeGreaterThan(20);
});

// A car driven hard in circles: it skids and kicks up dust.
const driveInCircles = (ctx, drive) => {
  for (let t = 0; t < 200; t++) {
    Object.assign(ctx.racers[GUEST_CAR].u, {
      up: true,
      right: true,
      handb: t % 40 < 10,
    });
    drive();
  }
};

const effectsSeen = (ctx) => ({
  checkpoint: ctx.raceEvents.oncheckpoint,
  dested: ctx.track.dested.slice(),
  dust: ctx.effects.dustClouds.filter((d) => d.stg).length,
  sparks: ctx.effects.sparks.filter((s) => s.stat).length,
});

test("predicting makes no effect or race event, which driving the same does", async () => {
  // (the same driving in the race makes dust: what the check below would see)
  const raced = await hostRace();
  for (let t = 0; t < 300; t++) {
    raced.step();
  }
  const before = effectsSeen(raced.ctx);
  driveInCircles(raced.ctx, () => raced.ctx.predictCar(GUEST_CAR));
  expect(effectsSeen(raced.ctx)).toEqual(before);
  expect(raced.ctx.physics.predicting).toBe(false);

  const control = await hostRace();
  for (let t = 0; t < 300; t++) {
    control.step();
  }
  control.ctx.game.player = GUEST_CAR;
  driveInCircles(control.ctx, () => control.ctx.drive());
  expect(effectsSeen(control.ctx).dust).toBeGreaterThan(0);
});
