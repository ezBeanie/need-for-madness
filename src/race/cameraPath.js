// A replay's camera path: keyframes, each at a moment of the race (frame, a fraction of
// one in slow motion), with the camera as it was then (its kind, the car it follows, the
// free camera's place and view, its field of view) and the speed the replay plays at from
// there. From a keyframe the path flies on to the next one or cuts to it (fly). Between
// free cameras it flies along a curve through them that never swings past a keyframe
// (monotone in each of place, view and zoom, see along); to or from a car's camera it
// glides from the free camera into that one as it follows its car, or back out of it. Two
// cars' cameras always cut. The path goes with the replay file (see screens/replays.js).

import { CAMERA, DEFAULT_FOV, camera } from "../render/camera.js";
import { SPEEDS, viewer } from "./replayViewer.js";

export const cameraPath = { keys: [], playing: false };

const MODES = Object.values(CAMERA);
// how far the camera zooms (field of view in degrees)
export const MIN_FOV = 15;
export const MAX_FOV = 100;
const POSE = ["x", "y", "z", "yaw", "pitch"];
const at = () => Math.round((viewer.frame + viewer.between) * 100) / 100;

const sorted = (keys) => [...keys].sort((a, b) => a.frame - b.frame);

// The camera as it is, at the moment shown: a keyframe there, replacing one there.
export const keyHere = () => {
  const frame = at();
  const { mode, target, x, y, z, yaw, pitch, fov } = camera;
  const key = {
    frame,
    mode,
    target,
    x,
    y,
    z,
    yaw,
    pitch,
    fov,
    speed: viewer.speed,
    fly: true,
  };
  cameraPath.keys = sorted([
    ...cameraPath.keys.filter((other) => other.frame != frame),
    key,
  ]);
  return key;
};

export const dropKey = (index) => {
  cameraPath.keys = cameraPath.keys.filter((_, i) => i != index);
  if (cameraPath.keys.length == 0) {
    cameraPath.playing = false;
  }
};

// A keyframe moved to the moment shown, replacing one there.
export const moveKey = (index) => {
  const frame = at();
  const moved = { ...cameraPath.keys[index], frame };
  cameraPath.keys = sorted([
    ...cameraPath.keys.filter((other, i) => i != index && other.frame != frame),
    moved,
  ]);
};

export const toggleFly = (index) => {
  const key = cameraPath.keys[index];
  cameraPath.keys[index] = {
    ...key,
    fly: !flies(key, cameraPath.keys[index + 1]),
  };
};

export const togglePath = () => {
  cameraPath.playing = !cameraPath.playing && cameraPath.keys.length > 0;
};

// The frame of the keyframe after the moment shown (step 1) or before it (-1), if any.
export const nextKeyFrame = (step) => {
  const now = viewer.frame + viewer.between;
  const frames = cameraPath.keys.map((key) => key.frame);
  return step > 0
    ? frames.find((frame) => frame > now + 0.001)
    : frames.findLast((frame) => frame < now - 0.001);
};

// whether keys read from a file are a path (fov and fly came later: files may lack them)
export const isPath = (keys) =>
  Array.isArray(keys) &&
  keys.every(
    (key) =>
      key != null &&
      ["frame", "x", "y", "z", "yaw", "pitch"].every((f) =>
        Number.isFinite(key[f]),
      ) &&
      (key.fov === undefined ||
        (Number.isFinite(key.fov) &&
          key.fov >= MIN_FOV &&
          key.fov <= MAX_FOV)) &&
      (key.fly === undefined || typeof key.fly == "boolean") &&
      MODES.includes(key.mode) &&
      Number.isInteger(key.target) &&
      Number.isInteger(key.speed) &&
      key.speed >= 0 &&
      key.speed < SPEEDS.length,
  );

const lerp = (a, b, t) => a + (b - a) * t;
// angles in degrees: b as near to a as it goes round
const near = (a, b) => a + ((((b - a) % 360) + 540) % 360) - 180;
const ease = (t) => t * t * (3 - 2 * t);
const fovOf = (key) => key?.fov ?? DEFAULT_FOV;

const isFree = (key) => key?.mode == CAMERA.free;
// (a path from before fly was known flies between free cameras only)
export const flies = (key, next) =>
  key != null &&
  next != null &&
  (isFree(key) || isFree(next)) &&
  (key.fly ?? (isFree(key) && isFree(next)));

// The tangent of a curve through values at times, at index i: none where the values turn
// back or at either end, else a mean of the slopes on both sides weighted by how long
// each lasts (Fritsch and Butland): the curve between never passes either keyframe.
const tangent = (times, values, i) => {
  if (i == 0 || i == values.length - 1) {
    return 0;
  }
  const h0 = times[i] - times[i - 1];
  const h1 = times[i + 1] - times[i];
  const d0 = (values[i] - values[i - 1]) / h0;
  const d1 = (values[i + 1] - values[i]) / h1;
  if (d0 * d1 <= 0) {
    return 0;
  }
  return (3 * (h0 + h1)) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
};

