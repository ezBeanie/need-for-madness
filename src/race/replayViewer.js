// The replay viewer: the whole race (see raceTape.js) played at a speed of choice,
// paused, wound back and forth or jumped to anywhere, following any car with any camera.
// Opened from the pause menu, after the race, or with a replay file; closing it goes back
// there, the race as it was.

import { random } from "../core/random.js";
import { tick } from "../core/tick.js";
import { takePressedKeys } from "../input/keyboard.js";
import { PHASE, game } from "../core/state.js";
import { CAMERA, camera } from "../render/camera.js";
import { BLEND, gl } from "../render/renderer.js";
import { burn, effects } from "./effects.js";
import { raceEvents } from "./events.js";
import { raceTape } from "./raceTape.js";
import { car, racers } from "./racers.js";
import {
  playTape,
  poseFromTape,
  recording,
  resetCarsToTapeStart,
  turnCarAfterItsAngles,
} from "./recording.js";

export const SPEEDS = [0.25, 0.5, 1, 2, 4];
const NORMAL_SPEED = 2;
// how many frames a tick winds while an arrow is held, after it was held this long
const SCRUB_FRAMES = 4;
const SCRUB_AFTER_TICKS = 8;
// the cameras one can switch through; the free one stays where the last one was
export const CAMERAS = [
  CAMERA.orbit,
  CAMERA.behind,
  CAMERA.trackside,
  CAMERA.free,
];

// where the viewer was opened from, and goes back to
export const VIEWER_FROM = { pauseMenu: 0, raceOver: 1, file: 2 };

export const viewer = {
  from: VIEWER_FROM.pauseMenu,
  // the frame shown, and how far towards the next one (slow motion shows between frames)
  frame: 0,
  between: 0,
  speed: NORMAL_SPEED,
  playing: true,
  // ticks an arrow is held: -1 back, 1 forward
  heldTicks: 0,
  // how much of the race's time passed this tick (0 while it stands or winds back)
  pace: 0,
  // the race as it was when the viewer opened from it
  race: null,
};

export const lastFrame = () => raceTape.length - 1;

// the replay's own count of the race's ticks for things done once a tick (see tick.js)
let fraction = 0;

// Runs moveOn (the scenery moving on a tick) as far as the replay played on: several
// whole ticks when it plays fast, part of one in slow motion (effects.step), not at all
// while it stands. Returns whether it ran.
export const atReplayPace = (moveOn) => {
  if (viewer.pace <= 0) {
    return false;
  }
  const times = Math.max(1, Math.round(viewer.pace));
  const kept = { scale: tick.scale, fraction: tick.fraction };
  effects.step = viewer.pace / times;
  tick.scale = kept.scale * effects.step;
  for (let i = 0; i < times; i++) {
    tick.fraction = fraction;
    moveOn();
    if (fraction >= tick.scale) {
      fraction -= 1;
    }
    fraction += tick.scale;
  }
  effects.step = 1;
  Object.assign(tick, kept);
  return true;
};

// the viewer's own random numbers (a Lehmer generator), while a race waits for it
let seed = 1;
const replayRandom = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

// what a replay changes of a car that the race goes on with
const CAR_FIELDS = ["x", "y", "z", "xy", "xz", "zy", "wxz", "wzy", "fcnt"];
const RACER_FIELDS = [
  "grounded",
  "nbsq",
  "squash",
  "cntdest",
  "embos",
  "embodir",
  "embomag",
  "destnow",
  "carnchp",
  "bshft",
  "cameraHeading",
  "motionHeading",
];

const keepRace = () => ({
  cars: Array.from({ length: game.carCount }, (_, c) => ({
    car: Object.fromEntries(CAR_FIELDS.map((f) => [f, car[c][f]])),
    racer: Object.fromEntries(RACER_FIELDS.map((f) => [f, racers[c][f]])),
    mat: Float32Array.from(car[c].mat),
    // how the race dented it: later hits take as many random numbers as they dent corners
    // (none before its first hit)
    dented: racers[c].body.dvert && [...racers[c].body.dvert],
    iscar: racers[c].body.iscar,
  })),
  oncheckpoint: raceEvents.oncheckpoint,
  onlastcheck: raceEvents.onlastcheck,
  phase: game.phase,
  sim: random.sim,
  fx: random.fx,
  effects: { ...effects },
});

// The replay's own sparks, chips, dust and explosions: the race's fly on after it (and
// each takes random numbers as it flies).
const EFFECT_LISTS = [
  "sparks",
  "chips",
  "dustClouds",
  "dustBackToFront",
  "explosions",
  "explosionsBackToFront",
];
const clearEffects = () => {
  for (const list of EFFECT_LISTS) {
    effects[list] = [];
  }
  effects.sparkCount = 0;
  effects.chipCount = 0;
  effects.chipsTakenBelow = 0;
  effects.dustCount = 0;
  effects.explosionCount = 0;
};
// (a chip's texture is its car's: only its buffers are its own)
// Time wound back or jumped: what flew then cannot fly back, it goes (and comes again
// as the replay plays on).
const dropEffects = () => {
  freeChips();
  clearEffects();
};

