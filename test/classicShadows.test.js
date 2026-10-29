import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { startRace } from "./harness/race.js";

// the classic look's modules, as the game loads them
const { ctx } = await startRace({ stage: 1, car: 5 });
const { heightOn, parseRad, placeSurfaces, surfaceUnder, surfacesNear } = ctx;

const speedRamp = parseRad(
  readFileSync("public/data/classic/speedramp.rad", "utf8"),
);

// the height a car's shadow lies at, at (x, z), or null on the plain ground
const shadowAt = (x, z) => {
  surfacesNear(x, z, 0);
  const surface = surfaceUnder(x, z);
  return surface && heightOn(surface, x, z);
};

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
  expect(shadowAt(ramp.x, ramp.z + 50)).toBeCloseTo(66.4, 0);
  // beside it, and past its top (the wall there takes no shadow)
  expect(shadowAt(ramp.x + 40, ramp.z)).toBeNull();
  expect(shadowAt(ramp.x, ramp.z + 105)).toBeNull();
});

test("a turned ramp turns its slope with it", () => {
  const ramp = placeRamp(90);
  expect(shadowAt(ramp.x + 50, ramp.z)).toBeCloseTo(66.4, 0);
  expect(shadowAt(ramp.x - 100, ramp.z)).toBeCloseTo(2.2, 0);
  expect(shadowAt(ramp.x, ramp.z + 50)).toBeNull();
});
