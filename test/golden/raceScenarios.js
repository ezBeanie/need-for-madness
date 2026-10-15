import { describe, expect, test } from "vitest";
import { goldenOrWrite } from "../harness/golden.js";
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

const checkAgainstGolden = ({ name, stage, car, input }) => {
  const race = recordRace({ stage, car, seed: stage, frames: FRAMES, input });
  const golden = goldenOrWrite(name, {
    stage,
    car,
    frames: race.frames,
    hashes: race.hashes.join(" "),
    samples: race.samples,
  });
  if (golden === null) {
    return;
  }

  const goldenHashes = golden.hashes.split(" ");
  const firstDiff = race.hashes.findIndex(
    (hash, frame) => hash !== goldenHashes[frame],
  );
  if (firstDiff !== -1) {
    const sampleFrame = Math.floor(firstDiff / 100) * 100;
    expect.fail(
      `race state diverges at frame ${firstDiff}.\n` +
        `now:    ${JSON.stringify(race.states[firstDiff])}\n` +
        `golden sample at frame ${sampleFrame} (now there: ${JSON.stringify(race.states[sampleFrame])}):\n` +
        `        ${JSON.stringify(golden.samples[sampleFrame])}`,
    );
  }
  expect(race.frames).toBe(golden.frames);
};

// Vitest runs test files in parallel but tests within a file sequentially,
// so the scenarios are spread over several small test files.
export const defineRaceTests = (shard, shardCount) => {
  const mine = scenarios.filter((_, i) => i % shardCount === shard - 1);
  describe(`race simulation matches the golden master (${shard}/${shardCount})`, () => {
    test.each(mine)("$name", checkAgainstGolden);
  });
};
