// Draws models the way the original Java game did (its ContO.d and Plane.d): no depth
// buffer, the farthest object first and each object's farthest polygon first, every
// polygon in one colour lit from above, fogged in bands, and outlined when near.
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
  view.back = row(3).map((x) => -x);
  view.level = unit([-view.back[0], 0, -view.back[2]]);
};

const dot = (a, w) => a[0] * w[0] + a[1] * w[1] + a[2] * w[2];

// A point of an original model, placed with a modern model matrix (relative to the
// camera): where the original's camera sees it. x1/z1 are after the camera's heading only,
// x/y/z after its pitch too; gx/gz are over the ground, for the light.
const project = (point, matrix) => seen(placed(point, matrix));

// where a point of a model is, in our units relative to the camera
const placed = (point, matrix) => {
  // the original's axes into ours, ten times smaller
  const mx = -point[0] / 10;
  const my = -point[1] / 10;
  const mz = point[2] / 10;
  return [
    matrix[0] * mx + matrix[4] * my + matrix[8] * mz + matrix[12],
    matrix[1] * mx + matrix[5] * my + matrix[9] * mz + matrix[13],
    matrix[2] * mx + matrix[6] * my + matrix[10] * mz + matrix[14],
  ];
};

const seen = (w) => {
  const right = dot(view.right, w) * 10;
  return {
    gx: w[0] * 10,
    gy: w[1] * 10,
    gz: w[2] * 10,
    // down, before the camera's pitch
    y0: medium.cy - w[1] * 10,
    x1: medium.cx + right,
    z1: dot(view.level, w) * 10,
    x: medium.cx + right,
    y: medium.cy - dot(view.up, w) * 10,
    z: -dot(view.back, w) * 10,
  };
};

// --- drawing ---

const rot = (a, b, pa, pb, angle) => {
  if (angle == 0) {
    return [a, b];
  }
  const c = cosDeg(angle);
  const s = sinDeg(angle);
  return [pa + (a - pa) * c - (b - pb) * s, pb + (a - pa) * s + (b - pb) * c];
};

// A wheel polygon's corner turned with the wheel: spinning about its axle (wzy) and
// steering about its pivot (wxz), in the model.
const turnWheel = (poly, [x, y, z], wxz, wzy) => {
  let [py, pz] = [y, z];
  if (poly.wz != 0) {
    [py, pz] = rot(y, z, poly.wy, poly.wz, wzy);
  }
  let px = x;
  if (poly.wx != 0) {
    [px, pz] = rot(x, pz, poly.wx, poly.wz, wxz);
  }
  return [px, py, pz];
};

const rgb = ([r, g, b]) => `rgb(${r},${g},${b})`;

const fogged = (color, av) => {
  let [r, g, b] = color;
  for (let i = 0; i < 16; i++) {
    if (av > medium.fade[i]) {
      r = Math.trunc((r * medium.fogd + medium.cfade[0]) / (medium.fogd + 1));
      g = Math.trunc((g * medium.fogd + medium.cfade[1]) / (medium.fogd + 1));
      b = Math.trunc((b * medium.fogd + medium.cfade[2]) / (medium.fogd + 1));
    }
  }
  return [r, g, b];
};

const path = (g, sx, sy) => {
  g.beginPath();
  g.moveTo(sx[0], sy[0]);
  for (let i = 1; i < sx.length; i++) {
    g.lineTo(sx[i], sy[i]);
  }
  g.closePath();
};

