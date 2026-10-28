// What the classic look draws in a frame, as the original's Java2D drew it: filled and
// outlined polygons in screen pixels, each painted over what came before. Everything goes
// into one buffer in that order and is drawn at once; with no depth test, the order alone
// decides what covers what, so fills and outlines must never be split apart.
//
// With the depth test (look.depth) the order still decides between objects and between
// a polygon and what lies in its plane (a stripe on a door), but within an object the
// nearer polygon covers the farther one, where the original's order by each polygon's
// middle got it wrong (a tyre over its rim, a wheel over its arch). Each object drawn
// gets a slice of the depth range of its own, nearer than all drawn before it.
import { gl } from "../render/renderer.js";

// x, y, depth and a colour packed into four bytes, per vertex
const WORDS_PER_VERTEX = 4;
let words = new Float32Array(WORDS_PER_VERTEX * 65536);
let colors = new Uint32Array(words.buffer);
let count = 0;

const reserve = (vertices) => {
  if ((count + vertices) * WORDS_PER_VERTEX > words.length) {
    const grown = new Float32Array(words.length * 2);
    grown.set(words);
    words = grown;
    colors = new Uint32Array(words.buffer);
  }
};

// little-endian RGBA bytes, as the shader reads them
const pack = (r, g, b, a = 255) => (a << 24) | (b << 16) | (g << 8) | r;

// the depth range (-1 near to 1 far) split into slices, one per object (a race draws
// about a hundred)
const SLICE = 2 / 256;
// how much of its slice an object's polygons use by how far they are; the rest moves
// each polygon nearer than the one drawn before it by STEP, two steps of a 24-bit depth
// buffer, so that of two polygons in one plane the later one shows, as it did
const SPREAD = 0.96;
const STEP = 2.5e-7;
// how much nearer an outline is than its polygon: enough to stay whole where it runs
// along a polygon that slants towards the camera, as in the original it lay on top
const OUTLINE = SLICE * 0.005;

// where the drawing without depth (sky, ground, effects) goes: in front of everything
// drawn so far
let flat = 1;
// the object being drawn: its slice's far end, its 1/z range and its polygons so far
let slice = null;
const object = { farInverse: 0, span: 1, polygons: 0 };
// the polygon being drawn: 1/z at its corners, and in between (1/z of a flat polygon
// changes evenly across the screen) a * x + b * y + c, kept within its corners' range,
// as a polygon seen edge on has a plane that is hardly known
let plane = null;
const coefficients = { a: 0, b: 0, c: 0, low: 0, high: 0 };
const cornerInverses = new Float64Array(64);
// how far an outline is nudged nearer
let nudge = 0;

// The depth of a vertex at (x, y), at the polygon's corner when given.
const depthAt = (x, y, corner) => {
  if (plane === null) {
    return flat;
  }
  const inverse =
    corner >= 0
      ? cornerInverses[corner]
      : Math.min(
          plane.high,
          Math.max(plane.low, plane.a * x + plane.b * y + plane.c),
        );
  const near = Math.min(
    1,
    Math.max(0, (inverse - object.farInverse) / object.span),
  );
  return slice - SLICE * SPREAD * near - object.polygons * STEP - nudge;
};

const vertex = (x, y, color, corner = -1) => {
  const at = count * WORDS_PER_VERTEX;
  words[at] = x;
  words[at + 1] = y;
  words[at + 2] = depthAt(x, y, corner);
  colors[at + 3] = color;
  count++;
};

// An object from near to far (the original's distances from the camera) begins: its
// polygons go into a slice of their own.
export const startObject = (near, far) => {
  slice = flat;
  object.farInverse = 1 / far;
  object.span = 1 / Math.max(near, 1) - object.farInverse || 1;
  object.polygons = 0;
  plane = null;
};

// The object is done: what follows is drawn in front of it.
export const endObject = () => {
  slice = null;
  plane = null;
  flat = Math.max(-1 + SLICE, flat - SLICE);
};

