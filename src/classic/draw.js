// Draws models the way the original Java game did (its ContO.d and Plane.d): no depth
// buffer, the farthest object first and each object's farthest polygon first, every
// polygon in one colour lit from above, fogged in bands, and outlined when near.
import { drawPolygon, fillPolygon, fillTyre } from "./batch.js";
import { hsbToRgb, rgbToHsb } from "./color.js";
import { cosDeg, medium, sinDeg, xs, ys } from "./medium.js";

// --- a model's polygons for a stage (Plane's constructor) ---

// Gives each polygon of a model its colour for the stage (the stage's snap tints it,
// windows take the sky's colour), and its shape for the light (deltaf).
export const tintModel = (rad, randomness) => {
  for (const poly of rad.polys) {
    let color = poly.color;
    // the original's rock piles: each stone a slightly different sand colour
    if (poly.gr == -15) {
      const sand = Math.trunc(185 + randomness() * 20);
      color = [
        Math.trunc((217 + sand) / 2),
        Math.trunc((189 + sand) / 2),
        Math.trunc((132 + sand) / 2),
      ];
    }
    poly.nocol = color[0] == color[1] && color[1] == color[2];
    let c;
    if (poly.glass == 0) {
      c = color.map((v, i) =>
        Math.min(255, Math.max(0, Math.trunc(v + v * (medium.snap[i] / 100)))),
      );
    }
    if (poly.glass == 1) {
      c = medium.csky.map((v, i) =>
        Math.trunc(
          (v * medium.fade[0] * 2 + medium.cfade[i] * 3000) /
            (medium.fade[0] * 2 + 3000),
        ),
      );
    }
    if (poly.glass == 2) {
      c = medium.crgrnd.map((v) => Math.trunc(v * 0.925));
    }
    poly.c = c;
    poly.oc = color;
    poly.hsb = rgbToHsb(...c);
    poly.deltaf = deltaf(poly.points);
  }
};

const length2 = (a, b, axes) =>
  Math.sqrt(axes.reduce((sum, k) => sum + (a[k] - b[k]) * (a[k] - b[k]), 0)) /
  100;

// The light's measure of a polygon: its first three corners' distances multiplied; the
// same over the ground (projf) divided by this is how flat it lies.
const deltaf = (points) => {
  let d = 1;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (j != i) {
        d *= length2(points[j], points[i], [0, 1, 2]);
      }
    }
  }
  return d / 3;
};

// --- the camera, from the matrix the modern look draws with ---

// The view's axes from the projection-view matrix (column-major, the camera's position
// already taken off the model matrix): right, up, back, and forward over the ground.
const view = {
  right: [1, 0, 0],
  up: [0, 1, 0],
  back: [0, 0, 1],
  level: [0, 0, -1],
};

export const setView = (matrix) => {
  const row = (r) => [matrix[r], matrix[4 + r], matrix[8 + r]];
  const unit = (v) => {
    const l = Math.hypot(...v) || 1;
    return v.map((x) => x / l);
  };
  view.right = unit(row(0));
  view.up = unit(row(1));
  // the projection's focal length in pixels, so the classic look frames as the modern
  // one does (the original's 400 is a field of view a little wider than the race's 55°)
  medium.focus = (Math.hypot(...row(1)) * medium.h) / 2;
  view.back = row(3).map((x) => -x);
  view.level = unit([-view.back[0], 0, -view.back[2]]);
};

// The corners of the polygon being drawn, where the original's camera sees them: x1/z1
// after the camera's heading only, y0 before its pitch, x/y/z after both; gx/gz over the
// ground (for the light). Filled for one polygon at a time, so a frame allocates nothing.
const MAX_CORNERS = 64;
const X1 = new Float64Array(MAX_CORNERS);
const Z1 = new Float64Array(MAX_CORNERS);
const Y0 = new Float64Array(MAX_CORNERS);
export const X = new Float64Array(MAX_CORNERS);
export const Y = new Float64Array(MAX_CORNERS);
export const Z = new Float64Array(MAX_CORNERS);
const GX = new Float64Array(MAX_CORNERS);
const GZ = new Float64Array(MAX_CORNERS);
// on screen
const SX = new Float64Array(MAX_CORNERS);
const SY = new Float64Array(MAX_CORNERS);

