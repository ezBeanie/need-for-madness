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
const pack = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;

const vertex = (x, y, color) => {
  const at = count * WORDS_PER_VERTEX;
  words[at] = x;
  words[at + 1] = y;
  colors[at + 2] = color;
  count++;
};

export const startBatch = () => {
  count = 0;
};

const cross = (xs, ys, a, b, c) =>
  (xs[b] - xs[a]) * (ys[c] - ys[a]) - (ys[b] - ys[a]) * (xs[c] - xs[a]);

const inside = (xs, ys, a, b, c, p, orientation) =>
  // strictly: the tyre's side runs twice through the corners where it cuts to its hole
  cross(xs, ys, a, b, p) * orientation > 0 &&
  cross(xs, ys, b, c, p) * orientation > 0 &&
  cross(xs, ys, c, a, p) * orientation > 0;

// A polygon, as a fan from its first corner; one with a hole (a tyre's side, cut to the
// hole for its rim) is cut ear by ear instead.
export const fillPolygon = (xs, ys, n, r, g, b, holed = false) => {
  const color = pack(r, g, b);
  reserve(n * 3);
  if (!holed) {
    for (let i = 1; i < n - 1; i++) {
      vertex(xs[0], ys[0], color);
      vertex(xs[i], ys[i], color);
      vertex(xs[i + 1], ys[i + 1], color);
    }
    return;
  }
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += xs[i] * ys[j] - xs[j] * ys[i];
  }
  const orientation = Math.sign(area) || 1;
  const left = Array.from({ length: n }, (_, i) => i);
  let guard = n * n;
  while (left.length > 3 && guard-- > 0) {
    for (let k = 0; k < left.length; k++) {
      const a = left[(k + left.length - 1) % left.length];
      const c = left[k];
      const d = left[(k + 1) % left.length];
      if (cross(xs, ys, a, c, d) * orientation <= 0) {
        continue;
      }
      const ear = left.every(
        (p) =>
          p == a ||
          p == c ||
          p == d ||
          !inside(xs, ys, a, c, d, p, orientation),
      );
      if (ear) {
        vertex(xs[a], ys[a], color);
        vertex(xs[c], ys[c], color);
        vertex(xs[d], ys[d], color);
        left.splice(k, 1);
        break;
      }
    }
  }
  if (left.length == 3) {
    vertex(xs[left[0]], ys[left[0]], color);
    vertex(xs[left[1]], ys[left[1]], color);
    vertex(xs[left[2]], ys[left[2]], color);
  }
};

// A polygon's outline, each edge a strip one pixel wide.
export const drawPolygon = (xs, ys, n, r, g, b) => {
  const color = pack(r, g, b);
  reserve(n * 6);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = xs[j] - xs[i];
    const dy = ys[j] - ys[i];
    const length = Math.hypot(dx, dy) || 1;
    // half a pixel to each side, and half a pixel past each end
    const nx = (-dy / length) * 0.5;
    const ny = (dx / length) * 0.5;
    const ex = (dx / length) * 0.5;
    const ey = (dy / length) * 0.5;
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
  gl.disable(gl.BLEND);
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
};
