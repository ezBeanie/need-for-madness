import { expect, test } from "vitest";
import { startRace } from "./harness/race.js";

// Car 1 a tick before it flies into the stage's back limit at speed, its damage after: in
// a room's race (humans), or alone as the original's or with this game's fixes.
const intoTheLimit = async (humans, speed, asOriginal = true) => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  ctx.raceEvents.countdown = 0;
  ctx.game.humans = humans;
  ctx.physics.asOriginal = asOriginal;
  ctx.car[1].z = ctx.track.limb + 30;
  ctx.car[1].x = (ctx.track.liml + ctx.track.limr) / 2;
  for (let k = 0; k < 4; k++) {
    ctx.racers[1].wheelSpeedZ[k] = -speed;
  }
  ctx.racers[1].damage = 0;
  ctx.drive();
  const damage = ctx.racers[1].damage;
  ctx.game.humans = [];
  ctx.physics.asOriginal = true;
  return { damage, z: ctx.car[1].z, ctx };
};

test("a car flying hard into a wall takes more damage than in the original, in a room's race and alone", async () => {
  const original = await intoTheLimit([], 18);
  const room = await intoTheLimit([0, 1], 18);
  const alone = await intoTheLimit([], 18, false);
  expect(original.damage).toBeGreaterThan(0);
  // (about three times the original's at this speed: more, but not too much)
  expect(room.damage).toBeGreaterThan(original.damage * 2);
  expect(room.damage).toBeLessThan(original.damage * 4);
  expect(alone.damage).toBe(room.damage);
});

test("no car flies through the stage's limits, however fast, in a room's race and alone", async () => {
  // (alone, as in the original, one fast enough is through)
  expect((await intoTheLimit([], 60)).z).toBeLessThan(
    (await intoTheLimit([], 0)).ctx.track.limb,
  );
  for (const speed of [30, 60, 120]) {
    for (const { z, ctx } of [
      await intoTheLimit([0, 1], speed),
      await intoTheLimit([], speed, false),
    ]) {
      expect(z).toBeGreaterThan(ctx.track.limb);
    }
  }
});