// Puts corner i of a polygon at (mx, my, mz) in the model (the original's units and
// axes), placed with a modern model matrix relative to the camera; with a groundY, pressed
// onto the ground there (a shadow).
const placeCorner = (i, px, py, pz, matrix, groundY) => {
  // the original's axes into ours, ten times smaller
  const mx = -px / 10;
  const my = -py / 10;
  const mz = pz / 10;
  placeSeen(
    i,
    matrix[0] * mx + matrix[4] * my + matrix[8] * mz + matrix[12],
    groundY ?? matrix[1] * mx + matrix[5] * my + matrix[9] * mz + matrix[13],
    matrix[2] * mx + matrix[6] * my + matrix[10] * mz + matrix[14],
  );
};

// Corner i at (rx, ry, rz) from the camera in the original's units and axes.
export const placeOrig = (i, rx, ry, rz) => {
  placeSeen(i, -rx / 10, -ry / 10, rz / 10);
};

// Corner i at (wx, wy, wz) in our units relative to the camera.
const placeSeen = (i, wx, wy, wz) => {
  const right =
    (view.right[0] * wx + view.right[1] * wy + view.right[2] * wz) * 10;
  GX[i] = wx * 10;
  GZ[i] = wz * 10;
  Y0[i] = medium.cy - wy * 10;
  X1[i] = medium.cx + right;
  Z1[i] = (view.level[0] * wx + view.level[2] * wz) * 10;
  X[i] = medium.cx + right;
  Y[i] = medium.cy - (view.up[0] * wx + view.up[1] * wy + view.up[2] * wz) * 10;
  Z[i] = -(view.back[0] * wx + view.back[1] * wy + view.back[2] * wz) * 10;
};

// Places a polygon's corners, a wheel's turned with the wheel: spinning about its axle
// (wzy) and steering about its pivot (wxz), in the model. Returns how many.
// the wheels' turns of the object being drawn (see turnWheels)
const wheels = {
  spin: 0,
  steer: 0,
  spinCos: 1,
  spinSin: 0,
  steerCos: 1,
  steerSin: 0,
};

// Our wheel angles; the original's x and y point the other way, so they turn back.
const turnWheels = (wxz, wzy) => {
  wheels.spin = wzy;
  wheels.steer = wxz;
  wheels.spinCos = cosDeg(-wzy);
  wheels.spinSin = sinDeg(-wzy);
  wheels.steerCos = cosDeg(-wxz);
  wheels.steerSin = sinDeg(-wxz);
};

const placePoly = (poly, matrix, groundY) => {
  const points = poly.points;
  const turns = poly.wz != 0 || poly.wx != 0;
  const { spin, steer, spinCos, spinSin, steerCos, steerSin } = wheels;
  for (let i = 0; i < points.length; i++) {
    let [px, py, pz] = points[i];
    if (turns) {
      if (poly.wz != 0 && spin != 0) {
        const dy = py - poly.wy;
        const dz = pz - poly.wz;
        py = poly.wy + dy * spinCos - dz * spinSin;
        pz = poly.wz + dy * spinSin + dz * spinCos;
      }
      if (poly.wx != 0 && steer != 0) {
        const dx = px - poly.wx;
        const dz = pz - poly.wz;
        px = poly.wx + dx * steerCos - dz * steerSin;
        pz = poly.wz + dx * steerSin + dz * steerCos;
      }
    }
    placeCorner(i, px, py, pz, matrix, groundY);
  }
  return points.length;
};

// --- drawing ---

const color = [0, 0, 0];

// Into color: the colour after the fog bands the distance av has passed.
const fog = (r, g, b, av) => {
  const { fogd, cfade, fade } = medium;
  for (let i = 0; i < 16; i++) {
    if (av > fade[i]) {
      r = Math.trunc((r * fogd + cfade[0]) / (fogd + 1));
      g = Math.trunc((g * fogd + cfade[1]) / (fogd + 1));
      b = Math.trunc((b * fogd + cfade[2]) / (fogd + 1));
    }
  }
  color[0] = r;
  color[1] = g;
  color[2] = b;
};

