import { describe, expect, test } from "vitest";
import { autopilot, startRace } from "./harness/race.js";
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
    // positions can tie, in the original too (see checkstat)
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