// One polygon (Plane.d): seen at all, how bright, in which colour, outlined or not.
// size is how big its object looks, or -1 for the next checkpoint.
const drawPoly = (g, poly, corners, noline, size) => {
  const n = corners.length;
  // the light: how flat the polygon lies over the ground
  let projf = 1;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (j != i) {
        projf *=
          Math.sqrt(
            (corners[i].gx - corners[j].gx) ** 2 +
              (corners[i].gz - corners[j].gz) ** 2,
          ) / 100;
      }
    }
  }
  projf /= 3;
  // facing the camera or away (b2): judged after the camera's heading
  let facingAway = false;
  {
    const sx = corners.map((p) => xs(p.x1, p.z1));
    const sy = corners.map((p) => ys(p.y0, p.z1));
    let best = 500;
    let a = 1;
    let b = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const v = Math.abs(sx[i] - sx[j]) - Math.abs(sy[i] - sy[j]);
        if (v < best) {
          a = i;
          b = j;
          best = v;
        }
      }
    }
    if (sy[b] < sy[a]) {
      [a, b] = [b, a];
    }
    const spy = (p) => Math.sqrt((p.x1 - medium.cx) ** 2 + p.z1 * p.z1);
    if (spy(corners[b]) > spy(corners[a])) {
      facingAway = true;
      let level = 0;
      for (let i = 0; i < n; i++) {
        if (corners[i].z1 < 50 && corners[i].y0 > medium.cy) {
          facingAway = false;
        } else if (corners[i].y0 == corners[0].y0) {
          level++;
        }
      }
      if (level == n && corners[0].y0 > medium.cy) {
        facingAway = false;
      }
    }
  }
  const sx = corners.map((p) => xs(p.x, p.z));
  const sy = corners.map((p) => ys(p.y, p.z));
  let off = [0, 0, 0, 0];
  let behind = 0;
  for (let i = 0; i < n; i++) {
    const near = corners[i].z < 10;
    off[0] += sy[i] < 0 || near ? 1 : 0;
    off[1] += sy[i] > medium.h || near ? 1 : 0;
    off[2] += sx[i] < 0 || near ? 1 : 0;
    off[3] += sx[i] > medium.w || near ? 1 : 0;
    behind += near ? 1 : 0;
  }
  if (off.some((o) => o == n)) {
    return;
  }
  // far (b in the original): no black outline, and the far light; models of stone
  // (noline) and polygons reaching behind the camera always count as far
  let far = noline || behind != 0;
  // tiny polygons far away are left out
  if (size != -1) {
    let spanX = 0;
    let spanY = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        spanX = Math.max(spanX, Math.abs(sx[i] - sx[j]));
        spanY = Math.max(spanY, Math.abs(sy[i] - sy[j]));
      }
    }
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
  // the faces' sides (fs): one turned away from the camera is shaded darker (-111)
  let side = 1;
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
    if (Math.abs(sy[0] - sy[1]) > Math.abs(sy[2] - sy[1])) {
      a = 0;
      b = 2;
    } else {
      a = 2;
      b = 0;
      side *= -1;
    }
    if (sy[1] > sy[a]) {
      side *= -1;
    }
    if (sx[1] > sx[b]) {
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
  const span = (axis) => {
    const values = corners.map((p) => p[axis]);
    return (Math.max(...values) + Math.min(...values)) / 2;
  };
  const my = span("y");
  const mx = span("x");
  const mz = span("z");
  const av = Math.trunc(
    Math.sqrt(
      Math.max(
        0,
        (medium.cy - my) ** 2 + (medium.cx - mx) ** 2 + mz * mz + gr * gr * gr,
      ),
    ),
  );
  poly.av = av;
  if (av > medium.fade[poly.disline] || av == 0) {
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
  if (
    (poly.gr == -14 || poly.gr == -15 || poly.gr == -12) &&
    (av > 11000 || facingAway || side == -111)
  ) {
    return;
  }
  if (poly.gr == -11 && av > 11000) {
    return;
  }
  if (poly.glass == 2 && av > 6700) {
    return;
  }
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
    if (poly.gr != -7 && facingAway) {
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
  let color = hsbToRgb(poly.hsb[0], poly.hsb[1], poly.hsb[2] * light);
  if (
    medium.lightson &&
    (poly.light != 0 || ((poly.gr == -11 || poly.gr == -12) && size == -1))
  ) {
    color = poly.oc.map((v) => Math.min(255, Math.max(0, v)));
  }
  color = fogged(color, av);
  path(g, sx, sy);
  g.fillStyle = rgb(color);
  g.fill();
  if (poly.gr == -10) {
    far = false;
  }
  if (!far) {
    if (!poly.solo) {
      const line =
        medium.lightson && poly.light != 0
          ? poly.oc.map((v) => Math.min(255, Math.max(0, Math.trunc(v / 2))))
          : [0, 0, 0];
      g.strokeStyle = rgb(line);
      g.stroke();
    }
  } else if (poly.road && av <= 3000 && medium.fade[0] > 4000) {
    g.strokeStyle = rgb(color.map((v) => Math.max(0, v - 10)));
    g.stroke();
  }
  // the checkpoints' frames, the next one's flashing brighter
  if (poly.gr == -10 || poly.gr == -18) {
    const frame =
      poly.gr == -10 && size == -1 && medium.flicker
        ? // (the decompiled source multiplies by (int)1.6, which is 1)
          poly.c.map((v) => Math.min(255, Math.trunc(v * 1.6)))
        : poly.c;
    g.strokeStyle = rgb(fogged(frame, av));
    g.stroke();
  }
};

// A car's shadow (Plane.s): each polygon pressed flat onto the ground below the car, in
// the ground's colour darkened.
const drawShadow = (g, rad, matrix, groundY, wxz, wzy) => {
  for (const poly of rad.polys) {
    const corners = poly.points.map((p) => {
      const w = placed(
        poly.wz != 0 || poly.wx != 0 ? turnWheel(poly, p, wxz, wzy) : p,
        matrix,
      );
      w[1] = groundY;
      return seen(w);
    });
    const sx = corners.map((p) => xs(p.x, p.z));
    const sy = corners.map((p) => ys(p.y, p.z));
    const n = corners.length;
    const all = (test) => corners.every((p, i) => test(i) || p.z < 10);
    if (
      all((i) => sy[i] < 0) ||
      all((i) => sy[i] > medium.h) ||
      all((i) => sx[i] < 0) ||
      all((i) => sx[i] > medium.w) ||
      n < 3
    ) {
      continue;
    }
    path(g, sx, sy);
    g.fillStyle = rgb(
      fogged(
        medium.crgrnd.map((c) => Math.trunc(c / 1.5)),
        poly.av ?? 0,
      ),
    );
    g.fill();
  }
};

// An object (ContO.d): skipped when off screen or too far, else its polygons from the
// farthest. Returns how far it is for ordering the next frame (0: not drawn).
export const drawObject = (
  g,
  rad,
  matrix,
  { wxz = 0, wzy = 0, nextCheckpoint = false, groundY = 0 } = {},
) => {
  const centre = project([0, 0, 0], matrix);
  const maxR = rad.maxR;
  const n = centre.x1;
  const depth = centre.z;
  let size = xs(n + maxR, depth) - xs(n - maxR, depth);
  if (
    !(
      xs(n + maxR * 2, depth) > 0 &&
      xs(n - maxR * 2, depth) < medium.w &&
      depth > -maxR &&
      depth < medium.fade[rad.disline] + maxR &&
      size > rad.disp
    )
  ) {
    return 0;
  }
  if (
    !(ys(centre.y + maxR, depth) > 0 && ys(centre.y - maxR, depth) < medium.h)
  ) {
    return 0;
  }
  if (rad.shadow && depth < 2000) {
    drawShadow(g, rad, matrix, groundY, wxz, wzy);
  }
  if (nextCheckpoint) {
    size = -1;
  }
  const polys = rad.polys.map((poly) => ({
    poly,
    corners: poly.points.map((p) =>
      project(
        poly.wz != 0 || poly.wx != 0 ? turnWheel(poly, p, wxz, wzy) : p,
        matrix,
      ),
    ),
  }));
  // the farthest first, by how far each was last frame, as in the original
  const order = polys
    .map((entry, i) => ({ entry, i }))
    .sort(
      (a, b) => (b.entry.poly.av ?? 0) - (a.entry.poly.av ?? 0) || a.i - b.i,
    );
  for (const { entry } of order) {
    let corners = entry.corners;
    // a tyre seen from afar has no hole for its rim
    if (entry.poly.master == 1 && (entry.poly.av ?? 0) > 1500) {
      corners = corners.slice(0, 12);
    }
    drawPoly(g, entry.poly, corners, rad.noline, size);
  }
  const d = Math.hypot(centre.gx, centre.gy, centre.gz);
  return Math.trunc(Math.sqrt(Math.trunc(d)) * rad.grounded);
};
