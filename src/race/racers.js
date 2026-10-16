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
});

const newWheel = () => ({ x: 0, y: 0, z: 0, mat: null, dist: 0 });

// Where the car type's shadow model is drawn for this car (see shadoworks).
const newShadow = () => ({
  x: 0,
  y: 0,
  z: 0,
  ont: 0,
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
  // (see gamecartextures)
  body: null,
  carnchp: 0,
  wall: -1,
  colidim: false,
});

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