// The next polygon of the object, its corners on the screen (xs, ys) and their distances
// (zs): its fill and outline lie where it is.
export const startPolygon = (xs, ys, zs, n) => {
  if (slice === null) {
    return;
  }
  let low = Infinity;
  let high = -Infinity;
  for (let i = 0; i < n; i++) {
    cornerInverses[i] = 1 / Math.max(zs[i], 10);
    low = Math.min(low, cornerInverses[i]);
    high = Math.max(high, cornerInverses[i]);
  }
  coefficients.low = low;
  coefficients.high = high;
  // the plane through the corners spanning the largest triangle of a fan
  let best = 0;
  let k = 1;
  for (let i = 1; i < n - 1; i++) {
    const area = Math.abs(turn(xs, ys, 0, i, i + 1));
    if (area > best) {
      best = area;
      k = i;
    }
  }
  const z0 = cornerInverses[0];
  if (best < 1e-6) {
    coefficients.a = 0;
    coefficients.b = 0;
    coefficients.c = z0;
  } else {
    const dx1 = xs[k] - xs[0];
    const dy1 = ys[k] - ys[0];
    const dz1 = cornerInverses[k] - z0;
    const dx2 = xs[k + 1] - xs[0];
    const dy2 = ys[k + 1] - ys[0];
    const dz2 = cornerInverses[k + 1] - z0;
    const d = dx1 * dy2 - dy1 * dx2;
    coefficients.a = (dz1 * dy2 - dy1 * dz2) / d;
    coefficients.b = (dx1 * dz2 - dz1 * dx2) / d;
    coefficients.c = z0 - coefficients.a * xs[0] - coefficients.b * ys[0];
  }
  plane = coefficients;
  object.polygons++;
};

// how wide a pixel of the original is on the canvas (1 at its 450 rows)
let pixel = 1;

export const setPixelSize = (size) => {
  pixel = size;
};

export const startBatch = () => {
  count = 0;
  flat = 1;
  slice = null;
  plane = null;
};

// Twice the signed area of a triangle: which way it turns.
const turn = (xs, ys, a, b, c) =>
  (xs[b] - xs[a]) * (ys[c] - ys[b]) - (ys[b] - ys[a]) * (xs[c] - xs[b]);

const isConvex = (xs, ys, n) => {
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const t = turn(xs, ys, i, (i + 1) % n, (i + 2) % n);
    if (t != 0) {
      if (sign != 0 && Math.sign(t) != sign) {
        return false;
      }
      sign = Math.sign(t);
    }
  }
  return true;
};

// Where the edge from corner i to corner j is at height y.
const xAt = (xs, ys, i, j, y) =>
  xs[i] + ((xs[j] - xs[i]) * (y - ys[i])) / (ys[j] - ys[i]);

// A polygon filled as Java fills it, by the even-odd rule (a hole where it runs round
// twice, a slit into it covering nothing): in bands between the heights of its corners
// and crossings, each band's pieces between its edges in pairs.
const fillEvenOdd = (xs, ys, n, color) => {
  const levels = [];
  for (let i = 0; i < n; i++) {
    levels.push(ys[i]);
  }
  // where edges cross each other
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    for (let j = i + 2; j < n; j++) {
      const j2 = (j + 1) % n;
      if (j2 == i) {
        continue;
      }
      const dx1 = xs[i2] - xs[i];
      const dy1 = ys[i2] - ys[i];
      const dx2 = xs[j2] - xs[j];
      const dy2 = ys[j2] - ys[j];
      const d = dx1 * dy2 - dy1 * dx2;
      if (d == 0) {
        continue;
      }
      const t = ((xs[j] - xs[i]) * dy2 - (ys[j] - ys[i]) * dx2) / d;
      const u = ((xs[j] - xs[i]) * dy1 - (ys[j] - ys[i]) * dx1) / d;
      if (t > 0 && t < 1 && u > 0 && u < 1) {
        levels.push(ys[i] + t * dy1);
      }
    }
  }
  levels.sort((p, q) => p - q);
  const crossing = [];
  for (let k = 0; k < levels.length - 1; k++) {
    const top = levels[k];
    const bottom = levels[k + 1];
    if (bottom - top < 1e-6) {
      continue;
    }
    const middle = (top + bottom) / 2;
    crossing.length = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (
        (ys[i] <= top && ys[j] >= bottom) ||
        (ys[j] <= top && ys[i] >= bottom)
      ) {
        crossing.push({
          top: xAt(xs, ys, i, j, top),
          bottom: xAt(xs, ys, i, j, bottom),
          middle: xAt(xs, ys, i, j, middle),
        });
      }
    }
    crossing.sort((p, q) => p.middle - q.middle);
    reserve(crossing.length * 3);
    for (let e = 0; e + 1 < crossing.length; e += 2) {
      const l = crossing[e];
      const r = crossing[e + 1];
      vertex(l.top, top, color);
      vertex(r.top, top, color);
      vertex(r.bottom, bottom, color);
      vertex(l.top, top, color);
      vertex(r.bottom, bottom, color);
      vertex(l.bottom, bottom, color);
    }
  }
};

