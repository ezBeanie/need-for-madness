import { afterEach, expect, test, vi } from "vitest";
import { openStageSelect, racingAutopilot, startRace } from "./harness/race.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const storage = () => {
  const stored = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (name) => stored.get(name) ?? null,
    setItem: (name, value) => stored.set(name, String(value)),
  });
  return stored;
};

// Time attack alone on stage 2, its laps of two checkpoints.
const timeAttackAlone = async () => {
  const { ctx, step } = await startRace({ stage: 2, car: 5 });
  ctx.chooseRaceKind(ctx.RACE_KIND.timeAttack);
  ctx.game.carCount = 1;
  ctx.track.nsp = 2;
  ctx.track.haltall = false;
  return { ctx, step };
};

// A session's laps, the cars standing (each checkpoint so counted at the end of its tick):
// a warm-up lap over at tick WARM, then car c clears a checkpoint at each of clears[c]
// (ticks after the warm-up lap), wasted at those of wrecks[c] (as the tick begins); until
// the tick `until` after the warm-up lap, or until it is over.
const WARM = 10;
const lapSession = (ctx, clears, { wrecks = [], until = 3000, tick } = {}) => {
  ctx.startTimeAttack();
  ctx.deathmatch.ticks = 0;
  const { nsp } = ctx.track;
  const warmUp = Array.from({ length: nsp }, (_, k) => WARM - nsp + 1 + k);
  for (let c = 0; c < ctx.game.carCount; c++) {
    ctx.racers[c].clear = 0;
    ctx.racers[c].wasted = false;
  }
  for (let t = 1; t <= until + WARM && !ctx.track.haltall; t++) {
    for (let c = 0; c < ctx.game.carCount; c++) {
      const cleared = [...warmUp, ...(clears[c] ?? []).map((at) => at + WARM)];
      ctx.racers[c].clear = cleared.filter((at) => at <= t).length;
      ctx.racers[c].wasted = (wrecks[c] ?? []).includes(t - WARM);
    }
    ctx.lapTick(ctx.game.carCount);
    ctx.deathmatch.ticks++;
    tick?.(t - WARM);
    ctx.timeAttackTick();
    ctx.updateStandings();
  }
  return ctx.laps;
};

test("time attack times each lap from line to line, each checkpoint a split, and its fastest lap counts", async () => {
  storage();
  const { ctx } = await timeAttackAlone();
  const laps = lapSession(ctx, [[50, 100, 160, 220, 270, 330]], {
    until: 340,
  });
  // laps of 100, 120 and 110 ticks: the first the best, its splits kept
  expect(laps.done[0]).toBe(3);
  expect(laps.best[0]).toBe(100);
  expect(laps.bestSplits[0]).toEqual([50, 100]);
  // the last checkpoint told against the best lap: 110 at the line, 10 slower
  expect(laps.marks[0]).toMatchObject({ k: 1, time: 110, own: 10, field: 10 });
  expect(laps.marks[0].valid).toBe(true);
  // the lap on, from the line
  expect(ctx.currentLapTicks()).toBe(10);
  // the last lap
  expect(laps.last[0]).toBe(110);
  expect(laps.lastValid[0]).toBe(true);
  // 35 ms a tick, to the thousandth
  expect(ctx.formatTime(220)).toBe("0:07.700");
  expect(ctx.formatTime(2.5)).toBe("0:00.088");
  expect(ctx.formatDelta(10)).toBe("+0.350");
  expect(ctx.formatDelta(-1)).toBe("-0.035");
});

