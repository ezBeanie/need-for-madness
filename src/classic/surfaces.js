// The stage's surfaces the original laid the cars' shadows on (its Trackers): the
// <track> boxes of the pieces' models, placed and turned with the pieces, in our units.
// A shadow polygon lies on the surface under its middle, flat or sloped like a ramp,
// in that surface's colour darkened (see drawShadow in draw.js).
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
        shadow: t.c.map((v, k) => Math.trunc(snapOf(v, k) / 1.5)),
      });
    }
  }
};

// the surfaces near the car being drawn
const near = [];

// Picks the surfaces a car's shadow may reach, the car at (x, z), reach from its middle;
// false: none, it lies on the ground.
export const surfacesNear = (x, z, reach) => {
  near.length = 0;
  for (const s of surfaces) {
    if (
      Math.abs(x - s.x) < s.radx + reach &&
      Math.abs(z - s.z) < s.radz + reach
    ) {
      near.push(s);
    }
  }
  return near.length > 0;
};

// Of those, the surface under (x, z): the last placed first, as the original searched.
export const surfaceUnder = (x, z) => {
  for (let i = near.length - 1; i >= 0; i--) {
    const s = near[i];
    if (Math.abs(x - s.x) < s.radx && Math.abs(z - s.z) < s.radz) {
      return s;
    }
  }
  return null;
};

export const heightOn = (s, x, z) =>
  s.y + (x - s.x) * s.xSlope + (z - s.z) * s.zSlope;