const freeChips = () => {
  for (const chip of effects.chips) {
    for (const buffer of [chip.vbuf, chip.nbuf, chip.tbuf]) {
      if (buffer) {
        gl.deleteBuffer(buffer);
      }
    }
  }
};

const restoreRace = (race) => {
  race.cars.forEach((kept, c) => {
    Object.assign(car[c], kept.car);
    Object.assign(racers[c], kept.racer);
    car[c].mat.set(kept.mat);
    racers[c].body.alpha = BLEND.alpha;
    racers[c].body.dvert = kept.dented;
    racers[c].body.iscar = kept.iscar;
    racers[c].body.damagedVertices = true;
  });
  raceEvents.oncheckpoint = race.oncheckpoint;
  raceEvents.onlastcheck = race.onlastcheck;
  random.sim = race.sim;
  random.fx = race.fx;
  freeChips();
  Object.assign(effects, race.effects);
};

// A wreck as far burnt as it was ticks after it was wasted: it blinks for 12 ticks, then
// darkens every 5 (see burnWreck in recording.js).
const burntFor = (c, ticks) => {
  const racer = racers[c];
  racer.destnow = true;
  racer.cntdest = 7;
  if (ticks < 12) {
    racer.cntdest = Math.floor(ticks / 2);
    return;
  }
  const burns = Math.min(17, Math.floor((ticks - 12) / 5));
  for (let i = 0; i < burns; i++) {
    burn(c);
  }
  racer.cntdest += burns;
};

const lerp = (a, b, t) => a + (b - a) * t;
// angles in degrees, the short way round
const lerpAngle = (a, b, t) => {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return a + d * t;
};

// The cars where they were at the frame and between it and the next.
const pose = () => {
  const next = Math.min(viewer.frame + 1, lastFrame());
  const t = viewer.between;
  for (let c = 0; c < raceTape.cars.length; c++) {
    const tape = raceTape.cars[c];
    poseFromTape(c, tape, viewer.frame);
    // (the camera behind a car looks along it, the one beside the track waits ahead)
    racers[c].cameraHeading = lerpAngle(
      tape.cameraHeading[viewer.frame],
      tape.cameraHeading[next],
      t,
    );
    racers[c].motionHeading = racers[c].cameraHeading;
    if (t > 0) {
      for (const f of ["x", "y", "z"]) {
        car[c][f] = lerp(tape[f][viewer.frame], tape[f][next], t);
      }
      for (const f of ["xy", "xz", "zy", "wzy", "wxz"]) {
        car[c][f] = lerpAngle(tape[f][viewer.frame], tape[f][next], t);
      }
    }
    turnCarAfterItsAngles(c);
    // a wreck about to burst is stretched along one axis (see playTape)
    const racer = racers[c];
    if (racer.embodir) {
      for (let k = 0; k < 3; k++) {
        car[c].mat[racer.embodir * 4 + k] *= racer.embomag;
      }
    }
  }
  raceEvents.oncheckpoint = raceTape.checkpoint[viewer.frame];
  raceEvents.onlastcheck = raceTape.lastCheck[viewer.frame];
};

// Shows the frame: the cars dented, fixed and burnt as they were then.
export const seekReplay = (frame) => {
  const phase = game.phase;
  game.phase = PHASE.replayRewind;
  dropEffects();
  viewer.frame = Math.max(0, Math.min(lastFrame(), Math.round(frame)));
  viewer.between = 0;
  // (the hits dent the cars again without chips flying off)
  recording.frozen = true;
  resetCarsToTapeStart(
    raceTape,
    (c) => burntFor(c, viewer.frame - raceTape.cars[c].wastedAt),
    viewer.frame + 1,
  );
  recording.frozen = false;
  pose();
  game.phase = phase;
};

// whether a car was hit, fixed or wasted after frame from up to frame to
const changedBetween = (from, to) =>
  raceTape.cars.some(
    (tape) =>
      (tape.wastedAt > from && tape.wastedAt <= to) ||
      tape.hitAt.some((at) => at > from && at <= to) ||
      tape.fixAt.some((at) => at > from && at <= to),
  );

export const openReplay = (from, frame) => {
  viewer.from = from;
  viewer.race = from == VIEWER_FROM.file ? null : keepRace();
  if (viewer.race) {
    // dents drawn again, dust and sparks take random numbers: not the race's, which goes
    // on after
    random.sim = replayRandom;
    random.fx = replayRandom;
    clearEffects();
  }
  viewer.speed = NORMAL_SPEED;
  viewer.playing = true;
  viewer.heldTicks = 0;
  camera.mode = CAMERA.orbit;
  camera.target = game.player;
  game.phase = PHASE.replay;
  // (keys pressed before, in the menus, are not the viewer's)
  takePressedKeys();
  seekReplay(frame);
};

