// A room's race of most kills: for a fixed time the cars waste each other, a wasted car
// coming back where it lies after a while (see respawn in physics.js), and whoever wasted
// the most wins. A car is wasted by the one that hit it last, if that was not long before
// (as the HUD tells whom a player wasted). Its state goes with the race's (see
// net/raceState.js), in this mode only.

import { MAX_CARS, RACE_MODE, game, raceSetup } from "../core/state.js";
import { TICK_MS } from "../core/tick.js";
import { racers } from "./racers.js";
import { teamMates, teamOf } from "../net/roomCars.js";

// how long the race goes on, and a wasted car stays out, as the host chose
export const deathmatchTicks = () =>
  Math.round((raceSetup.rules.minutes * 60 * 1000) / TICK_MS);
export const respawnTicks = () =>
  Math.round((raceSetup.rules.respawnSeconds * 1000) / TICK_MS);

// a car that hit another this long before someone else wasted it helped (an assist)
export const ASSIST_TICKS = Math.round(8000 / TICK_MS);

// ticks: since the start; kills: by car, how many it wasted; deaths: how often it was;
// backAt: the tick a wasted car comes back (0: none); assists: by car, how often it helped
// waste one; dealt: the damage it did others, in whole cars; hitAt: the tick after car x
// last hit car c, at c * MAX_CARS + x (0: not since c was last wasted)
export const deathmatch = {
  ticks: 0,
  kills: [],
  deaths: [],
  backAt: [],
  assists: [],
  dealt: [],
  hitAt: [],
};

export const isDeathmatch = () =>
  raceSetup.mode == RACE_MODE.mostKills && game.humans.length > 0;

export const startDeathmatch = () => {
  deathmatch.ticks = 0;
  deathmatch.kills = Array(MAX_CARS).fill(0);
  deathmatch.deaths = Array(MAX_CARS).fill(0);
  deathmatch.backAt = Array(MAX_CARS).fill(0);
  deathmatch.assists = Array(MAX_CARS).fill(0);
  deathmatch.dealt = Array(MAX_CARS).fill(0);
  deathmatch.hitAt = Array(MAX_CARS * MAX_CARS).fill(0);
};

export const deathmatchState = () => ({
  ticks: deathmatch.ticks,
  kills: deathmatch.kills.slice(),
  deaths: deathmatch.deaths.slice(),
  backAt: deathmatch.backAt.slice(),
  assists: deathmatch.assists.slice(),
  dealt: deathmatch.dealt.slice(),
  hitAt: deathmatch.hitAt.slice(),
});

export const restoreDeathmatch = (state) => {
  deathmatch.ticks = state.ticks;
  deathmatch.kills = state.kills.slice();
  deathmatch.deaths = state.deaths.slice();
  deathmatch.backAt = state.backAt.slice();
  deathmatch.assists = state.assists.slice();
  deathmatch.dealt = state.dealt.slice();
  deathmatch.hitAt = state.hitAt.slice();
};

const isCounts = (counts, length = MAX_CARS, isCount = Number.isInteger) =>
  Array.isArray(counts) && counts.length == length && counts.every(isCount);

export const isDeathmatchState = (state) =>
  state != null &&
  Number.isInteger(state.ticks) &&
  isCounts(state.kills) &&
  isCounts(state.deaths) &&
  isCounts(state.backAt) &&
  isCounts(state.assists) &&
  isCounts(state.dealt, MAX_CARS, Number.isFinite) &&
  isCounts(state.hitAt, MAX_CARS * MAX_CARS);

// Car c dented by car by, taking damage (a share of what wastes it).
export const noteHit = (c, by, damage) => {
  // (a team mate's dents count for nothing)
  if (by == c || teamMates(c, by)) {
    return;
  }
  deathmatch.dealt[by] += damage;
  deathmatch.hitAt[c * MAX_CARS + by] = deathmatch.ticks + 1;
};

// As car c is wasted: a kill for the car that hit it, and its time out.
// The others that hit it not long before helped.
export const noteWasted = (c) => {
  const { lastcolido, lastHitBy } = racers[c];
  const killer =
    lastcolido != 0 &&
    Number.isInteger(lastHitBy) &&
    lastHitBy != c &&
    !teamMates(c, lastHitBy)
      ? lastHitBy
      : -1;
  if (killer != -1) {
    deathmatch.kills[killer]++;
  }
  for (let x = 0; x < MAX_CARS; x++) {
    const at = c * MAX_CARS + x;
    if (
      x != killer &&
      deathmatch.hitAt[at] != 0 &&
      deathmatch.ticks + 1 - deathmatch.hitAt[at] <= ASSIST_TICKS
    ) {
      deathmatch.assists[x]++;
    }
    deathmatch.hitAt[at] = 0;
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

// With teams, the teams by their cars' kills, most first: each with its kills, deaths,
// assists, damage dealt and cars; none without.
export const teamTable = () => {
  const table = [];
  for (let c = 0; c < game.carCount; c++) {
    const team = teamOf(c);
    if (team == -1) {
      return [];
    }
    table[team] ??= {
      team,
      kills: 0,
      deaths: 0,
      assists: 0,
      dealt: 0,
      cars: [],
    };
    table[team].kills += deathmatch.kills[c] ?? 0;
    table[team].deaths += deathmatch.deaths[c] ?? 0;
    table[team].assists += deathmatch.assists[c] ?? 0;
    table[team].dealt += deathmatch.dealt[c] ?? 0;
    table[team].cars.push(c);
  }
  return table
    .filter(Boolean)
    .sort(
      (a, b) => b.kills - a.kills || a.deaths - b.deaths || a.team - b.team,
    );
};

// The cars by kills, most first (fewer deaths first on a tie).
export const killTable = () =>
  Array.from({ length: game.carCount }, (_, c) => ({
    c,
    kills: deathmatch.kills[c] ?? 0,
    deaths: deathmatch.deaths[c] ?? 0,
    assists: deathmatch.assists[c] ?? 0,
    dealt: deathmatch.dealt[c] ?? 0,
  })).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.c - b.c);
