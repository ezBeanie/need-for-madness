import { loadSetting, saveSetting } from "../core/storage.js";
import { view } from "../ui/view.js";
import { resetMatrix } from "./interpolation.js";

// The camera's modes: behind the car, orbiting it, watching from the track side, moving
// from one car to another (replays), and free (moved by the switch screen itself).
export const CAMERA = { free: -1, behind: 0, orbit: 1, trackside: 2, flyTo: 3 };

// The camera, as the game logic moves it every tick (drawing interpolates it, see
// interpolation.js).
export const camera = {
  x: 0,
  y: 0,
  z: 0,
  // heading and pitch in degrees
  yaw: -90,
  pitch: 30,
  // projection and view in one matrix
  matrix: null,
  // see CAMERA
  mode: 0,
  // index of the car the camera follows, and the car flyTo moves to
  target: 0,
  nextTarget: 0,
  // -1/1 while Z/X swing the camera behind the car, and how far it swung
  lookBack: 0,
  lookBackYaw: 0,
  // orbit: angle around the car, height (rising until 90, sinking until -50),
  // a higher and faster orbit, and how much that one tilts down
  orbitAngle: 0,
  orbitHeight: 50,
  orbitDescending: false,
  orbitHigh: false,
  orbitTilt: 0,
  // track side: find a new spot ahead of the car
  relocate: false,
  // flyTo: progress from target to nextTarget, 0..30
  transition: 0,
  // behind: whether the camera turns to the car the arrow points at (T), that car (-1
  // while the arrow points along the track) and how far the camera has turned from
  // behind the car towards it
  aims: false,
  aimedCar: -1,
  aimYaw: 0,
};

export const loadAiming = () => {
  camera.aims = loadSetting("targetCamera") == 1;
};

export const toggleAiming = () => {
  camera.aims = !camera.aims;
  saveSetting("targetCamera", camera.aims ? 1 : 0);
};

// Where a point is heard from the camera: how far, and how far to the side (-1 left,
// 1 right), after the camera's heading.
export const heardFrom = (x, z) => {
  const dx = x - camera.x;
  const dz = z - camera.z;
  const distance = Math.hypot(dx, dz);
  const heading = (camera.yaw * Math.PI) / 180;
  const right = dx * Math.cos(heading) + dz * Math.sin(heading);
  return { distance, side: distance ? right / distance : 0 };
};

// A fresh projection with a field of view of 55 degrees; the camera's turns follow it.
export const startProjection = () => {
  camera.matrix = mat4.create();
  mat4.perspective(camera.matrix, (55 * Math.PI) / 180, view.aspect, 0.1, 7000);
};

// Turns a flat model (a sprite) to face the camera.
export const faceCamera = (model) => {
  model.mat = resetMatrix(model.mat);
  mat4.rotate(model.mat, model.mat, camera.yaw * (Math.PI / 180), [0, -1, 0]);
  mat4.rotate(model.mat, model.mat, camera.pitch * (Math.PI / 180), [-1, 0, 0]);
};

// Turns the view after the camera's pitch and yaw.
export const turnView = () => {
  mat4.rotate(
    camera.matrix,
    camera.matrix,
    camera.pitch * (Math.PI / 180),
    [1, 0, 0],
  );
  mat4.rotate(
    camera.matrix,
    camera.matrix,
    camera.yaw * (Math.PI / 180),
    [0, 1, 0],
  );
};
