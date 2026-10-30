// The guest's own car, ahead of the host: the host's ticks reach the guest a ping and a
// store late, so the guest drives its car on from the host's newest state of it with the
// keys the host has not driven yet, as the host will (the physics is the same, see
// race/physics.js). Only the car's pose comes of it: the rest of the car stays as the
// host's ticks show it, for the HUD.

import { nextFraction, tick } from "../core/tick.js";
import { predictCar } from "../race/physics.js";
import { turnCarAfterItsAngles } from "../race/recording.js";
import { car, racers } from "../race/racers.js";
import { copyCarState, restoreCarState } from "./carState.js";

const POSE = ["x", "y", "z", "xy", "xz", "zy", "wxz", "wzy"];

// own: the host's state of car c, driven up to the guest's input own.input in a tick of
// the host's fraction own.fraction; inputs: the guest's numbered inputs since.
export const predictOwnCar = (c, own, inputs) => {
  const shown = copyCarState(c);
  const fraction = tick.fraction;
  restoreCarState(c, own.state);
  tick.fraction = own.fraction;
  for (const { input, keys } of inputs) {
    if (input > own.input) {
      Object.assign(racers[c].u, keys);
      tick.fraction = nextFraction(tick.fraction);
      predictCar(c);
    }
  }
  tick.fraction = fraction;
  const pose = POSE.map((field) => car[c][field]);
  const heading = racers[c].cameraHeading;
  restoreCarState(c, shown);
  POSE.forEach((field, i) => (car[c][field] = pose[i]));
  // (the camera behind the car looks along it)
  racers[c].cameraHeading = heading;
  racers[c].motionHeading = heading;
  turnCarAfterItsAngles(c);
};
