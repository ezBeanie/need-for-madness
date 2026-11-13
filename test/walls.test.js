import { expect, test } from "vitest";
import { startRace } from "./harness/race.js";

// Car 1 a tick before it flies into the stage's back limit at speed, its damage after.
const intoTheLimit = async (humans, speed) => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  ctx.raceEvents.countdown = 0;
  ctx.game.humans = humans;
  ctx.car[1].z = ctx.track.limb + 30;
  ctx.car[1].x = (ctx.track.liml + ctx.track.limr) / 2;
  for (let k = 0; k < 4; k++) {
    ctx.racers[1].wheelSpeedZ[k] = -speed;
  }
  ctx.racers[1].damage = 0;
  ctx.drive();
  const damage = ctx.racers[1].damage;
  ctx.game.humans = [];
  return { damage, z: ctx.car[1].z, ctx };
};

test("in a room's race a car flying hard into a wall takes more damage than in the original", async () => {
  const alone = await intoTheLimit([], 18);
  const room = await intoTheLimit([0, 1], 18);
  expect(alone.damage).toBeGreaterThan(0);
  expect(room.damage).toBeGreaterThan(alone.damage * 1.5);
});

test("in a room's race no car flies through the stage's limits, however fast", async () => {
  // (alone, as in the original, one fast enough is through)
  expect((await intoTheLimit([], 60)).z).toBeLessThan(
    (await intoTheLimit([], 0)).ctx.track.limb,
  );
  for (const speed of [30, 60, 120]) {
    const { z, ctx } = await intoTheLimit([0, 1], speed);
    expect(z).toBeGreaterThan(ctx.track.limb);
  }
});
