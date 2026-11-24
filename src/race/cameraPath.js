// A replay's camera path: keyframes, each at a moment of the race (frame, a fraction of
// one in slow motion), with the camera as it was then (its kind, the car it follows, and
// the free camera's place and view) and the speed the replay plays at from there. Played,
// a free camera's keyframe flies on to the next free one along a smooth curve through
// them (Catmull-Rom); any other kind cuts to that camera. The path goes with the replay
// file (see screens/replays.js).

import { CAMERA, camera } from "../render/camera.js";
import { SPEEDS, viewer } from "./replayViewer.js";

export const cameraPath = { keys: [], playing: false };

const MODES = Object.values(CAMERA);
const at = () => Math.round((viewer.frame + viewer.between) * 100) / 100;

// The camera as it is, at the moment shown: a keyframe there, replacing one there.
export const keyHere = () => {
  const frame = at();
  const { mode, target, x, y, z, yaw, pitch } = camera;
  const key = { frame, mode, target, x, y, z, yaw, pitch, speed: viewer.speed };
  cameraPath.keys = [
    ...cameraPath.keys.filter((other) => other.frame != frame),
    key,
  ].sort((a, b) => a.frame - b.frame);
  return key;
};

export const dropKey = (index) => {
  cameraPath.keys = cameraPath.keys.filter((_, i) => i != index);
  if (cameraPath.keys.length == 0) {
    cameraPath.playing = false;
  }
};

export const togglePath = () => {
  cameraPath.playing = !cameraPath.playing && cameraPath.keys.length > 0;
};

// whether keys read from a file are a path
export const isPath = (keys) =>
  Array.isArray(keys) &&
  keys.every(
    (key) =>
      key != null &&
      ["frame", "x", "y", "z", "yaw", "pitch"].every((f) =>
        Number.isFinite(key[f]),
      ) &&
      MODES.includes(key.mode) &&
      Number.isInteger(key.target) &&
      Number.isInteger(key.speed) &&
      key.speed >= 0 &&
      key.speed < SPEEDS.length,
  );

const lerp = (a, b, t) => a + (b - a) * t;
// angles in degrees, the short way round
const towards = (a, b) => {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return a + d;
};

// through p1 at t 0 and p2 at t 1, leaving and coming in the way p0 and p3 lie
const catmullRom = (p0, p1, p2, p3, t) =>
  0.5 *
  (2 * p1 +
    (p2 - p0) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

const isFree = (key) => key?.mode == CAMERA.free;

// The camera at a moment of the race, as the path has it (null before its first key).
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
  if (!isFree(key) || !isFree(next)) {
    return { ...key };
  }
  const before = isFree(keys[k - 1]) ? keys[k - 1] : key;
  const after = isFree(keys[k + 2]) ? keys[k + 2] : next;
  const t = (frame - key.frame) / (next.frame - key.frame);
  const along = (f) => catmullRom(before[f], key[f], next[f], after[f], t);
  return {
    ...key,
    x: along("x"),
    y: Math.max(1, along("y")),
    z: along("z"),
    yaw: lerp(key.yaw, towards(key.yaw, next.yaw), t),
    pitch: lerp(key.pitch, next.pitch, t),
  };
};

// Every tick of the viewer, after the camera moved: the path's camera, while it plays.
export const followPath = () => {
  if (!cameraPath.playing) {
    return;
  }
  const seen = cameraAt(viewer.frame + viewer.between);
  if (!seen) {
    return;
  }
  viewer.speed = seen.speed;
  camera.mode = seen.mode;
  camera.target = seen.target;
  if (seen.mode == CAMERA.free) {
    camera.x = seen.x;
    camera.y = seen.y;
    camera.z = seen.z;
    camera.yaw = seen.yaw;
    camera.pitch = seen.pitch;
  }
};
