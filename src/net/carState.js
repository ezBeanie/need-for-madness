// The whole state of a car the physics drives on from (racers[c] and car[c]): the host
// sends the guest's car's each tick, and the guest drives its own car on from it ahead of
// the host (see prediction.js).

import { car, racers } from "../race/racers.js";

// what the physics does not drive on from: the keys (sent apart), and what is placed
// or drawn every tick
const NOT_STATE = { racer: ["u", "wheels", "shadow", "body"], car: ["mat"] };

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
});

export const restoreCarState = (c, state) => {
  restore(racers[c], state.racer, NOT_STATE.racer);
  restore(car[c], state.car, NOT_STATE.car);
};

// whether what another game sent can be a car's state
export const isCarState = (state) =>
  state != null &&
  typeof state.racer == "object" &&
  state.racer != null &&
  typeof state.car == "object" &&
  state.car != null;
