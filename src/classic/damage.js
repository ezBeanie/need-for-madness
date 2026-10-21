// Dents in the classic look's own models of the cars, as the original game dented them
// (its Mad.regx/regy/regz): the corners near the wheel that was hit move with the hit,
// and the polygons dented fade to grey and brown. Our physics tells of each dent (see
// bodyDamage in race/physics.js); this only follows it, with its own randomness.
import { carStats } from "../data/carStats.js";
import { HIT } from "../race/physics.js";
import { car, racers } from "../race/racers.js";
import { hsbToRgb } from "./color.js";
import { deltaf } from "./draw.js";

let seed = 5;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

const sinDeg = (a) => Math.sin((a * Math.PI) / 180);
const cosDeg = (a) => Math.cos((a * Math.PI) / 180);

// The original's fading of a dented polygon: less colourful, darker, then brown.
const fade = (poly, by) => {
  if (poly.nocol || poly.glass == 1) {
    return;
  }
  const hsb = poly.hsb;
  if (poly.bfase > 20 && hsb[1] > 0.25) {
    hsb[1] = 0.25;
  }
  if (poly.bfase > 25 && hsb[2] > 0.7) {
    hsb[2] = 0.7;
  }
  if (poly.bfase > 30 && hsb[1] > 0.15) {
    hsb[1] = 0.15;
  }
  if (poly.bfase > 35 && hsb[2] > 0.6) {
    hsb[2] = 0.6;
  }
  if (poly.bfase > 40) {
    hsb[0] = 0.075;
  }
  if (poly.bfase > 50 && hsb[2] > 0.5) {
    hsb[2] = 0.5;
  }
  if (poly.bfase > 60) {
    hsb[0] = 0.05;
  }
  poly.bfase = (poly.bfase ?? 0) + Math.trunc(by);
  poly.c = hsbToRgb(...hsb);
};

const isWheel = (poly) => poly.master || poly.wz != 0 || poly.wx != 0;

// A hit on car c as our physics dents its body (see dentNearCorner and crushRoof): along
// hitSide at corner k with mag, and how the car lay then, so it can be dented later too.
export const hitOn = (c, hitSide, k, mag) => ({
  hitSide,
  k,
  mag,
  type: car[c].typ,
  keyX: car[c].keyx[k],
  keyZ: car[c].keyz[k],
  xz: car[c].xz,
  xy: car[c].xy,
  zy: car[c].zy,
  squash: racers[c].squash,
});

// Dents a car's classic model with a hit (see hitOn). The model's corners are in the
// original's units; ours, as the modern body has them, are (-x/10, -y/10, z/10).
export const dentClassic = (rad, hit) => {
  const { hitSide, mag, type, keyX, keyZ } = hit;
  const reach = carStats.clrad[type];
  const sinXZ = sinDeg(hit.xz);
  const cosXZ = cosDeg(hit.xz);
  const sinXY = sinDeg(hit.xy);
  const cosXY = cosDeg(hit.xy);
  const sinZY = sinDeg(hit.zy);
  const cosZY = cosDeg(hit.zy);
  const roof = carStats.flipy[type] + hit.squash;
  for (const poly of rad.polys) {
    if (isWheel(poly)) {
      continue;
    }
    let deepest = 0;
    for (const p of poly.points) {
      const x = -p[0] / 10;
      const y = -p[1] / 10;
      const z = p[2] / 10;
      if (hitSide == HIT.onRoof) {
        if (y > roof && Math.abs(hit.squash) < carStats.msquash[type]) {
          const tmag = (mag / 15) * random();
          p[1] += 10 * tmag;
          deepest = Math.max(deepest, Math.abs(10 * tmag));
        }
        continue;
      }
      if ((keyX - x) ** 2 + (keyZ - z) ** 2 >= reach) {
        continue;
      }
      const tmag = (mag / 30) * random();
      let dx = 0;
      let dz = 0;
      if (hitSide == HIT.alongX) {
        dz = -tmag * sinXZ * cosZY;
        dx = tmag * cosXZ * cosXY;
      }
      if (hitSide == HIT.alongZ) {
        dz = tmag * cosXZ * cosZY;
        dx = tmag * sinXZ * cosXY;
      }
      if (hitSide == HIT.fromBelow) {
        dz = -tmag * sinZY;
        dx = tmag * sinXY;
      }
      p[0] -= 10 * dx;
      p[2] += 10 * dz;
      deepest = Math.max(deepest, Math.abs(10 * tmag));
    }
    if (deepest != 0) {
      fade(poly, deepest);
      // its shape for the light changed with it
      poly.deltaf = deltaf(poly.points);
    }
  }
};
