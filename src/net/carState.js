// The whole state of a car the physics drives on from (racers[c] and car[c]), part of the
// race's (see raceState.js).

import { car, racers } from "../race/racers.js";

// what the physics does not drive on from: the keys (sent apart), what is placed or drawn
// every tick, the chips flying off the car, and which of a wreck's pixels burn next (a
// race computed again quietly does not burn, see lockstep.js)
const NOT_STATE = {
  racer: ["u", "wheels", "shadow", "body", "carnchp", "bshft"],
  car: ["ctxl", "mat"],
};
// The car's matrix is, but for where it is drawn (relative to the camera, see
// render/interpolation.js): the physics turns the car by the last tick's turn before it
// turns it anew.
const TURN = 12;

const copyOf = (from, skipped) => {
  const copy = {};
  for (const [key, value] of Object.entries(from)) {
    if (!skipped.includes(key)) {
      copy[key] = Array.isArray(value) ? value.slice() : value;
    }
  }
  return copy;
};

// (fields the state does not have were never set, as racers start, see racers.js)
const restore = (to, from, skipped) => {
  for (const key of Object.keys(to)) {
    if (!skipped.includes(key) && !(key in from)) {
      to[key] = undefined;
    }
  }
  for (const [key, value] of Object.entries(from)) {
    if (!skipped.includes(key)) {
      to[key] = Array.isArray(value) ? value.slice() : value;
    }
  }
};

export const copyCarState = (c) => ({
  racer: copyOf(racers[c], NOT_STATE.racer),
  car: copyOf(car[c], NOT_STATE.car),
  turn: Array.from(car[c].mat.subarray(0, TURN)),
});

// (the turn into the car's own matrix, which the drawing holds)
export const restoreCarState = (c, state) => {
  restore(racers[c], state.racer, NOT_STATE.racer);
  restore(car[c], state.car, NOT_STATE.car);
  car[c].mat.set(state.turn);
};

// whether what another game sent can be a car's state
export const isCarState = (state) =>
  state != null &&
  typeof state.racer == "object" &&
  state.racer != null &&
  typeof state.car == "object" &&
  state.car != null &&
  Array.isArray(state.turn) &&
  state.turn.length == TURN &&
  state.turn.every(Number.isFinite);
