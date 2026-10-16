import { view } from "../ui/view.js";
import { resetMatrix } from "./interpolation.js";

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
  // 0 behind the car, 1 orbiting the car, 2 at the track side,
  // 3 moving from one car to another (replays)
  mode: 0,
  // index of the car the camera follows, and the car mode 3 moves to
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
  // mode 3: progress from target to nextTarget, 0..30
  transition: 0,
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
