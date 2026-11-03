// The car presented turning in the middle of the car select and of the race end (the car
// a stage unlocked).

import { rotateAxes } from "../core/math.js";
import { placeWheel } from "../render/wheels.js";
import { carModels, showcaseWheels } from "../render/scene.js";

export const SHOWCASE = { hovering: 0, droppingIn: 1, flyingOut: 2 };

// It hovers up and down, drops in and flies out (motion, see SHOWCASE).
export const showcase = {
  height: 100,
  // 1 rising, 2 and up resting at the top, 0 sinking, -1 and down resting at the bottom
  bob: 0,
  dropSpeed: 0,
  motion: SHOWCASE.droppingIn,
  // its turn about the upright axis, in degrees
  spin: 0,
  // nose up or down, in degrees: it somersaults out of the car select and rocks in the
  // race end
  pitch: 0,
};

// Turns the presented car of the given type after showcase.spin and pitch (or the given
// ones), and puts its wheels on.
export const poseShowcaseCar = (
  type,
  spin = showcase.spin,
  pitch = showcase.pitch,
) => {
  const body = carModels[type];
  const across = [1, 0, 0];
  const up = [0, 1, 0];
  const along = [0, 0, 1];
  rotateAxes(up, along, pitch);
  rotateAxes(across, along, spin);
  body.mat[0] = across[0];
  body.mat[1] = up[0];
  body.mat[2] = along[0];
  body.mat[4] = across[1];
  body.mat[5] = up[1];
  body.mat[6] = along[1];
  body.mat[8] = across[2];
  body.mat[9] = up[2];
  body.mat[10] = along[2];
  showcaseWheels[type].forEach((wheel, index) => {
    placeWheel(wheel, body, type, index);
  });
};
