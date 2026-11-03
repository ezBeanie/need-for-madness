// Racing together, a race gone back and run again with others' right keys (see
// net/lockstep.js) puts their cars somewhere else at once: in the air, keys guessed wrong
// for a few frames turn a car one way and back. Drawn, each car keeps where it was seen
// and eases to where it is now; the race itself is not touched.

import { game } from "../core/state.js";
import { car } from "../race/racers.js";
import { camera } from "./camera.js";
import { interpolation } from "./interpolation.js";

// how fast a correction fades: to a third in this many ms
const FADE_MS = 90;
// a car moved farther than this was put somewhere (fixed, reset), not corrected
const JUMP = 300;

// per car, how far it is drawn from where it is: an offset and a turn about its middle
const corrections = [];
// per car, where it was drawn before the race went back
const seen = [];
let lastFade = 0;

const rotationOf = (mat) =>
  quat.normalize(quat.create(), mat4.getRotation(quat.create(), mat));

// Before the race goes back: where each car is drawn now.
export const noteBeforeRollback = () => {
  for (let c = 0; c < game.carCount; c++) {
    const correction = corrections[c];
    const rotation = rotationOf(car[c].mat);
    if (correction) {
      quat.multiply(rotation, correction.turn, rotation);
    }
    seen[c] = {
      x: car[c].x + (correction?.x ?? 0),
      y: car[c].y + (correction?.y ?? 0),
      z: car[c].z + (correction?.z ?? 0),
      rotation,
    };
  }
};

// After it ran the frames again: each car drawn from there, easing to where it is.
export const noteAfterRollback = () => {
  for (let c = 0; c < game.carCount; c++) {
    const before = seen[c];
    if (!before) {
      continue;
    }
    const x = before.x - car[c].x;
    const y = before.y - car[c].y;
    const z = before.z - car[c].z;
    if (Math.hypot(x, y, z) > JUMP) {
      corrections[c] = null;
      continue;
    }
    const turn = quat.invert(quat.create(), rotationOf(car[c].mat));
    quat.multiply(turn, before.rotation, turn);
    corrections[c] = { x, y, z, turn };
  }
  seen.length = 0;
};

const NO_TURN = quat.create();

// Every display frame: the corrections fade.
export const fadeCorrections = (now = performance.now()) => {
  const fade = Math.exp(-(now - lastFade) / FADE_MS);
  lastFade = now;
  corrections.forEach((correction, c) => {
    if (!correction) {
      return;
    }
    correction.x *= fade;
    correction.y *= fade;
    correction.z *= fade;
    quat.slerp(correction.turn, NO_TURN, correction.turn, fade);
    if (
      Math.hypot(correction.x, correction.y, correction.z) < 0.01 &&
      Math.abs(quat.dot(correction.turn, NO_TURN)) > 1 - 1e-7
    ) {
      corrections[c] = null;
    }
  });
};

export const forgetCorrections = () => {
  corrections.length = 0;
  seen.length = 0;
};

const scratch = {
  matrix: mat4.create(),
  turned: mat4.create(),
};

// The car whose model (or wheel, on parent) is drawn with matrix: moved by its
// correction, turned about the car's middle.
interpolation.correct = (matrix, instance, parent) => {
  const mat = (parent ?? instance).mat;
  let c = 0;
  while (c < game.carCount && car[c].mat !== mat) {
    c++;
  }
  const correction = corrections[c];
  if (c == game.carCount || !correction) {
    return;
  }
  const { x, y, z } = car[c];
  const { matrix: shift, turned } = scratch;
  mat4.fromTranslation(shift, [-x, -y, -z]);
  mat4.multiply(matrix, shift, matrix);
  mat4.fromQuat(turned, correction.turn);
  mat4.multiply(matrix, turned, matrix);
  mat4.fromTranslation(shift, [
    x + correction.x,
    y + correction.y,
    z + correction.z,
  ]);
  mat4.multiply(matrix, shift, matrix);
};

// The camera following a car moves with its correction.
interpolation.cameraShift = () => corrections[camera.target] ?? null;
