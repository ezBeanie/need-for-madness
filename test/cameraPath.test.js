import { expect, test } from "vitest";
import { startRace } from "./harness/race.js";

// (the free camera's mode, from the game: see each test)
let FREE = null;
const freeKey = (frame, x, yaw) => ({
  frame,
  mode: FREE,
  target: 0,
  x,
  y: 50,
  z: 0,
  yaw,
  pitch: 10,
  speed: 2,
});

test("a camera path keeps the camera at its keyframes, flies smoothly between free ones and cuts to the others", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  const { CAMERA } = await import("../src/render/camera.js");
  const path = await import("../src/race/cameraPath.js");
  FREE = CAMERA.free;
  path.cameraPath.keys = [
    freeKey(10, 0, 350),
    freeKey(20, 100, 10),
    freeKey(30, 300, 30),
    { ...freeKey(40, 0, 0), mode: CAMERA.behind, target: 2, speed: 0 },
  ];
  // (before the first, none)
  expect(path.cameraAt(5)).toBe(null);
  // at a keyframe, as it was there
  expect(path.cameraAt(20)).toMatchObject({ x: 100, yaw: 10 });
  // between, along the way, the shorter way round
  const between = path.cameraAt(15);
  expect(between.x).toBeGreaterThan(0);
  expect(between.x).toBeLessThan(100);
  expect(between.yaw).toBeCloseTo(360, 5);
  // the curve: no corner at a keyframe (as fast just before as just after)
  const step = 0.01;
  const before = path.cameraAt(20).x - path.cameraAt(20 - step).x;
  const after = path.cameraAt(20 + step).x - path.cameraAt(20).x;
  expect(after / before).toBeCloseTo(1, 1);
  // a car's camera cuts in, and holds
  expect(path.cameraAt(40)).toMatchObject({ mode: CAMERA.behind, target: 2 });
  expect(path.cameraAt(35).mode).toBe(CAMERA.free);
  expect(path.cameraAt(55)).toMatchObject({ mode: CAMERA.behind, speed: 0 });
  // (keys from a file, checked)
  expect(path.isPath(path.cameraPath.keys)).toBe(true);
  expect(path.isPath([{ ...freeKey(1, 0, 0), mode: 99 }])).toBe(false);
  expect(path.isPath("keys")).toBe(false);
  ctx.raceEvents.countdown = 0;
});

test("a keyframe takes the camera as it is where the replay is, replacing one there", async () => {
  await startRace({ stage: 1, car: 5 });
  const { CAMERA, camera } = await import("../src/render/camera.js");
  const { viewer } = await import("../src/race/replayViewer.js");
  const path = await import("../src/race/cameraPath.js");
  path.cameraPath.keys = [];
  Object.assign(viewer, { frame: 12, between: 0.5, speed: 1 });
  Object.assign(camera, {
    mode: CAMERA.free,
    x: 7,
    y: 8,
    z: 9,
    yaw: 45,
    pitch: 5,
  });
  path.keyHere();
  camera.x = 70;
  path.keyHere();
  viewer.frame = 2;
  path.keyHere();
  expect(path.cameraPath.keys.map(({ frame, x }) => [frame, x])).toEqual([
    [2.5, 70],
    [12.5, 70],
  ]);
  expect(path.cameraPath.keys[1]).toMatchObject({ y: 8, yaw: 45, speed: 1 });
  path.togglePath();
  expect(path.cameraPath.playing).toBe(true);
  path.dropKey(0);
  path.dropKey(0);
  expect(path.cameraPath.playing).toBe(false);
});
