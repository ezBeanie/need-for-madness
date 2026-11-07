// How the camera moves in races and replays, every tick, after camera.mode.

import { cosDeg, sinDeg } from "../core/math.js";
import { random } from "../core/random.js";
import { PHASE, game } from "../core/state.js";
import { tick } from "../core/tick.js";
import { car, racers } from "../race/racers.js";
import { CAMERA, camera } from "./camera.js";
import { resetMatrix } from "./interpolation.js";
import { sky } from "./scene.js";

export const moveCamera = () => {
  // (a wasted car is no target: the camera turns to none)
  if (camera.lockedCar >= 0 && racers[camera.lockedCar]?.wasted) {
    camera.lockedCar = -1;
  }
  if (camera.mode == CAMERA.behind) {
    followBehind();
  }
  if (camera.mode == CAMERA.orbit) {
    orbit();
  }
  if (camera.mode == CAMERA.trackside) {
    watchFromTrackside();
  }
  if (camera.mode == CAMERA.flyTo) {
    flyToNextTarget();
  }
  // the sky dome moves along and grows with the height
  sky.x = camera.x;
  sky.z = camera.z;
  const skyScale = 0.6 + camera.y / 4000;
  sky.mat = resetMatrix(sky.mat);
  sky.mat[4] *= skyScale;
  sky.mat[5] *= skyScale;
  sky.mat[6] *= skyScale;
};

// The pitch that looks from the camera (its height taken as eyeY) at a point.
const pitchTowards = (x, y, z, eyeY) => {
  const below = y - eyeY < 0 ? -180 : 0;
  const flat = Math.sqrt(
    (z - camera.z) * (z - camera.z) + (x - camera.x) * (x - camera.x),
  );
  return -(90 + below - Math.atan(flat / (y - eyeY)) / 0.017453292519943295);
};

// Behind the car, swinging around it while Z or X look back.
const followBehind = () => {
  camera.pitch = 10;
  let swing = 2 + Math.abs(camera.lookBackYaw) / 4;
  if (swing > 20) {
    swing = 20;
  }
  swing *= tick.scale;
  if (camera.lookBack != 0) {
    if (camera.lookBack == 1) {
      if (camera.lookBackYaw < 180) {
        camera.lookBackYaw += swing;
      }
      if (camera.lookBackYaw > 180) {
        camera.lookBackYaw = 180;
      }
    }
    if (camera.lookBack == -1) {
      if (camera.lookBackYaw > -180) {
        camera.lookBackYaw -= swing;
      }
      if (camera.lookBackYaw < -180) {
        camera.lookBackYaw = -180;
      }
    }
  } else if (Math.abs(camera.lookBackYaw) > swing) {
    if (camera.lookBackYaw > 0) {
      camera.lookBackYaw -= swing;
    } else {
      camera.lookBackYaw += swing;
    }
  } else if (camera.lookBackYaw != 0) {
    camera.lookBackYaw = 0;
  }
  const behindCar = racers[camera.target].cameraHeading - 180;
  turnToAimedCar(behindCar);
  const target = car[camera.target];
  const heading = behindCar + camera.aimYaw + camera.lookBackYaw;
  camera.yaw = heading;
  camera.x = target.x - 80 * sinDeg(heading);
  camera.z = target.z + 80 * cosDeg(heading);
  camera.y = target.y + 25;
};

// how much of the turn left to the aimed car the camera makes in a tick
const AIM_EASE = 0.2;

const halfTurn = (degrees) => degrees - 360 * Math.round(degrees / 360);

// The cars the target camera can turn to: the others not wasted, the nearest first.
const aimable = () => {
  const own = car[game.player];
  const distance = (c) => Math.hypot(car[c].x - own.x, car[c].z - own.z);
  const cars = [];
  for (let c = 0; c < game.carCount; c++) {
    if (c != game.player && !racers[c].wasted) {
      cars.push(c);
    }
  }
  return cars.sort((a, b) => distance(a) - distance(b) || a - b);
};

// The car the target camera turns to: the next farther one (step 1) or the next nearer
// (-1), after the farthest none.
export const lockNext = (step) => {
  const cars = [-1, ...aimable()];
  const at = Math.max(0, cars.indexOf(camera.lockedCar));
  camera.lockedCar = cars[(at + step + cars.length) % cars.length];
};

// A car chosen (in the picture), or none.
export const lockCar = (c) => {
  camera.lockedCar = aimable().includes(c) ? c : -1;
};