test("a lap is timed where within its tick the car crossed the line, not at the tick's end", async () => {
  storage();
  const { ctx } = await timeAttackAlone();
  ctx.track.nsp = 1;
  // the line across z at 25, the car on at 10 a tick from z 0: counted in the third tick
  const line = 0;
  ctx.track.typ[line] = 1;
  ctx.track.z[line] = 25;
  ctx.racers[0].clearedPathPoint = line;
  ctx.car[0].x = 0;
  ctx.car[0].z = 0;
  ctx.startTimeAttack();
  ctx.deathmatch.ticks = 0;
  ctx.racers[0].clear = 0;
  // the warm-up lap over at the end of the first tick, standing; then on at 10 a tick
  for (let t = 1; t <= 4; t++) {
    ctx.car[0].z = t == 1 ? 0 : 10 * (t - 1);
    ctx.racers[0].clear = t >= 4 ? 2 : 1;
    ctx.lapTick(1);
    ctx.deathmatch.ticks++;
  }
  // from z 20 to 30 in the fourth tick, the line halfway: 3.5, from 1
  expect(ctx.laps.best[0]).toBe(2.5);
});

test("a wasted car's lap counts for nothing, and the next one does again", async () => {
  storage();
  const { ctx } = await timeAttackAlone();
  const laps = lapSession(ctx, [[50, 90, 150, 200]], {
    wrecks: [[60]],
    until: 210,
  });
  // the first lap of 90 had a wreck: only the second of 110 counts
  expect(laps.done[0]).toBe(2);
  expect(laps.best[0]).toBe(110);
  expect(laps.marks[0]).toMatchObject({ time: 110, valid: true });
});

test("the first lap is a warm-up lap: untimed, telling nothing, recording no ghost", async () => {
  storage();
  const { ctx } = await timeAttackAlone();
  ctx.game.phase = ctx.PHASE.race;
  const warm = [];
  lapSession(ctx, [[50, 100]], {
    until: 100,
    tick: (t) => {
      if (t <= 0) {
        warm.push({
          warm: ctx.laps.warm[0],
          mark: ctx.laps.marks[0],
          ghost: ctx.ghost.driven,
        });
      }
    },
  });
  // (the warm-up lap's checkpoints passed, its line too: no lap, no times)
  expect(warm.slice(0, -1).every(({ warm }) => warm)).toBe(true);
  expect(warm.every(({ mark }) => mark === null)).toBe(true);
  expect(warm.slice(0, -1).every(({ ghost }) => ghost === null)).toBe(true);
  // from its line the first lap, timed and recorded
  expect(ctx.laps.done[0]).toBe(1);
  expect(ctx.laps.best[0]).toBe(100);
  expect(ctx.storedGhost(2).ticks).toBe(100);
});

test("alone, time attack goes on for as long as the player likes", async () => {
  storage();
  const { ctx } = await timeAttackAlone();
  expect(ctx.deathmatchTicks()).toBe(Infinity);
  lapSession(ctx, [[]], { until: 60000 });
  expect(ctx.track.haltall).toBe(false);
  expect(ctx.laps.through[0]).toBe(false);
});

test("in a room, once the time is up a lap begun before it is finished and counts, then the session is over", async () => {
  storage();
  const { ctx } = await timeAttackAlone();
  ctx.raceSetup.kind = ctx.RACE_KIND.together;
  ctx.raceSetup.mode = ctx.RACE_MODE.timeAttack;
  ctx.raceSetup.rules.minutes = 1;
  const up = ctx.deathmatchTicks();
  // laps of 600 ticks: the third ends after the time is up
  const clears = [300, 600, 900, 1200, 1500, 1800];
  const laps = lapSession(ctx, [clears]);
  expect(up).toBeLessThan(1800 + WARM);
  expect(laps.done[0]).toBe(3);
  expect(laps.through[0]).toBe(true);
  expect(ctx.track.haltall).toBe(true);
  expect(ctx.deathmatch.ticks).toBe(1800 + WARM);
  // (through, the car gets no keys any more)
  expect(ctx.throughTheRace(0)).toBe(true);

  // a lap that counts for nothing is over as the time is up
  ctx.track.haltall = false;
  const wrecked = lapSession(ctx, [clears], { wrecks: [[1650 - WARM]] });
  expect(wrecked.done[0]).toBe(2);
  expect(ctx.deathmatch.ticks).toBe(up);
  expect(ctx.track.haltall).toBe(true);

  // a car that never gets round: over at the latest three minutes after
  ctx.track.haltall = false;
  lapSession(ctx, [[300]], { until: 100000 });
  expect(ctx.track.haltall).toBe(true);
  expect(ctx.deathmatch.ticks * 35).toBeCloseTo((60 + 180) * 1000, -2);
  ctx.raceSetup.mode = ctx.RACE_MODE.normal;
});