// Whether a polygon faces away from the camera (b2), judged after the camera's heading.
const facesAway = (n) => {
  let best = 500;
  let a = 1;
  let b = 0;
  for (let i = 0; i < n; i++) {
    const sxi = xs(X1[i], Z1[i]);
    const syi = ys(Y0[i], Z1[i]);
    for (let j = i + 1; j < n; j++) {
      const v =
        Math.abs(sxi - xs(X1[j], Z1[j])) - Math.abs(syi - ys(Y0[j], Z1[j]));
      if (v < best) {
        a = i;
        b = j;
        best = v;
      }
    }
  }
  if (ys(Y0[b], Z1[b]) < ys(Y0[a], Z1[a])) {
    [a, b] = [b, a];
  }
  const spy = (i) => Math.sqrt((X1[i] - medium.cx) ** 2 + Z1[i] * Z1[i]);
  if (spy(b) <= spy(a)) {
    return false;
  }
  let level = 0;
  for (let i = 0; i < n; i++) {
    if (Z1[i] < 50 && Y0[i] > medium.cy) {
      return false;
    }
    if (Y0[i] == Y0[0]) {
      level++;
    }
  }
  return !(level == n && Y0[0] > medium.cy);
};

// whether the polygon last measured turns away from the camera (-111) or not (1)
let side = 1;

// How far a placed polygon is (its av): the middle of its extent, plus its gr cubed; a
// side turned away from the camera counts farther. Sets side.
const distanceOf = (poly, n) => {
  const sx = (i) => xs(X[i], Z[i]);
  const sy = (i) => ys(Y[i], Z[i]);
  side = 1;
  let gr = poly.gr < 0 && poly.gr >= -15 ? 0 : poly.gr;
  if (poly.gr == -11) {
    gr = -90;
  }
  if (poly.gr == -12) {
    gr = -75;
  }
  if (poly.gr == -14 || poly.gr == -15) {
    gr = -50;
  }
  if (poly.glass == 2) {
    gr = 200;
  }
  if (poly.fs != 0) {
    let a;
    let b;
    if (Math.abs(sy(0) - sy(1)) > Math.abs(sy(2) - sy(1))) {
      a = 0;
      b = 2;
    } else {
      a = 2;
      b = 0;
      side *= -1;
    }
    if (sy(1) > sy(a)) {
      side *= -1;
    }
    if (sx(1) > sx(b)) {
      side *= -1;
    }
    if (poly.fs != 22) {
      side *= poly.fs;
      if (side == -1) {
        gr += 40;
        side = -111;
      }
    }
  }
  if (medium.lightson && poly.light == 2) {
    gr -= 40;
  }
  // how far: the middle of its extent, plus its gr cubed
  let lowX = X[0];
  let highX = X[0];
  let lowY = Y[0];
  let highY = Y[0];
  let lowZ = Z[0];
  let highZ = Z[0];
  for (let i = 1; i < n; i++) {
    lowX = Math.min(lowX, X[i]);
    highX = Math.max(highX, X[i]);
    lowY = Math.min(lowY, Y[i]);
    highY = Math.max(highY, Y[i]);
    lowZ = Math.min(lowZ, Z[i]);
    highZ = Math.max(highZ, Z[i]);
  }
  const my = (lowY + highY) / 2;
  const mx = (lowX + highX) / 2;
  const mz = (lowZ + highZ) / 2;
  const av = Math.trunc(
    Math.sqrt(
      Math.max(
        0,
        (medium.cy - my) ** 2 + (medium.cx - mx) ** 2 + mz * mz + gr * gr * gr,
      ),
    ),
  );
  return av;
};

