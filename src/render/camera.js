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
