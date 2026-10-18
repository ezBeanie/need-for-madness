// The wheels of a car body: where they sit and which way they face.

import { carStats } from "../data/carStats.js";
import { resetMatrix } from "./interpolation.js";
import { images } from "../ui/images.js";
import { gl, isPowerOf2 } from "./renderer.js";
import {
  wheelDisk,
  wheelDisks,
  wheelTread,
  wheelTreadLow,
  wheelTreads,
  wheelTreadsLow,
} from "./scene.js";

// wheel 0 front left, 1 front right, 2 rear left, 3 rear right
export const isLeftWheel = (index) => index % 2 == 0;

// Puts the wheel at its place on the body of a car of the given type, turned with the body
// and then sideways (turned further by steering, in degrees).
export const placeWheel = (wheel, body, type, index, steering = 0) => {
  const axle = index < 2 ? 0 : 1;
  const across = (isLeftWheel(index) ? -1 : 1) * carStats.wlx[type][axle];
  const down = carStats.wly[type][axle];
  const along = carStats.wlz[type][axle];
  const m = body.mat;
  wheel.x = body.x + across * m[0] - down * m[4] + along * m[8];
  wheel.y = body.y + across * m[1] - down * m[5] + along * m[9];
  wheel.z = body.z + across * m[2] - down * m[6] + along * m[10];
  wheel.mat = resetMatrix(wheel.mat);
  for (let k = 0; k < 12; k++) {
    wheel.mat[k] = m[k];
  }
  const facing = isLeftWheel(index) ? 90 : -90;
  mat4.rotate(
    wheel.mat,
    wheel.mat,
    (facing - steering) * (Math.PI / 180),
    [0, 1, 0],
  );
};

// per car type, front and rear: how wide the wheels are, and how far their hub (vertex 12
// of the disk model) stands out
const WHEEL_WIDTH = [
  [1.8, 1.8],
  [2.2, 2.5],
  [2.2, 2.2],
  [1.9, 1.9],
  [2, 2],
  [1.9, 1.9],
  [2, 2],
  [2.9, 4],
  [1.8, 1.8],
  [2.1, 2.1],
  [2.1, 2.1],
  [2, 2],
  [2.5, 2.5],
  [1.8, 1.8],
  [3.2, 3.2],
  [2.3, 2.3],
  [5, 5],
  [2, 2],
  [4.4, 4.4],
];
const HUB_DEPTH = [
  [-0.15, -0.15],
  [0.6, 0.6],
  [-0.1, -0.1],
  [0.3, 0.3],
  [0.1, 0.1],
  [-0.1, -0.1],
  [0.7, 0.7],
  [1.1, 1.1],
  [0.9, 0.9],
  [-0.5, -0.5],
  [0.8, 0.8],
  [0.6, 0.6],
  [-3, -3],
  [0.5, 0.5],
  [1, 1],
  [0.8, 0.8],
  [1.3, 1.3],
  [0.8, 0.8],
  [0.4, 0.4],
];
const HUB = 12;

const buffer = (target, data) => {
  const made = gl.createBuffer();
  gl.bindBuffer(target, made);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return made;
};

const dark = (vertexCount) =>
  Array.from({ length: vertexCount }, () => [0.02, 0.02, 0.02, 1]).flat();

// The wheels of every car type, front and rear: the disk (with the type's tire texture)
// and the tread, both scaled to the type's wheel size.
export function createWheels() {
  for (let c = 0; c < WHEEL_WIDTH.length; c++) {
    for (let k = 0; k < 2; k++) {
      buildDisk(wheelDisks[c][k], c, k);
      buildTread(wheelTreads[c][k], wheelTread, c, k, true);
      buildTread(wheelTreadsLow[c][k], wheelTreadLow, c, k, false);
    }
  }
}

const buildDisk = (disk, c, k) => {
  disk.ni = wheelDisk.tri.length / 3;
  const indices = [];
  const vertices = [];
  const normals = [];
  const texture = [];
  const height = carStats.wlh[c][k];
  for (let i = 0; i < disk.ni; i++) {
    const v = wheelDisk.tri[i * 3];
    const n = wheelDisk.tri[i * 3 + 1];
    const t = wheelDisk.tri[i * 3 + 2];
    indices[i] = i;
    vertices[i * 3] = wheelDisk.vrt[v * 3] * height * 1.05;
    vertices[i * 3 + 1] = wheelDisk.vrt[v * 3 + 1] * height * 1.05;
    vertices[i * 3 + 2] = wheelDisk.vrt[v * 3 + 2] * WHEEL_WIDTH[c][k] * 1.1;
    if (v == HUB) {
      vertices[i * 3 + 2] += HUB_DEPTH[c][k];
    }
    const radius = Math.sqrt(
      vertices[i * 3] * vertices[i * 3] +
        vertices[i * 3 + 1] * vertices[i * 3 + 1] +
        vertices[i * 3 + 2] * vertices[i * 3 + 2],
    );
    if (radius > disk.colrad) {
      disk.colrad = radius;
    }
    normals[i * 3] = wheelDisk.nrm[n * 3];
    normals[i * 3 + 1] = wheelDisk.nrm[n * 3 + 1];
    normals[i * 3 + 2] = wheelDisk.nrm[n * 3 + 2];
    texture[i * 2] = wheelDisk.tex[t * 2];
    texture[i * 2 + 1] = 1 - wheelDisk.tex[t * 2 + 1];
  }
  disk.vbuf = buffer(gl.ARRAY_BUFFER, new Float32Array(vertices));
  disk.nbuf = buffer(gl.ARRAY_BUFFER, new Float32Array(normals));
  disk.tbuf = buffer(gl.ARRAY_BUFFER, new Float32Array(texture));
  disk.ibuf = buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices));
  disk.nt = 1;
  disk.mat = mat4.create();
  disk.alpha = 1;
  disk.texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, disk.texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    images.tires[c],
  );
  // as in the original, the first tire image decides for all
  if (isPowerOf2(images.tires[0].width) && isPowerOf2(images.tires[0].height)) {
    gl.generateMipmap(gl.TEXTURE_2D);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  disk.loaded = 1;
};

// A dark tread of the shape `from`; the detailed one is lit from the side.
const buildTread = (tread, from, c, k, lit) => {
  tread.ni = from.indice.length;
  const vertices = [];
  for (let i = 0; i < from.vert.length / 3; i++) {
    vertices[i * 3] = from.vert[i * 3] * 1.1 * carStats.wlh[c][k];
    vertices[i * 3 + 1] = from.vert[i * 3 + 1] * 1.1 * carStats.wlh[c][k];
    vertices[i * 3 + 2] = from.vert[i * 3 + 2] * 1.1 * WHEEL_WIDTH[c][k];
  }
  const vertexCount = from.vert.length / 3;
  tread.vbuf = buffer(gl.ARRAY_BUFFER, new Float32Array(vertices));
  if (lit) {
    const normals = Array.from({ length: vertexCount }, () => [-1, 0, 0]);
    tread.nbuf = buffer(gl.ARRAY_BUFFER, new Float32Array(normals.flat()));
  }
  tread.cbuf = buffer(gl.ARRAY_BUFFER, new Float32Array(dark(vertexCount)));
  tread.ibuf = buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(from.indice));
  tread.mat = mat4.create();
  tread.loaded = 1;
};
