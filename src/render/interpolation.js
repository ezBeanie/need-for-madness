// Drawing happens every display frame, the game logic only every logic tick. Everything
// drawn is interpolated between its state at the last two ticks. Draw instances are told
// apart by their matrix object (car[c].mat, dust[i].mat, ...), so per-tick matrices must be
// reset with resetMatrix, never recreated.
//
// The results are written into reused matrices (drawMatrix, drawCamera.projection), as the
// gl-matrix API intends: this runs for every drawn object at the display refresh rate.

import { distance } from "../core/math.js";

// tick: logic ticks so far, alpha: how far the display frame is past the last tick (0..1),
// frame: display frames so far, states: what interpolation knows per draw instance.
export const interpolation = {
  tick: 0,
  alpha: 1,
  frame: 0,
  states: new WeakMap(),
};

// The model matrix for the instance just placed, relative to the drawn camera.
export const drawMatrix = mat4.create();

// The camera to draw with: position and projection-view matrix.
export const drawCamera = { x: 0, y: 0, z: 0, projection: mat4.create() };

// Moves further than this between two ticks are teleports (reset, reused particle, camera cut).
const TELEPORT_DISTANCE = 300;
// Turning further than 90 degrees within one tick is a flip back onto the wheels, not a motion.
const MIN_TURN_DOT = Math.cos(Math.PI / 4);
// A camera matrix element changing more than this within one tick is a cut, not a pan.
const CAMERA_CUT = 0.5;

const liveCamera = { x: 0, y: 0, z: 0 };
let cameraTicks = { tick: -1, previous: null, current: null };

const scratch = {
  rotation: quat.create(),
  scale: vec3.create(),
  position: vec3.create(),
  parentNow: mat4.create(),
  parentDrawn: mat4.create(),
};

// Most matrices are rotations (rigid, possibly scaled and mirrored) and are interpolated
// as such. Others, like car shadows projected onto a slope, are interpolated element-wise.
const snapshot = (x, y, z, mat) => {
  const scale = mat4.getScaling(vec3.create(), mat);
  const unscaled = mat4.clone(mat);
  for (let column = 0; column < 3; column++) {
    for (let row = 0; row < 3; row++) {
      unscaled[column * 4 + row] /= scale[column] || 1;
    }
  }
  let rigid = true;
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    const dot =
      unscaled[i * 4] * unscaled[j * 4] +
      unscaled[i * 4 + 1] * unscaled[j * 4 + 1] +
      unscaled[i * 4 + 2] * unscaled[j * 4 + 2];
    if (Math.abs(dot) > 0.01) {
      rigid = false;
    }
  }
  const mirrored = mat4.determinant(unscaled) < 0;
  if (mirrored) {
    unscaled[8] = -unscaled[8];
    unscaled[9] = -unscaled[9];
    unscaled[10] = -unscaled[10];
  }
  return {
    x,
    y,
    z,
    matrix: new Float32Array(mat),
    rigid,
    mirrored,
    rotation: mat4.getRotation(quat.create(), unscaled),
    scale,
  };
};

const rigidPair = (from, to) =>
  from.rigid && to.rigid && from.mirrored == to.mirrored;

// Whether the change between two tick states is a motion and not a jump.
const isMotion = (from, to) => {
  if (distance(from.x, to.x, from.y, to.y, from.z, to.z) >= TELEPORT_DISTANCE) {
    return false;
  }
  if (rigidPair(from, to)) {
    return Math.abs(quat.dot(from.rotation, to.rotation)) > MIN_TURN_DOT;
  }
  for (let i = 0; i < 11; i++) {
    if (i % 4 != 3 && Math.abs(to.matrix[i] - from.matrix[i]) > 1) {
      return false;
    }
  }
  return true;
};

const entryOf = (mat) => {
  const existing = interpolation.states.get(mat);
  if (existing) {
    return existing;
  }
  const entry = {
    tick: -1,
    previous: null,
    current: null,
    moving: false,
    parent: null,
    parentFrame: -1,
  };
  interpolation.states.set(mat, entry);
  return entry;
};

// The latest two tick states of one draw instance, recorded the first time it is drawn
// after a tick.
const ticksOf = (instance) => {
  const entry = entryOf(instance.mat);
  if (entry.tick != interpolation.tick) {
    const previous = entry.current;
    const current = snapshot(instance.x, instance.y, instance.z, instance.mat);
    entry.moving =
      previous !== null &&
      entry.tick == interpolation.tick - 1 &&
      isMotion(previous, current);
    entry.previous = previous;
    entry.current = current;
    entry.tick = interpolation.tick;
  }
  return entry;
};

