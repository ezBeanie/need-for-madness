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
  expect(between.yaw).toBeGreaterThan(350);
  expect(between.yaw).toBeLessThan(370);
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

test("a path flies past keyframes close together without swinging back beyond them", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  const { CAMERA } = await import("../src/render/camera.js");
  const path = await import("../src/race/cameraPath.js");
  FREE = CAMERA.free;
  // (a long way, then two keyframes a moment apart, then a long hold in place)
  path.cameraPath.keys = [
    freeKey(0, 0, 0),
    freeKey(100, 1000, 0),
    freeKey(102, 1010, 90),
    freeKey(200, 1010, 90),
  ];
  const xs = [];
  const yaws = [];
  for (let frame = 0; frame <= 200; frame += 0.25) {
    const seen = path.cameraAt(frame);
    xs.push(seen.x);
    yaws.push(seen.yaw);
  }
  // never back, never past the last place nor the last heading
  for (let i = 1; i < xs.length; i++) {
    expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] - 1e-9);
    expect(yaws[i]).toBeGreaterThanOrEqual(yaws[i - 1] - 1e-9);
  }
  expect(Math.max(...xs)).toBeLessThanOrEqual(1010 + 1e-9);
  expect(Math.max(...yaws)).toBeLessThanOrEqual(90 + 1e-9);
  // (the old curve went past: x over 1010 after the close pair)
  ctx.raceEvents.countdown = 0;
});

test("a path glides into a car's camera and out of it, zooms between keyframes, and cuts where asked", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  const { CAMERA } = await import("../src/render/camera.js");
  const path = await import("../src/race/cameraPath.js");
  FREE = CAMERA.free;
  const behind = (frame) => ({
    ...freeKey(frame, 0, 0),
    mode: CAMERA.behind,
    target: 1,
    fly: true,
  });
  path.cameraPath.keys = [
    { ...freeKey(10, 0, 0), fov: 30, fly: true },
    { ...behind(20), fov: 60 },
    { ...freeKey(30, 500, 0), fly: true },
  ];
  // into the car's camera: that camera, all the free one's at first, none at the end
  const into = path.cameraAt(10);
  expect(into).toMatchObject({ mode: CAMERA.behind, target: 1, weight: 1 });
  expect(into.toward.x).toBe(0);
  expect(into.fov).toBe(30);
  const half = path.cameraAt(15);
  expect(half.weight).toBeCloseTo(0.5, 5);
  expect(half.fov).toBeCloseTo(45, 5);
  // out of it again, toward the free camera ahead
  const out = path.cameraAt(27.5);
  expect(out).toMatchObject({ mode: CAMERA.behind });
  expect(out.toward.x).toBe(500);
  expect(out.weight).toBeGreaterThan(0.5);
  expect(path.cameraAt(30)).toMatchObject({ mode: CAMERA.free, x: 500 });
  // cut instead: the car's camera from the start, held to the next keyframe
  path.toggleFly(0);
  expect(path.flies(...path.cameraPath.keys.slice(0, 2))).toBe(false);
  expect(path.cameraAt(15)).toMatchObject({ mode: CAMERA.free, x: 0 });
  expect(path.cameraAt(15).toward).toBeUndefined();
  // two cars' cameras always cut
  expect(path.flies(behind(1), behind(2))).toBe(false);
  // (files with fov and fly, and without)
  expect(path.isPath(path.cameraPath.keys)).toBe(true);
  expect(path.isPath([{ ...freeKey(1, 0, 0), fov: 500 }])).toBe(false);
  expect(path.isPath([{ ...freeKey(1, 0, 0), fly: "yes" }])).toBe(false);
  ctx.raceEvents.countdown = 0;
});

test("the free camera glides along the path into the car's camera as it follows its car", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  const { CAMERA, camera } = await import("../src/render/camera.js");
  const { moveCamera } = await import("../src/render/cameraMoves.js");
  const { car } = await import("../src/race/racers.js");
  const { viewer } = await import("../src/race/replayViewer.js");
  const path = await import("../src/race/cameraPath.js");
  FREE = CAMERA.free;
  path.cameraPath.keys = [
    { ...freeKey(10, 5000, 0), fly: true },
    { ...freeKey(20, 0, 0), mode: CAMERA.behind, target: 0 },
  ];
  path.cameraPath.playing = true;
  const placeAt = (frame) => {
    Object.assign(viewer, { frame, between: 0 });
    path.followPath();
    moveCamera();
    path.blendPath();
    return camera.x;
  };
  // (the car's camera stays near its car, the free one far off)
  const near = Math.abs(placeAt(20) - car[0].x);
  expect(near).toBeLessThan(100);
  expect(placeAt(10)).toBeCloseTo(5000, 5);
  const between = placeAt(15);
  expect(between).toBeLessThan(5000);
  expect(between).toBeGreaterThan(car[0].x + 100);
  path.cameraPath.playing = false;
  ctx.raceEvents.countdown = 0;
});

test("keyframes move to where the replay is, and the replay jumps from one to the next", async () => {
  await startRace({ stage: 1, car: 5 });
  const { CAMERA } = await import("../src/render/camera.js");
  const { viewer } = await import("../src/race/replayViewer.js");
  const path = await import("../src/race/cameraPath.js");
  FREE = CAMERA.free;
  path.cameraPath.keys = [
    freeKey(10, 1, 0),
    freeKey(20, 2, 0),
    freeKey(30, 3, 0),
  ];
  Object.assign(viewer, { frame: 20, between: 0 });
  expect(path.nextKeyFrame(1)).toBe(30);
  expect(path.nextKeyFrame(-1)).toBe(10);
  viewer.frame = 31;
  expect(path.nextKeyFrame(1)).toBeUndefined();
  // moved past another, and onto one: the one there goes
  viewer.frame = 25;
  path.moveKey(0);
  expect(path.cameraPath.keys.map(({ frame, x }) => [frame, x])).toEqual([
    [20, 2],
    [25, 1],
    [30, 3],
  ]);
  viewer.frame = 30;
  path.moveKey(1);
  expect(path.cameraPath.keys.map(({ frame, x }) => [frame, x])).toEqual([
    [20, 2],
    [30, 1],
  ]);
});