// One polygon (Plane.d), its corners placed: seen at all, how bright, in which colour,
// outlined or not. size is how big its object looks, or -1 for the next checkpoint.
const drawPoly = (poly, n, noline, size) => {
  let off0 = 0;
  let off1 = 0;
  let off2 = 0;
  let off3 = 0;
  let behind = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const sx = xs(X[i], Z[i]);
    const sy = ys(Y[i], Z[i]);
    SX[i] = sx;
    SY[i] = sy;
    const near = Z[i] < 10;
    if (sy < 0 || near) off0++;
    if (sy > medium.h || near) off1++;
    if (sx < 0 || near) off2++;
    if (sx > medium.w || near) off3++;
    if (near) behind++;
    minX = Math.min(minX, sx);
    maxX = Math.max(maxX, sx);
    minY = Math.min(minY, sy);
    maxY = Math.max(maxY, sy);
  }
  if (off0 == n || off1 == n || off2 == n || off3 == n) {
    return;
  }
  // far (b in the original): no black outline, and the far light; models of stone
  // (noline) and polygons reaching behind the camera always count as far
  let far = noline || behind != 0;
  // tiny polygons far away are left out
  if (size != -1) {
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    if (spanX == 0 || spanY == 0) {
      return;
    }
    if (
      spanX < 3 &&
      spanY < 3 &&
      ((size / spanX > 15 && size / spanY > 15) || far) &&
      (!medium.lightson || poly.light == 0)
    ) {
      return;
    }
  }
  const av = distanceOf(poly, n);
  poly.av = av;
  const race = medium.trk == 0;
  if (race && (av > medium.fade[poly.disline] || av == 0)) {
    return;
  }
  if (side == -111 && av > 4500 && !poly.road) {
    return;
  }
  if (side == -111 && av > 1500) {
    far = true;
  }
  if (av > 3000 && medium.adv <= 900) {
    far = true;
  }
  if (poly.gr == -13 && (!medium.lastCheck || size != -1)) {
    return;
  }
  if (poly.master == 2 && av > 1500) {
    return;
  }
  // (the stage select's preview, trk 2, shows them all)
  const preview = medium.trk == 2 || medium.trk == 3;
  if (
    (poly.gr == -11 || poly.gr == -14 || poly.gr == -15 || poly.gr == -12) &&
    av > 11000 &&
    !preview
  ) {
    return;
  }
  if (poly.glass == 2 && (!race || av > 6700)) {
    return;
  }
  const facingAway = facesAway(n);
  if (
    (poly.gr == -14 || poly.gr == -15 || poly.gr == -12) &&
    (facingAway || side == -111) &&
    !preview
  ) {
    return;
  }
  // the light: how flat the polygon lies over the ground
  let projf = 1;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (j != i) {
        projf *= Math.sqrt((GX[i] - GX[j]) ** 2 + (GZ[i] - GZ[j]) ** 2) / 100;
      }
    }
  }
  projf /= 3;
  let light = projf / poly.deltaf + 0.3;
  if (far && !poly.solo) {
    const bright = light >= 1.27;
    light = Math.min(light, 1);
    light *= bright ? 0.89 : 0.86;
    light = Math.max(light, 0.37);
    if (poly.gr == -9) {
      light = 0.7;
    }
    if (poly.gr == -4) {
      light = 0.74;
    }
    if (poly.gr != -7 && race && facingAway) {
      light = 0.32;
    }
    if (poly.gr == -8 || poly.gr == -14 || poly.gr == -15) {
      light = 1;
    }
    if (poly.gr == -11 || poly.gr == -12) {
      light = 0.6;
      if (size == -1) {
        light = medium.flicker ? 1 : 0.76;
      }
    }
    if (poly.gr == -13 && size == -1) {
      light = medium.flicker ? 0 : 0.76;
    }
    if (poly.gr == -6) {
      light = 0.62;
    }
    if (poly.gr == -5) {
      light = 0.55;
    }
  } else {
    light = Math.min(light, 1);
    if (light < 0.6 || facingAway) {
      light = 0.6;
    }
  }
  let [r, g, b] = hsbToRgb(poly.hsb[0], poly.hsb[1], poly.hsb[2] * light);
  if (
    medium.lightson &&
    (poly.light != 0 || ((poly.gr == -11 || poly.gr == -12) && size == -1))
  ) {
    [r, g, b] = poly.oc.map((v) => Math.min(255, Math.max(0, v)));
  }
  if (race) {
    fog(r, g, b, av);
    [r, g, b] = color;
  }
  if (poly.master == 1 && n == 20) {
    fillTyre(SX, SY, r, g, b);
  } else {
    fillPolygon(SX, SY, n, r, g, b);
  }
  if (!race && poly.gr == -10) {
    far = false;
  }
  if (!far) {
    if (!poly.solo) {
      if (medium.lightson && poly.light != 0) {
        const half = (v) => Math.min(255, Math.max(0, Math.trunc(v / 2)));
        drawPolygon(
          SX,
          SY,
          n,
          half(poly.oc[0]),
          half(poly.oc[1]),
          half(poly.oc[2]),
        );
      } else {
        drawPolygon(SX, SY, n, 0, 0, 0);
      }
    }
  } else if (poly.road && av <= 3000 && race && medium.fade[0] > 4000) {
    drawPolygon(
      SX,
      SY,
      n,
      Math.max(0, r - 10),
      Math.max(0, g - 10),
      Math.max(0, b - 10),
    );
  }
  // the checkpoints' frames, the next one's flashing brighter
  if (race && (poly.gr == -10 || poly.gr == -18)) {
    // (the decompiled source multiplies by (int)1.6, which is 1)
    const bright = poly.gr == -10 && size == -1 && medium.flicker ? 1.6 : 1;
    const c = poly.c.map((v) => Math.min(255, Math.trunc(v * bright)));
    fog(c[0], c[1], c[2], av);
    drawPolygon(SX, SY, n, color[0], color[1], color[2]);
  }
};