// The world matrix of a tick state, or of the state between two ticks.
const matrixBetween = (out, from, to, alpha) => {
  const position = scratch.position;
  position[0] = from.x + (to.x - from.x) * alpha;
  position[1] = from.y + (to.y - from.y) * alpha;
  position[2] = from.z + (to.z - from.z) * alpha;
  if (!rigidPair(from, to)) {
    for (let i = 0; i < 12; i++) {
      out[i] = from.matrix[i] + (to.matrix[i] - from.matrix[i]) * alpha;
    }
    out[12] = position[0];
    out[13] = position[1];
    out[14] = position[2];
    out[15] = 1;
    return out;
  }
  quat.slerp(scratch.rotation, from.rotation, to.rotation, alpha);
  vec3.lerp(scratch.scale, from.scale, to.scale, alpha);
  mat4.fromRotationTranslationScale(
    out,
    scratch.rotation,
    position,
    scratch.scale,
  );
  if (to.mirrored) {
    out[8] = -out[8];
    out[9] = -out[9];
    out[10] = -out[10];
  }
  return out;
};

export const resetMatrix = (mat) => (mat ? mat4.identity(mat) : mat4.create());

// Wheels must not be interpolated on their own: a car rotating fast would pull them
// inwards. An attached instance is drawn where it sits on its interpolated parent.
// Holds for the current display frame.
export const attachTo = (childMatrix, parent) => {
  const entry = entryOf(childMatrix);
  entry.parent = parent;
  entry.parentFrame = interpolation.frame;
};

// Fills drawMatrix with the model matrix to draw instance with (x, y, z and mat).
export const placeModel = (instance) => {
  // what the game logic finds in the matrix afterwards (the HUD reads it), as before
  instance.mat[12] = instance.x - liveCamera.x;
  instance.mat[13] = instance.y - liveCamera.y;
  instance.mat[14] = instance.z - liveCamera.z;
  mat4.copy(drawMatrix, instance.mat);
  drawMatrix[12] = instance.x;
  drawMatrix[13] = instance.y;
  drawMatrix[14] = instance.z;
  const entry = ticksOf(instance);
  const alpha = interpolation.alpha;
  if (alpha < 1) {
    if (entry.parent && entry.parentFrame == interpolation.frame) {
      const parent = ticksOf(entry.parent);
      if (parent.moving) {
        const { parentNow, parentDrawn } = scratch;
        matrixBetween(parentNow, parent.current, parent.current, 0);
        matrixBetween(parentDrawn, parent.previous, parent.current, alpha);
        mat4.invert(parentNow, parentNow);
        mat4.multiply(drawMatrix, parentNow, drawMatrix);
        mat4.multiply(drawMatrix, parentDrawn, drawMatrix);
      }
    } else {
      const current = entry.current;
      const moved =
        current.x != instance.x ||
        current.y != instance.y ||
        current.z != instance.z;
      if (entry.moving && !moved) {
        matrixBetween(drawMatrix, entry.previous, current, alpha);
      }
    }
  }
  drawMatrix[12] -= drawCamera.x;
  drawMatrix[13] -= drawCamera.y;
  drawMatrix[14] -= drawCamera.z;
};

const isCameraCut = (from, to) =>
  from.matrix.some((value, i) => Math.abs(to.matrix[i] - value) > CAMERA_CUT);

// Sets drawCamera between the last two ticks' cameras (x, y, z and projection-view matrix).
export const placeCamera = (x, y, z, matrix) => {
  liveCamera.x = x;
  liveCamera.y = y;
  liveCamera.z = z;
  if (!matrix) {
    return;
  }
  if (cameraTicks.tick != interpolation.tick) {
    cameraTicks = {
      tick: interpolation.tick,
      previous:
        cameraTicks.tick == interpolation.tick - 1 ? cameraTicks.current : null,
      current: { x, y, z, matrix: mat4.clone(matrix) },
    };
  }
  const { previous, current } = cameraTicks;
  const alpha = interpolation.alpha;
  if (
    !previous ||
    alpha >= 1 ||
    distance(
      previous.x,
      current.x,
      previous.y,
      current.y,
      previous.z,
      current.z,
    ) > TELEPORT_DISTANCE ||
    isCameraCut(previous, current)
  ) {
    drawCamera.x = x;
    drawCamera.y = y;
    drawCamera.z = z;
    mat4.copy(drawCamera.projection, matrix);
    return;
  }
  drawCamera.x = previous.x + (current.x - previous.x) * alpha;
  drawCamera.y = previous.y + (current.y - previous.y) * alpha;
  drawCamera.z = previous.z + (current.z - previous.z) * alpha;
  for (let i = 0; i < 16; i++) {
    drawCamera.projection[i] =
      previous.matrix[i] + (current.matrix[i] - previous.matrix[i]) * alpha;
  }
};
