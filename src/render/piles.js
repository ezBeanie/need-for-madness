// The original's rock piles (see data/pile.js) as models of this game: their faces in
// flat colours, ground the cars drive on.
import { pileColor } from "../data/pile.js";
import { buildModel } from "./models.js";
import { gl } from "./renderer.js";

const FACES = 5;

// A texture of one pixel per face, in its colour.
const faceColors = (colors) => {
  const pixels = new Uint8Array(FACES * 4);
  colors.forEach((color, k) => pixels.set([...color, 255], k * 4));
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    FACES,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixels,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
};

// The face's normal, up out of the pile (y up, as the model's file would have it).
const normalOf = ([a, b, c]) => {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const length = Math.hypot(...n) || 1;
  const up = n[1] < 0 ? -1 : 1;
  return n.map((x) => (x / length) * up);
};

// Builds the pile into the model, coloured from the stage's ground.
export const buildPileModel = (model, pile, ground) => {
  const vertices = [];
  const normals = [];
  const texcoords = [];
  const triangles = [];
  pile.faces.forEach((face, k) => {
    // the original's units and axes into a model file's: ten times smaller, y up
    const points = face.points.map(([x, y, z]) => [x / 10, -y / 10, z / 10]);
    const first = vertices.length / 3;
    points.forEach((point) => vertices.push(...point));
    normals.push(...normalOf(points));
    texcoords.push((k + 0.5) / FACES, 0.5);
    for (let i = 1; i < points.length - 1; i++) {
      triangles.push(first, k, k, first + i, k, k, first + i + 1, k, k);
    }
  });
  buildModel(model, {
    directives: [{ command: "intershad", value: "" }],
    vertices,
    normals,
    texcoords,
    triangles,
  });
  model.texture = faceColors(
    pile.faces.map((face) => pileColor(face.shade, ground, ground)),
  );
  model.loaded = 2;
};
