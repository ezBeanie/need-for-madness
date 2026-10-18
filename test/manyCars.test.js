import { afterEach, describe, expect, test, vi } from "vitest";
import { autopilot, openStageSelect, startRace } from "./harness/race.js";
import { PHASE } from "../src/core/state.js";

const range = (n) => Array.from({ length: n }, (_, i) => i);

describe("races with 20 cars", () => {
  test.each([1, 5, 11, 16, 17])("stage %i starts and runs", async (stage) => {
    const { ctx, step } = await startRace({ stage, car: 5, cars: 20 });
    expect(ctx.game.carCount).toBe(20);
    const types = ctx.game.carTypes.slice(0, 20);
    expect(types.every((t) => t >= 0 && t < 19)).toBe(true);

    // nobody starts on top of another car
    for (const a of range(20)) {
      for (const b of range(a)) {
        const gap = Math.hypot(
          ctx.car[a].x - ctx.car[b].x,
          ctx.car[a].z - ctx.car[b].z,
        );
        expect(gap).toBeGreaterThan(30);
      }
    }

    const driven = range(20).map(() => 0);
    for (
      let frame = 0;
      frame < 1500 && ctx.game.phase === PHASE.race;
      frame++
    ) {
      const before = range(20).map((c) => [ctx.car[c].x, ctx.car[c].z]);
      Object.assign(ctx.racers[0].u, autopilot(ctx));
      step();
      for (const c of range(20)) {
        driven[c] += Math.hypot(
          ctx.car[c].x - before[c][0],
          ctx.car[c].z - before[c][1],
        );
      }
    }
    expect(ctx.game.phase).toBe(PHASE.race);
    // positions can tie, in the original too (see updateStandings)
    for (const c of range(20)) {
      expect(ctx.track.pos[c]).toBeGreaterThanOrEqual(0);
      expect(ctx.track.pos[c]).toBeLessThan(20);
    }
    // the computer drivers race too, not only the first seven
    for (const c of range(20)) {
      expect(driven[c]).toBeGreaterThan(300);
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("C in the stage select cycles the field size and remembers it", async () => {
  const stored = new Map();
  vi.stubGlobal("Storage", class {});
  vi.stubGlobal("localStorage", {
    getItem: (name) => stored.get(name) ?? null,
    setItem: (name, value) => stored.set(name, String(value)),
  });
  const { ctx, key, step } = await openStageSelect({ stage: 3, car: 5 });
  const sizes = [];
  for (let i = 0; i < 4; i++) {
    key(67, true);
    key(67, false);
    step();
    sizes.push(ctx.game.raceCars);
  }
  expect(sizes).toEqual([10, 15, 20, 7]);
  expect(stored.get("racecars")).toBe("7");
});

test("a field size chosen in the stage select applies to the race started from it", async () => {
  const { ctx, key, step, stepUntil } = await openStageSelect({
    stage: 3,
    car: 5,
  });
  key(67, true);
  key(67, false);
  step();
  key(13, true);
  step();
  key(13, false);
  stepUntil(() => ctx.game.phase === PHASE.race, 10, "race");
  expect(ctx.game.carCount).toBe(10);
  expect(ctx.car[9].z).toBeGreaterThan(ctx.car[6].z);
});

// The original looked up a roof hit's limit by car index, which only stayed harmless for
// the indices of car types (0 to 18).
test("the 20th car can be hit on its roof", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5, cars: 20 });
  for (let point = 0; point < 4; point++) {
    expect(() => ctx.regn(3, point, 30, 19)).not.toThrow();
  }
});
