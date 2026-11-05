// Time attack's ghost: the fastest race of the stage driven again beside the player, in
// the car that drove it, seen through and never in the way. It is no car of the race (it
// sits in the last of the cars' slots, which a race alone never uses), only where the
// recorded car was each tick. Each race alone is recorded; one finished faster than the
// ghost (or the first) becomes the stage's new ghost.

import { MAX_CARS, PHASE, RACE_MODE, game, raceSetup } from "../core/state.js";
import { camera } from "../render/camera.js";
import { loadSetting, loadText, saveSetting } from "../core/storage.js";
import { isCustom } from "../data/stages.js";
import { car } from "./racers.js";
import { poseFromTape, turnCarAfterItsAngles } from "./recording.js";
import { track } from "./track.js";

export const GHOST = MAX_CARS - 1;

// what a tick keeps of the car: where it is, how it is turned, its wheels' turns
const POSE = ["x", "y", "z", "xy", "xz", "zy", "wzy", "wxz"];
// kept to a tenth (a hundredth of a wheel's length): small numbers, and no visible step
const SCALE = 10;

// tape: the ghost's poses by field, ticks: how many, type: its car; driven: this race's
// poses so far; shown: whether the player wants to see it (the best race is kept anyway)
export const ghost = {
  tape: null,
  ticks: 0,
  type: 0,
  driven: null,
  shown: loadSetting("ghost") != 0,
};

export const toggleGhost = () => {
  ghost.shown = !ghost.shown;
  saveSetting("ghost", ghost.shown ? 1 : 0);
};

const keyOf = (stage) => `ghost-${stage}`;

const emptyTape = () => Object.fromEntries(POSE.map((field) => [field, []]));

// Each field as the differences from tick to tick, in tenths: "12,-3,0,..."
const encode = (tape) =>
  POSE.map((field) => {
    let last = 0;
    return tape[field]
      .map((value) => {
        const now = Math.round(value * SCALE);
        const step = now - last;
        last = now;
        return step;
      })
      .join(",");
  });

const decode = (columns, ticks) => {
  const tape = emptyTape();
  POSE.forEach((field, i) => {
    let now = 0;
    const steps = String(columns[i]).split(",");
    for (let t = 0; t < ticks; t++) {
      now += Number(steps[t]) || 0;
      tape[field][t] = now / SCALE;
    }
  });
  return tape;
};

// The stage's ghost, or null (none yet, a stage made in the editor, or garbled).
export const storedGhost = (stage) => {
  if (isCustom(stage)) {
    return null;
  }
  try {
    const stored = JSON.parse(loadText(keyOf(stage)) || "null");
    const { ticks, type, poses, time = ticks } = stored ?? {};
    if (
      !Number.isInteger(ticks) ||
      ticks <= 0 ||
      !Number.isInteger(type) ||
      !Array.isArray(poses) ||
      poses.length != POSE.length ||
      !Number.isFinite(time)
    ) {
      return null;
    }
    return { ticks, time, type, tape: decode(poses, ticks) };
  } catch {
    return null;
  }
};

// Puts the ghost where its car was after tick t (the last place once its race is over).
const poseGhost = (t) => {
  poseFromTape(GHOST, ghost.tape, Math.min(t, ghost.ticks - 1));
  turnCarAfterItsAngles(GHOST);
};

// As a race alone begins: the stage's ghost on the grid, and a fresh recording.
export const startGhost = () => {
  const stored = ghost.shown ? storedGhost(track.stage) : null;
  ghost.tape = stored?.tape ?? null;
  ghost.ticks = stored?.ticks ?? 0;
  ghost.type = stored?.type ?? 0;
  ghost.driven = emptyTape();
  if (ghost.tape) {
    car[GHOST].typ = ghost.type;
    car[GHOST].mat ??= mat4.create();
    poseGhost(0);
  }
};

export const forgetGhost = () => {
  ghost.tape = null;
  ghost.driven = null;
};

// In a room's time attack the other cars are ghosts too, the more seen through the nearer
// they come to the car the camera follows: within NEAR as little shows as SHOWS_NEAR, from
// FAR all of it.
const NEAR = 40;
const FAR = 240;
const SHOWS_NEAR = 0.25;

// How much of car c shows (1: all of it).
export const showsOf = (c) => {
  if (
    raceSetup.mode != RACE_MODE.timeAttack ||
    game.humans.length == 0 ||
    c == camera.target
  ) {
    return 1;
  }
  const followed = car[camera.target];
  const away = Math.hypot(car[c].x - followed.x, car[c].z - followed.z);
  const far = Math.min(1, Math.max(0, (away - NEAR) / (FAR - NEAR)));
  return SHOWS_NEAR + (1 - SHOWS_NEAR) * far;
};

// whether the ghost is drawn: in a race alone being raced (not in its replay)
export const ghostShown = () => ghost.tape != null && game.phase == PHASE.race;

// Every tick of the race (tick t since the start, from 1): the player's car recorded, the
// ghost moved on.
export const ghostTick = (t) => {
  if (!ghost.driven) {
    return;
  }
  const driving = car[game.player];
  for (const field of POSE) {
    ghost.driven[field][t - 1] = driving[field];
  }
  if (ghost.tape) {
    poseGhost(t - 1);
  }
};

// The race finished in time, over ticks: the stage's ghost if it is the first or faster.
export const keepGhost = (ticks, time) => {
  if (!ghost.driven || isCustom(track.stage)) {
    return;
  }
  const stored = storedGhost(track.stage);
  if (stored && stored.time <= time) {
    return;
  }
  saveSetting(
    keyOf(track.stage),
    JSON.stringify({
      ticks,
      time,
      type: car[game.player].typ,
      poses: encode(ghost.driven),
    }),
  );
};
