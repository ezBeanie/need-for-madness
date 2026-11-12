import { MAX_CARS } from "../core/state.js";

// The race state of every car, one object per car (index = car number, the player drives
// car 0). Fields keep their original names for now; the ones not listed here start
// undefined, as the original per-car arrays did.
const newControl = () => ({
  up: false,
  down: false,
  left: false,
  right: false,
  handb: false,
  arrace: false,
  zyinv: false,
  // (whether the player stunts by key, see stunts in input/controls.js)
  stuntKey: false,
});

const newWheel = () => ({ x: 0, y: 0, z: 0, mat: null, dist: 0 });

// Where the car type's shadow model is drawn for this car (see shadoworks).
const newShadow = () => ({
  x: 0,
  y: 0,
  z: 0,
  shownTexture: 0,
  mat: mat4.create(),
  intershad: false,
});

const newRacer = () => ({
  // what the driver (player or AI) presses
  u: newControl(),
  // placed every tick, so cars of the same type each have their own
  wheels: Array.from({ length: 4 }, newWheel),
  shadow: newShadow(),
  // the car model it dents and scratches, its own when another car has the same type
  // (see raceCarTextures)
  body: null,
  carnchp: 0,
  wall: -1,
  colidim: false,
});

// racer.skid: how the wheels hold the ground. Sliding loses speed; on gripping again (and in
// the air) the speed is taken from how the car really moves.
export const SKID = { gripping: 0, sliding: 1, takeSpeedFromMotion: 2 };

// racer.stunt: where the car is in a stunt. A stunt starts when the stunt keys are pressed in
// the air, and after the first wheel touches down the car keeps turning upright.
export const STUNT = { none: 0, starting: 1, flying: 2, touchingDown: -1 };

// racer.missedCheckpoint: whether the car has lost the checkpoint it heads for. Other cars
// only know none and started. The player's counts the ticks of "Check Point Missed!" from
// started on (jumping ahead to comingBack when the car is back at the checkpoint) until it
// ends, then waits as warned until the car is near the checkpoint again. Following: the
// player's car follows the track's path points, no checkpoint in focus.
export const MISSED = {
  following: -1,
  none: 0,
  started: 1,
  comingBack: 68,
  ends: 70,
  warned: -2,
};

// A tick of the warning of a missed checkpoint, until it ends.
export const countMissedCheckpoint = (racer) => {
  racer.missedCheckpoint++;
  if (racer.missedCheckpoint == MISSED.ends) {
    racer.missedCheckpoint = MISSED.warned;
  }
};

// The whole loops, roll spins and half turns of a landed stunt, which naming it uses up (see
// nameStunt in ui/hud.js): the original named only the player's, and a car taking off
// again before its stunt is forgotten counts on from what is left. Racing together, the
// race uses up every human car's (see countStuntInAir), so every game counts on alike.
export const useUpStuntTurns = (racer) => {
  let loops = 0;
  while (racer.flipped > 225) {
    racer.flipped -= 360;
    loops++;
  }
  while (racer.flipped < -225) {
    racer.flipped += 360;
    loops--;
  }
  let rolls = 0;
  racer.rolled = Math.abs(racer.rolled);
  while (racer.rolled > 270) {
    racer.rolled -= 360;
    rolls++;
  }
  let degrees = 0;
  racer.spun = Math.abs(racer.spun);
  while (racer.spun > 90) {
    racer.spun -= 180;
    degrees += 180;
  }
  return {
    loops,
    rolls,
    degrees: Math.min(degrees, 900),
    beyond: degrees > 900,
  };
};

export const racers = Array.from({ length: MAX_CARS }, newRacer);

const newCar = () => ({
  typ: 0,
  x: 0,
  y: 0,
  z: 0,
  xy: 0,
  xz: 0,
  zy: 0,
  mat: null,
  grat: 0,
  keyx: [],
  keyz: [],
  wzy: 0,
  wxz: 0,
  ctxl: [],
  fcnt: 0,
});

// The car models in the race, placed by the physics every tick.
export const car = Array.from({ length: MAX_CARS }, newCar);
