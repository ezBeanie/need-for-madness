// The standings, every tick: damage, race positions and wasted opponents, and whether a
// close finish is coming that the highlights should show.

import { distanceSquaredXZ } from "../core/math.js";
import { RACE_MODE, finishingEnds, game, raceSetup } from "../core/state.js";
import { carStats } from "../data/carStats.js";
import { tick } from "../core/tick.js";
import { deathmatchLeft } from "./deathmatch.js";
import { raceEvents } from "./events.js";
import { MISSED, car, countMissedCheckpoint, racers } from "./racers.js";
import { HIGHLIGHT, catchHighlight, recording } from "./recording.js";
import { track } from "./track.js";
import { teamOf } from "../net/roomCars.js";

// how many sides still have a car not wasted: the teams, or every car for itself
const sidesLeft = (cars) => {
  const sides = [];
  cars.forEach((racer, c) => {
    const side = teamOf(c) == -1 ? `car${c}` : `team${teamOf(c)}`;
    if (!racer.wasted && !sides.includes(side)) {
      sides.push(side);
    }
  });
  return sides.length;
};

// the car finishing right behind or right ahead of the player
let rival = 0;
// a close finish is recorded this many ticks before the finish line
const CLOSE_FINISH_TICKS = 43;
// how close (squared, in tenths) the rival has to be
const CLOSE = 14000;

export function updateStandings() {
  if (!track.haltall) {
    updateDamageAndProgress();
    rank();
    // the first two stages have no close finishes
    if (track.stage > 2) {
      watchForCloseFinish();
    }
  }
  track.wasted = 0;
  for (let i = 0; i < game.carCount; i++) {
    if (game.player != i && racers[i].wasted) {
      track.wasted++;
    }
  }
  // The HUD stops the race as the player sees it end (see raceOutcome in ui/hud.js);
  // racing together, it stops alike in every game: one car left, or one finished (when
  // that wins).
  if (game.humans.length > 0) {
    const cars = racers.slice(0, game.carCount);
    const done = track.nlaps * track.nsp;
    if (raceSetup.mode == RACE_MODE.mostKills) {
      // (most kills: until the time is up, the wasted coming back)
      if (deathmatchLeft() == 0) {
        track.haltall = true;
      }
    } else if (raceSetup.mode == RACE_MODE.timeAttack) {
      // (against the clock: until every car is through or wasted)
      if (cars.every((racer) => racer.wasted || racer.clear >= done)) {
        track.haltall = true;
      }
    } else if (
      sidesLeft(cars) <= 1 ||
      (finishingEnds() &&
        cars.some((_, c) => track.clear[c] == done && track.pos[c] == 0))
    ) {
      track.haltall = true;
    }
  }
  // The original counts a missed checkpoint's warning while the HUD shows it (see
  // drawTrackWarnings), which depends on the view; racing together, every game counts
  // every human car's alike.
  if (game.humans.length > 0 && tick.fraction >= tick.scale) {
    for (const c of game.humans) {
      if (
        racers[c].missedCheckpoint >= MISSED.started &&
        raceEvents.countdown == 0 &&
        track.stage != 16 &&
        racers[c].capcnt == 0
      ) {
        countMissedCheckpoint(racers[c]);
      }
    }
  }
  if (recording.finishCatchTicks != 0) {
    recording.finishCatchTicks--;
    if (recording.finishCatchTicks == 0) {
      catchHighlight(HIGHLIGHT.closeWin + track.pos[game.player]);
      if (recording.highlight == HIGHLIGHT.closeWin + track.pos[game.player]) {
        recording.otherCar = rival;
        if (recording.highlight > HIGHLIGHT.closeLoss) {
          recording.highlight = HIGHLIGHT.closeLoss;
        }
      }
    }
  }
}

// Damage as a share of what wastes the car; checkpoints cleared, -1 once wasted.
const updateDamageAndProgress = () => {
  for (let i = 0; i < game.carCount; i++) {
    track.magperc[i] = Math.min(
      racers[i].damage / carStats.maxmag[car[i].typ],
      1,
    );
    track.pos[i] = 0;
    track.clear[i] = track.dested[i] == 0 ? racers[i].clear : -1;
  }
};

// Each pair of cars: more checkpoints cleared is ahead; with as many, the one closer to
// the next path point the first of them has to reach.
const rank = () => {
  for (let i = 0; i < game.carCount; i++) {
    for (let j = i + 1; j < game.carCount; j++) {
      if (track.clear[i] != track.clear[j]) {
        if (track.clear[i] < track.clear[j]) {
          track.pos[i]++;
        } else {
          track.pos[j]++;
        }
      } else {
        const next = nextPathPoint(racers[i].clearedPathPoint);
        if (
          distanceTo(car[i], track.x[next], track.z[next]) >
          distanceTo(car[j], track.x[next], track.z[next])
        ) {
          track.pos[i]++;
        } else {
          track.pos[j]++;
        }
      }
    }
  }
};

// The first path point after `cleared` that counts for the race (typ > 0).
const nextPathPoint = (cleared) => {
  let point = cleared + 1;
  if (point >= track.n) {
    point = 0;
  }
  while (track.typ[point] <= 0) {
    point++;
    if (point >= track.n) {
      point = 0;
    }
  }
  return point;
};

const distanceTo = (body, x, z) =>
  distanceSquaredXZ(body.x / 10, x / 10, body.z / 10, z / 10);

// The leader has cleared every checkpoint: when it is the player with the second close
// behind, one checkpoint less, or another car with the player (car 0) close behind like
// that, the finish is recorded.
// (racing together, a guest's own car is not car 0)
const watchForCloseFinish = () => {
  const p = game.player;
  for (let i = 0; i < game.carCount; i++) {
    if (track.clear[i] != track.nlaps * track.nsp || track.pos[i] != 0) {
      continue;
    }
    if (i == game.player) {
      for (let j = 0; j < game.carCount; j++) {
        if (track.pos[j] == 1) {
          rival = j;
        }
      }
      if (
        distanceTo(car[p], car[rival].x, car[rival].z) < CLOSE &&
        track.clear[p] - racers[rival].clear == 1
      ) {
        recording.finishCatchTicks = CLOSE_FINISH_TICKS;
      }
    } else if (
      track.pos[p] == 1 &&
      distanceTo(car[p], car[i].x, car[i].z) < CLOSE &&
      racers[i].clear - racers[p].clear == 1
    ) {
      recording.finishCatchTicks = CLOSE_FINISH_TICKS;
      rival = i;
    }
  }
};
