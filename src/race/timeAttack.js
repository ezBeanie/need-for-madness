// Time attack: the player alone against the clock, timed in ticks from the start to each
// lap and to the finish. The best lap and the best race of each stage are kept.

import { RACE_KIND, game, raceSetup } from "../core/state.js";
import { loadText, saveSetting } from "../core/storage.js";
import { TICK_MS } from "../core/tick.js";
import { isCustom } from "../data/stages.js";
import { track } from "./track.js";

// ticks: since the start; laps: the ticks of each lap done; best: the stage's best times
// before this race ({ lap, race } or null); newBest: what this race bettered
export const timeAttack = {
  ticks: 0,
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
  return Number.isInteger(best?.lap) && Number.isInteger(best?.race)
    ? best
    : null;
};

// m:ss.cc
export const formatTime = (ticks) => {
  const hundredths = Math.round((ticks * TICK_MS) / 10);
  const seconds = Math.floor(hundredths / 100);
  const minutes = Math.floor(seconds / 60);
  const pad = (n) => String(n).padStart(2, "0");
  return `${minutes}:${pad(seconds % 60)}.${pad(hundredths % 100)}`;
};

export const isTimeAttack = () => raceSetup.kind == RACE_KIND.timeAttack;

// As the race begins.
export const startTimeAttack = () => {
  timeAttack.ticks = 0;
  timeAttack.laps = [];
  timeAttack.best = bestTimes(track.stage);
  timeAttack.finished = false;
  timeAttack.newBest = { lap: false, race: false };
};

const lapStart = () => timeAttack.laps.reduce((sum, lap) => sum + lap, 0);

// The current lap's ticks so far.
export const currentLapTicks = () => timeAttack.ticks - lapStart();

const keepBest = () => {
  if (isCustom(track.stage)) {
    return;
  }
  const fastestLap = Math.min(...timeAttack.laps);
  const best = timeAttack.best;
  timeAttack.newBest = {
    lap: !best || fastestLap < best.lap,
    race: !best || timeAttack.ticks < best.race,
  };
  const times = allBestTimes();
  times[track.stage] = {
    lap: best ? Math.min(best.lap, fastestLap) : fastestLap,
    race: best ? Math.min(best.race, timeAttack.ticks) : timeAttack.ticks,
  };
  saveSetting(STORED, JSON.stringify(times));
};

// Every tick of the race: the clock runs until the last lap is done (or the car wasted).
export const timeAttackTick = () => {
  if (!isTimeAttack() || timeAttack.finished || track.haltall) {
    return;
  }
  timeAttack.ticks++;
  const lapsDone = Math.floor(track.clear[game.player] / track.nsp);
  while (timeAttack.laps.length < Math.min(lapsDone, track.nlaps)) {
    timeAttack.laps.push(timeAttack.ticks - lapStart());
  }
  if (timeAttack.laps.length == track.nlaps) {
    timeAttack.finished = true;
    keepBest();
  }
};
