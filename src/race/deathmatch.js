// A room's race of a fixed time, a wasted car coming back where it lies after a while (see
// respawn in physics.js): of most kills, where the cars waste each other and whoever wasted
// the most wins, or of stunts, where the cars pass through each other and the most points
// win: a stunt landed scores its power (see rewardStunt), a landing on the roof and a
// wasting cost points; or of gun game, where every car starts in the first car of a ladder
// and each kill gets it the next one a moment later (or as it comes back), and a kill in
// the last one wins (else, once the time is up, the most kills). A car is wasted by the one that hit it last, if that was not long
// before (as the HUD tells whom a player wasted). Its state goes with the race's (see
// net/raceState.js), in these modes only.

import {
  MAX_CARS,
  RACE_KIND,
  RACE_MODE,
  game,
  raceSetup,
} from "../core/state.js";
import { TICK_MS } from "../core/tick.js";
import { CAR } from "../data/carStats.js";
import { racers } from "./racers.js";
import { teamMates, teamOf } from "../net/roomCars.js";

// how long the race goes on, and a wasted car stays out, as the host chose
export const deathmatchTicks = () =>
  Math.round((raceSetup.rules.minutes * 60 * 1000) / TICK_MS);
export const respawnTicks = () =>
  Math.round((raceSetup.rules.respawnSeconds * 1000) / TICK_MS);

// a car that hit another this long before someone else wasted it helped (an assist)
export const ASSIST_TICKS = Math.round(8000 / TICK_MS);
// in stunts, the points a landing on the roof and a wasting cost
export const CRASH_LANDING_POINTS = 50;
export const WASTED_POINTS = 150;
// gun game's cars, from the weakest on
export const GUN_LADDER = [
  CAR.tornadoShark,
  CAR.wowCaninaro,
  CAR.maxRevenge,
  CAR.koolKat,
  CAR.swordOfJustice,
  CAR.elKing,
  CAR.masheen,
  CAR.drMonstaa,
];
// how long after a kill the car becomes the next
const UPGRADE_TICKS = Math.round(1000 / TICK_MS);

// ticks: since the start; kills: by car, how many it wasted; deaths: how often it was;
// backAt: the tick a wasted car comes back (0: none); assists: by car, how often it helped
// waste one; dealt: the damage it did others, in whole cars; hitAt: the tick after car x
// last hit car c, at c * MAX_CARS + x (0: not since c was last wasted); in stunts by car
// its points, the stunts it landed and its landings on the roof; in gun game the tick a car
// becomes its next (0: none)
export const deathmatch = {
  ticks: 0,
  kills: [],
  deaths: [],
  backAt: [],
  assists: [],
  dealt: [],
  hitAt: [],
  points: [],
  stunts: [],
  crashes: [],
  upgradeAt: [],
};
// (all but the ticks: a list each)
const LISTS = [
  "kills",
  "deaths",
  "backAt",
  "assists",
  "dealt",
  "hitAt",
  "points",
  "stunts",
  "crashes",
  "upgradeAt",
];

// whether a room's race in this mode lasts a fixed time
export const isTimedMode = (mode) =>
  mode == RACE_MODE.mostKills ||
  mode == RACE_MODE.stunts ||
  mode == RACE_MODE.gunGame;

// whether the race is a room's of a fixed time
export const isDeathmatch = () =>
  isTimedMode(raceSetup.mode) && game.humans.length > 0;
const isStunts = () => raceSetup.mode == RACE_MODE.stunts;
export const isGunGame = () =>
  raceSetup.mode == RACE_MODE.gunGame && game.humans.length > 0;
// whether the race is to be a room's gun game, before its players are known: its cars
// start in the ladder's first and may become any of it
export const racesGunGame = () =>
  raceSetup.kind == RACE_KIND.together && raceSetup.mode == RACE_MODE.gunGame;

// In gun game: the car of the ladder car c has got to by its kills.
export const gunCarOf = (c) =>
  GUN_LADDER[Math.min(deathmatch.kills[c] ?? 0, GUN_LADDER.length - 1)];