test("alone, the stage's best lap is kept with its splits, the times told against it, its ghost driven again each lap", async () => {
  const stored = storage();
  const { ctx } = await timeAttackAlone();
  ctx.game.phase = ctx.PHASE.race;
  // the car moves on each tick, its lap recorded
  // (up and round: no checkpoint crossed earlier or later within its tick)
  const moving = (t) => {
    ctx.car[0].y = 100 + 2 * t;
    ctx.car[0].xz = (7 * t) % 360;
  };
  lapSession(ctx, [[50, 100, 150, 190]], { until: 195, tick: moving });
  // the best of the session (the second lap, 90) kept for the stage
  expect(ctx.bestTimes(2)).toEqual({ lap: 90, splits: [50, 90] });
  expect(ctx.timeAttack.newBest).toBe(true);
  expect(ctx.storedGhost(2).ticks).toBe(90);
  expect(ctx.storedGhost(2).time).toBe(90);

  // the next session: its checkpoints told against the stage's best, the ghost there
  const seen = [];
  lapSession(ctx, [[45, 95, 150]], {
    until: 100,
    tick: (t) => {
      moving(t);
      if (t == 45) {
        expect(ctx.laps.marks[0]).toMatchObject({ k: 0, own: -5 });
      }
      // (from the first timed lap on)
      if (t >= 1) {
        seen.push(ctx.ghostShown() ? { ...ctx.car[ctx.GHOST] } : null);
      }
    },
  });
  expect(seen.every((pose) => pose !== null)).toBe(true);
  // the lap of 95 is no better than the stage's best: no new best
  expect(ctx.laps.marks[0]).toMatchObject({ k: 1, time: 95, own: 5 });
  expect(ctx.timeAttack.newBest).toBe(false);
  expect(ctx.bestTimes(2).lap).toBe(90);
  // (best times kept before splits were, and none for stages made in the editor)
  stored.set("bestTimes", JSON.stringify({ 3: { lap: 300, race: 900 } }));
  expect(ctx.bestTimes(3)).toEqual({ lap: 300, splits: [] });
  expect(ctx.bestTimes(ctx.FIRST_OWN_STAGE)).toBe(null);
  expect(ctx.GHOST).toBeGreaterThanOrEqual(ctx.game.carCount);
});

test("a wasted car in time attack comes back at the checkpoint it cleared last, facing on, and drives on to the next", async () => {
  storage();
  // (time attack chosen in the main menu, the stage loaded for it)
  const { ctx, step, stepUntil } = await openStageSelect({ stage: 1, car: 5 });
  ctx.chooseRaceKind(ctx.RACE_KIND.timeAttack);
  // (alone, as the stage select starts it)
  ctx.game.carCount = 1;
  ctx.game.mode = 0;
  ctx.flashIntoRace();
  stepUntil(() => ctx.game.phase === ctx.PHASE.race, 10, "race");
  const pilot = racingAutopilot();
  const drive = (until, ticks) => {
    for (let i = 0; i < ticks && !until(); i++) {
      Object.assign(ctx.racers[0].u, pilot(ctx));
      step();
    }
  };
  drive(() => ctx.racers[0].clear >= 2, 3000);
  expect(ctx.racers[0].clear).toBe(2);
  const at = ctx.racers[0].clearedPathPoint;
  ctx.racers[0].wasted = true;
  ctx.deathmatch.backAt[0] = ctx.deathmatch.ticks + 1;
  step();
  expect(ctx.racers[0].wasted).toBe(false);
  expect(ctx.car[0].x).toBeCloseTo(ctx.track.x[at], 0);
  expect(ctx.car[0].z).toBeCloseTo(ctx.track.z[at], 0);
  expect(ctx.laps.valid[0]).toBe(false);
  drive(() => ctx.racers[0].clear >= 3, 1500);
  expect(ctx.racers[0].clear).toBe(3);
});
