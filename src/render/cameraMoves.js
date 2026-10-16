// How the camera moves in races and replays, every tick, after camera.mode.

import { cosDeg, sinDeg } from "../core/math.js";
import { random } from "../core/random.js";
import { tick } from "../core/tick.js";
import { car, racers } from "../race/racers.js";
import { CAMERA, camera } from "./camera.js";
import { resetMatrix } from "./interpolation.js";
import { sky } from "./scene.js";

export const moveCamera = () => {
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
  const target = car[camera.target];
  const heading = racers[camera.target].cxz - 180 + camera.lookBackYaw;
  camera.yaw = heading;
  camera.x = target.x - 80 * sinDeg(heading);
  camera.z = target.z + 80 * cosDeg(heading);
  camera.y = target.y + 25;
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
    const heading = racers[camera.target].mxz;
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
