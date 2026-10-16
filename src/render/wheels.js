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

export function createwheels() {
  var wlw = [
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
  var rmd = [
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
  for (var c = 0; c < 19; c++) {
    for (var k = 0; k < 2; k++) {
      wheelDisks[c][k].ni = wheelDisk.tri.length / 3;
      var indice = [];
      var vert = [];
      var norm = [];
      var texu = [];
      for (var i = 0; i < wheelDisks[c][k].ni; i++) {
        indice[i] = i;
        vert[i * 3] =
          wheelDisk.vrt[wheelDisk.tri[i * 3] * 3] * carStats.wlh[c][k] * 1.05;
        vert[i * 3 + 1] =
          wheelDisk.vrt[wheelDisk.tri[i * 3] * 3 + 1] *
          carStats.wlh[c][k] *
          1.05;
        vert[i * 3 + 2] =
          wheelDisk.vrt[wheelDisk.tri[i * 3] * 3 + 2] * wlw[c][k] * 1.1;
        if (wheelDisk.tri[i * 3] == 12) {
          vert[i * 3 + 2] += rmd[c][k];
        }
        var tcrad = Math.sqrt(
          vert[i * 3] * vert[i * 3] +
            vert[i * 3 + 1] * vert[i * 3 + 1] +
            vert[i * 3 + 2] * vert[i * 3 + 2],
        );
        if (tcrad > wheelDisks[c][k].colrad) {
          wheelDisks[c][k].colrad = tcrad;
        }
        norm[i * 3] = wheelDisk.nrm[wheelDisk.tri[i * 3 + 1] * 3];
        norm[i * 3 + 1] = wheelDisk.nrm[wheelDisk.tri[i * 3 + 1] * 3 + 1];
        norm[i * 3 + 2] = wheelDisk.nrm[wheelDisk.tri[i * 3 + 1] * 3 + 2];
        texu[i * 2] = wheelDisk.tex[wheelDisk.tri[i * 3 + 2] * 2];
        texu[i * 2 + 1] = 1 - wheelDisk.tex[wheelDisk.tri[i * 3 + 2] * 2 + 1];
      }
      wheelDisks[c][k].vbuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, wheelDisks[c][k].vbuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
      wheelDisks[c][k].nbuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, wheelDisks[c][k].nbuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(norm), gl.STATIC_DRAW);
      wheelDisks[c][k].tbuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, wheelDisks[c][k].tbuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texu), gl.STATIC_DRAW);
      wheelDisks[c][k].ibuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wheelDisks[c][k].ibuf);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indice),
        gl.STATIC_DRAW,
      );
      wheelDisks[c][k].nt = 1;
      wheelDisks[c][k].mat = mat4.create();
      wheelDisks[c][k].alpha = 1;
      wheelDisks[c][k].texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, wheelDisks[c][k].texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        images.tires[c],
      );
      if (
        isPowerOf2(images.tires[0].width) &&
        isPowerOf2(images.tires[0].height)
      ) {
        gl.generateMipmap(gl.TEXTURE_2D);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      wheelDisks[c][k].loaded = 1;
      wheelTreads[c][k].ni = wheelTread.indice.length;
      var vert = [];
      var norm = [];
      var col = [];
      for (var i = 0; i < wheelTread.vert.length / 3; i++) {
        vert[i * 3] = wheelTread.vert[i * 3] * 1.1 * carStats.wlh[c][k];
        vert[i * 3 + 1] = wheelTread.vert[i * 3 + 1] * 1.1 * carStats.wlh[c][k];
        vert[i * 3 + 2] = wheelTread.vert[i * 3 + 2] * 1.1 * wlw[c][k];
        norm[i * 3] = -1;
        norm[i * 3 + 1] = 0;
        norm[i * 3 + 2] = 0;
        col[i * 4] = 0.02;
        col[i * 4 + 1] = 0.02;
        col[i * 4 + 2] = 0.02;
        col[i * 4 + 3] = 1;
      }
      wheelTreads[c][k].vbuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, wheelTreads[c][k].vbuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
      wheelTreads[c][k].nbuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, wheelTreads[c][k].nbuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(norm), gl.STATIC_DRAW);
      wheelTreads[c][k].cbuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, wheelTreads[c][k].cbuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
      wheelTreads[c][k].ibuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wheelTreads[c][k].ibuf);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(wheelTread.indice),
        gl.STATIC_DRAW,
      );
      wheelTreads[c][k].mat = mat4.create();
      wheelTreads[c][k].loaded = 1;
      wheelTreadsLow[c][k].ni = wheelTreadLow.indice.length;
      var vert = [];
      var col = [];
      for (var i = 0; i < wheelTreadLow.vert.length / 3; i++) {
        vert[i * 3] = wheelTreadLow.vert[i * 3] * 1.1 * carStats.wlh[c][k];
        vert[i * 3 + 1] =
          wheelTreadLow.vert[i * 3 + 1] * 1.1 * carStats.wlh[c][k];
        vert[i * 3 + 2] = wheelTreadLow.vert[i * 3 + 2] * 1.1 * wlw[c][k];
        col[i * 4] = 0.02;
        col[i * 4 + 1] = 0.02;
        col[i * 4 + 2] = 0.02;
        col[i * 4 + 3] = 1;
      }
      wheelTreadsLow[c][k].vbuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, wheelTreadsLow[c][k].vbuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
      wheelTreadsLow[c][k].cbuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, wheelTreadsLow[c][k].cbuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
      wheelTreadsLow[c][k].ibuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wheelTreadsLow[c][k].ibuf);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(wheelTreadLow.indice),
        gl.STATIC_DRAW,
      );
      wheelTreadsLow[c][k].mat = mat4.create();
      wheelTreadsLow[c][k].loaded = 1;
    }
  }
}