// Back to where it was opened from; a race goes on as it was.
export const closeReplay = () => {
  if (viewer.race) {
    seekReplay(lastFrame());
    restoreRace(viewer.race);
    game.phase = viewer.race.phase;
    viewer.race = null;
  }
  camera.mode = CAMERA.behind;
  camera.target = game.player;
};

export const togglePlaying = () => {
  if (!viewer.playing && viewer.frame == lastFrame()) {
    seekReplay(0);
  }
  viewer.playing = !viewer.playing;
};

export const changeSpeed = (step) => {
  viewer.speed = Math.max(0, Math.min(SPEEDS.length - 1, viewer.speed + step));
};

export const nextCamera = () => {
  camera.mode = CAMERAS[(CAMERAS.indexOf(camera.mode) + 1) % CAMERAS.length];
  // (beside the track: a new spot ahead of the car)
  camera.relocate = true;
};

// The camera flies to another car followed, from where it was (FLIGHT_TICKS long).
const FLIGHT_TICKS = 15;
const flight = { ticks: FLIGHT_TICKS, from: null };

// step 1: the next car, -1: the one before
export const nextCar = (step = 1) => {
  const count = raceTape.cars.length;
  camera.target = (camera.target + step + count) % count;
  camera.relocate = true;
  const { x, y, z, yaw, pitch } = camera;
  flight.from = { x, y, z, yaw, pitch };
  flight.ticks = 0;
};

// After the camera moved on (moveCamera): on its way from the car before, it is only
// part of the way there, faster in the middle. The free camera goes nowhere by itself.
export const flyCamera = () => {
  if (flight.ticks >= FLIGHT_TICKS || camera.mode == CAMERA.free) {
    flight.ticks = FLIGHT_TICKS;
    return;
  }
  flight.ticks++;
  const t = flight.ticks / FLIGHT_TICKS;
  const along = t * t * (3 - 2 * t);
  const { from } = flight;
  camera.x = lerp(from.x, camera.x, along);
  camera.y = lerp(from.y, camera.y, along);
  camera.z = lerp(from.z, camera.z, along);
  camera.yaw = lerpAngle(from.yaw, camera.yaw, along);
  camera.pitch = lerp(from.pitch, camera.pitch, along);
};

// The free camera: forward, side (right) and up its own way, turned by yaw and pitch
// (degrees), in this game's units.
export const moveFreeCamera = (forward, side, up, yaw, pitch) => {
  camera.yaw += yaw;
  camera.pitch = Math.max(-89, Math.min(89, camera.pitch + pitch));
  const heading = (camera.yaw * Math.PI) / 180;
  camera.x += forward * Math.sin(heading) + side * Math.cos(heading);
  camera.z += -forward * Math.cos(heading) + side * Math.sin(heading);
  camera.y = Math.max(1, camera.y + up);
};

// Plays the frames up to `to`, their events happening.
const playOn = (to) => {
  while (viewer.frame < to) {
    viewer.frame++;
    recording.frame = viewer.frame;
    playTape(raceTape, false);
  }
};

const windBack = (to) => {
  if (changedBetween(to, viewer.frame)) {
    seekReplay(to);
  } else {
    dropEffects();
    viewer.frame = to;
  }
};

// A guest's view of the host's race (see net/guest.js): on to the last frame sent.
export const followLive = () => {
  const before = viewer.frame;
  playOn(lastFrame());
  viewer.between = 0;
  viewer.pace = viewer.frame - before;
  pose();
};

// A tick of the viewer; held is -1 or 1 while an arrow is held. Returns whether the race
// moved on (and chips and sparks fly on).
export const replayViewerTick = (held) => {
  viewer.heldTicks = held ? viewer.heldTicks + 1 : 0;
  let frames = viewer.playing ? SPEEDS[viewer.speed] : 0;
  if (held && viewer.heldTicks == 1) {
    // a tap steps one frame
    frames = held;
  } else if (held && viewer.heldTicks > SCRUB_AFTER_TICKS) {
    frames = held * SCRUB_FRAMES;
  } else if (held) {
    frames = 0;
  }
  const before = viewer.frame + viewer.between;
  const at = Math.min(lastFrame(), before + frames);
  const target = Math.max(0, at);
  const whole = Math.floor(target);
  const movedOn = whole > viewer.frame;
  if (whole >= viewer.frame) {
    playOn(whole);
  } else {
    windBack(whole);
  }
  viewer.between = target - whole;
  viewer.pace = Math.max(0, target - before);
  if (viewer.frame == lastFrame()) {
    viewer.playing = false;
  }
  pose();
  return movedOn;
};
