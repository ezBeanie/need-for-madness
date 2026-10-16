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

const newRacer = () => ({
  // what the driver (player or AI) presses
  u: newControl(),
  carnchp: 0,
  wall: -1,
  colidim: false,
});

// The original game always had seven slots.
export const racers = Array.from({ length: 7 }, newRacer);

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
export const car = Array.from({ length: 7 }, newCar);
