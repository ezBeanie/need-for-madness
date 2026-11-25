// Time attack's laps (alone or a room's, see isLapSession): every car laps the stage (a
// room's for a fixed time, alone for as long as the player likes), timed from line to line,
// and its fastest lap counts. The first lap, from the grid to the line, is a warm-up lap:
// untimed, as the grid lies elsewhere than the line. Each checkpoint of a lap
// is a split: the time since the lap began. A lap is timed where within its tick the car
// crossed the line, so times are finer than ticks. A wasted car's lap counts for nothing
// (it comes back at its last checkpoint, see physics.js); once the time is up a car still
// on a lap that counts may finish it, every other car is through and stops. Every game
// times every car alike, from the race itself; the times go with the race's state (see
// net/raceState.js).

import { MAX_CARS } from "../core/state.js";
import { TICK_MS } from "../core/tick.js";
import { deathmatch, deathmatchTicks, isLapSession } from "./deathmatch.js";
import { car, racers } from "./racers.js";
import { track } from "./track.js";

// by car: whether it is on its warm-up lap, when its lap began (in ticks of the race),
// whether it counts, its splits so far, its laps done, its last lap (0: none) and whether
// that counted, its fastest lap this session (0: none) and that lap's splits, the lap its
// times are told against (its own best, before this session too; 0: none) and that one's
// splits, whether it is through; where it was the tick before and the checkpoints it had
// cleared; and what its last checkpoint told (see Mark)
export const laps = {
  warm: [],
  from: [],
  valid: [],
  splits: [],
  done: [],
  last: [],
  lastValid: [],
  best: [],
  bestSplits: [],
  ownBest: [],
  ownSplits: [],
  through: [],
  x: [],
  z: [],
  cleared: [],
  marks: [],
};

// A checkpoint passed: its index in the lap (the last one is the line), the split (at the
// line: the lap's time), its difference to the car's own best (own) and to the session's
// fastest lap (field) at that checkpoint (null: none to tell against), whether the lap
// counts, and when (ticks of the race).
// { k, time, own, field, valid, at }

const LISTS = Object.keys(laps);
// once the time is up, the race goes on no longer than this for the last laps
const OVERTIME_TICKS = Math.round((3 * 60 * 1000) / TICK_MS);

// As the race begins: every car on its warm-up lap. own: the lap the
// player's times are told against ({ lap, splits } or null, see timeAttack.js).
export const startLaps = (player, own) => {
  for (let c = 0; c < MAX_CARS; c++) {
    laps.warm[c] = true;
    laps.from[c] = 0;
    // (a warm-up lap counts for nothing: the time up, it is not finished)
    laps.valid[c] = false;
    laps.splits[c] = [];
    laps.done[c] = 0;
    laps.last[c] = 0;
    laps.lastValid[c] = false;
    laps.best[c] = 0;
    laps.bestSplits[c] = [];
    const mine = c == player && own?.splits?.length == track.nsp;
    laps.ownBest[c] = mine ? own.lap : 0;
    laps.ownSplits[c] = mine ? own.splits.slice() : [];
    laps.through[c] = false;
    laps.x[c] = car[c].x;
    laps.z[c] = car[c].z;
    laps.cleared[c] = 0;
    laps.marks[c] = null;
  }
};

export const lapsState = () => structuredClone(laps);

export const restoreLaps = (state) => {
  for (const list of LISTS) {
    laps[list] = structuredClone(state[list]);
  }
};

const isTime = (time) => Number.isFinite(time) && time >= 0;
const isTimes = (times) => Array.isArray(times) && times.every(isTime);
const isMark = (mark) =>
  mark === null ||
  (mark != null &&
    Number.isInteger(mark.k) &&
    isTime(mark.time) &&
    isTime(mark.at) &&
    (mark.own === null || Number.isFinite(mark.own)) &&
    (mark.field === null || Number.isFinite(mark.field)) &&
    typeof mark.valid == "boolean");
const isFlag = (flag) => typeof flag == "boolean";
const CHECKS = {
  warm: isFlag,
  from: isTime,
  valid: (valid) => typeof valid == "boolean",
  splits: isTimes,
  done: Number.isInteger,
  last: isTime,
  lastValid: isFlag,
  best: isTime,
  bestSplits: isTimes,
  ownBest: isTime,
  ownSplits: isTimes,
  through: (through) => typeof through == "boolean",
  x: Number.isFinite,
  z: Number.isFinite,
  cleared: Number.isInteger,
  marks: isMark,
};