// Behind the player's car in a race, a car chosen: the camera turns around the car until it
// looks past it at the chosen one (the ball cam of Rocket League), and back behind the car
// once it no longer aims.
const turnToAimedCar = (behindCar) => {
  let aim = 0;
  const aimed =
    camera.lockedCar < game.carCount ? car[camera.lockedCar] : undefined;
  if (
    camera.aims &&
    aimed &&
    camera.target == game.player &&
    game.phase == PHASE.race
  ) {
    const own = car[camera.target];
    // (the camera behind a car at yaw h looks along sin h, -cos h)
    const toAimed =
      (Math.atan2(aimed.x - own.x, own.z - aimed.z) * 180) / Math.PI;
    aim = halfTurn(toAimed - behindCar);
  }
  const left = halfTurn(aim - camera.aimYaw);
  camera.aimYaw = halfTurn(
    camera.aimYaw + left * Math.min(1, AIM_EASE * tick.scale),
  );
};

// The orbit's height rises to 90 and sinks to -50, over and over.
const bobOrbit = () => {
  if (!camera.orbitDescending) {
    camera.orbitHeight += 0.2 * tick.scale;
  } else {
    camera.orbitHeight -= 0.2 * tick.scale;
  }
  if (camera.orbitHeight > 90) {
    camera.orbitDescending = true;
  }
  if (camera.orbitHeight < -50) {
    camera.orbitDescending = false;
  }
};

// Around the car; the high orbit (at the start of a race) sinks to its height, turns
// twice as fast and tilts down.
const orbit = () => {
  const target = car[camera.target];
  if (!camera.orbitHigh) {
    bobOrbit();
  } else {
    camera.orbitHeight -= 1.4 * tick.scale;
    if (camera.orbitHeight < 61.7) {
      camera.orbitHeight = 61.7;
    }
  }
  let distance = 50 + camera.orbitHeight;
  if (camera.orbitHigh && distance < 130) {
    distance = 130;
  }
  if (distance < 100) {
    distance = 100;
  }
  camera.y = target.y + camera.orbitHeight;
  if (camera.y < 5) {
    camera.orbitDescending = false;
  }
  camera.x = target.x + distance * cosDeg(camera.orbitAngle);
  camera.z = target.z + distance * sinDeg(camera.orbitAngle);
  camera.orbitAngle -= (camera.orbitHigh ? 4 : 2) * tick.scale;
  let pitch = pitchTowards(target.x, target.y, target.z, Math.max(camera.y, 0));
  camera.yaw = -(-camera.orbitAngle + 90);
  if (camera.orbitHigh) {
    pitch -= camera.orbitTilt;
    camera.orbitTilt += 0.2;
    if (camera.orbitTilt > 15) {
      camera.orbitTilt = 15;
    }
  }
  camera.pitch += (pitch - camera.pitch) / 10;
};

// From a spot beside the track ahead of the car, until the car is more than 700 away.
const watchFromTrackside = () => {
  const target = car[camera.target];
  if (camera.relocate) {
    const side = random.fx() > random.fx() ? -1 : 1;
    const heading = racers[camera.target].motionHeading;
    camera.y = target.y + 10 + 160 * random.fx();
    camera.x = target.x + 40 * side * cosDeg(heading) - 500 * sinDeg(heading);
    camera.z = target.z + 40 * side * sinDeg(heading) + 500 * cosDeg(heading);
    camera.relocate = false;
  }
  const behind = target.x - camera.x > 0 ? 180 : 0;
  let yaw = -(
    90 +
    behind +
    Math.atan((target.z - camera.z) / -(target.x - camera.x)) /
      0.017453292519943295
  );
  while (yaw < 0) {
    yaw += 360;
  }
  while (yaw > 360) {
    yaw -= 360;
  }
  camera.yaw = yaw;
  const pitch = pitchTowards(target.x, target.y, target.z, camera.y);
  camera.pitch += (pitch - camera.pitch) / 5;
  if (
    Math.sqrt(
      (target.z - camera.z) * (target.z - camera.z) +
        (target.x - camera.x) * (target.x - camera.x) +
        (target.y - camera.y) * (target.y - camera.y),
    ) > 700
  ) {
    camera.relocate = true;
  }
};

// Orbiting a point that moves from one car to another (camera.transition of 30).
const flyToNextTarget = () => {
  const from = car[camera.target];
  const to = car[camera.nextTarget];
  const between = (a, b) =>
    (a * (30 - camera.transition) + b * camera.transition) / 30;
  const x = between(from.x, to.x);
  const y = between(from.y, to.y);
  const z = between(from.z, to.z);
  bobOrbit();
  let distance = 50 + camera.orbitHeight;
  if (distance < 100) {
    distance = 100;
  }
  camera.y = y + camera.orbitHeight;
  if (camera.y < 5) {
    camera.orbitDescending = false;
  }
  camera.x = x + distance * cosDeg(camera.orbitAngle);
  camera.z = z + distance * sinDeg(camera.orbitAngle);
  camera.orbitAngle -= 2 * tick.scale;
  const pitch = pitchTowards(x, y, z, Math.max(camera.y, 0));
  camera.yaw = -(-camera.orbitAngle + 90);
  camera.pitch += (pitch - camera.pitch) / 10;
};
