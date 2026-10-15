import { describe, expect, test } from "vitest";
import { NO_INPUT, autopilot, recordRace } from "../harness/race.js";

// Effects (sparks, dust, scratches, camera, sounds) draw from fxrandom(). If one of those
// call sites actually fed the simulation, a different fx seed would change the race.
const races = [
  {
    name: "crashes on stage 1",
    stage: 1,
    car: 5,
    input: () => ({ ...NO_INPUT, up: true }),
  },
  { name: "wrecks on stage 5", stage: 5, car: 15, input: autopilot },
  {
    name: "stunts on stage 3",
    stage: 3,
    car: 9,
    input: (ctx, frame) => ({ ...autopilot(ctx), handb: frame % 90 > 70 }),
  },
];

describe("simulation does not depend on effect randomness", () => {
  test.each(races)("$name", ({ stage, car, input }) => {
    const run = (fxSeed) =>
      recordRace({ stage, car, seed: stage, fxSeed, frames: 2000, input })
        .hashes;
    const first = run(1);
    const second = run(2);
    const firstDiff = first.findIndex((hash, frame) => hash !== second[frame]);
    expect(firstDiff, "first frame where the race differs").toBe(-1);
    expect(second.length).toBe(first.length);
  });
});
