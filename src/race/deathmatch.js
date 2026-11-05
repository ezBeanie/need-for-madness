// A room's race of most kills: for a fixed time the cars waste each other, a wasted car
// coming back where it lies after a while (see respawn in physics.js), and whoever wasted
// the most wins. A car is wasted by the one that hit it last, if that was not long before
// (as the HUD tells whom a player wasted). Its state goes with the race's (see
// net/raceState.js), in this mode only.

import { MAX_CARS, RACE_MODE, game, raceSetup } from "../core/state.js";
import { TICK_MS } from "../core/tick.js";
import { racers } from "./racers.js";

// how long the race goes on, and a wasted car stays out, as the host chose
export const deathmatchTicks = () =>
  Math.round((raceSetup.rules.minutes * 60 * 1000) / TICK_MS);
export const respawnTicks = () =>
  Math.round((raceSetup.rules.respawnSeconds * 1000) / TICK_MS);

// ticks: since the start; kills: by car, how many it wasted; deaths: how often it was;
// backAt: the tick a wasted car comes back (0: none)
export const deathmatch = { ticks: 0, kills: [], deaths: [], backAt: [] };

export const isDeathmatch = () =>
  raceSetup.mode == RACE_MODE.mostKills && game.humans.length > 0;

export const startDeathmatch = () => {
  deathmatch.ticks = 0;
  deathmatch.kills = Array(MAX_CARS).fill(0);
  deathmatch.deaths = Array(MAX_CARS).fill(0);
  deathmatch.backAt = Array(MAX_CARS).fill(0);
};

export const deathmatchState = () => ({
  ticks: deathmatch.ticks,
  kills: deathmatch.kills.slice(),
  deaths: deathmatch.deaths.slice(),
  backAt: deathmatch.backAt.slice(),
});

export const restoreDeathmatch = (state) => {
  deathmatch.ticks = state.ticks;
  deathmatch.kills = state.kills.slice();
  deathmatch.deaths = state.deaths.slice();
  deathmatch.backAt = state.backAt.slice();
};

const isCounts = (counts) =>
  Array.isArray(counts) &&
  counts.length == MAX_CARS &&
  counts.every(Number.isInteger);

export const isDeathmatchState = (state) =>
  state != null &&
  Number.isInteger(state.ticks) &&
  isCounts(state.kills) &&
  isCounts(state.deaths) &&
  isCounts(state.backAt);

// As car c is wasted: a kill for the car that hit it, and its time out.
export const noteWasted = (c) => {
  const { lastcolido, lastHitBy } = racers[c];
  if (lastcolido != 0 && Number.isInteger(lastHitBy) && lastHitBy != c) {
    deathmatch.kills[lastHitBy]++;
  }
  deathmatch.deaths[c]++;
  deathmatch.backAt[c] = deathmatch.ticks + respawnTicks();
};

// Every tick of the race, after the cars drove: the clock, and the wasted whose time out
// is over back (respawn(c)). Returns whether the time is up.
export const deathmatchTick = (respawn) => {
  deathmatch.ticks++;
  for (let c = 0; c < game.carCount; c++) {
    if (racers[c].wasted && deathmatch.backAt[c] == deathmatch.ticks) {
      deathmatch.backAt[c] = 0;
      respawn(c);
    }
  }
  return deathmatch.ticks >= deathmatchTicks();
};

// the ticks left
export const deathmatchLeft = () =>
  Math.max(0, deathmatchTicks() - deathmatch.ticks);

// The cars by kills, most first (fewer deaths first on a tie).
export const killTable = () =>
  Array.from({ length: game.carCount }, (_, c) => ({
    c,
    kills: deathmatch.kills[c] ?? 0,
    deaths: deathmatch.deaths[c] ?? 0,
  })).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.c - b.c);