// whether a car has a kill in the ladder's last car
export const gunGameWon = () =>
  isGunGame() && deathmatch.kills.some((kills) => kills >= GUN_LADDER.length);

export const startDeathmatch = () => {
  deathmatch.ticks = 0;
  for (const list of LISTS) {
    deathmatch[list] = Array(list == "hitAt" ? MAX_CARS * MAX_CARS : MAX_CARS);
    deathmatch[list].fill(0);
  }
};

export const deathmatchState = () => ({
  ticks: deathmatch.ticks,
  ...Object.fromEntries(LISTS.map((list) => [list, deathmatch[list].slice()])),
});

export const restoreDeathmatch = (state) => {
  deathmatch.ticks = state.ticks;
  for (const list of LISTS) {
    deathmatch[list] = state[list].slice();
  }
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
  isCounts(state.hitAt, MAX_CARS * MAX_CARS) &&
  isCounts(state.points) &&
  isCounts(state.stunts) &&
  isCounts(state.crashes) &&
  isCounts(state.upgradeAt);

// Car c dented by car by, taking damage (a share of what wastes it).
export const noteHit = (c, by, damage) => {
  // (a team mate's dents count for nothing)
  if (by == c || teamMates(c, by)) {
    return;
  }
  deathmatch.dealt[by] += damage;
  deathmatch.hitAt[c * MAX_CARS + by] = deathmatch.ticks + 1;
};

// As car c is wasted: a kill for the car that hit it (in stunts the points it costs), and
// its time out. The others that hit it not long before helped.
export const noteWasted = (c) => {
  const { lastcolido, lastHitBy } = racers[c];
  if (isStunts()) {
    deathmatch.points[c] -= WASTED_POINTS;
  }
  const killer =
    !isStunts() &&
    lastcolido != 0 &&
    Number.isInteger(lastHitBy) &&
    lastHitBy != c &&
    !teamMates(c, lastHitBy)
      ? lastHitBy
      : -1;
  if (killer != -1) {
    deathmatch.kills[killer]++;
    if (isGunGame()) {
      deathmatch.upgradeAt[killer] = deathmatch.ticks + UPGRADE_TICKS;
    }
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

// In stunts: car c landed a stunt of this power (see rewardStunt in physics.js).
export const noteStunt = (c, power) => {
  if (isStunts() && power > 0) {
    deathmatch.points[c] += Math.round(power);
    deathmatch.stunts[c]++;
  }
};

// In stunts: car c landed on its roof.
export const noteCrashLanding = (c) => {
  if (isStunts()) {
    deathmatch.points[c] -= CRASH_LANDING_POINTS;
    deathmatch.crashes[c]++;
  }
};

// Every tick of the race, after the cars drove: the clock, the wasted whose time out is
// over back (respawn(c)), and in gun game the cars a kill earned the next one as that
// (upgrade(c); a wasted one comes back in it). Returns whether the time is up.
export const deathmatchTick = (respawn, upgrade) => {
  deathmatch.ticks++;
  for (let c = 0; c < game.carCount; c++) {
    if (racers[c].wasted && deathmatch.backAt[c] == deathmatch.ticks) {
      deathmatch.backAt[c] = 0;
      respawn(c);
    }
    if (deathmatch.upgradeAt[c] == deathmatch.ticks) {
      deathmatch.upgradeAt[c] = 0;
      if (!racers[c].wasted && !gunGameWon()) {
        upgrade(c);
      }
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

// The cars by what wins (kills, or in stunts points), most first (fewer deaths first on a
// tie); score: that.
export const killTable = () =>
  Array.from({ length: game.carCount }, (_, c) => {
    const row = { c };
    for (const list of LISTS.filter((list) => list != "hitAt")) {
      row[list] = deathmatch[list][c] ?? 0;
    }
    return { ...row, score: isStunts() ? row.points : row.kills };
  }).sort((a, b) => b.score - a.score || a.deaths - b.deaths || a.c - b.c);