// A car's shadow (Plane.s): each polygon pressed flat onto the ground below the car, in
// the ground's colour darkened.
const drawShadow = (rad, matrix, groundY) => {
  for (const poly of rad.polys) {
    const n = placePoly(poly, matrix, groundY);
    let off0 = 0;
    let off1 = 0;
    let off2 = 0;
    let off3 = 0;
    for (let i = 0; i < n; i++) {
      SX[i] = xs(X[i], Z[i]);
      SY[i] = ys(Y[i], Z[i]);
      const near = Z[i] < 10;
      if (SY[i] < 0 || near) off0++;
      if (SY[i] > medium.h || near) off1++;
      if (SX[i] < 0 || near) off2++;
      if (SX[i] > medium.w || near) off3++;
    }
    if (n < 3 || off0 == n || off1 == n || off2 == n || off3 == n) {
      continue;
    }
    const ground = medium.crgrnd;
    fog(
      Math.trunc(ground[0] / 1.5),
      Math.trunc(ground[1] / 1.5),
      Math.trunc(ground[2] / 1.5),
      poly.av ?? 0,
    );
    fillPolygon(SX, SY, n, color[0], color[1], color[2]);
  }
};

// An object (ContO.d): skipped when off screen or too far, else its polygons from the
// farthest. Returns how far it is for ordering the next frame (0: not drawn).
export const drawObject = (
  rad,
  matrix,
  { wxz = 0, wzy = 0, nextCheckpoint = false, groundY = 0 } = {},
) => {
  turnWheels(wxz, wzy);
  placeCorner(0, 0, 0, 0, matrix);
  const maxR = rad.maxR;
  const n = X1[0];
  const depth = Z[0];
  const centreY = Y[0];
  const distance = Math.hypot(GX[0], (medium.cy - Y0[0]) / 1, GZ[0]);
  let size = xs(n + maxR, depth) - xs(n - maxR, depth);
  if (
    !(
      xs(n + maxR * 2, depth) > 0 &&
      xs(n - maxR * 2, depth) < medium.w &&
      depth > -maxR &&
      (depth < medium.fade[rad.disline] + maxR || medium.trk != 0) &&
      (size > rad.disp || medium.trk != 0)
    )
  ) {
    return 0;
  }
  if (
    !(ys(centreY + maxR, depth) > 0 && ys(centreY - maxR, depth) < medium.h)
  ) {
    return 0;
  }
  if (rad.shadow && depth < 2000) {
    drawShadow(rad, matrix, groundY);
  }
  if (nextCheckpoint) {
    size = -1;
  }
  // the farthest first, by how far each was last frame, as in the original; an object
  // not drawn last frame (the menus draw only when something moves) is measured now.
  // (An insertion sort: the order changes little from frame to frame.)
  const polys = rad.polys;
  const fresh = rad.drawnFrame != medium.frame - 1;
  rad.drawnFrame = medium.frame;
  if (fresh) {
    for (const poly of polys) {
      poly.av = distanceOf(poly, placePoly(poly, matrix));
    }
  }
  const order = (rad.order ??= polys.map((poly, i) => i));
  const before = (i, j) =>
    (polys[i].av ?? 0) > (polys[j].av ?? 0) ||
    ((polys[i].av ?? 0) == (polys[j].av ?? 0) && i < j);
  for (let k = 1; k < order.length; k++) {
    const i = order[k];
    let m = k - 1;
    while (m >= 0 && before(i, order[m])) {
      order[m + 1] = order[m];
      m--;
    }
    order[m + 1] = i;
  }
  for (const i of order) {
    const poly = polys[i];
    let corners = placePoly(poly, matrix);
    // a tyre seen from afar has no hole for its rim
    if (poly.master == 1 && (poly.av ?? 0) > 1500) {
      corners = 12;
    }
    drawPoly(poly, corners, rad.noline, size);
  }
  return Math.trunc(Math.sqrt(Math.trunc(distance)) * rad.grounded);
};
