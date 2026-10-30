// The stage's surfaces the original laid the cars' shadows on (its Trackers): the
// <track> boxes of the pieces' models (and the rock piles' made like the original's),
// placed and turned with the pieces, in our units. A shadow lies on them, flat or
// sloped like a ramp, in the colour of the one under each polygon's middle darkened
// (see drawShadow in draw.js).
import { cosDeg, sinDeg, snapOf } from "./medium.js";

const surfaces = [];

// the original's tan: sin over the cosine as sin(90 - a)
const tanDeg = (a) => sinDeg(a) / sinDeg(90 - a);

// Places the surfaces of the stage's pieces; radOf: a piece's model. Walls (turned up
// 90 degrees) and the boxes of rady 801 take no shadow, as in the original.
export const placeSurfaces = (stagePieces, radOf) => {
  surfaces.length = 0;
  for (const piece of stagePieces) {
    const tracks = radOf(piece)?.tracks ?? [];
    const m = piece.mat;
    // the piece's turn, as the original turned it: its x axis there is (cos, sin)
    const a = Math.round((Math.atan2(-m[2], m[0]) * 180) / Math.PI);
    const across = Math.abs(a) == 180 ? 0 : Math.abs(a);
    for (const t of tracks) {
      const xy = Math.trunc(t.xy * cosDeg(a) - t.zy * sinDeg(a));
      const zy = Math.trunc(t.zy * cosDeg(a) + t.xy * sinDeg(a));
      if (Math.abs(xy) == 90 || Math.abs(zy) == 90 || t.rady == 801) {
        continue;
      }
      const mx = -t.tx / 10;
      const mz = t.tz / 10;
      surfaces.push({
        x: piece.x + m[0] * mx + m[8] * mz,
        y: piece.y - t.ty / 10,
        z: piece.z + m[2] * mx + m[10] * mz,
        radx:
          Math.trunc(
            Math.abs(t.radx * cosDeg(across) + t.radz * sinDeg(across)),
          ) / 10,
        radz:
          Math.trunc(
            Math.abs(t.radx * sinDeg(across) + t.radz * cosDeg(across)),
          ) / 10,
        // how much higher it lies a unit further along our x and z (the original's x
        // and y point the other way)
        xSlope: tanDeg(xy),
        zSlope: -tanDeg(zy),
        // (a rock pile's are the stage's colours already)
        shadow: t.c.map((v, k) =>
          Math.trunc((t.tinted ? v : snapOf(v, k)) / 1.5),
        ),
      });
    }
  }
};

// the surfaces near the car being drawn
const near = [];

// Picks the surfaces a car's shadow may lie on, the car at (x, z) with its wheels at
// height `wheels`, reach from its middle: those not above it there, much as it climbs a
// slope (the original took a bridge's deck over a car too). False: none, it lies on the
// ground.
const CLIMB = 5;
export const surfacesNear = (x, z, reach, wheels) => {
  near.length = 0;
  for (const s of surfaces) {
    if (
      Math.abs(x - s.x) < s.radx + reach &&
      Math.abs(z - s.z) < s.radz + reach &&
      heightOn(s, x, z) < wheels + CLIMB
    ) {
      near.push(s);
    }
  }
  return near.length > 0;
};

// Of those, the highest under (x, z), where boxes overlap (the original took the last
// placed, the lower one too where the boxes reach past their slopes' ends), or null.
export const surfaceUnder = (x, z) => {
  let highest = null;
  let height = -Infinity;
  for (const s of near) {
    if (Math.abs(x - s.x) < s.radx && Math.abs(z - s.z) < s.radz) {
      const h = heightOn(s, x, z);
      if (h > height) {
        highest = s;
        height = h;
      }
    }
  }
  return highest;
};

export const heightOn = (s, x, z) =>
  s.y + (x - s.x) * s.xSlope + (z - s.z) * s.zSlope;

// The height a shadow lies at, at (x, z): on the highest surface there, never under the
// ground.
export const shadowHeight = (x, z) => {
  const s = surfaceUnder(x, z);
  return s ? Math.max(0, heightOn(s, x, z)) : 0;
};

// The steepest a shadow drapes, as a rise per unit across (about 50 degrees): steeper
// than the stage's slopes (at most 40), not the drop at a ramp's end or a wall's foot.
const STEEPEST = 1.2;

// Where a shadow polygon's corner at (x, z) lies: on the surface under it, unless that
// is a drop from the one under the polygon's middle (surface, null: the ground) steeper
// than any slope; then on the middle's, reaching over the edge as the original's did.
export const cornerHeight = (x, z, middle, surface) => {
  const own = shadowHeight(x, z);
  const base = surface ? Math.max(0, heightOn(surface, x, z)) : 0;
  const across = Math.hypot(x - middle.x, z - middle.z);
  return Math.abs(own - base) > across * STEEPEST ? base : own;
};
