import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { startRace } from "./harness/race.js";

test("a classic wreck flashes on while the highlight holds still, and burns once it plays on", async () => {
  const { ctx, step, key } = await startRace({ stage: 1, car: 5 });
  key(76, true);
  key(76, false);
  step();
  const rad = ctx.parseRad(
    readFileSync("public/data/classic/radicalone.rad", "utf8"),
  );
  ctx.tintModel(rad, () => 0.5);
  for (const poly of rad.polys) {
    poly.embos = 1;
  }
  const steps = () => rad.polys.map((poly) => poly.embos);
  // drawn in the tick shown, in front of the camera
  const drawWreck = (tick) => {
    ctx.medium.tick = tick;
    ctx.placeModel(ctx.car[0]);
    ctx.drawObject(rad, Float32Array.from(ctx.drawMatrix), {
      ground: 0,
      angles: ctx.car[0],
    });
  };
  ctx.medium.frozen = true;
  for (let tick = 1; tick <= 30; tick++) {
    drawWreck(tick);
  }
  expect(new Set(steps())).toEqual(new Set([1]));
  ctx.medium.frozen = false;
  for (let tick = 31; tick <= 50; tick++) {
    drawWreck(tick);
  }
  // past the flashing, burning
  expect(Math.min(...steps())).toBeGreaterThanOrEqual(16);
});

test("a classic wreck is not stretched along one axis as the modern one is", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  const racer = ctx.racers[0];
  racer.embodir = 2;
  racer.embomag = 1.3;
  const turned = Float32Array.from([
    0.6, 0, -0.8, 0, 0, 1, 0, 0, 0.8, 0, 0.6, 0, 5, 6, 7, 1,
  ]);
  const stretched = Float32Array.from(turned);
  for (let i = 0; i < 3; i++) {
    stretched[8 + i] *= 1.3;
  }
  const drawn = ctx.unstretched(0, stretched);
  turned.forEach((v, i) => expect(drawn[i]).toBeCloseTo(v, 5));
});
