import { afterEach, expect, test, vi } from "vitest";
import { startRace } from "./harness/race.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

// A race of time attack, its checkpoints passed at the given ticks.
const timeRace = (ctx, checkpointTicks) => {
  ctx.startTimeAttack();
  ctx.track.clear[0] = 0;
  ctx.track.haltall = false;
  for (let tick = 1; !ctx.timeAttack.finished && tick < 1000; tick++) {
    ctx.track.clear[0] = checkpointTicks.filter((t) => t <= tick).length;
    ctx.timeAttackTick();
  }
  return { ...ctx.timeAttack };
};

test("time attack times each lap and the race, and keeps the best of each stage", async () => {
  const stored = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (name) => stored.get(name) ?? null,
    setItem: (name, value) => stored.set(name, String(value)),
  });
  const { ctx } = await startRace({ stage: 2, car: 5 });
  ctx.chooseRaceKind(ctx.RACE_KIND.timeAttack);
  ctx.track.nlaps = 2;
  ctx.track.nsp = 2;

  const first = timeRace(ctx, [50, 100, 160, 220]);
  expect(first.laps).toEqual([100, 120]);
  expect(first.ticks).toBe(220);
  expect(first.newBest).toEqual({ lap: true, race: true });
  expect(ctx.bestTimes(2)).toEqual({ lap: 100, race: 220 });

  // slower, with a faster lap: only the lap is kept
  const second = timeRace(ctx, [40, 90, 200, 300]);
  expect(second.laps).toEqual([90, 210]);
  expect(second.newBest).toEqual({ lap: true, race: false });
  expect(ctx.bestTimes(2)).toEqual({ lap: 90, race: 220 });
  expect(ctx.bestTimes(3)).toBe(null);

  // 35 ms a tick
  expect(ctx.formatTime(220)).toBe("0:07.70");
  expect(ctx.formatTime(2000)).toBe("1:10.00");
});

test("a race of another kind is not timed", async () => {
  const { ctx } = await startRace({ stage: 2, car: 5 });
  ctx.startTimeAttack();
  ctx.timeAttackTick();
  expect(ctx.timeAttack.ticks).toBe(0);
});
