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

  // (none for stages made in the editor, whose numbers change)
  const own = ctx.FIRST_OWN_STAGE;
  ctx.track.stage = own;
  timeRace(ctx, [50, 100, 160, 220]);
  expect(ctx.bestTimes(own)).toBe(null);
  expect(JSON.parse(stored.get("bestTimes"))[own]).toBeUndefined();
  ctx.track.stage = 2;

  // 35 ms a tick, to the thousandth
  expect(ctx.formatTime(220)).toBe("0:07.700");
  expect(ctx.formatTime(2000)).toBe("1:10.000");
  expect(ctx.formatTime(2.5)).toBe("0:00.088");
});

test("a lap ends where within its tick the car crossed the line, not at the tick's end", async () => {
  const { ctx } = await startRace({ stage: 2, car: 5 });
  ctx.chooseRaceKind(ctx.RACE_KIND.timeAttack);
  ctx.track.nlaps = 1;
  ctx.track.nsp = 1;
  // the finish line across z at 25, the car on at 10 a tick from z 0
  const finish = 0;
  ctx.track.typ[finish] = 1;
  ctx.track.z[finish] = 25;
  ctx.racers[0].clearedPathPoint = finish;
  ctx.car[0].z = 0;
  ctx.startTimeAttack();
  ctx.track.clear[0] = 0;
  ctx.track.haltall = false;
  for (let tick = 1; !ctx.timeAttack.finished; tick++) {
    ctx.car[0].z = 10 * tick;
    // counted in the third tick, from 20 to 30
    ctx.track.clear[0] = tick >= 3 ? 1 : 0;
    ctx.timeAttackTick();
  }
  expect(ctx.timeAttack.ticks).toBe(3);
  expect(ctx.timeAttack.laps).toEqual([2.5]);
  expect(ctx.raceTime()).toBe(2.5);
});

test("a race of another kind is not timed", async () => {
  const { ctx } = await startRace({ stage: 2, car: 5 });
  ctx.startTimeAttack();
  ctx.timeAttackTick();
  expect(ctx.timeAttack.ticks).toBe(0);
});

// A race of time attack in which the player's car moves on by speed each tick, finishing
// after ticks; where the ghost was each tick.
const ghostRace = (ctx, speed, ticks) => {
  ctx.startTimeAttack();
  ctx.track.clear[0] = 0;
  ctx.track.haltall = false;
  const seen = [];
  for (let tick = 1; !ctx.timeAttack.finished; tick++) {
    ctx.car[0].x = 100 + speed * tick;
    ctx.car[0].z = -0.37 * tick;
    ctx.car[0].xz = (7 * tick) % 360;
    ctx.track.clear[0] = tick >= ticks ? 1 : 0;
    ctx.timeAttackTick();
    const ghost = ctx.car[ctx.GHOST];
    seen.push(
      ctx.ghostShown() ? { x: ghost.x, z: ghost.z, xz: ghost.xz } : null,
    );
  }
  return seen;
};

test("time attack's ghost drives the stage's fastest race again, beside the player and not in the race", async () => {
  const stored = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (name) => stored.get(name) ?? null,
    setItem: (name, value) => stored.set(name, String(value)),
  });
  const { ctx } = await startRace({ stage: 2, car: 5 });
  ctx.chooseRaceKind(ctx.RACE_KIND.timeAttack);
  ctx.game.phase = ctx.PHASE.race;
  // (alone, as the stage select starts time attack)
  ctx.game.carCount = 1;
  ctx.track.nlaps = 1;
  ctx.track.nsp = 1;

  // the first race: no ghost yet, then it is the ghost
  expect(ghostRace(ctx, 2.5, 30).every((seen) => seen === null)).toBe(true);
  expect(ctx.storedGhost(2).ticks).toBe(30);
  // the next race: the ghost where the first race's car was each tick (to a tenth)
  const seen = ghostRace(ctx, 1, 40);
  const near = (a, b) => expect(Math.abs(a - b)).toBeLessThan(0.051);
  for (let tick = 1; tick <= 30; tick++) {
    near(seen[tick - 1].x, 100 + 2.5 * tick);
    near(seen[tick - 1].z, -0.37 * tick);
    near(seen[tick - 1].xz, (7 * tick) % 360);
  }
  // its race over, it waits at the finish
  expect(seen[39]).toEqual(seen[29]);
  // slower: the ghost stays; faster: it is the new one
  expect(ctx.storedGhost(2).ticks).toBe(30);
  ghostRace(ctx, 4, 20);
  expect(ctx.storedGhost(2).ticks).toBe(20);
  // switched off it is not seen, yet a faster race still becomes the ghost
  ctx.toggleGhost();
  expect(ghostRace(ctx, 5, 15).every((seen) => seen === null)).toBe(true);
  expect(ctx.storedGhost(2).ticks).toBe(15);
  ctx.toggleGhost();
  expect(ghostRace(ctx, 5, 16).some((seen) => seen !== null)).toBe(true);
  // never one of the race's cars
  expect(ctx.GHOST).toBeGreaterThanOrEqual(ctx.game.carCount);

  // (none for stages made in the editor, nor in races of another kind)
  ctx.track.stage = ctx.FIRST_OWN_STAGE;
  ghostRace(ctx, 4, 10);
  expect(ctx.storedGhost(ctx.FIRST_OWN_STAGE)).toBe(null);
  ctx.track.stage = 2;
  ctx.chooseRaceKind(ctx.RACE_KIND.practice);
  ctx.startTimeAttack();
  expect(ctx.ghostShown()).toBe(false);
});
