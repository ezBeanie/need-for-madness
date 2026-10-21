// Fixing in the classic look, as the original game drew it (its ContO.electrify and
// fixit): electricity arcing across the fix hoops, and a bright bubble flashing round a
// car being fixed while its polygons turn blue and flash their outlines.
import { fillPolygon, drawPolygon } from "./batch.js";
import { X, Y, Z, placeCorner, tickRandom } from "./draw.js";
import { hsbToRgb, rgbToHsb } from "./color.js";
import { medium, xs, ys } from "./medium.js";

const SX = new Float64Array(8);
const SY = new Float64Array(8);
const clamp = (v) => Math.min(255, Math.max(0, Math.trunc(v)));
const tinted = (base, i, by) => clamp(base + base * (medium.snap[i] / by));

const onScreen = () => {
  let up = 0;
  let down = 0;
  let left = 0;
  let right = 0;
  for (let k = 0; k < 8; k++) {
    SX[k] = xs(X[k], Z[k]);
    SY[k] = ys(Y[k], Z[k]);
    const near = Z[k] < 10;
    if (SY[k] < 0 || near) up++;
    if (SY[k] > medium.h || near) down++;
    if (SX[k] < 0 || near) left++;
    if (SX[k] > medium.w || near) right++;
  }
  return up != 8 && down != 8 && left != 8 && right != 8;
};

// Four bands of electricity across a fix hoop, each living a few ticks before it jumps
// somewhere else. state keeps them per hoop; matrix places the hoop.
export const electrify = (state, matrix, hoop) => {
  state.arcs ??= Array.from({ length: 4 }, () => ({
    age: 0,
    left: 0,
    right: 0,
  }));
  state.arcs.forEach((arc, i) => {
    const r = (k) => tickRandom(hoop * 4 + i, k);
    if (arc.age == 0) {
      arc.left = Math.trunc(380 - r(0) * 760);
      arc.right = Math.trunc(380 - r(1) * 760);
      arc.age = 1;
    }
    const left = Math.trunc(arc.left + (190 - r(2) * 380));
    const right = Math.trunc(arc.right + (190 - r(3) * 380));
    const kinkLeft = Math.trunc(r(4) * 126);
    const kinkRight = Math.trunc(r(5) * 126);
    const shape = [
      [-504, -arc.left - 5 - Math.trunc(r(6) * 5)],
      [-252 + kinkRight, -left - 5 - Math.trunc(r(7) * 5)],
      [252 - kinkLeft, -right - 5 - Math.trunc(r(8) * 5)],
      [504, -arc.right - 5 - Math.trunc(r(9) * 5)],
      [504, -arc.right + 5 + Math.trunc(r(10) * 5)],
      [252 - kinkLeft, -right + 5 + Math.trunc(r(11) * 5)],
      [-252 + kinkRight, -left + 5 + Math.trunc(r(12) * 5)],
      [-504, -arc.left + 5 + Math.trunc(r(13) * 5)],
    ];
    shape.forEach(([x, y], k) => placeCorner(k, x, y, 0, matrix));
    if (onScreen()) {
      const blue = tinted(255, 2, 500);
      fillPolygon(
        SX,
        SY,
        8,
        Math.trunc(
          (tinted(160, 0, 500) * 2 + 214 * (arc.age - 1)) / (arc.age + 1),
        ),
        Math.trunc(
          (tinted(238, 1, 500) * 2 + 236 * (arc.age - 1)) / (arc.age + 1),
        ),
        blue,
      );
      if (Z[0] < 4000) {
        drawPolygon(SX, SY, 8, tinted(150, 0, 500), tinted(227, 1, 500), blue);
      }
    }
    if (state.tick != medium.tick) {
      arc.age = arc.age > r(14) * 60 ? 0 : arc.age + 1;
    }
  });
  state.tick = medium.tick;
};

// The step of fixing (the original's fcnt, 1 to 8) from our countdown: the car is
// fixed at 5 of its 20 ticks.
export const fixStep = (countdown) =>
  Math.min(8, 1 + Math.floor((20 - countdown) / 2));

// As a car being fixed starts, its polygons turn blue and flash their outlines (flx).
export const startFixing = (rad, step) => {
  if (rad.fixStep == step) {
    return;
  }
  rad.fixStep = step;
  for (const poly of rad.polys) {
    if (step == 1) {
      const blue = hsbToRgb(0.57, 0.8, 0.8).map((v, i) => tinted(v, i, 100));
      poly.hsb = rgbToHsb(...blue);
      poly.flx = 1;
    }
    if (step == 2) {
      poly.flx = 1;
    }
    if (step == 4) {
      poly.flx = 3;
    }
  }
};

// The bubble round a car being fixed: two octagons the size of its wheelbase, turning a
// little, in light blue and nearly white.
export const fixBubble = (rad, matrix, step, car) => {
  if (!(step == 1 || step > 2)) {
    return;
  }
  for (let l = 0; l < 4; l++) {
    placeCorner(l, rad.keyx[l], rad.grat, rad.keyz[l], matrix);
  }
  let spanX = 0;
  let spanY = 0;
  let reach = 0;
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      spanX = Math.max(spanX, Math.abs(X[a] - X[b]));
      spanY = Math.max(spanY, Math.abs(Y[a] - Y[b]));
      reach = Math.max(reach, (X[a] - X[b]) ** 2 + (Y[a] - Y[b]) ** 2);
    }
  }
  reach = Math.sqrt(reach) / 1.5;
  spanX = Math.max(spanX, reach);
  spanY = Math.max(spanY, reach);
  placeCorner(0, 0, 0, 0, matrix);
  const cx = X[0];
  const cy = Y[0];
  const depth = Z[0];
  if (depth < 10) {
    return;
  }
  const r = (k) => tickRandom(1000 + car, k);
  const turn = { 3: 22, 4: 22, 6: -22, 7: -22 }[step] ?? 0;
  const ring = (wide, tall, color, salt) => {
    const corners = [
      [-wide[0], -tall[1]],
      [-wide[0], tall[1]],
      [-wide[1], tall[0]],
      [wide[1], tall[0]],
      [wide[0], tall[1]],
      [wide[0], -tall[1]],
      [wide[1], -tall[0]],
      [-wide[1], -tall[0]],
    ];
    const centreX = xs(cx, depth);
    const centreY = ys(cy, depth);
    corners.forEach(([dx, dy], k) => {
      const ox = dx * (1 + r(salt + k) * 0.3);
      const oy = dy * (1 + r(salt + 8 + k) * 0.3);
      let sx = xs(cx + ox, depth);
      let sy = ys(cy + oy, depth);
      if (turn) {
        const c = Math.cos((turn * Math.PI) / 180);
        const s = Math.sin((turn * Math.PI) / 180);
        [sx, sy] = [
          centreX + (sx - centreX) * c - (sy - centreY) * s,
          centreY + (sx - centreX) * s + (sy - centreY) * c,
        ];
      }
      SX[k] = sx;
      SY[k] = sy;
    });
    fillPolygon(SX, SY, 8, ...color);
  };
  ring(
    [spanX / 0.8, spanX / 1.92],
    [spanY / 0.8, spanY / 1.92],
    [tinted(191, 0, 350), tinted(232, 1, 350), tinted(255, 2, 350)],
    0,
  );
  ring(
    [spanX, spanX / 2.4],
    [spanY, spanY / 2.4],
    [tinted(213, 0, 350), tinted(239, 1, 350), tinted(255, 2, 350)],
    20,
  );
};
