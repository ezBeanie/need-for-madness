import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { glCalls } from "./harness/browserStubs.js";
import { startRace } from "./harness/race.js";

// The classic batch's triangles as flushBatch hands them to WebGL: x, y, depth and a
// packed colour per vertex.
const flushed = (ctx, depth) => {
  let words = null;
  glCalls.listener = (name, args) => {
    if (name === "bufferData" && args[1] instanceof Float32Array) {
      words = Float32Array.from(args[1]);
    }
  };
  ctx.flushBatch(800, 450, depth);
  glCalls.listener = null;
  return words;
};

// The colour a pixel ends up with, the triangles drawn in order, with the depth test
// (less or equal, as flushBatch sets it) or without.
const pixel = (words, x, y, depth) => {
  const colors = new Uint32Array(words.buffer);
  let color = null;
  let nearest = Infinity;
  for (let t = 0; t < words.length; t += 12) {
    const [x0, y0, z0] = [words[t], words[t + 1], words[t + 2]];
    const [x1, y1, z1] = [words[t + 4], words[t + 5], words[t + 6]];
    const [x2, y2, z2] = [words[t + 8], words[t + 9], words[t + 10]];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (area == 0) {
      continue;
    }
    const a = ((x1 - x) * (y2 - y) - (x2 - x) * (y1 - y)) / area;
    const b = ((x2 - x) * (y0 - y) - (x0 - x) * (y2 - y)) / area;
    const c = 1 - a - b;
    if (a < 0 || b < 0 || c < 0) {
      continue;
    }
    const z = a * z0 + b * z1 + c * z2;
    if (depth && z > nearest) {
      continue;
    }
    nearest = z;
    const packed = colors[t + 3];
    color = [packed & 255, (packed >> 8) & 255, (packed >> 16) & 255];
  }
  return color;
};

const classicRace = async () => {
  const game = await startRace({ stage: 1, car: 5 });
  game.key(76, true);
  game.key(76, false);
  for (let i = 0; i < 5; i++) {
    game.step();
  }
  return game;
};

const RED = [255, 0, 0];
const BLUE = [0, 0, 255];
const WHITE = [255, 255, 255];

test("in the classic look by depth a polygon drawn later but farther stays covered", async () => {
  const { ctx } = await classicRace();
  const draw = () => {
    ctx.startBatch();
    ctx.fillRect(0, 0, 800, 450, 128, 128, 128);
    ctx.startObject(900, 3000);
    // a wall slanting away to the right: its middle far, its left end near (the
    // original's order draws it first, as a tyre's side before its tread)
    const wall = [
      [100, 700, 700, 100],
      [100, 100, 300, 300],
      [900, 3000, 3000, 900],
    ];
    ctx.startPolygon(...wall, 4);
    ctx.fillPolygon(wall[0], wall[1], 4, ...RED);
    // a small square behind the wall's near end, drawn after it
    const square = [
      [150, 250, 250, 150],
      [150, 150, 250, 250],
      [1200, 1200, 1200, 1200],
    ];
    ctx.startPolygon(...square, 4);
    ctx.fillPolygon(square[0], square[1], 4, ...BLUE);
    ctx.endObject();
  };
  draw();
  expect(pixel(flushed(ctx, true), 200, 200, true)).toEqual(RED);
  // without the depth test the order alone decides, as in the original
  draw();
  expect(pixel(flushed(ctx, false), 200, 200, false)).toEqual(BLUE);
});

test("in the classic look by depth what lies in one plane shows in the original's order, outlines on top", async () => {
  const { ctx } = await classicRace();
  ctx.startBatch();
  ctx.startObject(900, 1100);
  // a door slanting away, a stripe on it and the stripe's outline
  const door = [
    [100, 700, 700, 100],
    [100, 100, 300, 300],
    [950, 1050, 1050, 950],
  ];
  ctx.startPolygon(...door, 4);
  ctx.fillPolygon(door[0], door[1], 4, ...RED);
  const stripe = [
    [100, 700, 700, 100],
    [180, 180, 220, 220],
    [950, 1050, 1050, 950],
  ];
  ctx.startPolygon(...stripe, 4);
  ctx.fillPolygon(stripe[0], stripe[1], 4, ...BLUE);
  ctx.drawPolygon(stripe[0], stripe[1], 4, ...WHITE);
  ctx.endObject();
  // a later object covers the first wherever it is
  ctx.startObject(5000, 6000);
  const far = [
    [600, 650, 650, 600],
    [150, 150, 250, 250],
    [5500, 5500, 5500, 5500],
  ];
  ctx.startPolygon(...far, 4);
  ctx.fillPolygon(far[0], far[1], 4, 0, 255, 0);
  ctx.endObject();
  const words = flushed(ctx, true);
  for (const x of [150, 400, 550]) {
    expect(pixel(words, x, 200, true)).toEqual(BLUE);
    expect(pixel(words, x, 140, true)).toEqual(RED);
    expect(pixel(words, x, 180, true)).toEqual(WHITE);
  }
  expect(pixel(words, 625, 200, true)).toEqual([0, 255, 0]);
});

