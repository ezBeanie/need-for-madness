import { describe, test } from "vitest";
import { expectMatchesGolden } from "../harness/golden.js";
import { NO_INPUT, autopilot, recordRace } from "../harness/race.js";

const STAGE_COUNT = 17;
const FRAMES = 3000;

const autopilotRaces = Array.from({ length: STAGE_COUNT }, (_, i) => {
  const stage = i + 1;
  return {
    name: `autopilot-stage-${String(stage).padStart(2, "0")}`,
    stage,
    car: (stage * 3) % 19,
    input: autopilot,
  };
});

const scriptedRaces = [
  {
    name: "full-throttle-stage-01",
    stage: 1,
    car: 5,
    input: () => ({ ...NO_INPUT, up: true }),
  },
  {
    name: "reverse-then-spin-stage-02",
    stage: 2,
    car: 0,
    input: (ctx, frame) =>
      frame < 400
        ? { ...NO_INPUT, down: true }
        : { ...NO_INPUT, up: true, left: frame % 200 < 120 },
  },
  {
    name: "handbrake-stunts-stage-03",
    stage: 3,
    car: 9,
    input: (ctx, frame) => ({
      ...autopilot(ctx),
      handb: frame % 90 > 70,
      down: frame % 300 > 280,
    }),
  },
];

const scenarios = [...autopilotRaces, ...scriptedRaces];

const checkAgainstGolden = async ({ name, stage, car, input }) => {
  const race = await recordRace({
    stage,
    car,
    seed: stage,
    frames: FRAMES,
    input,
  });
  expectMatchesGolden(name, { stage, car }, race);
};

// Vitest runs test files in parallel but tests within a file sequentially,
// so the scenarios are spread over several small test files.
export const defineRaceTests = (shard, shardCount) => {
  const mine = scenarios.filter((_, i) => i % shardCount === shard - 1);
  describe(`race simulation matches the golden master (${shard}/${shardCount})`, () => {
    test.each(mine)("$name", checkAgainstGolden);
  });
};
