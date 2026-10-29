import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { startRace } from "./harness/race.js";

// the classic look's modules, as the game loads them
const { ctx } = await startRace({ stage: 1, car: 5 });
const { makePile, parseRad, pileRad, placeSurfaces, shadowHeight } = ctx;

const speedRamp = parseRad(
  readFileSync("public/data/classic/speedramp.rad", "utf8"),
);

// the height a car's shadow lies at, at (x, z), its wheels at height `wheels`
const shadowAt = (x, z, wheels = Infinity) => {
  ctx.surfacesNear(x, z, 0, wheels);
  return shadowHeight(x, z);
};

const UNTURNED = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const placeRamp = (degrees) => {
  // turned about the up axis, as the stage loader turns it
  const [cos, sin] = [Math.cos, Math.sin].map((f) =>
    f(degrees * (Math.PI / 180)),
  );
  const mat = [cos, 0, -sin, 0, 0, 1, 0, 0, sin, 0, cos, 0, 0, 0, 0, 1];
  const piece = { x: -35, y: 0, z: 600, mat };
  placeSurfaces([piece], () => speedRamp);
  return piece;
};

test("a car's classic shadow climbs a ramp as the original's did", () => {
  const ramp = placeRamp(0);
  // the speed ramp: 107 long rising to 32.7, then 93 long rising to 95.3 (its points)
  expect(shadowAt(ramp.x, ramp.z - 100)).toBeCloseTo(2.2, 0);
  expect(shadowAt(ramp.x, ramp.z)).toBeCloseTo(32.7, 0);
  // where its two slopes' boxes overlap, on the one that is there (31.2 by its points;
  // the original took the steeper one's, 29.3)
  expect(shadowAt(ramp.x, ramp.z - 5)).toBeCloseTo(31.2, 0);
  expect(shadowAt(ramp.x, ramp.z + 50)).toBeCloseTo(66.4, 0);
  // beside it, and past its top (the wall there takes no shadow)
  expect(shadowAt(ramp.x + 40, ramp.z)).toBe(0);
  expect(shadowAt(ramp.x, ramp.z + 105)).toBe(0);
  // a car under it: the ground
  expect(shadowAt(ramp.x, ramp.z + 50, 10)).toBe(0);
});

test("a turned ramp turns its slope with it", () => {
  const ramp = placeRamp(90);
  expect(shadowAt(ramp.x + 50, ramp.z)).toBeCloseTo(66.4, 0);
  expect(shadowAt(ramp.x - 100, ramp.z)).toBeCloseTo(2.2, 0);
  expect(shadowAt(ramp.x, ramp.z + 50)).toBe(0);
});

test("a car's classic shadow lies on a rock pile's top and down its sides", () => {
  const pile = makePile(1234, 4, 4);
  placeSurfaces([{ x: 0, y: 0, z: 0, mat: UNTURNED }], () =>
    pileRad(pile, [120, 110, 90], [200, 190, 150]),
  );
  // (the original's units: y down, x the other way round)
  const top = pile.faces[4].points;
  const topHeight =
    -Math.trunc(top.reduce((sum, [, y]) => sum + y, 0) / 8) / 10;
  expect(topHeight).toBeGreaterThan(2);
  expect(shadowAt(0, 0)).toBeCloseTo(topHeight, 5);
  // down the side towards the original's x, from its top edge to its foot
  const side = pile.faces[1].points;
  const [footX] = side[1];
  const [topX] = side[4];
  const along = (share) => -(topX + (footX - topX) * share) / 10;
  const heights = [0.2, 0.5, 0.8].map((share) => shadowAt(along(share), 0));
  expect(heights[0]).toBeLessThan(topHeight);
  expect(heights[1]).toBeLessThan(heights[0]);
  expect(heights[2]).toBeLessThan(heights[1]);
  expect(shadowAt(along(1.5), 0)).toBe(0);
});
