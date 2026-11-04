// Time attack: the player alone against the clock, timed in ticks from the start to each
// lap and to the finish. The best lap and the best race of each stage are kept. A lap ends
// where within its tick the car crossed the line, so times are finer than ticks.

import { RACE_KIND, game, raceSetup } from "../core/state.js";
import { loadText, saveSetting } from "../core/storage.js";
import { TICK_MS } from "../core/tick.js";
import { isCustom } from "../data/stages.js";
import { forgetGhost, ghostTick, keepGhost, startGhost } from "./ghost.js";
import { car, racers } from "./racers.js";
import { track } from "./track.js";

// ticks: since the start; time: the race's, once finished; laps: the time of each lap
// done; best: the stage's best times before this race ({ lap, race } or null); newBest:
// what this race bettered
export const timeAttack = {
  ticks: 0,
  time: 0,
  laps: [],
  best: null,
  finished: false,
  newBest: { lap: false, race: false },
};

const STORED = "bestTimes";

const allBestTimes = () => {
  try {
    const times = JSON.parse(loadText(STORED) || "{}");
    return times && typeof times == "object" ? times : {};
  } catch {
    return {};
  }
};

// The best lap and race of a stage, in ticks, or null when it was never finished. (Stages
// made in the editor keep none: their numbers change as stages are deleted, a host's
// visiting one is another each time.)
export const bestTimes = (stage) => {
  if (isCustom(stage)) {
    return null;
  }
  const best = allBestTimes()[stage];
  return Number.isFinite(best?.lap) && Number.isFinite(best?.race)
    ? best
    : null;
};

// m:ss.mmm
export const formatTime = (ticks) => {
  const thousandths = Math.round(ticks * TICK_MS);
  const seconds = Math.floor(thousandths / 1000);
  const minutes = Math.floor(seconds / 60);
  return (
    `${minutes}:${String(seconds % 60).padStart(2, "0")}.` +
    String(thousandths % 1000).padStart(3, "0")
  );
};

export const isTimeAttack = () => raceSetup.kind == RACE_KIND.timeAttack;

// As the race begins.
export const startTimeAttack = () => {
  timeAttack.ticks = 0;
  timeAttack.time = 0;
  timeAttack.laps = [];
  timeAttack.best = bestTimes(track.stage);
  timeAttack.finished = false;
  timeAttack.newBest = { lap: false, race: false };
  if (isTimeAttack()) {
    startGhost();
  } else {
    forgetGhost();
  }
  keepWhereBefore();
};

// where the player's car was the tick before
const before = { x: 0, z: 0 };

const keepWhereBefore = () => {
  before.x = car[game.player].x;
  before.z = car[game.player].z;
};

// When within tick t the player's car crossed the checkpoint it cleared then: from where
// it was the tick before and is now, along the checkpoint's axis. (A checkpoint counts
// a little before and after its line, so this may be up to a tick before or after.)
const crossedAt = (t) => {
  const c = game.player;
  const i = racers[c].clearedPathPoint;
  const alongZ = track.typ[i] == 1;
  const line = alongZ ? track.z[i] : track.x[i];
  const from = alongZ ? before.z : before.x;
  const to = alongZ ? car[c].z : car[c].x;
  if (from == to) {
    return t;
  }
  return t - 1 + Math.min(2, Math.max(0, (line - from) / (to - from)));
};

// the race's time so far: what the clock shows
export const raceTime = () =>
  timeAttack.finished ? timeAttack.time : timeAttack.ticks;

const lapStart = () => timeAttack.laps.reduce((sum, lap) => sum + lap, 0);

// The current lap's ticks so far.
export const currentLapTicks = () => Math.max(0, raceTime() - lapStart());

const keepBest = () => {
  if (isCustom(track.stage)) {
    return;
  }
  const fastestLap = Math.min(...timeAttack.laps);
  const best = timeAttack.best;
  const { time } = timeAttack;
  timeAttack.newBest = {
    lap: !best || fastestLap < best.lap,
    race: !best || time < best.race,
  };
  const times = allBestTimes();
  times[track.stage] = {
    lap: best ? Math.min(best.lap, fastestLap) : fastestLap,
    race: best ? Math.min(best.race, time) : time,
  };
  saveSetting(STORED, JSON.stringify(times));
};

// Every tick of the race: the clock runs until the last lap is done (or the car wasted).
export const timeAttackTick = () => {
  if (!isTimeAttack() || timeAttack.finished || track.haltall) {
    return;
  }
  timeAttack.ticks++;
  ghostTick(timeAttack.ticks);
  const lapsDone = Math.floor(track.clear[game.player] / track.nsp);
  while (timeAttack.laps.length < Math.min(lapsDone, track.nlaps)) {
    timeAttack.laps.push(crossedAt(timeAttack.ticks) - lapStart());
  }
  if (timeAttack.laps.length == track.nlaps) {
    timeAttack.finished = true;
    timeAttack.time = lapStart();
    keepBest();
    keepGhost(timeAttack.ticks, timeAttack.time);
  }
  keepWhereBefore();
};
