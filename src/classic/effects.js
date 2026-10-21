// The race's effects as the original game drew them (its ContO.pdust and dsprk, and the
// chips of Plane): sparks as short lines, dust as puffs growing and fading, chips as
// flying triangles of the car's colours. What happens stays our simulation's
// (race/effects.js); only the drawing is the original's.
import { drawCamera, drawMatrix, placeModel } from "../render/interpolation.js";
import { effects } from "../race/effects.js";
import { DUST } from "../race/effects.js";
import { drawLine, fillPolygon } from "./batch.js";
import { X, Y, Z, placeSeen } from "./draw.js";
import { medium, xs, ys } from "./medium.js";

// the original's fog bands over a colour, by distance
const fogged = ([r, g, b], av) => {
  const { fogd, cfade, fade } = medium;
  for (let i = 0; i < 16; i++) {
    if (av > fade[i]) {
      r = Math.trunc((r * fogd + cfade[0]) / (fogd + 1));
      g = Math.trunc((g * fogd + cfade[1]) / (fogd + 1));
      b = Math.trunc((b * fogd + cfade[2]) / (fogd + 1));
    }
  }
  return [r, g, b];
};

const relative = (at) => [
  at.x - drawCamera.x,
  at.y - drawCamera.y,
  at.z - drawCamera.z,
];

// how far an effect is, the way objects measure it for their order (see drawObject)
const orderOf = (at) =>
  Math.trunc(Math.sqrt(Math.trunc(Math.hypot(...relative(at)) * 10)));

// A spark: a line along its flight, yellow turning orange with its age.
const drawSpark = (spark) => {
  const [x, y, z] = relative(spark);
  const step = spark.sp * 2;
  placeSeen(0, x, y, z);
  placeSeen(
    1,
    x + spark.mat[8] * step,
    y + spark.mat[9] * step,
    z + spark.mat[10] * step,
  );
  if (Z[0] < 10 && Z[1] < 10) {
    return;
  }
  // the original's three stages over our eight ticks
  const stage = Math.min(3, Math.ceil((spark.stat * 3) / 8));
  const [r, g, b] = fogged([255, 197 - 30 * stage, 0], Z[0]);
  drawLine(
    xs(X[0], Z[0]),
    ys(Y[0], Z[0]),
    xs(X[1], Z[1]),
    ys(Y[1], Z[1]),
    r,
    g,
    b,
  );
};

// how much the dust of each ground hides (sbln): road 0.2, sand 0.45, ground 0.4
const DUST_BLEND = { [DUST.road]: 0.2, [DUST.sand]: 0.45, [DUST.ground]: 0.4 };

// a fixed sequence for the puffs' ragged shapes
let shapeSeed = 11;
const shapeRandom = () => {
  shapeSeed = (shapeSeed * 16807) % 2147483647;
  return shapeSeed / 2147483647;
};

// the puff's eight corners round its middle, and how far each reaches
const CORNERS = [
  [0.9238 * 1.5, 0.3826 * 1.5],
  [0.9238 * 1.5, -0.3826 * 1.5],
  [0.3826, -0.9238],
  [-0.3826, -0.9238],
  [-0.9238 * 1.5, -0.3826 * 1.5],
  [-0.9238 * 1.5, 0.3826 * 1.5],
  [-0.3826 * 1.7, 0.9238],
  [0.3826 * 1.7, 0.9238],
];
const SX = new Float64Array(8);
const SY = new Float64Array(8);

// A dust cloud: a ragged octagon in the ground's colour mixed with white, growing and
// fading over its stages.
const drawDust = (cloud) => {
  if (!cloud.classic) {
    const reach = CORNERS.map(() => shapeRandom());
    cloud.classic = { reach };
  }
  const [x, y, z] = relative(cloud);
  placeSeen(0, x, y, z);
  if (Z[0] < 10) {
    return;
  }
  // in the original's units: the cloud's size (ours) times ten, a little ragged
  const size = cloud.mag * 18;
  for (let k = 0; k < 8; k++) {
    const r = size * (0.6 + 0.8 * cloud.classic.reach[k]);
    SX[k] = xs(X[0] + r * CORNERS[k][0], Z[0]);
    SY[k] = ys(Y[0] + r * CORNERS[k][1] - size * 0.5, Z[0]);
  }
  const white = medium.snap.map((s) =>
    Math.min(255, Math.max(0, Math.trunc(255 + 255 * (s / 100)))),
  );
  const ground = Math.floor(cloud.tx / 3);
  const kind = [DUST.road, DUST.sand, DUST.ground][ground];
  const color = fogged(
    medium.crgrnd.map((c, i) => Math.trunc((c + white[i]) / 2)),
    Z[0],
  );
  // the original's seven stages over our ten ticks
  const stage = (cloud.stg * 7) / 10;
  const blend = DUST_BLEND[kind] ?? 0.6;
  const alpha = Math.max(0, blend - stage * (blend / 8));
  fillPolygon(SX, SY, 8, ...color, Math.round(alpha * 255));
};

const shade = (c, factor) => Math.min(255, Math.trunc(c * factor));

// A chip off a car: its triangle, in one of the car's colours, darker or brighter.
const drawChip = (chip, colorOf) => {
  placeModel(chip);
  const m = drawMatrix;
  const v = chip.corners;
  for (let i = 0; i < 3; i++) {
    const [px, py, pz] = [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]];
    placeSeen(
      i,
      m[0] * px + m[4] * py + m[8] * pz + m[12],
      m[1] * px + m[5] * py + m[9] * pz + m[13],
      m[2] * px + m[6] * py + m[10] * pz + m[14],
    );
    SX[i] = xs(X[i], Z[i]);
    SY[i] = ys(Y[i], Z[i]);
  }
  if (Z[0] < 10 && Z[1] < 10 && Z[2] < 10) {
    return;
  }
  if (!chip.classic) {
    const base = colorOf(chip.cn);
    const factor = [0.7, 1, 1 / 0.7][Math.floor(shapeRandom() * 3)];
    chip.classic = base.map((c) => shade(c, factor));
  }
  fillPolygon(SX, SY, 3, ...fogged(chip.classic, Z[0]));
};

// The effects to put in the frame's order with the objects: each with its distance and
// how to draw it. colorOf(c) gives a colour of car c.
export const effectObjects = (colorOf) => {
  const objects = [];
  for (let i = 0; i < effects.sparkCount; i++) {
    const spark = effects.sparks[i];
    if (spark.stat != 0) {
      objects.push({ dist: orderOf(spark), draw: () => drawSpark(spark) });
    }
  }
  for (let i = 0; i < effects.dustCount; i++) {
    const cloud = effects.dustClouds[i];
    if (cloud.stg != 0) {
      objects.push({ dist: orderOf(cloud), draw: () => drawDust(cloud) });
    }
  }
  for (let i = 0; i < effects.chipCount; i++) {
    const chip = effects.chips[i];
    if (chip.loaded && chip.corners) {
      objects.push({
        dist: orderOf(chip),
        draw: () => drawChip(chip, colorOf),
      });
    }
  }
  return objects;
};