// A polygon: a fan from its first corner when it is convex (nearly all the original's
// polygons are), else filled by the even-odd rule as Java did (a wheel arch, a zigzag, a
// tyre round its rim).
export const fillPolygon = (xs, ys, n, r, g, b, alpha = 255) => {
  const color = pack(r, g, b, alpha);
  if (n > 3 && !isConvex(xs, ys, n)) {
    fillEvenOdd(xs, ys, n, color);
    return;
  }
  reserve((n - 2) * 3);
  for (let i = 1; i < n - 1; i++) {
    vertex(xs[0], ys[0], color, 0);
    vertex(xs[i], ys[i], color, i);
    vertex(xs[i + 1], ys[i + 1], color, i + 1);
  }
};

// A polygon's outline, each edge a strip one of the original's pixels wide (as deep as
// the corners it joins).
export const drawPolygon = (xs, ys, n, r, g, b) => {
  const color = pack(r, g, b);
  nudge = OUTLINE;
  reserve(n * 6);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = xs[j] - xs[i];
    const dy = ys[j] - ys[i];
    const length = Math.hypot(dx, dy) || 1;
    // half a pixel to each side, and half a pixel past each end
    const half = pixel / 2;
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    const ex = (dx / length) * half;
    const ey = (dy / length) * half;
    const ax = xs[i] - ex;
    const ay = ys[i] - ey;
    const bx = xs[j] + ex;
    const by = ys[j] + ey;
    vertex(ax + nx, ay + ny, color, i);
    vertex(bx + nx, by + ny, color, j);
    vertex(bx - nx, by - ny, color, j);
    vertex(ax + nx, ay + ny, color, i);
    vertex(bx - nx, by - ny, color, j);
    vertex(ax - nx, ay - ny, color, i);
  }
  nudge = 0;
};

// A line one pixel wide (the original's drawLine).
export const drawLine = (x0, y0, x1, y1, r, g, b) => {
  drawPolygon([x0, x1], [y0, y1], 2, r, g, b);
};

export const fillRect = (x, y, w, h, r, g, b) => {
  fillPolygon([x, x + w, x + w, x], [y, y, y + h, y + h], 4, r, g, b);
};

let program = null;
let buffer = null;

const makeProgram = () => {
  const shader = (type, source) => {
    const made = gl.createShader(type);
    gl.shaderSource(made, source);
    gl.compileShader(made);
    return made;
  };
  const made = gl.createProgram();
  gl.attachShader(
    made,
    shader(
      gl.VERTEX_SHADER,
      "attribute vec3 aPosition; attribute vec4 aColor; uniform vec2 uSize; " +
        "varying lowp vec4 vColor; void main(void) { " +
        "gl_Position = vec4(aPosition.x / uSize.x * 2.0 - 1.0, " +
        "1.0 - aPosition.y / uSize.y * 2.0, aPosition.z, 1.0); vColor = aColor; }",
    ),
  );
  gl.attachShader(
    made,
    shader(
      gl.FRAGMENT_SHADER,
      "varying lowp vec4 vColor; void main(void) { gl_FragColor = vColor; }",
    ),
  );
  gl.linkProgram(made);
  return {
    program: made,
    position: gl.getAttribLocation(made, "aPosition"),
    color: gl.getAttribLocation(made, "aColor"),
    size: gl.getUniformLocation(made, "uSize"),
  };
};

// Draws the frame's polygons onto the 3D canvas, whose pixels are the screen's (w x h),
// with or without the depth test.
export const flushBatch = (w, h, depth = false) => {
  program ??= makeProgram();
  buffer ??= gl.createBuffer();
  if (depth) {
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
  } else {
    gl.disable(gl.DEPTH_TEST);
  }
  // see-through only where the original made it so (dust); everything else is opaque
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    words.subarray(0, count * WORDS_PER_VERTEX),
    gl.STREAM_DRAW,
  );
  gl.useProgram(program.program);
  gl.uniform2f(program.size, w, h);
  gl.enableVertexAttribArray(program.position);
  gl.vertexAttribPointer(program.position, 3, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(program.color);
  gl.vertexAttribPointer(program.color, 4, gl.UNSIGNED_BYTE, true, 16, 12);
  gl.drawArrays(gl.TRIANGLES, 0, count);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);
};
