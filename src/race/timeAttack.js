// Time attack alone: laps for a fixed time (see lapTimes.js), the stage's best lap kept
// with its splits, the times told against it, and its ghost driven again on every lap.
// Stages made in the editor keep none: their numbers change as stages are deleted.

import { RACE_KIND, game, raceSetup } from "../core/state.js";
import { loadSetting, loadText, saveSetting } from "../core/storage.js";
import { TICK_MS } from "../core/tick.js";
import { isCustom } from "../data/stages.js";
import { deathmatch, isLapSession } from "./deathmatch.js";
import { forgetGhost, ghostTick, keepGhost, startGhost } from "./ghost.js";
import { laps, startLaps } from "./lapTimes.js";
import { track } from "./track.js";

// best: the stage's best lap before this session ({ lap, splits } or null); kept: the best
// lap kept since (0: none); newBest: whether this session bettered it; lapsSeen: the
// player's laps done as last seen; lapTick: the tick the player's lap began
export const timeAttack = {
  best: null,
  kept: 0,
  newBest: false,
  lapsSeen: 0,
  lapTick: 0,
};

const STORED = "bestTimes";
// how long a session alone lasts (minutes), as last chosen
export const SESSION_MINUTES = [2, 3, 5, 10];
const MINUTES_STORED = "timeAttackMinutes";

export const sessionMinutes = () => {
  const minutes = loadSetting(MINUTES_STORED);
  return SESSION_MINUTES.includes(minutes) ? minutes : 3;
};

export const nextSessionMinutes = () => {
  const at = SESSION_MINUTES.indexOf(sessionMinutes());
  const minutes = SESSION_MINUTES[(at + 1) % SESSION_MINUTES.length];
  saveSetting(MINUTES_STORED, minutes);
  raceSetup.rules.minutes = minutes;
};

const allBestTimes = () => {
  try {
    const times = JSON.parse(loadText(STORED) || "{}");
    return times && typeof times == "object" ? times : {};
  } catch {
    return {};
  }
};

// The best lap of a stage, in ticks, with its splits (empty when kept before splits were),
// or null when none was done.
export const bestTimes = (stage) => {
  if (isCustom(stage)) {
    return null;
  }
  const best = allBestTimes()[stage];
  if (!Number.isFinite(best?.lap)) {
    return null;
  }
  const splits =
    Array.isArray(best.splits) && best.splits.every(Number.isFinite)
      ? best.splits
      : [];
  return { lap: best.lap, splits };
};

const keepBest = (lap, splits) => {
  if (isCustom(track.stage)) {
    return;
  }
  const times = allBestTimes();
  times[track.stage] = { lap, splits };
  saveSetting(STORED, JSON.stringify(times));
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

// +0.123 / -0.123, in seconds
export const formatDelta = (ticks) => {
  const thousandths = Math.round(ticks * TICK_MS);
  const sign = thousandths < 0 ? "-" : "+";
  const abs = Math.abs(thousandths);
  return `${sign}${Math.floor(abs / 1000)}.${String(abs % 1000).padStart(3, "0")}`;
};

export const isTimeAttack = () => raceSetup.kind == RACE_KIND.timeAttack;

// As the race begins.
export const startTimeAttack = () => {
  timeAttack.best = isTimeAttack() ? bestTimes(track.stage) : null;
  timeAttack.kept = timeAttack.best?.lap ?? 0;
  timeAttack.newBest = false;
  timeAttack.lapsSeen = 0;
  timeAttack.lapTick = 0;
  if (isLapSession()) {
    startLaps(game.player, timeAttack.best);
  }
  if (isTimeAttack()) {
    startGhost();
  } else {
    forgetGhost();
  }
};

// The current lap's ticks so far.
export const currentLapTicks = () =>
  Math.max(0, deathmatch.ticks - laps.from[game.player]);

// Every tick of a race alone, after the cars drove: a lap done better than the stage's
// best is kept, with its ghost; the ghost drives on.
export const timeAttackTick = () => {
  if (!isTimeAttack() || track.haltall) {
    return;
  }
  const p = game.player;
  if (laps.done[p] > timeAttack.lapsSeen) {
    timeAttack.lapsSeen = laps.done[p];
    // (the player's own best changes only with a lap that counts and is faster)
    const lap = laps.ownBest[p];
    if (lap > 0 && lap != timeAttack.kept) {
      keepBest(lap, laps.ownSplits[p]);
      keepGhost(deathmatch.ticks - timeAttack.lapTick, lap);
      timeAttack.kept = lap;
      timeAttack.newBest = true;
    }
    timeAttack.lapTick = deathmatch.ticks;
    startGhost();
  }
  if (deathmatch.ticks > timeAttack.lapTick) {
    ghostTick(deathmatch.ticks - timeAttack.lapTick);
  }
};
