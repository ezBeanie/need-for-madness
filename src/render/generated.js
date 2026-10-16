// Textures and models the game makes itself: the cars' textures, ground, sky, dust,\nsparks and the checkpoint text's colours.

import { random } from "../core/random.js";
import { game } from "../core/state.js";
import { fixcar } from "../race/physics.js";
import { car, racers } from "../race/racers.js";
import { hslToRgb, rgbToHsl } from "../ui/color.js";
import { images } from "../ui/images.js";
import { gl, keepDamageTexture } from "./renderer.js";
import {
  carModels,
  carTextures,
  checkpointText,
  dustTextures,
  ground,
  scene,
  sky,
  sparkModels,
  spriteTextures,
} from "./scene.js";

// Formerly undeclared, so implicitly global: declared here to keep their behaviour in strict mode.
export function cartextures() {
  for (var i = 0; i < 19; i++) {
    carModels[i].nt = 2;
    carModels[i].texture = [];
    carModels[i].texture[0] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, carModels[i].texture[0]);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      carTextures[i],
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    var framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      carModels[i].texture[0],
      0,
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
      var pixels = new Uint8Array(256 * 256 * 4);
      gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      for (var p = 0; p < 256 * 256 * 4; p += 4) {
        if (pixels[p] == 116 && pixels[p + 1] == 130 && pixels[p + 2] == 140) {
          pixels[p] = 92;
          pixels[p + 1] = 155;
          pixels[p + 2] = 184;
          pixels[p + 3] = 200;
        }
      }
      gl.bindTexture(gl.TEXTURE_2D, carModels[i].texture[0]);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        256,
        256,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.deleteFramebuffer(framebuffer);
  }
}
export function gamecartextures() {
  for (var c = 0; c < game.carCount; c++) {
    if (carModels[car[c].typ].loaded == 4) {
      gl.deleteTexture(carModels[car[c].typ].texture[1]);
      carModels[car[c].typ].texture[1] = null;
    }
    var pixels = null;
    carModels[car[c].typ].texture[1] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, carModels[car[c].typ].texture[1]);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      carTextures[car[c].typ],
    );
    gl.generateMipmap(gl.TEXTURE_2D);
    var framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      carModels[car[c].typ].texture[1],
      0,
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
      pixels = new Uint8Array(256 * 256 * 4);
      gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      for (var p = 0; p < 256 * 256 * 4; p += 4) {
        if (pixels[p] == 116 && pixels[p + 1] == 130 && pixels[p + 2] == 140) {
          pixels[p] = scene.glassColor[0];
          pixels[p + 1] = scene.glassColor[1];
          pixels[p + 2] = scene.glassColor[2];
          pixels[p + 3] = 210;
        }
      }
      gl.bindTexture(gl.TEXTURE_2D, carModels[car[c].typ].texture[1]);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        256,
        256,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    gl.deleteFramebuffer(framebuffer);
    keepDamageTexture(carModels[car[c].typ], pixels);
    carModels[car[c].typ].cleanPixels = pixels && Uint8Array.from(pixels);
    carModels[car[c].typ].ont = 1;
    carModels[car[c].typ].loaded = 4;
  }
  // The first car of a type dents the type's model, as every car did when all types
  // differed. Further cars of that type get their own copy to dent and scratch, sharing
  // what never changes (normals, texture coordinates, the paint texture).
  for (var c = 0; c < game.carCount; c++) {
    var model = carModels[car[c].typ];
    var shared = false;
    for (var o = 0; o < c; o++) {
      if (car[o].typ == car[c].typ) {
        shared = true;
      }
    }
    racers[c].body = model;
    if (shared) {
      racers[c].body = {
        ...model,
        texture: [model.texture[0], null],
        vbuf: null,
      };
      fixcar(c);
    }
  }
}
export function groundtexture(n, r, g, b, huef, satf) {
  if (ground.loaded == 4) {
    gl.deleteTexture(ground.texture);
    ground.texture = null;
    for (var i = 6; i < 9; i++) {
      for (var j = 0; j < 5; j++) {
        gl.deleteTexture(dustTextures[i][j]);
        dustTextures[i][j] = null;
      }
    }
  }
  if (n == -1) {
    n = 0;
  }
  if (huef == -1) {
    huef = 0;
  }
  if (satf == -1) {
    satf = 0;
  }
  var hsl = rgbToHsl(r, g, b);
  ground.texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, ground.texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    images.ground[n],
  );
  gl.generateMipmap(gl.TEXTURE_2D);
  var framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    ground.texture,
    0,
  );
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
    var pixels = new Uint8Array(256 * 256 * 4);
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    for (var p = 0; p < 256 * 256 * 4; p += 4) {
      var hue = hsl[0] + (1 - pixels[p] / 188) * huef;
      if (hue > 1) {
        hue -= 1;
      }
      if (hue < 0) {
        hue += 1;
      }
      var sat = hsl[1] + (1 - pixels[p] / 188) * satf;
      if (sat > 1) {
        sat = 1;
      }
      if (sat < 0) {
        sat = 0;
      }
      var bri = hsl[2] * (pixels[p] / 192);
      if (bri > 1) {
        bri = 1;
      }
      if (bri < 0) {
        bri = 0;
      }
      var rgb = hslToRgb(hue, sat, bri);
      pixels[p] = rgb[0];
      pixels[p + 1] = rgb[1];
      pixels[p + 2] = rgb[2];
    }
    gl.bindTexture(gl.TEXTURE_2D, ground.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      256,
      256,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
  }
  gl.deleteFramebuffer(framebuffer);
  hsl[2] *= 1.2;
  if (hsl[2] > 1) {
    hsl[2] = 1;
  }
  var rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
  for (var i = 6; i < 9; i++) {
    dustTextures[i] = [];
    for (var j = 0; j < 5; j++) {
      dustTextures[i][j] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, dustTextures[i][j]);
      var ui = i - 6;
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        images.sprites[ui],
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      var framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        dustTextures[i][j],
        0,
      );
      if (
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE
      ) {
        var pixels = new Uint8Array(64 * 64 * 4);
        gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        for (var p = 0; p < 64 * 64 * 4; p += 4) {
          pixels[p] = rgb[0];
          pixels[p + 1] = rgb[1];
          pixels[p + 2] = rgb[2];
          pixels[p + 3] *= 0.75 - j * 0.15;
        }
        gl.bindTexture(gl.TEXTURE_2D, dustTextures[i][j]);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          64,
          64,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        gl.generateMipmap(gl.TEXTURE_2D);
      }
      gl.deleteFramebuffer(framebuffer);
    }
  }
  ground.loaded = 4;
}
export function skytexture(skyc, fogc, cloudsc, cloudtyp) {
  if (sky.loaded == 4) {
    gl.deleteTexture(sky.texture);
    sky.texture = null;
  }
  var tempt = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tempt);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    images.halo,
  );
  var framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    tempt,
    0,
  );
  var hpixels = new Uint8Array(256 * 256 * 4);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, hpixels);
  }
  gl.deleteFramebuffer(framebuffer);
  gl.deleteTexture(tempt);
  sky.texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, sky.texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    images.sky[cloudtyp],
  );
  gl.generateMipmap(gl.TEXTURE_2D);
  framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    sky.texture,
    0,
  );
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
    var pixels = new Uint8Array(256 * 256 * 4);
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    for (var p = 0; p < 256 * 256 * 4; p += 4) {
      var hfact = hpixels[p] / 510;
      var fact = pixels[p] / 128 - hfact * 2;
      if (fact > 1) {
        fact = 1;
      }
      if (fact < 0) {
        fact = 0;
      }
      pixels[p] =
        (skyc[0] * (1 - fact) + cloudsc[0] * fact) * (1 - hfact) +
        fogc[0] * hfact;
      pixels[p + 1] =
        (skyc[1] * (1 - fact) + cloudsc[1] * fact) * (1 - hfact) +
        fogc[1] * hfact;
      pixels[p + 2] =
        (skyc[2] * (1 - fact) + cloudsc[2] * fact) * (1 - hfact) +
        fogc[2] * hfact;
    }
    gl.bindTexture(gl.TEXTURE_2D, sky.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      256,
      256,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
  }
  gl.deleteFramebuffer(framebuffer);
  sky.loaded = 4;
}
export function creatdustextures() {
  for (var i = 0; i < 6; i++) {
    dustTextures[i] = [];
    for (var j = 0; j < 5; j++) {
      dustTextures[i][j] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, dustTextures[i][j]);
      var ui = i;
      if (i >= 3) {
        ui = i - 3;
      }
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        images.sprites[ui],
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      var framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        dustTextures[i][j],
        0,
      );
      if (
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE
      ) {
        var pixels = new Uint8Array(64 * 64 * 4);
        gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        for (var p = 0; p < 64 * 64 * 4; p += 4) {
          if (i < 3) {
            pixels[p] = 192;
            pixels[p + 1] = 192;
            pixels[p + 2] = 192;
            pixels[p + 3] *= 0.5 - j * 0.1;
          } else {
            pixels[p] = 228;
            pixels[p + 1] = 217;
            pixels[p + 2] = 192;
            pixels[p + 3] *= (5 - j) / 5;
          }
        }
        gl.bindTexture(gl.TEXTURE_2D, dustTextures[i][j]);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          64,
          64,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        gl.generateMipmap(gl.TEXTURE_2D);
      }
      gl.deleteFramebuffer(framebuffer);
    }
  }
  for (var i = 0; i < 3; i++) {
    spriteTextures[i] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, spriteTextures[i]);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      images.sprites[i],
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    var framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      spriteTextures[i],
      0,
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
      var pixels = new Uint8Array(64 * 64 * 4);
      gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      for (var p = 0; p < 64 * 64 * 4; p += 4) {
        pixels[p] = 65;
        pixels[p + 1] = 186;
        pixels[p + 2] = 255;
        pixels[p + 3] *= 0.5;
      }
      gl.bindTexture(gl.TEXTURE_2D, spriteTextures[i]);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        64,
        64,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.deleteFramebuffer(framebuffer);
  }
}
export function createsparks() {
  var neg = 1;
  for (var s = 0; s < 6; s++) {
    if (sparkModels[s].loaded == 1) {
      gl.deleteBuffer(sparkModels[s].vbuf);
      sparkModels[s].vbuf = null;
      gl.deleteBuffer(sparkModels[s].cbuf);
      sparkModels[s].cbuf = null;
      gl.deleteBuffer(sparkModels[s].ibuf);
      sparkModels[s].ibuf = null;
    }
    var vert = [];
    var indice = [];
    var von = random.fx() * 1;
    var negvon = 1;
    if (random.fx() > random.fx()) {
      negvon = -1;
    }
    var varn = 20 + random.fx() * 10;
    var size = 0.2 + s * 0.04;
    var ox = [-0.5 * size, 0.5 * size, 0];
    var oy = [0.5 * neg * size, -0.5 * neg * size, 0];
    var oz = [von * negvon * size, -von * negvon * size, -varn];
    if (neg == 1) {
      neg = -1;
    } else {
      neg = 1;
    }
    for (var i = 0; i < 3; i++) {
      indice[i] = i;
      vert[i * 3] = ox[i];
      vert[i * 3 + 1] = oy[i];
      vert[i * 3 + 2] = oz[i];
    }
    var col = [
      1 + 1 * scene.tint[0],
      0.77 + 0.77 * scene.tint[1],
      0,
      1,
      1 + 1 * scene.tint[0],
      0.77 + 0.77 * scene.tint[1],
      0,
      1,
      1 + 1 * scene.tint[0],
      0,
      0,
      0.4,
    ];
    sparkModels[s].ni = 3;
    sparkModels[s].vbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sparkModels[s].vbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
    sparkModels[s].cbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sparkModels[s].cbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
    sparkModels[s].ibuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sparkModels[s].ibuf);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indice),
      gl.STATIC_DRAW,
    );
    sparkModels[s].alpha = true;
    sparkModels[s].mat = mat4.create();
    sparkModels[s].x = s * 10;
    sparkModels[s].y = 5;
    sparkModels[s].loaded = 1;
  }
}
export function colorcptext() {
  gl.deleteBuffer(checkpointText.cbuf);
  checkpointText.cbuf = null;
  var cupr = [62, 160, 252, 192];
  var cdnr = [211, 234, 255, 192];
  for (var k = 0; k < 3; k++) {
    cupr[i] += cupr[i] * scene.tint[i];
    if (cupr[i] < 0) {
      cupr[i] = 0;
    }
    if (cupr[i] > 255) {
      cupr[i] = 255;
    }
    cdnr[i] += cdnr[i] * scene.tint[i];
    if (cdnr[i] < 0) {
      cdnr[i] = 0;
    }
    if (cdnr[i] > 255) {
      cdnr[i] = 255;
    }
  }
  var col = [];
  for (var i = 0; i < checkpointText.vert.length / 3; i++) {
    if (checkpointText.vert[i * 3 + 1] < 0) {
      for (var k = 0; k < 4; k++) {
        col[i * 4 + k] = cupr[k] / 255;
      }
    } else {
      for (var k = 0; k < 4; k++) {
        col[i * 4 + k] = cdnr[k] / 255;
      }
    }
  }
  checkpointText.cbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, checkpointText.cbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
}