test("in the classic look pieces sharing a model each draw its polygons in their own order", async () => {
  const { ctx } = await classicRace();
  const rad = ctx.parseRad(
    readFileSync("public/data/classic/maxrevenge.rad", "utf8"),
  );
  ctx.tintModel(rad, () => 0.5);
  const matrixOf = (instance) => {
    ctx.placeModel(instance);
    return Float32Array.from(ctx.drawMatrix);
  };
  const near = matrixOf(ctx.car[0]);
  const other = matrixOf(ctx.car[1]);
  const shared = {};
  const own = {};
  const alone = {};
  for (let frame = 0; frame < 3; frame++) {
    ctx.medium.frame++;
    ctx.startBatch();
    ctx.drawObject(rad, near, { sorting: shared });
    ctx.drawObject(rad, other, { sorting: own });
  }
  for (let frame = 0; frame < 3; frame++) {
    ctx.medium.frame++;
    ctx.startBatch();
    ctx.drawObject(rad, other, { sorting: alone });
  }
  expect(own.order).toEqual(alone.order);
  expect(own.order).not.toEqual(shared.order);
});

test("J switches the classic look's depth test", async () => {
  const { ctx, key } = await classicRace();
  expect(ctx.look.depth).toBe(true);
  let tested = null;
  const depthTested = () => {
    tested = false;
    glCalls.listener = (name, args) => {
      if (name === "enable" && args[0] === ctx.gl.DEPTH_TEST) {
        tested = true;
      }
    };
    ctx.drawClassicRace();
    glCalls.listener = null;
    return tested;
  };
  expect(depthTested()).toBe(true);
  key(74, true);
  key(74, false);
  expect(ctx.look.depth).toBe(false);
  expect(depthTested()).toBe(false);
});

test("in the classic look by depth the edges behind a wall the camera is close to stay hidden", async () => {
  const { ctx } = await classicRace();
  ctx.startBatch();
  // a big piece reaching from beside the camera far away
  ctx.startObject(1, 3000);
  // its back, drawn first as the farther, outlined
  const back = [
    [100, 700, 700, 100],
    [100, 100, 300, 300],
    [530, 530, 530, 530],
  ];
  ctx.startPolygon(...back, 4);
  ctx.fillPolygon(back[0], back[1], 4, ...BLUE);
  ctx.drawPolygon(back[0], back[1], 4, ...WHITE);
  // the wall before it, a few steps nearer
  const wall = [
    [50, 750, 750, 50],
    [50, 50, 350, 350],
    [500, 500, 500, 500],
  ];
  ctx.startPolygon(...wall, 4);
  ctx.fillPolygon(wall[0], wall[1], 4, ...RED);
  ctx.endObject();
  const words = flushed(ctx, true);
  // where the back's top edge lies behind the wall
  expect(pixel(words, 400, 100, true)).toEqual(RED);
});

test("in the classic look by depth what reaches past the camera is cut off, its edges straight", async () => {
  const { ctx } = await classicRace();
  const { medium } = ctx;
  // a camera looking straight ahead (towards -z), its focal length 450 pixels
  ctx.setView([1, 0, 0, 0, 0, 900 / medium.h, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0]);
  // a long strip of road below it, from far ahead to behind it
  const rad = ctx.parseRad(
    "<p>\nc(120,120,120)\np(-1000,1000,-30000)\np(1000,1000,-30000)\n" +
      "p(1000,1000,2000)\np(-1000,1000,2000)\n</p>\n",
  );
  ctx.tintModel(rad, () => 0.5);
  const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  medium.depth = true;
  medium.frame++;
  ctx.startBatch();
  ctx.drawObject(rad, matrix);
  const words = flushed(ctx, true);
  expect(words.length).toBeGreaterThan(0);
  // every corner on the screen lies on the strip's edges, which run straight from its
  // middle at 45 degrees
  for (let v = 0; v < words.length; v += 4) {
    const dx = Math.abs(words[v] - medium.cx);
    const dy = Math.abs(words[v + 1] - medium.cy);
    expect(Math.abs(dx - dy)).toBeLessThan(1);
  }
});