export const isLapsState = (state) =>
  state != null &&
  LISTS.every(
    (list) =>
      Array.isArray(state[list]) &&
      state[list].length == MAX_CARS &&
      state[list].every(CHECKS[list]),
  );

// Whether car c is through: it gets no keys any more, alike in every game, and its driver
// watches the others.
export const throughTheRace = (c) => isLapSession() && laps.through[c];

// whether the session's time is up, and whether its last laps took too long
export const timeIsUp = () => deathmatch.ticks >= deathmatchTicks();
export const overtimeIsUp = () =>
  deathmatch.ticks >= deathmatchTicks() + OVERTIME_TICKS;

// The car with the session's fastest lap, or -1.
export const fastestCar = () => {
  let fastest = -1;
  for (let c = 0; c < MAX_CARS; c++) {
    if (
      laps.best[c] > 0 &&
      (fastest == -1 || laps.best[c] < laps.best[fastest])
    ) {
      fastest = c;
    }
  }
  return fastest;
};

// How far into a tick a car going from (fromX, fromZ) to (toX, toZ) crossed the line of
// checkpoint i, along the checkpoint's axis: 0 at its start, 1 at its end. (A checkpoint
// counts a little before and after its line, so this may be up to a tick after.)
const crossingPart = (i, fromX, fromZ, toX, toZ) => {
  const alongZ = track.typ[i] == 1;
  const line = alongZ ? track.z[i] : track.x[i];
  const from = alongZ ? fromZ : fromX;
  const to = alongZ ? toZ : toX;
  return from == to ? 1 : Math.min(2, Math.max(0, (line - from) / (to - from)));
};

const against = (time, splits, k) =>
  splits.length == track.nsp ? time - splits[k] : null;

// Car c through its checkpoint k of the lap (the last: the line) at a time of the race.
const pass = (c, k, at) => {
  if (laps.warm[c]) {
    // (the warm-up lap over at the line: the first timed one begins)
    if (k == track.nsp - 1) {
      laps.warm[c] = false;
      laps.from[c] = at;
      laps.valid[c] = true;
    }
    return;
  }
  const time = at - laps.from[c];
  const fastest = fastestCar();
  laps.marks[c] = {
    k,
    time,
    own: against(time, laps.ownSplits[c], k),
    field: fastest == -1 ? null : against(time, laps.bestSplits[fastest], k),
    valid: laps.valid[c],
    at,
  };
  laps.splits[c].push(time);
  if (k < track.nsp - 1) {
    return;
  }
  // (the line: the lap done, the next begun)
  laps.done[c]++;
  laps.last[c] = time;
  laps.lastValid[c] = laps.valid[c];
  if (laps.valid[c] && (laps.best[c] == 0 || time < laps.best[c])) {
    laps.best[c] = time;
    laps.bestSplits[c] = laps.splits[c].slice();
  }
  if (laps.valid[c] && (laps.ownBest[c] == 0 || time < laps.ownBest[c])) {
    laps.ownBest[c] = time;
    laps.ownSplits[c] = laps.splits[c].slice();
  }
  laps.from[c] = at;
  laps.valid[c] = true;
  laps.splits[c] = [];
  if (at >= deathmatchTicks()) {
    laps.through[c] = true;
  }
};

// Every tick of the race, after the cars drove (and before the clock moves on, see
// deathmatchTick): the checkpoints each car passed, and the cars through.
export const lapTick = (carCount) => {
  for (let c = 0; c < carCount; c++) {
    if (racers[c].wasted) {
      laps.valid[c] = false;
    }
    const cleared = racers[c].clear;
    if (!laps.through[c]) {
      while (laps.cleared[c] < cleared) {
        laps.cleared[c]++;
        const part = crossingPart(
          racers[c].clearedPathPoint,
          laps.x[c],
          laps.z[c],
          car[c].x,
          car[c].z,
        );
        pass(c, (laps.cleared[c] - 1) % track.nsp, deathmatch.ticks + part);
      }
      // (the time up, a lap that counts for nothing is not finished)
      if (deathmatch.ticks + 1 >= deathmatchTicks() && !laps.valid[c]) {
        laps.through[c] = true;
      }
    }
    laps.cleared[c] = cleared;
    laps.x[c] = car[c].x;
    laps.z[c] = car[c].z;
  }
};

// The cars by their fastest lap, those without one last: each with its car, its fastest
// lap (0: none) and its laps done.
export const lapTable = (carCount) =>
  Array.from({ length: carCount }, (_, c) => ({
    c,
    best: laps.best[c],
    done: laps.done[c],
  })).sort(
    (a, b) => (a.best == 0) - (b.best == 0) || a.best - b.best || a.c - b.c,
  );