// The value at time t between values i and i + 1 of the curve (cubic Hermite).
const along = (times, values, i, t) => {
  const h = times[i + 1] - times[i];
  const s = (t - times[i]) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * values[i] +
    (s3 - 2 * s2 + s) * h * tangent(times, values, i) +
    (-2 * s3 + 3 * s2) * values[i + 1] +
    (s3 - s2) * h * tangent(times, values, i + 1)
  );
};

// The free keyframes key k flies along with: back and on while they fly from one to the
// next, as far as k - 1 and k + 2 (the curve's tangents need no more).
const flight = (keys, k) => {
  let first = k;
  while (first > k - 1 && flies(keys[first - 1], keys[first])) {
    first--;
  }
  let last = k + 1;
  while (last < k + 2 && flies(keys[last], keys[last + 1])) {
    last++;
  }
  return keys
    .slice(first, last + 1)
    .filter(isFree)
    .map((key) => ({ ...key, fov: fovOf(key) }));
};

// The camera at a moment of the race, as the path has it (null before its first key).
// Gliding to or from a car's camera it is that camera, toward the free one (the place and
// view there) by weight, after the car's camera moved (see blendPath).
export const cameraAt = (frame) => {
  const { keys } = cameraPath;
  let k = -1;
  while (k + 1 < keys.length && keys[k + 1].frame <= frame) {
    k++;
  }
  if (k == -1) {
    return null;
  }
  const key = keys[k];
  const next = keys[k + 1];
  if (!flies(key, next)) {
    return { ...key, fov: fovOf(key) };
  }
  const t = (frame - key.frame) / (next.frame - key.frame);
  const fov = lerp(fovOf(key), fovOf(next), ease(t));
  if (!isFree(key)) {
    return { ...key, fov, toward: next, weight: ease(t) };
  }
  if (!isFree(next)) {
    const { mode, target } = next;
    return { ...key, mode, target, fov, toward: key, weight: 1 - ease(t) };
  }
  const flown = flight(keys, k);
  const i = flown.indexOf(flown.find((other) => other.frame == key.frame));
  const times = flown.map((other) => other.frame);
  // (headings the short way round from one keyframe to the next, as at keyframe k)
  const yaws = flown.map((other) => other.yaw);
  for (let j = i + 1; j < yaws.length; j++) {
    yaws[j] = near(yaws[j - 1], yaws[j]);
  }
  for (let j = i - 1; j >= 0; j--) {
    yaws[j] = near(yaws[j + 1], yaws[j]);
  }
  const curve = (values) => along(times, values, i, frame);
  const of = (f) => flown.map((other) => other[f]);
  return {
    ...key,
    x: curve(of("x")),
    y: Math.max(1, curve(of("y"))),
    z: curve(of("z")),
    yaw: curve(yaws),
    pitch: curve(of("pitch")),
    fov: curve(of("fov")),
  };
};

// What the path has the camera do this tick, and the car's camera as it moved on its own
// the tick before while the path glides to or from it (the path's place is not its own).
let seen = null;
let carPose = null;

const poseOf = (from) => Object.fromEntries(POSE.map((f) => [f, from[f]]));

// Every tick of the viewer, before the cars' cameras move: the path's camera, while it
// plays.
export const followPath = () => {
  seen = cameraPath.playing ? cameraAt(viewer.frame + viewer.between) : null;
  if (!seen) {
    carPose = null;
    return;
  }
  viewer.speed = seen.speed;
  if (camera.mode != seen.mode || camera.target != seen.target) {
    // (beside the track: a spot of its own ahead of the car)
    camera.relocate = true;
    carPose = null;
  }
  camera.mode = seen.mode;
  camera.target = seen.target;
  camera.fov = seen.fov;
  if (seen.toward) {
    if (carPose) {
      Object.assign(camera, carPose);
    }
  } else {
    carPose = null;
  }
  if (seen.mode == CAMERA.free) {
    Object.assign(camera, poseOf(seen));
  }
};

// After the cars' cameras moved: gliding, the way from the car's camera to the free one.
export const blendPath = () => {
  if (!seen?.toward) {
    return;
  }
  carPose = poseOf(camera);
  const { toward, weight } = seen;
  camera.x = lerp(camera.x, toward.x, weight);
  camera.y = lerp(camera.y, toward.y, weight);
  camera.z = lerp(camera.z, toward.z, weight);
  camera.yaw = lerp(camera.yaw, near(camera.yaw, toward.yaw), weight);
  camera.pitch = lerp(camera.pitch, toward.pitch, weight);
};
