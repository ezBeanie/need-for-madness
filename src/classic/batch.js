// What the classic look draws in a frame, as the original's Java2D drew it: filled and
// outlined polygons in screen pixels, each painted over what came before. Everything goes
// into one buffer in that order and is drawn at once; with no depth test, the order alone
// decides what covers what, so fills and outlines must never be split apart.
import { gl } from "../render/renderer.js";

// x, y and a colour packed into four bytes, per vertex
const WORDS_PER_VERTEX = 3;
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

const vertex = (x, y, color) => {
  const at = count * WORDS_PER_VERTEX;
  words[at] = x;
  words[at + 1] = y;
  colors[at + 2] = color;
  count++;
};

// how wide a pixel of the original is on the canvas (1 at its 450 rows)
let pixel = 1;

export const setPixelSize = (size) => {
  pixel = size;
};

export const startBatch = () => {
  count = 0;
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
    vertex(xs[0], ys[0], color);
    vertex(xs[i], ys[i], color);
    vertex(xs[i + 1], ys[i + 1], color);
  }
};

// A polygon's outline, each edge a strip one of the original's pixels wide.
export const drawPolygon = (xs, ys, n, r, g, b) => {
  const color = pack(r, g, b);
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
    vertex(ax + nx, ay + ny, color);
    vertex(bx + nx, by + ny, color);
    vertex(bx - nx, by - ny, color);
    vertex(ax + nx, ay + ny, color);
    vertex(bx - nx, by - ny, color);
    vertex(ax - nx, ay - ny, color);
  }
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
      "attribute vec2 aPosition; attribute vec4 aColor; uniform vec2 uSize; " +
        "varying lowp vec4 vColor; void main(void) { " +
        "gl_Position = vec4(aPosition.x / uSize.x * 2.0 - 1.0, " +
        "1.0 - aPosition.y / uSize.y * 2.0, 0.0, 1.0); vColor = aColor; }",
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

// Draws the frame's polygons onto the 3D canvas, whose pixels are the screen's (w x h).
export const flushBatch = (w, h) => {
  program ??= makeProgram();
  buffer ??= gl.createBuffer();
  gl.disable(gl.DEPTH_TEST);
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
  gl.vertexAttribPointer(program.position, 2, gl.FLOAT, false, 12, 0);
  gl.enableVertexAttribArray(program.color);
  gl.vertexAttribPointer(program.color, 4, gl.UNSIGNED_BYTE, true, 12, 8);
  gl.drawArrays(gl.TRIANGLES, 0, count);
  gl.disable(gl.BLEND);
};
