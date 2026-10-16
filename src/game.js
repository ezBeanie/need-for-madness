import {
  isSpecialFix,
  parseStage,
  pathType,
  valueOf,
} from "./data/stageFormat.js";
import {
  cosDeg as mcos,
  distance as pyd,
  distanceSquared as rpy,
  distanceSquaredXZ as pyo,
  distanceXZ as py,
  rotateAxes as rotomat,
  rotatePoints as rotate,
  sinDeg as msin,
} from "./core/math.js";
import {
  interfaceResolution,
  isFirefox,
  isIos,
  isPhone,
} from "./core/platform.js";
import { random } from "./core/random.js";
import {
  audio,
  engine,
  isEngineLoaded,
  loadEngine,
  loadSound,
  pauseMenuMusic,
  pauseMusic,
  playMenuMusic,
  playSound,
  playStageMusic,
  resumeMusic,
  resumeStageMusic,
  startEngine,
  stopEngine,
  stopStageMusic,
  unlockAudio,
} from "./audio/audio.js";
import {
  bumpSound,
  coolDownCarSounds,
  crashSound,
  groundScrapeSound,
  scrapeSound,
  skidSound,
} from "./audio/carSounds.js";
import { installKeyboard } from "./input/keyboard.js";
import { installPointer, pointer } from "./input/pointer.js";
import {
  attachTo,
  drawCamera,
  drawMatrix,
  interpolation,
  placeCamera,
  placeModel,
  resetMatrix,
} from "./render/interpolation.js";
import {
  canvas3D,
  drawModel,
  drawParticle,
  gl,
  isPowerOf2,
  loadTextureGroup,
  setWorld,
  textureGroups,
} from "./render/renderer.js";
import {
  loadModel,
  loadParticleModel,
  newModel,
  newParticleModel,
} from "./render/models.js";
import { canvas2D, rd, view } from "./ui/view.js";
import { camera } from "./render/camera.js";
import { carModels, carShadows, scene, sparkModels } from "./render/scene.js";
import { game, PHASE } from "./core/state.js";
import { tick } from "./core/tick.js";
import { car, racers } from "./race/racers.js";
import { carStats } from "./data/carStats.js";
import { pieceModels, pieces, track } from "./race/track.js";
import { recording } from "./race/recording.js";
import { effects } from "./race/effects.js";
import { control, inishcontrol, resetPursuit } from "./race/ai.js";

// Formerly undeclared, so implicitly global: declared here to keep their behaviour in strict mode.
var camrs, pyclos, pnext, pback, onycl;
function cartextures() {
  for (var i = 0; i < 19; i++) {
    var loadthis = false;
    if (stanza == 0) {
      loadthis = true;
    }
    if (stanza == 1) {
      for (var c = 0; c < game.carCount; c++) {
        if (game.carTypes[c] == i) {
          loadthis = true;
        }
      }
    }
    if (stanza == 2) {
      loadthis = true;
      for (var c = 0; c < game.carCount; c++) {
        if (game.carTypes[c] == i) {
          loadthis = false;
        }
      }
    }
    if (loadthis) {
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
        cartexture[i],
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
      if (
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE
      ) {
        var pixels = new Uint8Array(256 * 256 * 4);
        gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        for (var p = 0; p < 256 * 256 * 4; p += 4) {
          if (
            pixels[p] == 116 &&
            pixels[p + 1] == 130 &&
            pixels[p + 2] == 140
          ) {
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
}
function gamecartextures() {
  for (var c = 0; c < game.carCount; c++) {
    if (carModels[car[c].typ].loaded == 4) {
      gl.deleteTexture(carModels[car[c].typ].texture[1]);
      carModels[car[c].typ].texture[1] = null;
    }
    carModels[car[c].typ].texture[1] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, carModels[car[c].typ].texture[1]);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      cartexture[car[c].typ],
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
      var pixels = new Uint8Array(256 * 256 * 4);
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
    carModels[car[c].typ].ont = 1;
    carModels[car[c].typ].loaded = 4;
  }
}
function groundtexture(n, r, g, b, huef, satf) {
  if (ground.loaded == 4) {
    gl.deleteTexture(ground.texture);
    ground.texture = null;
    for (var i = 6; i < 9; i++) {
      for (var j = 0; j < 5; j++) {
        gl.deleteTexture(dtexture[i][j]);
        dtexture[i][j] = null;
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
    grndimg[n],
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
    dtexture[i] = [];
    for (var j = 0; j < 5; j++) {
      dtexture[i][j] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, dtexture[i][j]);
      var ui = i - 6;
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        spritexture[ui],
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      var framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        dtexture[i][j],
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
        gl.bindTexture(gl.TEXTURE_2D, dtexture[i][j]);
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
function skytexture(skyc, fogc, cloudsc, cloudtyp) {
  if (skydom.loaded == 4) {
    gl.deleteTexture(skydom.texture);
    skydom.texture = null;
  }
  var tempt = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tempt);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, haloimg);
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
  skydom.texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, skydom.texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    skyimg[cloudtyp],
  );
  gl.generateMipmap(gl.TEXTURE_2D);
  framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    skydom.texture,
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
    gl.bindTexture(gl.TEXTURE_2D, skydom.texture);
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
  skydom.loaded = 4;
}
var dtexture = [];
var stexture = [];
function creatdustextures() {
  for (var i = 0; i < 6; i++) {
    dtexture[i] = [];
    for (var j = 0; j < 5; j++) {
      dtexture[i][j] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, dtexture[i][j]);
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
        spritexture[ui],
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      var framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        dtexture[i][j],
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
        gl.bindTexture(gl.TEXTURE_2D, dtexture[i][j]);
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
    stexture[i] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, stexture[i]);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      spritexture[i],
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
      stexture[i],
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
      gl.bindTexture(gl.TEXTURE_2D, stexture[i]);
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
var tired = [];
var tiren = [];
var tirel = [];
for (var i = 0; i < 19; i++) {
  tired[i] = [];
  tiren[i] = [];
  tirel[i] = [];
  for (var k = 0; k < 2; k++) {
    tired[i][k] = newModel();
    tiren[i][k] = newParticleModel();
    tirel[i][k] = newParticleModel();
  }
}
function wheel() {
  return { x: 0, y: 0, z: 0, mat: null, dist: 0 };
}
var whl = [];
for (var i = 0; i < 19; i++) {
  whl[i] = [];
  for (var k = 0; k < 4; k++) {
    whl[i][k] = wheel();
  }
}

function createwheels() {
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
    var loadthis = false;
    if (stanza == 0) {
      loadthis = true;
    }
    if (stanza == 1) {
      for (var i = 0; i < game.carCount; i++) {
        if (game.carTypes[i] == c) {
          loadthis = true;
        }
      }
    }
    if (stanza == 2) {
      loadthis = true;
      for (var i = 0; i < game.carCount; i++) {
        if (game.carTypes[i] == c) {
          loadthis = false;
        }
      }
    }
    if (loadthis) {
      for (var k = 0; k < 2; k++) {
        tired[c][k].ni = tiredisk.tri.length / 3;
        var indice = [];
        var vert = [];
        var norm = [];
        var texu = [];
        for (var i = 0; i < tired[c][k].ni; i++) {
          indice[i] = i;
          vert[i * 3] =
            tiredisk.vrt[tiredisk.tri[i * 3] * 3] * carStats.wlh[c][k] * 1.05;
          vert[i * 3 + 1] =
            tiredisk.vrt[tiredisk.tri[i * 3] * 3 + 1] *
            carStats.wlh[c][k] *
            1.05;
          vert[i * 3 + 2] =
            tiredisk.vrt[tiredisk.tri[i * 3] * 3 + 2] * wlw[c][k] * 1.1;
          if (tiredisk.tri[i * 3] == 12) {
            vert[i * 3 + 2] += rmd[c][k];
          }
          var tcrad = Math.sqrt(
            vert[i * 3] * vert[i * 3] +
              vert[i * 3 + 1] * vert[i * 3 + 1] +
              vert[i * 3 + 2] * vert[i * 3 + 2],
          );
          if (tcrad > tired[c][k].colrad) {
            tired[c][k].colrad = tcrad;
          }
          norm[i * 3] = tiredisk.nrm[tiredisk.tri[i * 3 + 1] * 3];
          norm[i * 3 + 1] = tiredisk.nrm[tiredisk.tri[i * 3 + 1] * 3 + 1];
          norm[i * 3 + 2] = tiredisk.nrm[tiredisk.tri[i * 3 + 1] * 3 + 2];
          texu[i * 2] = tiredisk.tex[tiredisk.tri[i * 3 + 2] * 2];
          texu[i * 2 + 1] = 1 - tiredisk.tex[tiredisk.tri[i * 3 + 2] * 2 + 1];
        }
        tired[c][k].vbuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tired[c][k].vbuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
        tired[c][k].nbuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tired[c][k].nbuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(norm), gl.STATIC_DRAW);
        tired[c][k].tbuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tired[c][k].tbuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texu), gl.STATIC_DRAW);
        tired[c][k].ibuf = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tired[c][k].ibuf);
        gl.bufferData(
          gl.ELEMENT_ARRAY_BUFFER,
          new Uint16Array(indice),
          gl.STATIC_DRAW,
        );
        tired[c][k].nt = 1;
        tired[c][k].mat = mat4.create();
        tired[c][k].alpha = 1;
        tired[c][k].texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tired[c][k].texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          tireimg[c],
        );
        if (isPowerOf2(tireimg[0].width) && isPowerOf2(tireimg[0].height)) {
          gl.generateMipmap(gl.TEXTURE_2D);
        } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        tired[c][k].loaded = 1;
        tiren[c][k].ni = tire.indice.length;
        var vert = [];
        var norm = [];
        var col = [];
        for (var i = 0; i < tire.vert.length / 3; i++) {
          vert[i * 3] = tire.vert[i * 3] * 1.1 * carStats.wlh[c][k];
          vert[i * 3 + 1] = tire.vert[i * 3 + 1] * 1.1 * carStats.wlh[c][k];
          vert[i * 3 + 2] = tire.vert[i * 3 + 2] * 1.1 * wlw[c][k];
          norm[i * 3] = -1;
          norm[i * 3 + 1] = 0;
          norm[i * 3 + 2] = 0;
          col[i * 4] = 0.02;
          col[i * 4 + 1] = 0.02;
          col[i * 4 + 2] = 0.02;
          col[i * 4 + 3] = 1;
        }
        tiren[c][k].vbuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tiren[c][k].vbuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
        tiren[c][k].nbuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tiren[c][k].nbuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(norm), gl.STATIC_DRAW);
        tiren[c][k].cbuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tiren[c][k].cbuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
        tiren[c][k].ibuf = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tiren[c][k].ibuf);
        gl.bufferData(
          gl.ELEMENT_ARRAY_BUFFER,
          new Uint16Array(tire.indice),
          gl.STATIC_DRAW,
        );
        tiren[c][k].mat = mat4.create();
        tiren[c][k].loaded = 1;
        tirel[c][k].ni = tirelow.indice.length;
        var vert = [];
        var col = [];
        for (var i = 0; i < tirelow.vert.length / 3; i++) {
          vert[i * 3] = tirelow.vert[i * 3] * 1.1 * carStats.wlh[c][k];
          vert[i * 3 + 1] = tirelow.vert[i * 3 + 1] * 1.1 * carStats.wlh[c][k];
          vert[i * 3 + 2] = tirelow.vert[i * 3 + 2] * 1.1 * wlw[c][k];
          col[i * 4] = 0.02;
          col[i * 4 + 1] = 0.02;
          col[i * 4 + 2] = 0.02;
          col[i * 4 + 3] = 1;
        }
        tirel[c][k].vbuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tirel[c][k].vbuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
        tirel[c][k].cbuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tirel[c][k].cbuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
        tirel[c][k].ibuf = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tirel[c][k].ibuf);
        gl.bufferData(
          gl.ELEMENT_ARRAY_BUFFER,
          new Uint16Array(tirelow.indice),
          gl.STATIC_DRAW,
        );
        tirel[c][k].mat = mat4.create();
        tirel[c][k].loaded = 1;
      }
    }
  }
}
function setwheelspos() {
  for (var c = 0; c < game.carCount; c++) {
    var cn = car[c].typ;
    whl[cn][0].x =
      car[c].x -
      carStats.wlx[cn][0] * car[c].mat[0] -
      carStats.wly[cn][0] * car[c].mat[4] +
      carStats.wlz[cn][0] * car[c].mat[8];
    whl[cn][0].y =
      car[c].y -
      carStats.wlx[cn][0] * car[c].mat[1] -
      carStats.wly[cn][0] * car[c].mat[5] +
      carStats.wlz[cn][0] * car[c].mat[9];
    whl[cn][0].z =
      car[c].z -
      carStats.wlx[cn][0] * car[c].mat[2] -
      carStats.wly[cn][0] * car[c].mat[6] +
      carStats.wlz[cn][0] * car[c].mat[10];
    whl[cn][0].mat = resetMatrix(whl[cn][0].mat);
    for (var k = 0; k < 12; k++) {
      whl[cn][0].mat[k] = car[c].mat[k];
    }
    mat4.rotate(
      whl[cn][0].mat,
      whl[cn][0].mat,
      (90 - car[c].wxz) * (Math.PI / 180),
      [0, 1, 0],
    );
    mat4.rotate(
      whl[cn][0].mat,
      whl[cn][0].mat,
      car[c].wzy * (Math.PI / 180),
      [0, 0, -1],
    );
    whl[cn][1].x =
      car[c].x +
      carStats.wlx[cn][0] * car[c].mat[0] -
      carStats.wly[cn][0] * car[c].mat[4] +
      carStats.wlz[cn][0] * car[c].mat[8];
    whl[cn][1].y =
      car[c].y +
      carStats.wlx[cn][0] * car[c].mat[1] -
      carStats.wly[cn][0] * car[c].mat[5] +
      carStats.wlz[cn][0] * car[c].mat[9];
    whl[cn][1].z =
      car[c].z +
      carStats.wlx[cn][0] * car[c].mat[2] -
      carStats.wly[cn][0] * car[c].mat[6] +
      carStats.wlz[cn][0] * car[c].mat[10];
    whl[cn][1].mat = resetMatrix(whl[cn][1].mat);
    for (var k = 0; k < 12; k++) {
      whl[cn][1].mat[k] = car[c].mat[k];
    }
    mat4.rotate(
      whl[cn][1].mat,
      whl[cn][1].mat,
      (-90 - car[c].wxz) * (Math.PI / 180),
      [0, 1, 0],
    );
    mat4.rotate(
      whl[cn][1].mat,
      whl[cn][1].mat,
      car[c].wzy * (Math.PI / 180),
      [0, 0, 1],
    );
    whl[cn][2].x =
      car[c].x -
      carStats.wlx[cn][1] * car[c].mat[0] -
      carStats.wly[cn][1] * car[c].mat[4] +
      carStats.wlz[cn][1] * car[c].mat[8];
    whl[cn][2].y =
      car[c].y -
      carStats.wlx[cn][1] * car[c].mat[1] -
      carStats.wly[cn][1] * car[c].mat[5] +
      carStats.wlz[cn][1] * car[c].mat[9];
    whl[cn][2].z =
      car[c].z -
      carStats.wlx[cn][1] * car[c].mat[2] -
      carStats.wly[cn][1] * car[c].mat[6] +
      carStats.wlz[cn][1] * car[c].mat[10];
    whl[cn][2].mat = resetMatrix(whl[cn][2].mat);
    for (var k = 0; k < 12; k++) {
      whl[cn][2].mat[k] = car[c].mat[k];
    }
    mat4.rotate(
      whl[cn][2].mat,
      whl[cn][2].mat,
      90 * (Math.PI / 180),
      [0, 1, 0],
    );
    mat4.rotate(
      whl[cn][2].mat,
      whl[cn][2].mat,
      car[c].wzy * (Math.PI / 180),
      [0, 0, -1],
    );
    whl[cn][3].x =
      car[c].x +
      carStats.wlx[cn][1] * car[c].mat[0] -
      carStats.wly[cn][1] * car[c].mat[4] +
      carStats.wlz[cn][1] * car[c].mat[8];
    whl[cn][3].y =
      car[c].y +
      carStats.wlx[cn][1] * car[c].mat[1] -
      carStats.wly[cn][1] * car[c].mat[5] +
      carStats.wlz[cn][1] * car[c].mat[9];
    whl[cn][3].z =
      car[c].z +
      carStats.wlx[cn][1] * car[c].mat[2] -
      carStats.wly[cn][1] * car[c].mat[6] +
      carStats.wlz[cn][1] * car[c].mat[10];
    whl[cn][3].mat = resetMatrix(whl[cn][3].mat);
    for (var k = 0; k < 12; k++) {
      whl[cn][3].mat[k] = car[c].mat[k];
    }
    mat4.rotate(
      whl[cn][3].mat,
      whl[cn][3].mat,
      -90 * (Math.PI / 180),
      [0, 1, 0],
    );
    mat4.rotate(
      whl[cn][3].mat,
      whl[cn][3].mat,
      car[c].wzy * (Math.PI / 180),
      [0, 0, 1],
    );
    for (var j = 0; j < 4; j++) {
      whl[cn][j].dist = pyd(
        whl[cn][j].x,
        camera.x,
        whl[cn][j].y,
        camera.y,
        whl[cn][j].z,
        camera.z,
      );
    }
  }
}

function shadoworks() {
  for (var c = 0; c < game.carCount; c++) {
    var cat = 0.5;
    if (Math.abs(car[c].mat[9]) > Math.abs(car[c].mat[1])) {
      cat = 0.4;
    }
    if (Math.abs(car[c].mat[5]) < cat) {
      if (Math.abs(car[c].mat[9]) > Math.abs(car[c].mat[1])) {
        carShadows[car[c].typ].x = car[c].x;
        carShadows[car[c].typ].z = car[c].z;
        carShadows[car[c].typ].ont = 2;
        carShadows[car[c].typ].mat[0] = car[c].mat[0];
        carShadows[car[c].typ].mat[2] = car[c].mat[2];
        carShadows[car[c].typ].mat[4] = car[c].mat[8];
        carShadows[car[c].typ].mat[6] = car[c].mat[10];
        carShadows[car[c].typ].mat[8] = -car[c].mat[4];
        carShadows[car[c].typ].mat[10] = -car[c].mat[6];
      } else {
        carShadows[car[c].typ].x =
          car[c].x - carStats.shadadj[car[c].typ] * car[c].mat[8];
        carShadows[car[c].typ].z =
          car[c].z - carStats.shadadj[car[c].typ] * car[c].mat[10];
        carShadows[car[c].typ].ont = 1;
        carShadows[car[c].typ].mat[0] = car[c].mat[8];
        carShadows[car[c].typ].mat[2] = car[c].mat[10];
        carShadows[car[c].typ].mat[4] = car[c].mat[0];
        carShadows[car[c].typ].mat[6] = car[c].mat[2];
        carShadows[car[c].typ].mat[8] = -car[c].mat[4];
        carShadows[car[c].typ].mat[10] = -car[c].mat[6];
      }
    } else {
      carShadows[car[c].typ].x =
        car[c].x - carStats.shadadj[car[c].typ] * car[c].mat[8];
      carShadows[car[c].typ].z =
        car[c].z - carStats.shadadj[car[c].typ] * car[c].mat[10];
      carShadows[car[c].typ].ont = 0;
      carShadows[car[c].typ].mat[0] = car[c].mat[8];
      carShadows[car[c].typ].mat[2] = car[c].mat[10];
      carShadows[car[c].typ].mat[4] = car[c].mat[4];
      carShadows[car[c].typ].mat[6] = car[c].mat[6];
      carShadows[car[c].typ].mat[8] = car[c].mat[0];
      carShadows[car[c].typ].mat[10] = car[c].mat[2];
    }
    carShadows[car[c].typ].intershad = false;
    carShadows[car[c].typ].y = 0.4;
    carShadows[car[c].typ].mat[1] = 0;
    carShadows[car[c].typ].mat[5] = 1;
    carShadows[car[c].typ].mat[9] = 0;
    for (var i = 0; i < pieces.count; i++) {
      if (pieceModels[pieces.list[i].typ].intershad) {
        pieceModels[pieces.list[i].typ].x = pieces.list[i].x;
        pieceModels[pieces.list[i].typ].y = pieces.list[i].y;
        pieceModels[pieces.list[i].typ].z = pieces.list[i].z;
        pieceModels[pieces.list[i].typ].mat = pieces.list[i].mat;
        shadowmap(
          car[c],
          carShadows[car[c].typ],
          pieceModels[pieces.list[i].typ],
        );
      }
    }
  }
}
function shadowmap(crft, shd, rad) {
  if (
    Math.abs(crft.x - rad.x) < carModels[crft.typ].colrad + rad.colrad &&
    Math.abs(crft.z - rad.z) < carModels[crft.typ].colrad + rad.colrad
  ) {
    var snormx = 0;
    var snormy = 0;
    var snormz = 0;
    for (var i = 0; i < rad.ni / 3; i++) {
      var vertx = [];
      var verty = [];
      var vertz = [];
      for (var v = 0; v < 3; v++) {
        var vp = rad.tri[i * 9 + v * 3];
        vertx[v] =
          -(rad.vrt[vp * 3] * rad.mat[0]) + rad.vrt[vp * 3 + 2] * rad.mat[8];
        verty[v] = rad.vrt[vp * 3 + 1];
        vertz[v] =
          rad.vrt[vp * 3 + 2] * rad.mat[10] - rad.vrt[vp * 3] * rad.mat[2];
      }
      var areaOrig = Math.abs(
        (vertx[1] - vertx[0]) * (vertz[2] - vertz[0]) -
          (vertx[2] - vertx[0]) * (vertz[1] - vertz[0]),
      );
      var px = shd.x - rad.x;
      var pz = shd.z - rad.z;
      var area1 = Math.abs(
        (vertx[0] - px) * (vertz[1] - pz) - (vertx[1] - px) * (vertz[0] - pz),
      );
      var area2 = Math.abs(
        (vertx[1] - px) * (vertz[2] - pz) - (vertx[2] - px) * (vertz[1] - pz),
      );
      var area3 = Math.abs(
        (vertx[2] - px) * (vertz[0] - pz) - (vertx[0] - px) * (vertz[2] - pz),
      );
      if (area1 + area2 + area3 <= areaOrig + 10) {
        var vp = rad.tri[i * 9 + 1];
        if (rad.nrm[vp * 3 + 1] > 0.06) {
          var fct = 0;
          if (vertz[0] - vertz[1] != 0) {
            fct = (shd.z - (vertz[1] + rad.z)) / (vertz[0] - vertz[1]);
          } else {
            fct = 0;
          }
          var lx = vertx[1] + (vertx[0] - vertx[1]) * fct;
          var ly = verty[1] + (verty[0] - verty[1]) * fct;
          if (vertz[0] - vertz[2] != 0) {
            fct = (shd.z - (vertz[2] + rad.z)) / (vertz[0] - vertz[2]);
          } else {
            fct = 0;
          }
          var tx = vertx[2] + (vertx[0] - vertx[2]) * fct;
          var ty = verty[2] + (verty[0] - verty[2]) * fct;
          if (tx - lx != 0) {
            fct = (shd.x - (lx + rad.x)) / (tx - lx);
          } else {
            fct = 0;
          }
          var shdy = ly + (ty - ly) * fct;
          if (shdy < crft.y && shdy > shd.y - 0.5) {
            snormx =
              -(rad.nrm[vp * 3] * rad.mat[0]) +
              rad.nrm[vp * 3 + 2] * rad.mat[8];
            snormy = rad.nrm[vp * 3 + 1];
            snormz =
              rad.nrm[vp * 3 + 2] * rad.mat[10] - rad.nrm[vp * 3] * rad.mat[2];
            if (Math.abs(snormy) > 0.1) {
              var diz = -1;
              if (shd.ont == 0) {
                if (crft.mat[5] < 0) {
                  diz = 1;
                }
              }
              if (shd.ont == 1) {
                if (crft.mat[1] < 0) {
                  diz = 1;
                }
              }
              if (shd.ont == 2) {
                if (crft.mat[9] > 0) {
                  diz = 1;
                }
              }
              shd.mat[1] = -(snormx * shd.mat[0]) + diz * snormz * shd.mat[8];
              shd.mat[5] = snormy;
              shd.mat[9] = -(snormz * shd.mat[10]) + diz * snormx * shd.mat[2];
              shd.y = shdy;
              shd.intershad = true;
            }
          }
        }
      }
    }
  }
}
function createsparks() {
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
function colorcptext() {
  gl.deleteBuffer(cptext.cbuf);
  cptext.cbuf = null;
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
  for (var i = 0; i < cptext.vert.length / 3; i++) {
    if (cptext.vert[i * 3 + 1] < 0) {
      for (var k = 0; k < 4; k++) {
        col[i * 4 + k] = cupr[k] / 255;
      }
    } else {
      for (var k = 0; k < 4; k++) {
        col[i * 4 + k] = cdnr[k] / 255;
      }
    }
  }
  cptext.cbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cptext.cbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
}
function colorbgst() {
  gl.deleteBuffer(bgst.cbuf);
  bgst.cbuf = null;
  var r = Math.floor(128 - 128 * scene.tint[0]);
  if (r > 255) {
    r = 255;
  }
  if (r < 0) {
    r = 0;
  }
  var g = Math.floor(128 - 128 * scene.tint[1]);
  if (g > 255) {
    g = 255;
  }
  if (g < 0) {
    g = 0;
  }
  var b = Math.floor(128 - 128 * scene.tint[2]);
  if (b > 255) {
    b = 255;
  }
  if (b < 0) {
    b = 0;
  }
  var hsl = rgbToHsl(r, g, b);
  var rgb1 = hslToRgb(hsl[0], 1, 0.94);
  rgb1[3] = 255;
  var rgb2 = hslToRgb(hsl[0], 1, 0.7);
  rgb2[3] = 255;
  var col = [];
  for (var i = 0; i < cptext.vert.length / 3; i++) {
    if (i == 0) {
      for (var k = 0; k < 4; k++) {
        col[i * 4 + k] = rgb1[k] / 255;
      }
    } else {
      for (var k = 0; k < 4; k++) {
        col[i * 4 + k] = rgb2[k] / 255;
      }
    }
  }
  bgst.cbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bgst.cbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
}
function colorbgstforend() {
  gl.deleteBuffer(bgst.cbuf);
  bgst.cbuf = null;
  var r = Math.floor(128 - 128 * scene.tint[0]);
  if (r > 255) {
    r = 255;
  }
  if (r < 0) {
    r = 0;
  }
  var g = Math.floor(128 - 128 * scene.tint[1]);
  if (g > 255) {
    g = 255;
  }
  if (g < 0) {
    g = 0;
  }
  var b = Math.floor(128 - 128 * scene.tint[2]);
  if (b > 255) {
    b = 255;
  }
  if (b < 0) {
    b = 0;
  }
  var hsl = rgbToHsl(r, g, b);
  var rgb1 = hslToRgb(hsl[0], 0.4, 0.15);
  rgb1[3] = 255;
  var rgb2 = hslToRgb(hsl[0], 0.4, 0.1);
  rgb2[3] = 255;
  var col = [];
  for (var i = 0; i < cptext.vert.length / 3; i++) {
    if (i == 0) {
      for (var k = 0; k < 4; k++) {
        col[i * 4 + k] = rgb1[k] / 255;
      }
    } else {
      for (var k = 0; k < 4; k++) {
        col[i * 4 + k] = rgb2[k] / 255;
      }
    }
  }
  bgst.cbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bgst.cbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
}
function getonscreen(m, rad) {
  var x = rad.mat[12];
  var y = rad.mat[13];
  var z = rad.mat[14];
  var w = x * m[0 * 4 + 3] + y * m[1 * 4 + 3] + z * m[2 * 4 + 3] + m[3 * 4 + 3];
  var propoint = [
    (x * m[0 * 4 + 0] + y * m[1 * 4 + 0] + z * m[2 * 4 + 0] + m[3 * 4 + 0]) / w,
    (x * m[0 * 4 + 1] + y * m[1 * 4 + 1] + z * m[2 * 4 + 1] + m[3 * 4 + 1]) / w,
    (x * m[0 * 4 + 2] + y * m[1 * 4 + 2] + z * m[2 * 4 + 2] + m[3 * 4 + 2]) / w,
  ];
  return [
    (propoint[0] * 0.5 + 0.5) * view.width,
    (propoint[1] * -0.5 + 0.5) * view.height,
  ];
}
function hslToRgb(h, s, l) {
  var r, g, b;
  if (s == 0) {
    r = g = b = l;
  } else {
    var hue2rgb = function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function rgbToHsl(r, g, b) {
  (r /= 255), (g /= 255), (b /= 255);
  var max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  var h,
    s,
    l = (max + min) / 2;
  if (max == min) {
    h = s = 0;
  } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}
var impimg = new Image();
impimg.src = "data/interface" + interfaceResolution + "/loading.png";
var ground = newModel();
var grndimg = [];
var skydom = newModel();
var skyimg = [];
var haloimg = null;
var cartexture = [];
var tireimg = [];
var tiredisk = newModel();
var tire = newParticleModel();
var tirelow = newParticleModel();
var cptext = newParticleModel();
var fntext = newParticleModel();
var bgst = newParticleModel();
var timetube = newParticleModel();
var fixdisk = newModel();
var elec = newModel();
var sprite = newModel();
var spritexture = [];
var explode = [];
for (var i = 0; i < 3; i++) {
  explode[i] = newModel();
}
var bg3D = newModel();
var contimg = [];
var btimg = [];
var muimg = [];
var lbar, rbar, lckd;
var mainbg, rider, logo;
var insano = [];
var inst = [];
var confeloaded = false;
var confe = [];
function loadconfe() {
  if (!confeloaded) {
    for (var i = 0; i < 29; i++) {
      confe[i] = new Image();
      confe[i].src =
        "data/interface" + interfaceResolution + "/conf/" + i + ".png";
    }
    confeloaded = true;
  }
}
var reqload = 0;
var dataload = 500;
var datacnt = 3816;
if (isPhone) {
  datacnt = 3770;
}
var stanza = 0;
function loaddata() {
  if (gl) {
    drawloading();
    if (reqload == 0) {
      if (stanza == 0) {
        onskip = false;
        game.carTypes[0] = getInfo("carsel");
        if (game.carTypes[0] == -1) {
          game.carTypes[0] = 5;
          onskip = true;
          onautocorrect = 2;
        }
        game.unlocked = getInfo("unlocked");
        if (game.unlocked == -1) {
          game.unlocked = 1;
        }
        track.stage = game.unlocked;
        if (game.unlocked >= 5) {
          cntkeys = 200;
        }
        if (track.stage == 17) {
          track.stage = Math.floor(3 + random.sim() * 13);
          canreset = true;
        }
      }
    }
    if (reqload == 1) {
      var frm = 0,
        tro = 3;
      if (stanza == 1) {
        frm = 2;
        tro = 3;
      }
      if (stanza == 2) {
        frm = 0;
        tro = 2;
      }
      loadModel("data/3D/ground.r3d", ground);
      for (var i = frm; i < tro; i++) {
        grndimg[i] = new Image();
        grndimg[i].onload = function () {
          dataload += 17;
        };
        grndimg[i].src = "data/3D/textures/ground" + (i + 1) + ".png";
      }
      loadModel("data/3D/skydom.r3d", skydom);
      for (var i = frm; i < tro; i++) {
        skyimg[i] = new Image();
        skyimg[i].onload = function () {
          dataload += 24;
        };
        skyimg[i].src = "data/3D/textures/sky" + (i + 1) + ".png";
      }
      haloimg = new Image();
      haloimg.onload = function () {
        dataload += 5;
      };
      haloimg.src = "data/3D/textures/halo.png";
    }
    if (reqload == 2) {
      if (stanza != 2) {
        loadModel("data/3D/tiredisk.r3d", tiredisk);
        loadParticleModel("data/3D/tire.prt", tire);
        loadParticleModel("data/3D/tirelow.prt", tirelow);
        loadParticleModel("data/3D/cptext.prt", cptext);
        loadParticleModel("data/3D/fntext.prt", fntext);
        loadParticleModel("data/3D/timetube.prt", timetube);
      }
      if (stanza != 1) {
        loadParticleModel("data/3D/bg.prt", bgst);
      }
    }
    if (reqload == 3) {
      for (var i = 0; i < 19; i++) {
        var loadthis = false;
        if (stanza == 0) {
          loadthis = true;
        }
        if (stanza == 1) {
          for (var c = 0; c < game.carCount; c++) {
            if (game.carTypes[c] == i) {
              loadthis = true;
            }
          }
        }
        if (stanza == 2) {
          loadthis = true;
          for (var c = 0; c < game.carCount; c++) {
            if (game.carTypes[c] == i) {
              loadthis = false;
            }
          }
        }
        if (loadthis) {
          loadModel("data/3D/car" + i + ".r3d", carModels[i]);
          loadModel("data/3D/s" + i + ".r3d", carShadows[i]);
          cartexture[i] = new Image();
          cartexture[i].onload = function () {
            dataload += 9;
          };
          cartexture[i].src = "data/3D/textures/car" + i + ".png";
          tireimg[i] = new Image();
          tireimg[i].onload = function () {
            dataload += 2;
          };
          tireimg[i].src = "data/3D/textures/t" + i + ".png";
        }
      }
    }
    if (reqload == 4) {
      var defb = [
        "road",
        "froad",
        "twister2",
        "twister1",
        "turn",
        "offroad",
        "bumproad",
        "offturn",
        "nroad",
        "nturn",
        "roblend",
        "noblend",
        "rnblend",
        "roadend",
        "offroadend",
        "hpground",
        "ramp30",
        "cramp35",
        "dramp15",
        "dhilo15",
        "slide10",
        "takeoff",
        "sramp22",
        "offbump",
        "offramp",
        "sofframp",
        "halfpipe",
        "spikes",
        "rail",
        "thewall",
        "checkpoint",
        "fixpoint",
        "offcheckpoint",
        "sideoff",
        "bsideoff",
        "uprise",
        "riseroad",
        "sroad",
        "soffroad",
        "tside",
        "launchpad",
        "takeoffb",
        "speedramp",
        "offhill",
        "slider",
        "uphill",
        "roll1",
        "roll2",
        "roll3",
        "roll4",
        "roll5",
        "roll6",
        "opile1",
        "opile2",
        "aircheckpoint",
        "tree1",
        "tree2",
        "tree3",
        "tree4",
        "tree5",
        "tree6",
        "tree7",
        "tree8",
        "cac1",
        "cac2",
        "cac3",
      ];
      var onfrst = [
        37, 0, 16, 30, 4, 12, 8, 9, 11, 5, 25, 31, 14, 6, 23, 59, 58, 57, 56,
        55, 29,
      ];
      for (var i = 0; i < 66; i++) {
        if (i != 40) {
          var loadthis = false;
          if (stanza == 0) {
            loadthis = true;
          }
          if (stanza == 1) {
            for (var k = 0; k < onfrst.length; k++) {
              if (onfrst[k] == i) {
                loadthis = true;
              }
            }
          }
          if (stanza == 2) {
            loadthis = true;
            for (var k = 0; k < onfrst.length; k++) {
              if (onfrst[k] == i) {
                loadthis = false;
              }
            }
          }
          if (loadthis) {
            loadModel("data/3D/" + defb[i] + ".r3d", pieceModels[i]);
          }
        }
      }
    }
    if (reqload == 5) {
      if (stanza != 2) {
        loadModel("data/3D/sprite.r3d", sprite);
        for (var i = 0; i < 3; i++) {
          spritexture[i] = new Image();
          spritexture[i].onload = function () {
            dataload++;
          };
          spritexture[i].src = "data/3D/textures/sp" + i + ".png";
        }
        loadModel("data/3D/fixdisk.r3d", fixdisk);
        loadModel("data/3D/elec.r3d", elec);
        for (var i = 0; i < 3; i++) {
          loadModel("data/3D/exp" + i + ".r3d", explode[i]);
        }
      }
    }
    if (reqload == 6) {
      var onfrst = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 17, 18];
      for (var i = 0; i < 19; i++) {
        var loadthis = false;
        if (stanza == 0) {
          loadthis = true;
        }
        if (stanza == 1) {
          for (var k = 0; k < onfrst.length; k++) {
            if (onfrst[k] == i) {
              loadthis = true;
            }
          }
        }
        if (stanza == 2) {
          loadthis = true;
          for (var k = 0; k < onfrst.length; k++) {
            if (onfrst[k] == i) {
              loadthis = false;
            }
          }
        }
        if (loadthis) {
          loadTextureGroup(textureGroups[i], i);
        }
      }
    }
    if (reqload == 7) {
      if (stanza != 1) {
        loadModel("data/3D/bg.r3d", bg3D);
      }
      if (stanza != 2) {
        if (isPhone) {
          for (var i = 0; i < 6; i++) {
            contimg[i] = new Image();
            contimg[i].onload = function () {
              dataload++;
            };
            contimg[i].src =
              "data/interface" + interfaceResolution + "/cn" + i + ".png";
          }
        }
        for (var i = 0; i < 7; i++) {
          btimg[i] = new Image();
          btimg[i].onload = function () {
            dataload++;
          };
          btimg[i].src =
            "data/interface" + interfaceResolution + "/btn" + (i + 1) + ".png";
        }
        for (var i = 0; i < 6; i++) {
          muimg[i] = new Image();
          muimg[i].onload = function () {
            dataload++;
          };
          muimg[i].src =
            "data/interface" + interfaceResolution + "/mu" + i + ".png";
        }
      }
    }
    if (reqload == 8) {
      if (stanza != 1) {
        lbar = new Image();
        lbar.onload = function () {
          dataload++;
        };
        lbar.src = "data/interface" + interfaceResolution + "/lbar.png";
        rbar = new Image();
        rbar.onload = function () {
          dataload++;
        };
        rbar.src = "data/interface" + interfaceResolution + "/rbar.png";
        lckd = new Image();
        lckd.onload = function () {
          dataload++;
        };
        lckd.src = "data/interface" + interfaceResolution + "/locked.png";
        mainbg = new Image();
        mainbg.onload = function () {
          dataload += 402;
        };
        mainbg.src = "data/interface" + interfaceResolution + "/mainbg.png";
        rider = new Image();
        rider.onload = function () {
          dataload += 14;
        };
        rider.src = "data/interface" + interfaceResolution + "/rider.png";
        logo = new Image();
        logo.onload = function () {
          dataload += 20;
        };
        logo.src = "data/interface" + interfaceResolution + "/logo.png";
      }
      if (stanza != 2) {
        for (var i = 0; i < 6; i++) {
          insano[i] = new Image();
          insano[i].onload = function () {
            dataload += 20;
          };
          insano[i].src =
            "data/interface" + interfaceResolution + "/insano" + i + ".png";
        }
        for (var i = 0; i < 11; i++) {
          if (i < 5 || !isPhone || i == 8 || i == 10) {
            inst[i] = new Image();
            inst[i].onload = function () {
              dataload += 13;
            };
            inst[i].src = "data/interface1/int" + (i + 1) + ".png";
          }
        }
      }
    }
    if (reqload != 9) {
      reqload++;
    }
    if (tiredisk.loaded == 1) {
      dataload++;
      tiredisk.loaded++;
    }
    if (tire.loaded == 1) {
      dataload++;
      tire.loaded++;
    }
    if (tirelow.loaded == 1) {
      dataload++;
      tirelow.loaded++;
    }
    if (cptext.loaded == 1) {
      dataload += 4;
      cptext.loaded++;
    }
    if (fntext.loaded == 1) {
      dataload += 4;
      fntext.loaded++;
    }
    if (timetube.loaded == 1) {
      dataload++;
      timetube.loaded++;
    }
    if (bgst.loaded == 1) {
      dataload++;
      bgst.loaded++;
    }
    if (ground.loaded && ground.loaded == ground.nt + 1) {
      dataload++;
      ground.loaded++;
    }
    if (skydom.loaded && skydom.loaded == skydom.nt + 1) {
      dataload++;
      skydom.loaded++;
    }
    for (var i = 0; i < 19; i++) {
      if (carModels[i].loaded && carModels[i].loaded == carModels[i].nt + 1) {
        dataload += 31;
        carModels[i].loaded++;
      }
    }
    for (var i = 0; i < 66; i++) {
      if (
        i != 40 &&
        pieceModels[i].loaded &&
        pieceModels[i].loaded == pieceModels[i].nt + 1
      ) {
        dataload += 7;
        pieceModels[i].loaded++;
      }
    }
    for (var i = 0; i < 19; i++) {
      if (textureGroups[i].loaded == 1) {
        dataload += 44;
        textureGroups[i].loaded++;
      }
    }
    if (sprite.loaded && sprite.loaded == sprite.nt + 1) {
      dataload++;
      sprite.loaded++;
    }
    if (fixdisk.loaded && fixdisk.loaded == fixdisk.nt + 1) {
      dataload++;
      fixdisk.loaded++;
    }
    if (elec.loaded && elec.loaded == elec.nt + 1) {
      dataload++;
      elec.loaded++;
    }
    for (var i = 0; i < 3; i++) {
      if (explode[i].loaded && explode[i].loaded == explode[i].nt + 1) {
        dataload += 18;
        explode[i].loaded++;
      }
    }
    if (bg3D.loaded && bg3D.loaded == bg3D.nt + 1) {
      dataload += 309;
      bg3D.loaded++;
    }
    if (dataload == datacnt) {
      cartextures();
      createwheels();
      if (stanza == 0 || stanza == 1) {
        creatdustextures();
        for (var i = 0; i < 43; i++) {
          loadSound(i);
        }
      }
      if (stanza == 0) {
        fredo = 0;
        game.phase = PHASE.mainMenu;
      }
      if (stanza == 1) {
        stageloadtyp = 2;
        stageload = -1;
        game.phase = PHASE.stageLoading;
      }
      if (stanza == 2) {
        fredo = 0;
        game.phase = PHASE.mainMenu;
      }
    }
  } else {
    rd.fillStyle = "#000000";
    rd.fillRect(0, 0, view.width, view.height);
    rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px teko";
    rd.textAlign = "left";
    rd.textBaseline = "middle";
    rd.fillStyle = "#FFFFFF";
    rd.fillText(
      "Sorry, your device does not seem to have WEBGL",
      30 * view.scaleX,
      100 * view.scaleY,
    );
    rd.fillText(
      "The game will not be able to work without it",
      30 * view.scaleX,
      160 * view.scaleY,
    );
    rd.fillText(
      "Please try the game on another device",
      30 * view.scaleX,
      220 * view.scaleY,
    );
  }
}
var limr = 0,
  liml = 0,
  limt = 0,
  limb = 0;
var limro = 0,
  limlo = 0,
  limto = 0,
  limbo = 0;
var adod = 0;
var lvx = 0,
  lvy = 1,
  lvz = 0;
var fogdist = 10700;
var fogc = [];
var hastip = 0;
var tip = [];
function newobo() {
  return { typ: 0, x: 0, z: 0, mat: null, bnd: [0, 0, 0, 0], iscp: 0 };
}

var stageload = 0;
function loadstage() {
  stageload = 1;
  var rawFile = new XMLHttpRequest();
  rawFile.open("GET", "data/stages/" + track.stage + ".txt", true);
  rawFile.onreadystatechange = function () {
    if (rawFile.readyState === 4) {
      if (rawFile.status === 200 || rawFile.status == 0) {
        var allText = rawFile.responseText;
        track.n = 0;
        track.nsp = 0;
        pieces.count = 0;
        pieces.fixCount = 0;
        adod = 0;
        scene.tint = [0, 0, 0];
        var skyc = [];
        var cloudsc = [];
        var cloudtyp = 0;
        lvx = 0;
        lvy = 1;
        lvz = 0;
        var bounds = [0, 0, 0, 0];
        var bounded = false;
        hastip = 0;
        var entries = parseStage(allText);
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          var v = function (field) {
            return valueOf(e, field);
          };
          if (e.command == "name") {
            track.name = e.name ?? "";
          }
          if (e.command == "nlaps") {
            track.nlaps = v("laps");
          }
          if (e.command == "addon") {
            adod = v("count");
          }
          if (e.command == "snap") {
            scene.tint[0] = v("r") / 100;
            scene.tint[1] = v("g") / 100;
            scene.tint[2] = v("b") / 100;
          }
          if (e.command == "sky") {
            skyc[0] = v("r");
            skyc[1] = v("g");
            skyc[2] = v("b");
          }
          if (e.command == "fog") {
            fogc[0] = v("r");
            fogc[1] = v("g");
            fogc[2] = v("b");
          }
          if (e.command == "clouds") {
            cloudsc[0] = v("r");
            cloudsc[1] = v("g");
            cloudsc[2] = v("b");
            cloudtyp = v("type");
          }
          if (e.command == "ground") {
            groundtexture(
              v("texture"),
              v("r"),
              v("g"),
              v("b"),
              v("hue"),
              v("saturation"),
            );
          }
          if (track.stage >= 3 && game.unlocked == track.stage) {
            if (e.command == "tip") {
              tip[hastip] = e.text ?? "";
              tip[hastip] = tip[hastip].replace("[", "(");
              tip[hastip] = tip[hastip].replace("]", ")");
              tip[hastip] = tip[hastip].replace(";", ",");
              hastip++;
            }
          }
          if (e.command == "lightswingX") {
            var an = v("angle");
            lvy = Math.cos(an * (Math.PI / 180));
            an += 90;
            lvx = Math.cos(an * (Math.PI / 180));
          }
          if (e.command == "lightswingZ") {
            var an = v("angle");
            lvy = Math.cos(an * (Math.PI / 180));
            an += 90;
            lvz = Math.cos(an * (Math.PI / 180));
          }
          if (e.command == "distfog") {
            fogdist = v("distance");
          }
          if (e.command == "bnd") {
            bounds = [v("a"), v("b"), v("c"), v("d")];
            bounded = true;
          }
          if (e.command == "set") {
            pieces.list[pieces.count] = newobo();
            pieces.list[pieces.count].mat = mat4.create();
            pieces.list[pieces.count].typ = v("piece") - 10;
            if (bounded) {
              for (var k = 0; k < 4; k++) {
                pieces.list[pieces.count].bnd[k] = bounds[k];
              }
              bounded = false;
            }
            pieces.list[pieces.count].x = -(v("x") / 10);
            pieces.list[pieces.count].y = 0;
            pieces.list[pieces.count].z = v("z") / 10;
            var rot = v("rotation");
            mat4.rotate(
              pieces.list[pieces.count].mat,
              pieces.list[pieces.count].mat,
              rot * (Math.PI / 180),
              [0, 1, 0],
            );
            if (Math.abs(rot) == 90) {
              pieces.list[pieces.count].bx =
                pieceModels[pieces.list[pieces.count].typ].bz;
              pieces.list[pieces.count].bz =
                pieceModels[pieces.list[pieces.count].typ].bx;
            } else {
              pieces.list[pieces.count].bx =
                pieceModels[pieces.list[pieces.count].typ].bx;
              pieces.list[pieces.count].bz =
                pieceModels[pieces.list[pieces.count].typ].bz;
            }
            pieces.list[pieces.count].bx += 15;
            pieces.list[pieces.count].bz += 15;
            pieces.list[pieces.count].by =
              pieceModels[pieces.list[pieces.count].typ].by;
            if (pieces.list[pieces.count].typ == 39) {
              pieces.list[pieces.count].rot = rot;
            }
            var path = pathType(e);
            if (path !== null) {
              track.x[track.n] = pieces.list[pieces.count].x;
              track.z[track.n] = pieces.list[pieces.count].z;
              track.y[track.n] = 0;
              track.typ[track.n] = path;
              track.obi[track.n] = pieces.count;
              track.n++;
            }
            pieces.count++;
          }
          if (e.command == "chk") {
            pieces.list[pieces.count] = newobo();
            pieces.list[pieces.count].mat = mat4.create();
            pieces.list[pieces.count].typ = v("piece") - 10;
            pieces.list[pieces.count].x = -(v("x") / 10);
            pieces.list[pieces.count].y = 0.4;
            pieces.list[pieces.count].z = v("z") / 10;
            var rot = v("rotation");
            mat4.rotate(
              pieces.list[pieces.count].mat,
              pieces.list[pieces.count].mat,
              rot * (Math.PI / 180),
              [0, 1, 0],
            );
            if (pieces.list[pieces.count].typ == 54) {
              pieces.list[pieces.count].y = -(v("y") / 10);
            }
            if (Math.abs(rot) == 90) {
              pieces.list[pieces.count].bx =
                pieceModels[pieces.list[pieces.count].typ].bz;
              pieces.list[pieces.count].bz =
                pieceModels[pieces.list[pieces.count].typ].bx;
            } else {
              pieces.list[pieces.count].bx =
                pieceModels[pieces.list[pieces.count].typ].bx;
              pieces.list[pieces.count].bz =
                pieceModels[pieces.list[pieces.count].typ].bz;
            }
            pieces.list[pieces.count].bx += 15;
            pieces.list[pieces.count].bz += 15;
            pieces.list[pieces.count].by =
              pieceModels[pieces.list[pieces.count].typ].by;
            track.x[track.n] = pieces.list[pieces.count].x;
            track.z[track.n] = pieces.list[pieces.count].z;
            track.y[track.n] = pieces.list[pieces.count].y;
            track.obi[track.n] = pieces.count;
            if (rot == 0) {
              track.typ[track.n] = 1;
            } else {
              track.typ[track.n] = 2;
            }
            track.pcs = track.n;
            track.n++;
            track.obn[track.nsp] = pieces.count;
            track.nsp++;
            pieces.list[pieces.count].iscp = track.nsp;
            pieces.count++;
          }
          if (e.command == "fix") {
            pieces.list[pieces.count] = newobo();
            pieces.list[pieces.count].mat = mat4.create();
            pieces.list[pieces.count].typ = v("piece") - 10;
            pieces.list[pieces.count].x = -(v("x") / 10);
            pieces.list[pieces.count].z = v("z") / 10;
            pieces.list[pieces.count].y = -(v("y") / 10) + 25;
            var rot = v("rotation");
            mat4.rotate(
              pieces.list[pieces.count].mat,
              pieces.list[pieces.count].mat,
              rot * (Math.PI / 180),
              [0, 1, 0],
            );
            track.special[pieces.fixCount] = isSpecialFix(e);
            pieces.fixes[pieces.fixCount] = pieces.count;
            pieces.fixCount++;
            pieces.count++;
          }
          if (e.command == "maxr") {
            var num = v("count");
            var limit = -(v("limit") / 10);
            limr = limit + 5;
            limro = pieces.count;
            var strt = v("start") / 10;
            for (var c = 0; c < num; c++) {
              pieces.list[pieces.count] = newobo();
              pieces.list[pieces.count].mat = mat4.create();
              pieces.list[pieces.count].typ = 29;
              pieces.list[pieces.count].x = limit;
              pieces.list[pieces.count].y = 0;
              pieces.list[pieces.count].z = c * 480 + strt;
              pieces.count++;
            }
          }
          if (e.command == "maxl") {
            var num = v("count");
            var limit = -(v("limit") / 10);
            liml = limit - 5;
            limlo = pieces.count;
            var strt = v("start") / 10;
            for (var c = 0; c < num; c++) {
              pieces.list[pieces.count] = newobo();
              pieces.list[pieces.count].mat = mat4.create();
              pieces.list[pieces.count].typ = 29;
              pieces.list[pieces.count].x = limit;
              pieces.list[pieces.count].y = 0;
              pieces.list[pieces.count].z = c * 480 + strt;
              mat4.rotate(
                pieces.list[pieces.count].mat,
                pieces.list[pieces.count].mat,
                180 * (Math.PI / 180),
                [0, 1, 0],
              );
              pieces.count++;
            }
          }
          if (e.command == "maxt") {
            var num = v("count");
            var limit = v("limit") / 10;
            limt = limit - 5;
            limto = pieces.count;
            var strt = -v("start") / 10;
            for (var c = 0; c < num; c++) {
              pieces.list[pieces.count] = newobo();
              pieces.list[pieces.count].mat = mat4.create();
              pieces.list[pieces.count].typ = 29;
              pieces.list[pieces.count].x = -(c * 480) + strt;
              pieces.list[pieces.count].y = 0;
              pieces.list[pieces.count].z = limit;
              mat4.rotate(
                pieces.list[pieces.count].mat,
                pieces.list[pieces.count].mat,
                90 * (Math.PI / 180),
                [0, 1, 0],
              );
              pieces.count++;
            }
          }
          if (e.command == "maxb") {
            var num = v("count");
            var limit = v("limit") / 10;
            limb = limit + 5;
            limbo = pieces.count;
            var strt = -v("start") / 10;
            for (var c = 0; c < num; c++) {
              pieces.list[pieces.count] = newobo();
              pieces.list[pieces.count].mat = mat4.create();
              pieces.list[pieces.count].typ = 29;
              pieces.list[pieces.count].x = -(c * 480) + strt;
              pieces.list[pieces.count].y = 0;
              pieces.list[pieces.count].z = limit;
              mat4.rotate(
                pieces.list[pieces.count].mat,
                pieces.list[pieces.count].mat,
                -90 * (Math.PI / 180),
                [0, 1, 0],
              );
              pieces.count++;
            }
          }
        }
        track.insih();
        if (stanza != 1) {
          sortcars(track.stage);
        }
        inishinter();
        inishcars();
        inishcontrol();
        inishmad();
        inishrecord();
        skytexture(skyc, fogc, cloudsc, cloudtyp);
        for (var i = 0; i < 3; i++) {
          scene.glassColor[i] = Math.round((skyc[i] * 2 + 70) / 3);
        }
        gamecartextures();
        createsparks();
        colorcptext();
        effects.nchp = 0;
        effects.nspr = 0;
        effects.ndst = 0;
        effects.nexp = 0;
        if (stageloadtyp != 2) {
          var opsnap = [
            -(scene.tint[0] * 3),
            -(scene.tint[1] * 3),
            -(scene.tint[2] * 3),
          ];
          setWorld(opsnap, fogc, 0, 1, 0, 10700);
        } else {
          setWorld(scene.tint, fogc, lvx, lvy, lvz, fogdist);
        }
        stageload = 2;
      }
    }
  };
  rawFile.send(null);
}

var onelec = false;
function cpanimate() {
  for (var i = 0; i < pieces.fixCount; i++) {
    mat4.rotate(
      pieces.list[pieces.fixes[i]].mat,
      pieces.list[pieces.fixes[i]].mat,
      11 * tick.scale * (Math.PI / 180),
      [0, 0, 1],
    );
  }
  fixdisk.ont++;
  if (fixdisk.ont == 5) {
    fixdisk.ont = 0;
  }
  if (onelec) {
    elec.mat = resetMatrix(elec.mat);
    mat4.rotate(elec.mat, elec.mat, camera.yaw * (Math.PI / 180), [0, -1, 0]);
    mat4.rotate(elec.mat, elec.mat, camera.pitch * (Math.PI / 180), [-1, 0, 0]);
    elec.ont++;
    if (elec.ont == 5) {
      elec.ont = 0;
    }
  }
  if (track.stage == 1) {
    chkflk++;
  } else {
    chkflk += 0.2;
  }
  if (chkflk >= 5) {
    chkflk = 0;
  }
  if (oncheckpoint != -1) {
    cptext.x = pieces.list[track.obn[oncheckpoint]].x;
    cptext.y = pieces.list[track.obn[oncheckpoint]].y + 80;
    cptext.z = pieces.list[track.obn[oncheckpoint]].z;
    for (var i = 0; i < 16; i++) {
      cptext.mat[i] = pieces.list[track.obn[oncheckpoint]].mat[i];
    }
    var flipit = false;
    if (Math.abs(cptext.mat[8]) > Math.abs(cptext.mat[10])) {
      if (camera.x < cptext.x) {
        cptext.x -= 6.7;
      } else {
        cptext.x += 6.7;
      }
      if (cptext.mat[8] > 0 && camera.x < cptext.x) {
        flipit = true;
      }
      if (cptext.mat[8] < 0 && camera.x > cptext.x) {
        flipit = true;
      }
    } else {
      if (camera.z < cptext.z) {
        cptext.z -= 6.7;
      } else {
        cptext.z += 6.7;
      }
      if (cptext.mat[10] > 0 && camera.z < cptext.z) {
        flipit = true;
      }
      if (cptext.mat[10] < 0 && camera.z > cptext.z) {
        flipit = true;
      }
    }
    if (flipit) {
      mat4.rotate(cptext.mat, cptext.mat, 180 * (Math.PI / 180), [0, 1, 0]);
    }
    if (onlastcheck) {
      for (var i = 0; i < 16; i++) {
        fntext.mat[i] = cptext.mat[i];
      }
      fntext.x = pieces.list[track.obn[oncheckpoint]].x;
      fntext.y = pieces.list[track.obn[oncheckpoint]].y + 52;
      fntext.z = pieces.list[track.obn[oncheckpoint]].z;
    }
  }
}

function chipaway(c, x, y, z, ctmag) {
  if (racers[c].carnchp < 120 && !recording.onpausefr) {
    var ui = -1;
    for (var i = 0; i < effects.nchp; i++) {
      if (effects.chip[i].loaded == 0) {
        ui = i;
        break;
      }
    }
    if (ui == -1) {
      ui = effects.nchp;
      effects.nchp++;
      racers[c].carnchp++;
    }
    if (ctmag > 0.4) {
      ctmag = 0.3;
    }
    if (ctmag < -0.4) {
      ctmag = -0.3;
    }
    effects.chip[ui] = newModel();
    effects.chip[i].rx =
      x * car[c].mat[0] + y * car[c].mat[4] + z * car[c].mat[8];
    effects.chip[i].ry =
      x * car[c].mat[1] + y * car[c].mat[5] + z * car[c].mat[9];
    effects.chip[i].rz =
      x * car[c].mat[2] + y * car[c].mat[6] + z * car[c].mat[10];
    effects.chip[i].cn = c;
    effects.chip[ui].vx = ctmag * (30 - random.fx() * 60);
    effects.chip[ui].vy = ctmag * (30 - random.fx() * 60);
    effects.chip[ui].vz = ctmag * (30 - random.fx() * 60);
    effects.chip[ui].rtn1 = Math.floor(random.fx() * 5);
    if (effects.chip[ui].rtn1 < 3) {
      effects.chip[ui].rtn1mag = random.fx() * 60;
    }
    effects.chip[ui].rtn2 = Math.floor(random.fx() * 5);
    if (effects.chip[ui].rtn2 < 3) {
      effects.chip[ui].rtn2mag = random.fx() * 60;
    }
    var ox = [];
    ox[0] = 0;
    var avox = 0;
    for (var i = 1; i < 3; i++) {
      ox[i] = ox[0] + ctmag * (10 - random.fx() * 20);
      avox += ox[i];
    }
    avox = avox / 2;
    for (var i = 0; i < 3; i++) {
      ox[i] -= (avox / 2) * (1 - random.fx() * random.fx());
    }
    var oy = [];
    oy[0] = 0;
    var avoy = 0;
    for (var i = 1; i < 3; i++) {
      oy[i] = oy[0] + ctmag * (10 - random.fx() * 20);
      avoy += oy[i];
    }
    avoy = avoy / 2;
    for (var i = 0; i < 3; i++) {
      oy[i] -= (avoy / 2) * (1 - random.fx() * random.fx());
    }
    var oz = [];
    oz[0] = 0;
    var avoz = 0;
    for (var i = 1; i < 3; i++) {
      oz[i] = oz[0] + ctmag * (10 - random.fx() * 20);
      avoz += oz[i];
    }
    avoz = avoz / 2;
    for (var i = 0; i < 3; i++) {
      oz[i] -= (avoz / 2) * (1 - random.fx() * random.fx());
    }
    var rmx =
      (oy[1] - oy[0]) * (oz[2] - oz[0]) - (oz[1] - oz[0]) * (oy[2] - oy[0]);
    var rmy =
      (oz[1] - oz[0]) * (ox[2] - ox[0]) - (ox[1] - ox[0]) * (oz[2] - oz[0]);
    var rmz =
      (ox[1] - ox[0]) * (oy[2] - oy[0]) - (oy[1] - oy[0]) * (ox[2] - ox[0]);
    var normx = rmx / Math.sqrt(rmx * rmx + rmy * rmy + rmz * rmz);
    var normy = rmy / Math.sqrt(rmx * rmx + rmy * rmy + rmz * rmz);
    var normz = rmz / Math.sqrt(rmx * rmx + rmy * rmy + rmz * rmz);
    var indice = [];
    var vert = [];
    var norm = [];
    var texu = [];
    for (var i = 0; i < 3; i++) {
      indice[i] = i;
      vert[i * 3] = ox[i];
      vert[i * 3 + 1] = oy[i];
      vert[i * 3 + 2] = oz[i];
      norm[i * 3] = normx;
      norm[i * 3 + 1] = normy;
      norm[i * 3 + 2] = normz;
      texu[i * 2] = car[c].ctxl[0];
      texu[i * 2 + 1] = car[c].ctxl[1];
    }
    effects.chip[ui].ni = 3;
    effects.chip[ui].nt = 1;
    var roni = random.fx();
    if (roni > 0.334) {
      effects.chip[ui].ownshade = true;
    }
    if (roni > 0.667) {
      effects.chip[ui].ownlight = true;
    }
    effects.chip[ui].vbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, effects.chip[ui].vbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
    effects.chip[ui].nbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, effects.chip[ui].nbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(norm), gl.STATIC_DRAW);
    effects.chip[ui].tbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, effects.chip[ui].tbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texu), gl.STATIC_DRAW);
    effects.chip[ui].ibuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, effects.chip[ui].ibuf);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indice),
      gl.STATIC_DRAW,
    );
    effects.chip[ui].mat = mat4.create();
    effects.chip[ui].texture = carModels[car[c].typ].texture[1];
    effects.chip[ui].loaded = 1;
  }
}
function chipsfly() {
  var nfly = false;
  for (var i = 0; i < effects.nchp; i++) {
    if (effects.chip[i].loaded) {
      effects.chip[i].x = car[effects.chip[i].cn].x + effects.chip[i].rx;
      effects.chip[i].y = car[effects.chip[i].cn].y + effects.chip[i].ry;
      effects.chip[i].z = car[effects.chip[i].cn].z + effects.chip[i].rz;
      effects.chip[i].rx += effects.chip[i].vx * tick.scale;
      effects.chip[i].ry += effects.chip[i].vy * tick.scale;
      effects.chip[i].rz += effects.chip[i].vz * tick.scale;
      effects.chip[i].vy -= 0.7 * tick.scale;
      if (effects.chip[i].rtn1 < 3) {
        var a1rot = [0, 0, 0];
        a1rot[effects.chip[i].rtn1] = 1;
        mat4.rotate(
          effects.chip[i].mat,
          effects.chip[i].mat,
          effects.chip[i].rtn1mag * (Math.PI / 180),
          a1rot,
        );
      }
      if (effects.chip[i].rtn2 < 3) {
        var a2rot = [0, 0, 0];
        a2rot[effects.chip[i].rtn2] = 1;
        mat4.rotate(
          effects.chip[i].mat,
          effects.chip[i].mat,
          effects.chip[i].rtn2mag * (Math.PI / 180),
          a2rot,
        );
      }
      if (tick.fraction >= tick.scale) {
        effects.chip[i].loaded++;
        if (effects.chip[i].loaded == 100) {
          effects.chip[i].loaded = 0;
        }
      }
      if (effects.chip[i].y < 0) {
        effects.chip[i].loaded = 0;
      }
      if (effects.chip[i].loaded == 0) {
        gl.deleteBuffer(effects.chip[i].vbuf);
        effects.chip[i].vbuf = null;
        gl.deleteBuffer(effects.chip[i].tbuf);
        effects.chip[i].tbuf = null;
        gl.deleteBuffer(effects.chip[i].ibuf);
        effects.chip[i].ibuf = null;
        effects.chip[i].texture = null;
      } else {
        nfly = true;
      }
    }
  }
  if (!nfly) {
    effects.nchp = 0;
    for (const racer of racers) {
      racer.carnchp = 0;
    }
  }
}
function newsprk() {
  return { typ: 0, stat: 0, x: 0, y: 0, z: 0, sp: 0, mat: null };
}

function sprks(cn, x, y, z, sx, sy, sz, cap) {
  var vdist = Math.sqrt(sx * sx + sy * sy + sz * sz);
  if (vdist > 5 && !recording.onpausefr) {
    if (game.phase == PHASE.race) {
      recordsprks(cn, x, y, z, sx, sy, sz, cap);
    }
    var oli = 1;
    if (cap == 2) {
      if (random.fx() > random.fx()) {
        oli = 2;
      }
    }
    for (var ka = 0; ka < oli; ka++) {
      var ui = -1;
      for (var i = 0; i < effects.nspr; i++) {
        if (effects.sprk[i].stat == 0) {
          ui = i;
          break;
        }
      }
      if (ui == -1) {
        ui = effects.nspr;
        effects.nspr++;
      }
      effects.sprk[ui] = newsprk();
      effects.sprk[ui].typ = Math.floor(random.fx() * 6);
      if (effects.sprk[ui].typ == 6) {
        effects.sprk[ui].typ = 0;
      }
      effects.sprk[ui].x = x + (random.fx() * 3 - 1.5);
      if (cap == 2) {
        effects.sprk[ui].y =
          y + carStats.wlh[cn][0] * 2.4 + (random.fx() * 3 - 1.5);
      } else {
        effects.sprk[ui].y = y + random.fx() * 2;
      }
      effects.sprk[ui].z = z + (random.fx() * 3 - 1.5);
      if (cap == 2) {
        sy -= random.fx() * 1;
      } else {
        sx += random.fx() * 1 - 0.5;
        sz += random.fx() * 1 - 0.5;
      }
      effects.sprk[ui].sp = 32 - random.fx() * 2 - vdist;
      effects.sprk[ui].sp *= 0.4;
      effects.sprk[ui].mat = mat4.create();
      var vx = -(sx / vdist);
      var vy = -(sy / vdist);
      var vz = -(sz / vdist);
      effects.sprk[ui].mat[8] = vx;
      effects.sprk[ui].mat[9] = vy;
      effects.sprk[ui].mat[10] = vz;
      effects.sprk[ui].mat[0] = vz;
      effects.sprk[ui].mat[1] = 0;
      effects.sprk[ui].mat[2] = vx;
      effects.sprk[ui].mat[4] = -vx;
      effects.sprk[ui].mat[5] = Math.sqrt(1 - vy * vy);
      effects.sprk[ui].mat[6] = -vz;
      effects.sprk[ui].stat = 1;
    }
  }
}
function sprksfly() {
  var nfly = false;
  for (var i = 0; i < effects.nspr; i++) {
    if (effects.sprk[i].stat != 0) {
      effects.sprk[i].x +=
        effects.sprk[i].mat[8] * effects.sprk[i].sp * tick.scale;
      effects.sprk[i].y +=
        effects.sprk[i].mat[9] * effects.sprk[i].sp * tick.scale;
      effects.sprk[i].z +=
        effects.sprk[i].mat[10] * effects.sprk[i].sp * tick.scale;
      effects.sprk[i].stat++;
      if (effects.sprk[i].stat == 8) {
        effects.sprk[i].stat = 0;
      } else {
        nfly = true;
      }
    }
  }
  if (!nfly) {
    effects.nspr = 0;
  }
}
function newdust() {
  return {
    stg: 0,
    x: 0,
    dy: 0,
    y: 0,
    z: 0,
    sx: 0,
    sz: 0,
    rot: 0,
    mag: 0,
    mat: null,
    tx: 0,
    ta: 0,
  };
}

function dustup(tskd, c, mst, x, y, z, sx, sz, smag, tlt, capsz) {
  var tilted = false;
  if (tlt > 5 && (mst == 0 || mst == 2)) {
    tilted = true;
  }
  if (tlt < -5 && (mst == 1 || mst == 3)) {
    tilted = true;
  }
  var bk = (Math.sqrt(sx * sx + sz * sz) - 4) / 16;
  if (bk > 1) {
    bk = 1;
  }
  if (bk > 0.2 && !tilted && !recording.onpausefr) {
    if (game.phase == PHASE.race) {
      recordust(tskd, c, mst, x, y, z, sx, sz, smag, tlt, capsz);
    }
    var ui = -1;
    for (var i = 0; i < effects.ndst; i++) {
      if (effects.dust[i].stg == 0) {
        ui = i;
        break;
      }
    }
    if (ui == -1) {
      ui = effects.ndst;
      effects.ndst++;
    }
    effects.dust[ui] = newdust();
    if (!capsz) {
      var fk = random.fx();
      effects.dust[ui].x = (x + car[c].x * fk) / (1 + fk);
      effects.dust[ui].z = (z + car[c].z * fk) / (1 + fk);
      effects.dust[ui].dy = (y + car[c].y * fk) / (1 + fk);
    } else {
      effects.dust[ui].x = (x + (car[c].x + sx)) / 2;
      effects.dust[ui].z = (z + (car[c].z + sz)) / 2;
      effects.dust[ui].dy = y;
    }
    if (effects.dust[ui].y < 0) {
      effects.dust[ui].y = 0;
    }
    effects.dust[ui].mag = 0.2 + smag * bk * 0.8;
    var ron = Math.floor(4 * random.fx());
    if (ron == 4) {
      ron = 0;
    }
    effects.dust[ui].rot = 90 * ron - 90;
    var sk = 0.1 + random.fx();
    if (sk > 1) {
      sk = 1;
    }
    effects.dust[ui].sx = sx * sk;
    effects.dust[ui].sz = sz * sk;
    effects.dust[ui].stg = 1;
    effects.dust[ui].tx = Math.floor(random.fx() * 3);
    if (effects.dust[ui].tx == 3) {
      effects.dust[ui].tx = 0;
    }
    if (tskd == 2) {
      effects.dust[ui].tx += 3;
    }
    if (tskd == 1) {
      effects.dust[ui].tx += 6;
    }
    effects.dust[ui].ta = 0;
    effects.dust[ui].mat = mat4.create();
    effects.dwer[ui] = ui;
  }
}
function dustfly() {
  var nfly = false;
  for (var i = 0; i < effects.ndst; i++) {
    if (effects.dust[i].stg != 0) {
      if (!recording.onpausefr) {
        effects.dust[i].x += effects.dust[i].sx / (effects.dust[i].stg + 1);
        effects.dust[i].z += effects.dust[i].sz / (effects.dust[i].stg + 1);
        effects.dust[i].y = effects.dust[i].dy + 3 * effects.dust[i].mag;
      }
      var fct =
        1 /
        Math.sqrt(
          effects.dust[i].sx * effects.dust[i].sx +
            effects.dust[i].sz * effects.dust[i].sz,
        );
      var vfx = effects.dust[i].sx * fct * effects.dust[i].sx * fct;
      var vfz = effects.dust[i].sz * fct * effects.dust[i].sz * fct;
      var mlt = 1;
      if (vfx > vfz) {
        mlt = 1 + (1 - Math.abs(mcos(camera.yaw) * mcos(camera.yaw) - vfx));
      } else {
        mlt = 1 + (1 - Math.abs(msin(camera.yaw) * msin(camera.yaw) - vfz));
      }
      effects.dust[i].mat = resetMatrix(effects.dust[i].mat);
      mat4.rotate(
        effects.dust[i].mat,
        effects.dust[i].mat,
        camera.yaw * (Math.PI / 180),
        [0, -1, 0],
      );
      mat4.rotate(
        effects.dust[i].mat,
        effects.dust[i].mat,
        camera.pitch * (Math.PI / 180),
        [-1, 0, 0],
      );
      mat4.rotate(
        effects.dust[i].mat,
        effects.dust[i].mat,
        effects.dust[i].rot * (Math.PI / 180),
        [0, 0, 1],
      );
      var kmt = 0;
      if (Math.abs(effects.dust[i].rot) == 90) {
        kmt = 1;
      }
      for (var k = 0; k < 3; k++) {
        var mt = 1;
        if (k == kmt) {
          mt = mlt;
        }
        effects.dust[i].mat[k * 4] *= effects.dust[i].mag * mt;
        effects.dust[i].mat[k * 4 + 1] *= effects.dust[i].mag * mt;
        effects.dust[i].mat[k * 4 + 2] *= effects.dust[i].mag * mt;
      }
      if (!recording.onpausefr) {
        effects.dust[i].mag += 0.05 + random.fx() * 0.05;
        if (effects.dust[i].stg >= 2) {
          effects.dust[i].ta += 0.45;
          if (effects.dust[i].ta > 4) {
            effects.dust[i].ta = 4;
          }
        }
        if (effects.dust[i].stg == 10) {
          effects.dust[i].stg = 0;
        } else {
          effects.dust[i].stg++;
          nfly = true;
        }
      } else {
        nfly = true;
      }
    }
  }
  if (nfly) {
    var wer = [];
    var dustd = [];
    for (var i = 0; i < effects.ndst; i++) {
      wer[i] = 0;
      dustd[i] = pyd(
        effects.dust[i].x,
        camera.x,
        effects.dust[i].y,
        camera.y,
        effects.dust[i].z,
        camera.z,
      );
    }
    for (var i = 0; i < effects.ndst; i++) {
      for (var j = i + 1; j < effects.ndst; j++) {
        if (dustd[i] < dustd[j]) {
          wer[i]++;
        } else {
          wer[j]++;
        }
      }
      effects.dwer[wer[i]] = i;
    }
  } else {
    effects.ndst = 0;
  }
}
function newexp() {
  return {
    x: 0,
    y: 0,
    z: 0,
    rot: 0,
    vy: 0,
    vsx: 0,
    vsy: 0,
    vsz: 0,
    typ: 0,
    ani: -1,
    size: 0,
    mat: null,
    first: false,
  };
}

function firexp(c, vsx, vsy, vsz) {
  var ui = -1;
  for (var i = 0; i < effects.nexp; i++) {
    if (effects.exp[i].ani == -1) {
      ui = i;
      break;
    }
  }
  if (ui == -1) {
    ui = effects.nexp;
    effects.nexp++;
  }
  var rad = carModels[car[c].typ];
  var ir = Math.floor(rad.ni * random.fx());
  if (ir == rad.ni) {
    ir = 0;
  }
  effects.exp[ui] = newexp();
  effects.exp[ui].x =
    car[c].x +
    rad.dvert[ir * 3] * car[c].mat[0] +
    rad.dvert[ir * 3 + 1] * car[c].mat[4] +
    rad.dvert[ir * 3 + 2] * car[c].mat[8];
  effects.exp[ui].y =
    car[c].y +
    rad.dvert[ir * 3] * car[c].mat[1] +
    rad.dvert[ir * 3 + 1] * car[c].mat[5] +
    rad.dvert[ir * 3 + 2] * car[c].mat[9];
  effects.exp[ui].z =
    car[c].z +
    rad.dvert[ir * 3] * car[c].mat[2] +
    rad.dvert[ir * 3 + 1] * car[c].mat[6] +
    rad.dvert[ir * 3 + 2] * car[c].mat[10];
  effects.exp[ui].vsx = vsx;
  effects.exp[ui].vsy = vsy;
  effects.exp[ui].vsz = vsz;
  effects.exp[ui].vy = 0.4 + random.fx() * 0.2;
  effects.exp[ui].size = 0.6 + random.fx() * 0.6;
  effects.exp[ui].rot = 360 * random.fx();
  effects.exp[ui].typ = Math.floor(random.fx() * 3);
  if (effects.exp[ui].typ == 3) {
    effects.exp[ui].typ = 0;
  }
  effects.exp[ui].ani = 0;
  effects.exp[ui].mat = mat4.create();
  effects.exp[ui].first = false;
  effects.ewer[ui] = ui;
}
function expburn() {
  var nfly = false;
  for (var i = 0; i < effects.nexp; i++) {
    if (effects.exp[i].ani != -1) {
      effects.exp[i].mat = resetMatrix(effects.exp[i].mat);
      mat4.rotate(
        effects.exp[i].mat,
        effects.exp[i].mat,
        camera.yaw * (Math.PI / 180),
        [0, -1, 0],
      );
      mat4.rotate(
        effects.exp[i].mat,
        effects.exp[i].mat,
        camera.pitch * (Math.PI / 180),
        [-1, 0, 0],
      );
      mat4.rotate(
        effects.exp[i].mat,
        effects.exp[i].mat,
        effects.exp[i].rot * (Math.PI / 180),
        [0, 0, 1],
      );
      for (var k = 0; k < 3; k++) {
        effects.exp[i].mat[k * 4] *= effects.exp[i].size;
        effects.exp[i].mat[k * 4 + 1] *= effects.exp[i].size;
        effects.exp[i].mat[k * 4 + 2] *= effects.exp[i].size;
      }
      effects.exp[i].y += effects.exp[i].vy;
      if (effects.exp[i].first) {
        effects.exp[i].x += effects.exp[i].vsx * tick.scale;
        effects.exp[i].vsx *= 0.95;
        effects.exp[i].y += effects.exp[i].vsy * tick.scale;
        effects.exp[i].vsy *= 0.95;
        effects.exp[i].z += effects.exp[i].vsz * tick.scale;
        effects.exp[i].vsz *= 0.95;
        effects.exp[i].size += effects.exp[i].size * 0.05 * tick.scale;
        effects.exp[i].ani += 0.85 * tick.scale;
      } else {
        effects.exp[i].first = true;
      }
      if (effects.exp[i].ani >= 6) {
        effects.exp[i].ani = -1;
      } else {
        nfly = true;
      }
    }
  }
  if (nfly) {
    var wer = [];
    var expd = [];
    for (var i = 0; i < effects.nexp; i++) {
      wer[i] = 0;
      expd[i] = pyd(
        effects.exp[i].x,
        camera.x,
        effects.exp[i].y,
        camera.y,
        effects.exp[i].z,
        camera.z,
      );
    }
    for (var i = 0; i < effects.nexp; i++) {
      for (var j = i + 1; j < effects.nexp; j++) {
        if (expd[i] < expd[j]) {
          wer[i]++;
        } else {
          wer[j]++;
        }
      }
      effects.ewer[wer[i]] = i;
    }
  } else {
    effects.nexp = 0;
  }
}

var updateframe = false;
// Fase whose 3D scene has been drawn from a finished logic tick and may be redrawn every frame.
var framefase = -1;
var renderedfase = -1;
function gameworks() {
  var fieldOfView = (55 * Math.PI) / 180;
  var zNear = 0.1;
  var zFar = 7000;
  camera.matrix = mat4.create();
  mat4.perspective(camera.matrix, fieldOfView, view.aspect, zNear, zFar);
  onelec = false;
  if (game.phase == PHASE.race) {
    if (starcnt == 0) {
      drive();
      setwheelspos();
      shadoworks();
      chipsfly();
      sprksfly();
      dustfly();
      expburn();
      cpanimate();
      record();
      checkstat();
      control();
      drawinter();
      enginsnd();
    } else {
      if (starcnt == 186) {
        camera.orbitHeight = 190;
        camera.pitch = 40;
        camera.orbitAngle = 250;
        camera.target = 3;
        camera.orbitHigh = true;
        camera.orbitTilt = 0;
        camera.mode = 1;
      }
      if (starcnt != 0) {
        starcnt--;
      }
      setwheelspos();
      shadoworks();
      cpanimate();
      drawinter();
      if (game.mode == 1 && starcnt < 180 && starcnt > 80) {
        drawcs(132, "SWITCH MODE", 0, 0, 0, 3);
        drawcs(192, "1 Lap, No Fixing", 0, 64, 128, 1);
      }
      if (
        starcnt > 65 &&
        !isPhone &&
        (track.stage == 1 || track.stage == 2) &&
        game.unlocked == 1
      ) {
        rd.drawImage(
          inst[6],
          50 * view.scaleX,
          view.height * 0.5 + 120 * view.scaleY,
          345 * view.scale,
          77 * view.scale,
        );
        rd.drawImage(
          inst[5],
          view.width - 80 * view.scaleX - 220 * view.scale,
          view.height * 0.5 + 40 * view.scaleY,
          220 * view.scale,
          155 * view.scale,
        );
        rd.letterSpacing = "1px";
        rd.font = "" + 17 * (view.scaleY + view.scaleX) + "px junk";
        rd.textAlign = "center";
        rd.textBaseline = "middle";
        rd.fillStyle = "#000000";
        rd.fillText(
          "Handbrake / Stunts",
          50 * view.scaleX + 172 * view.scale,
          view.height * 0.5 + 90 * view.scaleY,
        );
        rd.fillText(
          "Drive / Stunts",
          view.width - 80 * view.scaleX - 110 * view.scale,
          view.height * 0.5 + 10 * view.scaleY,
        );
        rd.fillText(
          "Or [W] [A] [S] [D]",
          view.width - 80 * view.scaleX - 110 * view.scale,
          view.height * 0.5 + 70 * view.scaleY + 155 * view.scale,
        );
      }
      if (starcnt < 65) {
        enginsnd();
      } else {
        if (track.stage == 2 && game.unlocked == 2) {
          drawonbordo();
        }
        if (track.stage == 4 && game.unlocked == 4) {
          drawonbordo();
        }
      }
      if (starcnt > 65) {
        if (enter == 1 || racers[0].u.handb || pointer.down) {
          starcnt = 65;
          if (enter == 1) {
            enter = 2;
          }
          racers[0].u.handb = false;
        }
      }
      if (starcnt == 65) {
        camera.orbitDescending = false;
        camera.orbitHeight = 90;
        camera.orbitAngle = 0;
        camera.target = 0;
        camera.orbitHigh = false;
        camera.orbitTilt = 0;
        camera.mode = 0;
        revfase = 0;
        reqpbr = 1;
        rd.fillStyle = "#FFFFFF";
        rd.fillRect(0, 0, view.width, view.height);
      }
      if (starcnt >= 185) {
        if (starcnt == 185) {
          rd.globalAlpha = 0.5;
        }
        rd.fillStyle = "#FFFFFF";
        rd.fillRect(0, 0, view.width, view.height);
        rd.globalAlpha = 1;
      }
    }
  }
  if (game.phase == PHASE.replay) {
    replay();
    setwheelspos();
    shadoworks();
    chipsfly();
    sprksfly();
    dustfly();
    expburn();
    cpanimate();
    drawreplay();
  }
  if (game.phase == PHASE.highlights) {
    hreplay();
    setwheelspos();
    shadoworks();
    if (!recording.onpausefr) {
      chipsfly();
      sprksfly();
    }
    dustfly();
    expburn();
    cpanimate();
    drawhreplay();
  }
  if (game.phase == PHASE.switchScreen) {
    drawswitch();
  }
  if (game.phase == PHASE.timeRewind) {
    revtime();
    setwheelspos();
    shadoworks();
    chipsfly();
    sprksfly();
    dustfly();
    expburn();
    cpanimate();
    drawrevtime();
  }
  if (camera.mode == 0) {
    camera.pitch = 10;
    var bado = 2 + Math.abs(camera.lookBackYaw) / 4;
    if (bado > 20) {
      bado = 20;
    }
    bado *= tick.scale;
    if (camera.lookBack != 0) {
      if (camera.lookBack == 1) {
        if (camera.lookBackYaw < 180) {
          camera.lookBackYaw += bado;
        }
        if (camera.lookBackYaw > 180) {
          camera.lookBackYaw = 180;
        }
      }
      if (camera.lookBack == -1) {
        if (camera.lookBackYaw > -180) {
          camera.lookBackYaw -= bado;
        }
        if (camera.lookBackYaw < -180) {
          camera.lookBackYaw = -180;
        }
      }
    } else {
      if (Math.abs(camera.lookBackYaw) > bado) {
        if (camera.lookBackYaw > 0) {
          camera.lookBackYaw -= bado;
        } else {
          camera.lookBackYaw += bado;
        }
      } else {
        if (camera.lookBackYaw != 0) {
          camera.lookBackYaw = 0;
        }
      }
    }
    var kcxz = racers[camera.target].cxz - 180 + camera.lookBackYaw;
    camera.yaw = kcxz;
    camera.x = car[camera.target].x - 80 * msin(kcxz);
    camera.z = car[camera.target].z + 80 * mcos(kcxz);
    camera.y = car[camera.target].y + 25;
  }
  if (camera.mode == 1) {
    if (!camera.orbitHigh) {
      if (!camera.orbitDescending) {
        camera.orbitHeight += 0.2 * tick.scale;
      } else {
        camera.orbitHeight -= 0.2 * tick.scale;
      }
      if (camera.orbitHeight > 90) {
        camera.orbitDescending = true;
      }
      if (camera.orbitHeight < -50) {
        camera.orbitDescending = false;
      }
    } else {
      camera.orbitHeight -= 1.4 * tick.scale;
      if (camera.orbitHeight < 61.7) {
        camera.orbitHeight = 61.7;
      }
    }
    var amp = 50 + camera.orbitHeight;
    if (camera.orbitHigh) {
      if (amp < 130) {
        amp = 130;
      }
    }
    if (amp < 100) {
      amp = 100;
    }
    camera.y = car[camera.target].y + camera.orbitHeight;
    if (camera.y < 5) {
      camera.orbitDescending = false;
    }
    camera.x = car[camera.target].x + amp * mcos(camera.orbitAngle);
    camera.z = car[camera.target].z + amp * msin(camera.orbitAngle);
    if (!camera.orbitHigh) {
      camera.orbitAngle -= 2 * tick.scale;
    } else {
      camera.orbitAngle -= 4 * tick.scale;
    }
    var ad = 0;
    var ty = camera.y;
    if (ty < 0) {
      ty = 0;
    }
    if (car[camera.target].y - ty < 0) {
      ad = -180;
    }
    var max = Math.sqrt(
      (car[camera.target].z - camera.z) * (car[camera.target].z - camera.z) +
        (car[camera.target].x - camera.x) * (car[camera.target].x - camera.x),
    );
    var rzy = -(
      90 +
      ad -
      Math.atan(max / (car[camera.target].y - ty)) / 0.017453292519943295
    );
    camera.yaw = -(-camera.orbitAngle + 90);
    if (camera.orbitHigh) {
      rzy -= camera.orbitTilt;
      camera.orbitTilt += 0.2;
      if (camera.orbitTilt > 15) {
        camera.orbitTilt = 15;
      }
    }
    camera.pitch += (rzy - camera.pitch) / 10;
  }
  if (camera.mode == 2) {
    if (camera.relocate) {
      var sidn = 1;
      if (random.fx() > random.fx()) {
        sidn = -1;
      }
      camera.y = car[camera.target].y + 10 + 160 * random.fx();
      camera.x =
        car[camera.target].x +
        40 * sidn * mcos(racers[camera.target].mxz) -
        500 * msin(racers[camera.target].mxz);
      camera.z =
        car[camera.target].z +
        40 * sidn * msin(racers[camera.target].mxz) +
        500 * mcos(racers[camera.target].mxz);
      camera.relocate = false;
    }
    var ad = 0;
    if (car[camera.target].x - camera.x > 0) {
      ad = 180;
    }
    var rxz = -(
      90 +
      ad +
      Math.atan(
        (car[camera.target].z - camera.z) / -(car[camera.target].x - camera.x),
      ) /
        0.017453292519943295
    );
    ad = 0;
    if (car[camera.target].y - camera.y < 0) {
      ad = -180;
    }
    var max = Math.sqrt(
      (car[camera.target].z - camera.z) * (car[camera.target].z - camera.z) +
        (car[camera.target].x - camera.x) * (car[camera.target].x - camera.x),
    );
    var rzy = -(
      90 +
      ad -
      Math.atan(max / (car[camera.target].y - camera.y)) / 0.017453292519943295
    );
    while (rxz < 0) {
      rxz += 360;
    }
    while (rxz > 360) {
      rxz -= 360;
    }
    camera.yaw = rxz;
    camera.pitch += (rzy - camera.pitch) / 5;
    if (
      Math.sqrt(
        (car[camera.target].z - camera.z) * (car[camera.target].z - camera.z) +
          (car[camera.target].x - camera.x) *
            (car[camera.target].x - camera.x) +
          (car[camera.target].y - camera.y) * (car[camera.target].y - camera.y),
      ) > 700
    ) {
      camera.relocate = true;
    }
  }
  if (camera.mode == 3) {
    var trnx =
      (car[camera.target].x * (30 - camera.transition) +
        car[camera.nextTarget].x * camera.transition) /
      30;
    var trny =
      (car[camera.target].y * (30 - camera.transition) +
        car[camera.nextTarget].y * camera.transition) /
      30;
    var trnz =
      (car[camera.target].z * (30 - camera.transition) +
        car[camera.nextTarget].z * camera.transition) /
      30;
    if (!camera.orbitDescending) {
      camera.orbitHeight += 0.2 * tick.scale;
    } else {
      camera.orbitHeight -= 0.2 * tick.scale;
    }
    if (camera.orbitHeight > 90) {
      camera.orbitDescending = true;
    }
    if (camera.orbitHeight < -50) {
      camera.orbitDescending = false;
    }
    var amp = 50 + camera.orbitHeight;
    if (amp < 100) {
      amp = 100;
    }
    camera.y = trny + camera.orbitHeight;
    if (camera.y < 5) {
      camera.orbitDescending = false;
    }
    camera.x = trnx + amp * mcos(camera.orbitAngle);
    camera.z = trnz + amp * msin(camera.orbitAngle);
    camera.orbitAngle -= 2 * tick.scale;
    var ad = 0;
    var ty = camera.y;
    if (ty < 0) {
      ty = 0;
    }
    if (trny - ty < 0) {
      ad = -180;
    }
    var max = Math.sqrt(
      (trnz - camera.z) * (trnz - camera.z) +
        (trnx - camera.x) * (trnx - camera.x),
    );
    var rzy = -(90 + ad - Math.atan(max / (trny - ty)) / 0.017453292519943295);
    camera.yaw = -(-camera.orbitAngle + 90);
    camera.pitch += (rzy - camera.pitch) / 10;
  }
  skydom.x = camera.x;
  skydom.z = camera.z;
  var skf = 0.6 + camera.y / 4000;
  skydom.mat = resetMatrix(skydom.mat);
  skydom.mat[4] *= skf;
  skydom.mat[5] *= skf;
  skydom.mat[6] *= skf;
  mat4.rotate(
    camera.matrix,
    camera.matrix,
    camera.pitch * (Math.PI / 180),
    [1, 0, 0],
  );
  mat4.rotate(
    camera.matrix,
    camera.matrix,
    camera.yaw * (Math.PI / 180),
    [0, 1, 0],
  );
  updateframe = true;
}
var csxz = 0,
  cszy = 0;
var carup = 0;
var carmy = 100;
var carms = 0;
var flyout = 1;
var nextc = 0;
function newsmoke() {
  return { x: 0, y: 0, z: 0, sx: 0, sy: 0, rot: 0, rota: 0, mat: null };
}
var smoke = [];
for (var i = 0; i < 9; i++) {
  smoke[i] = newsmoke();
  smoke[i].rot = 360 * random.fx();
  smoke[i].rota = 1 + 3 * random.fx();
  if (random.fx() > random.fx()) {
    smoke[i].rota *= -1;
  }
  smoke[i].x = 60 - 120 * random.fx();
  smoke[i].y = 3 + 52 * random.fx();
  smoke[i].sx = 0.05 + random.fx() * 0.3;
  if (random.fx() > random.fx()) {
    smoke[i].sx *= -1;
  }
  smoke[i].sy = 0.1 + random.fx() * 0.4;
  if (random.fx() > random.fx()) {
    smoke[i].sy *= -1;
  }
}
function carselect() {
  var fieldOfView = (55 * Math.PI) / 180;
  var zNear = 0.1;
  var zFar = 7000;
  camera.matrix = mat4.create();
  mat4.perspective(camera.matrix, fieldOfView, view.aspect, zNear, zFar);
  camera.x = 0;
  camera.y = 0;
  camera.z = 0;
  camera.yaw = 0;
  camera.pitch = -8;
  bg3D.x = 0;
  bg3D.y = 14;
  bg3D.z = -99;
  bg3D.mat = resetMatrix(bg3D.mat);
  mat4.rotate(bg3D.mat, bg3D.mat, camera.pitch * (Math.PI / 180), [-1, 0, 0]);
  for (var i = 0; i < 9; i++) {
    smoke[i].mat = resetMatrix(smoke[i].mat);
    smoke[i].x += smoke[i].sx;
    if (smoke[i].sx < 0 && smoke[i].x < -60) {
      smoke[i].sx = 0.05 + random.fx() * 0.3;
      smoke[i].rota = 1 + 3 * random.fx();
      if (random.fx() > random.fx()) {
        smoke[i].rota *= -1;
      }
    }
    if (smoke[i].sx > 0 && smoke[i].x > 60) {
      smoke[i].sx = -(0.05 + random.fx() * 0.3);
      smoke[i].rota = 1 + 3 * random.fx();
      if (random.fx() > random.fx()) {
        smoke[i].rota *= -1;
      }
    }
    smoke[i].y += smoke[i].sy;
    if (smoke[i].sy < 0 && smoke[i].y < 3) {
      smoke[i].sy = 0.1 + random.fx() * 0.4;
      smoke[i].rota = 1 + 3 * random.fx();
      if (random.fx() > random.fx()) {
        smoke[i].rota *= -1;
      }
    }
    if (smoke[i].sy > 0 && smoke[i].y > 55) {
      smoke[i].sy = -(0.1 + random.fx() * 0.4);
      smoke[i].rota = 1 + 3 * random.fx();
      if (random.fx() > random.fx()) {
        smoke[i].rota *= -1;
      }
    }
    smoke[i].z = -99;
    for (var k = 0; k < 3; k++) {
      smoke[i].mat[k] = bg3D.mat[k] * 4;
      smoke[i].mat[k + 4] = bg3D.mat[k + 4] * 4;
      smoke[i].mat[k + 8] = bg3D.mat[k + 8] * 4;
    }
    mat4.rotate(
      smoke[i].mat,
      smoke[i].mat,
      smoke[i].rot * (Math.PI / 180),
      [0, 0, 1],
    );
    smoke[i].rot += smoke[i].rota;
    if (smoke[i].rot > 360) {
      smoke[i].rot -= 360;
    }
    if (smoke[i].rot < 0) {
      smoke[i].rot += 360;
    }
  }
  if (flyout == 0) {
    if (carup >= 1) {
      if (carup == 1) {
        carmy += 0.7 + (11 - carmy) / 31;
        if (carmy > 10) {
          carmy = 10;
          carup = 2;
        }
      }
      if (carup >= 2) {
        carup++;
        if (carup == 110) {
          carup = 0;
        }
      }
    } else {
      if (carup == 0) {
        carmy -= 0.2 + (11 - carmy) / 31;
        if (carmy < -21) {
          carmy = -21;
          carup = -1;
        }
      }
      if (carup <= -1) {
        carup--;
        if (carup == -50) {
          carup = 1;
        }
      }
    }
  } else {
    if (flyout == 1) {
      cszy = 0;
      carms += 0.5;
      if (carms > 10) {
        camrs = 10;
      }
      carmy -= carms;
      if (carmy < -21) {
        carmy = -21;
        carup = -30;
        flyout = 0;
      }
    }
    if (flyout == 2) {
      carmy += 7;
      if (nextc == 1) {
        cszy += 20;
      }
      if (nextc == -1) {
        cszy -= 20;
      }
      if (carmy > 100) {
        if (nextc == 1) {
          game.carTypes[0]++;
          if (game.carTypes[0] == 19) {
            game.carTypes[0] = 0;
          }
        }
        if (nextc == -1) {
          game.carTypes[0]--;
          if (game.carTypes[0] == -1) {
            game.carTypes[0] = 18;
          }
        }
        if (nextc == 0) {
          game.carTypes[0] = lastsel;
        }
        flyout = 1;
        carms = 0;
        carmy = 100;
      }
    }
  }
  carModels[game.carTypes[0]].x = 0;
  carModels[game.carTypes[0]].y =
    carStats.wly[game.carTypes[0]][1] +
    1.5 * carStats.wlh[game.carTypes[0]][1] +
    carmy;
  carModels[game.carTypes[0]].z = -98;
  carModels[game.carTypes[0]].ont = 0;
  csxz += 5;
  if (csxz > 360) {
    csxz -= 360;
  }
  var xmt = [1, 0, 0];
  var ymt = [0, 1, 0];
  var zmt = [0, 0, 1];
  rotomat(ymt, zmt, cszy);
  rotomat(xmt, zmt, csxz);
  carModels[game.carTypes[0]].mat[0] = xmt[0];
  carModels[game.carTypes[0]].mat[1] = ymt[0];
  carModels[game.carTypes[0]].mat[2] = zmt[0];
  carModels[game.carTypes[0]].mat[4] = xmt[1];
  carModels[game.carTypes[0]].mat[5] = ymt[1];
  carModels[game.carTypes[0]].mat[6] = zmt[1];
  carModels[game.carTypes[0]].mat[8] = xmt[2];
  carModels[game.carTypes[0]].mat[9] = ymt[2];
  carModels[game.carTypes[0]].mat[10] = zmt[2];
  whl[game.carTypes[0]][0].x =
    carModels[game.carTypes[0]].x -
    carStats.wlx[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[0] -
    carStats.wly[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[4] +
    carStats.wlz[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[8];
  whl[game.carTypes[0]][0].y =
    carModels[game.carTypes[0]].y -
    carStats.wlx[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[1] -
    carStats.wly[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[5] +
    carStats.wlz[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[9];
  whl[game.carTypes[0]][0].z =
    carModels[game.carTypes[0]].z -
    carStats.wlx[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[2] -
    carStats.wly[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[6] +
    carStats.wlz[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[10];
  whl[game.carTypes[0]][0].mat = resetMatrix(whl[game.carTypes[0]][0].mat);
  for (var k = 0; k < 12; k++) {
    whl[game.carTypes[0]][0].mat[k] = carModels[game.carTypes[0]].mat[k];
  }
  mat4.rotate(
    whl[game.carTypes[0]][0].mat,
    whl[game.carTypes[0]][0].mat,
    90 * (Math.PI / 180),
    [0, 1, 0],
  );
  whl[game.carTypes[0]][1].x =
    carModels[game.carTypes[0]].x +
    carStats.wlx[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[0] -
    carStats.wly[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[4] +
    carStats.wlz[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[8];
  whl[game.carTypes[0]][1].y =
    carModels[game.carTypes[0]].y +
    carStats.wlx[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[1] -
    carStats.wly[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[5] +
    carStats.wlz[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[9];
  whl[game.carTypes[0]][1].z =
    carModels[game.carTypes[0]].z +
    carStats.wlx[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[2] -
    carStats.wly[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[6] +
    carStats.wlz[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[10];
  whl[game.carTypes[0]][1].mat = resetMatrix(whl[game.carTypes[0]][1].mat);
  for (var k = 0; k < 12; k++) {
    whl[game.carTypes[0]][1].mat[k] = carModels[game.carTypes[0]].mat[k];
  }
  mat4.rotate(
    whl[game.carTypes[0]][1].mat,
    whl[game.carTypes[0]][1].mat,
    -90 * (Math.PI / 180),
    [0, 1, 0],
  );
  whl[game.carTypes[0]][2].x =
    carModels[game.carTypes[0]].x -
    carStats.wlx[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[0] -
    carStats.wly[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[4] +
    carStats.wlz[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[8];
  whl[game.carTypes[0]][2].y =
    carModels[game.carTypes[0]].y -
    carStats.wlx[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[1] -
    carStats.wly[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[5] +
    carStats.wlz[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[9];
  whl[game.carTypes[0]][2].z =
    carModels[game.carTypes[0]].z -
    carStats.wlx[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[2] -
    carStats.wly[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[6] +
    carStats.wlz[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[10];
  whl[game.carTypes[0]][2].mat = resetMatrix(whl[game.carTypes[0]][2].mat);
  for (var k = 0; k < 12; k++) {
    whl[game.carTypes[0]][2].mat[k] = carModels[game.carTypes[0]].mat[k];
  }
  mat4.rotate(
    whl[game.carTypes[0]][2].mat,
    whl[game.carTypes[0]][2].mat,
    90 * (Math.PI / 180),
    [0, 1, 0],
  );
  whl[game.carTypes[0]][3].x =
    carModels[game.carTypes[0]].x +
    carStats.wlx[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[0] -
    carStats.wly[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[4] +
    carStats.wlz[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[8];
  whl[game.carTypes[0]][3].y =
    carModels[game.carTypes[0]].y +
    carStats.wlx[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[1] -
    carStats.wly[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[5] +
    carStats.wlz[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[9];
  whl[game.carTypes[0]][3].z =
    carModels[game.carTypes[0]].z +
    carStats.wlx[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[2] -
    carStats.wly[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[6] +
    carStats.wlz[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[10];
  whl[game.carTypes[0]][3].mat = resetMatrix(whl[game.carTypes[0]][3].mat);
  for (var k = 0; k < 12; k++) {
    whl[game.carTypes[0]][3].mat[k] = carModels[game.carTypes[0]].mat[k];
  }
  mat4.rotate(
    whl[game.carTypes[0]][3].mat,
    whl[game.carTypes[0]][3].mat,
    -90 * (Math.PI / 180),
    [0, 1, 0],
  );
  var cat = 0.5;
  if (
    Math.abs(carModels[game.carTypes[0]].mat[9]) >
    Math.abs(carModels[game.carTypes[0]].mat[1])
  ) {
    cat = 0.4;
  }
  if (Math.abs(carModels[game.carTypes[0]].mat[5]) < cat) {
    if (
      Math.abs(carModels[game.carTypes[0]].mat[9]) >
      Math.abs(carModels[game.carTypes[0]].mat[1])
    ) {
      carShadows[game.carTypes[0]].ont = 2;
      carShadows[game.carTypes[0]].x = carModels[game.carTypes[0]].x;
      carShadows[game.carTypes[0]].z = carModels[game.carTypes[0]].z;
      carShadows[game.carTypes[0]].mat[0] = carModels[game.carTypes[0]].mat[0];
      carShadows[game.carTypes[0]].mat[2] = carModels[game.carTypes[0]].mat[2];
      carShadows[game.carTypes[0]].mat[4] = carModels[game.carTypes[0]].mat[8];
      carShadows[game.carTypes[0]].mat[6] = carModels[game.carTypes[0]].mat[10];
      carShadows[game.carTypes[0]].mat[8] = -carModels[game.carTypes[0]].mat[4];
      carShadows[game.carTypes[0]].mat[10] =
        -carModels[game.carTypes[0]].mat[6];
    } else {
      carShadows[game.carTypes[0]].ont = 1;
      carShadows[game.carTypes[0]].x =
        carModels[game.carTypes[0]].x -
        carStats.shadadj[game.carTypes[0]] * carModels[game.carTypes[0]].mat[8];
      carShadows[game.carTypes[0]].z =
        carModels[game.carTypes[0]].z -
        carStats.shadadj[game.carTypes[0]] *
          carModels[game.carTypes[0]].mat[10];
      carShadows[game.carTypes[0]].mat[0] = carModels[game.carTypes[0]].mat[8];
      carShadows[game.carTypes[0]].mat[2] = carModels[game.carTypes[0]].mat[10];
      carShadows[game.carTypes[0]].mat[4] = carModels[game.carTypes[0]].mat[0];
      carShadows[game.carTypes[0]].mat[6] = carModels[game.carTypes[0]].mat[2];
      carShadows[game.carTypes[0]].mat[8] = -carModels[game.carTypes[0]].mat[4];
      carShadows[game.carTypes[0]].mat[10] =
        -carModels[game.carTypes[0]].mat[6];
    }
  } else {
    carShadows[game.carTypes[0]].ont = 0;
    carShadows[game.carTypes[0]].x =
      carModels[game.carTypes[0]].x -
      carStats.shadadj[game.carTypes[0]] * carModels[game.carTypes[0]].mat[8];
    carShadows[game.carTypes[0]].z =
      carModels[game.carTypes[0]].z -
      carStats.shadadj[game.carTypes[0]] * carModels[game.carTypes[0]].mat[10];
    carShadows[game.carTypes[0]].mat[0] = carModels[game.carTypes[0]].mat[8];
    carShadows[game.carTypes[0]].mat[2] = carModels[game.carTypes[0]].mat[10];
    carShadows[game.carTypes[0]].mat[4] = carModels[game.carTypes[0]].mat[4];
    carShadows[game.carTypes[0]].mat[6] = carModels[game.carTypes[0]].mat[6];
    carShadows[game.carTypes[0]].mat[8] = carModels[game.carTypes[0]].mat[0];
    carShadows[game.carTypes[0]].mat[10] = carModels[game.carTypes[0]].mat[2];
  }
  carShadows[game.carTypes[0]].mat[1] = 0;
  carShadows[game.carTypes[0]].mat[5] = 1;
  carShadows[game.carTypes[0]].mat[9] = 0;
  carShadows[game.carTypes[0]].y = -21;
  mat4.rotate(
    camera.matrix,
    camera.matrix,
    camera.pitch * (Math.PI / 180),
    [1, 0, 0],
  );
  drawcarselect();
  updateframe = true;
}
var hit = 4500,
  ptr = 0,
  ptcnt = -10,
  nrnd = 0;
var trx = 0,
  trz = 0,
  atrx = 0,
  atrz = 0;
var fallen = 0;
function stageselect() {
  var fieldOfView = (55 * Math.PI) / 180;
  var zNear = 0.1;
  var zFar = 7000;
  camera.matrix = mat4.create();
  mat4.perspective(camera.matrix, fieldOfView, view.aspect, zNear, zFar);
  camera.y = hit + 100;
  camera.x = trx - 1700 * msin(camera.yaw);
  camera.z = trz + 1700 * mcos(camera.yaw);
  if (hit > 500) {
    if (hit == 4500) {
      ptr = 0;
      nrnd = 0;
      ptcnt = 0;
      camera.pitch = 67;
      atrx = (track.x[0] - trx) / 116;
      atrz = (track.z[0] - trz) / 116;
    }
    hit -= fallen;
    fallen += 0.7;
    trx += atrx;
    trz += atrz;
    if (hit < 1760) {
      camera.pitch -= 2;
    }
    if (fallen > 50) {
      fallen = 50;
    }
    if (hit <= 500) {
      hit = 500;
      fallen = 0;
    }
    camera.orbitAngle += 3;
  } else {
    camera.orbitAngle++;
    trx -= (trx - track.x[ptr]) / 10;
    trz -= (trz - track.z[ptr]) / 10;
    if (ptcnt == 10) {
      ptr++;
      if (ptr == track.n) {
        ptr = 0;
        nrnd++;
      }
      ptcnt = 0;
    } else {
      ptcnt++;
    }
  }
  if (camera.orbitAngle > 360) {
    camera.orbitAngle -= 360;
  }
  camera.yaw = camera.orbitAngle;
  for (var i = 0; i < pieces.fixCount; i++) {
    mat4.rotate(
      pieces.list[pieces.fixes[i]].mat,
      pieces.list[pieces.fixes[i]].mat,
      11 * tick.scale * (Math.PI / 180),
      [0, 0, 1],
    );
  }
  fixdisk.ont++;
  if (fixdisk.ont == 5) {
    fixdisk.ont = 0;
  }
  chkflk++;
  if (chkflk >= 5) {
    chkflk = 0;
  }
  bgst.mat = resetMatrix(bgst.mat);
  mat4.rotate(bgst.mat, bgst.mat, camera.yaw * (Math.PI / 180), [0, -1, 0]);
  mat4.rotate(bgst.mat, bgst.mat, camera.pitch * (Math.PI / 180), [-1, 0, 0]);
  bgst.mat[0] *= view.aspect * 0.5625;
  bgst.mat[1] *= view.aspect * 0.5625;
  bgst.mat[2] *= view.aspect * 0.5625;
  bgst.x = camera.x - 106 * bgst.mat[8];
  bgst.y = camera.y - 106 * bgst.mat[9];
  bgst.z = camera.z - 106 * bgst.mat[10];
  mat4.rotate(
    camera.matrix,
    camera.matrix,
    camera.pitch * (Math.PI / 180),
    [1, 0, 0],
  );
  mat4.rotate(
    camera.matrix,
    camera.matrix,
    camera.yaw * (Math.PI / 180),
    [0, 1, 0],
  );
  drawstageselect();
  updateframe = true;
}
function unlockedcar() {
  if (fredo == 76) {
    var fieldOfView = (55 * Math.PI) / 180;
    var zNear = 0.1;
    var zFar = 7000;
    camera.matrix = mat4.create();
    mat4.perspective(camera.matrix, fieldOfView, view.aspect, zNear, zFar);
    camera.x = 0;
    camera.y = 0;
    camera.z = 0;
    camera.yaw = 0;
    camera.pitch = 0;
    carModels[game.carTypes[0]].x = 0;
    carModels[game.carTypes[0]].y =
      carStats.wly[game.carTypes[0]][1] +
      1.5 * carStats.wlh[game.carTypes[0]][1] -
      17;
    carModels[game.carTypes[0]].z = -80;
    carModels[game.carTypes[0]].ont = 0;
    csxz += 2;
    if (csxz > 360) {
      csxz -= 360;
    }
    cszy = carmy;
    if (carup) {
      carmy++;
      if (carmy > 20) {
        carmy = 20;
      }
    } else {
      carmy--;
      if (carmy < -20) {
        carmy = -20;
      }
    }
    carms--;
    if (carms == 0) {
      if (carup == 0) {
        carup = 1;
      } else {
        carup = 0;
      }
      carms = 100;
    }
    var xmt = [1, 0, 0];
    var ymt = [0, 1, 0];
    var zmt = [0, 0, 1];
    rotomat(ymt, zmt, cszy);
    rotomat(xmt, zmt, csxz);
    carModels[game.carTypes[0]].mat[0] = xmt[0];
    carModels[game.carTypes[0]].mat[1] = ymt[0];
    carModels[game.carTypes[0]].mat[2] = zmt[0];
    carModels[game.carTypes[0]].mat[4] = xmt[1];
    carModels[game.carTypes[0]].mat[5] = ymt[1];
    carModels[game.carTypes[0]].mat[6] = zmt[1];
    carModels[game.carTypes[0]].mat[8] = xmt[2];
    carModels[game.carTypes[0]].mat[9] = ymt[2];
    carModels[game.carTypes[0]].mat[10] = zmt[2];
    whl[game.carTypes[0]][0].x =
      carModels[game.carTypes[0]].x -
      carStats.wlx[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[0] -
      carStats.wly[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[4] +
      carStats.wlz[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[8];
    whl[game.carTypes[0]][0].y =
      carModels[game.carTypes[0]].y -
      carStats.wlx[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[1] -
      carStats.wly[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[5] +
      carStats.wlz[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[9];
    whl[game.carTypes[0]][0].z =
      carModels[game.carTypes[0]].z -
      carStats.wlx[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[2] -
      carStats.wly[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[6] +
      carStats.wlz[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[10];
    whl[game.carTypes[0]][0].mat = resetMatrix(whl[game.carTypes[0]][0].mat);
    for (var k = 0; k < 12; k++) {
      whl[game.carTypes[0]][0].mat[k] = carModels[game.carTypes[0]].mat[k];
    }
    mat4.rotate(
      whl[game.carTypes[0]][0].mat,
      whl[game.carTypes[0]][0].mat,
      90 * (Math.PI / 180),
      [0, 1, 0],
    );
    whl[game.carTypes[0]][1].x =
      carModels[game.carTypes[0]].x +
      carStats.wlx[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[0] -
      carStats.wly[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[4] +
      carStats.wlz[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[8];
    whl[game.carTypes[0]][1].y =
      carModels[game.carTypes[0]].y +
      carStats.wlx[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[1] -
      carStats.wly[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[5] +
      carStats.wlz[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[9];
    whl[game.carTypes[0]][1].z =
      carModels[game.carTypes[0]].z +
      carStats.wlx[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[2] -
      carStats.wly[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[6] +
      carStats.wlz[game.carTypes[0]][0] * carModels[game.carTypes[0]].mat[10];
    whl[game.carTypes[0]][1].mat = resetMatrix(whl[game.carTypes[0]][1].mat);
    for (var k = 0; k < 12; k++) {
      whl[game.carTypes[0]][1].mat[k] = carModels[game.carTypes[0]].mat[k];
    }
    mat4.rotate(
      whl[game.carTypes[0]][1].mat,
      whl[game.carTypes[0]][1].mat,
      -90 * (Math.PI / 180),
      [0, 1, 0],
    );
    whl[game.carTypes[0]][2].x =
      carModels[game.carTypes[0]].x -
      carStats.wlx[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[0] -
      carStats.wly[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[4] +
      carStats.wlz[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[8];
    whl[game.carTypes[0]][2].y =
      carModels[game.carTypes[0]].y -
      carStats.wlx[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[1] -
      carStats.wly[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[5] +
      carStats.wlz[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[9];
    whl[game.carTypes[0]][2].z =
      carModels[game.carTypes[0]].z -
      carStats.wlx[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[2] -
      carStats.wly[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[6] +
      carStats.wlz[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[10];
    whl[game.carTypes[0]][2].mat = resetMatrix(whl[game.carTypes[0]][2].mat);
    for (var k = 0; k < 12; k++) {
      whl[game.carTypes[0]][2].mat[k] = carModels[game.carTypes[0]].mat[k];
    }
    mat4.rotate(
      whl[game.carTypes[0]][2].mat,
      whl[game.carTypes[0]][2].mat,
      90 * (Math.PI / 180),
      [0, 1, 0],
    );
    whl[game.carTypes[0]][3].x =
      carModels[game.carTypes[0]].x +
      carStats.wlx[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[0] -
      carStats.wly[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[4] +
      carStats.wlz[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[8];
    whl[game.carTypes[0]][3].y =
      carModels[game.carTypes[0]].y +
      carStats.wlx[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[1] -
      carStats.wly[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[5] +
      carStats.wlz[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[9];
    whl[game.carTypes[0]][3].z =
      carModels[game.carTypes[0]].z +
      carStats.wlx[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[2] -
      carStats.wly[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[6] +
      carStats.wlz[game.carTypes[0]][1] * carModels[game.carTypes[0]].mat[10];
    whl[game.carTypes[0]][3].mat = resetMatrix(whl[game.carTypes[0]][3].mat);
    for (var k = 0; k < 12; k++) {
      whl[game.carTypes[0]][3].mat[k] = carModels[game.carTypes[0]].mat[k];
    }
    mat4.rotate(
      whl[game.carTypes[0]][3].mat,
      whl[game.carTypes[0]][3].mat,
      -90 * (Math.PI / 180),
      [0, 1, 0],
    );
    bgst.mat = resetMatrix(bgst.mat);
    mat4.rotate(bgst.mat, bgst.mat, camera.yaw * (Math.PI / 180), [0, -1, 0]);
    mat4.rotate(bgst.mat, bgst.mat, camera.pitch * (Math.PI / 180), [-1, 0, 0]);
    bgst.mat[0] *= view.aspect * 0.5625;
    bgst.mat[1] *= view.aspect * 0.5625;
    bgst.mat[2] *= view.aspect * 0.5625;
    bgst.x = 0;
    bgst.y = 0;
    bgst.z = -90;
    mat4.rotate(
      camera.matrix,
      camera.matrix,
      camera.pitch * (Math.PI / 180),
      [1, 0, 0],
    );
    mat4.rotate(
      camera.matrix,
      camera.matrix,
      camera.yaw * (Math.PI / 180),
      [0, 1, 0],
    );
    updateframe = true;
  }
}
function render(now) {
  interpolation.frame++;
  if (game.phase != renderedfase) {
    framefase = -1;
    renderedfase = game.phase;
  }
  placeCamera(camera.x, camera.y, camera.z, camera.matrix);
  if (
    game.phase == PHASE.race ||
    game.phase == PHASE.replay ||
    game.phase == PHASE.replayRewind ||
    game.phase == PHASE.highlights ||
    game.phase == PHASE.switchScreen ||
    game.phase == PHASE.timeRewind
  ) {
    if (updateframe || framefase == game.phase) {
      framefase = game.phase;
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      drawModel(ground);
      drawModel(skydom);
      if (game.phase == PHASE.timeRewind) {
        drawParticle(timetube);
      }
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      for (var i = 0; i < pieces.count; i++) {
        if (pieces.list[i].iscp) {
          if (
            oncheckpoint + 1 == pieces.list[i].iscp &&
            (Math.round(chkflk) == 0 || chkflk == 1)
          ) {
            if (Math.round(chkflk) == 0) {
              pieceModels[pieces.list[i].typ].ownshade = true;
            } else {
              pieceModels[pieces.list[i].typ].ownlight = true;
            }
          } else {
            pieceModels[pieces.list[i].typ].ownshade = false;
            pieceModels[pieces.list[i].typ].ownlight = false;
          }
        }
        if (pieces.list[i].typ == 29) {
          gl.enable(gl.CULL_FACE);
          gl.cullFace(gl.FRONT);
        }
        pieceModels[pieces.list[i].typ].x = pieces.list[i].x;
        pieceModels[pieces.list[i].typ].y = pieces.list[i].y;
        pieceModels[pieces.list[i].typ].z = pieces.list[i].z;
        pieceModels[pieces.list[i].typ].mat = pieces.list[i].mat;
        drawModel(pieceModels[pieces.list[i].typ]);
        if (pieces.list[i].typ == 29) {
          gl.disable(gl.CULL_FACE);
        }
      }
      for (var i = 0; i < effects.nspr; i++) {
        if (effects.sprk[i].stat != 0) {
          sparkModels[effects.sprk[i].typ].x = effects.sprk[i].x;
          sparkModels[effects.sprk[i].typ].y = effects.sprk[i].y;
          sparkModels[effects.sprk[i].typ].z = effects.sprk[i].z;
          sparkModels[effects.sprk[i].typ].mat = effects.sprk[i].mat;
          drawParticle(sparkModels[effects.sprk[i].typ]);
        }
      }
      for (var c = 0; c < game.carCount; c++) {
        if (carShadows[car[c].typ].intershad) {
          gl.disable(gl.DEPTH_TEST);
        }
        drawModel(carShadows[car[c].typ]);
        if (carShadows[car[c].typ].intershad) {
          gl.enable(gl.DEPTH_TEST);
        }
      }
      for (var i = 0; i < effects.nchp; i++) {
        drawModel(effects.chip[i]);
      }
      if (oncheckpoint != -1) {
        drawParticle(cptext);
        if (onlastcheck) {
          drawParticle(fntext);
        }
      }
      for (var c = 0; c < game.carCount; c++) {
        for (var w = 0; w < 4; w++) {
          attachTo(whl[car[c].typ][w].mat, car[c]);
        }
        for (var w = 0; w < 4; w++) {
          var k = 0;
          if (w >= 2) {
            k = 1;
          }
          if (whl[car[c].typ][w].dist < 250) {
            tiren[car[c].typ][k].x = whl[car[c].typ][w].x;
            tiren[car[c].typ][k].y = whl[car[c].typ][w].y;
            tiren[car[c].typ][k].z = whl[car[c].typ][w].z;
            tiren[car[c].typ][k].mat = whl[car[c].typ][w].mat;
            drawParticle(tiren[car[c].typ][k]);
          } else {
            tirel[car[c].typ][k].x = whl[car[c].typ][w].x;
            tirel[car[c].typ][k].y = whl[car[c].typ][w].y;
            tirel[car[c].typ][k].z = whl[car[c].typ][w].z;
            tirel[car[c].typ][k].mat = whl[car[c].typ][w].mat;
            drawParticle(tirel[car[c].typ][k]);
          }
        }
        carModels[car[c].typ].x = car[c].x;
        carModels[car[c].typ].y = car[c].y;
        carModels[car[c].typ].z = car[c].z;
        carModels[car[c].typ].mat = car[c].mat;
        drawModel(carModels[car[c].typ]);
        for (var w = 0; w < 4; w++) {
          var k = 0;
          if (w >= 2) {
            k = 1;
          }
          tired[car[c].typ][k].x = whl[car[c].typ][w].x;
          tired[car[c].typ][k].y = whl[car[c].typ][w].y;
          tired[car[c].typ][k].z = whl[car[c].typ][w].z;
          tired[car[c].typ][k].mat = whl[car[c].typ][w].mat;
          drawModel(tired[car[c].typ][k]);
        }
      }
      if (onelec) {
        for (var c = 0; c < game.carCount; c++) {
          if (car[c].fcnt) {
            elec.x = car[c].x;
            elec.y = car[c].y;
            elec.z = car[c].z;
            mat4.rotate(
              elec.mat,
              elec.mat,
              random.fx() * 360 * (Math.PI / 180),
              [0, 0, 1],
            );
            drawModel(elec);
          }
        }
      }
      if (game.mode != 1) {
        for (var i = 0; i < pieces.fixCount; i++) {
          fixdisk.x = pieces.list[pieces.fixes[i]].x;
          fixdisk.y = pieces.list[pieces.fixes[i]].y;
          fixdisk.z = pieces.list[pieces.fixes[i]].z;
          fixdisk.mat = pieces.list[pieces.fixes[i]].mat;
          drawModel(fixdisk);
        }
      }
      if (game.phase == PHASE.switchScreen) {
        for (var c = 0; c < game.carCount; c++) {
          drawParticle(racers[c].switchp);
        }
      }
      for (var i = 0; i < effects.nexp; i++) {
        if (effects.exp[effects.ewer[i]].ani != -1) {
          explode[effects.exp[effects.ewer[i]].typ].x =
            effects.exp[effects.ewer[i]].x;
          explode[effects.exp[effects.ewer[i]].typ].y =
            effects.exp[effects.ewer[i]].y;
          explode[effects.exp[effects.ewer[i]].typ].z =
            effects.exp[effects.ewer[i]].z;
          explode[effects.exp[effects.ewer[i]].typ].ont = Math.floor(
            effects.exp[effects.ewer[i]].ani,
          );
          explode[effects.exp[effects.ewer[i]].typ].mat =
            effects.exp[effects.ewer[i]].mat;
          drawModel(explode[effects.exp[effects.ewer[i]].typ]);
        }
      }
      for (var k = 0; k < effects.ndst; k++) {
        var i = effects.dwer[k];
        if (effects.dust[i].stg != 0) {
          sprite.x = effects.dust[i].x;
          sprite.y = effects.dust[i].y;
          sprite.z = effects.dust[i].z;
          sprite.mat = effects.dust[i].mat;
          sprite.texture =
            dtexture[effects.dust[i].tx][Math.floor(effects.dust[i].ta)];
          drawModel(sprite);
        }
      }
      updateframe = false;
    }
  }
  if (game.phase == PHASE.carSelect) {
    if (updateframe || framefase == game.phase) {
      framefase = game.phase;
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      drawModel(bg3D);
      for (var i = 0; i < 9; i++) {
        sprite.x = smoke[i].x;
        sprite.y = smoke[i].y;
        sprite.z = smoke[i].z;
        sprite.mat = smoke[i].mat;
        var ui = i;
        while (ui >= 3) {
          ui -= 3;
        }
        sprite.texture = stexture[ui];
        drawModel(sprite);
      }
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      drawModel(carShadows[game.carTypes[0]]);
      for (var w = 0; w < 4; w++) {
        attachTo(whl[game.carTypes[0]][w].mat, carModels[game.carTypes[0]]);
      }
      for (var w = 0; w < 4; w++) {
        var k = 0;
        if (w >= 2) {
          k = 1;
        }
        tiren[game.carTypes[0]][k].x = whl[game.carTypes[0]][w].x;
        tiren[game.carTypes[0]][k].y = whl[game.carTypes[0]][w].y;
        tiren[game.carTypes[0]][k].z = whl[game.carTypes[0]][w].z;
        tiren[game.carTypes[0]][k].mat = whl[game.carTypes[0]][w].mat;
        drawParticle(tiren[game.carTypes[0]][k]);
      }
      drawModel(carModels[game.carTypes[0]]);
      for (var w = 0; w < 4; w++) {
        var k = 0;
        if (w >= 2) {
          k = 1;
        }
        tired[game.carTypes[0]][k].x = whl[game.carTypes[0]][w].x;
        tired[game.carTypes[0]][k].y = whl[game.carTypes[0]][w].y;
        tired[game.carTypes[0]][k].z = whl[game.carTypes[0]][w].z;
        tired[game.carTypes[0]][k].mat = whl[game.carTypes[0]][w].mat;
        drawModel(tired[game.carTypes[0]][k]);
      }
      updateframe = false;
    }
  }
  if (game.phase == PHASE.stageSelect) {
    if (updateframe || framefase == game.phase) {
      framefase = game.phase;
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      drawParticle(bgst);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      if (!flkun) {
        for (var i = 0; i < track.obi[track.n - 1] + adod; i++) {
          if (pieces.list[i].iscp) {
            if (Math.round(chkflk) == 0 || chkflk == 1) {
              if (Math.round(chkflk) == 0) {
                pieceModels[pieces.list[i].typ].ownshade = true;
              } else {
                pieceModels[pieces.list[i].typ].ownlight = true;
              }
            } else {
              pieceModels[pieces.list[i].typ].ownshade = false;
              pieceModels[pieces.list[i].typ].ownlight = false;
            }
          }
          pieceModels[pieces.list[i].typ].x = pieces.list[i].x;
          pieceModels[pieces.list[i].typ].y = pieces.list[i].y;
          pieceModels[pieces.list[i].typ].z = pieces.list[i].z;
          pieceModels[pieces.list[i].typ].mat = pieces.list[i].mat;
          drawModel(pieceModels[pieces.list[i].typ]);
        }
        for (var i = 0; i < pieces.fixCount; i++) {
          fixdisk.x = pieces.list[pieces.fixes[i]].x;
          fixdisk.y = pieces.list[pieces.fixes[i]].y;
          fixdisk.z = pieces.list[pieces.fixes[i]].z;
          fixdisk.mat = pieces.list[pieces.fixes[i]].mat;
          drawModel(fixdisk);
        }
      }
      updateframe = false;
    }
  }
  if (game.phase == PHASE.raceEnd && fredo == 76) {
    if (updateframe || framefase == game.phase) {
      framefase = game.phase;
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      drawParticle(bgst);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      for (var w = 0; w < 4; w++) {
        attachTo(whl[game.carTypes[0]][w].mat, carModels[game.carTypes[0]]);
      }
      for (var w = 0; w < 4; w++) {
        var k = 0;
        if (w >= 2) {
          k = 1;
        }
        tiren[game.carTypes[0]][k].x = whl[game.carTypes[0]][w].x;
        tiren[game.carTypes[0]][k].y = whl[game.carTypes[0]][w].y;
        tiren[game.carTypes[0]][k].z = whl[game.carTypes[0]][w].z;
        tiren[game.carTypes[0]][k].mat = whl[game.carTypes[0]][w].mat;
        drawParticle(tiren[game.carTypes[0]][k]);
      }
      drawModel(carModels[game.carTypes[0]]);
      for (var w = 0; w < 4; w++) {
        var k = 0;
        if (w >= 2) {
          k = 1;
        }
        tired[game.carTypes[0]][k].x = whl[game.carTypes[0]][w].x;
        tired[game.carTypes[0]][k].y = whl[game.carTypes[0]][w].y;
        tired[game.carTypes[0]][k].z = whl[game.carTypes[0]][w].z;
        tired[game.carTypes[0]][k].mat = whl[game.carTypes[0]][w].mat;
        drawModel(tired[game.carTypes[0]][k]);
      }
      updateframe = false;
    }
  }
}

var secar = 0;
function checkstat() {
  if (!track.haltall) {
    for (var i = 0; i < game.carCount; i++) {
      track.magperc[i] = racers[i].hitmag / carStats.maxmag[car[i].typ];
      if (track.magperc[i] > 1) {
        track.magperc[i] = 1;
      }
      track.pos[i] = 0;
      if (track.dested[i] == 0) {
        track.clear[i] = racers[i].clear;
      } else {
        track.clear[i] = -1;
      }
    }
    for (var i = 0; i < game.carCount; i++) {
      for (var j = i + 1; j < game.carCount; j++) {
        if (track.clear[i] != track.clear[j]) {
          if (track.clear[i] < track.clear[j]) {
            track.pos[i]++;
          } else {
            track.pos[j]++;
          }
        } else {
          var ic = racers[i].pcleared + 1;
          if (ic >= track.n) {
            ic = 0;
          }
          while (track.typ[ic] <= 0) {
            ic++;
            if (ic >= track.n) {
              ic = 0;
            }
          }
          if (
            pyo(
              car[i].x / 10,
              track.x[ic] / 10,
              car[i].z / 10,
              track.z[ic] / 10,
            ) >
            pyo(
              car[j].x / 10,
              track.x[ic] / 10,
              car[j].z / 10,
              track.z[ic] / 10,
            )
          ) {
            track.pos[i]++;
          } else {
            track.pos[j]++;
          }
        }
      }
    }
    if (track.stage > 2) {
      for (var i = 0; i < game.carCount; i++) {
        if (track.clear[i] == track.nlaps * track.nsp && track.pos[i] == 0) {
          if (i == game.player) {
            for (var j = 0; j < game.carCount; j++) {
              if (track.pos[j] == 1) {
                secar = j;
              }
            }
            if (
              pyo(
                car[0].x / 10,
                car[secar].x / 10,
                car[0].z / 10,
                car[secar].z / 10,
              ) < 14000 &&
              track.clear[0] - racers[secar].clear == 1
            ) {
              recording.catchfin = 43;
            }
          } else {
            if (
              track.pos[0] == 1 &&
              pyo(car[0].x / 10, car[i].x / 10, car[0].z / 10, car[i].z / 10) <
                14000 &&
              racers[i].clear - racers[0].clear == 1
            ) {
              recording.catchfin = 43;
              secar = i;
            }
          }
        }
      }
    }
  }
  track.wasted = 0;
  for (var i = 0; i < game.carCount; i++) {
    if (game.player != i) {
      if (racers[i].dest) {
        track.wasted++;
      }
    }
  }
  if (recording.catchfin != 0) {
    recording.catchfin--;
    if (recording.catchfin == 0) {
      catchnow(4 + track.pos[0]);
      if (recording.htyp == 4 + track.pos[0]) {
        recording.hscar = secar;
        if (recording.htyp > 5) {
          recording.htyp = 5;
        }
      }
    }
  }
}
var xstart = [0, -35, 35, 0, -35, 35, 0];
var zstart = [-76, -38, -38, 0, 38, 38, 76];
function inishcars() {
  for (var i = 0; i < game.carCount; i++) {
    car[i].typ = game.carTypes[i];
    car[i].x = xstart[i] + 4 * random.sim() - 2;
    car[i].z = zstart[i];
    car[i].grat =
      carStats.wly[car[i].typ][1] + 1.5 * carStats.wlh[car[i].typ][1];
    car[i].y = car[i].grat;
    car[i].xy = 0;
    car[i].xz = 0;
    car[i].zy = 0;
    car[i].wzy = 0;
    car[i].wxz = 0;
    car[i].keyx[0] = -carStats.wlx[car[i].typ][0];
    car[i].keyz[0] = carStats.wlz[car[i].typ][0];
    car[i].keyx[1] = carStats.wlx[car[i].typ][0];
    car[i].keyz[1] = carStats.wlz[car[i].typ][0];
    car[i].keyx[2] = -carStats.wlx[car[i].typ][1];
    car[i].keyz[2] = carStats.wlz[car[i].typ][1];
    car[i].keyx[3] = carStats.wlx[car[i].typ][1];
    car[i].keyz[3] = carStats.wlz[car[i].typ][1];
    car[i].mat = mat4.create();
    car[i].ctxl[0] = random.fx();
    car[i].ctxl[1] = random.fx();
    car[i].fcnt = 0;
  }
}
function sortcars(stage) {
  game.carCount = 7;
  for (var i = 1; i < 7; i++) {
    game.carTypes[i] = -1;
  }
  var oks = [];
  var ti = game.carCount;
  if (game.carTypes[0] != Math.floor(10 + (stage + 1) / 2) && stage != 17) {
    game.carTypes[game.carCount - 1] = Math.floor(10 + (stage + 1) / 2);
    ti = game.carCount - 1;
  }
  for (var i = 1; i < ti; i++) {
    oks[i] = false;
    while (!oks[i]) {
      game.carTypes[i] = Math.floor(random.sim() * (28 + 10 * (stage / 17)));
      if (game.carTypes[i] >= 19) {
        game.carTypes[i] -= 19;
      }
      if (game.carTypes[i] == 19) {
        game.carTypes[i] = 18;
      }
      oks[i] = true;
      for (var j = 0; j < game.carCount; j++) {
        if (i != j && game.carTypes[i] == game.carTypes[j]) {
          oks[i] = false;
        }
      }
      if ((stage != 15 && stage != 16) || game.unlocked != stage) {
        var outproba = ((18 - game.carTypes[i]) / 18) * (stage / 16);
        if (outproba > 0.8) {
          outproba = 0.8;
        }
        if (stage == 17) {
          if (outproba > 0.5) {
            outproba = 0.5;
          }
        }
        if (outproba > random.sim()) {
          oks[i] = false;
        }
      }
      if ((game.carTypes[i] - 10) * 2 > game.unlocked) {
        oks[i] = false;
      }
      if (
        stage == 6 &&
        game.unlocked == 6 &&
        (game.carTypes[i] == 2 ||
          game.carTypes[i] == 4 ||
          game.carTypes[i] == 6 ||
          game.carTypes[i] == 9)
      ) {
        oks[i] = false;
      }
      if (
        stage == 8 &&
        game.unlocked == 8 &&
        (game.carTypes[i] == 4 ||
          game.carTypes[i] == 6 ||
          game.carTypes[i] == 9)
      ) {
        if (random.sim() > random.sim()) {
          oks[i] = false;
        }
      }
      if (
        stage == 9 &&
        game.unlocked == 9 &&
        (game.carTypes[i] == 4 ||
          game.carTypes[i] == 3 ||
          game.carTypes[i] == 0 ||
          game.carTypes[i] == 2)
      ) {
        if (random.sim() > random.sim()) {
          oks[i] = false;
        }
      }
      if (
        stage == 10 &&
        game.unlocked == 10 &&
        (game.carTypes[i] == 2 ||
          game.carTypes[i] == 6 ||
          game.carTypes[i] == 9 ||
          game.carTypes[i] == 14)
      ) {
        if (random.sim() > random.sim()) {
          oks[i] = false;
        }
      }
      if (
        stage == 11 &&
        game.unlocked == 11 &&
        (game.carTypes[i] == 0 ||
          game.carTypes[i] == 1 ||
          game.carTypes[i] == 2 ||
          game.carTypes[i] == 3 ||
          game.carTypes[i] == 4 ||
          game.carTypes[i] == 14)
      ) {
        oks[i] = false;
      }
      if (stage == 12 && game.unlocked == 12 && game.carTypes[i] <= 4) {
        oks[i] = false;
      }
      if (stage == 13 && game.unlocked == 13) {
        if (game.carTypes[i] <= 4) {
          oks[i] = false;
        }
        if (game.carTypes[i] == 14 || game.carTypes[i] == 16) {
          if (random.sim() > random.sim()) {
            oks[i] = false;
          }
        }
      }
      if (
        stage == 14 &&
        game.unlocked == 14 &&
        (game.carTypes[i] == 0 ||
          game.carTypes[i] == 2 ||
          game.carTypes[i] == 3 ||
          game.carTypes[i] == 4 ||
          game.carTypes[i] == 6 ||
          game.carTypes[i] == 9 ||
          game.carTypes[i] == 14 ||
          game.carTypes[i] == 16)
      ) {
        oks[i] = false;
      }
      if (stage == 15 && game.unlocked == 15) {
        if (game.carTypes[i] < 5) {
          oks[i] = false;
        }
        if (game.carTypes[i] < 11) {
          if (random.sim() > 0.1) {
            oks[i] = false;
          }
        }
      }
      if (stage == 16 && game.unlocked == 16) {
        if (game.carTypes[i] < 11) {
          oks[i] = false;
        }
      }
    }
  }
  if (stage == 6 && game.unlocked == 6) {
    var okcar = false;
    for (var i = 0; i < 7; i++) {
      if (game.carTypes[i] == 11) {
        okcar = true;
      }
    }
    if (!okcar) {
      var ssel = 18;
      var ssi = 1;
      for (var i = 1; i < ti; i++) {
        if (game.carTypes[i] < ssel) {
          ssel = game.carTypes[i];
          ssi = i;
        }
      }
      game.carTypes[ssi] = 11;
    }
  }
  if (stage == 12 && game.unlocked == 12) {
    var okcar = false;
    for (var i = 0; i < 7; i++) {
      if (game.carTypes[i] == 14) {
        okcar = true;
      }
    }
    if (!okcar) {
      var ssi = Math.floor(1 + 5 * random.sim());
      if (ssi == 6) {
        ssi = 5;
      }
      game.carTypes[ssi] = 14;
    }
  }
  if (stage == 16 && game.unlocked == 16) {
    var okcar = false;
    for (var i = 0; i < 7; i++) {
      if (game.carTypes[i] == 16) {
        okcar = true;
      }
    }
    if (!okcar) {
      var ssi = Math.floor(1 + 5 * random.sim());
      if (ssi == 6) {
        ssi = 5;
      }
      game.carTypes[ssi] = 16;
    }
    var tk = 1;
    if (random.sim() > random.sim()) {
      tk = 2;
    }
    for (var i = 3; i < 6; i++) {
      if (game.carTypes[i] == 16) {
        game.carTypes[i] = game.carTypes[tk];
        game.carTypes[tk] = 16;
      }
    }
    if (tk == 1) {
      tk = 2;
    } else {
      tk = 1;
    }
    for (var i = 3; i < 6; i++) {
      if (game.carTypes[i] == 14) {
        game.carTypes[i] = game.carTypes[tk];
        game.carTypes[tk] = 14;
      }
    }
    tk = 4;
    if (random.sim() > random.sim()) {
      tk = 5;
    }
    for (var i = 1; i < 4; i++) {
      if (game.carTypes[i] == 15) {
        game.carTypes[i] = game.carTypes[tk];
        game.carTypes[tk] = 15;
      }
    }
  }
}
var drag = 0.05;

var lonorm = [];
function inishmad() {
  for (var c = 0; c < 7; c++) {
    racers[c].mxz = 0;
    racers[c].cxz = 0;
    racers[c].dominate = [];
    racers[c].caught = [];
    for (var i = 0; i < 7; i++) {
      racers[c].dominate[i] = false;
      racers[c].caught[i] = false;
    }
    racers[c].pzy = 0;
    racers[c].pxy = 0;
    racers[c].speed = 0;
    racers[c].scy = [];
    racers[c].scx = [];
    racers[c].scz = [];
    for (var i = 0; i < 4; i++) {
      racers[c].scy[i] = 0;
      racers[c].scx[i] = 0;
      racers[c].scz[i] = 0;
    }
    racers[c].forca =
      ((Math.sqrt(
        car[c].keyz[0] * car[c].keyz[0] + car[c].keyx[0] * car[c].keyx[0],
      ) +
        Math.sqrt(
          car[c].keyz[1] * car[c].keyz[1] + car[c].keyx[1] * car[c].keyx[1],
        ) +
        Math.sqrt(
          car[c].keyz[2] * car[c].keyz[2] + car[c].keyx[2] * car[c].keyx[2],
        ) +
        Math.sqrt(
          car[c].keyz[3] * car[c].keyz[3] + car[c].keyx[3] * car[c].keyx[3],
        )) /
        1000) *
      (carStats.bounce[car[c].typ] - 0.3);
    racers[c].mtouch = true;
    racers[c].wtouch = true;
    racers[c].cntouch = 0;
    racers[c].capsized = false;
    racers[c].txz = 0;
    racers[c].fxz = 0;
    racers[c].pmlt = 1;
    racers[c].nmlt = 1;
    racers[c].dcnt = 0;
    racers[c].skid = 0;
    racers[c].pushed = false;
    racers[c].gtouch = false;
    racers[c].pl = false;
    racers[c].pr = false;
    racers[c].pd = false;
    racers[c].pu = false;
    racers[c].actl = false;
    racers[c].actr = false;
    racers[c].actu = false;
    racers[c].actd = false;
    racers[c].loop = 0;
    racers[c].ucomp = 0;
    racers[c].dcomp = 0;
    racers[c].lcomp = 0;
    racers[c].rcomp = 0;
    racers[c].uwall = false;
    racers[c].lxz = 0;
    racers[c].travxy = 0;
    racers[c].travzy = 0;
    racers[c].travxz = 0;
    racers[c].trcnt = 0;
    racers[c].capcnt = 0;
    racers[c].srfcnt = 0;
    racers[c].rtab = false;
    racers[c].ftab = false;
    racers[c].btab = false;
    racers[c].surfer = false;
    racers[c].powerup = 0;
    racers[c].xtpower = 0;
    racers[c].tilt = 0;
    racers[c].crank = [];
    racers[c].lcrank = [];
    for (var i = 0; i < 4; i++) {
      racers[c].crank[i] = 0;
      racers[c].lcrank[i] = 0;
    }
    racers[c].squash = 0;
    racers[c].nbsq = 0;
    racers[c].hitmag = 0;
    racers[c].cntdest = 0;
    racers[c].dest = false;
    racers[c].embos = 0;
    racers[c].embodir = 0;
    racers[c].embomag = 0;
    racers[c].bshft = 0;
    racers[c].pcleared = track.pcs;
    racers[c].clear = 0;
    racers[c].nlaps = 0;
    racers[c].focus = -1;
    racers[c].power = 98;
    racers[c].missedcp = 0;
    racers[c].lastcolido = 0;
    racers[c].nofocus = false;
    racers[c].point = 0;
    track.dested[c] = 0;
  }
  for (var i = 0; i < 2; i++) {
    lonorm[i] = 0;
  }
}
var onautocorrect = 0;
var flipont = false;
function drive() {
  if (game.carCount != 1) {
    for (var c = 0; c < game.carCount; c++) {
      for (var xc = 0; xc < game.carCount; xc++) {
        if (xc != c) {
          colide(c, xc);
        }
      }
    }
  }
  if (onautocorrect) {
    if (racers[0].capsized) {
      if (racers[0].wtouch) {
        if (flipont) {
          racers[0].pxy += 180;
          flipont = false;
        }
      } else {
        flipont = true;
      }
    }
  }
  for (var c = 0; c < game.carCount; c++) {
    var cn = car[c].typ;
    var mlt = 1;
    var cov = 1;
    var zyinv = false,
      doublinv = false,
      spinlocate = false;
    racers[c].capsized = false;
    var izy = Math.abs(racers[c].pzy);
    while (izy > 270) {
      izy -= 360;
    }
    izy = Math.abs(izy);
    if (izy > 90) {
      zyinv = true;
    }
    var xyinv = false;
    var ixy = Math.abs(racers[c].pxy);
    while (ixy > 270) {
      ixy -= 360;
    }
    ixy = Math.abs(ixy);
    if (ixy > 90) {
      xyinv = true;
      cov = -1;
    }
    var keyy = -car[c].grat;
    if (zyinv) {
      if (xyinv) {
        xyinv = false;
        doublinv = true;
      } else {
        xyinv = true;
        racers[c].capsized = true;
      }
      mlt = -1;
    } else {
      if (xyinv) {
        racers[c].capsized = true;
      }
    }
    if (racers[c].capsized) {
      keyy = carStats.flipy[cn] + racers[c].squash;
    }
    racers[c].u.zyinv = zyinv;
    var xtrim = 0,
      ztrim = 0,
      ytrim = 0;
    if (racers[c].mtouch) {
      racers[c].loop = 0;
    }
    if (racers[c].wtouch) {
      if (racers[c].loop == 2 || racers[c].loop == -1) {
        racers[c].loop = -1;
        if (racers[c].u.left) {
          racers[c].pl = true;
        }
        if (racers[c].u.right) {
          racers[c].pr = true;
        }
        if (racers[c].u.up) {
          racers[c].pu = true;
        }
        if (racers[c].u.down) {
          racers[c].pd = true;
        }
      }
      racers[c].ucomp = 0;
      racers[c].dcomp = 0;
      racers[c].lcomp = 0;
      racers[c].rcomp = 0;
    }
    if (c == game.player) {
      if (!racers[c].wtouch) {
        if (racers[c].u.up) {
          if (!racers[c].actu) {
            if (racers[c].loop == 0) {
              racers[c].loop = 1;
            }
          }
        } else {
          racers[c].actu = false;
        }
        if (racers[c].u.down) {
          if (!racers[c].actd) {
            if (racers[c].loop == 0) {
              racers[c].loop = 1;
            }
          }
        } else {
          racers[c].actd = false;
        }
        if (racers[c].u.left) {
          if (!racers[c].actl) {
            if (racers[c].loop == 0) {
              racers[c].loop = 1;
            }
          }
        } else {
          racers[c].actl = false;
        }
        if (racers[c].u.right) {
          if (!racers[c].actr) {
            if (racers[c].loop == 0) {
              racers[c].loop = 1;
            }
          }
        } else {
          racers[c].actr = false;
        }
      } else {
        racers[c].actl = true;
        racers[c].actr = true;
        racers[c].actu = true;
        racers[c].actd = true;
      }
    }
    if (racers[c].u.handb) {
      if (!racers[c].pushed) {
        if (!racers[c].wtouch) {
          if (racers[c].loop == 0) {
            racers[c].loop = 1;
            racers[c].actl = false;
            racers[c].actr = false;
            racers[c].actu = false;
            racers[c].actd = false;
          }
        } else {
          if (racers[c].gtouch) {
            racers[c].pushed = true;
          }
        }
      }
    } else {
      racers[c].pushed = false;
    }
    if (racers[c].loop == 1) {
      var avay =
        (racers[c].scy[0] +
          racers[c].scy[1] +
          racers[c].scy[2] +
          racers[c].scy[3]) /
        4;
      for (var i = 0; i < 4; i++) {
        racers[c].scy[i] = avay;
      }
      racers[c].loop = 2;
    }
    if (!racers[c].dest) {
      if (racers[c].loop == 2) {
        if (racers[c].u.up && !racers[c].actu) {
          if (racers[c].ucomp == 0) {
            racers[c].ucomp = 10 + (-racers[c].scy[0] * 10 + 50) / 20;
            if (racers[c].ucomp < 5) {
              racers[c].ucomp = 5;
            }
            if (racers[c].ucomp > 10) {
              racers[c].ucomp = 10;
            }
            racers[c].ucomp *= carStats.airs[cn];
          }
          if (racers[c].ucomp < 20) {
            racers[c].ucomp += 0.5 * carStats.airs[cn];
          }
          xtrim = -carStats.airc[cn] * msin(car[c].xz) * cov;
          ztrim = carStats.airc[cn] * mcos(car[c].xz) * cov;
        } else {
          if (racers[c].ucomp != 0) {
            if (racers[c].ucomp > -2) {
              racers[c].ucomp -= 0.5 * carStats.airs[cn];
            }
          }
        }
        if (racers[c].u.down && !racers[c].actd) {
          if (racers[c].dcomp == 0) {
            racers[c].dcomp = 10 + (-racers[c].scy[0] * 10 + 50) / 20;
            if (racers[c].dcomp < 5) {
              racers[c].dcomp = 5;
            }
            if (racers[c].dcomp > 10) {
              racers[c].dcomp = 10;
            }
            racers[c].dcomp *= carStats.airs[cn];
          }
          if (racers[c].dcomp < 20) {
            racers[c].dcomp += 0.5 * carStats.airs[cn];
          }
          ytrim = carStats.airc[cn];
        } else {
          if (racers[c].dcomp != 0) {
            if (racers[c].ucomp > -2) {
              racers[c].dcomp -= 0.5 * carStats.airs[cn];
            }
          }
        }
        if (racers[c].u.left && !racers[c].actl) {
          if (racers[c].lcomp == 0) {
            racers[c].lcomp = 5;
          }
          if (racers[c].lcomp < 20) {
            racers[c].lcomp += 2 * carStats.airs[cn];
          }
          xtrim = carStats.airc[cn] * mcos(car[c].xz) * mlt;
          ztrim = carStats.airc[cn] * msin(car[c].xz) * mlt;
        } else {
          if (racers[c].lcomp > 0) {
            racers[c].lcomp -= 2 * carStats.airs[cn];
          }
        }
        if (racers[c].u.right && !racers[c].actr) {
          if (racers[c].rcomp == 0) {
            racers[c].rcomp = 5;
          }
          if (racers[c].rcomp < 20) {
            racers[c].rcomp += 2 * carStats.airs[cn];
          }
          xtrim = -carStats.airc[cn] * mcos(car[c].xz) * mlt;
          ztrim = -carStats.airc[cn] * msin(car[c].xz) * mlt;
        } else {
          if (racers[c].rcomp > 0) {
            racers[c].rcomp -= 2 * carStats.airs[cn];
          }
        }
        racers[c].pzy -=
          (racers[c].dcomp - racers[c].ucomp) *
          mcos(racers[c].pxy) *
          tick.scale;
        if (zyinv) {
          car[c].xz -=
            (racers[c].dcomp - racers[c].ucomp) *
            msin(racers[c].pxy) *
            tick.scale;
        } else {
          car[c].xz +=
            (racers[c].dcomp - racers[c].ucomp) *
            msin(racers[c].pxy) *
            tick.scale;
        }
        racers[c].pxy += (racers[c].rcomp - racers[c].lcomp) * tick.scale;
      } else {
        var upower = racers[c].power;
        if (upower < 40) {
          upower = 40;
        }
        if (racers[c].u.down) {
          if (racers[c].speed > 0) {
            racers[c].speed -= (carStats.handb[cn] / 2) * tick.scale;
          } else {
            var sw = 0;
            for (var i = 0; i < 2; i++) {
              if (
                racers[c].speed <=
                -(
                  carStats.swits[cn][i] / 2 +
                  (upower * carStats.swits[cn][i]) / 196
                )
              ) {
                sw++;
              }
            }
            if (sw != 2) {
              racers[c].speed -=
                (carStats.acelf[cn][sw] / 2 +
                  (upower * carStats.acelf[cn][sw]) / 196) *
                tick.scale;
            } else {
              racers[c].speed = -(
                (carStats.swits[cn][1] / 2 +
                  (upower * carStats.swits[cn][1]) / 196) *
                tick.scale
              );
            }
          }
        }
        if (racers[c].u.up) {
          if (racers[c].speed < 0) {
            racers[c].speed += carStats.handb[cn] * tick.scale;
          } else {
            var sw = 0;
            for (var i = 0; i < 3; i++) {
              if (
                racers[c].speed >=
                carStats.swits[cn][i] / 2 +
                  (upower * carStats.swits[cn][i]) / 196
              ) {
                sw++;
              }
            }
            if (sw != 3) {
              racers[c].speed +=
                (carStats.acelf[cn][sw] / 2 +
                  (upower * carStats.acelf[cn][sw]) / 196) *
                tick.scale;
            } else {
              racers[c].speed =
                carStats.swits[cn][2] / 2 +
                (upower * carStats.swits[cn][2]) / 196;
            }
          }
        }
        if (racers[c].u.handb) {
          if (Math.abs(racers[c].speed) > carStats.handb[cn]) {
            if (racers[c].speed < 0) {
              racers[c].speed += carStats.handb[cn] * tick.scale;
            } else {
              racers[c].speed -= carStats.handb[cn] * tick.scale;
            }
          }
        }
        if (racers[c].loop == -1) {
          if (car[c].y > 15) {
            if (racers[c].u.left) {
              if (!racers[c].pl) {
                if (racers[c].lcomp == 0) {
                  racers[c].lcomp = 5 * carStats.airs[cn];
                }
                if (racers[c].lcomp < 20) {
                  racers[c].lcomp += 2 * carStats.airs[cn];
                }
              }
            } else {
              if (racers[c].lcomp > 0) {
                racers[c].lcomp -= 2 * carStats.airs[cn];
              }
              racers[c].pl = false;
            }
            if (racers[c].u.right) {
              if (!racers[c].pr) {
                if (racers[c].rcomp == 0) {
                  racers[c].rcomp = 5 * carStats.airs[cn];
                }
                if (racers[c].rcomp < 20) {
                  racers[c].rcomp += 2 * carStats.airs[cn];
                }
              }
            } else {
              if (racers[c].rcomp > 0) {
                racers[c].rcomp -= 2 * carStats.airs[cn];
              }
              racers[c].pr = false;
            }
            if (racers[c].u.up) {
              if (!racers[c].pu) {
                if (racers[c].ucomp == 0) {
                  racers[c].ucomp = 5 * carStats.airs[cn];
                }
                if (racers[c].ucomp < 20) {
                  racers[c].ucomp += 2 * carStats.airs[cn];
                }
              }
            } else {
              if (racers[c].ucomp > 0) {
                racers[c].ucomp -= 2 * carStats.airs[cn];
              }
              racers[c].pu = false;
            }
            if (racers[c].u.down) {
              if (!racers[c].pd) {
                if (racers[c].dcomp == 0) {
                  racers[c].dcomp = 5 * carStats.airs[cn];
                }
                if (racers[c].dcomp < 20) {
                  racers[c].dcomp += 2 * carStats.airs[cn];
                }
              }
            } else {
              if (racers[c].dcomp > 0) {
                racers[c].dcomp -= 2 * carStats.airs[cn];
              }
              racers[c].pd = false;
            }
            racers[c].pzy -=
              (racers[c].dcomp - racers[c].ucomp) *
              mcos(racers[c].pxy) *
              tick.scale;
            if (zyinv) {
              car[c].xz -=
                (racers[c].dcomp - racers[c].ucomp) *
                msin(racers[c].pxy) *
                tick.scale;
            } else {
              car[c].xz +=
                (racers[c].dcomp - racers[c].ucomp) *
                msin(racers[c].pxy) *
                tick.scale;
            }
            racers[c].pxy += (racers[c].rcomp - racers[c].lcomp) * tick.scale;
          }
        }
      }
    }
    var wrots = (200 * racers[c].speed) / (154 * carStats.simag[cn]);
    car[c].wzy -= wrots * tick.scale;
    if (car[c].wzy < -360) {
      car[c].wzy += 360;
    }
    if (car[c].wzy > 360) {
      car[c].wzy -= 360;
    }
    if (racers[c].u.left) {
      car[c].wxz -= carStats.turn[cn] * tick.scale;
      if (car[c].wxz < -36) {
        car[c].wxz = -36;
      }
    }
    if (racers[c].u.right) {
      car[c].wxz += carStats.turn[cn] * tick.scale;
      if (car[c].wxz > 36) {
        car[c].wxz = 36;
      }
    }
    if (car[c].wxz != 0 && !racers[c].u.left && !racers[c].u.right) {
      if (Math.abs(racers[c].speed) < 1) {
        if (Math.abs(car[c].wxz) <= tick.scale) {
          car[c].wxz = 0;
        }
        if (car[c].wxz > 0) {
          car[c].wxz -= tick.scale;
        }
        if (car[c].wxz < 0) {
          car[c].wxz += tick.scale;
        }
      } else {
        if (Math.abs(car[c].wxz) < carStats.turn[cn] * 2 * tick.scale) {
          car[c].wxz = 0;
        }
        if (car[c].wxz > 0) {
          car[c].wxz -= carStats.turn[cn] * 2 * tick.scale;
        }
        if (car[c].wxz < 0) {
          car[c].wxz += carStats.turn[cn] * 2 * tick.scale;
        }
      }
    }
    var divt = 36 / (racers[c].speed * racers[c].speed);
    if (divt < 5) {
      divt = 5;
    }
    if (racers[c].speed < 0) {
      divt = -divt;
    }
    if (racers[c].wtouch) {
      if (!racers[c].capsized) {
        if (!racers[c].u.handb) {
          racers[c].fxz = (car[c].wxz / (divt * 3)) * tick.scale;
        } else {
          racers[c].fxz = (car[c].wxz / divt) * tick.scale;
        }
        car[c].xz += (car[c].wxz / divt) * tick.scale;
      }
      racers[c].wtouch = false;
      racers[c].gtouch = false;
    } else {
      car[c].xz += racers[c].fxz;
    }
    if (racers[c].speed > 3 || racers[c].speed < -7) {
      while (Math.abs(racers[c].mxz - racers[c].cxz) > 180) {
        if (racers[c].cxz > racers[c].mxz) {
          racers[c].cxz -= 360;
        } else {
          if (racers[c].cxz < racers[c].mxz) {
            racers[c].cxz += 360;
          }
        }
      }
      if (Math.abs(racers[c].mxz - racers[c].cxz) < 30) {
        racers[c].cxz += (racers[c].mxz - racers[c].cxz) / 4;
      } else {
        if (racers[c].cxz > racers[c].mxz) {
          racers[c].cxz -= 10 * tick.scale;
        }
        if (racers[c].cxz < racers[c].mxz) {
          racers[c].cxz += 10 * tick.scale;
        }
      }
    }
    var kx = [];
    var kz = [];
    var ky = [];
    for (var i = 0; i < 4; i++) {
      kx[i] = car[c].keyx[i] + car[c].x;
      ky[i] = keyy + car[c].y;
      kz[i] = car[c].z + car[c].keyz[i];
      racers[c].scy[i] -= 0.7 * tick.scale;
    }
    rotate(kx, ky, car[c].x, car[c].y, racers[c].pxy, 4);
    rotate(ky, kz, car[c].y, car[c].z, racers[c].pzy, 4);
    rotate(kx, kz, car[c].x, car[c].z, car[c].xz, 4);
    var wastouch = false;
    var arch = 0;
    var avnx =
      (racers[c].scx[0] +
        racers[c].scx[1] +
        racers[c].scx[2] +
        racers[c].scx[3]) /
      4;
    var avnz =
      (racers[c].scz[0] +
        racers[c].scz[1] +
        racers[c].scz[2] +
        racers[c].scz[3]) /
      4;
    for (var i = 0; i < 4; i++) {
      if (racers[c].scx[i] - avnx > 20) {
        racers[c].scx[i] = 20 + avnx;
      }
      if (racers[c].scx[i] - avnx < -20) {
        racers[c].scx[i] = avnx - 20;
      }
      if (racers[c].scz[i] - avnz > 20) {
        racers[c].scz[i] = 20 + avnz;
      }
      if (racers[c].scz[i] - avnz < -20) {
        racers[c].scz[i] = avnz - 20;
      }
    }
    for (var i = 0; i < 4; i++) {
      ky[i] += racers[c].scy[i] * tick.scale;
      kx[i] +=
        ((racers[c].scx[0] +
          racers[c].scx[1] +
          racers[c].scx[2] +
          racers[c].scx[3]) /
          4) *
        tick.scale;
      kz[i] +=
        ((racers[c].scz[0] +
          racers[c].scz[1] +
          racers[c].scz[2] +
          racers[c].scz[3]) /
          4) *
        tick.scale;
    }
    var tskd = 1;
    var ontsprk = false;
    for (var o = 0; o < pieces.count; o++) {
      if (pieceModels[pieces.list[o].typ].skid != -1) {
        var bx =
          pieces.list[o].x +
          pieceModels[pieces.list[o].typ].bx * pieces.list[o].mat[0] +
          pieceModels[pieces.list[o].typ].bz * pieces.list[o].mat[8];
        var sx =
          pieces.list[o].x +
          pieceModels[pieces.list[o].typ].sx * pieces.list[o].mat[0] +
          pieceModels[pieces.list[o].typ].sz * pieces.list[o].mat[8];
        var bz =
          pieces.list[o].z +
          pieceModels[pieces.list[o].typ].bz * pieces.list[o].mat[10] +
          pieceModels[pieces.list[o].typ].bx * pieces.list[o].mat[2];
        var sz =
          pieces.list[o].z +
          pieceModels[pieces.list[o].typ].sz * pieces.list[o].mat[10] +
          pieceModels[pieces.list[o].typ].sx * pieces.list[o].mat[2];
        var intr = 0;
        if (bx > sx) {
          if (car[c].x > sx && car[c].x < bx) {
            intr++;
          }
        } else {
          if (car[c].x > bx && car[c].x < sx) {
            intr++;
          }
        }
        if (bz > sz) {
          if (car[c].z > sz && car[c].z < bz) {
            intr++;
          }
        } else {
          if (car[c].z > bz && car[c].z < sz) {
            intr++;
          }
        }
        if (intr == 2) {
          tskd = pieceModels[pieces.list[o].typ].skid;
          ontsprk = true;
        }
      }
    }
    if (racers[c].mtouch) {
      var ugrip = carStats.grip[cn];
      ugrip -= (Math.abs(racers[c].txz - car[c].xz) * racers[c].speed) / 250;
      if (racers[c].u.handb) {
        ugrip -= Math.abs(racers[c].txz - car[c].xz) * 4;
      }
      if (ugrip < carStats.grip[cn]) {
        if (racers[c].skid != 2) {
          racers[c].skid = 1;
        }
        racers[c].speed -= (racers[c].speed / 100) * tick.scale;
      } else {
        if (racers[c].skid == 1) {
          racers[c].skid = 2;
        }
      }
      if (tskd == 1) {
        ugrip *= 0.75;
      }
      if (tskd == 2) {
        ugrip *= 0.55;
      }
      var motorx = -(racers[c].speed * msin(car[c].xz) * mcos(racers[c].pzy));
      var motorz = racers[c].speed * mcos(car[c].xz) * mcos(racers[c].pzy);
      var motory = -(racers[c].speed * msin(racers[c].pzy));
      if (racers[c].capsized || racers[c].dest || track.haltall) {
        motorx = 0;
        motorz = 0;
        motory = 0;
        ugrip = carStats.grip[cn] / 5;
        if (racers[c].speed > 0) {
          racers[c].speed -= 0.2 * tick.scale;
        } else {
          racers[c].speed += 0.2 * tick.scale;
        }
      }
      if (Math.abs(racers[c].speed) > drag) {
        if (racers[c].speed > 0) {
          racers[c].speed -= drag * tick.scale;
        } else {
          racers[c].speed += drag * tick.scale;
        }
      } else {
        racers[c].speed = 0;
      }
      if (cn == 10) {
        if (ugrip < 0.5) {
          ugrip = 0.5;
        }
      }
      if (ugrip < 0.1) {
        ugrip = 0.1;
      }
      var avcx = 0,
        avcz = 0;
      for (var i = 0; i < 4; i++) {
        if (Math.abs(racers[c].scx[i] - motorx) > ugrip * tick.scale) {
          if (racers[c].scx[i] < motorx) {
            racers[c].scx[i] += ugrip * tick.scale;
          } else {
            racers[c].scx[i] -= ugrip * tick.scale;
          }
        } else {
          racers[c].scx[i] = motorx;
        }
        if (Math.abs(racers[c].scz[i] - motorz) > ugrip * tick.scale) {
          if (racers[c].scz[i] < motorz) {
            racers[c].scz[i] += ugrip * tick.scale;
          } else {
            racers[c].scz[i] -= ugrip * tick.scale;
          }
        } else {
          racers[c].scz[i] = motorz;
        }
        if (Math.abs(racers[c].scy[i] - motory) > ugrip * tick.scale) {
          if (racers[c].scy[i] < motory) {
            racers[c].scy[i] += ugrip * tick.scale;
          } else {
            racers[c].scy[i] -= ugrip * tick.scale;
          }
        } else {
          racers[c].scy[i] = motory;
        }
        if (tick.fraction >= tick.scale) {
          if (ugrip < carStats.grip[cn]) {
            if (racers[c].txz != car[c].xz) {
              racers[c].dcnt++;
            } else {
              if (racers[c].dcnt != 0) {
                racers[c].dcnt = 0;
              }
            }
            if (
              racers[c].dcnt > (40 * ugrip) / carStats.grip[cn] ||
              racers[c].capsized
            ) {
              var mag = 1;
              if (tskd != 0) {
                mag = 1.2;
              }
              if (random.fx() > 0.65) {
                dustup(
                  tskd,
                  c,
                  i,
                  kx[i],
                  ky[i],
                  kz[i],
                  racers[c].scx[i],
                  racers[c].scz[i],
                  mag * carStats.simag[cn],
                  racers[c].tilt,
                  racers[c].capsized && racers[c].mtouch,
                );
                if (c == game.player && !racers[c].capsized) {
                  skidSound(
                    tskd,
                    ontsprk,
                    Math.sqrt(
                      racers[c].scx[i] * racers[c].scx[i] +
                        racers[c].scz[i] * racers[c].scz[i],
                    ),
                  );
                }
              }
            } else {
              if (tskd == 1) {
                if (random.fx() > 0.8) {
                  dustup(
                    tskd,
                    c,
                    i,
                    kx[i],
                    ky[i],
                    kz[i],
                    racers[c].scx[i],
                    racers[c].scz[i],
                    1.1 * carStats.simag[cn],
                    racers[c].tilt,
                    racers[c].capsized && racers[c].mtouch,
                  );
                }
              }
              if (tskd == 2) {
                if (random.fx() > 0.6) {
                  dustup(
                    tskd,
                    c,
                    i,
                    kx[i],
                    ky[i],
                    kz[i],
                    racers[c].scx[i],
                    racers[c].scz[i],
                    1.15 * carStats.simag[cn],
                    racers[c].tilt,
                    racers[c].capsized && racers[c].mtouch,
                  );
                }
              }
            }
          } else {
            if (racers[c].dcnt != 0) {
              racers[c].dcnt -= 2;
              if (racers[c].dcnt < 0) {
                racers[c].dcnt = 0;
              }
            }
          }
        }
        avcx += racers[c].scx[i];
        avcz += racers[c].scz[i];
      }
      racers[c].txz = car[c].xz;
      if (avcx > 0) {
        mlt = -1;
      } else {
        mlt = 1;
      }
      if (avcx != 0 || avcz != 0) {
        arch = avcz / Math.sqrt(avcx * avcx + avcz * avcz);
      } else {
        arch = 0;
      }
      racers[c].mxz = (Math.acos(arch) / 0.017453292519943295) * mlt;
      if (racers[c].skid == 2) {
        if (!racers[c].capsized) {
          avcx = avcx / 4;
          avcz = avcz / 4;
          if (doublinv) {
            racers[c].speed = -(
              Math.sqrt(avcx * avcx + avcz * avcz) *
              mcos(racers[c].mxz - car[c].xz)
            );
          } else {
            racers[c].speed =
              Math.sqrt(avcx * avcx + avcz * avcz) *
              mcos(racers[c].mxz - car[c].xz);
          }
        }
        racers[c].skid = 0;
      }
      if (racers[c].capsized && avcx == 0 && avcz == 0) {
        tskd = 0;
      }
      racers[c].mtouch = false;
      wastouch = true;
    } else {
      if (racers[c].skid != 2) {
        racers[c].skid = 2;
      }
    }
    var ntr = 0;
    var sprkon = [];
    var onorm = [0, 0];
    for (var i = 0; i < 4; i++) {
      sprkon[i] = 0;
      if (ky[i] < -0.05) {
        ntr++;
        racers[c].wtouch = true;
        racers[c].gtouch = true;
        if (!wastouch) {
          if (racers[c].scy[i] != -0.7) {
            var mag = racers[c].scy[i] / 33.33;
            if (mag > 0.3) {
              mag = 0.3;
            }
            if (tskd == 0) {
              mag += 1.1;
            } else {
              mag += 1.2;
            }
            dustup(
              tskd,
              c,
              i,
              kx[i],
              ky[i],
              kz[i],
              racers[c].scx[i],
              racers[c].scz[i],
              mag * carStats.simag[cn],
              0,
              racers[c].capsized && racers[c].mtouch,
            );
          }
        }
        ky[i] = 0;
        var bmac =
          Math.abs(msin(racers[c].pxy)) + Math.abs(msin(racers[c].pzy));
        bmac = bmac / 3;
        if (bmac > 0.4) {
          bmac = 0.4;
        }
        bmac += carStats.bounce[cn];
        if (bmac < 1.1) {
          bmac = 1.1;
        }
        regn(2, i, Math.abs(racers[c].scy[i] * bmac), c);
        if (racers[c].scy[i] < 0) {
          racers[c].scy[i] += Math.abs(racers[c].scy[i] * bmac);
        }
        if (racers[c].capsized) {
          if (ontsprk && (tskd == 0 || tskd == 1)) {
            sprkon[i] = 1;
          } else {
            sprkon[i] = 2;
          }
        }
        onorm[Math.floor(i * 0.5)] = 1;
      }
    }
    var zboundr =
      Math.abs(carStats.boundr[cn] * car[c].mat[10]) +
      Math.abs(2 * car[c].mat[8]);
    var xboundr =
      Math.abs(carStats.boundr[cn] * car[c].mat[8]) +
      Math.abs(2 * car[c].mat[10]);
    var ntron = 0;
    for (var o = 0; o < pieces.count; o++) {
      var ntroff = 0;
      var ntrt = 0;
      if (
        pieceModels[pieces.list[o].typ].intershad ||
        pieceModels[pieces.list[o].typ].interact
      ) {
        if (
          Math.abs(car[c].x - pieces.list[o].x) <
            pieceModels[pieces.list[o].typ].colrad + carModels[cn].colrad &&
          Math.abs(car[c].y - pieces.list[o].y) <
            pieceModels[pieces.list[o].typ].colrad + carModels[cn].colrad &&
          Math.abs(car[c].z - pieces.list[o].z) <
            pieceModels[pieces.list[o].typ].colrad + carModels[cn].colrad
        ) {
          pieceModels[pieces.list[o].typ].x = pieces.list[o].x;
          pieceModels[pieces.list[o].typ].y = pieces.list[o].y;
          pieceModels[pieces.list[o].typ].z = pieces.list[o].z;
          pieceModels[pieces.list[o].typ].mat = pieces.list[o].mat;
          var rad = pieceModels[pieces.list[o].typ];
          var cancelbnd = false;
          if (pieces.list[o].typ == 33 || pieces.list[o].typ == 34) {
            cancelbnd = true;
          }
          if (
            (pieces.list[o].typ == 46 || pieces.list[o].typ == 47) &&
            car[c].y > 70
          ) {
            cancelbnd = true;
          }
          if (
            (pieces.list[o].typ == 50 || pieces.list[o].typ == 48) &&
            car[c].y > 140
          ) {
            cancelbnd = true;
          }
          if (pieces.list[o].typ == 49 && car[c].y > 280) {
            cancelbnd = true;
          }
          if (pieces.list[o].typ == 51 && car[c].y > 310) {
            cancelbnd = true;
          }
          if (pieces.list[o].typ == 40 && car[c].y > 100) {
            cancelbnd = true;
          }
          var cancelpln = false;
          if (pieces.list[o].typ == 1) {
            cancelpln = true;
          }
          for (var k = 0; k < 4; k++) {
            if (
              Math.abs(kx[k] - pieces.list[o].x) < pieces.list[o].bx &&
              Math.abs(kz[k] - pieces.list[o].z) < pieces.list[o].bz &&
              Math.abs(ky[k] - pieces.list[o].y) < pieces.list[o].by
            ) {
              var normx = 0,
                normy = 0,
                normz = 0;
              for (var i = 0; i < rad.ni / 3; i++) {
                var vertx = [];
                var verty = [];
                var vertz = [];
                for (var v = 0; v < 3; v++) {
                  var vp = rad.tri[i * 9 + v * 3];
                  vertx[v] =
                    -(rad.vrt[vp * 3] * rad.mat[0]) +
                    rad.vrt[vp * 3 + 2] * rad.mat[8];
                  verty[v] = rad.vrt[vp * 3 + 1];
                  vertz[v] =
                    rad.vrt[vp * 3 + 2] * rad.mat[10] -
                    rad.vrt[vp * 3] * rad.mat[2];
                }
                var vp = rad.tri[i * 9 + 1];
                normx =
                  -(rad.nrm[vp * 3] * rad.mat[0]) +
                  rad.nrm[vp * 3 + 2] * rad.mat[8];
                normy = rad.nrm[vp * 3 + 1];
                normz =
                  rad.nrm[vp * 3 + 2] * rad.mat[10] -
                  rad.nrm[vp * 3] * rad.mat[2];
                var crx = kx[k] - rad.x;
                var cry = ky[k] + 7 - rad.y;
                var crz = kz[k] - rad.z;
                if (Math.abs(normy) < rad.walarc && !cancelbnd) {
                  var bncbth = false;
                  if (!rad.interact) {
                    if (pieces.list[o].typ != 39) {
                      var verlow = 10000;
                      for (var j = 0; j < 3; j++) {
                        if (verty[j] < verlow) {
                          verlow = verty[j];
                        }
                      }
                      for (var j = 0; j < 3; j++) {
                        if (Math.abs(verty[j] - verlow) < 2) {
                          verty[j] -= 100;
                        }
                      }
                    } else {
                      if (i == 43) {
                        if (Math.abs(normz) == 1) {
                          vertx[0] = -vertx[1];
                          vertx[2] = -vertx[1];
                          for (var j = 0; j < 3; j++) {
                            vertz[j] *= 1;
                          }
                          verty[0] += 50;
                          verty[1] = -10;
                          verty[2] = -10;
                        }
                        if (Math.abs(normx) == 1) {
                          vertz[0] = -vertz[1];
                          vertz[2] = -vertz[1];
                          for (var j = 0; j < 3; j++) {
                            vertx[j] *= 1;
                          }
                          verty[0] += 50;
                          verty[1] = -10;
                          verty[2] = -10;
                        }
                        bncbth = true;
                      }
                      if (i == 44) {
                        if (Math.abs(normz) == 1) {
                          vertx[1] = -vertx[0];
                          for (var j = 0; j < 3; j++) {
                            vertz[j] *= 1;
                          }
                          verty[1] += 50;
                          verty[2] += 50;
                          verty[0] = -10;
                        }
                        if (Math.abs(normx) == 1) {
                          vertz[1] = -vertz[0];
                          for (var j = 0; j < 3; j++) {
                            vertx[j] *= 1;
                          }
                          verty[1] += 50;
                          verty[2] += 50;
                          verty[0] = -10;
                        }
                        bncbth = true;
                      }
                    }
                  }
                  if (Math.abs(normz) > Math.abs(normx)) {
                    var areaOrig = Math.abs(
                      (vertx[1] - vertx[0]) * (verty[2] - verty[0]) -
                        (vertx[2] - vertx[0]) * (verty[1] - verty[0]),
                    );
                    var area1 = Math.abs(
                      (vertx[0] - crx) * (verty[1] - cry) -
                        (vertx[1] - crx) * (verty[0] - cry),
                    );
                    var area2 = Math.abs(
                      (vertx[1] - crx) * (verty[2] - cry) -
                        (vertx[2] - crx) * (verty[1] - cry),
                    );
                    var area3 = Math.abs(
                      (vertx[2] - crx) * (verty[0] - cry) -
                        (vertx[0] - crx) * (verty[2] - cry),
                    );
                    if (area1 + area2 + area3 <= areaOrig + 10) {
                      var fct = 0;
                      if (verty[0] - verty[1] != 0) {
                        fct =
                          (ky[k] - (verty[1] + rad.y)) / (verty[0] - verty[1]);
                      } else {
                        fct = 0;
                      }
                      var lx = vertx[1] + (vertx[0] - vertx[1]) * fct;
                      var lz = vertz[1] + (vertz[0] - vertz[1]) * fct;
                      if (verty[0] - verty[2] != 0) {
                        fct =
                          (ky[k] - (verty[2] + rad.y)) / (verty[0] - verty[2]);
                      } else {
                        fct = 0;
                      }
                      var tx = vertx[2] + (vertx[0] - vertx[2]) * fct;
                      var tz = vertz[2] + (vertz[0] - vertz[2]) * fct;
                      if (tx - lx != 0) {
                        fct = (kx[k] - (lx + rad.x)) / (tx - lx);
                      } else {
                        fct = 0;
                      }
                      var colz = lz + rad.z + (tz - lz) * fct;
                      if (
                        pieces.list[o].bnd[0] != 1 &&
                        normz > 0 &&
                        kz[k] < colz + zboundr &&
                        kz[k] > colz + zboundr - rad.bndmax &&
                        (racers[c].scz[k] <= 1.2 || bncbth)
                      ) {
                        for (var j = 0; j < 4; j++) {
                          if (k != j) {
                            if (kz[j] >= colz + zboundr) {
                              kz[j] -= kz[k] - (colz + zboundr);
                            }
                          }
                        }
                        kz[k] = colz + zboundr;
                        if (tick.fraction >= tick.scale) {
                          racers[c].crank[k]++;
                          if (racers[c].crank[k] > 2) {
                            sprks(
                              cn,
                              kx[k],
                              ky[k],
                              kz[k] - zboundr,
                              racers[c].scx[k],
                              racers[c].scy[k],
                              racers[c].scz[k],
                              2,
                            );
                            if (c == game.player) {
                              scrapeSound(
                                racers[c].scx[k],
                                racers[c].scy[k],
                                racers[c].scz[k],
                              );
                            }
                          }
                        }
                        var bmac =
                          Math.abs(mcos(racers[c].pxy)) +
                          Math.abs(mcos(racers[c].pzy));
                        bmac = bmac / 4;
                        if (bmac > 0.3) {
                          bmac = 0.3;
                        }
                        if (wastouch) {
                          bmac = 0;
                        }
                        bmac += carStats.bounce[cn] - 0.2;
                        if (bmac < 1.1) {
                          bmac = 1.1;
                        }
                        regn(
                          1,
                          k,
                          Math.abs(racers[c].scz[k] * bmac * rad.dam),
                          c,
                        );
                        if (racers[c].scz[k] <= 0) {
                          racers[c].scz[k] += Math.abs(racers[c].scz[k] * bmac);
                        }
                        racers[c].skid = 2;
                        spinlocate = true;
                        racers[c].uwall = true;
                        if (
                          pieces.list[o].typ != 35 &&
                          pieces.list[o].typ != 36 &&
                          (pieces.list[o].typ != 39 || track.stage == 13) &&
                          (pieces.list[o].typ != 20 || track.stage != 14) &&
                          (pieces.list[o].typ != 1 || track.stage != 16)
                        ) {
                          racers[c].wall = o;
                        }
                      }
                      if (
                        pieces.list[o].bnd[1] != 1 &&
                        normz < 0 &&
                        kz[k] > colz - zboundr &&
                        kz[k] < colz - zboundr + rad.bndmax &&
                        (racers[c].scz[k] >= -1.2 || bncbth)
                      ) {
                        for (var j = 0; j < 4; j++) {
                          if (k != j) {
                            if (kz[j] <= colz - zboundr) {
                              kz[j] -= kz[k] - (colz - zboundr);
                            }
                          }
                        }
                        kz[k] = colz - zboundr;
                        if (tick.fraction >= tick.scale) {
                          racers[c].crank[k]++;
                          if (racers[c].crank[k] > 2) {
                            sprks(
                              cn,
                              kx[k],
                              ky[k],
                              kz[k] + zboundr,
                              racers[c].scx[k],
                              racers[c].scy[k],
                              racers[c].scz[k],
                              2,
                            );
                            if (c == game.player) {
                              scrapeSound(
                                racers[c].scx[k],
                                racers[c].scy[k],
                                racers[c].scz[k],
                              );
                            }
                          }
                        }
                        var bmac =
                          Math.abs(mcos(racers[c].pxy)) +
                          Math.abs(mcos(racers[c].pzy));
                        bmac = bmac / 4;
                        if (bmac > 0.3) {
                          bmac = 0.3;
                        }
                        if (wastouch) {
                          bmac = 0;
                        }
                        bmac += carStats.bounce[cn] - 0.2;
                        if (bmac < 1.1) {
                          bmac = 1.1;
                        }
                        regn(
                          1,
                          k,
                          -Math.abs(racers[c].scz[k] * bmac * rad.dam),
                          c,
                        );
                        if (racers[c].scz[k] >= 0) {
                          racers[c].scz[k] -= Math.abs(racers[c].scz[k] * bmac);
                        }
                        racers[c].skid = 2;
                        spinlocate = true;
                        racers[c].uwall = true;
                        if (
                          pieces.list[o].typ != 35 &&
                          pieces.list[o].typ != 36 &&
                          (pieces.list[o].typ != 39 || track.stage == 13) &&
                          (pieces.list[o].typ != 20 || track.stage != 14) &&
                          (pieces.list[o].typ != 1 || track.stage != 16)
                        ) {
                          racers[c].wall = o;
                        }
                      }
                    }
                  } else {
                    var areaOrig = Math.abs(
                      (verty[1] - verty[0]) * (vertz[2] - vertz[0]) -
                        (verty[2] - verty[0]) * (vertz[1] - vertz[0]),
                    );
                    var area1 = Math.abs(
                      (verty[0] - cry) * (vertz[1] - crz) -
                        (verty[1] - cry) * (vertz[0] - crz),
                    );
                    var area2 = Math.abs(
                      (verty[1] - cry) * (vertz[2] - crz) -
                        (verty[2] - cry) * (vertz[1] - crz),
                    );
                    var area3 = Math.abs(
                      (verty[2] - cry) * (vertz[0] - crz) -
                        (verty[0] - cry) * (vertz[2] - crz),
                    );
                    if (area1 + area2 + area3 <= areaOrig + 10) {
                      var fct = 0;
                      if (vertz[0] - vertz[1] != 0) {
                        fct =
                          (kz[k] - (vertz[1] + rad.z)) / (vertz[0] - vertz[1]);
                      } else {
                        fct = 0;
                      }
                      var lx = vertx[1] + (vertx[0] - vertx[1]) * fct;
                      var ly = verty[1] + (verty[0] - verty[1]) * fct;
                      if (vertz[0] - vertz[2] != 0) {
                        fct =
                          (kz[k] - (vertz[2] + rad.z)) / (vertz[0] - vertz[2]);
                      } else {
                        fct = 0;
                      }
                      var tx = vertx[2] + (vertx[0] - vertx[2]) * fct;
                      var ty = verty[2] + (verty[0] - verty[2]) * fct;
                      if (ty - ly != 0) {
                        fct = (ky[k] - (ly + rad.y)) / (ty - ly);
                      } else {
                        fct = 0;
                      }
                      var colx = lx + rad.x + (tx - lx) * fct;
                      if (
                        pieces.list[o].bnd[2] != 1 &&
                        normx > 0 &&
                        kx[k] < colx + xboundr &&
                        kx[k] > colx + xboundr - rad.bndmax &&
                        (racers[c].scx[k] <= 1.2 || bncbth)
                      ) {
                        for (var j = 0; j < 4; j++) {
                          if (k != j) {
                            if (kx[j] >= colx + xboundr) {
                              kx[j] -= kx[k] - (colx + xboundr);
                            }
                          }
                        }
                        kx[k] = colx + xboundr;
                        if (tick.fraction >= tick.scale) {
                          racers[c].crank[k]++;
                          if (racers[c].crank[k] > 2) {
                            sprks(
                              cn,
                              kx[k] - xboundr,
                              ky[k],
                              kz[k],
                              racers[c].scx[k],
                              racers[c].scy[k],
                              racers[c].scz[k],
                              2,
                            );
                            if (c == game.player) {
                              scrapeSound(
                                racers[c].scx[k],
                                racers[c].scy[k],
                                racers[c].scz[k],
                              );
                            }
                          }
                        }
                        var bmac =
                          Math.abs(mcos(racers[c].pxy)) +
                          Math.abs(mcos(racers[c].pzy));
                        bmac = bmac / 4;
                        if (bmac > 0.3) {
                          bmac = 0.3;
                        }
                        if (wastouch) {
                          bmac = 0;
                        }
                        bmac += carStats.bounce[cn] - 0.2;
                        if (bmac < 1.1) {
                          bmac = 1.1;
                        }
                        regn(
                          0,
                          k,
                          Math.abs(racers[c].scx[k] * bmac * rad.dam),
                          c,
                        );
                        if (racers[c].scx[k] <= 0) {
                          racers[c].scx[k] += Math.abs(racers[c].scx[k] * bmac);
                        }
                        racers[c].skid = 2;
                        spinlocate = true;
                        racers[c].uwall = true;
                        if (
                          pieces.list[o].typ != 35 &&
                          pieces.list[o].typ != 36 &&
                          (pieces.list[o].typ != 39 || track.stage == 13) &&
                          (pieces.list[o].typ != 1 || track.stage != 16)
                        ) {
                          racers[c].wall = o;
                        }
                      }
                      if (
                        pieces.list[o].bnd[3] != 1 &&
                        normx < 0 &&
                        kx[k] > colx - xboundr &&
                        kx[k] < colx - xboundr + rad.bndmax &&
                        (racers[c].scx[k] >= -1.2 || bncbth)
                      ) {
                        for (var j = 0; j < 4; j++) {
                          if (k != j) {
                            if (kx[j] <= colx - xboundr) {
                              kx[j] -= kx[k] - (colx - xboundr);
                            }
                          }
                        }
                        kx[k] = colx - xboundr;
                        if (tick.fraction >= tick.scale) {
                          racers[c].crank[k]++;
                          if (racers[c].crank[k] > 2) {
                            sprks(
                              cn,
                              kx[k] + xboundr,
                              ky[k],
                              kz[k],
                              racers[c].scx[k],
                              racers[c].scy[k],
                              racers[c].scz[k],
                              2,
                            );
                            if (c == game.player) {
                              scrapeSound(
                                racers[c].scx[k],
                                racers[c].scy[k],
                                racers[c].scz[k],
                              );
                            }
                          }
                        }
                        var bmac =
                          Math.abs(mcos(racers[c].pxy)) +
                          Math.abs(mcos(racers[c].pzy));
                        bmac = bmac / 4;
                        if (bmac > 0.3) {
                          bmac = 0.3;
                        }
                        if (wastouch) {
                          bmac = 0;
                        }
                        bmac += carStats.bounce[cn] - 0.2;
                        if (bmac < 1.1) {
                          bmac = 1.1;
                        }
                        regn(
                          0,
                          k,
                          -Math.abs(racers[c].scx[k] * bmac * rad.dam),
                          c,
                        );
                        if (racers[c].scx[k] >= 0) {
                          racers[c].scx[k] -= Math.abs(racers[c].scx[k] * bmac);
                        }
                        racers[c].skid = 2;
                        spinlocate = true;
                        racers[c].uwall = true;
                        if (
                          pieces.list[o].typ != 35 &&
                          pieces.list[o].typ != 36 &&
                          (pieces.list[o].typ != 39 || track.stage == 13) &&
                          (pieces.list[o].typ != 1 || track.stage != 16)
                        ) {
                          racers[c].wall = o;
                        }
                      }
                    }
                  }
                }
                if (pieces.list[o].typ == 26) {
                  normy = Math.abs(normy);
                }
                if (normy > 0.4 && !cancelpln) {
                  var areaOrig = Math.abs(
                    (vertx[1] - vertx[0]) * (vertz[2] - vertz[0]) -
                      (vertx[2] - vertx[0]) * (vertz[1] - vertz[0]),
                  );
                  var area1 = Math.abs(
                    (vertx[0] - crx) * (vertz[1] - crz) -
                      (vertx[1] - crx) * (vertz[0] - crz),
                  );
                  var area2 = Math.abs(
                    (vertx[1] - crx) * (vertz[2] - crz) -
                      (vertx[2] - crx) * (vertz[1] - crz),
                  );
                  var area3 = Math.abs(
                    (vertx[2] - crx) * (vertz[0] - crz) -
                      (vertx[0] - crx) * (vertz[2] - crz),
                  );
                  if (area1 + area2 + area3 <= areaOrig + 10) {
                    var fct = 0;
                    if (vertz[0] - vertz[1] != 0) {
                      fct =
                        (kz[k] - (vertz[1] + rad.z)) / (vertz[0] - vertz[1]);
                    } else {
                      fct = 0;
                    }
                    var lx = vertx[1] + (vertx[0] - vertx[1]) * fct;
                    var ly = verty[1] + (verty[0] - verty[1]) * fct;
                    if (vertz[0] - vertz[2] != 0) {
                      fct =
                        (kz[k] - (vertz[2] + rad.z)) / (vertz[0] - vertz[2]);
                    } else {
                      fct = 0;
                    }
                    var tx = vertx[2] + (vertx[0] - vertx[2]) * fct;
                    var ty = verty[2] + (verty[0] - verty[2]) * fct;
                    if (tx - lx != 0) {
                      fct = (kx[k] - (lx + rad.x)) / (tx - lx);
                    } else {
                      fct = 0;
                    }
                    var coly = ly + rad.y + (ty - ly) * fct;
                    if (Math.abs(normy) == 1) {
                      if (ky[k] < coly - 0.05 && ky[k] > coly - 20) {
                        ntrt++;
                        racers[c].wtouch = true;
                        racers[c].gtouch = true;
                        if (!wastouch) {
                          if (racers[c].scy[k] != -0.7) {
                            var mag = racers[c].scy[k] / 33.33;
                            if (mag > 0.3) {
                              mag = 0.3;
                            }
                            if (tskd == 0) {
                              mag += 1.1;
                            } else {
                              mag += 1.2;
                            }
                            dustup(
                              tskd,
                              c,
                              k,
                              kx[k],
                              ky[k],
                              kz[k],
                              racers[c].scx[k],
                              racers[c].scz[k],
                              mag * carStats.simag[cn],
                              0,
                              racers[c].capsized && racers[c].mtouch,
                            );
                          }
                        }
                        ky[k] = coly;
                        if (racers[c].capsized) {
                          if (ontsprk && (tskd == 0 || tskd == 1)) {
                            sprkon[k] = 1;
                          } else {
                            sprkon[k] = 2;
                          }
                        }
                        var bmac =
                          Math.abs(msin(racers[c].pxy)) +
                          Math.abs(msin(racers[c].pzy));
                        bmac = bmac / 3;
                        if (bmac > 0.4) {
                          bmac = 0.4;
                        }
                        bmac += carStats.bounce[cn];
                        if (bmac < 1.1) {
                          bmac = 1.1;
                        }
                        regn(2, k, Math.abs(racers[c].scy[k] * bmac), c);
                        if (racers[c].scy[k] < 0) {
                          racers[c].scy[k] += Math.abs(racers[c].scy[k] * bmac);
                        }
                        onorm[Math.floor(k * 0.5)] = 1;
                      }
                    } else {
                      if (ty - ly != 0) {
                        fct = (ky[k] - (ly + rad.y)) / (ty - ly);
                      } else {
                        fct = 0;
                      }
                      var colx = lx + rad.x + (tx - lx) * fct;
                      fct = 0;
                      if (verty[0] - verty[1] != 0) {
                        fct =
                          (ky[k] - (verty[1] + rad.y)) / (verty[0] - verty[1]);
                      } else {
                        fct = 0;
                      }
                      lx = vertx[1] + (vertx[0] - vertx[1]) * fct;
                      var lz = vertz[1] + (vertz[0] - vertz[1]) * fct;
                      if (verty[0] - verty[2] != 0) {
                        fct =
                          (ky[k] - (verty[2] + rad.y)) / (verty[0] - verty[2]);
                      } else {
                        fct = 0;
                      }
                      tx = vertx[2] + (vertx[0] - vertx[2]) * fct;
                      var tz = vertz[2] + (vertz[0] - vertz[2]) * fct;
                      if (tx - lx != 0) {
                        fct = (kx[k] - (lx + rad.x)) / (tx - lx);
                      } else {
                        fct = 0;
                      }
                      var colz = lz + rad.z + (tz - lz) * fct;
                      if (ky[k] < coly && ky[k] > coly - 20) {
                        var bounceramp = false;
                        if (Math.abs(normz) > Math.abs(normx)) {
                          if (
                            (normz > 0 && racers[c].scz[k] < 0) ||
                            (normz < 0 && racers[c].scz[k] > 0)
                          ) {
                            bounceramp = true;
                          }
                        } else {
                          if (
                            (normx > 0 && racers[c].scx[k] < 0) ||
                            (normx < 0 && racers[c].scx[k] > 0)
                          ) {
                            bounceramp = true;
                          }
                        }
                        if (bounceramp) {
                          var bmac =
                            Math.abs(msin(racers[c].pxy)) +
                            Math.abs(msin(racers[c].pzy));
                          bmac = bmac / 3;
                          if (bmac > 0.4) {
                            bmac = 0.4;
                          }
                          bmac += carStats.bounce[cn];
                          if (bmac < 1.1) {
                            bmac = 1.1;
                          }
                          if (racers[c].scy[k] < 0) {
                            racers[c].scy[k] += Math.abs(
                              racers[c].scy[k] * bmac,
                            );
                          }
                          if (pieces.list[o].typ == 39) {
                            for (var ka = 0; ka < 4; ka++) {
                              if (Math.abs(normz) > Math.abs(normx)) {
                                if (normz > 0) {
                                  racers[c].scz[ka] += Math.abs(
                                    racers[c].scy[k] * bmac * 0.4,
                                  );
                                } else {
                                  racers[c].scz[ka] -= Math.abs(
                                    racers[c].scy[k] * bmac * 0.4,
                                  );
                                }
                              } else {
                                if (normx > 0) {
                                  racers[c].scx[ka] += Math.abs(
                                    racers[c].scy[k] * bmac * 0.4,
                                  );
                                } else {
                                  racers[c].scx[ka] -= Math.abs(
                                    racers[c].scy[k] * bmac * 0.4,
                                  );
                                }
                              }
                            }
                          }
                        }
                        var trzy =
                          Math.acos(Math.abs(normy)) / 0.017453292519943295;
                        var arct = 1 + (50 - Math.abs(trzy)) / 30;
                        if (arct < 1) {
                          arct = 1;
                        }
                        var difco = (coly - ky[k]) / (arct * tick.scale);
                        racers[c].scy[k] += difco;
                        ky[k] = coly;
                        if (difco > 0) {
                          difco *= 20;
                          difco = 100 - difco;
                          if (difco < 2) {
                            difco = 2;
                          }
                          if (Math.abs(normz) > Math.abs(normx)) {
                            if (Math.abs(colz - kz[k]) < 100) {
                              kz[k] += (colz - kz[k]) / difco;
                            }
                          } else {
                            if (Math.abs(colx - kx[k]) < 100) {
                              kx[k] += (colx - kx[k]) / difco;
                            }
                          }
                        }
                        if (tskd == 2) {
                          ntroff++;
                        } else {
                          ntron++;
                        }
                        racers[c].wtouch = true;
                        racers[c].gtouch = false;
                        if (racers[c].capsized) {
                          if (ontsprk && (tskd == 0 || tskd == 1)) {
                            sprkon[k] = 1;
                          } else {
                            sprkon[k] = 2;
                          }
                        }
                        if (!wastouch) {
                          if (tskd != 0) {
                            var mag = 1.4;
                            dustup(
                              tskd,
                              c,
                              i,
                              kx[i],
                              ky[i],
                              kz[i],
                              racers[c].scx[i],
                              racers[c].scz[i],
                              mag * carStats.simag[cn],
                              0,
                              racers[c].capsized && racers[c].mtouch,
                            );
                          }
                        }
                        onorm[Math.floor(k * 0.5)] = normy;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (ntroff == 4) {
        racers[c].mtouch = true;
      }
      if (ntrt == 4) {
        ntr = 4;
      }
    }
    if (ntron == 4) {
      racers[c].mtouch = true;
    }
    if (c == game.player) {
      for (var i = 0; i < 2; i++) {
        if (lonorm[i] != onorm[i]) {
          if (lonorm[i] > 0 && onorm[i] > 0) {
            if (Math.abs(lonorm[i] - onorm[i]) > 0.015) {
              bumpSound(i, Math.sqrt(avnx * avnx + avnz * avnz), tskd);
            }
          }
          lonorm[i] = onorm[i];
        }
      }
    }
    if (tick.fraction >= tick.scale) {
      var allsparks = 0;
      for (var k = 0; k < 4; k++) {
        if (sprkon[k] == 1) {
          allsparks++;
        }
      }
      if (allsparks != 4) {
        for (var k = 0; k < 4; k++) {
          if (sprkon[k] == 1) {
            sprks(
              cn,
              kx[k],
              ky[k],
              kz[k],
              racers[c].scx[k],
              racers[c].scy[k],
              racers[c].scz[k],
              1,
            );
          }
          if (c == game.player && sprkon[k]) {
            groundScrapeSound(
              sprkon[k],
              racers[c].scx[k],
              racers[c].scy[k],
              racers[c].scz[k],
            );
          }
        }
      } else {
        var k = Math.floor(random.fx() * 4);
        if (k == 4) {
          k = 0;
        }
        sprks(
          cn,
          (kx[k] + car[c].x) / 2,
          ky[k],
          (kz[k] + car[c].z) / 2,
          racers[c].scx[k],
          racers[c].scy[k],
          racers[c].scz[k],
          1,
        );
        k = Math.floor(random.fx() * 4);
        if (k == 4) {
          k = 0;
        }
        sprks(
          cn,
          (kx[k] + car[c].x) / 2,
          ky[k],
          (kz[k] + car[c].z) / 2,
          racers[c].scx[k],
          racers[c].scy[k],
          racers[c].scz[k],
          1,
        );
        if (c == game.player) {
          groundScrapeSound(
            1,
            racers[c].scx[k],
            racers[c].scy[k],
            racers[c].scz[k],
          );
        }
      }
    }
    for (var k = 0; k < 4; k++) {
      if (kz[k] < limb + zboundr && kz[k] > limb + zboundr - 20) {
        for (var j = 0; j < 4; j++) {
          if (k != j) {
            if (kz[j] >= limb + zboundr) {
              kz[j] -= kz[k] - (limb + zboundr);
            }
          }
        }
        kz[k] = limb + zboundr;
        if (tick.fraction >= tick.scale && ky[k] < 20) {
          racers[c].crank[k]++;
          if (racers[c].crank[k] > 2) {
            sprks(
              cn,
              kx[k],
              ky[k],
              kz[k] - zboundr,
              racers[c].scx[k],
              racers[c].scy[k],
              racers[c].scz[k],
              2,
            );
            if (c == game.player) {
              scrapeSound(racers[c].scx[k], racers[c].scy[k], racers[c].scz[k]);
            }
          }
        }
        var bmac =
          Math.abs(mcos(racers[c].pxy)) + Math.abs(mcos(racers[c].pzy));
        bmac = bmac / 4;
        if (bmac > 0.3) {
          bmac = 0.3;
        }
        if (wastouch) {
          bmac = 0;
        }
        bmac += carStats.bounce[cn] - 0.2;
        if (bmac < 1.1) {
          bmac = 1.1;
        }
        regn(1, k, Math.abs(racers[c].scz[k] * bmac), c);
        if (racers[c].scz[k] <= 0) {
          racers[c].scz[k] += Math.abs(racers[c].scz[k] * bmac);
        }
        racers[c].skid = 2;
        spinlocate = true;
        racers[c].wall = limbo;
      }
      if (kz[k] > limt - zboundr && kz[k] < limt - zboundr + 20) {
        for (var j = 0; j < 4; j++) {
          if (k != j) {
            if (kz[j] <= limt - zboundr) {
              kz[j] -= kz[k] - (limt - zboundr);
            }
          }
        }
        kz[k] = limt - zboundr;
        if (tick.fraction >= tick.scale && ky[k] < 20) {
          racers[c].crank[k]++;
          if (racers[c].crank[k] > 2) {
            sprks(
              cn,
              kx[k],
              ky[k],
              kz[k] + zboundr,
              racers[c].scx[k],
              racers[c].scy[k],
              racers[c].scz[k],
              2,
            );
            if (c == game.player) {
              scrapeSound(racers[c].scx[k], racers[c].scy[k], racers[c].scz[k]);
            }
          }
        }
        var bmac =
          Math.abs(mcos(racers[c].pxy)) + Math.abs(mcos(racers[c].pzy));
        bmac = bmac / 4;
        if (bmac > 0.3) {
          bmac = 0.3;
        }
        if (wastouch) {
          bmac = 0;
        }
        bmac += carStats.bounce[cn] - 0.2;
        if (bmac < 1.1) {
          bmac = 1.1;
        }
        regn(1, k, -Math.abs(racers[c].scz[k] * bmac), c);
        if (racers[c].scz[k] >= 0) {
          racers[c].scz[k] -= Math.abs(racers[c].scz[k] * bmac);
        }
        racers[c].skid = 2;
        spinlocate = true;
        racers[c].wall = limto;
      }
      if (kx[k] < limr + xboundr && kx[k] > limr + xboundr - 20) {
        for (var j = 0; j < 4; j++) {
          if (k != j) {
            if (kx[j] >= limr + xboundr) {
              kx[j] -= kx[k] - (limr + xboundr);
            }
          }
        }
        kx[k] = limr + xboundr;
        if (tick.fraction >= tick.scale && ky[k] < 20) {
          racers[c].crank[k]++;
          if (racers[c].crank[k] > 2) {
            sprks(
              cn,
              kx[k] - xboundr,
              ky[k],
              kz[k],
              racers[c].scx[k],
              racers[c].scy[k],
              racers[c].scz[k],
              2,
            );
            if (c == game.player) {
              scrapeSound(racers[c].scx[k], racers[c].scy[k], racers[c].scz[k]);
            }
          }
        }
        var bmac =
          Math.abs(mcos(racers[c].pxy)) + Math.abs(mcos(racers[c].pzy));
        bmac = bmac / 4;
        if (bmac > 0.3) {
          bmac = 0.3;
        }
        if (wastouch) {
          bmac = 0;
        }
        bmac += carStats.bounce[cn] - 0.2;
        if (bmac < 1.1) {
          bmac = 1.1;
        }
        regn(0, k, Math.abs(racers[c].scx[k] * bmac), c);
        if (racers[c].scx[k] <= 0) {
          racers[c].scx[k] += Math.abs(racers[c].scx[k] * bmac);
        }
        racers[c].skid = 2;
        spinlocate = true;
        racers[c].wall = limro;
      }
      if (kx[k] > liml - xboundr && kx[k] < liml - xboundr + 20) {
        for (var j = 0; j < 4; j++) {
          if (k != j) {
            if (kx[j] <= liml - xboundr) {
              kx[j] -= kx[k] - (liml - xboundr);
            }
          }
        }
        kx[k] = liml - xboundr;
        if (tick.fraction >= tick.scale && ky[k] < 20) {
          racers[c].crank[k]++;
          if (racers[c].crank[k] > 2) {
            sprks(
              cn,
              kx[k] + xboundr,
              ky[k],
              kz[k],
              racers[c].scx[k],
              racers[c].scy[k],
              racers[c].scz[k],
              2,
            );
            if (c == game.player) {
              scrapeSound(racers[c].scx[k], racers[c].scy[k], racers[c].scz[k]);
            }
          }
        }
        var bmac =
          Math.abs(mcos(racers[c].pxy)) + Math.abs(mcos(racers[c].pzy));
        bmac = bmac / 4;
        if (bmac > 0.3) {
          bmac = 0.3;
        }
        if (wastouch) {
          bmac = 0;
        }
        bmac += carStats.bounce[cn] - 0.2;
        if (bmac < 1.1) {
          bmac = 1.1;
        }
        regn(0, k, -Math.abs(racers[c].scx[k] * bmac), c);
        if (racers[c].scx[k] >= 0) {
          racers[c].scx[k] -= Math.abs(racers[c].scx[k] * bmac);
        }
        racers[c].skid = 2;
        spinlocate = true;
        racers[c].wall = limlo;
      }
    }
    if (tick.fraction >= tick.scale) {
      for (var i = 0; i < 4; i++) {
        // The original also had `if (crank[c][i] == lcrank[c][i]) crank[c][i][k] = 0;` here,
        // a write onto a number that never had any effect (and throws in strict mode).
        racers[c].lcrank[i] = racers[c].crank[i];
      }
    }
    var nzy = 0,
      nzyr = 0,
      nxy = 0,
      nxyr = 0;
    if (racers[c].scy[2] != racers[c].scy[0]) {
      if (racers[c].scy[2] < racers[c].scy[0]) {
        mlt = -1;
      } else {
        mlt = 1;
      }
      arch =
        Math.sqrt(
          (kz[0] - kz[2]) * (kz[0] - kz[2]) +
            (ky[0] - ky[2]) * (ky[0] - ky[2]) +
            (kx[0] - kx[2]) * (kx[0] - kx[2]),
        ) /
        (Math.abs(car[c].keyz[0]) + Math.abs(car[c].keyz[2]));
      if (arch >= 0.9998) {
        nzy = mlt;
      } else {
        nzy = (Math.acos(arch) / 0.017453292519943295) * mlt;
      }
    }
    if (racers[c].scy[3] != racers[c].scy[1]) {
      if (racers[c].scy[3] < racers[c].scy[1]) {
        mlt = -1;
      } else {
        mlt = 1;
      }
      arch =
        Math.sqrt(
          (kz[1] - kz[3]) * (kz[1] - kz[3]) +
            (ky[1] - ky[3]) * (ky[1] - ky[3]) +
            (kx[1] - kx[3]) * (kx[1] - kx[3]),
        ) /
        (Math.abs(car[c].keyz[1]) + Math.abs(car[c].keyz[3]));
      if (arch >= 0.9998) {
        nzyr = mlt;
      } else {
        nzyr = (Math.acos(arch) / 0.017453292519943295) * mlt;
      }
    }
    if (racers[c].scy[1] != racers[c].scy[0]) {
      if (racers[c].scy[1] < racers[c].scy[0]) {
        mlt = -1;
      } else {
        mlt = 1;
      }
      arch =
        Math.sqrt(
          (kz[0] - kz[1]) * (kz[0] - kz[1]) +
            (ky[0] - ky[1]) * (ky[0] - ky[1]) +
            (kx[0] - kx[1]) * (kx[0] - kx[1]),
        ) /
        (Math.abs(car[c].keyx[0]) + Math.abs(car[c].keyx[1]));
      if (arch >= 0.9998) {
        nxy = mlt;
      } else {
        nxy = (Math.acos(arch) / 0.017453292519943295) * mlt;
      }
    }
    if (racers[c].scy[3] != racers[c].scy[2]) {
      if (racers[c].scy[3] < racers[c].scy[2]) {
        mlt = -1;
      } else {
        mlt = 1;
      }
      arch =
        Math.sqrt(
          (kz[2] - kz[3]) * (kz[2] - kz[3]) +
            (ky[2] - ky[3]) * (ky[2] - ky[3]) +
            (kx[2] - kx[3]) * (kx[2] - kx[3]),
        ) /
        (Math.abs(car[c].keyx[2]) + Math.abs(car[c].keyx[3]));
      if (arch >= 0.9998) {
        nxyr = mlt;
      } else {
        nxyr = (Math.acos(arch) / 0.017453292519943295) * mlt;
      }
    }
    if (spinlocate) {
      var dxz = Math.abs(car[c].xz + 45);
      while (dxz > 180) {
        dxz -= 360;
      }
      if (Math.abs(dxz) > 90) {
        racers[c].pmlt = 1;
      } else {
        racers[c].pmlt = -1;
      }
      dxz = Math.abs(car[c].xz - 45);
      while (dxz > 180) {
        dxz -= 360;
      }
      if (Math.abs(dxz) > 90) {
        racers[c].nmlt = 1;
      } else {
        racers[c].nmlt = -1;
      }
    }
    car[c].xz +=
      racers[c].forca *
      10 *
      tick.scale *
      (racers[c].scz[0] * racers[c].nmlt -
        racers[c].scz[1] * racers[c].pmlt +
        racers[c].scz[2] * racers[c].pmlt -
        racers[c].scz[3] * racers[c].nmlt +
        racers[c].scx[0] * racers[c].pmlt +
        racers[c].scx[1] * racers[c].nmlt -
        racers[c].scx[2] * racers[c].nmlt -
        racers[c].scx[3] * racers[c].pmlt);
    if (Math.abs(nzyr) > Math.abs(nzy)) {
      nzy = nzyr;
    }
    if (Math.abs(nxyr) > Math.abs(nxy)) {
      nxy = nxyr;
    }
    if (!zyinv) {
      racers[c].pzy += nzy * tick.scale;
    } else {
      racers[c].pzy -= nzy * tick.scale;
    }
    if (!xyinv) {
      racers[c].pxy += nxy * tick.scale;
    } else {
      racers[c].pxy -= nxy * tick.scale;
    }
    if (ntr == 4) {
      var tat = 0;
      while (racers[c].pzy < 360) {
        racers[c].pzy += 360;
        car[c].zy += 360;
      }
      while (racers[c].pzy > 360) {
        racers[c].pzy -= 360;
        car[c].zy -= 360;
      }
      if (racers[c].pzy < 190 && racers[c].pzy > 170) {
        racers[c].pzy = 180;
        car[c].zy = 180;
        tat++;
      }
      if (racers[c].pzy > 350 || racers[c].pzy < 10) {
        racers[c].pzy = 0;
        car[c].zy = 0;
        tat++;
      }
      while (racers[c].pxy < 360) {
        racers[c].pxy += 360;
        car[c].xy += 360;
      }
      while (racers[c].pxy > 360) {
        racers[c].pxy -= 360;
        car[c].xy -= 360;
      }
      if (racers[c].pxy < 190 && racers[c].pxy > 170) {
        racers[c].pxy = 180;
        car[c].xy = 180;
        tat++;
      }
      if (racers[c].pxy > 350 || racers[c].pxy < 10) {
        racers[c].pxy = 0;
        car[c].xy = 0;
        tat++;
      }
      if (tat == 2) {
        racers[c].mtouch = true;
      }
    }
    if (tick.fraction >= tick.scale) {
      if (!racers[c].mtouch && racers[c].wtouch) {
        if (racers[c].cntouch == 10) {
          racers[c].mtouch = true;
        } else {
          racers[c].cntouch++;
        }
      } else {
        racers[c].cntouch = 0;
      }
    }
    car[c].y =
      (ky[0] + ky[1] + ky[2] + ky[3]) / 4 -
      keyy * mcos(racers[c].pzy) * mcos(racers[c].pxy) +
      ytrim * tick.scale;
    if (zyinv) {
      mlt = -1;
    } else {
      mlt = 1;
    }
    car[c].x =
      (kx[0] -
        car[c].keyx[0] * mcos(car[c].xz) +
        mlt * car[c].keyz[0] * msin(car[c].xz) +
        kx[1] -
        car[c].keyx[1] * mcos(car[c].xz) +
        mlt * car[c].keyz[1] * msin(car[c].xz) +
        kx[2] -
        car[c].keyx[2] * mcos(car[c].xz) +
        mlt * car[c].keyz[2] * msin(car[c].xz) +
        kx[3] -
        car[c].keyx[3] * mcos(car[c].xz) +
        mlt * car[c].keyz[3] * msin(car[c].xz)) /
        4 +
      keyy * msin(racers[c].pxy) * mcos(car[c].xz) -
      keyy * msin(racers[c].pzy) * msin(car[c].xz) +
      xtrim * tick.scale;
    car[c].z =
      (kz[0] -
        mlt * car[c].keyz[0] * mcos(car[c].xz) -
        car[c].keyx[0] * msin(car[c].xz) +
        kz[1] -
        mlt * car[c].keyz[1] * mcos(car[c].xz) -
        car[c].keyx[1] * msin(car[c].xz) +
        kz[2] -
        mlt * car[c].keyz[2] * mcos(car[c].xz) -
        car[c].keyx[2] * msin(car[c].xz) +
        kz[3] -
        mlt * car[c].keyz[3] * mcos(car[c].xz) -
        car[c].keyx[3] * msin(car[c].xz)) /
        4 +
      keyy * msin(racers[c].pxy) * msin(car[c].xz) -
      keyy * msin(racers[c].pzy) * mcos(car[c].xz) +
      ztrim * tick.scale;
    if (Math.abs(racers[c].speed) > 10 || !racers[c].mtouch) {
      if (Math.abs(racers[c].pxy - car[c].xy) >= 4 * tick.scale) {
        if (racers[c].pxy > car[c].xy) {
          car[c].xy += 2 * tick.scale + (racers[c].pxy - car[c].xy) / 2;
        } else {
          car[c].xy -= 2 * tick.scale + (car[c].xy - racers[c].pxy) / 2;
        }
      } else {
        car[c].xy = racers[c].pxy;
      }
      if (Math.abs(racers[c].pzy - car[c].zy) >= 4 * tick.scale) {
        if (racers[c].pzy > car[c].zy) {
          car[c].zy += 2 * tick.scale + (racers[c].pzy - car[c].zy) / 2;
        } else {
          car[c].zy -= 2 * tick.scale + (car[c].zy - racers[c].pzy) / 2;
        }
      } else {
        car[c].zy = racers[c].pzy;
      }
    }
    if (racers[c].wtouch && !racers[c].capsized) {
      var mtilt =
        (racers[c].speed / carStats.swits[cn][2]) *
        14 *
        (carStats.bounce[cn] - 0.4);
      if (racers[c].u.left && racers[c].tilt < mtilt && racers[c].tilt >= 0) {
        racers[c].tilt += 0.4 * tick.scale;
      } else {
        if (
          racers[c].u.right &&
          racers[c].tilt > -mtilt &&
          racers[c].tilt <= 0
        ) {
          racers[c].tilt -= 0.4 * tick.scale;
        } else {
          if (Math.abs(racers[c].tilt) > 3 * (carStats.bounce[cn] - 0.4)) {
            if (racers[c].tilt > 0) {
              racers[c].tilt -= 3 * (carStats.bounce[cn] - 0.3);
            } else {
              racers[c].tilt += 3 * (carStats.bounce[cn] - 0.3);
            }
          } else {
            racers[c].tilt = 0;
          }
        }
      }
      car[c].xy += racers[c].tilt;
      if (racers[c].gtouch) {
        car[c].y -= (Math.abs(racers[c].tilt) / 30) * tick.scale;
      }
    } else {
      if (racers[c].tilt != 0) {
        racers[c].tilt = 0;
      }
    }
    if (tick.fraction >= tick.scale) {
      if (racers[c].mtouch && tskd == 2) {
        car[c].zy +=
          ((random.sim() * 5 * racers[c].speed) / carStats.swits[cn][2] -
            (2.5 * racers[c].speed) / carStats.swits[cn][2]) *
          (carStats.bounce[cn] - 0.3);
        car[c].xy +=
          ((random.sim() * 5 * racers[c].speed) / carStats.swits[cn][2] -
            (2.5 * racers[c].speed) / carStats.swits[cn][2]) *
          (carStats.bounce[cn] - 0.3);
      }
      if (racers[c].wtouch && tskd == 1) {
        car[c].zy +=
          ((random.sim() * 3.34 * racers[c].speed) / carStats.swits[cn][2] -
            (1.67 * racers[c].speed) / carStats.swits[cn][2]) *
          (carStats.bounce[cn] - 0.3);
        car[c].xy +=
          ((random.sim() * 3.34 * racers[c].speed) / carStats.swits[cn][2] -
            (1.67 * racers[c].speed) / carStats.swits[cn][2]) *
          (carStats.bounce[cn] - 0.3);
      }
    }
    if (tick.fraction >= tick.scale) {
      if (racers[c].hitmag >= carStats.maxmag[cn]) {
        if (recording.repcar[c].destat == 700) {
          recording.repcar[c].destat = 430;
          if (racers[c].lastcolido != 0) {
            recording.repcar[c].destedbyzero = racers[c].lastcolido;
          }
        }
        if (racers[c].cntdest < 6) {
          if (racers[c].embos == 0) {
            carModels[car[c].typ].alpha = 1;
            racers[c].embodir = Math.floor(random.fx() * 3);
            if (racers[c].embodir == 3) {
              racers[c].embodir = 0;
            }
            racers[c].embomag = 1.2 + random.fx() * 0.2;
          }
          if (racers[c].embos == 1) {
            carModels[car[c].typ].alpha = 2;
          }
          racers[c].embos++;
          if (racers[c].embos == 2) {
            racers[c].embos = 0;
            racers[c].cntdest++;
          }
        } else {
          if (racers[c].cntdest == 6) {
            carModels[car[c].typ].alpha = 1;
            racers[c].embodir = 0;
            chipburn(c);
            racers[c].embos = 0;
            racers[c].cntdest = 7;
          }
          firexp(
            c,
            avnx,
            (racers[c].scy[0] +
              racers[c].scy[1] +
              racers[c].scy[2] +
              racers[c].scy[3]) /
              4,
            avnz,
          );
          if (racers[c].cntdest < 24) {
            racers[c].embos++;
            if (racers[c].embos == 5) {
              burn(c);
              racers[c].embos = 0;
              racers[c].cntdest++;
            }
          }
        }
        if (racers[c].cntdest == 4) {
          racers[c].dest = true;
        }
      }
    }
    var pnt = 0,
      pyclos = 0;
    var ic = 0;
    if (racers[c].nofocus) {
      cov = 1;
    } else {
      cov = 7;
    }
    for (var i = 0; i < track.n; i++) {
      if (track.typ[i] > 0) {
        ic++;
        if (track.typ[i] == 1) {
          if (racers[c].clear == ic + racers[c].nlaps * track.nsp) {
            cov = 1;
          }
          if (
            Math.abs(car[c].z - track.z[i]) <
              6 +
                Math.abs(
                  racers[c].scz[0] +
                    racers[c].scz[1] +
                    racers[c].scz[2] +
                    racers[c].scz[3],
                ) /
                  4 &&
            Math.abs(car[c].x - track.x[i]) < 70 &&
            Math.abs(car[c].y - track.y[i] - 15) < 45
          ) {
            if (racers[c].clear == ic + racers[c].nlaps * track.nsp - 1) {
              racers[c].clear = ic + racers[c].nlaps * track.nsp;
              racers[c].pcleared = i;
              racers[c].focus = -1;
            }
          }
        }
        if (track.typ[i] == 2) {
          if (racers[c].clear == ic + racers[c].nlaps * track.nsp) {
            cov = 1;
          }
          if (
            Math.abs(car[c].x - track.x[i]) <
              6 +
                Math.abs(
                  racers[c].scx[0] +
                    racers[c].scx[1] +
                    racers[c].scx[2] +
                    racers[c].scx[3],
                ) /
                  4 &&
            Math.abs(car[c].z - track.z[i]) < 70 &&
            Math.abs(car[c].y - track.y[i] - 15) < 45
          ) {
            if (racers[c].clear == ic + racers[c].nlaps * track.nsp - 1) {
              racers[c].clear = ic + racers[c].nlaps * track.nsp;
              racers[c].pcleared = i;
              racers[c].focus = -1;
            }
          }
        }
      }
      if (
        pyo(car[c].x / 10, track.x[i] / 10, car[c].z / 10, track.z[i] / 10) *
          cov <
          pyclos ||
        pyclos == 0
      ) {
        pnt = i;
        pyclos =
          pyo(car[c].x / 10, track.x[i] / 10, car[c].z / 10, track.z[i] / 10) *
          cov;
      }
    }
    if (racers[c].clear == ic + racers[c].nlaps * track.nsp) {
      racers[c].nlaps++;
    }
    if (c == game.player) {
      oncheckpoint = racers[c].clear;
      while (oncheckpoint >= track.nsp) {
        oncheckpoint -= track.nsp;
      }
      if (racers[c].clear == track.nlaps * track.nsp - 1) {
        onlastcheck = true;
      }
      if (track.haltall) {
        onlastcheck = false;
      }
    }
    if (racers[c].focus == -1) {
      if (c == game.player) {
        pnt += 2;
      } else {
        pnt++;
      }
      if (!racers[c].nofocus) {
        if (
          track.stage == 5 &&
          (racers[c].pcleared == 27 || racers[c].pcleared == 35) &&
          pnt < 29
        ) {
          pnt = 33;
        }
        ic = racers[c].pcleared + 1;
        if (ic >= track.n) {
          ic = 0;
        }
        while (track.typ[ic] <= 0) {
          ic++;
          if (ic >= track.n) {
            ic = 0;
          }
        }
        if (pnt > ic) {
          if (
            racers[c].clear != racers[c].nlaps * track.nsp ||
            pnt < racers[c].pcleared
          ) {
            if (track.stage != 9 || ic != 9 || pnt < 16) {
              pnt = ic;
              racers[c].focus = pnt;
            } else {
              pnt = 0;
            }
          }
        }
      }
      if (pnt >= track.n) {
        pnt -= track.n;
      }
      if (track.typ[pnt] == -3) {
        pnt = 0;
      }
      if (c == game.player) {
        if (racers[c].missedcp != -1) {
          racers[c].missedcp = -1;
        }
      } else {
        if (racers[c].missedcp != 0) {
          racers[c].missedcp = 0;
        }
      }
    } else {
      pnt = racers[c].focus;
      if (c == game.player) {
        if (
          racers[c].missedcp == 0 &&
          racers[c].mtouch &&
          Math.sqrt(
            pyo(
              car[c].x / 10,
              track.x[racers[c].focus] / 10,
              car[c].z / 10,
              track.z[racers[c].focus] / 10,
            ),
          ) > 80
        ) {
          racers[c].missedcp = 1;
        }
        if (
          racers[c].missedcp == -2 &&
          Math.sqrt(
            pyo(
              car[c].x / 10,
              track.x[racers[c].focus] / 10,
              car[c].z / 10,
              track.z[racers[c].focus] / 10,
            ),
          ) < 40
        ) {
          racers[c].missedcp = 0;
        }
        if (
          racers[c].missedcp != 0 &&
          racers[c].mtouch &&
          Math.sqrt(
            pyo(
              car[c].x / 10,
              track.x[racers[c].focus] / 10,
              car[c].z / 10,
              track.z[racers[c].focus] / 10,
            ),
          ) < 25
        ) {
          racers[c].missedcp = 68;
        }
      } else {
        racers[c].missedcp = 1;
      }
      if (racers[c].nofocus) {
        racers[c].focus = -1;
        racers[c].missedcp = 0;
      }
    }
    if (racers[c].nofocus) {
      racers[c].nofocus = false;
    }
    racers[c].point = pnt;
    if (game.mode != 1) {
      if (!car[c].fcnt) {
        for (var i = 0; i < pieces.fixCount; i++) {
          if (
            Math.abs(pieces.list[pieces.fixes[i]].mat[10]) >
            Math.abs(pieces.list[pieces.fixes[i]].mat[8])
          ) {
            if (
              Math.abs(car[c].z - pieces.list[pieces.fixes[i]].z) < 20 &&
              py(
                car[c].x,
                pieces.list[pieces.fixes[i]].x,
                car[c].y,
                pieces.list[pieces.fixes[i]].y,
              ) < 55
            ) {
              car[c].fcnt = 20;
              recording.repcar[c].fixat[recording.repcar[c].nfix] = 430;
              recording.repcar[c].nfix++;
              if (c == game.player) {
                playSound(29, 1);
              }
            }
          } else {
            if (
              Math.abs(car[c].x - pieces.list[pieces.fixes[i]].x) < 20 &&
              py(
                car[c].z,
                pieces.list[pieces.fixes[i]].z,
                car[c].y,
                pieces.list[pieces.fixes[i]].y,
              ) < 55
            ) {
              car[c].fcnt = 20;
              recording.repcar[c].fixat[recording.repcar[c].nfix] = 430;
              recording.repcar[c].nfix++;
              if (c == game.player) {
                playSound(29, 1);
              }
            }
          }
        }
      } else {
        onelec = true;
        carModels[car[c].typ].alpha = 1;
        if (car[c].fcnt % 2 == 0) {
          if (random.fx() > 0.333) {
            if (random.fx() > random.fx()) {
              carModels[car[c].typ].alpha = 3;
            } else {
              carModels[car[c].typ].alpha = 2;
            }
          }
        }
        if (tick.fraction >= tick.scale) {
          if (car[c].fcnt == 20) {
            racers[c].squash = 0;
            racers[c].nbsq = 0;
            racers[c].hitmag = 0;
            racers[c].cntdest = 0;
            racers[c].dest = false;
            if (c == game.player) {
              cntwis = 0;
            }
          }
          if (car[c].fcnt == 5) {
            fixcar(c);
          }
          car[c].fcnt--;
        }
      }
    }
    if (!racers[c].mtouch) {
      if (racers[c].trcnt != 1) {
        racers[c].trcnt = 1;
        racers[c].lxz = car[c].xz;
      }
      if (racers[c].loop == 2 || racers[c].loop == -1) {
        racers[c].travxy += (racers[c].rcomp - racers[c].lcomp) * tick.scale;
        if (Math.abs(racers[c].travxy) > 135) {
          racers[c].rtab = true;
        }
        racers[c].travzy += (racers[c].ucomp - racers[c].dcomp) * tick.scale;
        if (racers[c].travzy > 135) {
          racers[c].ftab = true;
        }
        if (racers[c].travzy < -135) {
          racers[c].btab = true;
        }
      }
      if (racers[c].lxz != car[c].xz) {
        racers[c].travxz += racers[c].lxz - car[c].xz;
        racers[c].lxz = car[c].xz;
      }
      if (tick.fraction >= tick.scale) {
        if (racers[c].srfcnt < 10) {
          if (racers[c].uwall) {
            racers[c].surfer = true;
          }
          racers[c].srfcnt++;
        }
      }
    } else {
      if (!racers[c].dest) {
        if (!racers[c].capsized) {
          if (racers[c].capcnt != 0) {
            racers[c].capcnt = 0;
          }
          if (racers[c].gtouch && tick.fraction >= tick.scale) {
            if (racers[c].trcnt != 0) {
              if (racers[c].trcnt == 9) {
                racers[c].powerup = 0;
                if (Math.abs(racers[c].travxy) > 90) {
                  racers[c].powerup += Math.abs(racers[c].travxy) / 24;
                } else {
                  if (racers[c].rtab) {
                    racers[c].powerup += 30;
                  }
                }
                if (Math.abs(racers[c].travzy) > 90) {
                  racers[c].powerup += Math.abs(racers[c].travzy) / 18;
                } else {
                  if (racers[c].ftab) {
                    racers[c].powerup += 40;
                  }
                  if (racers[c].btab) {
                    racers[c].powerup += 40;
                  }
                }
                if (Math.abs(racers[c].travxz) > 90) {
                  racers[c].powerup += Math.abs(racers[c].travxz) / 18;
                }
                if (racers[c].surfer) {
                  racers[c].powerup += 30;
                }
                racers[c].power += racers[c].powerup;
                if (
                  c == game.player &&
                  racers[c].powerup > recording.hpowerup &&
                  recording.htyp <= 1 &&
                  (racers[c].powerup > 60 ||
                    track.stage == 1 ||
                    track.stage == 2)
                ) {
                  recording.rpdcatch = 43;
                  recording.hpowerup = racers[c].powerup;
                }
                if (racers[c].power > 98) {
                  racers[c].power = 98;
                  if (racers[c].powerup > 150) {
                    racers[c].xtpower = 200;
                  } else {
                    racers[c].xtpower = 100;
                  }
                }
              }
              if (racers[c].trcnt == 10) {
                racers[c].travxy = 0;
                racers[c].travzy = 0;
                racers[c].travxz = 0;
                racers[c].ftab = false;
                racers[c].rtab = false;
                racers[c].btab = false;
                racers[c].trcnt = 0;
                racers[c].srfcnt = 0;
                racers[c].surfer = false;
              } else {
                racers[c].trcnt++;
              }
            }
          }
        } else {
          if (racers[c].trcnt != 0) {
            racers[c].travxy = 0;
            racers[c].travzy = 0;
            racers[c].travxz = 0;
            racers[c].ftab = false;
            racers[c].rtab = false;
            racers[c].btab = false;
            racers[c].trcnt = 0;
            racers[c].srfcnt = 0;
            racers[c].surfer = false;
          }
          var flmat = 7,
            capto = 30;
          if (c == game.player) {
            if (track.stage == 1 && game.unlocked == 1) {
              flmat = 30;
              capto = 10;
            }
            if (track.stage == 2 && game.unlocked == 2) {
              flmat = 30;
              capto = 10;
            }
            if (track.stage == 3 && game.unlocked == 3) {
              flmat = 25;
              capto = 15;
            }
            if (track.stage == 4 && game.unlocked == 4) {
              flmat = 20;
              capto = 20;
            }
            if (track.stage == 5 && game.unlocked == 5) {
              flmat = 14;
              capto = 25;
            }
          }
          if (racers[c].capcnt == 0) {
            var out = 0;
            for (var i = 0; i < 4; i++) {
              if (
                Math.abs(racers[c].scz[i]) < flmat &&
                Math.abs(racers[c].scx[i]) < flmat
              ) {
                out++;
              }
            }
            if (out == 4) {
              racers[c].capcnt = 1;
            }
          } else {
            if (tick.fraction >= tick.scale) {
              racers[c].capcnt++;
              if (racers[c].capcnt == capto) {
                racers[c].speed = 0;
                car[c].y += carStats.flipy[cn];
                racers[c].pxy += 180;
                car[c].xy += 180;
                racers[c].capcnt = 0;
              }
            }
          }
        }
        if (racers[c].trcnt == 0 && racers[c].speed != 0) {
          var pfact = 1;
          if (c == game.player) {
            if (track.stage == 1 && game.unlocked == 1) {
              pfact = 0.6;
            }
            if (track.stage == 2 && game.unlocked == 2) {
              pfact = 0.7;
            }
            if (track.stage == 3 && game.unlocked == 3) {
              pfact = 0.8;
            }
            if (track.stage == 4 && game.unlocked == 4) {
              pfact = 0.9;
            }
          }
          if (racers[c].xtpower == 0) {
            if (racers[c].power > 0) {
              racers[c].power -=
                (racers[c].power * racers[c].power * racers[c].power * pfact) /
                carStats.powerloss[cn];
            } else {
              racers[c].power = 0;
            }
          } else {
            racers[c].xtpower--;
          }
        }
      }
    }
    if (racers[c].uwall) {
      racers[c].uwall = false;
    }
    if (
      tick.fraction >= tick.scale &&
      racers[c].lastcolido != 0 &&
      !racers[c].dest
    ) {
      racers[c].lastcolido--;
    }
    if (racers[c].dest) {
      if (track.dested[c] == 0) {
        if (racers[c].lastcolido == 0) {
          track.dested[c] = 1;
        } else {
          track.dested[c] = 2;
        }
      }
    } else {
      if (track.dested[c] != 0 && track.dested[c] != 3) {
        track.dested[c] = 0;
      }
    }
    if (c == game.player && recording.rpdcatch != 0 && recording.htyp <= 1) {
      recording.rpdcatch--;
      if (recording.rpdcatch == 0) {
        catchnow(1);
        if (recording.htyp == 1) {
          recording.hat = 265 + random.fx() * 30;
        }
      }
    }
    var xmt = [1, 0, 0];
    var ymt = [0, 1, 0];
    var zmt = [0, 0, 1];
    rotomat(xmt, ymt, car[c].xy);
    rotomat(ymt, zmt, car[c].zy);
    rotomat(xmt, zmt, car[c].xz);
    car[c].mat[0] = xmt[0];
    car[c].mat[1] = ymt[0];
    car[c].mat[2] = zmt[0];
    car[c].mat[4] = xmt[1];
    car[c].mat[5] = ymt[1];
    car[c].mat[6] = zmt[1];
    car[c].mat[8] = xmt[2];
    car[c].mat[9] = ymt[2];
    car[c].mat[10] = zmt[2];
    if (racers[c].embodir) {
      car[c].mat[racers[c].embodir * 4] *= racers[c].embomag;
      car[c].mat[racers[c].embodir * 4 + 1] *= racers[c].embomag;
      car[c].mat[racers[c].embodir * 4 + 2] *= racers[c].embomag;
    }
  }
}
function colide(c, xc) {
  var kx = [],
    ky = [],
    kz = [];
  var xkx = [],
    xky = [],
    xkz = [];
  for (var i = 0; i < 4; i++) {
    kx[i] = car[c].x + car[c].keyx[i];
    if (racers[c].capsized) {
      ky[i] = car[c].y + carStats.flipy[car[c].typ] + racers[c].squash;
    } else {
      ky[i] = car[c].y + car[c].grat;
    }
    kz[i] = car[c].z + car[c].keyz[i];
    xkx[i] = car[xc].x + car[xc].keyx[i];
    if (racers[xc].capsized) {
      xky[i] = car[xc].y + carStats.flipy[car[xc].typ] + racers[xc].squash;
    } else {
      xky[i] = car[xc].y + car[xc].grat;
    }
    xkz[i] = car[xc].z + car[xc].keyz[i];
  }
  rotate(kx, ky, car[c].x, car[c].y, car[c].xy, 4);
  rotate(ky, kz, car[c].y, car[c].z, car[c].zy, 4);
  rotate(kx, kz, car[c].x, car[c].z, car[c].xz, 4);
  rotate(xkx, xky, car[xc].x, car[xc].y, car[xc].xy, 4);
  rotate(xky, xkz, car[xc].y, car[xc].z, car[xc].zy, 4);
  rotate(xkx, xkz, car[xc].x, car[xc].z, car[xc].xz, 4);
  if (
    rpy(car[c].x, car[xc].x, car[c].y, car[xc].y, car[c].z, car[xc].z) <
    (carModels[car[c].typ].colrad * carModels[car[c].typ].colrad +
      carModels[car[xc].typ].colrad * carModels[car[xc].typ].colrad) *
      1.5
  ) {
    if (
      !racers[c].caught[xc] &&
      (racers[c].speed != 0 || racers[xc].speed != 0)
    ) {
      if (
        Math.abs(
          racers[c].power * racers[c].speed * carStats.moment[car[c].typ],
        ) !=
        Math.abs(
          racers[xc].power * racers[xc].speed * carStats.moment[car[xc].typ],
        )
      ) {
        if (
          Math.abs(
            racers[c].power * racers[c].speed * carStats.moment[car[c].typ],
          ) >
          Math.abs(
            racers[xc].power * racers[xc].speed * carStats.moment[car[xc].typ],
          )
        ) {
          racers[c].dominate[xc] = true;
        } else {
          racers[c].dominate[xc] = false;
        }
      } else {
        if (carStats.moment[car[c].typ] > carStats.moment[car[xc].typ]) {
          racers[c].dominate[xc] = true;
        } else {
          racers[c].dominate[xc] = false;
        }
      }
      racers[c].caught[xc] = true;
    }
  } else {
    if (racers[c].caught[xc]) {
      racers[c].caught[xc] = false;
      racers[c].dominate[xc] = false;
    }
  }
  if (racers[c].dominate[xc]) {
    var crad =
      ((racers[c].scz[0] -
        racers[xc].scz[0] +
        racers[c].scz[1] -
        racers[xc].scz[1] +
        racers[c].scz[2] -
        racers[xc].scz[2] +
        racers[c].scz[3] -
        racers[xc].scz[3]) *
        (racers[c].scz[0] -
          racers[xc].scz[0] +
          racers[c].scz[1] -
          racers[xc].scz[1] +
          racers[c].scz[2] -
          racers[xc].scz[2] +
          racers[c].scz[3] -
          racers[xc].scz[3]) +
        (racers[c].scx[0] -
          racers[xc].scx[0] +
          racers[c].scx[1] -
          racers[xc].scx[1] +
          racers[c].scx[2] -
          racers[xc].scx[2] +
          racers[c].scx[3] -
          racers[xc].scx[3]) *
          (racers[c].scx[0] -
            racers[xc].scx[0] +
            racers[c].scx[1] -
            racers[xc].scx[1] +
            racers[c].scx[2] -
            racers[xc].scx[2] +
            racers[c].scx[3] -
            racers[xc].scx[3])) /
      16;
    var arad = 70;
    for (var i = 0; i < 4; i++) {
      var gotcol = false;
      for (var j = 0; j < 4; j++) {
        if (
          rpy(kx[i], xkx[j], ky[i], xky[j], kz[i], xkz[j]) <
          (crad + arad) *
            (carStats.comprad[car[xc].typ] + carStats.comprad[car[c].typ])
        ) {
          if (
            Math.abs(racers[c].scx[i] * carStats.moment[car[c].typ]) >
            Math.abs(racers[xc].scx[j] * carStats.moment[car[xc].typ])
          ) {
            var tm = racers[xc].scx[j] * carStats.revpush[car[c].typ];
            if (tm > 30) {
              tm = 30;
            }
            if (tm < -30) {
              tm = -30;
            }
            var vctm = racers[c].scx[i] * carStats.push[car[c].typ];
            if (vctm > 30) {
              vctm = 30;
            }
            if (vctm < -30) {
              vctm = -30;
            }
            racers[xc].scx[j] += vctm;
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(0, j, vctm * carStats.moment[car[c].typ], xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            racers[c].scx[i] -= tm;
            regn(0, i, -tm * carStats.moment[car[c].typ], c);
            racers[c].scy[i] += carStats.revlift[car[c].typ];
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(2, j, carStats.revlift[car[c].typ] * 7, xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            if (random.fx() > random.fx()) {
              sprks(
                car[c].typ,
                (kx[i] + xkx[j]) / 2,
                (ky[i] + xky[j]) / 2,
                (kz[i] + xkz[j]) / 2,
                (racers[xc].scx[j] + racers[c].scx[i]) / 4,
                (racers[xc].scy[j] + racers[c].scy[i]) / 4,
                (racers[xc].scz[j] + racers[c].scz[i]) / 4,
                2,
              );
            }
          }
          if (
            Math.abs(racers[c].scz[i] * carStats.moment[car[c].typ]) >
            Math.abs(racers[xc].scz[j] * carStats.moment[car[xc].typ])
          ) {
            var tm = racers[xc].scz[j] * carStats.revpush[car[c].typ];
            if (tm > 30) {
              tm = 30;
            }
            if (tm < -30) {
              tm = -30;
            }
            var vctm = racers[c].scz[i] * carStats.push[car[c].typ];
            if (vctm > 30) {
              vctm = 30;
            }
            if (vctm < -30) {
              vctm = -30;
            }
            racers[xc].scz[j] += vctm;
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(1, j, vctm * carStats.moment[car[c].typ], xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            racers[c].scz[i] -= tm;
            regn(1, i, -tm * carStats.moment[car[c].typ], c);
            racers[c].scy[i] += carStats.revlift[car[c].typ];
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(2, j, carStats.revlift[car[c].typ] * 7, xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            if (random.fx() > random.fx()) {
              sprks(
                car[c].typ,
                (kx[i] + xkx[j]) / 2,
                (ky[i] + xky[j]) / 2,
                (kz[i] + xkz[j]) / 2,
                (racers[xc].scx[j] + racers[c].scx[i]) / 4,
                (racers[xc].scy[j] + racers[c].scy[i]) / 4,
                (racers[xc].scz[j] + racers[c].scz[i]) / 4,
                2,
              );
            }
          }
          if (c == game.player) {
            racers[xc].lastcolido = 70;
          }
          if (xc == game.player) {
            racers[c].lastcolido = 70;
          }
          racers[xc].scy[j] += carStats.lift[car[c].typ];
          gotcol = true;
        }
      }
      if (!gotcol && racers[c].mtouch && racers[xc].mtouch) {
        var intrsct = false;
        var aro = Math.abs(
          (xkx[1] - xkx[0]) * (xkz[2] - xkz[0]) -
            (xkx[2] - xkx[0]) * (xkz[1] - xkz[0]),
        );
        var ar1 = Math.abs(
          (xkx[0] - kx[i]) * (xkz[1] - kz[i]) -
            (xkx[1] - kx[i]) * (xkz[0] - kz[i]),
        );
        var ar2 = Math.abs(
          (xkx[1] - kx[i]) * (xkz[2] - kz[i]) -
            (xkx[2] - kx[i]) * (xkz[1] - kz[i]),
        );
        var ar3 = Math.abs(
          (xkx[2] - kx[i]) * (xkz[0] - kz[i]) -
            (xkx[0] - kx[i]) * (xkz[2] - kz[i]),
        );
        if (ar1 + ar2 + ar3 < aro + 10) {
          intrsct = true;
        }
        if (!intrsct) {
          aro = Math.abs(
            (xkx[1] - xkx[3]) * (xkz[2] - xkz[3]) -
              (xkx[2] - xkx[3]) * (xkz[1] - xkz[3]),
          );
          ar1 = Math.abs(
            (xkx[3] - kx[i]) * (xkz[1] - kz[i]) -
              (xkx[1] - kx[i]) * (xkz[3] - kz[i]),
          );
          ar2 = Math.abs(
            (xkx[1] - kx[i]) * (xkz[2] - kz[i]) -
              (xkx[2] - kx[i]) * (xkz[1] - kz[i]),
          );
          ar3 = Math.abs(
            (xkx[2] - kx[i]) * (xkz[3] - kz[i]) -
              (xkx[3] - kx[i]) * (xkz[2] - kz[i]),
          );
          if (ar1 + ar2 + ar3 < aro + 10) {
            intrsct = true;
          }
        }
        if (intrsct) {
          var j = 0;
          var closj = rpy(kx[i], xkx[0], ky[i], xky[0], kz[i], xkz[0]);
          for (var k = 1; k < 4; k++) {
            pyclos = rpy(kx[i], xkx[k], ky[i], xky[k], kz[i], xkz[k]);
            if (pyclos < closj) {
              closj = pyclos;
              j = k;
            }
          }
          if (
            Math.abs(racers[c].scx[i] * carStats.moment[car[c].typ]) >
            Math.abs(racers[xc].scx[j] * carStats.moment[car[xc].typ])
          ) {
            var tm = racers[xc].scx[j] * carStats.revpush[car[c].typ];
            if (tm > 30) {
              tm = 30;
            }
            if (tm < -30) {
              tm = -30;
            }
            var vctm = racers[c].scx[i] * carStats.push[car[c].typ];
            if (vctm > 30) {
              vctm = 30;
            }
            if (vctm < -30) {
              vctm = -30;
            }
            racers[xc].scx[j] += vctm;
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(0, j, vctm * carStats.moment[car[c].typ], xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            racers[c].scx[i] -= tm;
            regn(0, i, -tm * carStats.moment[car[c].typ], c);
            racers[c].scy[i] += carStats.revlift[car[c].typ];
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(2, j, carStats.revlift[car[c].typ] * 7, xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            if (random.fx() > random.fx()) {
              sprks(
                car[c].typ,
                (kx[i] + xkx[j]) / 2,
                (ky[i] + xky[j]) / 2,
                (kz[i] + xkz[j]) / 2,
                (racers[xc].scx[j] + racers[c].scx[i]) / 4,
                (racers[xc].scy[j] + racers[c].scy[i]) / 4,
                (racers[xc].scz[j] + racers[c].scz[i]) / 4,
                2,
              );
            }
          }
          if (
            Math.abs(racers[c].scz[i] * carStats.moment[car[c].typ]) >
            Math.abs(racers[xc].scz[j] * carStats.moment[car[xc].typ])
          ) {
            var tm = racers[xc].scz[j] * carStats.revpush[car[c].typ];
            if (tm > 30) {
              tm = 30;
            }
            if (tm < -30) {
              tm = -30;
            }
            var vctm = racers[c].scz[i] * carStats.push[car[c].typ];
            if (vctm > 30) {
              vctm = 30;
            }
            if (vctm < -30) {
              vctm = -30;
            }
            racers[xc].scz[j] += vctm;
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(1, j, vctm * carStats.moment[car[c].typ], xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            racers[c].scz[i] -= tm;
            regn(1, i, -tm * carStats.moment[car[c].typ], c);
            racers[c].scy[i] += carStats.revlift[car[c].typ];
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(2, j, carStats.revlift[car[c].typ] * 7, xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            if (random.fx() > random.fx()) {
              sprks(
                car[c].typ,
                (kx[i] + xkx[j]) / 2,
                (ky[i] + xky[j]) / 2,
                (kz[i] + xkz[j]) / 2,
                (racers[xc].scx[j] + racers[c].scx[i]) / 4,
                (racers[xc].scy[j] + racers[c].scy[i]) / 4,
                (racers[xc].scz[j] + racers[c].scz[i]) / 4,
                2,
              );
            }
          }
          if (c == game.player) {
            racers[xc].lastcolido = 70;
          }
          if (xc == game.player) {
            racers[c].lastcolido = 70;
          }
          racers[xc].scy[j] += carStats.lift[car[c].typ];
        }
      }
    }
  }
}

function regn(nr, k, mag, c) {
  if (game.phase == PHASE.race) {
    mag *= carStats.dammult[car[c].typ];
  }
  if (Math.abs(mag) > 10) {
    if (game.phase == PHASE.race) {
      recording.repcar[c].regat[recording.repcar[c].nreg] = 430;
      recording.repcar[c].regnr[recording.repcar[c].nreg] = nr;
      recording.repcar[c].regk[recording.repcar[c].nreg] = k;
      recording.repcar[c].regmag[recording.repcar[c].nreg] = mag;
      recording.repcar[c].regmtch[recording.repcar[c].nreg] = racers[c].mtouch;
      recording.repcar[c].nreg++;
    }
    if (mag > 10) {
      mag -= 10;
    }
    if (mag < -10) {
      mag += 10;
    }
    var zsing = 0,
      xsing = 0;
    var nr2stop = false;
    if (nr == 2) {
      nr2stop = true;
      var rzy = car[c].zy,
        rxy = car[c].xy;
      while (rzy < 360) {
        rzy += 360;
      }
      while (rzy > 360) {
        rzy -= 360;
      }
      if (rzy < 210 && rzy > 150) {
        zsing = -1;
      }
      if (rzy > 330 || rzy < 30) {
        zsing = 1;
      }
      while (rxy < 360) {
        rxy += 360;
      }
      while (rxy > 360) {
        rxy -= 360;
      }
      if (rxy < 210 && rxy > 150) {
        xsing = -1;
      }
      if (rxy > 330 || rxy < 30) {
        xsing = 1;
      }
      if (xsing * zsing == 0 || racers[c].mtouch) {
        nr2stop = false;
      }
      if (xsing * zsing == -1) {
        if (racers[c].nbsq > 0) {
          nr2stop = false;
          nr = 3;
          racers[c].nbsq = 0;
        } else {
          racers[c].nbsq++;
        }
      }
      if (game.phase == PHASE.race && (c == game.player || racers[c].colidim)) {
        crashSound(mag, xsing * zsing);
      }
    } else {
      if (game.phase == PHASE.race && (c == game.player || racers[c].colidim)) {
        crashSound(mag, 0);
      }
    }
    var rad = carModels[car[c].typ];
    if (!nr2stop) {
      if (rad.iscar == 1) {
        rad.dvert = [];
        for (var i = 0; i < rad.ni; i++) {
          rad.dvert[i * 3] = -rad.vrt[rad.tri[i * 3] * 3];
          rad.dvert[i * 3 + 1] = rad.vrt[rad.tri[i * 3] * 3 + 1];
          rad.dvert[i * 3 + 2] = rad.vrt[rad.tri[i * 3] * 3 + 2];
        }
        rad.iscar = 2;
      }
      var pixelread = false;
      var framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        rad.texture[1],
        0,
      );
      var pixels = null;
      if (
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE
      ) {
        pixels = new Uint8Array(256 * 256 * 4);
        gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        pixelread = true;
      }
      var tsq = 0,
        nsq = 0;
      for (var i = 0; i < rad.ni; i++) {
        var tmag = 0;
        var modpix = 0;
        if (
          nr < 3 &&
          pyo(
            car[c].keyx[k],
            rad.dvert[i * 3],
            car[c].keyz[k],
            rad.dvert[i * 3 + 2],
          ) < carStats.clrad[car[c].typ]
        ) {
          tmag = (mag / 30) * random.sim();
          if (nr == 0) {
            rad.dvert[i * 3 + 2] -= tmag * msin(car[c].xz) * mcos(car[c].zy);
            rad.dvert[i * 3] += tmag * mcos(car[c].xz) * mcos(car[c].xy);
          }
          if (nr == 1) {
            rad.dvert[i * 3 + 2] += tmag * mcos(car[c].xz) * mcos(car[c].zy);
            rad.dvert[i * 3] += tmag * msin(car[c].xz) * mcos(car[c].xy);
          }
          if (nr == 2) {
            rad.dvert[i * 3 + 2] -= tmag * msin(car[c].zy);
            rad.dvert[i * 3] += tmag * msin(car[c].xy);
          }
          if (Math.abs(tmag) > 0.1) {
            if (random.fx() > 0.91) {
              if (game.phase != PHASE.replayRewind) {
                chipaway(
                  c,
                  rad.dvert[i * 3],
                  rad.dvert[i * 3 + 1],
                  rad.dvert[i * 3 + 2],
                  tmag,
                );
              }
            }
          }
          if (game.phase == PHASE.race) {
            racers[c].hitmag += Math.abs(tmag) * 0.667;
          }
          modpix = 1;
        }
        if (
          nr == 3 &&
          (Math.abs(
            rad.dvert[i * 3 + 1] -
              carStats.flipy[car[c].typ] -
              racers[c].squash,
          ) <
            carStats.msquash[c][car[c].typ] * 3 ||
            rad.dvert[i * 3 + 1] >
              carStats.flipy[car[c].typ] + racers[c].squash) &&
          Math.abs(racers[c].squash) < carStats.msquash[car[c].typ]
        ) {
          tmag = (mag / 15) * random.sim();
          rad.dvert[i * 3 + 1] -= tmag;
          tsq -= tmag;
          nsq++;
          if (Math.abs(tmag) > 0.1) {
            if (random.fx() > 0.91) {
              if (game.phase != PHASE.replayRewind) {
                chipaway(
                  c,
                  rad.dvert[i * 3],
                  rad.dvert[i * 3 + 1],
                  rad.dvert[i * 3 + 2],
                  tmag,
                );
              }
            }
          }
          if (game.phase == PHASE.race) {
            racers[c].hitmag += Math.abs(tmag) * 0.667;
          }
          modpix = 2;
        }
        if (pixelread && modpix) {
          var pxc = Math.round(rad.tex[rad.tri[i * 3 + 2] * 2] * 256);
          var pyc = Math.round((1 - rad.tex[rad.tri[i * 3 + 2] * 2 + 1]) * 256);
          var cmag =
            Math.abs(tmag) *
            11 *
            carStats.dammult[car[c].typ] *
            carStats.colrdammult[car[c].typ];
          var npt = Math.round(cmag + random.fx() * cmag);
          for (var p = 0; p < npt; p++) {
            var pxv = Math.round(6 * random.fx() - 3);
            var pyv = Math.round(6 * random.fx() - 3);
            if (pxv == 0 && pyv == 0) {
              var ein = 1;
              if (random.fx() > random.fx()) {
                ein = -1;
              }
              if (random.fx() > random.fx()) {
                pxv += ein;
              } else {
                pyv += ein;
              }
            }
            var px = pxc + pxv;
            var py = pyc + pyv;
            var rnp = Math.round(20 + random.fx() * 100);
            var glass = false;
            var ongrey = false;
            if (modpix == 2) {
              glass = true;
            }
            while (rnp > 0 || glass) {
              var pp = px * 4 + py * 256 * 4;
              if (
                pixels[pp] == pixels[pp + 1] &&
                pixels[pp + 1] == pixels[pp + 2]
              ) {
                pixels[pp] += Math.round(random.fx() * 10 - 5);
                if (pixels[pp] < 0) {
                  pixels[pp] = 0;
                }
                if (pixels[pp] > 192) {
                  pixels[pp] = 192;
                }
                pixels[pp + 1] = pixels[pp];
                pixels[pp + 2] = pixels[pp];
                if (!ongrey) {
                  ongrey = true;
                }
                if (glass) {
                  glass = false;
                  rnp = 0;
                }
              } else {
                if (
                  pixels[pp] == scene.glassColor[0] &&
                  pixels[pp + 1] == scene.glassColor[1] &&
                  pixels[pp + 2] == scene.glassColor[2]
                ) {
                  if (!glass) {
                    if (random.fx() > 0.95) {
                      glass = true;
                    }
                    rnp = 0;
                  }
                  if (modpix == 2) {
                    if (random.fx() < 0.5) {
                      glass = false;
                    }
                    rnp = 0;
                    modpix = 3;
                  }
                  if (glass) {
                    pixels[pp + 3] -= 150;
                    if (pixels[pp + 3] < 0) {
                      pixels[pp + 3] = 0;
                    }
                  }
                } else {
                  if (!glass && !ongrey) {
                    var av = (Math.abs(pxv) + Math.abs(pyv)) / 2 + 1;
                    if (av < 2) {
                      av = 2;
                    }
                    pixels[pp] = (65 + pixels[pp] * av) / (1 + av);
                    pixels[pp + 1] = (57 + pixels[pp + 1] * av) / (1 + av);
                    pixels[pp + 2] = (55 + pixels[pp + 2] * av) / (1 + av);
                    car[c].ctxl[0] = px / 256;
                    car[c].ctxl[1] = py / 256;
                    if (random.fx() > 0.8) {
                      if (Math.abs(pxv) < Math.abs(pyv)) {
                        pxv += Math.round(random.fx() * 2 - 1);
                      } else {
                        pyv += Math.round(random.fx() * 2 - 1);
                      }
                    }
                  } else {
                    glass = false;
                    rnp = 0;
                  }
                }
              }
              px += pxv;
              py += pyv;
              rnp--;
            }
          }
        }
      }
      if (nr == 3 && nsq > 0) {
        racers[c].squash += tsq / nsq;
      }
      if (pixelread) {
        gl.bindTexture(gl.TEXTURE_2D, rad.texture[1]);
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
      rad.loaded = 0;
      gl.deleteBuffer(rad.vbuf);
      rad.vbuf = null;
      rad.vbuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, rad.vbuf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(rad.dvert),
        gl.STATIC_DRAW,
      );
      rad.loaded = 2;
    }
  }
}
function burn(c) {
  var rad = carModels[car[c].typ];
  var framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    rad.texture[1],
    0,
  );
  var pixels = null;
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
    pixels = new Uint8Array(256 * 256 * 4);
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    for (var p = racers[c].bshft; p < 256 * 256 * 4; p += 12) {
      pixels[p] = 14 + pixels[p] * 0.6667;
      pixels[p + 1] = 4 + pixels[p + 1] * 0.6667;
      pixels[p + 2] = pixels[p + 2] * 0.6667;
    }
    gl.bindTexture(gl.TEXTURE_2D, rad.texture[1]);
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
  racers[c].bshft += 4;
  if (racers[c].bshft == 12) {
    racers[c].bshft = 0;
  }
}
function chipburn(c) {
  var rad = carModels[car[c].typ];
  for (var i = 0; i < rad.ni; i++) {
    if (random.fx() > random.fx() && random.fx() > random.fx()) {
      car[c].ctxl[0] = random.fx();
      car[c].ctxl[1] = random.fx();
      chipaway(
        c,
        rad.dvert[i * 3],
        rad.dvert[i * 3 + 1],
        rad.dvert[i * 3 + 2],
        0.1 + random.fx() * 0.2,
      );
    }
  }
}
function fixcar(c) {
  var rad = carModels[car[c].typ];
  rad.alpha = 1;
  rad.dvert = [];
  for (var i = 0; i < rad.ni; i++) {
    rad.dvert[i * 3] = -rad.vrt[rad.tri[i * 3] * 3];
    rad.dvert[i * 3 + 1] = rad.vrt[rad.tri[i * 3] * 3 + 1];
    rad.dvert[i * 3 + 2] = rad.vrt[rad.tri[i * 3] * 3 + 2];
  }
  rad.iscar = 2;
  rad.loaded = 0;
  gl.deleteBuffer(rad.vbuf);
  rad.vbuf = null;
  rad.vbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rad.vbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rad.dvert), gl.STATIC_DRAW);
  gl.deleteTexture(rad.texture[1]);
  rad.texture[1] = null;
  rad.texture[1] = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, rad.texture[1]);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    cartexture[car[c].typ],
  );
  gl.generateMipmap(gl.TEXTURE_2D);
  var framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    rad.texture[1],
    0,
  );
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
    var pixels = new Uint8Array(256 * 256 * 4);
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    for (var p = 0; p < 256 * 256 * 4; p += 4) {
      if (pixels[p] == 116 && pixels[p + 1] == 130 && pixels[p + 2] == 140) {
        pixels[p] = scene.glassColor[0];
        pixels[p + 1] = scene.glassColor[1];
        pixels[p + 2] = scene.glassColor[2];
        pixels[p + 3] = 210;
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, rad.texture[1]);
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
  rad.loaded = 2;
}
var mutedmusic = false;
var omutemusic = false;
var omutegame = false;
var cntspark = 0;
var gpat = 4;
var gotgamepad = false;
var gpress = [0, 0, 0, 0, 0, 0, 0, 0];
var gparr = false;
// The game logic runs in fixed ticks, independent of the display refresh rate (see tick.js).
var tickms = 35;
// Caps how much time is caught up after a stall, e.g. when the tab was in the background.
var maxcatchup = 250;
var ticktime = 0,
  lasttick = -1;

view.height;

function gameloop() {
  if (view.width != window.innerWidth || view.height != window.innerHeight) {
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    view.aspect = view.width / view.height;
    view.scaleX = view.width / 1280;
    view.scaleY = view.height / 720;
    view.scale = (view.scaleX + view.scaleY) / 2;
    view.widescreenShift = (view.width / view.height - 1.777) * 76;
    canvas3D.width = view.width;
    canvas3D.height = view.height;
    canvas3D.style.width = "" + view.width + "px";
    canvas3D.style.height = "" + view.height + "px";
    canvas2D.width = view.width;
    canvas2D.height = view.height;
    canvas2D.style.width = "" + view.width + "px";
    canvas2D.style.height = "" + view.height + "px";
    gl.viewport(0, 0, view.width, view.height);
  }
  if (gotgamepad) {
    var gp = navigator.getGamepads();
    for (var i = 0; i < gp.length; i++) {
      if (gpress[i] == null) {
        gpress[i] = 0;
      }
      if (gp[i] != null) {
        if (gp[i].connected) {
          var aleft = false,
            aright = false;
          if (Math.abs(gp[i].axes[0]) > 0.1) {
            if (gp[i].axes[0] < 0) {
              aleft = true;
            } else {
              aright = true;
            }
          }
          if (Math.abs(gp[i].axes[2]) > 0.1) {
            if (gp[i].axes[2] < 0) {
              aleft = true;
            } else {
              aright = true;
            }
          }
          var aup = false,
            adown = false;
          if (Math.abs(gp[i].axes[1]) > 0.1) {
            if (gp[i].axes[1] < 0) {
              aup = true;
            } else {
              adown = true;
            }
          }
          if (Math.abs(gp[i].axes[3]) > 0.1) {
            if (gp[i].axes[3] < 0) {
              aup = true;
            } else {
              adown = true;
            }
          }
          if (gp[i].buttons[0].pressed || aup) {
            racers[game.player].u.up = true;
            gpress[i] = 10;
          } else {
            if (gpress[i]) {
              racers[game.player].u.up = false;
            }
          }
          if (gp[i].buttons[2].pressed || adown) {
            racers[game.player].u.down = true;
            gpress[i] = 10;
          } else {
            if (gpress[i]) {
              racers[game.player].u.down = false;
            }
          }
          if (gp[i].buttons[3].pressed || aleft) {
            racers[game.player].u.left = true;
            gpress[i] = 10;
          } else {
            if (gpress[i]) {
              racers[game.player].u.left = false;
            }
          }
          if (gp[i].buttons[1].pressed || aright) {
            racers[game.player].u.right = true;
            gpress[i] = 10;
          } else {
            if (gpress[i]) {
              racers[game.player].u.right = false;
            }
          }
          if (gp[i].buttons.length > 7) {
            if (gp[i].buttons[4].pressed) {
              if (!gparr) {
                if (racers[game.player].u.arrace) {
                  racers[game.player].u.arrace = false;
                } else {
                  racers[game.player].u.arrace = true;
                }
                gparr = true;
              }
              gpress[i] = 10;
            } else {
              if (gpress[i]) {
                gparr = false;
              }
            }
            if (gp[i].buttons[5].pressed) {
              racers[game.player].u.handb = true;
              gpress[i] = 10;
            } else {
              if (gpress[i]) {
                racers[game.player].u.handb = false;
              }
            }
            if (gp[i].buttons[6].pressed) {
              camera.lookBack = -1;
              gpress[i] = 10;
            } else {
              if (gpress[i]) {
                if (camera.lookBack == -1) {
                  camera.lookBack = 0;
                }
              }
            }
            if (gp[i].buttons[7].pressed) {
              camera.lookBack = 1;
              gpress[i] = 10;
            } else {
              if (gpress[i]) {
                if (camera.lookBack == 1) {
                  camera.lookBack = 0;
                }
              }
            }
          }
          var penter = false;
          for (var k = 8; k < gp[i].buttons.length; k++) {
            if (gp[i].buttons[k].pressed) {
              penter = true;
            }
          }
          if (penter) {
            if (!enter) {
              enter = 1;
            }
            gpress[i] = 10;
          } else {
            if (gpress[i]) {
              if (enter) {
                enter = 0;
              }
            }
          }
          if (gpress[i]) {
            gpress[i]--;
          }
        }
      }
    }
  }
  if (game.phase == PHASE.loading) {
    loaddata();
  }
  if (game.phase == PHASE.mainMenu) {
    drawmain();
  }
  if (game.phase == PHASE.carSelect) {
    carselect();
  }
  if (game.phase == PHASE.stageLoading) {
    stageloading();
  }
  if (game.phase == PHASE.stageSelect) {
    stageselect();
  }
  if (game.phase == PHASE.instructions) {
    gameinstructions();
  }
  if (
    game.phase == PHASE.race ||
    game.phase == PHASE.replay ||
    game.phase == PHASE.replayRewind ||
    game.phase == PHASE.highlights ||
    game.phase == PHASE.switchScreen ||
    game.phase == PHASE.timeRewind
  ) {
    gameworks();
  }
  if (game.phase == PHASE.paused) {
    pausedgame();
  }
  if (game.phase == PHASE.raceEnd) {
    endgame();
    unlockedcar();
  }
  if (game.phase == PHASE.resetQuestion) {
    resetgame();
  }
  if (game.phase == PHASE.startFlash) {
    rd.fillStyle = "#FFFFFF";
    rd.fillRect(0, 0, view.width, view.height);
    cntspark--;
    if (cntspark == 0) {
      aftersparkstart();
    }
  }
  if (audio.muteMusic) {
    if (!mutedmusic) {
      pauseMusic();
      mutedmusic = true;
    }
  } else {
    if (mutedmusic) {
      resumeMusic();
      mutedmusic = false;
    }
  }
  if (tick.fraction >= tick.scale) {
    tick.fraction -= 1;
  }
  tick.fraction += tick.scale;
  interpolation.tick++;
}
function mainloop(now) {
  if (lasttick == -1) {
    lasttick = now - tickms;
  }
  ticktime += Math.min(now - lasttick, maxcatchup);
  lasttick = now;
  while (ticktime >= tickms) {
    gameloop();
    ticktime -= tickms;
  }
  interpolation.alpha = ticktime / tickms;
  render(now);
  requestAnimationFrame(mainloop);
}
// A click or touch allows audio (see unlockAudio).
function checknplay() {
  unlockAudio(game.phase == PHASE.race);
}
var flexr = 2;
var flexm = 0.2;
var revfase = 0,
  revat = 0,
  revto = 0,
  revup = 0,
  revdn = 0,
  revfr = 0,
  revout = 0;
var doublerev = 0;
var reqvol = 1;
var reqpbr = 1;
var ringr = 10;
function enginsnd() {
  if (engine.started) {
    var atmax = false;
    var pedl = false;
    if (
      (racers[game.player].u.up && racers[game.player].speed > 0) ||
      (racers[game.player].u.down && racers[game.player].speed < 0)
    ) {
      pedl = true;
    }
    if (racers[game.player].wtouch && !racers[game.player].capsized) {
      if (racers[game.player].mtouch) {
        var flexd =
          (racers[game.player].skid == 1 && racers[game.player].u.handb) ||
          Math.abs(
            racers[game.player].scz[0] -
              (racers[game.player].scz[1] +
                racers[game.player].scz[0] +
                racers[game.player].scz[2] +
                racers[game.player].scz[3]) /
                4,
          ) > 0.1 ||
          Math.abs(
            racers[game.player].scx[0] -
              (racers[game.player].scx[1] +
                racers[game.player].scx[0] +
                racers[game.player].scx[2] +
                racers[game.player].scx[3]) /
                4,
          ) > 0.1;
        if (!flexd) {
          if (pedl) {
            if (
              Math.abs(racers[game.player].speed) > 0 &&
              Math.abs(racers[game.player].speed) <=
                carStats.swits[game.carTypes[game.player]][0]
            ) {
              var amp =
                Math.abs(racers[game.player].speed) /
                carStats.swits[game.carTypes[game.player]][0];
              amp *= amp;
              reqvol = 1 + amp;
              reqpbr = 1 + amp;
            }
            if (
              Math.abs(racers[game.player].speed) >
                carStats.swits[game.carTypes[game.player]][0] &&
              Math.abs(racers[game.player].speed) <=
                carStats.swits[game.carTypes[game.player]][1]
            ) {
              var amp =
                (Math.abs(racers[game.player].speed) -
                  carStats.swits[game.carTypes[game.player]][0]) /
                (carStats.swits[game.carTypes[game.player]][1] -
                  carStats.swits[game.carTypes[game.player]][0]);
              amp *= amp;
              reqvol = 1 + amp;
              reqpbr = 1.2 + amp;
              if (reqpbr > 2.1) {
                reqpbr = 2.1;
              }
            }
            if (
              Math.abs(racers[game.player].speed) >
                carStats.swits[game.carTypes[game.player]][1] &&
              Math.abs(racers[game.player].speed) <=
                carStats.swits[game.carTypes[game.player]][2]
            ) {
              var amp =
                (Math.abs(racers[game.player].speed) -
                  carStats.swits[game.carTypes[game.player]][1]) /
                (carStats.swits[game.carTypes[game.player]][2] -
                  carStats.swits[game.carTypes[game.player]][1]);
              amp *= amp;
              reqvol = 1 + amp;
              reqpbr = 1.6 + amp;
              if (reqpbr > 2.2) {
                reqpbr = 2.2;
                atmax = true;
              }
            }
          } else {
            var amp =
              Math.abs(racers[game.player].speed) /
              carStats.swits[game.carTypes[game.player]][2];
            reqvol = 1 + amp * 0.5;
            reqpbr = 1 + amp;
          }
          if (flexr != 1 + 1.1 * carStats.engrev[game.carTypes[game.player]]) {
            flexr = 1 + 1.1 * carStats.engrev[game.carTypes[game.player]];
            flexm = 0.02 + 0.16 * random.fx();
          }
        } else {
          reqvol = flexr;
          if (reqvol > 2) {
            reqvol = 2;
          }
          reqpbr = flexr;
          flexr -= flexm;
          if (flexr < 1 + 0.5 * carStats.engrev[game.carTypes[game.player]]) {
            flexr = 1 + 1.1 * carStats.engrev[game.carTypes[game.player]];
            flexm = 0.02 + 0.16 * random.fx();
          }
        }
        if (revfase != 0) {
          if (revout == 0) {
            revfase = 0;
          } else {
            revout--;
          }
        }
      }
    } else {
      if (revfase == 0) {
        revout = 20;
        revat = reqpbr;
        revto = revat + 0.3 + 0.2 * random.fx();
        if (revto < 2) {
          revto = 2;
        }
        revup = 0.1 + 0.3 * random.fx();
        revdn = 0.1 + 0.2 * random.fx();
        revfr = Math.floor(5 + 5 * random.fx());
        revfase = 1;
        if (random.fx() > random.fx()) {
          doublerev = revto * (0.8 + 0.15 * random.fx());
        } else {
          doublerev = 0;
        }
      }
      if (revfase == 1) {
        revat += revup;
        reqvol = revat;
        if (reqvol > 2) {
          reqvol = 2;
        }
        reqpbr = revat;
        if (revat > revto) {
          revfase = 2;
        }
      }
      if (revfase == 2) {
        revfr--;
        if (revfr == 0) {
          revfase = 3;
        }
      }
      if (revfase == 3) {
        revat -= revdn;
        if (revat < doublerev) {
          revat = revto;
          doublerev = 0;
        }
        if (revat < 0.5) {
          revat = 0.5;
          revfase = 4;
        }
        reqvol = revat;
        if (reqvol > 2) {
          reqvol = 2;
        }
        reqpbr = revat;
        if (reqpbr < 1.4) {
          reqpbr = 1.4;
        }
      }
      if (revfase == 4 && racers[game.player].mtouch) {
        if (pedl) {
          reqpbr += 0.1;
        } else {
          reqpbr -= 0.2;
        }
        if (reqpbr > 2) {
          reqpbr = 2;
        }
        if (reqpbr < 1.4) {
          reqpbr = 1.4;
        }
        reqvol = (reqpbr - 1.4) * 2.5 + 0.5;
        if (reqvol > 2) {
          reqvol = 2;
        }
      }
    }
    if (holdcnt == 0) {
      engine.volume.gain.value +=
        ((reqvol - 1) * 0.75 + 1 - engine.volume.gain.value) / 10;
    } else {
      if (engine.volume.gain.value > 0.3) {
        engine.volume.gain.value -= 0.01;
      }
    }
    if (atmax) {
      if (ringr == 0) {
        reqpbr *= 1.06;
        ringr = Math.floor(random.fx() * 50);
      } else {
        ringr--;
      }
    }
    var abo = reqpbr - 1;
    if (abo < 0) {
      abo = 0;
    }
    engine.source.playbackRate.value =
      1 + abo * carStats.engrev[game.carTypes[game.player]];
  } else {
    if (!holdcnt) {
      startEngine(game.carTypes[game.player], true);
    }
  }
  coolDownCarSounds();
}
function fullscreen() {
  if (isPhone) {
    if (
      window.innerWidth != screen.width ||
      window.innerHeight != screen.height
    ) {
      if (document.body.requestFullScreen) {
        document.body.requestFullScreen();
      } else {
        if (document.body.webkitRequestFullScreen) {
          document.body.webkitRequestFullScreen();
        } else {
          if (document.body.mozRequestFullScreen) {
            document.body.mozRequestFullScreen();
          } else {
            if (document.body.msRequestFullscreen) {
              document.body.msRequestFullscreen();
            }
          }
        }
      }
    }
  }
}
function gotGamepads() {
  if (gpat) {
    gotgamepad = false;
    try {
      if (supportsGamepads()) {
        var gp = navigator.getGamepads();
        for (var i = 0; i < gp.length; i++) {
          if (gp[i] != null) {
            gotgamepad = true;
          }
        }
      }
    } catch (e) {}
    gpat--;
  }
}
function supportsGamepads() {
  return !!navigator.getGamepads;
}
var onhip = 0;
var noten = 0;
var playedforeplay = false;
function pausedgame() {
  stopEngine();
  rd.clearRect(0, 0, view.width, view.height);
  var r = Math.floor(128 - 128 * scene.tint[0]);
  if (r > 255) {
    r = 255;
  }
  if (r < 0) {
    r = 0;
  }
  var g = Math.floor(128 - 128 * scene.tint[1]);
  if (g > 255) {
    g = 255;
  }
  if (g < 0) {
    g = 0;
  }
  var b = Math.floor(128 - 128 * scene.tint[2]);
  if (b > 255) {
    b = 255;
  }
  if (b < 0) {
    b = 0;
  }
  var hsl = rgbToHsl(r, g, b);
  var rgb = hslToRgb(hsl[0], 0.3, 0.2);
  rd.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
  rd.globalAlpha = 0.7;
  rd.fillRect(0, 0, view.width, view.height);
  rgb = hslToRgb(hsl[0], 1, 0.5);
  rd.globalAlpha = 0.5;
  drawcoolrect(
    640 * view.scaleX,
    95 * view.scaleY,
    400,
    400,
    "#0093F0",
    "#00F088",
    "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
    1,
  );
  rd.globalAlpha = 1;
  if (onbreplay == 1) {
    rewindreplay();
  }
  var bton = [];
  bton[0] = ["#019DFF", "#01EAFF", "#004A78", "#016D77"];
  bton[1] = ["#01DEFF", "#49FFE3", "#016877", "#017765"];
  var on = 0;
  if (onhip == 0) {
    on = 1;
  }
  if (
    drawbutton(
      1,
      640 * view.scaleX,
      95 * view.scaleY + 35 * view.scale,
      350,
      60,
      bton[on][0],
      bton[on][1],
      bton[on][2],
      bton[on][3],
      0,
      "Resume Game ",
      20,
      0.8,
      btimg[1],
      0.8,
      on,
    )
  ) {
    noten = 0;
    if (!playedforeplay) {
      resumeStageMusic();
    } else {
      playedforeplay = false;
    }
    game.phase = PHASE.race;
  }
  on = 0;
  if (onhip == 1) {
    on = 1;
  }
  if (
    drawbutton(
      2,
      640 * view.scaleX,
      95 * view.scaleY + 125 * view.scale,
      350,
      60,
      bton[on][0],
      bton[on][1],
      bton[on][2],
      bton[on][3],
      1,
      "Instant Replay",
      20,
      0.8,
      null,
      0,
      on,
    )
  ) {
    if (recording.nrec >= 430) {
      onbreplay = 2;
      resumeStageMusic();
      playedforeplay = true;
      noten = 0;
    } else {
      noten = 30;
    }
  }
  on = 0;
  if (onhip == 2) {
    on = 1;
  }
  if (
    drawbutton(
      3,
      640 * view.scaleX,
      95 * view.scaleY + 215 * view.scale,
      380,
      60,
      bton[on][0],
      bton[on][1],
      bton[on][2],
      bton[on][3],
      1,
      "Game Instructions",
      20,
      0.8,
      null,
      0,
      on,
    )
  ) {
    noten = 0;
    if (playedforeplay) {
      stopStageMusic();
      playedforeplay = false;
    }
    instmain = false;
    ifase = 0;
    dudo = 250;
    game.phase = PHASE.instructions;
  }
  on = 0;
  if (onhip == 3) {
    on = 1;
  }
  if (
    drawbutton(
      4,
      640 * view.scaleX,
      95 * view.scaleY + 305 * view.scale,
      250,
      60,
      bton[on][0],
      bton[on][1],
      bton[on][2],
      bton[on][3],
      1,
      "x Quit Game",
      20,
      0.8,
      null,
      0,
      on,
    )
  ) {
    for (var c = 0; c < game.carCount; c++) {
      fixcar(c);
    }
    noten = 0;
    if (playedforeplay) {
      stopStageMusic();
      playedforeplay = false;
    }
    afterquitgame();
  }
  if (racers[game.player].u.up) {
    onhip--;
    if (onhip == -1) {
      onhip = 3;
    }
    racers[game.player].u.up = false;
  }
  if (racers[game.player].u.down) {
    onhip++;
    if (onhip == 4) {
      onhip = 0;
    }
    racers[game.player].u.down = false;
  }
  if (noten) {
    if (aflk) {
      rgb = hslToRgb(hsl[0], 1, 0.7);
      aflk = false;
    } else {
      rgb = hslToRgb(hsl[0], 1, 0.6);
      aflk = true;
    }
    drawcs(
      600,
      "Not enough gameplay was recorded yet!",
      rgb[0],
      rgb[1],
      rgb[2],
      0,
    );
    noten--;
  }
  if (onbreplay) {
    rd.globalAlpha = 0.6;
    rd.fillStyle = "#000000";
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
    onbreplay--;
  }
  if (enter == 1) {
    if (onhip == 0) {
      if (!playedforeplay) {
        resumeStageMusic();
      } else {
        playedforeplay = false;
      }
      game.phase = PHASE.race;
      noten = 0;
    }
    if (onhip == 1) {
      if (recording.nrec >= 430) {
        onbreplay = 2;
        resumeStageMusic();
        playedforeplay = true;
        noten = 0;
      } else {
        noten = 30;
      }
    }
    if (onhip == 2) {
      noten = 0;
      if (playedforeplay) {
        stopStageMusic();
        playedforeplay = false;
      }
      instmain = false;
      ifase = 0;
      dudo = 250;
      game.phase = PHASE.instructions;
    }
    if (onhip == 3) {
      for (var c = 0; c < game.carCount; c++) {
        fixcar(c);
      }
      noten = 0;
      if (playedforeplay) {
        stopStageMusic();
        playedforeplay = false;
      }
      afterquitgame();
    }
    enter = 2;
  }
  if (!flwg) {
    flw -= 0.03;
    if (flw < 0.5) {
      flw = 0.5;
      flwg = true;
    }
  } else {
    flw += 0.03;
    if (flw > 2) {
      flw = 2;
      flwg = false;
    }
  }
  if (!flhg) {
    flh -= 0.5;
    if (flh < 0.1) {
      flh = 0.1;
      flhg = true;
    }
  } else {
    flh += 0.5;
    if (flh > 2) {
      flh = 2;
      flhg = false;
    }
  }
}
function afterquitgame() {
  if (stanza == 1) {
    reqload = 0;
    dataload = 500;
    datacnt = 2458;
    stanza = 2;
    onskip = false;
    game.phase = PHASE.loading;
  } else {
    fredo = 0;
    onskip = false;
    game.phase = PHASE.mainMenu;
  }
}
var fredo = 0;
var onskip = true;
var canreset = false;
var cnf = 0;
var cnl = 0;
var relit = "RE-LIT";
function drawmain() {
  rd.fillStyle = "#000000";
  rd.fillRect(0, 0, view.width, view.height);
  if (fredo == 0) {
    playMenuMusic();
    cnf = 0;
  }
  var lefy = (view.width - 1280 * view.scaleY) / 2;
  var rigy = lefy + 1280 * view.scaleY;
  rd.drawImage(mainbg, lefy, 0, 1280 * view.scaleY, view.height);
  var ixs = lefy + 270 * view.scaleY,
    iys = 39 * view.scaleY;
  var rxs = lefy + 520 * view.scaleY,
    rys = 43 * view.scaleY;
  var fm = view.scaleY;
  var mrg = 1;
  if (lefy < 0) {
    lefy = 0;
    rigy = view.width;
    fm = view.scale;
    mrg = 1 - 0.9752 * ((1 - view.scaleX / view.scaleY) / 0.4375);
  }
  var ixe = lefy + 40 * fm,
    iye = 186 * fm;
  var rxe = rigy - 520 * fm,
    rye = 102 * fm;
  var ixf = (ixs * (25 - cnf) + ixe * cnf) / 25;
  var iyf = (iys * (25 - cnf) + iye * cnf) / 25;
  var rxf = (rxs * (25 - cnf) + rxe * cnf) / 25;
  var ryf = (rys * (25 - cnf) + rye * cnf) / 25;
  if (cnf != 0) {
    rd.globalAlpha = 0.2 + (cnf / 25) * 0.8;
    rd.drawImage(insano[0], ixf, iyf, 274 * view.scaleY, 341 * view.scaleY);
    rd.drawImage(rider, rxf, ryf, 386 * view.scaleY, 191 * view.scaleY);
    rd.globalAlpha = 1;
  }
  if (cnf == 25) {
    rd.drawImage(
      logo,
      lefy + 282 * fm * mrg,
      view.height - 464 * fm,
      905 * fm,
      258 * fm,
    );
    rd.letterSpacing = "1px";
    rd.font = "" + 24 * (view.scaleY + view.scaleX) + "px junk";
    rd.textAlign = "left";
    rd.textBaseline = "middle";
    var grd = rd.createLinearGradient(
      lefy + 282 * fm * mrg + 760 * fm,
      view.height - 464 * fm + 150 * fm,
      lefy + 282 * fm * mrg + 760 * fm + rd.measureText(relit).width,
      view.height - 464 * fm + 150 * fm,
    );
    grd.addColorStop(0, "#FF5B01");
    grd.addColorStop(1, "#FF9601");
    rd.fillStyle = grd;
    rd.fillText(
      relit,
      lefy + 282 * fm * mrg + 760 * fm,
      view.height - 464 * fm + 150 * fm,
    );
    if (cnl == 0) {
      if (relit == "RE-LI T") {
        relit = "RE-LIT";
      }
      if (relit == "RE-LIt") {
        relit = "RE-LI T";
      }
      if (relit == "RE-Lit") {
        relit = "RE-LIt";
      }
      if (relit == "RE-lit") {
        relit = "RE-Lit";
      }
      if (relit == "Re-lit") {
        relit = "RE-lit";
      }
      if (relit == "re-lit") {
        relit = "Re-lit";
      }
      if (relit == "re-liT") {
        relit = "re-lit";
      }
      if (relit == "re-lIT") {
        relit = "re-liT";
      }
      if (relit == "re-LIT") {
        relit = "re-lIT";
      }
      if (relit == "rE-LIT") {
        relit = "re-LIT";
      }
      if (relit == "RE-LIT") {
        relit = "rE-LIT";
      }
      cnl = 1;
    } else {
      cnl--;
    }
  }
  if (!onskip) {
    if (
      drawbutton(
        1,
        rigy - 230 * view.scale,
        720 * view.scaleY - 200 * view.scale,
        360,
        60,
        "#FF1301",
        "#FF8A01",
        "#780800",
        "#784100",
        1,
        "Game Instructions",
        19,
        0.9,
        null,
        0,
        false,
      )
    ) {
      pauseMenuMusic();
      instmain = true;
      ifase = 0;
      dudo = 250;
      game.phase = PHASE.instructions;
    }
    if (
      drawbutton(
        3,
        rigy - 150 * view.scale,
        720 * view.scaleY - 100 * view.scale,
        200,
        70,
        "#FF3D01",
        "#FFB401",
        "#771D01",
        "#775401",
        0,
        "PLAY ",
        25,
        0.9,
        btimg[1],
        0.9,
        true,
      )
    ) {
      fredo = 29;
      cnf = 25;
    }
    if (fredo < 29) {
      if (enter == 1) {
        fredo = 29;
        enter = 2;
      }
    }
    if (canreset) {
      if (
        drawbutton(
          7,
          rigy - 450 * view.scale,
          720 * view.scaleY - 90 * view.scale,
          280,
          60,
          "#FF1301",
          "#FF8A01",
          "#780800",
          "#784100",
          1,
          "Reset Game",
          22,
          0.9,
          null,
          0,
          0,
          false,
        )
      ) {
        dudo = 250;
        game.phase = PHASE.resetQuestion;
      }
    }
    musictog();
  }
  if (!onskip) {
    if (fredo != 15) {
      fredo++;
    } else {
      if (cnf != 25) {
        cnf++;
      }
    }
  } else {
    if (cnf != 25) {
      cnf++;
      fredo = 1;
    } else {
      fredo++;
    }
  }
  if (fredo >= 30) {
    rd.globalAlpha = (fredo - 50) / 10;
    rd.fillStyle = "#000000";
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
    if (fredo == 40) {
      gotGamepads();
      game.player = 0;
      racers[game.player].u.left = false;
      racers[game.player].u.right = false;
      racers[game.player].u.up = false;
      racers[game.player].u.down = false;
      racers[game.player].u.handb = false;
      flyout = 1;
      carms = 0;
      carmy = 100;
      scene.tint = [0, -0.05, 0.6];
      var fogc = [0, 0, 0];
      var lvx = 0,
        lvy = 0.866,
        lvz = -0.5;
      var fogdist = 10700;
      setWorld(scene.tint, fogc, lvx, lvy, lvz, fogdist);
      game.phase = PHASE.carSelect;
    }
  }
  if (!flwg) {
    flw -= 0.03;
    if (flw < 0.5) {
      flw = 0.5;
      flwg = true;
    }
  } else {
    flw += 0.03;
    if (flw > 2) {
      flw = 2;
      flwg = false;
    }
  }
  if (!flhg) {
    flh -= 0.5;
    if (flh < 0.1) {
      flh = 0.1;
      flhg = true;
    }
  } else {
    flh += 0.5;
    if (flh > 2) {
      flh = 2;
      flhg = false;
    }
  }
}
var instmain = false;
var ifase = 0;
var ondud = 0;
var dudo = 0;
function gameinstructions() {
  rd.fillStyle = "#000000";
  rd.fillRect(0, 0, view.width, view.height);
  if (instmain) {
    var lefy = (view.width - 1280 * view.scaleY) / 2;
    rd.drawImage(mainbg, lefy, 0, 1280 * view.scaleY, view.height);
  } else {
    rd.clearRect(0, 0, view.width, view.height);
    var r = Math.floor(128 - 128 * scene.tint[0]);
    if (r > 255) {
      r = 255;
    }
    if (r < 0) {
      r = 0;
    }
    var g = Math.floor(128 - 128 * scene.tint[1]);
    if (g > 255) {
      g = 255;
    }
    if (g < 0) {
      g = 0;
    }
    var b = Math.floor(128 - 128 * scene.tint[2]);
    if (b > 255) {
      b = 255;
    }
    if (b < 0) {
      b = 0;
    }
    var hsl = rgbToHsl(r, g, b);
    var rgb = hslToRgb(hsl[0], 0.3, 0.2);
    rd.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
    rd.globalAlpha = 0.7;
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
  }
  var fm = view.scaleX;
  if (view.scaleX / view.scaleY > 1.2) {
    fm *= 1.2 / (view.scaleX / view.scaleY);
  }
  if (aflk) {
    aflk = false;
  } else {
    aflk = true;
  }
  if (dudo > 0) {
    if (aflk) {
      ondud = Math.floor(random.fx() * 6);
      if (ondud == 6) {
        ondud = 5;
      }
    }
    dudo--;
  } else {
    ondud = 2;
  }
  rd.drawImage(
    insano[ondud],
    10 * fm,
    260 * view.scaleY,
    274 * fm * 0.7,
    341 * fm * 0.7,
  );
  var topo = 260 * view.scaleY - 200 * fm;
  rd.fillStyle = "#FFFFFF";
  rd.globalAlpha = 0.7;
  floatytalk(200 * fm, topo, 1060 * fm, 570 * fm, 20 * fm);
  rd.globalAlpha = 1;
  if (ifase == 0) {
    rd.letterSpacing = "1px";
    rd.font = "" + 30 * fm + "px junk";
    rd.textBaseline = "middle";
    rd.textAlign = "left";
    rd.fillStyle = "#002748";
    rd.fillText(
      "Welcome to  Need for Madness !",
      200 * fm + 20 * fm,
      topo + 30 * fm,
    );
    rd.letterSpacing = "0px";
    rd.font = "" + 30 * fm + "px verd";
    rd.fillText(
      "In this game there are two ways to complete a stage.",
      200 * fm + 20 * fm,
      topo + 76 * fm,
    );
    rd.fillText(
      "One is by racing and finishing in first place, the other is by",
      200 * fm + 20 * fm,
      topo + 116 * fm,
    );
    rd.fillText(
      "wasting and crashing all the other cars in the stage!",
      200 * fm + 20 * fm,
      topo + 156 * fm,
    );
    rd.letterSpacing = "1px";
    rd.font = "" + 40 * fm + "px junk";
    rd.fillText("Racing", 200 * fm + 80 * fm, topo + 220 * fm);
    rd.fillText("Wasting", 200 * fm + 130 * fm + 485 * fm, topo + 220 * fm);
    rd.font = "" + 35 * fm + "px junk";
    rd.fillText("OR", 200 * fm + 511 * fm, topo + 340 * fm);
    rd.drawImage(
      inst[0],
      200 * fm + 20 * fm,
      topo + 190 * fm,
      485 * fm,
      265 * fm,
    );
    rd.drawImage(
      inst[1],
      200 * fm + 70 * fm + 485 * fm,
      topo + 249 * fm,
      485 * fm,
      206 * fm,
    );
  }
  if (ifase == 1) {
    rd.letterSpacing = "0px";
    rd.font = "" + 30 * fm + "px verd";
    rd.textBaseline = "middle";
    rd.textAlign = "left";
    rd.fillStyle = "#002748";
    rd.fillText(
      "Whether you are racing or wasting, you will need to",
      200 * fm + 20 * fm,
      topo + 56 * fm,
    );
    rd.fillText("power up your car.", 200 * fm + 20 * fm, topo + 96 * fm);
    rd.fillText(
      "The more powered your car is, the stronger and faster",
      200 * fm + 20 * fm,
      topo + 136 * fm,
    );
    rd.fillText(
      "it becomes! Which is helpful when racing or wasting.",
      200 * fm + 20 * fm,
      topo + 176 * fm,
    );
    rd.fillText(
      "To power up your car (and keep it powered up) you will need to",
      200 * fm + 20 * fm,
      topo + 256 * fm,
    );
    rd.fillText("perform stunts!", 200 * fm + 20 * fm, topo + 296 * fm);
    rd.font = "" + 50 * fm + "px verd";
    rd.fillText("=", 770 * fm, topo + 310 * fm + 55 * view.scale);
    rd.drawImage(
      inst[4],
      200 * fm + 90 * fm,
      topo + 300 * fm,
      464 * fm,
      150 * fm,
    );
    rd.letterSpacing = "1px";
    rd.font = "" + 11 * (view.scaleY + view.scaleX) + "px junk";
    rd.textAlign = "right";
    rd.fillStyle = "#000000";
    rd.fillText(
      "Power",
      945 * fm - 15 * view.scale,
      topo + 310 * fm + 55 * view.scale,
    );
    var r = 128;
    var g = 190 + 70 * 0.37;
    var b = 255;
    drawbar(
      945 * fm,
      topo + 310 * fm + 42 * view.scale,
      "#00B0DC",
      "#005C96",
      "rgb(" + r + "," + g + "," + b + ")",
      70 / 98,
    );
  }
  if (ifase == 2) {
    rd.letterSpacing = "0px";
    rd.font = "" + 30 * fm + "px verd";
    rd.textBaseline = "middle";
    rd.textAlign = "left";
    rd.fillStyle = "#002748";
    rd.fillText(
      "When wasting cars, to help you find the other cars in the stage,",
      200 * fm + 20 * fm,
      topo + 36 * fm,
    );
    rd.fillText(
      "press the 'Arrow Target' button to toggle the guidance arrow",
      200 * fm + 20 * fm,
      topo + 76 * fm,
    );
    rd.fillText(
      "from pointing to the track to pointing to the cars.",
      200 * fm + 20 * fm,
      topo + 116 * fm,
    );
    rd.fillText(
      "When your car is damaged, you can fix it (and reset its 'Damage')",
      200 * fm + 20 * fm,
      topo + 156 * fm,
    );
    rd.fillText(
      "by jumping through the electrified hoop.",
      200 * fm + 20 * fm,
      topo + 196 * fm,
    );
    rd.drawImage(
      inst[2],
      200 * fm + 150 * fm,
      topo + 233 * fm,
      402 * fm,
      231 * fm,
    );
    rd.drawImage(
      inst[3],
      200 * fm + 600 * fm,
      topo + 180 * fm,
      376 * fm,
      284 * fm,
    );
  }
  if (ifase == 3) {
    rd.letterSpacing = "0px";
    rd.font = "" + 30 * fm + "px verd";
    rd.textBaseline = "middle";
    rd.textAlign = "left";
    rd.fillStyle = "#002748";
    if (!isPhone) {
      rd.fillText(
        "Drive your car using the keyboard arrows and also use the",
        200 * fm + 20 * fm,
        topo + 36 * fm,
      );
      rd.fillText(
        "keyboard arrows when your car is in the air to perform stunts.",
        200 * fm + 20 * fm,
        topo + 76 * fm,
      );
      rd.fillText(
        "Press Spacebar for Handbrakes to drift while turning and make",
        200 * fm + 20 * fm,
        topo + 116 * fm,
      );
      rd.fillText("quick 180 turns.", 200 * fm + 20 * fm, topo + 156 * fm);
      rd.drawImage(
        inst[6],
        200 * fm + 200 * fm,
        topo + 220 * fm,
        345 * fm,
        77 * fm,
      );
      rd.drawImage(
        inst[5],
        200 * fm + 670 * fm,
        topo + 170 * fm,
        220 * fm,
        155 * fm,
      );
      rd.drawImage(
        inst[7],
        200 * fm + 50 * fm,
        topo + 380 * fm,
        95 * fm,
        65 * fm,
      );
      rd.fillText(
        "(Gamepad & Joystick control is also possible.)",
        200 * fm + 167 * fm,
        topo + 420 * fm,
      );
    } else {
      rd.fillText(
        "Drive your car using the arrow buttons on the screen.",
        200 * fm + 20 * fm,
        topo + 36 * fm,
      );
      rd.fillText(
        "Also use them when your car is in the air to perform stunts.",
        200 * fm + 20 * fm,
        topo + 76 * fm,
      );
      rd.drawImage(
        contimg[0],
        200 * fm + 150 * fm,
        topo + 110 * fm,
        128 * fm,
        128 * fm,
      );
      rd.drawImage(
        contimg[1],
        200 * fm + 300 * fm,
        topo + 110 * fm,
        128 * fm,
        128 * fm,
      );
      rd.drawImage(
        contimg[3],
        200 * fm + 550 * fm,
        topo + 110 * fm,
        128 * fm,
        128 * fm,
      );
      rd.drawImage(
        contimg[2],
        200 * fm + 700 * fm,
        topo + 110 * fm,
        128 * fm,
        128 * fm,
      );
      rd.fillText(
        "Press the Handbrake button while turning to drift and make",
        200 * fm + 20 * fm,
        topo + 290 * fm,
      );
      rd.fillText("quick 180 turns.", 200 * fm + 20 * fm, topo + 330 * fm);
      rd.drawImage(
        contimg[4],
        200 * fm + 330 * fm,
        topo + 330 * fm,
        154 * fm,
        111 * fm,
      );
    }
  }
  if (ifase == 4) {
    rd.letterSpacing = "0px";
    rd.font = "" + 30 * fm + "px verd";
    rd.textBaseline = "middle";
    rd.textAlign = "left";
    rd.fillStyle = "#002748";
    rd.fillText(
      "And finally my name is Coach Insano, and I am here to help you",
      200 * fm + 20 * fm,
      topo + 36 * fm,
    );
    rd.fillText(
      "and guide you to become the greatest Need for Madness driver",
      200 * fm + 20 * fm,
      topo + 76 * fm,
    );
    rd.fillText("you can be!", 200 * fm + 20 * fm, topo + 116 * fm);
    rd.fillText(
      "I will also offer you hints and tips on the ideal strategy to",
      200 * fm + 20 * fm,
      topo + 156 * fm,
    );
    rd.fillText(
      "complete each stage. Good luck!",
      200 * fm + 20 * fm,
      topo + 196 * fm,
    );
    if (!isPhone) {
      if (
        drawbutton(
          1,
          240 * fm + 285 * view.scale,
          topo + 250 * fm,
          570,
          60,
          "#0075D8",
          "#299DFF",
          "#003F74",
          "#006AC4",
          1,
          "Additional Keyboard Controls",
          18,
          0.9,
          null,
          0,
          false,
        )
      ) {
        dudo = 250;
        ifase++;
      }
      if (
        drawbutton(
          2,
          240 * fm + 140 * view.scale,
          topo + 350 * fm,
          280,
          60,
          "#0075D8",
          "#299DFF",
          "#003F74",
          "#006AC4",
          1,
          "Music Credits",
          18,
          0.9,
          null,
          0,
          false,
        )
      ) {
        dudo = 250;
        ifase += 2;
      }
    } else {
      if (
        drawbutton(
          2,
          240 * fm + 140 * view.scale,
          topo + 300 * fm,
          280,
          60,
          "#0075D8",
          "#299DFF",
          "#003F74",
          "#006AC4",
          1,
          "Music Credits",
          18,
          0.9,
          null,
          0,
          false,
        )
      ) {
        dudo = 250;
        ifase += 2;
      }
    }
  }
  if (ifase == 5) {
    rd.letterSpacing = "0px";
    rd.font = "" + 30 * fm + "px verd";
    rd.textBaseline = "middle";
    rd.textAlign = "left";
    rd.fillStyle = "#002748";
    rd.fillText(
      "Additional Keyboard Controls",
      200 * fm + 20 * fm,
      topo + 36 * fm,
    );
    rd.fillText(
      "[X] & [Z] to look back while driving.",
      200 * fm + 20 * fm,
      topo + 116 * fm,
    );
    rd.fillText(
      "[Q] to toggle the guidance arrow by Keyboard.",
      200 * fm + 20 * fm,
      topo + 156 * fm,
    );
    rd.fillText(
      "[R] to trigger time reversal and rewind time.",
      200 * fm + 20 * fm,
      topo + 196 * fm,
    );
    rd.fillText(
      "[W], [A], [S] & [D] can also be used instead of Keyboard arrows.",
      200 * fm + 20 * fm,
      topo + 236 * fm,
    );
    rd.fillText(
      "[V] for cinematic camera views while driving.",
      200 * fm + 20 * fm,
      topo + 276 * fm,
    );
    rd.fillText("[M] to mute music.", 200 * fm + 20 * fm, topo + 316 * fm);
    rd.fillText(
      "[N] to mute sound effects.",
      200 * fm + 20 * fm,
      topo + 356 * fm,
    );
    rd.fillText(
      "[Enter] & [Esc] to navigate and pause game.",
      200 * fm + 20 * fm,
      topo + 396 * fm,
    );
    if (enter == 1) {
      ifase = 4;
      dudo = 250;
      enter = 2;
    }
  }
  if (ifase == 6) {
    rd.letterSpacing = "0px";
    rd.font = "" + 30 * fm + "px verd";
    rd.textBaseline = "middle";
    rd.textAlign = "left";
    rd.fillStyle = "#002748";
    rd.fillText("Music Credits", 200 * fm + 20 * fm, topo + 36 * fm);
    rd.fillText(
      "Interface and Game Menus: Neon Nox - Shift",
      200 * fm + 20 * fm,
      topo + 76 * fm,
    );
    rd.fillText(
      "Stage 1: Alpharisc - Video Disco",
      200 * fm + 20 * fm,
      topo + 116 * fm,
    );
    rd.fillText(
      "Stage 2: Sferro & Tommy '86 - We Been 'Round",
      200 * fm + 20 * fm,
      topo + 156 * fm,
    );
    rd.fillText(
      "Stage 3: Jeremiah Kane - All or Nothing",
      200 * fm + 20 * fm,
      topo + 196 * fm,
    );
    rd.fillText(
      "Stage 4: Wolf and Raven - Cyber Samurai",
      200 * fm + 20 * fm,
      topo + 236 * fm,
    );
    rd.fillText(
      "Stage 5: Bestrack - Burn the Night",
      200 * fm + 20 * fm,
      topo + 276 * fm,
    );
    rd.fillText(
      "Stage 6: Midnight Fury - Arcade Hero",
      200 * fm + 20 * fm,
      topo + 316 * fm,
    );
    rd.fillText(
      "Stage 7: DEADLIFE - Punished Survivor",
      200 * fm + 20 * fm,
      topo + 356 * fm,
    );
    rd.fillText(
      "Stage 8: Jeremiah Kane - Street Warriors (feat. FAVORIT89)",
      200 * fm + 20 * fm,
      topo + 396 * fm,
    );
    if (
      drawbutton(
        1,
        1170 * fm - 75 * view.scale,
        topo + 430 * fm,
        150,
        60,
        "#0075D8",
        "#299DFF",
        "#003F74",
        "#006AC4",
        0,
        "Next ",
        18,
        0.9,
        btimg[2],
        0.9,
        true,
      )
    ) {
      dudo = 250;
      ifase++;
    }
    if (enter == 1) {
      ifase++;
      dudo = 250;
      enter = 2;
    }
  }
  if (ifase == 7) {
    rd.letterSpacing = "0px";
    rd.font = "" + 30 * fm + "px verd";
    rd.textBaseline = "middle";
    rd.textAlign = "left";
    rd.fillStyle = "#002748";
    rd.fillText("Music Credits", 200 * fm + 20 * fm, topo + 36 * fm);
    rd.fillText(
      "Stage 9: DEADLIFE - We Are One & The Same",
      200 * fm + 20 * fm,
      topo + 76 * fm,
    );
    rd.fillText(
      "Stage 10: Wice - Star Fighter",
      200 * fm + 20 * fm,
      topo + 116 * fm,
    );
    rd.fillText(
      "Stage 11: Neon Nox - The Stash",
      200 * fm + 20 * fm,
      topo + 156 * fm,
    );
    rd.fillText(
      "Stage 12: Neon Nox vs Powernerd - Dopamine",
      200 * fm + 20 * fm,
      topo + 196 * fm,
    );
    rd.fillText(
      "Stage 13: Dreamhour - Small Town Vengeance",
      200 * fm + 20 * fm,
      topo + 236 * fm,
    );
    rd.fillText(
      "Stage 14: LazerHawk - King of The Streets",
      200 * fm + 20 * fm,
      topo + 276 * fm,
    );
    rd.fillText(
      "Stage 15: Jeremiah Kane - Vampirevania",
      200 * fm + 20 * fm,
      topo + 316 * fm,
    );
    rd.fillText(
      "Stage 16: Jeremiah Kane - SPECTER",
      200 * fm + 20 * fm,
      topo + 356 * fm,
    );
    rd.fillText(
      "Stage 17: Midnight Danger - Radio Hell",
      200 * fm + 20 * fm,
      topo + 396 * fm,
    );
    if (enter == 1) {
      ifase = 4;
      dudo = 250;
      enter = 2;
    }
  }
  if (ifase > 0) {
    if (
      drawbutton(
        4,
        240 * fm + 75 * view.scale,
        topo + 560 * fm - 65 * view.scale,
        150,
        60,
        "#0075D8",
        "#299DFF",
        "#003F74",
        "#006AC4",
        3,
        " Back",
        18,
        0.9,
        btimg[3],
        0.9,
        false,
      )
    ) {
      if (ifase == 7) {
        ifase--;
      }
      if (ifase == 6) {
        ifase--;
      }
      ifase--;
      dudo = 250;
    }
  }
  if (ifase < 4) {
    if (
      drawbutton(
        3,
        1280 * fm - 70 * fm - 100 * view.scale,
        topo + 560 * fm - 65 * view.scale,
        200,
        60,
        "#0075D8",
        "#299DFF",
        "#003F74",
        "#006AC4",
        0,
        "Next ",
        20,
        0.9,
        btimg[1],
        0.9,
        true,
      )
    ) {
      ifase++;
      dudo = 250;
    }
    if (enter == 1) {
      ifase++;
      dudo = 250;
      enter = 2;
    }
  }
  if (ifase == 4) {
    if (
      drawbutton(
        3,
        1280 * fm - 70 * fm - 110 * view.scale,
        topo + 560 * fm - 65 * view.scale,
        220,
        60,
        "#0075D8",
        "#299DFF",
        "#003F74",
        "#006AC4",
        0,
        "Finish ",
        20,
        0.9,
        btimg[1],
        0.9,
        true,
      )
    ) {
      if (instmain) {
        game.phase = PHASE.mainMenu;
        playMenuMusic();
      } else {
        game.phase = PHASE.paused;
      }
    }
    if (enter == 1) {
      if (instmain) {
        game.phase = PHASE.mainMenu;
        playMenuMusic();
      } else {
        game.phase = PHASE.paused;
      }
      enter = 2;
    }
  }
  var onabtn = false;
  var mnms = pointer.count;
  if (mnms < 1) {
    mnms = 1;
  }
  for (var i = 0; i < mnms; i++) {
    if (wasonit[i] != 0) {
      onabtn = true;
    }
  }
  if (!onabtn && pointer.down) {
    if (instmain) {
      game.phase = PHASE.mainMenu;
      playMenuMusic();
    } else {
      game.phase = PHASE.paused;
    }
    pointer.down = false;
  }
}
function resetgame() {
  rd.fillStyle = "#000000";
  rd.fillRect(0, 0, view.width, view.height);
  var lefy = (view.width - 1280 * view.scaleY) / 2;
  rd.drawImage(mainbg, lefy, 0, 1280 * view.scaleY, view.height);
  var fm = view.scaleX;
  if (view.scaleX / view.scaleY > 1.2) {
    fm *= 1.2 / (view.scaleX / view.scaleY);
  }
  if (aflk) {
    aflk = false;
  } else {
    aflk = true;
  }
  if (dudo > 0) {
    if (aflk) {
      ondud = Math.floor(random.fx() * 6);
      if (ondud == 6) {
        ondud = 5;
      }
    }
    dudo--;
  } else {
    ondud = 2;
  }
  rd.drawImage(
    insano[ondud],
    10 * fm,
    260 * view.scaleY,
    274 * fm * 0.7,
    341 * fm * 0.7,
  );
  var topo = 260 * view.scaleY - 200 * fm;
  rd.fillStyle = "#FFFFFF";
  rd.globalAlpha = 0.7;
  floatytalk(200 * fm, topo, 1060 * fm, 570 * fm, 20 * fm);
  rd.globalAlpha = 1;
  rd.letterSpacing = "0px";
  rd.font = "" + 30 * fm + "px verd";
  rd.textBaseline = "middle";
  rd.textAlign = "left";
  rd.fillStyle = "#002748";
  rd.fillText("Reset your Game", 200 * fm + 20 * fm, topo + 36 * fm);
  rd.fillText(
    "Would you like to play the game from the beginning again?",
    200 * fm + 20 * fm,
    topo + 76 * fm,
  );
  rd.fillText(
    "Note! This will delete all your saved unlocked cars and stages",
    200 * fm + 20 * fm,
    topo + 156 * fm,
  );
  rd.fillText(
    "and will start the game like it was never played before!",
    200 * fm + 20 * fm,
    topo + 196 * fm,
  );
  rd.fillText(
    "Challenge yourself again and reset the game now?",
    200 * fm + 20 * fm,
    topo + 276 * fm,
  );
  if (
    drawbutton(
      3,
      730 * fm,
      topo + 410 * fm - 65 * view.scale,
      500,
      60,
      "#0075D8",
      "#299DFF",
      "#003F74",
      "#006AC4",
      1,
      "Yes!  Reset my game now",
      20,
      0.9,
      null,
      0,
      false,
    )
  ) {
    game.unlocked = 1;
    track.stage = game.unlocked;
    saveInfo("unlocked", game.unlocked);
    game.carTypes[0] = 5;
    saveInfo("carsel", game.carTypes[0]);
    canreset = false;
    game.phase = PHASE.mainMenu;
  }
  if (
    drawbutton(
      4,
      240 * fm + 100 * view.scale,
      topo + 560 * fm - 65 * view.scale,
      200,
      60,
      "#0075D8",
      "#299DFF",
      "#003F74",
      "#006AC4",
      3,
      " Cancel",
      18,
      0.9,
      btimg[3],
      0.9,
      false,
    )
  ) {
    game.phase = PHASE.mainMenu;
  }
}
function drawloading() {
  var grd = rd.createLinearGradient(0, 0, view.width, view.height);
  grd.addColorStop(0, "#A87700");
  grd.addColorStop(1, "#9A3300");
  rd.fillStyle = grd;
  rd.fillRect(0, 0, view.width, view.height);
  var perc = dataload / datacnt;
  if (perc > 1) {
    perc = 1;
  }
  if (perc < 0.076) {
    perc = 0.076;
  }
  rd.drawImage(
    impimg,
    640 * view.scaleX - 107 * view.scale,
    100 * view.scaleY,
    215 * view.scale,
    248 * view.scale,
  );
  rd.lineWidth = 4 * view.scale;
  drawcoolrect(
    640 * view.scaleX,
    100 * view.scaleY + 248 * view.scale + 20 * view.scaleY,
    300,
    25,
    "#FF3D01",
    "#EAFF01",
    "#7BAE00",
    perc,
  );
  rd.font = "18px junk";
  rd.letterSpacing = "1px";
  if (rd.measureText("crazy game").width > 102) {
    rd.fillStyle = "#BCD800";
    rd.font = "" + 30 * view.scale + "px junk";
    rd.textBaseline = "middle";
    rd.letterSpacing = "1px";
    rd.textAlign = "center";
    rd.fillText(
      "This Game Is Crazy !",
      640 * view.scaleX,
      100 * view.scaleY +
        248 * view.scale +
        20 * view.scaleY +
        70 * view.scaleY,
    );
  }
}

function createswitches() {
  var cgr1 = [200, 200, 200, 192];
  var cgr2 = [200, 200, 200, 64];
  for (var i = 0; i < 3; i++) {
    cgr1[i] += cgr1[i] * scene.tint[i];
    if (cgr1[i] > 255) {
      cgr1[i] = 255;
    }
    if (cgr1[i] < 0) {
      cgr1[i] = 0;
    }
    cgr2[i] += cgr2[i] * scene.tint[i];
    if (cgr2[i] > 255) {
      cgr2[i] = 255;
    }
    if (cgr2[i] < 0) {
      cgr2[i] = 0;
    }
  }
  for (var c = 0; c < game.carCount; c++) {
    if (racers[c].switchp == null) {
      racers[c].switchp = newParticleModel();
    }
    if (racers[c].switchp.loaded == 1) {
      gl.deleteBuffer(racers[c].switchp.vbuf);
      racers[c].switchp.vbuf = null;
      gl.deleteBuffer(racers[c].switchp.cbuf);
      racers[c].switchp.cbuf = null;
      gl.deleteBuffer(racers[c].switchp.ibuf);
      racers[c].switchp.ibuf = null;
    }
    racers[c].switchp.on = false;
    var nodo = false;
    if (track.wasted == game.carCount - 2 && c != game.player) {
      nodo = true;
    }
    if (!racers[c].dest && !nodo) {
      var cpp = c;
      cpp++;
      if (cpp == game.carCount) {
        cpp = 0;
      }
      while (racers[cpp].dest) {
        cpp++;
        if (cpp == game.carCount) {
          cpp = 0;
        }
      }
      var vert = [
        car[c].x,
        car[c].y - 4,
        car[c].z,
        car[c].x,
        car[c].y + 4,
        car[c].z,
        car[cpp].x,
        car[cpp].y - 4,
        car[cpp].z,
        car[cpp].x,
        car[cpp].y + 4,
        car[cpp].z,
      ];
      var indice = [0, 1, 2, 2, 3, 1];
      racers[c].switchp.ni = 6;
      racers[c].switchp.vbuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, racers[c].switchp.vbuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
      var col = [];
      for (var i = 0; i < 4; i++) {
        if (i == 0 || i == 2) {
          for (var k = 0; k < 4; k++) {
            col[i * 4 + k] = cgr1[k] / 255;
          }
        } else {
          for (var k = 0; k < 4; k++) {
            col[i * 4 + k] = cgr2[k] / 255;
          }
        }
      }
      racers[c].switchp.cbuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, racers[c].switchp.cbuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
      racers[c].switchp.ibuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, racers[c].switchp.ibuf);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indice),
        gl.STATIC_DRAW,
      );
      racers[c].switchp.alpha = true;
      racers[c].switchp.mat = mat4.create();
      racers[c].switchp.loaded = 1;
      racers[c].switchp.on = true;
    }
  }
}
var switcnt = 0;
var slide = 80;
var slideto = 0;
var slidedir = false;
var swing = 0;
var swingto = 45;
var swingdir = false;
function drawswitch() {
  rd.clearRect(0, 0, view.width, view.height);
  if (switcnt == 0) {
    camera.mode = -1;
    slide = 80;
    slideto = 180;
    slidedir = false;
    swing = 0;
    if (random.fx() > random.fx()) {
      swingto = 45;
      swingdir = false;
    } else {
      swingto = -45;
      swingdir = true;
    }
    camera.nextTarget = game.player;
    camera.nextTarget++;
    if (camera.nextTarget == game.carCount) {
      camera.nextTarget = 0;
    }
    while (racers[camera.nextTarget].dest) {
      camera.nextTarget++;
      if (camera.nextTarget == game.carCount) {
        camera.nextTarget = 0;
      }
    }
    stopEngine();
  }
  if (switcnt < 20) {
    camera.pitch = 10;
    var kcxz = racers[camera.target].cxz - 180 + swing;
    camera.yaw = kcxz;
    camera.x = car[camera.target].x - slide * msin(kcxz);
    camera.z = car[camera.target].z + slide * mcos(kcxz);
    camera.y = car[camera.target].y + 25;
  }
  if (switcnt >= 20 && switcnt < 100) {
    var fcs1 = 100 - switcnt;
    var fcs2 = switcnt - 20;
    camera.pitch = 10;
    var kcxz =
      (racers[camera.target].cxz * fcs1 +
        racers[camera.nextTarget].cxz * fcs2) /
        80 -
      180 +
      swing;
    camera.yaw = kcxz;
    camera.x =
      (car[camera.target].x * fcs1 + car[camera.nextTarget].x * fcs2) / 80 -
      slide * msin(kcxz);
    camera.z =
      (car[camera.target].z * fcs1 + car[camera.nextTarget].z * fcs2) / 80 +
      slide * mcos(kcxz);
    camera.y =
      (car[camera.target].y * fcs1 + car[camera.nextTarget].y * fcs2) / 80 + 25;
  }
  if (switcnt >= 100) {
    camera.pitch = 10;
    var kcxz = racers[camera.nextTarget].cxz - 180 + swing;
    camera.yaw = kcxz;
    camera.x = car[camera.nextTarget].x - slide * msin(kcxz);
    camera.z = car[camera.nextTarget].z + slide * mcos(kcxz);
    camera.y = car[camera.nextTarget].y + 25;
  }
  if (switcnt >= 100) {
    slide += (80 - slide) / 17;
    swing += -swing / 17;
  } else {
    if (!slidedir) {
      slide += 1;
      if (slide > slideto) {
        slideto = 60;
        slidedir = true;
      }
    } else {
      slide -= 1;
      if (slide < slideto) {
        slideto = 180;
        slidedir = false;
      }
    }
    if (!swingdir) {
      swing += 1;
      if (swing > swingto) {
        swingto = -45;
        swingdir = true;
      }
    } else {
      swing -= 1;
      if (swing < swingto) {
        swingto = 45;
        swingdir = false;
      }
    }
  }
  if (switcnt == 10) {
    playSound(38, 1);
  }
  if (switcnt >= 10 && switcnt < 90) {
    if (tflk) {
      drawcs(132, "SWITCHING CARS", 0, 0, 0, 3);
      tflk = false;
    } else {
      drawcs(132, "SWITCHING CARS", 0, 64, 128, 3);
      tflk = true;
    }
    if (tflk) {
      drawcs(192, "Laps Reset, Time +10", 0, 0, 0, 1);
    } else {
      drawcs(192, "Laps Reset, Time +10", 0, 128, 255, 1);
    }
    var duds = 0;
    if (switcnt >= 10 && switcnt < 15) {
      duds = 5;
    }
    if (switcnt >= 15 && switcnt < 20) {
      duds = 4;
    }
    if (switcnt >= 20 && switcnt < 25) {
      duds = 3;
    }
    if (switcnt >= 25 && switcnt < 30) {
      duds = 2;
    }
    if (switcnt >= 30 && switcnt < 40) {
      duds = 1;
    }
    if (switcnt >= 40) {
      duds = 0;
    }
    rd.globalAlpha = 0.6;
    rd.drawImage(
      insano[duds],
      490 * view.scaleX - 230 * view.scale,
      10 * view.scaleY,
      274 * view.scale * 0.7,
      341 * view.scale * 0.7,
    );
    rd.globalAlpha = 1;
  }
  switcnt++;
  if (switcnt == 125) {
    onlastcheck = false;
    for (var i = 0; i < game.carCount; i++) {
      racers[i].pcleared = track.pcs;
      racers[i].clear = 0;
      racers[i].nlaps = 0;
      racers[i].missedcp = 0;
      racers[i].focus = -1;
    }
    racers[camera.nextTarget].u.left = racers[game.player].u.left;
    racers[camera.nextTarget].u.right = racers[game.player].u.right;
    racers[camera.nextTarget].u.up = racers[game.player].u.up;
    racers[camera.nextTarget].u.down = racers[game.player].u.down;
    racers[camera.nextTarget].u.handb = racers[game.player].u.handb;
    racers[camera.nextTarget].u.arrace = racers[game.player].u.arrace;
    iclear = 0;
    game.player = camera.nextTarget;
    camera.target = game.player;
    track.switchtime += 134;
    timer = track.switchtime;
    game.phase = PHASE.race;
    camera.mode = 0;
  }
}
function drawrevtime() {
  rd.clearRect(0, 0, view.width, view.height);
  if (switcnt == 5) {
    playSound(41, 1);
  }
  if (switcnt >= 10 && switcnt < 90) {
    if (tflk) {
      drawcs(132, "Reversing Time", 0, 0, 0, 3);
      tflk = false;
    } else {
      drawcs(132, "Reversing Time", 0, 64, 128, 3);
      tflk = true;
    }
    var duds = 0;
    if (switcnt >= 10 && switcnt < 15) {
      duds = 5;
    }
    if (switcnt >= 15 && switcnt < 20) {
      duds = 4;
    }
    if (switcnt >= 20 && switcnt < 25) {
      duds = 3;
    }
    if (switcnt >= 25 && switcnt < 30) {
      duds = 2;
    }
    if (switcnt >= 30 && switcnt < 40) {
      duds = 1;
    }
    if (switcnt >= 40) {
      duds = 0;
    }
    rd.globalAlpha = 0.6;
    rd.drawImage(
      insano[duds],
      490 * view.scaleX - 230 * view.scale,
      10 * view.scaleY,
      274 * view.scale * 0.7,
      341 * view.scale * 0.7,
    );
    rd.globalAlpha = 1;
  }
  if (Math.abs(recording.fr - (429 - recording.nrec)) > 30) {
    if (Math.abs(recording.fr - (429 - recording.nrec)) > 100) {
      if (switcnt % 30 == 0) {
        playSound(42, 1);
      }
    } else {
      if (switcnt % 50 == 0) {
        playSound(42, 1);
      }
    }
  }
  switcnt++;
  timetube.mat = resetMatrix(timetube.mat);
  mat4.rotate(
    timetube.mat,
    timetube.mat,
    camera.yaw * (Math.PI / 180),
    [0, -1, 0],
  );
  mat4.rotate(
    timetube.mat,
    timetube.mat,
    camera.pitch * (Math.PI / 180),
    [-1, 0, 0],
  );
  mat4.rotate(timetube.mat, timetube.mat, swing * (Math.PI / 180), [0, 0, 1]);
  if (Math.abs(recording.fr - (429 - recording.nrec)) > 100) {
    swing += 20;
  } else {
    swing += 10;
  }
  if (swing > 360) {
    swing -= 360;
  }
  timetube.x = car[camera.target].x - timetube.mat[8] * 170;
  timetube.y = car[camera.target].y - timetube.mat[9] * 170;
  timetube.z = car[camera.target].z - timetube.mat[10] * 170;
}
var wasu = false,
  wasd = false,
  wasl = false,
  wasr = false,
  wash = false,
  wast = false;

var timer = 800;
var oncheckpoint = -1;
var onlastcheck = false;
var chkflk = 0;
var arrace = false;
var ana = 0,
  cntan = 0,
  cntovn = 0;
var flk = false;
var winner = false;
var starcnt = 0;
var iclear = 0;
var holdcnt = 0;
var gocnt = 0;
var gocntdrop = 0;
var looped = 1;
var tcnt = 30;
var tflk = false;
var say = "";
var wasay = false;
var adj = [
  ["Cool", "Alright", "Nice"],
  ["Wicked", "Amazing", "Super"],
  ["Awesome", "Ripping", "Radical"],
  ["What the...?", "You're a super star!!!!", "Who are you again...?"],
  ["surf style", "off the lip", "bounce back"],
];
var exlm = ["!", "!!", "!!!"];
var loopin = "",
  spin = "",
  asay = "";
var auscnt = 45;
var aflk = false;
var pwcnt = 0;
var pwflk = false;
var dmcnt = 0;
var dmflk = false;
var cntwis = 0;
var dested = [];
var onbreplay = 0;
var flw = 2;
var flh = 1;
var flwg = false;
var flhg = false;
var cntkeys = 0;
function inishinter() {
  game.player = 0;
  track.switchtime = 800;
  timer = track.switchtime;
  oncheckpoint = -1;
  onlastcheck = false;
  chkflk = 0;
  arrace = false;
  ana = 0;
  cntan = 0;
  cntovn = 0;
  tcnt = 30;
  wasay = false;
  pwcnt = 0;
  auscnt = 45;
  pnext = 0;
  pback = 0;
  starcnt = 186;
  gocnt = 0;
  gocntdrop = 0;
  iclear = 0;
  for (var i = 0; i < 7; i++) {
    dested[i] = 0;
  }
  holdcnt = 0;
  camera.mode = 0;
  camera.target = 0;
  recording.onpausefr = false;
  cntwis = 0;
  dmcnt = 0;
  onbreplay = 0;
  flw = 2;
  flh = 0.5;
  for (var i = 0; i < 7; i++) {
    racers[i].u.arrace = false;
    racers[i].u.zyinv = false;
  }
}
function drawinter() {
  rd.clearRect(0, 0, view.width, view.height);
  var showpcn = isPhone;
  if (showpcn && starcnt > 65 && track.stage == 2 && game.unlocked == 2) {
    showpcn = false;
  }
  if (showpcn && starcnt > 65 && track.stage == 4 && game.unlocked == 4) {
    showpcn = false;
  }
  if (showpcn) {
    if (wasl) {
      rd.globalAlpha = 0.4;
    }
    rd.drawImage(
      contimg[0],
      130 * view.scaleX - 64 * view.scale,
      622 * view.scaleY - 128 * view.scale,
      128 * view.scale,
      128 * view.scale,
    );
    rd.globalAlpha = 1;
    if (wasr) {
      rd.globalAlpha = 0.4;
    }
    rd.drawImage(
      contimg[1],
      320 * view.scaleX - 64 * view.scale,
      662 * view.scaleY - 128 * view.scale,
      128 * view.scale,
      128 * view.scale,
    );
    rd.globalAlpha = 1;
    if (wasu) {
      rd.globalAlpha = 0.4;
    }
    rd.drawImage(
      contimg[3],
      1150 * view.scaleX - 64 * view.scale,
      622 * view.scaleY - 128 * view.scale,
      128 * view.scale,
      128 * view.scale,
    );
    rd.globalAlpha = 1;
    if (wasd) {
      rd.globalAlpha = 0.4;
    }
    rd.drawImage(
      contimg[2],
      960 * view.scaleX - 64 * view.scale,
      662 * view.scaleY - 128 * view.scale,
      128 * view.scale,
      128 * view.scale,
    );
    rd.globalAlpha = 1;
    if (wash) {
      rd.globalAlpha = 0.4;
    }
    rd.drawImage(
      contimg[4],
      1260 * view.scaleX - 154 * view.scale,
      440 * view.scaleY - 111 * view.scale,
      154 * view.scale,
      111 * view.scale,
    );
    rd.globalAlpha = 1;
    if (game.carCount != 1 && (track.stage != 1 || game.unlocked != 1)) {
      if (wast) {
        rd.globalAlpha = 0.4;
      }
      rd.drawImage(
        contimg[5],
        20 * view.scaleX,
        440 * view.scaleY - 111 * view.scale,
        154 * view.scale,
        111 * view.scale,
      );
      rd.globalAlpha = 1;
    }
    if (wasu) {
      racers[game.player].u.up = false;
      wasu = false;
    }
    if (wasd) {
      racers[game.player].u.down = false;
      wasd = false;
    }
    if (wasl) {
      racers[game.player].u.left = false;
      wasl = false;
    }
    if (wasr) {
      racers[game.player].u.right = false;
      wasr = false;
    }
    if (wash) {
      racers[game.player].u.handb = false;
      wash = false;
    }
    var notwast = 0;
    if (pointer.down) {
      for (var i = 0; i < pointer.count; i++) {
        var onkbt = false;
        var onkb = -1;
        var xpr = [
          130 * view.scaleX,
          320 * view.scaleX,
          1150 * view.scaleX,
          960 * view.scaleX,
          1260 * view.scaleX - 77 * view.scale,
          20 * view.scaleX + 77 * view.scale,
        ];
        var ypr = [
          622 * view.scaleY - 64 * view.scale,
          662 * view.scaleY - 64 * view.scale,
          622 * view.scaleY - 64 * view.scale,
          662 * view.scaleY - 64 * view.scale,
          440 * view.scaleY - 55.5 * view.scale,
          440 * view.scaleY - 55.5 * view.scale,
        ];
        var pyclos = 200 * view.scale;
        var nkb = 6;
        if (game.carCount == 1) {
          nkb = 5;
        }
        if (track.stage == 1 && game.unlocked == 1) {
          nkb = 5;
        }
        for (var k = 0; k < nkb; k++) {
          var pypr = py(xpr[k], pointer.x[i], ypr[k], pointer.y[i]);
          if (pypr < pyclos) {
            pyclos = pypr;
            onkb = k;
          }
        }
        if (onkb == 0) {
          racers[game.player].u.left = true;
          wasl = true;
        }
        if (onkb == 1) {
          racers[game.player].u.right = true;
          wasr = true;
        }
        if (onkb == 2) {
          racers[game.player].u.up = true;
          wasu = true;
        }
        if (onkb == 3) {
          racers[game.player].u.down = true;
          wasd = true;
        }
        if (onkb == 4) {
          racers[game.player].u.handb = true;
          wash = true;
        }
        if (onkb == 5) {
          if (!wast) {
            if (racers[game.player].u.arrace) {
              racers[game.player].u.arrace = false;
            } else {
              racers[game.player].u.arrace = true;
            }
            wast = true;
          }
          onkbt = true;
        }
      }
      if (!onkbt) {
        notwast++;
      }
    }
    if (notwast == pointer.count) {
      wast = false;
    }
  }
  var holdit = false;
  if (track.wasted == game.carCount - 1 && game.carCount != 1) {
    drawcs(132, "You Wasted'em!", 0, 0, 0, 3);
    if (aflk) {
      drawcs(192, "You Won, all cars have been wasted!", 0, 0, 0, 0);
      aflk = false;
    } else {
      drawcs(192, "You Won, all cars have been wasted!", 0, 128, 255, 0);
      aflk = true;
    }
    if (!track.haltall) {
      playSound(33, 1);
    }
    track.haltall = true;
    holdit = true;
    winner = true;
  }
  if (!holdit) {
    if (racers[game.player].dest && cntwis == 16) {
      drawcs(132, "You're Wasted!", 0, 0, 0, 3);
      holdit = true;
      winner = false;
    }
  }
  if (racers[game.player].cntdest != 0 && cntwis < 16) {
    cntwis++;
    if (cntwis == 1) {
      playSound(31, 1);
    }
    if (cntwis == 16) {
      playSound(30, 1);
    }
  }
  if (!holdit) {
    for (var i = 0; i < game.carCount; i++) {
      if (track.clear[i] == track.nlaps * track.nsp && track.pos[i] == 0) {
        if (i == game.player) {
          drawcs(132, "You Won!", 0, 0, 0, 3);
          if (aflk) {
            drawcs(192, "You finished first, nice job!", 0, 0, 0, 0);
            aflk = false;
          } else {
            drawcs(192, "You finished first, nice job!", 0, 128, 255, 0);
            aflk = true;
          }
          winner = true;
          if (!track.haltall) {
            playSound(32, 1);
          }
        } else {
          drawcs(132, "You Lost!", 0, 0, 0, 3);
          if (aflk) {
            drawcs(
              192,
              "" +
                carStats.names[game.carTypes[i]] +
                " finished first, race over!",
              0,
              0,
              0,
              0,
            );
            aflk = false;
          } else {
            drawcs(
              192,
              "" +
                carStats.names[game.carTypes[i]] +
                " finished first, race over!",
              0,
              128,
              255,
              0,
            );
            aflk = true;
          }
          winner = false;
        }
        track.haltall = true;
        holdit = true;
      }
    }
  }
  if (holdit) {
    if (holdcnt == 0) {
      if (
        winner &&
        game.unlocked == track.stage &&
        game.carCount != 1 &&
        track.stage != 17
      ) {
        saveInfo("unlocked", game.unlocked + 1);
      }
    }
    holdcnt++;
    var exitnow = false;
    if (racers[game.player].u.handb && holdcnt > 50) {
      exitnow = true;
      racers[game.player].u.handb = false;
    }
    if (enter == 1) {
      exitnow = true;
      enter = 2;
    }
    if (
      drawbutton(
        7,
        640 * view.scaleX,
        view.height - 60 * view.scale - 40 * view.scaleY,
        250,
        60,
        "#019DFF",
        "#01BAFF",
        "#004A78",
        "#015777",
        0,
        "Continue ",
        20,
        0.8,
        btimg[1],
        0.8,
        false,
      )
    ) {
      exitnow = true;
    }
    /*if (winner){if (holdcnt==150) { exitnow=true; }}else{if (drawbutton(7,(640*mw),(canh-(55*avm)-(20*mh)),270,60,"#89C800","#CADC00","#4B6E00","#778200",0,"Continue ",20,0.8,btimg[1],0.8,false)) { exitnow=true; }}*/ if (
      exitnow
    ) {
      if (recording.htyp) {
        onbreplay = 2;
      } else {
        iniend();
        game.phase = PHASE.raceEnd;
      }
      stopEngine();
    }
    if (onbreplay == 1) {
      cntreps = 0;
      camera.orbitHeight = Math.floor(90 * random.fx());
      camera.orbitAngle = Math.floor(360 * random.fx());
      hrewindhreplay();
    }
    if (onbreplay) {
      rd.globalAlpha = 0.7;
      rd.fillStyle = "#000000";
      rd.fillRect(0, 0, view.width, view.height);
      rd.globalAlpha = 1;
      onbreplay--;
    }
  } else {
    if (holdcnt != 0) {
      holdcnt = 0;
    }
    if (enter == 1 && starcnt <= 65) {
      enter = 2;
      onhip = 0;
      stopStageMusic();
      stopEngine();
      game.phase = PHASE.paused;
    }
  }
  if (starcnt <= 65) {
    if (game.mode == 1 && starcnt == 0 && !holdit) {
      timer--;
      var minutes = Math.floor(timer / 800);
      var seconds = Math.floor((timer / 800 - minutes) * 60);
      var adlz = "";
      if (seconds < 10) {
        adlz = "0";
      }
      drawcs(670, "0" + minutes + ":" + adlz + "" + seconds, 0, 0, 0, 4);
      if (timer == 120 || timer == 90 || timer == 60 || timer == 30) {
        playSound(39, 1);
      }
      if (timer == 0) {
        playSound(40, 1);
        createswitches();
        switcnt = 0;
        game.phase = PHASE.switchScreen;
      }
    }
    if (
      game.carCount != 1 &&
      arrace != racers[game.player].u.arrace &&
      track.stage != 16
    ) {
      arrace = racers[game.player].u.arrace;
      if (arrace) {
        wasay = true;
        say = " Arrow now pointing at >  CARS";
        tcnt = -5;
      }
      if (!arrace) {
        wasay = false;
        say = " Arrow now pointing at >  TRACK";
        tcnt = -5;
        cntan = 20;
      }
    }
    if (!holdit && starcnt == 0 && camera.mode == 0 && track.stage != 16) {
      arrow(racers[game.player].point, racers[game.player].missedcp, arrace);
      if (!arrace && auscnt == 45 && racers[game.player].capcnt == 0) {
        if (racers[game.player].missedcp > 0) {
          if (
            racers[game.player].missedcp > 15 &&
            racers[game.player].missedcp < 50
          ) {
            if (flk) {
              drawcs(112, "Check Point Missed!", 255, 0, 0, 1);
            } else {
              drawcs(112, "Check Point Missed!", 255, 128, 0, 2);
            }
          }
          if (tick.fraction >= tick.scale) {
            racers[game.player].missedcp++;
            if (racers[game.player].missedcp == 70) {
              racers[game.player].missedcp = -2;
            }
          }
        } else {
          if (racers[game.player].mtouch && cntovn < 70) {
            if (tick.fraction >= tick.scale) {
              if (Math.abs(ana) > 100) {
                cntan++;
              } else {
                if (cntan != 0) {
                  cntan--;
                }
              }
            }
            if (cntan > 40) {
              if (tick.fraction >= tick.scale) {
                cntovn++;
              }
              cntan = 40;
              if (flk) {
                drawcs(112, "Wrong Way!", 255, 128, 0, 1);
                flk = false;
              } else {
                drawcs(112, "Wrong Way!", 255, 0, 0, 2);
                flk = true;
              }
            }
          }
        }
      }
    }
    rd.letterSpacing = "1px";
    rd.font = "" + 11 * (view.scaleY + view.scaleX) + "px junk";
    rd.textBaseline = "middle";
    rd.textAlign = "left";
    rd.fillStyle = "#000000";
    rd.fillText("Lap", 20 * view.scale, 19 * view.scale);
    rd.fillText("Wasted", 130 * view.scale, 19 * view.scale);
    var adln = 0;
    if (isPhone) {
      adln = 70;
    }
    rd.fillText("Position", (60 + adln) * view.scale, 55 * view.scale);
    rd.letterSpacing = "2px";
    rd.fillStyle = "#000078";
    rd.fillText(
      "" + (racers[game.player].nlaps + 1) + "/" + track.nlaps + "",
      68 * view.scale,
      19 * view.scale,
    );
    rd.fillText(
      "" + track.wasted + "/" + (game.carCount - 1) + "",
      217 * view.scale,
      19 * view.scale,
    );
    var rank = "th";
    if (track.pos[game.player] == 2) {
      rank = "rd";
    }
    if (track.pos[game.player] == 1) {
      rank = "nd";
    }
    if (track.pos[game.player] == 0) {
      rank = "st";
    }
    rd.letterSpacing = "1px";
    rd.font = "" + 15 * (view.scaleY + view.scaleX) + "px junk";
    rd.fillText(
      "" + (track.pos[game.player] + 1),
      (157 + adln) * view.scale,
      56 * view.scale,
    );
    rd.font = "" + 11 * (view.scaleY + view.scaleX) + "px junk";
    rd.fillStyle = "#000000";
    rd.fillText(rank, (176 + adln) * view.scale, 55 * view.scale);
    if (
      !isPhone &&
      game.carCount != 1 &&
      (track.stage != 1 || game.unlocked != 1)
    ) {
      if (arrace) {
        if (
          drawbutton(
            1,
            80 * view.scale,
            90 * view.scale,
            100,
            60,
            "#7DBDFF",
            "#7872FF",
            "#1767B9",
            "#2018C2",
            0,
            "A",
            22,
            0.76,
            btimg[0],
            1,
            false,
          )
        ) {
          racers[game.player].u.arrace = false;
        }
      } else {
        if (
          drawbutton(
            1,
            80 * view.scale,
            90 * view.scale,
            100,
            60,
            "#89C800",
            "#CADC00",
            "#4B6E00",
            "#778200",
            0,
            "A",
            22,
            0.76,
            btimg[0],
            1,
            false,
          )
        ) {
          racers[game.player].u.arrace = true;
        }
      }
    }
    var lalign = view.width - 290 * view.scale;
    if (view.width / view.height < 1.3) {
      lalign = view.width - 200 * view.scale;
    }
    rd.font = "" + 11 * (view.scaleY + view.scaleX) + "px junk";
    rd.textAlign = "right";
    rd.fillStyle = "#000000";
    rd.fillText("Damage", lalign - 15 * view.scale, 19 * view.scale);
    rd.fillText("Power", lalign - 15 * view.scale, 55 * view.scale);
    var trav =
      98 * (racers[game.player].hitmag / carStats.maxmag[car[game.player].typ]);
    if (trav > 98) {
      trav = 98;
    }
    var r = 255;
    var g = 200;
    var b = 0;
    if (trav > 33) {
      g = 200 - 189 * ((trav - 33) / 65);
    }
    if (trav > 70) {
      if (dmcnt < 10) {
        if (dmflk) {
          g = 170;
          dmflk = false;
        } else {
          dmflk = true;
        }
      }
      if (tick.fraction >= tick.scale) {
        dmcnt++;
      }
      if (dmcnt > 167 - trav * 1.5) {
        dmcnt = 0;
      }
    }
    drawbar(
      lalign,
      6 * view.scale,
      "#FC4D00",
      "#B20000",
      "rgb(" + r + "," + g + "," + b + ")",
      trav / 98,
    );
    r = 128;
    if (racers[game.player].power == 98) {
      r = 64;
    }
    g = 190 + racers[game.player].power * 0.37;
    b = 255;
    if (auscnt < 45 && aflk) {
      r = 128;
      g = 244;
      b = 255;
    }
    drawbar(
      lalign,
      42 * view.scale,
      "#00B0DC",
      "#005C96",
      "rgb(" + r + "," + g + "," + b + ")",
      racers[game.player].power / 98,
    );
    var adwn = 0;
    if (view.width / view.height < 1.3) {
      adwn = 76 * view.scale;
    }
    var onycl = oncla(
      2,
      view.width - 87 * view.scale,
      10 * view.scale + adwn,
      77 * view.scale,
      53 * view.scale,
    );
    if (onycl != 2) {
      rd.drawImage(
        muimg[onycl],
        view.width - 87 * view.scale,
        10 * view.scale + adwn,
        77 * view.scale,
        53 * view.scale,
      );
    } else {
      if (!holdit) {
        onhip = 0;
        stopStageMusic();
        stopEngine();
        game.phase = PHASE.paused;
      }
    }
    onycl = oncla(
      3,
      view.width - 77.5 * view.scale,
      73 * view.scale + adwn,
      58 * view.scale,
      42 * view.scale,
    );
    if (onycl == 1) {
      rd.globalAlpha = 0.5;
    }
    if (onycl == 2) {
      if (!audio.muteSound) {
        audio.muteSound = true;
        stopEngine();
      } else {
        audio.muteSound = false;
      }
    }
    if (!audio.muteSound) {
      onycl = 2;
    } else {
      onycl = 3;
    }
    rd.drawImage(
      muimg[onycl],
      view.width - 77.5 * view.scale,
      73 * view.scale + adwn,
      58 * view.scale,
      42 * view.scale,
    );
    rd.globalAlpha = 1;
    onycl = oncla(
      4,
      view.width - 77.5 * view.scale,
      125 * view.scale + adwn,
      58 * view.scale,
      42 * view.scale,
    );
    if (onycl == 1) {
      rd.globalAlpha = 0.5;
    }
    if (onycl == 2) {
      if (!audio.muteMusic) {
        audio.muteMusic = true;
      } else {
        audio.muteMusic = false;
      }
    }
    if (!audio.muteMusic) {
      onycl = 4;
    } else {
      onycl = 5;
    }
    rd.drawImage(
      muimg[onycl],
      view.width - 77.5 * view.scale,
      125 * view.scale + adwn,
      58 * view.scale,
      42 * view.scale,
    );
    rd.globalAlpha = 1;
    if (!isPhone && track.stage >= 2 && cntkeys < 200 && game.carCount != 1) {
      if (slide < 10 || cntkeys > 100) {
        rd.drawImage(
          inst[9],
          80 * view.scale + 50 * view.scale + 30 * view.scale,
          85 * view.scale,
          72 * view.scale,
          75 * view.scale,
        );
      }
      slide++;
      if (slide > 12) {
        slide = 0;
      }
      cntkeys++;
    }
  }
  if (!holdit) {
    if ((starcnt != 0 || gocntdrop > 4) && starcnt < 65) {
      if (starcnt == 63) {
        gocnt = 3;
        gocntdrop = 16;
        playSound(34, 1);
      }
      if (starcnt == 41) {
        gocnt = 2;
        gocntdrop = 16;
        playSound(35, 1);
      }
      if (starcnt == 24) {
        gocnt = 1;
        gocntdrop = 16;
        playSound(36, 1);
      }
      if (starcnt == 2) {
        gocnt = 0;
        gocntdrop = 16;
        playSound(37, 1);
      }
      var duds = 0;
      if (starcnt <= 63 && starcnt > 52) {
        duds = 1;
      }
      if (starcnt <= 41 && starcnt > 32) {
        duds = 4;
      }
      if (starcnt <= 24 && starcnt > 13) {
        duds = 2;
      }
      if (starcnt <= 2) {
        duds = 3;
      }
      if (starcnt == 0 && gocntdrop < 7) {
        duds = 1;
      }
      rd.globalAlpha = 0.6;
      rd.drawImage(
        insano[duds],
        640 * view.scaleX - 230 * view.scale,
        10 * view.scaleY,
        274 * view.scale * 0.7,
        341 * view.scale * 0.7,
      );
      rd.globalAlpha = 1;
    }
    if (gocntdrop != 0) {
      if (gocnt != 0) {
        drawcs(100, "" + gocnt, 0, 0, 0, 3);
      } else {
        drawcs(100, "Go!", 0, 0, 0, 3);
      }
      gocntdrop--;
    }
    if (looped != 0) {
      if (
        racers[game.player].loop == 2 &&
        (Math.abs(racers[game.player].travxy) > 110 ||
          Math.abs(racers[game.player].travzy) > 110)
      ) {
        looped = 0;
      }
      if (looped == 1 && !racers[game.player].mtouch) {
        looped = 2;
      }
    }
    if (racers[game.player].power < 40) {
      if (
        tcnt == 30 &&
        auscnt == 45 &&
        racers[game.player].mtouch &&
        racers[game.player].capcnt == 0
      ) {
        if (looped != 3) {
          if (pwcnt < 70 || (pwcnt < 100 && looped != 0)) {
            if (pwflk) {
              drawcs(176, "Power low, perform stunt!", 0, 0, 200, 0);
              pwflk = false;
            } else {
              drawcs(176, "Power low, perform stunt!", 255, 100, 0, 0);
              pwflk = true;
            }
          }
        } else {
          if (pwcnt < 100) {
            if (pwflk) {
              drawcs(
                176,
                "Try to flip your car in the air to preform stunts!",
                0,
                0,
                200,
                0,
              );
              pwflk = false;
            } else {
              drawcs(
                176,
                "Try to flip your car in the air to preform stunts!",
                255,
                100,
                0,
                0,
              );
              pwflk = true;
            }
          }
        }
        if (tick.fraction >= tick.scale) {
          pwcnt++;
        }
        if (pwcnt == 300) {
          pwcnt = 0;
          if (looped >= 2) {
            looped++;
            if (looped == 5) {
              looped = 3;
            }
          }
        }
      }
    } else {
      if (pwcnt != 0) {
        pwcnt = 0;
      }
    }
    if (racers[game.player].capcnt == 0) {
      if (tcnt < 30) {
        if (tflk) {
          drawcs(167, say, 0, 0, 0, 1);
          tflk = false;
        } else {
          if (!wasay) {
            drawcs(167, say, 0, 128, 255, 1);
          } else {
            drawcs(167, say, 255, 128, 0, 1);
          }
          tflk = true;
        }
        if (tick.fraction >= tick.scale) {
          tcnt++;
        }
      } else {
        if (wasay) {
          wasay = false;
        }
      }
      if (auscnt < 45) {
        if (aflk) {
          drawcs(136, asay, 59, 156, 255, 0);
          aflk = false;
        } else {
          drawcs(136, asay, 0, 107, 216, 0);
          aflk = true;
        }
        if (tick.fraction >= tick.scale) {
          auscnt++;
        }
      }
    } else {
      if (tflk) {
        drawcs(176, "Bad Landing!", 0, 0, 200, 1);
        tflk = false;
      } else {
        drawcs(176, "Bad Landing!", 255, 100, 0, 1);
        tflk = true;
      }
    }
    if (racers[game.player].trcnt == 10 && tick.fraction >= tick.scale) {
      loopin = "";
      spin = "";
      asay = "";
      var lp = 0;
      while (racers[game.player].travzy > 225) {
        racers[game.player].travzy -= 360;
        lp++;
      }
      while (racers[game.player].travzy < -225) {
        racers[game.player].travzy += 360;
        lp--;
      }
      if (lp == 1) {
        loopin = "Forward loop";
      }
      if (lp == 2) {
        loopin = "double Forward";
      }
      if (lp == 3) {
        loopin = "triple Forward";
      }
      if (lp >= 4) {
        loopin = "massive Forward looping";
      }
      if (lp == -1) {
        loopin = "Backloop";
      }
      if (lp == -2) {
        loopin = "double Back";
      }
      if (lp == -3) {
        loopin = "triple Back";
      }
      if (lp <= -4) {
        loopin = "massive Back looping";
      }
      if (lp == 0) {
        if (racers[game.player].ftab && racers[game.player].btab) {
          loopin = "Tabletop and reversed Tabletop";
        } else {
          if (racers[game.player].ftab || racers[game.player].btab) {
            loopin = "Tabletop";
          }
        }
      }
      if (lp > 0 && racers[game.player].btab) {
        loopin = "Hanged " + loopin;
      }
      if (lp < 0 && racers[game.player].ftab) {
        loopin = "Hanged " + loopin;
      }
      if (loopin != "") {
        asay += " " + loopin;
      }
      lp = 0;
      racers[game.player].travxy = Math.abs(racers[game.player].travxy);
      while (racers[game.player].travxy > 270) {
        racers[game.player].travxy -= 360;
        lp++;
      }
      if (lp == 0 && racers[game.player].rtab) {
        if (loopin == "") {
          spin = "Tabletop";
        } else {
          spin = "Flipside";
        }
      }
      if (lp == 1) {
        spin = "Rollspin";
      }
      if (lp == 2) {
        spin = "double Rollspin";
      }
      if (lp == 3) {
        spin = "triple Rollspin";
      }
      if (lp >= 4) {
        spin = "massive Roll spinning";
      }
      lp = 0;
      var beyond = false;
      racers[game.player].travxz = Math.abs(racers[game.player].travxz);
      while (racers[game.player].travxz > 90) {
        racers[game.player].travxz -= 180;
        lp += 180;
        if (lp > 900) {
          lp = 900;
          beyond = true;
        }
      }
      if (lp != 0) {
        if (loopin == "" && spin == "") {
          asay += " " + lp;
          if (beyond) {
            asay += " and beyond";
          }
        } else {
          if (spin != "") {
            if (loopin == "") {
              asay += " " + spin;
            } else {
              asay += " with " + spin;
            }
          }
          asay += " by " + lp;
          if (beyond) {
            asay += " and beyond";
          }
        }
      } else {
        if (spin != "") {
          if (loopin == "") {
            asay += " " + spin;
          } else {
            asay += " by " + spin;
          }
        }
      }
      if (asay != "") {
        auscnt -= 15;
      }
      if (loopin != "") {
        auscnt -= 25;
      }
      if (spin != "") {
        auscnt -= 25;
      }
      if (lp != 0) {
        auscnt -= 25;
      }
      if (auscnt < 45) {
        playSound(27, 1);
        if (onautocorrect) {
          onautocorrect--;
        }
        if (auscnt < -20) {
          auscnt = -20;
        }
        var prp = 0;
        if (racers[game.player].powerup > 20) {
          prp = 1;
        }
        if (racers[game.player].powerup > 40) {
          prp = 2;
        }
        if (racers[game.player].powerup > 150) {
          prp = 3;
        }
        if (racers[game.player].surfer) {
          asay = " " + adj[4][Math.floor(random.fx() * 2.99)] + asay;
        }
        if (prp != 3) {
          asay = adj[prp][Math.floor(random.fx() * 2.99)] + asay + exlm[prp];
        } else {
          asay = adj[prp][Math.floor(random.fx() * 2.99)];
        }
        if (!wasay) {
          tcnt = auscnt;
          if (racers[game.player].power != 98) {
            say =
              "POWER UP " +
              Math.floor((100 * racers[game.player].powerup) / 98) +
              "%";
          } else {
            say = "POWER TO THE MAX";
          }
        }
      }
    }
    if (car[game.player].fcnt == 2) {
      if (!wasay) {
        say = "Car Fixed";
        tcnt = 0;
      }
    }
    if (game.carCount != 1) {
      for (var i = 0; i < game.carCount; i++) {
        if (dested[i] != track.dested[i] && i != game.player) {
          dested[i] = track.dested[i];
          if (dested[i] == 1) {
            wasay = true;
            say = "" + carStats.names[game.carTypes[i]] + " has been wasted!";
            tcnt = -15;
          }
          if (dested[i] == 2) {
            wasay = true;
            say = "You wasted " + carStats.names[game.carTypes[i]] + "!";
            tcnt = -15;
          }
        }
      }
    }
    if (iclear != racers[game.player].clear && racers[game.player].clear != 0) {
      if (!wasay) {
        say = "Check Point";
        tcnt = 15;
      }
      iclear = racers[game.player].clear;
      playSound(28, 1);
      cntovn = 0;
      if (cntan != 0) {
        cntan = 0;
      }
    }
  }
}
function drawonbordo() {
  var fm = view.scaleX;
  if (view.scaleX / view.scaleY > 1.2) {
    fm *= 1.2 / (view.scaleX / view.scaleY);
  }
  var topo = 260 * view.scaleY;
  if (pwflk) {
    pwflk = false;
  } else {
    pwflk = true;
  }
  if (starcnt > 130) {
    if (pwflk) {
      ondud = Math.floor(random.fx() * 6);
      if (ondud == 6) {
        ondud = 5;
      }
    }
  } else {
    ondud = 2;
  }
  rd.drawImage(insano[ondud], 10 * fm, topo, 274 * fm * 0.7, 341 * fm * 0.7);
  rd.fillStyle = "#FFFFFF";
  rd.globalAlpha = 0.7;
  var fldn = 250;
  if (track.stage == 4) {
    fldn = 280;
  }
  floatytalk(200 * fm, topo, 1060 * fm, fldn * fm, 20 * fm);
  rd.globalAlpha = 1;
  rd.letterSpacing = "0px";
  rd.font = "" + 30 * fm + "px verd";
  rd.textBaseline = "middle";
  rd.textAlign = "left";
  rd.fillStyle = "#002748";
  if (track.stage == 2) {
    rd.fillText(
      "Preform stunts to power up your car!",
      200 * fm + 20 * fm,
      topo + 36 * fm,
    );
  }
  if (track.stage == 4) {
    rd.fillText(
      "It is easier to just waste the other cars in this stage!",
      200 * fm + 20 * fm,
      topo + 36 * fm,
    );
    rd.fillText(
      "Use the Arrow Target button",
      200 * fm + 20 * fm,
      topo + 96 * fm,
    );
  }
  if (track.stage == 2) {
    rd.font = "" + 50 * fm + "px verd";
    rd.fillText("=", 770 * fm, topo + 80 * fm + 55 * view.scale);
    rd.drawImage(
      inst[4],
      200 * fm + 90 * fm,
      topo + 70 * fm,
      464 * fm,
      150 * fm,
    );
    rd.letterSpacing = "1px";
    rd.font = "" + 11 * (view.scaleY + view.scaleX) + "px junk";
    rd.textAlign = "right";
    rd.fillStyle = "#000000";
    rd.fillText(
      "Power",
      945 * fm - 15 * view.scale,
      topo + 80 * fm + 55 * view.scale,
    );
    var r = 128;
    var g = 190 + 70 * 0.37;
    var b = 255;
    drawbar(
      945 * fm,
      topo + 80 * fm + 42 * view.scale,
      "#00B0DC",
      "#005C96",
      "rgb(" + r + "," + g + "," + b + ")",
      70 / 98,
    );
  }
  if (track.stage == 4) {
    if (!isPhone) {
      drawbutton(
        1,
        200 * fm + 240 * fm,
        topo + 130 * fm,
        100,
        60,
        "#89C800",
        "#CADC00",
        "#4B6E00",
        "#778200",
        0,
        "A",
        22,
        0.76,
        btimg[0],
        1,
        false,
      );
    } else {
      rd.drawImage(
        contimg[5],
        200 * fm + 165 * fm,
        topo + 130 * fm,
        154 * view.scale,
        111 * view.scale,
      );
    }
    rd.drawImage(
      inst[8],
      200 * fm + 530 * fm,
      topo + 80 * fm,
      382 * fm,
      164 * fm,
    );
  }
}
function drawreplay() {
  rd.clearRect(0, 0, view.width, view.height);
  rd.letterSpacing = "1px";
  rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "left";
  rd.textBaseline = "middle";
  rd.fillStyle = "rgb(0,32,64)";
  rd.fillText("REPLAY", 20 * view.scaleX, 35 * view.scaleY);
  if (
    drawbutton(
      1,
      view.width - 100 * view.scale - 30 * view.scaleX,
      view.height - 60 * view.scale - 30 * view.scaleY,
      170,
      60,
      "#019DFF",
      "#01EAFF",
      "#004A78",
      "#016D77",
      0,
      "Exit ",
      20,
      0.7,
      btimg[1],
      0.7,
      false,
    )
  ) {
    onbreplay = 2;
  }
  if (enter == 1) {
    onbreplay = 2;
    enter = 2;
  }
  if (onbreplay == 1) {
    fastforwardexit();
  }
  if (recording.fr > 425) {
    rd.fillStyle = "#000000";
    rd.fillRect(0, 0, view.width, view.height);
  }
  if (onbreplay) {
    rd.globalAlpha = 0.7;
    rd.fillStyle = "#000000";
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
    onbreplay--;
  }
}
var cntreps = 0;
var rmode = 0;
var holdf = 0;
var lwit = false;

function drawhreplay() {
  rd.clearRect(0, 0, view.width, view.height);
  rd.letterSpacing = "1px";
  rd.font = "" + 24 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  var grd = rd.createLinearGradient(
    640 * view.scaleX,
    40 * view.scaleY - 10 * view.scale,
    640 * view.scaleX,
    40 * view.scaleY + 10 * view.scale,
  );
  grd.addColorStop(0, "#006ED4");
  grd.addColorStop(1, "#A3E6FF");
  rd.fillStyle = grd;
  rd.fillText("Game Highlight", 640 * view.scaleX, 40 * view.scaleY);
  rd.strokeStyle = "#003E78";
  rd.lineWidth = 1.5 * view.scale;
  rd.strokeText("Game Highlight", 640 * view.scaleX, 40 * view.scaleY);
  if (recording.htyp == 1) {
    if (track.stage > 2) {
      drawcs(90, "Stunts!", 0, 32, 64, 1);
    } else {
      drawcs(90, "Best Stunt!", 0, 32, 64, 1);
    }
    if (rmode == 98) {
      if (
        holdf == 4 ||
        holdf == 7 ||
        holdf == 44 ||
        holdf == 47 ||
        holdf == 94 ||
        holdf == 97
      ) {
        rd.globalAlpha = 0.5;
        rd.fillStyle = "#FFFFFF";
        rd.fillRect(0, 0, view.width, view.height);
        rd.globalAlpha = 1;
      }
    }
    if (rmode == 43) {
      if (holdf >= 1 && holdf < 43) {
        if (holdf % Math.floor(2 + random.fx() * 3) == 0 && !lwit) {
          rd.globalAlpha = 0.5;
          rd.fillStyle = "#FFFFFF";
          rd.fillRect(0, 0, view.width, view.height);
          rd.globalAlpha = 1;
          lwit = true;
        } else {
          lwit = false;
        }
      }
    }
    if (recording.fr > recording.hat && holdf != rmode) {
      holdf++;
    }
    camera.mode = 1;
    camera.target = recording.hcim;
    recording.onpausefr = false;
    if (holdf == 0 || holdf == rmode) {
      recording.fr++;
      if (recording.fr == 430) {
        recording.fr = 0;
        holdf = 0;
        hrewindhreplay();
        cntreps++;
      }
    } else {
      recording.onpausefr = true;
    }
  }
  if (recording.htyp == 2) {
    drawcs(90, "Wasted!", 0, 32, 64, 1);
    if (rmode == 95) {
      if (holdf == 4 || holdf == 44 || holdf == 94) {
        rd.globalAlpha = 0.5;
        rd.fillStyle = "#FFFFFF";
        rd.fillRect(0, 0, view.width, view.height);
        rd.globalAlpha = 1;
      }
    }
    if (recording.fr > recording.hat && holdf != rmode) {
      holdf++;
    }
    camera.mode = 1;
    camera.target = recording.hcim;
    recording.onpausefr = false;
    if (holdf == 0 || holdf == rmode) {
      recording.fr++;
      if (recording.fr == 430) {
        recording.fr = 0;
        holdf = 0;
        hrewindhreplay();
        cntreps++;
      }
    } else {
      recording.onpausefr = true;
    }
  }
  if (recording.htyp == 3) {
    drawcs(90, "You Wasted'em!", 0, 32, 64, 1);
    if (holdf == 13 || holdf == 16) {
      rd.globalAlpha = 0.5;
      rd.fillStyle = "#FFFFFF";
      rd.fillRect(0, 0, view.width, view.height);
      rd.globalAlpha = 1;
    }
    if (holdf == 0) {
      camera.mode = 1;
      camera.target = recording.hcim;
    }
    if (holdf > 0 && holdf < 30) {
      camera.mode = 3;
      camera.target = recording.hcim;
      camera.nextTarget = recording.hscar;
      camera.transition = holdf;
    }
    if (holdf == 30) {
      camera.mode = 1;
      camera.target = recording.hscar;
    }
    if (recording.fr > recording.hat && holdf != 30) {
      holdf++;
    }
    recording.onpausefr = false;
    if (holdf == 0 || holdf == 30) {
      recording.fr++;
      if (recording.fr == 430) {
        recording.fr = 0;
        holdf = 0;
        hrewindhreplay();
        cntreps++;
      }
    } else {
      recording.onpausefr = true;
    }
  }
  if (recording.htyp == 4) {
    drawcs(90, "Close Finish!", 0, 32, 64, 1);
    if (holdf == 0) {
      camera.mode = 1;
      camera.target = recording.hcim;
    }
    if (holdf > 0 && holdf < 30) {
      camera.mode = 3;
      camera.target = recording.hcim;
      camera.nextTarget = recording.hscar;
      camera.transition = holdf;
    }
    if (holdf == 30) {
      camera.mode = 1;
      camera.target = recording.hscar;
    }
    if (holdf > 30 && holdf < 60) {
      camera.mode = 3;
      camera.target = recording.hscar;
      camera.nextTarget = 0;
      camera.transition = holdf - 30;
    }
    if (holdf == 60) {
      camera.mode = 1;
      camera.target = recording.hcim;
    }
    if (holdf > 60 && holdf < 90) {
      camera.mode = 3;
      camera.target = recording.hcim;
      camera.nextTarget = recording.hscar;
      camera.transition = holdf - 60;
    }
    if (holdf == 90) {
      camera.mode = 1;
      camera.target = recording.hscar;
    }
    if (recording.fr > 228 && holdf < 30) {
      holdf++;
    }
    if (recording.fr > 328 && holdf < 60) {
      holdf++;
    }
    if (recording.fr > 400 && holdf < 90) {
      holdf++;
    }
    recording.onpausefr = false;
    if (holdf == 0 || holdf == 30 || holdf == 60 || holdf == 90) {
      recording.fr++;
      if (recording.fr == 430) {
        recording.fr = 0;
        holdf = 0;
        hrewindhreplay();
        cntreps++;
      }
    } else {
      recording.onpausefr = true;
    }
  }
  if (recording.htyp == 5) {
    drawcs(90, "Close Finish!  Almost got it!", 0, 32, 64, 1);
    if (holdf == 0) {
      camera.mode = 1;
      camera.target = recording.hcim;
    }
    if (holdf > 0 && holdf < 30) {
      camera.mode = 3;
      camera.target = recording.hcim;
      camera.nextTarget = recording.hscar;
      camera.transition = holdf;
    }
    if (holdf == 30) {
      camera.mode = 1;
      camera.target = recording.hscar;
    }
    if (holdf > 30 && holdf < 60) {
      camera.mode = 3;
      camera.target = recording.hscar;
      camera.nextTarget = 0;
      camera.transition = holdf - 30;
    }
    if (holdf == 60) {
      camera.mode = 1;
      camera.target = recording.hcim;
    }
    if (holdf > 60 && holdf < 90) {
      camera.mode = 3;
      camera.target = recording.hcim;
      camera.nextTarget = recording.hscar;
      camera.transition = holdf - 60;
    }
    if (holdf == 90) {
      camera.mode = 1;
      camera.target = recording.hscar;
    }
    if (holdf > 90 && holdf < 120) {
      camera.mode = 3;
      camera.target = recording.hscar;
      camera.nextTarget = 0;
      camera.transition = holdf - 90;
    }
    if (holdf == 120) {
      camera.mode = 1;
      camera.target = recording.hcim;
    }
    if (recording.fr > 128 && holdf < 30) {
      holdf++;
    }
    if (recording.fr > 228 && holdf < 60) {
      holdf++;
    }
    if (recording.fr > 328 && holdf < 90) {
      holdf++;
    }
    if (recording.fr > 400 && holdf < 120) {
      holdf++;
    }
    recording.onpausefr = false;
    if (
      holdf == 0 ||
      holdf == 30 ||
      holdf == 60 ||
      holdf == 90 ||
      holdf == 120
    ) {
      recording.fr++;
      if (recording.fr == 430) {
        recording.fr = 0;
        holdf = 0;
        hrewindhreplay();
        cntreps++;
      }
    } else {
      recording.onpausefr = true;
    }
  }
  if (cntreps == 2 && recording.fr == 427) {
    iniend();
    game.phase = PHASE.raceEnd;
  }
  if (enter == 1) {
    enter = 2;
    iniend();
    game.phase = PHASE.raceEnd;
  }
  if (
    drawbutton(
      1,
      view.width - 100 * view.scale - 30 * view.scaleX,
      view.height - 60 * view.scale - 30 * view.scaleY,
      170,
      60,
      "#019DFF",
      "#01BAFF",
      "#004A78",
      "#015777",
      0,
      "Skip ",
      20,
      0.7,
      btimg[1],
      0.7,
      false,
    ) ||
    (pointer.down && track.stage == 1 && game.unlocked == 1)
  ) {
    iniend();
    game.phase = PHASE.raceEnd;
  }
  if (recording.fr >= 428) {
    rd.globalAlpha = 0.7;
    rd.fillStyle = "#000000";
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
  }
}
var confr = 0;
var confl = -1;
var confg = 0;
var confc = 0;
var morgn = random.fx();
var unlcar = -1;
function iniend() {
  fredo = 0;
  ondud = Math.floor(random.fx() * 6);
  if (ondud == 6) {
    ondud = 5;
  }
  morgn = random.fx();
  unlcar = -1;
  switcnt = 0;
  if (winner && game.unlocked == track.stage && game.carCount != 1) {
    if (track.stage == 2) {
      unlcar = 11;
    }
    if (track.stage == 4) {
      unlcar = 12;
    }
    if (track.stage == 6) {
      unlcar = 13;
    }
    if (track.stage == 8) {
      unlcar = 14;
    }
    if (track.stage == 10) {
      unlcar = 15;
    }
    if (track.stage == 12) {
      unlcar = 16;
    }
    if (track.stage == 14) {
      unlcar = 17;
    }
    if (track.stage == 16) {
      unlcar = 18;
    }
    if (track.stage == 17) {
      confc = 0;
      confg = 0;
      confr = 0;
    }
    if (unlcar != -1) {
      morgn = 0.4 * random.fx();
    }
  }
}
function endgame() {
  rd.clearRect(0, 0, view.width, view.height);
  if (fredo == 76) {
    rd.globalAlpha = 0.1;
  }
  rd.save();
  rd.rotate((-15 + morgn * 25) * (Math.PI / 180));
  rd.drawImage(
    insano[ondud],
    110 * morgn - 60,
    200 * view.scaleY,
    274 * view.scale,
    341 * view.scale,
  );
  rd.letterSpacing = "1px";
  rd.font = "" + 40 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "left";
  rd.textBaseline = "middle";
  rd.strokeStyle = "#0A3C00";
  rd.lineWidth = 10 * view.scale;
  rd.strokeText(
    "THIS. IS. MADNESS !",
    110 * morgn - 60 + 274 * view.scale,
    200 * view.scaleY + 170 * view.scale,
  );
  rd.fillStyle = "#FEA700";
  rd.fillText(
    "THIS. IS. MADNESS !",
    110 * morgn - 60 + 274 * view.scale,
    200 * view.scaleY + 170 * view.scale,
  );
  rd.restore();
  rd.globalAlpha = 1;
  if (fredo != 76) {
    var r = Math.floor(128 - 128 * scene.tint[0]);
    if (r > 255) {
      r = 255;
    }
    if (r < 0) {
      r = 0;
    }
    var g = Math.floor(128 - 128 * scene.tint[1]);
    if (g > 255) {
      g = 255;
    }
    if (g < 0) {
      g = 0;
    }
    var b = Math.floor(128 - 128 * scene.tint[2]);
    if (b > 255) {
      b = 255;
    }
    if (b < 0) {
      b = 0;
    }
    var hsl = rgbToHsl(r, g, b);
    var rgb = hslToRgb(hsl[0], 0.4, 0.1);
    rd.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
    var alpb = fredo / 50;
    if (alpb > 0.9) {
      alpb = 0.9;
    }
    rd.globalAlpha = alpb;
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
  }
  if (fredo >= 50) {
    var contxt = "Congradulations!";
    if (!winner) {
      contxt = "Game Over";
    }
    rd.letterSpacing = "1px";
    rd.font = "" + 30 * (view.scaleY + view.scaleX) + "px junk";
    rd.textAlign = "center";
    rd.textBaseline = "middle";
    rd.strokeStyle = "#783800";
    rd.lineWidth = 10 * view.scale;
    rd.strokeText(contxt, 640 * view.scaleX, 100 * view.scaleY);
    var grd = rd.createLinearGradient(
      640 * view.scaleX,
      70 * view.scaleY,
      640 * view.scaleX,
      130 * view.scaleY,
    );
    grd.addColorStop(0, "#FF5B01");
    grd.addColorStop(1, "#FF9601");
    rd.fillStyle = grd;
    rd.fillText(contxt, 640 * view.scaleX, 100 * view.scaleY);
    rd.globalAlpha = 0.7;
    rd.letterSpacing = "1px";
    rd.font = "" + 18 * (view.scaleY + view.scaleX) + "px junk";
    rd.fillStyle = "#FFA627";
    if (winner) {
      rd.fillText(
        "You won at stage " + track.stage + "",
        640 * view.scaleX,
        190 * view.scaleY,
      );
    } else {
      rd.fillText(
        "You lost at stage " + track.stage + "",
        640 * view.scaleX,
        190 * view.scaleY,
      );
    }
    rd.fillStyle = "#FF5B01";
    rd.fillText(track.name, 640 * view.scaleX, 240 * view.scaleY);
    rd.globalAlpha = 1;
    if (winner && game.unlocked == track.stage && game.carCount != 1) {
      rd.letterSpacing = "1px";
      rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
      rd.fillStyle = "#94CA00";
      if (aflk) {
        rd.fillStyle = "#BCFA00";
        aflk = false;
      } else {
        aflk = true;
      }
      if (track.stage != 17) {
        var andcar = "";
        if (unlcar != -1) {
          andcar = " and " + carStats.names[unlcar] + "";
        }
        rd.fillText(
          "Stage " + (track.stage + 1) + "" + andcar + " is now unlocked!",
          640 * view.scaleX,
          340 * view.scaleY,
        );
      } else {
        rd.fillText(
          "Wooohooo you finished the game!",
          640 * view.scaleX,
          340 * view.scaleY,
        );
        rd.fillText(
          "You're Awesome! You're truly a MAD DRIVER!",
          640 * view.scaleX,
          410 * view.scaleY,
        );
        if (confc < 20) {
          if (confg == 0) {
            if (Math.floor(confr) <= 28) {
              rd.drawImage(
                confe[Math.floor(confr)],
                confl * 170 * view.scaleX,
                0,
                1280 * view.scaleX,
                720 * view.scaleY,
              );
              confr += 0.5;
            } else {
              confg = 30;
              confr = 0;
              if (confl == 1) {
                confl = -1;
              } else {
                confl = 1;
              }
              confc++;
            }
          } else {
            confg--;
          }
        }
      }
    }
    if (game.carCount == 1) {
      rd.letterSpacing = "1px";
      rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
      rd.fillStyle = "#94CA00";
      rd.fillText(
        "Practice game finished",
        640 * view.scaleX,
        340 * view.scaleY,
      );
    }
    if (winner && game.unlocked == track.stage && game.carCount != 1) {
      if (enter == 1) {
        stopStageMusic();
        afterend();
        enter = 2;
      }
      if (
        drawbutton(
          7,
          640 * view.scaleX,
          view.height - 60 * view.scale - 40 * view.scaleY,
          250,
          60,
          "#FF1301",
          "#FF8A01",
          "#780800",
          "#784100",
          0,
          "Continue ",
          20,
          0.8,
          btimg[1],
          0.8,
          false,
        )
      ) {
        stopStageMusic();
        afterend();
      }
    } else {
      switcnt++;
      if (switcnt == 30) {
        stopStageMusic();
        afterend();
      }
    }
  } else {
    fredo++;
    if (fredo == 50) {
      for (var c = 0; c < game.carCount; c++) {
        fixcar(c);
      }
      if (unlcar != -1) {
        fredo = 76;
        colorbgstforend();
        updateframe = true;
        carmy = -20;
        carup = 0;
        carms = 100;
        game.carTypes[0] = unlcar;
      }
    }
  }
}
function afterend() {
  if (winner && game.unlocked == track.stage && game.carCount != 1) {
    if (track.stage != 17) {
      game.unlocked++;
      track.stage = game.unlocked;
    } else {
      track.stage = Math.floor(3 + random.sim() * 13);
    }
  }
  if (stanza == 1) {
    reqload = 0;
    dataload = 500;
    datacnt = 2458;
    stanza = 2;
    onskip = true;
    game.phase = PHASE.loading;
  } else {
    fredo = 0;
    onskip = true;
    game.phase = PHASE.mainMenu;
  }
}
var lastsel = 0;
var handson = 0;
function drawcarselect() {
  rd.clearRect(0, 0, view.width, view.height);
  var lefy = (view.width - 1380 * view.scaleY) / 2;
  var rigy = lefy + 1380 * view.scaleY;
  if (lefy < 0) {
    lefy = 0;
    rigy = view.width;
  }
  rd.letterSpacing = "1px";
  rd.font = "" + 16 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "left";
  rd.textBaseline = "middle";
  rd.strokeStyle = "#0C0959";
  rd.lineWidth = 10 * view.scale;
  rd.strokeText("Select your Car", lefy + 20 * view.scale, 25 * view.scaleY);
  rd.fillStyle = "#8665FF";
  rd.fillText("Select your Car", lefy + 20 * view.scale, 25 * view.scaleY);
  if (flyout == 0) {
    rd.letterSpacing = "1px";
    rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
    rd.textAlign = "center";
    rd.textBaseline = "middle";
    rd.strokeStyle = "#001A78";
    rd.lineWidth = 10 * view.scale;
    rd.strokeText(
      carStats.names[game.carTypes[0]],
      640 * view.scaleX,
      120 * view.scaleY,
    );
    rd.fillStyle = "#C1EEFF";
    rd.fillText(
      carStats.names[game.carTypes[0]],
      640 * view.scaleX,
      120 * view.scaleY,
    );
    if (racers[0].u.right) {
      if (game.carTypes[0] != 18) {
        nextc = 1;
        flyout = 2;
      }
      racers[0].u.right = false;
    }
    if (racers[0].u.left) {
      if (game.carTypes[0] != 0) {
        nextc = -1;
        flyout = 2;
      }
      racers[0].u.left = false;
    }
    if (game.carTypes[0] != 0) {
      if (
        drawbutton(
          1,
          lefy + 120 * view.scale,
          430 * view.scaleY,
          140,
          47,
          "#4B00F6",
          "#CB81FF",
          "#0600F6",
          "#5700F6",
          3,
          " Prev",
          15,
          0.9,
          btimg[3],
          0.9,
          false,
        )
      ) {
        nextc = -1;
        flyout = 2;
      }
      if ((handson > 10 && handson < 20) || (handson > 30 && handson < 40)) {
        rd.drawImage(
          inst[10],
          lefy + 120 * view.scale,
          430 * view.scaleY + 30 * view.scale,
          56 * view.scale,
          62 * view.scale,
        );
      }
    }
    if (game.carTypes[0] != 18) {
      if (
        drawbutton(
          2,
          rigy - 120 * view.scale,
          430 * view.scaleY,
          140,
          47,
          "#4B00F6",
          "#CB81FF",
          "#0600F6",
          "#5700F6",
          0,
          "Next ",
          15,
          0.9,
          btimg[2],
          0.9,
          false,
        )
      ) {
        nextc = 1;
        flyout = 2;
      }
      if ((handson > 50 && handson < 60) || (handson > 70 && handson < 80)) {
        rd.drawImage(
          inst[10],
          rigy - 120 * view.scale,
          430 * view.scaleY + 30 * view.scale,
          56 * view.scale,
          62 * view.scale,
        );
      }
    }
    var clocked = 0;
    if (
      game.carTypes[0] >= 11 &&
      game.unlocked <= (game.carTypes[0] - 10) * 2
    ) {
      clocked = (game.carTypes[0] - 10) * 2;
    }
    if (!clocked && lastsel != game.carTypes[0]) {
      lastsel = game.carTypes[0];
    }
    if (!clocked) {
      rd.letterSpacing = "1px";
      rd.font = "" + 11 * (view.scaleY + view.scaleX) + "px junk";
      rd.textAlign = "right";
      rd.textBaseline = "middle";
      rd.strokeStyle = "#00284A";
      rd.lineWidth = 6 * view.scale;
      rd.strokeText("Top Speed", lefy + 180 * view.scale, 200 * view.scaleY);
      rd.fillStyle = "#A3D5FF";
      rd.fillText("Top Speed", lefy + 180 * view.scale, 200 * view.scaleY);
      var perci = (carStats.swits[game.carTypes[0]][2] - 22) / 9;
      if (perci < 0.2) {
        perci = 0.2;
      }
      drawcoolrect(
        lefy + 300 * view.scale,
        200 * view.scaleY - 7 * view.scale,
        200,
        20,
        "#FF1301",
        "#FFBA01",
        "#29C2F0",
        perci,
      );
      rd.strokeStyle = "#00284A";
      rd.lineWidth = 6 * view.scale;
      rd.strokeText(
        "Acceleration",
        lefy + 180 * view.scale,
        200 * view.scaleY + 40 * view.scale,
      );
      rd.fillStyle = "#A3D5FF";
      rd.fillText(
        "Acceleration",
        lefy + 180 * view.scale,
        200 * view.scaleY + 40 * view.scale,
      );
      perci =
        (carStats.acelf[game.carTypes[0]][1] *
          carStats.acelf[game.carTypes[0]][0] *
          carStats.acelf[game.carTypes[0]][2] *
          carStats.grip[game.carTypes[0]]) /
        0.77;
      if (perci > 1) {
        perci = 1;
      }
      drawcoolrect(
        lefy + 300 * view.scale,
        200 * view.scaleY - 7 * view.scale + 40 * view.scale,
        200,
        20,
        "#FF1301",
        "#FFBA01",
        "#29C2F0",
        perci,
      );
      rd.strokeStyle = "#00284A";
      rd.lineWidth = 6 * view.scale;
      rd.strokeText(
        "Handling",
        lefy + 180 * view.scale,
        200 * view.scaleY + 80 * view.scale,
      );
      rd.fillStyle = "#A3D5FF";
      rd.fillText(
        "Handling",
        lefy + 180 * view.scale,
        200 * view.scaleY + 80 * view.scale,
      );
      perci = carStats.dishandle[game.carTypes[0]];
      drawcoolrect(
        lefy + 300 * view.scale,
        200 * view.scaleY - 7 * view.scale + 80 * view.scale,
        200,
        20,
        "#FF1301",
        "#FFBA01",
        "#29C2F0",
        perci,
      );
      rd.strokeStyle = "#00284A";
      rd.lineWidth = 6 * view.scale;
      rd.strokeText("Stunts", rigy - 290 * view.scale, 200 * view.scaleY);
      rd.fillStyle = "#A3D5FF";
      rd.fillText("Stunts", rigy - 290 * view.scale, 200 * view.scaleY);
      perci =
        (carStats.airc[game.carTypes[0]] *
          10 *
          carStats.airs[game.carTypes[0]] *
          carStats.bounce[game.carTypes[0]] +
          28) /
        139;
      if (perci > 1) {
        perci = 1;
      }
      drawcoolrect(
        rigy - 170 * view.scale,
        200 * view.scaleY - 7 * view.scale,
        200,
        20,
        "#FF1301",
        "#FFBA01",
        "#29C2F0",
        perci,
      );
      rd.strokeStyle = "#00284A";
      rd.lineWidth = 6 * view.scale;
      rd.strokeText(
        "Strength",
        rigy - 290 * view.scale,
        200 * view.scaleY + 40 * view.scale,
      );
      rd.fillStyle = "#A3D5FF";
      rd.fillText(
        "Strength",
        rigy - 290 * view.scale,
        200 * view.scaleY + 40 * view.scale,
      );
      perci = (carStats.moment[game.carTypes[0]] + 0.5) / 2.6;
      if (perci > 1) {
        perci = 1;
      }
      drawcoolrect(
        rigy - 170 * view.scale,
        200 * view.scaleY - 7 * view.scale + 40 * view.scale,
        200,
        20,
        "#FF1301",
        "#FFBA01",
        "#29C2F0",
        perci,
      );
      rd.strokeStyle = "#00284A";
      rd.lineWidth = 6 * view.scale;
      rd.strokeText(
        "Endurance",
        rigy - 290 * view.scale,
        200 * view.scaleY + 80 * view.scale,
      );
      rd.fillStyle = "#A3D5FF";
      rd.fillText(
        "Endurance",
        rigy - 290 * view.scale,
        200 * view.scaleY + 80 * view.scale,
      );
      perci = carStats.outdam[game.carTypes[0]];
      drawcoolrect(
        rigy - 170 * view.scale,
        200 * view.scaleY - 7 * view.scale + 80 * view.scale,
        200,
        20,
        "#FF1301",
        "#FFBA01",
        "#29C2F0",
        perci,
      );
    } else {
      rd.letterSpacing = "1px";
      rd.font = "" + 17 * (view.scaleY + view.scaleX) + "px junk";
      rd.textAlign = "center";
      rd.textBaseline = "middle";
      rd.strokeStyle = "#00284A";
      rd.lineWidth = 10 * view.scale;
      rd.strokeText(
        "This car unlocks when  stage " + clocked + "  is completed!",
        640 * view.scaleX,
        200 * view.scaleY,
      );
      rd.fillStyle = "#A3D5FF";
      rd.fillText(
        "This car unlocks when  stage " + clocked + "  is completed!",
        640 * view.scaleX,
        200 * view.scaleY,
      );
    }
    if (clocked) {
      var xp = [
        640 * view.scaleX - 300 * view.scaleY - 3 * view.scaleY,
        640 * view.scaleX - 300 * view.scaleY - 3 * view.scaleY,
        640 * view.scaleX - 120 * view.scaleY - 3 * view.scaleY,
        640 * view.scaleX - 120 * view.scaleY - 3 * view.scaleY,
      ];
      var yp = [
        564 * view.scaleY,
        560 * view.scaleY + 108 * view.scaleY,
        600 * view.scaleY + 108 * view.scaleY,
        604 * view.scaleY,
      ];
      rd.fillStyle = "#21AEFF";
      rd.globalAlpha = 0.5;
      fillPolygon(xp, yp, 4);
      rd.globalAlpha = 1;
      rd.strokeStyle = "#002748";
      rd.lineWidth = 2 * view.scaleY;
      drawPolygon(xp, yp, 4);
      var xp = [
        640 * view.scaleX + 120 * view.scaleY - 3 * view.scaleY,
        640 * view.scaleX + 120 * view.scaleY - 3 * view.scaleY,
        640 * view.scaleX - 120 * view.scaleY - 3 * view.scaleY,
        640 * view.scaleX - 120 * view.scaleY - 3 * view.scaleY,
      ];
      var yp = [
        604 * view.scaleY,
        600 * view.scaleY + 108 * view.scaleY,
        600 * view.scaleY + 108 * view.scaleY,
        604 * view.scaleY,
      ];
      rd.fillStyle = "#21AEFF";
      rd.globalAlpha = 0.5;
      fillPolygon(xp, yp, 4);
      rd.globalAlpha = 1;
      rd.strokeStyle = "#002748";
      rd.lineWidth = 2 * view.scaleY;
      drawPolygon(xp, yp, 4);
      var xp = [
        640 * view.scaleX + 300 * view.scaleY - 3 * view.scaleY,
        640 * view.scaleX + 300 * view.scaleY - 3 * view.scaleY,
        640 * view.scaleX + 120 * view.scaleY - 3 * view.scaleY,
        640 * view.scaleX + 120 * view.scaleY - 3 * view.scaleY,
      ];
      var yp = [
        564 * view.scaleY,
        560 * view.scaleY + 108 * view.scaleY,
        600 * view.scaleY + 108 * view.scaleY,
        604 * view.scaleY,
      ];
      rd.fillStyle = "#21AEFF";
      rd.globalAlpha = 0.5;
      fillPolygon(xp, yp, 4);
      rd.globalAlpha = 1;
      rd.strokeStyle = "#002748";
      rd.lineWidth = 2 * view.scaleY;
      drawPolygon(xp, yp, 4);
      rd.drawImage(
        lbar,
        640 * view.scaleX - 300 * view.scaleY - 3 * view.scaleY,
        560 * view.scaleY,
        6 * view.scaleY,
        111 * view.scaleY,
      );
      rd.drawImage(
        lbar,
        640 * view.scaleX - 120 * view.scaleY - 3 * view.scaleY,
        600 * view.scaleY,
        6 * view.scaleY,
        111 * view.scaleY,
      );
      rd.drawImage(
        rbar,
        640 * view.scaleX + 120 * view.scaleY - 3 * view.scaleY,
        600 * view.scaleY,
        6 * view.scaleY,
        111 * view.scaleY,
      );
      rd.drawImage(
        rbar,
        640 * view.scaleX + 300 * view.scaleY - 3 * view.scaleY,
        560 * view.scaleY,
        6 * view.scaleY,
        111 * view.scaleY,
      );
      rd.drawImage(
        lckd,
        640 * view.scaleX - 29 * view.scaleY,
        619 * view.scaleY,
        58 * view.scaleY,
        72 * view.scaleY,
      );
    }
    if (!clocked) {
      if (
        drawbutton(
          3,
          rigy - 150 * view.scale,
          720 * view.scaleY - 100 * view.scale,
          200,
          70,
          "#0057E6",
          "#65EFFF",
          "#440078",
          "#2F00A8",
          0,
          "PLAY ",
          25,
          0.9,
          btimg[1],
          0.9,
          true,
        )
      ) {
        saveInfo("carsel", game.carTypes[0]);
        if (track.stage > game.unlocked) {
          track.stage = game.unlocked;
        }
        if (game.unlocked != 17 && game.mode == 1) {
          track.stage = game.unlocked;
          game.mode = 0;
        }
        stageloadtyp = 0;
        stageload = -1;
        game.phase = PHASE.stageLoading;
      }
      if (game.unlocked == 1) {
        if (handson != 167) {
          handson++;
          if (handson > 130) {
            handson = 90;
          }
        }
        if (
          drawbutton(
            5,
            640 * view.scaleX,
            720 * view.scaleY - 90 * view.scale,
            220,
            60,
            "#0057E6",
            "#65EFFF",
            "#440078",
            "#2F00A8",
            1,
            "Practice ",
            22,
            0.9,
            null,
            0,
            false,
          )
        ) {
          saveInfo("carsel", game.carTypes[0]);
          pauseMenuMusic();
          track.stage = 2;
          stageloadtyp = 2;
          stageload = -1;
          game.phase = PHASE.stageLoading;
          handson = 167;
        }
        if (
          (handson > 100 && handson < 110) ||
          (handson > 120 && handson < 130)
        ) {
          rd.drawImage(
            inst[10],
            640 * view.scaleX,
            720 * view.scaleY - 90 * view.scale + 25 * view.scale,
            56 * view.scale,
            62 * view.scale,
          );
        }
        if (enter == 1) {
          saveInfo("carsel", game.carTypes[0]);
          pauseMenuMusic();
          track.stage = 2;
          stageloadtyp = 2;
          stageload = -1;
          game.phase = PHASE.stageLoading;
          handson = 167;
        }
      } else {
        if (enter == 1) {
          saveInfo("carsel", game.carTypes[0]);
          if (track.stage > game.unlocked) {
            track.stage = game.unlocked;
          }
          if (game.unlocked != 17 && game.mode == 1) {
            track.stage = game.unlocked;
            game.mode = 0;
          }
          stageloadtyp = 0;
          stageload = -1;
          game.phase = PHASE.stageLoading;
        }
      }
    }
  }
  if (!flwg) {
    flw -= 0.03;
    if (flw < 0.5) {
      flw = 0.5;
      flwg = true;
    }
  } else {
    flw += 0.03;
    if (flw > 2) {
      flw = 2;
      flwg = false;
    }
  }
  if (!flhg) {
    flh -= 0.5;
    if (flh < 0.1) {
      flh = 0.1;
      flhg = true;
    }
  } else {
    flh += 0.5;
    if (flh > 2) {
      flh = 2;
      flhg = false;
    }
  }
  musictog();
}
var alipha = 0;
var bgsload = null;
var stageloadtyp = 0;
function stageloading() {
  rd.clearRect(0, 0, view.width, view.height);
  if (stageload == 0 && (updateframe || stageloadtyp == 2)) {
    stageload = 0;
    loadstage();
    if (!isEngineLoaded(game.carTypes[0])) {
      loadEngine(game.carTypes[0]);
    }
  }
  if (stageload == -1) {
    alipha = 0.2;
    stageload = 0;
  }
  if (stageloadtyp == 0 || stageloadtyp == 2) {
    rd.globalAlpha = alipha;
    rd.fillStyle = "#9FD3FF";
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
    alipha += 0.02;
    if (alipha > 0.4) {
      alipha = 0.4;
    }
    rd.letterSpacing = "1px";
    rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
    rd.textAlign = "center";
    rd.textBaseline = "middle";
    rd.strokeStyle = "#2D9FFF";
    rd.lineWidth = 10 * view.scale;
    if (stageloadtyp == 0) {
      rd.strokeText(
        "Loading Stage " + track.stage + "",
        640 * view.scaleX,
        330 * view.scaleY,
      );
    } else {
      rd.strokeText("Loading Stage...", 640 * view.scaleX, 330 * view.scaleY);
    }
    rd.fillStyle = "#C1E3FF";
    if (stageloadtyp == 0) {
      rd.fillText(
        "Loading Stage " + track.stage + "",
        640 * view.scaleX,
        330 * view.scaleY,
      );
    } else {
      rd.fillText("Loading Stage...", 640 * view.scaleX, 330 * view.scaleY);
    }
  }
  if (stageloadtyp == 1) {
    rd.drawImage(bgsload, 0, 0);
  }
  if (stageload == 2) {
    if (stageloadtyp != 2) {
      flkun = 0;
      flkpl = 0;
      hit = 4500;
      colorbgst();
      createbordo();
      ontip = false;
      if (hastip) {
        dudo = 0;
        ondud = 0;
      }
      game.phase = PHASE.stageSelect;
    } else {
      game.carCount = 1;
      pauseMenuMusic();
      playStageMusic(track.stage);
      game.phase = PHASE.race;
    }
  }
}
var ontip = false;
var xsp = [];
var ysp = [];
var flkun = 0;
var flkpl = 0;
function drawstageselect() {
  rd.clearRect(0, 0, view.width, view.height);
  if (flkun && !ontip) {
    rd.globalAlpha = 0.5;
    rd.fillStyle = "#9FD3FF";
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
    if (stageload != -1) {
      rd.letterSpacing = "1px";
      rd.font = "" + 22 * (view.scaleY + view.scaleX) + "px junk";
      rd.textAlign = "center";
      rd.textBaseline = "middle";
      rd.fillStyle = "#00284A";
      rd.fillText("Stage Locked", 640 * view.scaleX, 380 * view.scaleY);
      if (aflk || flkun > 10) {
        rd.drawImage(
          lckd,
          640 * view.scaleX - 29 * view.scaleY,
          250 * view.scaleY,
          58 * view.scaleY,
          72 * view.scaleY,
        );
      }
      if (aflk) {
        aflk = false;
      } else {
        aflk = true;
      }
      flkun++;
      if (flkun == 30) {
        flkun = 0;
        aflk = false;
      }
    } else {
      rd.letterSpacing = "1px";
      rd.font = "" + 22 * (view.scaleY + view.scaleX) + "px junk";
      rd.textAlign = "center";
      rd.textBaseline = "middle";
      rd.fillStyle = "#00284A";
      rd.fillText(
        "Loading Stage " + track.stage + "",
        640 * view.scaleX,
        330 * view.scaleY,
      );
    }
  }
  if (!ontip) {
    if (hastip && !flkun) {
      if (aflk) {
        aflk = false;
      } else {
        aflk = true;
      }
      if (dudo > 50) {
        if (aflk) {
          ondud = Math.floor(random.fx() * 6);
          if (ondud == 6) {
            ondud = 5;
          }
        }
      }
      dudo++;
      if (dudo >= 67) {
        dudo = 0;
      }
      rd.globalAlpha = 0.6;
      rd.drawImage(
        insano[ondud],
        70 * view.scaleX,
        720 * view.scaleY - 222 * view.scale,
        274 * view.scale * 0.8,
        341 * view.scale * 0.8,
      );
      rd.globalAlpha = 1;
      rd.globalAlpha = 0.5;
      rd.fillStyle = "#FFFFFF";
      floatythink(
        70 * view.scaleX + 207 * view.scale,
        720 * view.scaleY - 115 * view.scale,
        30 * view.scale,
        30 * view.scale,
        10 * view.scale,
      );
      floatythink(
        70 * view.scaleX + 247 * view.scale,
        720 * view.scaleY - 170 * view.scale,
        225 * view.scale,
        90 * view.scale,
        20 * view.scale,
      );
      rd.globalAlpha = 1;
    }
  }
  var r = Math.floor(128 - 128 * scene.tint[0]);
  if (r > 255) {
    r = 255;
  }
  if (r < 0) {
    r = 0;
  }
  var g = Math.floor(128 - 128 * scene.tint[1]);
  if (g > 255) {
    g = 255;
  }
  if (g < 0) {
    g = 0;
  }
  var b = Math.floor(128 - 128 * scene.tint[2]);
  if (b > 255) {
    b = 255;
  }
  if (b < 0) {
    b = 0;
  }
  var hsl = rgbToHsl(r, g, b);
  var rgb = hslToRgb(hsl[0], 1, 0.3);
  rd.strokeStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
  rd.lineWidth = 10 * view.scale;
  spdPolygon(xsp, ysp, 50);
  rgb = hslToRgb(hsl[0], 1, 0.4);
  rd.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
  spPolygon(0, 0, xsp, ysp, 0, 17, 1280, 0);
  spPolygon(1280, 0, xsp, ysp, 16, 26, 1280, 720);
  spPolygon(1280, 720, xsp, ysp, 25, 42, 0, 720);
  spPolygon(0, 720, xsp, ysp, 41, 51, 0, 0);
  if (!flkun) {
    rd.letterSpacing = "1px";
    rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
    rd.textAlign = "center";
    rd.textBaseline = "middle";
    rgb = hslToRgb(hsl[0], 1, 0.3);
    rd.strokeStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
    rd.lineWidth = 10 * view.scale;
    rd.strokeText(track.name, 640 * view.scaleX, 200 * view.scaleY);
    rgb = hslToRgb(hsl[0] + 0.05, 1, 0.9);
    rd.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
    rd.fillText(track.name, 640 * view.scaleX, 200 * view.scaleY);
    if (track.stage == 16 && !ontip) {
      rd.letterSpacing = "0px";
      rd.font = "" + 12 * (view.scaleY + view.scaleX) + "px verd";
      rd.textBaseline = "middle";
      rd.textAlign = "center";
      rgb = hslToRgb(hsl[0], 1, 0.3);
      rd.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
      rd.fillText(
        "( Guidance arrow is disabled in this stage... )",
        640 * view.scaleX,
        260 * view.scaleY,
      );
    }
    rd.letterSpacing = "1px";
    rd.font = "" + 22 * (view.scaleY + view.scaleX) + "px junk";
    rd.textAlign = "center";
    rd.textBaseline = "middle";
    rd.lineWidth = 10 * view.scale;
    if (track.stage != 17) {
      rd.strokeText(
        "Stage " + track.stage,
        640 * view.scaleX,
        120 * view.scaleY,
      );
    } else {
      rd.strokeText("Final Stage", 640 * view.scaleX, 120 * view.scaleY);
    }
    rgb = hslToRgb(hsl[0] - 0.05, 1, 0.6);
    rd.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
    if (track.stage != 17) {
      rd.fillText("Stage " + track.stage, 640 * view.scaleX, 120 * view.scaleY);
    } else {
      rd.fillText("Final Stage", 640 * view.scaleX, 120 * view.scaleY);
      loadconfe();
    }
    if (!ontip) {
      rgb = hslToRgb(hsl[0] - 0.05, 1, 0.5);
      var rgb2 = hslToRgb(hsl[0] + 0.05, 1, 0.6);
      var rgb3 = hslToRgb(hsl[0] - 0.05, 1, 0.2);
      var rgb4 = hslToRgb(hsl[0] + 0.05, 1, 0.2);
      if (racers[0].u.right) {
        if (track.stage < 17) {
          if (track.stage != game.unlocked) {
            track.stage++;
            stageload = -1;
            flkun = 1;
          } else {
            flkun = 1;
          }
        }
        racers[0].u.right = false;
      }
      if (racers[0].u.left) {
        if (track.stage > 1) {
          track.stage--;
          stageload = -1;
          flkun = 1;
        }
        racers[0].u.left = false;
      }
      if (
        drawbutton(
          9,
          210 * view.scale,
          130 * view.scaleY,
          150,
          56,
          "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
          "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
          "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
          "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
          3,
          " Back",
          20,
          0.7,
          btimg[5],
          0.7,
          false,
        )
      ) {
        scene.tint = [0, -0.05, 0.6];
        var fogc = [0, 0, 0];
        var lvx = 0,
          lvy = 0.866,
          lvz = -0.5;
        var fogdist = 10700;
        setWorld(scene.tint, fogc, lvx, lvy, lvz, fogdist);
        game.phase = PHASE.carSelect;
        rd.fillStyle = "#FFFFFF";
        rd.fillRect(0, 0, view.width, view.height);
      }
      if (track.stage > 1) {
        if (
          drawbutton(
            3,
            190 * view.scale,
            360 * view.scaleY,
            140,
            47,
            "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
            "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
            "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
            "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
            3,
            " Prev",
            15,
            0.9,
            btimg[3],
            0.9,
            false,
          )
        ) {
          track.stage--;
          stageload = -1;
          flkun = 1;
        }
      }
      if (track.stage < 17) {
        if (
          drawbutton(
            2,
            view.width - 190 * view.scale,
            360 * view.scaleY,
            140,
            47,
            "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
            "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
            "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
            "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
            0,
            "Next ",
            15,
            0.9,
            btimg[2],
            0.9,
            false,
          )
        ) {
          if (track.stage != game.unlocked) {
            track.stage++;
            stageload = -1;
            flkun = 1;
          } else {
            flkun = 1;
          }
        }
      }
      if (!flkun) {
        if (hastip) {
          if (
            drawbutton(
              6,
              70 * view.scaleX + 357 * view.scale,
              720 * view.scaleY - 157 * view.scale,
              120,
              60,
              "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
              "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
              "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
              "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
              1,
              "TIP ",
              22,
              0.9,
              null,
              0,
              false,
            )
          ) {
            ontip = true;
            dudo = 0;
          }
        } else {
          if (track.stage == 1 || track.stage == 2) {
            if (
              drawbutton(
                8,
                view.width - 510 * view.scale,
                720 * view.scaleY - 180 * view.scale,
                220,
                60,
                "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
                "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
                "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
                "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
                1,
                "Practice ",
                22,
                0.9,
                null,
                0,
                false,
              )
            ) {
              game.carCount = 1;
              pauseMenuMusic();
              startflash();
            }
          }
        }
      }
      if (track.stage != game.unlocked && track.stage >= 3) {
        if (
          drawbutton(
            10,
            view.width - 550 * view.scale,
            720 * view.scaleY - 190 * view.scale,
            300,
            70,
            "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
            "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
            "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
            "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
            0,
            "PLAY SWITCH ",
            20,
            0.9,
            btimg[1],
            0.9,
            true,
          )
        ) {
          game.mode = 1;
          pauseMenuMusic();
          startflash();
        }
      }
      if (flkpl > 30) {
        r = Math.floor(128 + 128 * scene.tint[0]);
        if (r > 255) {
          r = 255;
        }
        if (r < 0) {
          r = 0;
        }
        g = Math.floor(128 + 128 * scene.tint[1]);
        if (g > 255) {
          g = 255;
        }
        if (g < 0) {
          g = 0;
        }
        b = Math.floor(128 + 128 * scene.tint[2]);
        if (b > 255) {
          b = 255;
        }
        if (b < 0) {
          b = 0;
        }
        hsl = rgbToHsl(r, g, b);
      }
      flkpl++;
      if (flkpl == 40) {
        flkpl = 0;
      }
      rgb = hslToRgb(hsl[0] - 0.05, 1, 0.5);
      rgb2 = hslToRgb(hsl[0] + 0.05, 1, 0.6);
      rgb3 = hslToRgb(hsl[0] - 0.05, 1, 0.2);
      rgb4 = hslToRgb(hsl[0] + 0.05, 1, 0.2);
      var bbtn = 220;
      if (track.stage != game.unlocked && track.stage >= 3) {
        bbtn = 740;
      }
      if (
        drawbutton(
          1,
          view.width - 220 * view.scale,
          720 * view.scaleY - 190 * view.scale,
          200,
          70,
          "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
          "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
          "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
          "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
          0,
          "PLAY ",
          25,
          0.9,
          btimg[1],
          0.9,
          true,
        )
      ) {
        game.mode = 0;
        pauseMenuMusic();
        startflash();
      }
      if (enter == 1) {
        game.mode = 0;
        pauseMenuMusic();
        startflash();
        enter = 2;
      }
      if (!flwg) {
        flw -= 0.03;
        if (flw < 0.5) {
          flw = 0.5;
          flwg = true;
        }
      } else {
        flw += 0.03;
        if (flw > 2) {
          flw = 2;
          flwg = false;
        }
      }
      if (!flhg) {
        flh -= 0.5;
        if (flh < 0.1) {
          flh = 0.1;
          flhg = true;
        }
      } else {
        flh += 0.5;
        if (flh > 2) {
          flh = 2;
          flhg = false;
        }
      }
    } else {
      var fm = view.scaleX;
      if (view.scaleX / view.scaleY > 1.2) {
        fm *= 1.2 / (view.scaleX / view.scaleY);
      }
      var topo = 260 * view.scaleY;
      if (aflk) {
        aflk = false;
      } else {
        aflk = true;
      }
      if (dudo < 200) {
        if (aflk) {
          ondud = Math.floor(random.fx() * 6);
          if (ondud == 6) {
            ondud = 5;
          }
        }
        dudo++;
      } else {
        ondud = 2;
      }
      rd.drawImage(
        insano[ondud],
        10 * fm,
        topo,
        274 * fm * 0.7,
        341 * fm * 0.7,
      );
      rd.fillStyle = "#FFFFFF";
      rd.globalAlpha = 0.6;
      floatytalk(200 * fm, topo, 990 * fm, 300 * fm, 20 * fm);
      rd.globalAlpha = 1;
      rd.letterSpacing = "0px";
      rd.font = "" + 30 * fm + "px verd";
      rd.textBaseline = "middle";
      rd.textAlign = "left";
      rd.fillStyle = "#002748";
      for (var i = 0; i < hastip; i++) {
        rd.fillText(tip[i], 200 * fm + 20 * fm, topo + (36 + 50 * i) * fm);
      }
      rgb = hslToRgb(hsl[0] - 0.05, 1, 0.5);
      var rgb2 = hslToRgb(hsl[0] + 0.05, 1, 0.6);
      var rgb3 = hslToRgb(hsl[0] - 0.05, 1, 0.2);
      var rgb4 = hslToRgb(hsl[0] + 0.05, 1, 0.2);
      if (
        drawbutton(
          6,
          1140 * fm - 80 * view.scale,
          topo + 210 * fm,
          160,
          60,
          "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
          "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
          "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
          "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
          0,
          "Okay ",
          21,
          0.9,
          btimg[1],
          0.9,
          false,
        )
      ) {
        ontip = false;
        dudo = 0;
      }
    }
  } else {
    if (stageload == -1) {
      bgsload = new Image();
      bgsload.src = canvas2D.toDataURL("image/png");
      stageloadtyp = 1;
      game.phase = PHASE.stageLoading;
    }
  }
  musictog();
}
function startflash() {
  cntspark = 2;
  game.phase = PHASE.startFlash;
}
function aftersparkstart() {
  playStageMusic(track.stage);
  setWorld(scene.tint, fogc, lvx, lvy, lvz, fogdist);
  if (game.mode == 1) {
    for (var c = 1; c < game.carCount; c++) {
      if (!isEngineLoaded(game.carTypes[c])) {
        loadEngine(game.carTypes[c]);
      }
    }
    track.nlaps = 1;
  }
  updateframe = false;
  game.phase = PHASE.race;
}
function spPolygon(stx, sty, xd, yd, fm, to, enx, eny) {
  rd.beginPath();
  rd.moveTo(stx * view.scaleX, sty * view.scaleY);
  for (var i = fm; i < to; i++) {
    rd.lineTo(xd[i] * view.scaleX, yd[i] * view.scaleY);
  }
  rd.lineTo(enx * view.scaleX, eny * view.scaleY);
  rd.closePath();
  rd.fill();
}
function spdPolygon(xd, yd, nd) {
  rd.beginPath();
  rd.moveTo(xd[0] * view.scaleX, yd[0] * view.scaleY);
  for (var i = 1; i < nd; i++) {
    rd.lineTo(xd[i] * view.scaleX, yd[i] * view.scaleY);
  }
  rd.closePath();
  rd.stroke();
}
function musictog() {
  onycl = oncla(
    4,
    view.width - 62 * view.scale,
    4 * view.scale,
    58 * view.scale,
    42 * view.scale,
  );
  if (onycl == 1) {
    rd.globalAlpha = 0.7;
  }
  if (onycl == 2) {
    if (!audio.muteMusic) {
      audio.muteMusic = true;
    } else {
      audio.muteMusic = false;
    }
  }
  if (!audio.muteMusic) {
    onycl = 4;
  } else {
    onycl = 5;
  }
  rd.drawImage(
    muimg[onycl],
    view.width - 62 * view.scale,
    4 * view.scale,
    58 * view.scale,
    42 * view.scale,
  );
  rd.globalAlpha = 1;
}
function arrow(pnt, misdcp, pntcar) {
  var xp = [];
  var yp = [];
  var zp = [];
  var cx = 0;
  var cy = -315;
  var cz = 700;
  for (var i = 0; i < 7; i++) {
    yp[i] = cy;
  }
  xp[0] = cx;
  zp[0] = cz + 110;
  xp[1] = cx - 35;
  zp[1] = cz + 50;
  xp[2] = cx - 10;
  zp[2] = cz + 50;
  xp[3] = cx - 15;
  zp[3] = cz - 50;
  xp[4] = cx + 15;
  zp[4] = cz - 50;
  xp[5] = cx + 10;
  zp[5] = cz + 50;
  xp[6] = cx + 35;
  zp[6] = cz + 50;
  var an = 0;
  if (!pntcar) {
    var ad = 180;
    if (track.x[pnt] - car[game.player].x > 0) {
      ad = 0;
    }
    an = -(
      90 +
      ad +
      Math.atan(
        (track.z[pnt] - car[game.player].z) /
          (track.x[pnt] - car[game.player].x),
      ) /
        0.017453292519943295
    );
  } else {
    findonscreen();
    var pnti = 0;
    var clospy = -1;
    var gotons = false;
    for (var i = 0; i < game.carCount; i++) {
      if (i != game.player) {
        var pycar = pyo(
          car[game.player].x / 10,
          car[i].x / 10,
          car[game.player].z / 10,
          car[i].z / 10,
        );
        if (pycar < clospy || clospy == -1) {
          if (!gotons || onscreen[i]) {
            if (track.dested[i] == 0) {
              pnti = i;
              clospy = pycar;
              if (onscreen[i]) {
                gotons = true;
              }
            }
          }
        }
      }
    }
    var ad = 180;
    if (car[pnti].x - car[game.player].x > 0) {
      ad = 0;
    }
    an = -(
      90 +
      ad +
      Math.atan(
        (car[pnti].z - car[game.player].z) / (car[pnti].x - car[game.player].x),
      ) /
        0.017453292519943295
    );
    var stspace = "";
    for (var i = 0; i < carStats.names[car[pnti].typ].length; i++) {
      stspace += "  ";
    }
    drawcs(16, "[" + stspace + "]", 76, 67, 240, 1);
    drawcs(18, carStats.names[car[pnti].typ], 0, 0, 0, 1);
  }
  an += camera.yaw;
  while (an < 0) {
    an += 360;
  }
  while (an > 180) {
    an -= 360;
  }
  if (!pntcar) {
    if (an > 130) {
      an = 130;
    }
    if (an < -130) {
      an = -130;
    }
  } else {
    if (an > 100) {
      an = 100;
    }
    if (an < -100) {
      an = -100;
    }
  }
  if (Math.abs(ana - an) < 180) {
    if (Math.abs(ana - an) < 10) {
      ana = an;
    } else {
      if (ana < an) {
        ana += 10;
      } else {
        ana -= 10;
      }
    }
  } else {
    if (an < 0) {
      ana += 15;
      if (ana > 180) {
        ana -= 360;
      }
    }
    if (an > 0) {
      ana -= 15;
      if (ana < -180) {
        ana += 360;
      }
    }
  }
  rotate(xp, zp, cx, cz, ana, 7);
  an = Math.abs(ana);
  if (!pntcar) {
    if (an > 7 || misdcp > 0 || misdcp == -2 || cntan != 0) {
      for (var i = 0; i < 7; i++) {
        xp[i] = xs(xp[i], zp[i]) * 1.6 * view.scale;
        yp[i] = ys(yp[i], zp[i]) * 1.6 * view.scale;
        xp[i] += 640 * view.scaleX;
        yp[i] += (360 + view.widescreenShift) * view.scaleY;
      }
      var r = 190;
      var g = 255;
      var b = 0;
      if (misdcp <= 0) {
        if (an <= 45 && misdcp != -2 && cntan == 0) {
          rd.globalAlpha = an / 45;
        }
        if (an >= 90) {
          var tr = 255;
          r = (r * (140 - an) + tr * (an - 90)) / 50;
          if (r > 255) {
            r = 255;
          }
        }
      } else {
        if (flk) {
          r = 255;
          flk = false;
        } else {
          r = 255;
          g = 220;
          flk = true;
        }
      }
      rd.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
      fillPolygon(xp, yp, 7);
      rd.globalAlpha = 1;
      r = 115;
      g = 170;
      b = 0;
      if (misdcp <= 0) {
        if (an <= 45 && misdcp != -2 && cntan == 0) {
          rd.globalAlpha = an / 45;
        }
      } else {
        if (flk) {
          r = 255;
          g = 0;
        }
      }
      rd.strokeStyle = "rgb(" + r + "," + g + "," + b + ")";
      rd.lineWidth = 2.6 * view.scale;
      drawPolygon(xp, yp, 7);
      rd.globalAlpha = 1;
    }
  } else {
    for (var i = 0; i < 7; i++) {
      xp[i] = xs(xp[i], zp[i]) * 1.6 * view.scale;
      yp[i] = ys(yp[i], zp[i]) * 1.6 * view.scale;
      xp[i] += 640 * view.scaleX;
      yp[i] += (360 + view.widescreenShift) * view.scaleY;
    }
    var r = 159;
    var g = 207;
    var b = 255;
    rd.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
    fillPolygon(xp, yp, 7);
    r = 120;
    g = 114;
    b = 255;
    rd.strokeStyle = "rgb(" + r + "," + g + "," + b + ")";
    rd.lineWidth = 2.6 * view.scale;
    drawPolygon(xp, yp, 7);
  }
}
var onscreen = [];
function findonscreen() {
  for (var i = 0; i < game.carCount; i++) {
    onscreen[i] = false;
    if (i != game.player) {
      var isinfront = false;
      if (
        Math.abs(car[game.player].mat[8]) > Math.abs(car[game.player].mat[9]) &&
        Math.abs(car[game.player].mat[8]) > Math.abs(car[game.player].mat[10])
      ) {
        if (car[game.player].mat[8] > 0) {
          if (car[i].x > car[game.player].x) {
            isinfront = true;
          }
        } else {
          if (car[i].x < car[game.player].x) {
            isinfront = true;
          }
        }
      }
      if (
        Math.abs(car[game.player].mat[9]) > Math.abs(car[game.player].mat[8]) &&
        Math.abs(car[game.player].mat[9]) > Math.abs(car[game.player].mat[10])
      ) {
        if (car[game.player].mat[9] > 0) {
          if (car[i].y > car[game.player].y) {
            isinfront = true;
          }
        } else {
          if (car[i].y < car[game.player].y) {
            isinfront = true;
          }
        }
      }
      if (
        Math.abs(car[game.player].mat[10]) >
          Math.abs(car[game.player].mat[8]) &&
        Math.abs(car[game.player].mat[10]) > Math.abs(car[game.player].mat[9])
      ) {
        if (car[game.player].mat[10] > 0) {
          if (car[i].z > car[game.player].z) {
            isinfront = true;
          }
        } else {
          if (car[i].z < car[game.player].z) {
            isinfront = true;
          }
        }
      }
      if (isinfront) {
        var onscpos = getonscreen(camera.matrix, car[i]);
        if (
          onscpos[0] > -(15 * view.scaleX) &&
          onscpos[0] < view.width + 15 * view.scaleX
        ) {
          onscreen[i] = true;
        }
      }
    }
  }
}
function fillPolygon(xd, yd, nd) {
  rd.beginPath();
  rd.moveTo(xd[0], yd[0]);
  for (var i = 1; i < nd; i++) {
    rd.lineTo(xd[i], yd[i]);
  }
  rd.closePath();
  rd.fill();
}
function drawPolygon(xd, yd, nd) {
  rd.beginPath();
  rd.moveTo(xd[0], yd[0]);
  for (var i = 1; i < nd; i++) {
    rd.lineTo(xd[i], yd[i]);
  }
  rd.closePath();
  rd.stroke();
}
function xs(x, z) {
  return ((z - 400) * -x) / z + x;
}
function ys(y, z) {
  return ((z - 400) * -y) / z + y;
}
function drawcs(y, cs, r, g, b, typ) {
  rd.letterSpacing = "0px";
  rd.font = "" + 11 * (view.scaleY + view.scaleX) + "px verd";
  if (typ == 1 || typ == 2) {
    rd.letterSpacing = "1px";
    rd.font = "" + 13 * (view.scaleY + view.scaleX) + "px junk";
  }
  if (typ == 3) {
    rd.letterSpacing = "1px";
    rd.font = "" + 24 * (view.scaleY + view.scaleX) + "px junk";
  }
  if (typ == 4) {
    rd.letterSpacing = "1px";
    rd.font = "" + 17 * (view.scaleY + view.scaleX) + "px junk";
  }
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  rd.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
  if (typ == 2) {
    rd.globalAlpha = 0.67;
  }
  rd.fillText(cs, 640 * view.scaleX, y * view.scaleY);
  if (typ == 2) {
    rd.globalAlpha = 1;
  }
}
function drawbar(xb, yb, cb1, cb2, cbf, fct) {
  rd.fillStyle = cbf;
  rd.fillRect(
    xb + 7 * view.scale,
    yb + 6 * view.scale,
    166 * fct * view.scale,
    18 * view.scale,
  );
  var grd = rd.createLinearGradient(xb, yb, xb, yb + 30 * view.scale);
  grd.addColorStop(0, cb1);
  grd.addColorStop(1, cb2);
  rd.fillStyle = grd;
  rd.beginPath();
  rd.moveTo(xb, yb);
  rd.lineTo(xb - 9 * view.scale, yb + 10 * view.scale);
  rd.lineTo(xb - 1.5 * view.scale, yb + 27 * view.scale);
  rd.lineTo(xb + 10 * view.scale, yb + 30 * view.scale);
  rd.lineTo(xb + 92 * view.scale, yb + 30 * view.scale);
  rd.lineTo(xb + 92 * view.scale, yb + 24 * view.scale);
  rd.lineTo(xb + 7 * view.scale, yb + 24 * view.scale);
  rd.lineTo(xb + 7 * view.scale, yb + 6 * view.scale);
  rd.lineTo(xb + 92 * view.scale, yb + 6 * view.scale);
  rd.lineTo(xb + 92 * view.scale, yb);
  rd.closePath();
  rd.fill();
  rd.beginPath();
  rd.moveTo(xb + 180 * view.scale, yb + 30 * view.scale);
  rd.lineTo(xb + 189 * view.scale, yb + 20 * view.scale);
  rd.lineTo(xb + 181.5 * view.scale, yb + 3 * view.scale);
  rd.lineTo(xb + 170 * view.scale, yb);
  rd.lineTo(xb + 90 * view.scale, yb);
  rd.lineTo(xb + 90 * view.scale, yb + 6 * view.scale);
  rd.lineTo(xb + 173 * view.scale, yb + 6 * view.scale);
  rd.lineTo(xb + 173 * view.scale, yb + 24 * view.scale);
  rd.lineTo(xb + 90 * view.scale, yb + 24 * view.scale);
  rd.lineTo(xb + 90 * view.scale, yb + 30 * view.scale);
  rd.closePath();
  rd.fill();
}
var wasonit = [0, 0, 0, 0];
var keyonx = 0;
function drawbutton(
  onx,
  xb,
  yb,
  wb,
  hb,
  cb1,
  cb2,
  cb3,
  cb4,
  typ,
  txt,
  fz,
  opa,
  img,
  iopa,
  flak,
) {
  wb = wb * view.scale;
  hb = hb * view.scale;
  var xbd = xb - wb * 0.5 + 5 * view.scale;
  var ybd = yb + 4 * view.scale;
  var clknow = false;
  var hasonx = false;
  var mnms = pointer.count;
  if (mnms < 1) {
    mnms = 1;
  }
  for (var i = 0; i < mnms; i++) {
    if (
      pointer.x[i] > xbd - hb * 0.3 &&
      pointer.x[i] < xbd + wb + hb * 0.3 &&
      pointer.y[i] > ybd &&
      pointer.y[i] < ybd + hb
    ) {
      if (pointer.down) {
        wasonit[i] = onx;
        hasonx = true;
      } else {
        if (wasonit[i] == onx) {
          clknow = true;
          wasonit[i] = 0;
        }
      }
    } else {
      if (wasonit[i] == onx) {
        wasonit[i] = 0;
      }
    }
  }
  if (keyonx == onx) {
    hasonx = true;
  }
  var flwu = 2;
  var flhu = 0.5;
  if (flak) {
    flwu = flw;
    flhu = flh;
  }
  if (!hasonx) {
    var grd = rd.createLinearGradient(
      xbd,
      ybd - hb * 0.5,
      xbd + wb * 0.5 * flwu,
      ybd - hb * 0.5 + hb * flhu,
    );
    grd.addColorStop(0, cb3);
    grd.addColorStop(1, cb4);
    rd.fillStyle = grd;
    rd.beginPath();
    rd.moveTo(xbd, ybd);
    rd.lineTo(xbd - hb * 0.3, ybd + hb * 0.3334);
    rd.lineTo(xbd - hb * 0.05, ybd + hb * 0.9);
    rd.lineTo(xbd + hb * 0.1, ybd + hb);
    rd.lineTo(xbd + wb, ybd + hb);
    rd.lineTo(xbd + wb + hb * 0.3, ybd + hb * 0.6667);
    rd.lineTo(xbd + wb + hb * 0.05, ybd + hb * 0.1);
    rd.lineTo(xbd + wb - hb * 0.1, ybd);
    rd.closePath();
    rd.fill();
    xbd = xb - wb * 0.5;
    ybd = yb;
  }
  var grd = rd.createLinearGradient(
    xbd,
    ybd - hb * 0.5,
    xbd + wb * 0.5 * flwu,
    ybd - hb * 0.5 + hb * flhu,
  );
  grd.addColorStop(0, cb1);
  grd.addColorStop(1, cb2);
  rd.fillStyle = grd;
  rd.beginPath();
  rd.moveTo(xbd, ybd);
  rd.lineTo(xbd - hb * 0.3, ybd + hb * 0.3334);
  rd.lineTo(xbd - hb * 0.05, ybd + hb * 0.9);
  rd.lineTo(xbd + hb * 0.1, ybd + hb);
  rd.lineTo(xbd + wb, ybd + hb);
  rd.lineTo(xbd + wb + hb * 0.3, ybd + hb * 0.6667);
  rd.lineTo(xbd + wb + hb * 0.05, ybd + hb * 0.1);
  rd.lineTo(xbd + wb - hb * 0.1, ybd);
  rd.closePath();
  rd.fill();
  var wti = 0;
  if (typ == 0 || typ == 3) {
    rd.font = "" + fz * (view.scaleY + view.scaleX) + "px junk";
    rd.letterSpacing = "1px";
    wti =
      rd.measureText(txt).width +
      10 * view.scale +
      img.width * view.scale * interfaceResolution;
  }
  if (typ == 1) {
    rd.font = "" + fz * (view.scaleY + view.scaleX) + "px junk";
    rd.letterSpacing = "1px";
    wti = rd.measureText(txt).width;
  }
  if (typ == 2) {
    wti = img.width * view.scale * interfaceResolution;
  }
  if (typ == 0 || typ == 1) {
    rd.textBaseline = "middle";
    rd.textAlign = "left";
    rd.fillStyle = "#000000";
    rd.globalAlpha = opa;
    var ydf = 0;
    if (isFirefox) {
      ydf = fz * view.scale * 0.35;
    }
    rd.fillText(
      txt,
      xbd + wb * 0.5 - wti * 0.5 + fz * view.scale * 0.3,
      ybd + hb * 0.5 - fz * view.scale * 0.25 + ydf,
    );
    rd.globalAlpha = 1;
  }
  if (typ == 0 || typ == 2) {
    rd.globalAlpha = iopa;
    rd.drawImage(
      img,
      xbd + wb * 0.5 + wti * 0.5 - img.width * view.scale * interfaceResolution,
      ybd + hb * 0.5 - img.height * view.scale * 0.5 * interfaceResolution,
      img.width * view.scale * interfaceResolution,
      img.height * view.scale * interfaceResolution,
    );
    rd.globalAlpha = 1;
  }
  if (typ == 3) {
    rd.globalAlpha = iopa;
    var subft = 0;
    if (txt == "Time" || txt == "Rewind Time") {
      subft = 7 * view.scale;
    }
    rd.drawImage(
      img,
      xbd + wb * 0.5 - wti * 0.5,
      ybd +
        hb * 0.5 -
        img.height * view.scale * 0.5 * interfaceResolution -
        subft,
      img.width * view.scale * interfaceResolution,
      img.height * view.scale * interfaceResolution,
    );
    rd.globalAlpha = 1;
    rd.textBaseline = "middle";
    rd.textAlign = "left";
    rd.fillStyle = "#000000";
    rd.globalAlpha = opa;
    var ydf = 0;
    if (isFirefox) {
      ydf = fz * view.scale * 0.35;
    }
    rd.fillText(
      txt,
      xbd +
        wb * 0.5 +
        wti * 0.5 -
        rd.measureText(txt).width -
        fz * view.scale * 0.3,
      ybd + hb * 0.5 - fz * view.scale * 0.25 + ydf,
    );
    rd.globalAlpha = 1;
  }
  return clknow;
}
function oncla(onx, xa, ya, wa, ha) {
  var oncl = 0;
  var mnms = pointer.count;
  if (mnms < 1) {
    mnms = 1;
  }
  for (var i = 0; i < mnms; i++) {
    if (
      pointer.x[i] > xa &&
      pointer.x[i] < xa + wa &&
      pointer.y[i] > ya &&
      pointer.y[i] < ya + ha
    ) {
      if (pointer.down) {
        wasonit[i] = onx;
        oncl = 1;
      } else {
        if (wasonit[i] == onx) {
          oncl = 2;
          wasonit[i] = 0;
        }
      }
    } else {
      if (wasonit[i] == onx) {
        wasonit[i] = 0;
      }
    }
  }
  return oncl;
}
function drawcoolrect(xb, yb, wb, hb, cb1, cb2, cbs, per) {
  wb = wb * view.scale;
  hb = hb * view.scale;
  var xbd = xb - wb * 0.5;
  var ybd = yb;
  var grd = rd.createLinearGradient(
    xbd,
    ybd - hb * 0.5,
    xbd + wb,
    ybd + hb * 0.5,
  );
  grd.addColorStop(0, cb1);
  grd.addColorStop(1, cb2);
  rd.fillStyle = grd;
  rd.beginPath();
  rd.moveTo(xbd, ybd);
  rd.lineTo(xbd - hb * 0.3, ybd + hb * 0.3334);
  rd.lineTo(xbd - hb * 0.05, ybd + hb * 0.9);
  rd.lineTo(xbd + hb * 0.1, ybd + hb);
  rd.lineTo(xbd + wb * per, ybd + hb);
  rd.lineTo(xbd + wb * per + hb * 0.3, ybd + hb * 0.6667);
  rd.lineTo(xbd + wb * per + hb * 0.05, ybd + hb * 0.1);
  rd.lineTo(xbd + wb * per - hb * 0.1, ybd);
  rd.closePath();
  rd.fill();
  rd.lineWidth = 3 * view.scale;
  rd.strokeStyle = cbs;
  rd.beginPath();
  rd.moveTo(xbd, ybd);
  rd.lineTo(xbd - hb * 0.3, ybd + hb * 0.3334);
  rd.lineTo(xbd - hb * 0.05, ybd + hb * 0.9);
  rd.lineTo(xbd + hb * 0.1, ybd + hb);
  rd.lineTo(xbd + wb, ybd + hb);
  rd.lineTo(xbd + wb + hb * 0.3, ybd + hb * 0.6667);
  rd.lineTo(xbd + wb + hb * 0.05, ybd + hb * 0.1);
  rd.lineTo(xbd + wb - hb * 0.1, ybd);
  rd.closePath();
  rd.stroke();
}
function createbordo() {
  for (var i = 0; i < 16; i++) {
    xsp[i] = 50 + i * 73.75 + random.fx() * 60 - 30;
    ysp[i] = 50 + random.fx() * 30 - 15;
  }
  var cntout = 0;
  for (var i = 0; i < 14; i++) {
    if (
      cntout == 0 &&
      Math.abs(ysp[i] - ysp[i + 1]) < 7 &&
      Math.abs(ysp[i] - ysp[i + 2]) < 7 &&
      (xsp[i + 1] < 460 || xsp[i + 1] > 820)
    ) {
      if (random.fx() > random.fx() || xsp[i + 1] > 820) {
        ysp[i + 1] += 30 + random.fx() * 30;
        xsp[i] = (xsp[i + 1] * 5 + xsp[i]) / 6;
        xsp[i + 2] = (xsp[i + 1] * 5 + xsp[i + 2]) / 6;
      }
      cntout = 3;
    }
    if (cntout != 0) {
      cntout--;
    }
  }
  for (var i = 16; i < 25; i++) {
    xsp[i] = 1230 + random.fx() * 30 - 15;
    ysp[i] = 50 + (i - 16) * 68.88 + random.fx() * 60 - 30;
  }
  cntout = 0;
  for (var i = 16; i < 23; i++) {
    if (
      cntout == 0 &&
      Math.abs(xsp[i] - xsp[i + 1]) < 7 &&
      Math.abs(xsp[i] - xsp[i + 2]) < 7 &&
      ysp[i + 1] < 330
    ) {
      xsp[i + 1] -= 30 + random.fx() * 30;
      ysp[i] = (ysp[i + 1] * 5 + ysp[i]) / 6;
      ysp[i + 2] = (ysp[i + 1] * 5 + ysp[i + 2]) / 6;
      cntout = 10;
    }
    if (cntout != 0) {
      cntout--;
    }
  }
  for (var i = 25; i < 41; i++) {
    xsp[i] = 1230 - (i - 25) * 73.75 + random.fx() * 60 - 30;
    ysp[i] = 670 + random.fx() * 30 - 15;
  }
  cntout = 0;
  var vony = 876;
  if (track.stage == 1 || track.stage == 2) {
    vony = 580;
  }
  for (var i = 25; i < 39; i++) {
    if (
      cntout == 0 &&
      Math.abs(ysp[i] - ysp[i + 1]) < 7 &&
      Math.abs(ysp[i] - ysp[i + 2]) < 7 &&
      xsp[i + 1] < vony &&
      (xsp[i + 1] > 572 || !hastip)
    ) {
      if (random.fx() > random.fx()) {
        ysp[i + 1] -= 30 + random.fx() * 30;
        xsp[i] = (xsp[i + 1] * 5 + xsp[i]) / 6;
        xsp[i + 2] = (xsp[i + 1] * 5 + xsp[i + 2]) / 6;
      }
      cntout = 3;
    }
    if (cntout != 0) {
      cntout--;
    }
  }
  for (var i = 41; i < 50; i++) {
    xsp[i] = 50 + random.fx() * 30 - 15;
    ysp[i] = 670 - (i - 41) * 68.88 + random.fx() * 60 - 30;
  }
  cntout = 0;
  for (var i = 41; i < 48; i++) {
    if (
      cntout == 0 &&
      Math.abs(xsp[i] - xsp[i + 1]) < 7 &&
      Math.abs(xsp[i] - xsp[i + 2]) < 7 &&
      (ysp[i + 1] < 330 || ysp[i + 1] > 450)
    ) {
      if (random.fx() > random.fx()) {
        xsp[i + 1] += 30 + random.fx() * 30;
        ysp[i] = (ysp[i + 1] * 5 + ysp[i]) / 6;
        ysp[i + 2] = (ysp[i + 1] * 5 + ysp[i + 2]) / 6;
      }
      cntout = 3;
    }
    if (cntout != 0) {
      cntout--;
    }
  }
  xsp[50] = xsp[0];
  ysp[50] = ysp[0];
}
function floatytalk(x, y, width, height, cornerRadius) {
  rd.beginPath();
  rd.moveTo(x + cornerRadius, y);
  rd.lineTo(x + width - cornerRadius, y);
  rd.quadraticCurveTo(x + width, y, x + width, y + cornerRadius);
  rd.lineTo(x + width, y + height - cornerRadius);
  rd.quadraticCurveTo(
    x + width,
    y + height,
    x + width - cornerRadius,
    y + height,
  );
  rd.lineTo(x + cornerRadius, y + height);
  rd.quadraticCurveTo(x, y + height, x, y + height - cornerRadius);
  var fm = view.scaleX;
  if (view.scaleX / view.scaleY > 1.2) {
    fm *= 1.2 / (view.scaleX / view.scaleY);
  }
  rd.lineTo(x, 260 * view.scaleY + 200 * fm);
  rd.lineTo(150 * fm, 260 * view.scaleY + 200 * fm);
  rd.lineTo(x, 260 * view.scaleY + 230 * fm);
  rd.lineTo(x, y + cornerRadius);
  rd.quadraticCurveTo(x, y, x + cornerRadius, y);
  rd.fill();
}
function floatythink(x, y, width, height, cornerRadius) {
  rd.beginPath();
  rd.moveTo(x + cornerRadius, y);
  rd.lineTo(x + width - cornerRadius, y);
  rd.quadraticCurveTo(x + width, y, x + width, y + cornerRadius);
  rd.lineTo(x + width, y + height - cornerRadius);
  rd.quadraticCurveTo(
    x + width,
    y + height,
    x + width - cornerRadius,
    y + height,
  );
  rd.lineTo(x + cornerRadius, y + height);
  rd.quadraticCurveTo(x, y + height, x, y + height - cornerRadius);
  rd.lineTo(x, y + cornerRadius);
  rd.quadraticCurveTo(x, y, x + cornerRadius, y);
  rd.fill();
}
function newrepcar() {
  return {
    x: [],
    y: [],
    z: [],
    xy: [],
    xz: [],
    zy: [],
    wzy: [],
    wxz: [],
    avnx: [],
    avny: [],
    avnz: [],
    cxz: [],
    hitmag: [],
    clear: [],
    pcleared: [],
    nlaps: [],
    nreg: 0,
    regat: [],
    regnr: [],
    regk: [],
    regmag: [],
    regmtch: [],
    nfix: 0,
    fixat: [],
    destat: 700,
    destedbyzero: 0,
    ndst: 0,
    dstat: [],
    tskd: [],
    mst: [],
    dx: [],
    dy: [],
    dz: [],
    sx: [],
    sz: [],
    smag: [],
    tlt: [],
    capsz: [],
  };
}
function newrepsprks() {
  return {
    n: 0,
    sprkat: [],
    cn: [],
    x: [],
    y: [],
    z: [],
    sx: [],
    sy: [],
    sz: [],
    cap: [],
  };
}

function inishrecord() {
  if (recording.repcar != null) {
    recording.repcar = null;
  }
  if (recording.hrepcar != null) {
    recording.hrepcar = null;
  }
  recording.repcar = [];
  recording.hrepcar = [];
  for (var c = 0; c < game.carCount; c++) {
    recording.repcar[c] = newrepcar();
    for (var i = 0; i < 430; i++) {
      recording.repcar[c].x[i] = 0;
      recording.repcar[c].y[i] = 0;
      recording.repcar[c].z[i] = 0;
      recording.repcar[c].xy[i] = 0;
      recording.repcar[c].xz[i] = 0;
      recording.repcar[c].zy[i] = 0;
      recording.repcar[c].wzy[i] = 0;
      recording.repcar[c].wxz[i] = 0;
      recording.repcar[c].avnx[i] = 0;
      recording.repcar[c].avny[i] = 0;
      recording.repcar[c].avnz[i] = 0;
      recording.repcar[c].cxz[i] = 0;
      recording.repcar[c].hitmag[i] = 0;
      recording.repcar[c].clear[i] = 0;
      recording.repcar[c].pcleared[i] = 0;
      recording.repcar[c].nlaps[i] = 0;
    }
    recording.hrepcar[c] = newrepcar();
    for (var i = 0; i < 430; i++) {
      recording.hrepcar[c].x[i] = 0;
      recording.hrepcar[c].y[i] = 0;
      recording.hrepcar[c].z[i] = 0;
      recording.hrepcar[c].xy[i] = 0;
      recording.hrepcar[c].xz[i] = 0;
      recording.hrepcar[c].zy[i] = 0;
      recording.hrepcar[c].wzy[i] = 0;
      recording.hrepcar[c].wxz[i] = 0;
      recording.hrepcar[c].avnx[i] = 0;
      recording.hrepcar[c].avny[i] = 0;
      recording.hrepcar[c].avnz[i] = 0;
    }
  }
  if (recording.repsprks != null) {
    recording.repsprks = null;
  }
  if (recording.hrepsprks != null) {
    recording.hrepsprks = null;
  }
  recording.repsprks = newrepsprks();
  recording.hrepsprks = newrepsprks();
  for (var i = 0; i < 430; i++) {
    recording.reponcheckpoint[i] = 0;
    recording.reponlastcheck[i] = 0;
  }
  recording.nrec = 0;
  recording.htyp = 0;
  recording.hpowerup = 0;
  recording.hat = 0;
  recording.hscar = 0;
  recording.hcim = 0;
  recording.catchfin = 0;
}
function record() {
  if (holdcnt < 100) {
    for (var c = 0; c < game.carCount; c++) {
      for (var i = 0; i < 429; i++) {
        recording.repcar[c].x[i] = recording.repcar[c].x[i + 1];
        recording.repcar[c].y[i] = recording.repcar[c].y[i + 1];
        recording.repcar[c].z[i] = recording.repcar[c].z[i + 1];
        recording.repcar[c].xy[i] = recording.repcar[c].xy[i + 1];
        recording.repcar[c].xz[i] = recording.repcar[c].xz[i + 1];
        recording.repcar[c].zy[i] = recording.repcar[c].zy[i + 1];
        recording.repcar[c].wzy[i] = recording.repcar[c].wzy[i + 1];
        recording.repcar[c].wxz[i] = recording.repcar[c].wxz[i + 1];
        recording.repcar[c].avnx[i] = recording.repcar[c].avnx[i + 1];
        recording.repcar[c].avny[i] = recording.repcar[c].avny[i + 1];
        recording.repcar[c].avnz[i] = recording.repcar[c].avnz[i + 1];
        recording.repcar[c].cxz[i] = recording.repcar[c].cxz[i + 1];
        recording.repcar[c].hitmag[i] = recording.repcar[c].hitmag[i + 1];
        recording.repcar[c].clear[i] = recording.repcar[c].clear[i + 1];
        recording.repcar[c].pcleared[i] = recording.repcar[c].pcleared[i + 1];
        recording.repcar[c].nlaps[i] = recording.repcar[c].nlaps[i + 1];
      }
      recording.repcar[c].x[429] = car[c].x;
      recording.repcar[c].y[429] = car[c].y;
      recording.repcar[c].z[429] = car[c].z;
      recording.repcar[c].xy[429] = car[c].xy;
      recording.repcar[c].xz[429] = car[c].xz;
      recording.repcar[c].zy[429] = car[c].zy;
      recording.repcar[c].wzy[429] = car[c].wzy;
      recording.repcar[c].wxz[429] = car[c].wxz;
      recording.repcar[c].avnx[429] =
        (racers[c].scx[0] +
          racers[c].scx[1] +
          racers[c].scx[2] +
          racers[c].scx[3]) /
        4;
      recording.repcar[c].avny[429] =
        (racers[c].scy[0] +
          racers[c].scy[1] +
          racers[c].scy[2] +
          racers[c].scy[3]) /
        4;
      recording.repcar[c].avnz[429] =
        (racers[c].scz[0] +
          racers[c].scz[1] +
          racers[c].scz[2] +
          racers[c].scz[3]) /
        4;
      recording.repcar[c].cxz[429] = racers[c].cxz;
      recording.repcar[c].hitmag[429] = racers[c].hitmag;
      recording.repcar[c].clear[429] = racers[c].clear;
      recording.repcar[c].pcleared[429] = racers[c].pcleared;
      recording.repcar[c].nlaps[429] = racers[c].nlaps;
      for (var i = 0; i < recording.repcar[c].nreg; i++) {
        recording.repcar[c].regat[i]--;
      }
      for (var i = 0; i < recording.repcar[c].nfix; i++) {
        recording.repcar[c].fixat[i]--;
      }
      for (var i = 0; i < recording.repcar[c].ndst; i++) {
        recording.repcar[c].dstat[i]--;
      }
      if (recording.repcar[c].destat != 700) {
        recording.repcar[c].destat--;
        if (recording.repcar[c].destat == 328) {
          if (c == game.player) {
            catchnow(2);
            if (recording.htyp == 2) {
              recording.hat = 327;
            }
          } else {
            if (recording.repcar[c].destedbyzero) {
              catchnow(3);
              if (recording.htyp == 3) {
                recording.hat = Math.floor(
                  (160 + recording.repcar[c].destedbyzero) * 1.42,
                );
                recording.hscar = c;
              }
            }
          }
        }
      }
    }
    for (var i = 0; i < recording.repsprks.n; i++) {
      recording.repsprks.sprkat[i]--;
    }
    for (var i = 0; i < 430; i++) {
      recording.reponcheckpoint[i] = recording.reponcheckpoint[i + 1];
      recording.reponlastcheck[i] = recording.reponlastcheck[i + 1];
    }
    recording.reponcheckpoint[429] = oncheckpoint;
    recording.reponlastcheck[429] = onlastcheck;
    if (recording.nrec < 430) {
      recording.nrec++;
    }
  }
}
function recordust(tskd, c, mst, x, y, z, sx, sz, smag, tlt, capsz) {
  var ui = -1;
  for (var i = 0; i < recording.repcar[c].ndst; i++) {
    if (recording.repcar[c].dstat[i] < 0) {
      ui = i;
      break;
    }
  }
  if (ui == -1) {
    ui = recording.repcar[c].ndst;
    recording.repcar[c].ndst++;
  }
  recording.repcar[c].dstat[ui] = 430;
  recording.repcar[c].tskd[ui] = tskd;
  recording.repcar[c].mst[ui] = mst;
  recording.repcar[c].dx[ui] = x;
  recording.repcar[c].dy[ui] = y;
  recording.repcar[c].dz[ui] = z;
  recording.repcar[c].sx[ui] = sx;
  recording.repcar[c].sz[ui] = sz;
  recording.repcar[c].smag[ui] = smag;
  recording.repcar[c].tlt[ui] = tlt;
  recording.repcar[c].capsz[ui] = capsz;
}
function recordsprks(cn, x, y, z, sx, sy, sz, cap) {
  var ui = -1;
  for (var i = 0; i < recording.repsprks.n; i++) {
    if (recording.repsprks.sprkat[i] < 0) {
      ui = i;
      break;
    }
  }
  if (ui == -1) {
    ui = recording.repsprks.n;
    recording.repsprks.n++;
  }
  recording.repsprks.sprkat[ui] = 430;
  recording.repsprks.cn[ui] = cn;
  recording.repsprks.x[ui] = x;
  recording.repsprks.y[ui] = y;
  recording.repsprks.z[ui] = z;
  recording.repsprks.sx[ui] = sx;
  recording.repsprks.sy[ui] = sy;
  recording.repsprks.sz[ui] = sz;
  recording.repsprks.cap[ui] = cap;
}
function catchnow(hty) {
  if (recording.nrec >= 430) {
    for (var c = 0; c < game.carCount; c++) {
      for (var i = 0; i < 430; i++) {
        recording.hrepcar[c].x[i] = recording.repcar[c].x[i];
        recording.hrepcar[c].y[i] = recording.repcar[c].y[i];
        recording.hrepcar[c].z[i] = recording.repcar[c].z[i];
        recording.hrepcar[c].xy[i] = recording.repcar[c].xy[i];
        recording.hrepcar[c].xz[i] = recording.repcar[c].xz[i];
        recording.hrepcar[c].zy[i] = recording.repcar[c].zy[i];
        recording.hrepcar[c].wzy[i] = recording.repcar[c].wzy[i];
        recording.hrepcar[c].wxz[i] = recording.repcar[c].wxz[i];
        recording.hrepcar[c].avnx[i] = recording.repcar[c].avnx[i];
        recording.hrepcar[c].avny[i] = recording.repcar[c].avny[i];
        recording.hrepcar[c].avnz[i] = recording.repcar[c].avnz[i];
        recording.hrepcar[c].nreg = recording.repcar[c].nreg;
        recording.hrepcar[c].nfix = recording.repcar[c].nfix;
        recording.hrepcar[c].ndst = recording.repcar[c].ndst;
        recording.hrepcar[c].destat = recording.repcar[c].destat;
      }
      for (var i = 0; i < recording.hrepcar[c].nreg; i++) {
        recording.hrepcar[c].regat[i] = recording.repcar[c].regat[i];
        recording.hrepcar[c].regmtch[i] = recording.repcar[c].regmtch[i];
        recording.hrepcar[c].regnr[i] = recording.repcar[c].regnr[i];
        recording.hrepcar[c].regk[i] = recording.repcar[c].regk[i];
        recording.hrepcar[c].regmag[i] = recording.repcar[c].regmag[i];
      }
      for (var i = 0; i < recording.hrepcar[c].nfix; i++) {
        recording.hrepcar[c].fixat[i] = recording.repcar[c].fixat[i];
      }
      for (var i = 0; i < recording.hrepcar[c].ndst; i++) {
        recording.hrepcar[c].dstat[i] = recording.repcar[c].dstat[i];
        recording.hrepcar[c].tskd[i] = recording.repcar[c].tskd[i];
        recording.hrepcar[c].mst[i] = recording.repcar[c].mst[i];
        recording.hrepcar[c].dx[i] = recording.repcar[c].dx[i];
        recording.hrepcar[c].dy[i] = recording.repcar[c].dy[i];
        recording.hrepcar[c].dz[i] = recording.repcar[c].dz[i];
        recording.hrepcar[c].sx[i] = recording.repcar[c].sx[i];
        recording.hrepcar[c].sz[i] = recording.repcar[c].sz[i];
        recording.hrepcar[c].smag[i] = recording.repcar[c].smag[i];
        recording.hrepcar[c].tlt[i] = recording.repcar[c].tlt[i];
        recording.hrepcar[c].capsz[i] = recording.repcar[c].capsz[i];
      }
    }
    recording.hrepsprks.n = recording.repsprks.n;
    for (var i = 0; i < recording.hrepsprks.n; i++) {
      recording.hrepsprks.sprkat[i] = recording.repsprks.sprkat[i];
      recording.hrepsprks.cn[i] = recording.repsprks.cn[i];
      recording.hrepsprks.x[i] = recording.repsprks.x[i];
      recording.hrepsprks.y[i] = recording.repsprks.y[i];
      recording.hrepsprks.z[i] = recording.repsprks.z[i];
      recording.hrepsprks.sx[i] = recording.repsprks.sx[i];
      recording.hrepsprks.sy[i] = recording.repsprks.sy[i];
      recording.hrepsprks.sz[i] = recording.repsprks.sz[i];
      recording.hrepsprks.cap[i] = recording.repsprks.cap[i];
    }
    for (var i = 0; i < 430; i++) {
      recording.hreponcheckpoint[i] = recording.reponcheckpoint[i];
      recording.hreponlastcheck[i] = recording.reponlastcheck[i];
    }
    recording.htyp = hty;
    recording.hcim = game.player;
  } else {
    recording.hpowerup = 0;
  }
}

function rewindreplay() {
  game.phase = PHASE.replayRewind;
  recording.fr = 0;
  camera.mode = 1;
  camera.target = game.player;
  for (var c = 0; c < game.carCount; c++) {
    racers[c].destnow = false;
    racers[c].cntdest = 0;
    racers[c].embos = 0;
    racers[c].embodir = 0;
    racers[c].squash = 0;
    racers[c].nbsq = 0;
    car[c].fcnt = 0;
    fixcar(c);
    carModels[car[c].typ].alpha = 1;
    if (recording.repcar[c].destat < 0) {
      racers[c].destnow = true;
      racers[c].cntdest = 7;
    }
    var foundnegfix = 0;
    for (var i = recording.repcar[c].nfix - 1; i >= 0; i--) {
      if (recording.repcar[c].fixat[i] < 0 && foundnegfix == 0) {
        foundnegfix = recording.repcar[c].fixat[i];
        break;
      }
    }
    for (var i = 0; i < recording.repcar[c].nreg; i++) {
      if (recording.repcar[c].regat[i] < 0) {
        var frget = false;
        if (foundnegfix) {
          if (recording.repcar[c].regat[i] < foundnegfix) {
            frget = true;
          }
        }
        if (!frget) {
          racers[c].mtouch = recording.repcar[c].regmtch[i];
          regn(
            recording.repcar[c].regnr[i],
            recording.repcar[c].regk[i],
            recording.repcar[c].regmag[i],
            c,
          );
        }
      }
    }
  }
  game.phase = PHASE.replay;
}
function replay() {
  for (var c = 0; c < game.carCount; c++) {
    if (recording.repcar[c].destat == recording.fr) {
      racers[c].destnow = true;
    }
    if (racers[c].destnow) {
      if (racers[c].cntdest < 6) {
        if (racers[c].embos == 0) {
          carModels[car[c].typ].alpha = 1;
          racers[c].embodir = Math.floor(random.fx() * 3);
          if (racers[c].embodir == 3) {
            racers[c].embodir = 0;
          }
          racers[c].embomag = 1.2 + random.fx() * 0.2;
        }
        if (racers[c].embos == 1) {
          carModels[car[c].typ].alpha = 2;
        }
        racers[c].embos++;
        if (racers[c].embos == 2) {
          racers[c].embos = 0;
          racers[c].cntdest++;
        }
      } else {
        if (racers[c].cntdest == 6) {
          carModels[car[c].typ].alpha = 1;
          racers[c].embodir = 0;
          chipburn(c);
          racers[c].embos = 0;
          racers[c].cntdest = 7;
        }
        firexp(
          c,
          recording.repcar[c].avnx[recording.fr],
          recording.repcar[c].avny[recording.fr],
          recording.repcar[c].avnz[recording.fr],
        );
        if (racers[c].cntdest < 24) {
          racers[c].embos++;
          if (racers[c].embos == 5) {
            burn(c);
            racers[c].embos = 0;
            racers[c].cntdest++;
          }
        }
      }
    }
    if (!car[c].fcnt) {
      for (var i = 0; i < recording.repcar[c].nfix; i++) {
        if (recording.repcar[c].fixat[i] == recording.fr) {
          car[c].fcnt = 20;
        }
      }
    } else {
      onelec = true;
      carModels[car[c].typ].alpha = 1;
      if (car[c].fcnt % 2 == 0) {
        if (random.fx() > 0.333) {
          if (random.fx() > random.fx()) {
            carModels[car[c].typ].alpha = 3;
          } else {
            carModels[car[c].typ].alpha = 2;
          }
        }
      }
      if (tick.fraction >= tick.scale) {
        if (car[c].fcnt == 20) {
          racers[c].squash = 0;
          racers[c].nbsq = 0;
        }
        if (car[c].fcnt == 5) {
          fixcar(c);
        }
        car[c].fcnt--;
      }
    }
    for (var i = 0; i < recording.repcar[c].nreg; i++) {
      if (recording.repcar[c].regat[i] == recording.fr) {
        racers[c].mtouch = recording.repcar[c].regmtch[i];
        regn(
          recording.repcar[c].regnr[i],
          recording.repcar[c].regk[i],
          recording.repcar[c].regmag[i],
          c,
        );
      }
    }
    for (var i = 0; i < recording.repcar[c].ndst; i++) {
      if (recording.repcar[c].dstat[i] == recording.fr) {
        dustup(
          recording.repcar[c].tskd[i],
          c,
          recording.repcar[c].mst[i],
          recording.repcar[c].dx[i],
          recording.repcar[c].dy[i],
          recording.repcar[c].dz[i],
          recording.repcar[c].sx[i],
          recording.repcar[c].sz[i],
          recording.repcar[c].smag[i],
          recording.repcar[c].tlt[i],
          recording.repcar[c].capsz[i],
        );
      }
    }
    car[c].x = recording.repcar[c].x[recording.fr];
    car[c].y = recording.repcar[c].y[recording.fr];
    car[c].z = recording.repcar[c].z[recording.fr];
    car[c].xy = recording.repcar[c].xy[recording.fr];
    car[c].xz = recording.repcar[c].xz[recording.fr];
    car[c].zy = recording.repcar[c].zy[recording.fr];
    car[c].wzy = recording.repcar[c].wzy[recording.fr];
    car[c].wxz = recording.repcar[c].wxz[recording.fr];
    var xmt = [1, 0, 0];
    var ymt = [0, 1, 0];
    var zmt = [0, 0, 1];
    rotomat(xmt, ymt, car[c].xy);
    rotomat(ymt, zmt, car[c].zy);
    rotomat(xmt, zmt, car[c].xz);
    car[c].mat[0] = xmt[0];
    car[c].mat[1] = ymt[0];
    car[c].mat[2] = zmt[0];
    car[c].mat[4] = xmt[1];
    car[c].mat[5] = ymt[1];
    car[c].mat[6] = zmt[1];
    car[c].mat[8] = xmt[2];
    car[c].mat[9] = ymt[2];
    car[c].mat[10] = zmt[2];
    if (racers[c].embodir) {
      car[c].mat[racers[c].embodir * 4] *= racers[c].embomag;
      car[c].mat[racers[c].embodir * 4 + 1] *= racers[c].embomag;
      car[c].mat[racers[c].embodir * 4 + 2] *= racers[c].embomag;
    }
  }
  for (var i = 0; i < recording.repsprks.n; i++) {
    if (recording.repsprks.sprkat[i] == recording.fr) {
      sprks(
        recording.repsprks.cn[i],
        recording.repsprks.x[i],
        recording.repsprks.y[i],
        recording.repsprks.z[i],
        recording.repsprks.sx[i],
        recording.repsprks.sy[i],
        recording.repsprks.sz[i],
        recording.repsprks.cap[i],
      );
    }
  }
  oncheckpoint = recording.reponcheckpoint[recording.fr];
  onlastcheck = recording.reponlastcheck[recording.fr];
  if (recording.fr == 429) {
    game.phase = PHASE.paused;
    camera.mode = 0;
    camera.target = game.player;
    recording.fr = 0;
  } else {
    recording.fr++;
  }
}
function fastforwardexit() {
  game.phase = PHASE.replayRewind;
  for (var c = 0; c < game.carCount; c++) {
    if (
      recording.repcar[c].destat != 700 &&
      recording.repcar[c].destat >= recording.fr
    ) {
      racers[c].embos = 0;
      racers[c].cntdest = 7;
    }
    var foundnegfix = 0;
    for (var i = recording.repcar[c].nfix - 1; i >= 0; i--) {
      if (recording.repcar[c].fixat[i] >= recording.fr && foundnegfix == 0) {
        foundnegfix = recording.repcar[c].fixat[i];
        break;
      }
    }
    if (foundnegfix) {
      racers[c].squash = 0;
      racers[c].nbsq = 0;
      car[c].fcnt = 0;
      fixcar(c);
    }
    for (var i = 0; i < recording.repcar[c].nreg; i++) {
      if (recording.repcar[c].regat[i] >= recording.fr) {
        var frget = false;
        if (foundnegfix) {
          if (recording.repcar[c].regat[i] < foundnegfix) {
            frget = true;
          }
        }
        if (!frget) {
          racers[c].mtouch = recording.repcar[c].regmtch[i];
          regn(
            recording.repcar[c].regnr[i],
            recording.repcar[c].regk[i],
            recording.repcar[c].regmag[i],
            c,
          );
        }
      }
    }
    car[c].x = recording.repcar[c].x[429];
    car[c].y = recording.repcar[c].y[429];
    car[c].z = recording.repcar[c].z[429];
    car[c].xy = recording.repcar[c].xy[429];
    car[c].xz = recording.repcar[c].xz[429];
    car[c].zy = recording.repcar[c].zy[429];
    car[c].wzy = recording.repcar[c].wzy[429];
    car[c].wxz = recording.repcar[c].wxz[429];
  }
  camera.mode = 0;
  camera.target = game.player;
  game.phase = PHASE.paused;
}
function hrewindhreplay() {
  game.phase = PHASE.replayRewind;
  recording.fr = 0;
  for (var c = 0; c < game.carCount; c++) {
    racers[c].destnow = false;
    racers[c].cntdest = 0;
    racers[c].embos = 0;
    racers[c].embodir = 0;
    racers[c].squash = 0;
    racers[c].nbsq = 0;
    car[c].fcnt = 0;
    fixcar(c);
    carModels[car[c].typ].alpha = 1;
    if (recording.hrepcar[c].destat < 0) {
      racers[c].destnow = true;
      racers[c].cntdest = 7;
    }
    var foundnegfix = 0;
    for (var i = recording.hrepcar[c].nfix - 1; i >= 0; i--) {
      if (recording.hrepcar[c].fixat[i] < 0 && foundnegfix == 0) {
        foundnegfix = recording.hrepcar[c].fixat[i];
        break;
      }
    }
    for (var i = 0; i < recording.hrepcar[c].nreg; i++) {
      if (recording.hrepcar[c].regat[i] < 0) {
        var frget = false;
        if (foundnegfix) {
          if (recording.hrepcar[c].regat[i] < foundnegfix) {
            frget = true;
          }
        }
        if (!frget) {
          racers[c].mtouch = recording.hrepcar[c].regmtch[i];
          regn(
            recording.hrepcar[c].regnr[i],
            recording.hrepcar[c].regk[i],
            recording.hrepcar[c].regmag[i],
            c,
          );
        }
      }
    }
  }
  holdf = 0;
  rmode = 0;
  if (recording.htyp == 1) {
    if (random.fx() > random.fx()) {
      rmode = 98;
    } else {
      rmode = 43;
    }
  }
  if (recording.htyp == 2) {
    rmode = 95;
    camera.orbitAngle += 90;
  }
  game.phase = PHASE.highlights;
}
function hreplay() {
  for (var c = 0; c < game.carCount; c++) {
    if (recording.hrepcar[c].destat == recording.fr) {
      racers[c].destnow = true;
    }
    if (racers[c].destnow) {
      if (racers[c].cntdest < 6) {
        if (racers[c].embos == 0) {
          carModels[car[c].typ].alpha = 1;
          racers[c].embodir = Math.floor(random.fx() * 3);
          if (racers[c].embodir == 3) {
            racers[c].embodir = 0;
          }
          racers[c].embomag = 1.2 + random.fx() * 0.2;
        }
        if (racers[c].embos == 1) {
          carModels[car[c].typ].alpha = 2;
        }
        racers[c].embos++;
        if (racers[c].embos == 2) {
          racers[c].embos = 0;
          if (!recording.onpausefr) {
            racers[c].cntdest++;
          }
        }
      } else {
        if (racers[c].cntdest == 6) {
          carModels[car[c].typ].alpha = 1;
          racers[c].embodir = 0;
          chipburn(c);
          racers[c].embos = 0;
          racers[c].cntdest = 7;
        }
        firexp(
          c,
          recording.hrepcar[c].avnx[recording.fr],
          recording.hrepcar[c].avny[recording.fr],
          recording.hrepcar[c].avnz[recording.fr],
        );
        if (racers[c].cntdest < 24) {
          racers[c].embos++;
          if (racers[c].embos == 5) {
            burn(c);
            racers[c].embos = 0;
            racers[c].cntdest++;
          }
        }
      }
    }
    if (!car[c].fcnt) {
      for (var i = 0; i < recording.hrepcar[c].nfix; i++) {
        if (recording.hrepcar[c].fixat[i] == recording.fr) {
          car[c].fcnt = 20;
        }
      }
    } else {
      onelec = true;
      carModels[car[c].typ].alpha = 1;
      if (car[c].fcnt % 2 == 0) {
        if (random.fx() > 0.333) {
          if (random.fx() > random.fx()) {
            carModels[car[c].typ].alpha = 3;
          } else {
            carModels[car[c].typ].alpha = 2;
          }
        }
      }
      if (tick.fraction >= tick.scale) {
        if (car[c].fcnt == 20) {
          racers[c].squash = 0;
          racers[c].nbsq = 0;
        }
        if (car[c].fcnt == 5) {
          fixcar(c);
        }
        car[c].fcnt--;
      }
    }
    if (!recording.onpausefr) {
      for (var i = 0; i < recording.hrepcar[c].nreg; i++) {
        if (recording.hrepcar[c].regat[i] == recording.fr) {
          racers[c].mtouch = recording.hrepcar[c].regmtch[i];
          regn(
            recording.hrepcar[c].regnr[i],
            recording.hrepcar[c].regk[i],
            recording.hrepcar[c].regmag[i],
            c,
          );
        }
      }
    }
    for (var i = 0; i < recording.hrepcar[c].ndst; i++) {
      if (recording.hrepcar[c].dstat[i] == recording.fr) {
        dustup(
          recording.hrepcar[c].tskd[i],
          c,
          recording.hrepcar[c].mst[i],
          recording.hrepcar[c].dx[i],
          recording.hrepcar[c].dy[i],
          recording.hrepcar[c].dz[i],
          recording.hrepcar[c].sx[i],
          recording.hrepcar[c].sz[i],
          recording.hrepcar[c].smag[i],
          recording.hrepcar[c].tlt[i],
          recording.hrepcar[c].capsz[i],
        );
      }
    }
    car[c].x = recording.hrepcar[c].x[recording.fr];
    car[c].y = recording.hrepcar[c].y[recording.fr];
    car[c].z = recording.hrepcar[c].z[recording.fr];
    car[c].xy = recording.hrepcar[c].xy[recording.fr];
    car[c].xz = recording.hrepcar[c].xz[recording.fr];
    car[c].zy = recording.hrepcar[c].zy[recording.fr];
    car[c].wzy = recording.hrepcar[c].wzy[recording.fr];
    car[c].wxz = recording.hrepcar[c].wxz[recording.fr];
    var xmt = [1, 0, 0];
    var ymt = [0, 1, 0];
    var zmt = [0, 0, 1];
    rotomat(xmt, ymt, car[c].xy);
    rotomat(ymt, zmt, car[c].zy);
    rotomat(xmt, zmt, car[c].xz);
    car[c].mat[0] = xmt[0];
    car[c].mat[1] = ymt[0];
    car[c].mat[2] = zmt[0];
    car[c].mat[4] = xmt[1];
    car[c].mat[5] = ymt[1];
    car[c].mat[6] = zmt[1];
    car[c].mat[8] = xmt[2];
    car[c].mat[9] = ymt[2];
    car[c].mat[10] = zmt[2];
    if (racers[c].embodir) {
      car[c].mat[racers[c].embodir * 4] *= racers[c].embomag;
      car[c].mat[racers[c].embodir * 4 + 1] *= racers[c].embomag;
      car[c].mat[racers[c].embodir * 4 + 2] *= racers[c].embomag;
    }
  }
  for (var i = 0; i < recording.hrepsprks.n; i++) {
    if (recording.hrepsprks.sprkat[i] == recording.fr) {
      sprks(
        recording.hrepsprks.cn[i],
        recording.hrepsprks.x[i],
        recording.hrepsprks.y[i],
        recording.hrepsprks.z[i],
        recording.hrepsprks.sx[i],
        recording.hrepsprks.sy[i],
        recording.hrepsprks.sz[i],
        recording.hrepsprks.cap[i],
      );
    }
  }
  oncheckpoint = recording.hreponcheckpoint[recording.fr];
  onlastcheck = recording.hreponlastcheck[recording.fr];
}
function preprevtime() {
  recording.fr = 429;
  camera.mode = 0;
  camera.target = game.player;
  game.phase = PHASE.replayRewind;
  for (var c = 0; c < game.carCount; c++) {
    racers[c].destnow = false;
    racers[c].cntdest = 0;
    racers[c].embos = 0;
    racers[c].embodir = 0;
    racers[c].squash = 0;
    racers[c].nbsq = 0;
    car[c].fcnt = 0;
    fixcar(c);
    carModels[car[c].typ].alpha = 1;
    if (recording.repcar[c].destat < 0) {
      for (var i = 0; i < 16; i++) {
        burn(c);
      }
    }
    var foundnegfix = 0;
    for (var i = recording.repcar[c].nfix - 1; i >= 0; i--) {
      if (recording.repcar[c].fixat[i] < 0 && foundnegfix == 0) {
        foundnegfix = recording.repcar[c].fixat[i];
        break;
      }
    }
    for (var i = 0; i < recording.repcar[c].nreg; i++) {
      if (recording.repcar[c].regat[i] < 0) {
        var frget = false;
        if (foundnegfix) {
          if (recording.repcar[c].regat[i] < foundnegfix) {
            frget = true;
          }
        }
        if (!frget) {
          racers[c].mtouch = recording.repcar[c].regmtch[i];
          regn(
            recording.repcar[c].regnr[i],
            recording.repcar[c].regk[i],
            recording.repcar[c].regmag[i],
            c,
          );
        }
      }
    }
  }
  resumeStageMusic();
  switcnt = 0;
  game.phase = PHASE.timeRewind;
}
function revtime() {
  for (var c = 0; c < game.carCount; c++) {
    if (recording.fr > recording.repcar[c].destat) {
      firexp(
        c,
        recording.repcar[c].avnx[recording.fr],
        recording.repcar[c].avny[recording.fr],
        recording.repcar[c].avnz[recording.fr],
      );
    }
    if (!car[c].fcnt) {
      for (var i = 0; i < recording.repcar[c].nfix; i++) {
        if (
          recording.fr == recording.repcar[c].fixat[i] + 28 ||
          recording.fr == recording.repcar[c].fixat[i] + 27
        ) {
          car[c].fcnt = 20;
        }
      }
    } else {
      onelec = true;
      carModels[car[c].typ].alpha = 1;
      if (car[c].fcnt % 2 == 0) {
        if (random.fx() > 0.333) {
          if (random.fx() > random.fx()) {
            carModels[car[c].typ].alpha = 3;
          } else {
            carModels[car[c].typ].alpha = 2;
          }
        }
      }
      if (
        Math.abs(recording.fr - (429 - recording.nrec)) > 100 &&
        car[c].fcnt != 2
      ) {
        if (tick.fraction >= tick.scale) {
          car[c].fcnt -= 2;
        }
      } else {
        if (tick.fraction >= tick.scale) {
          car[c].fcnt--;
        }
      }
      if (car[c].fcnt < 0) {
        car[c].fcnt = 0;
      }
    }
    car[c].x = recording.repcar[c].x[recording.fr];
    car[c].y = recording.repcar[c].y[recording.fr];
    car[c].z = recording.repcar[c].z[recording.fr];
    car[c].xy = recording.repcar[c].xy[recording.fr];
    car[c].xz = recording.repcar[c].xz[recording.fr];
    car[c].zy = recording.repcar[c].zy[recording.fr];
    car[c].wzy = recording.repcar[c].wzy[recording.fr];
    car[c].wxz = recording.repcar[c].wxz[recording.fr];
    racers[c].pxy = car[c].xy;
    racers[c].pzy = car[c].zy;
    for (var k = 0; k < 4; k++) {
      racers[c].scx[k] = recording.repcar[c].avnx[recording.fr];
      racers[c].scy[k] = recording.repcar[c].avny[recording.fr];
      racers[c].scz[k] = recording.repcar[c].avnz[recording.fr];
    }
    racers[c].hitmag = recording.repcar[c].hitmag[recording.fr];
    racers[c].clear = recording.repcar[c].clear[recording.fr];
    racers[c].pcleared = recording.repcar[c].pcleared[recording.fr];
    racers[c].nlaps = recording.repcar[c].nlaps[recording.fr];
    racers[c].cxz = recording.repcar[c].cxz[recording.fr];
    var xmt = [1, 0, 0];
    var ymt = [0, 1, 0];
    var zmt = [0, 0, 1];
    rotomat(xmt, ymt, car[c].xy);
    rotomat(ymt, zmt, car[c].zy);
    rotomat(xmt, zmt, car[c].xz);
    car[c].mat[0] = xmt[0];
    car[c].mat[1] = ymt[0];
    car[c].mat[2] = zmt[0];
    car[c].mat[4] = xmt[1];
    car[c].mat[5] = ymt[1];
    car[c].mat[6] = zmt[1];
    car[c].mat[8] = xmt[2];
    car[c].mat[9] = ymt[2];
    car[c].mat[10] = zmt[2];
  }
  oncheckpoint = recording.reponcheckpoint[recording.fr];
  onlastcheck = recording.reponlastcheck[recording.fr];
  if (Math.abs(recording.fr - (429 - recording.nrec)) > 100) {
    recording.fr -= 2;
  } else {
    recording.fr--;
  }
  if (recording.fr <= 429 - recording.nrec) {
    for (var c = 0; c < game.carCount; c++) {
      resetPursuit(c);
      racers[c].focus = -1;
      racers[c].missedcp = 0;
      racers[c].nofocus = false;
      carModels[car[c].typ].alpha = 1;
      if (recording.repcar[c].destat > 0) {
        racers[c].dest = false;
        recording.repcar[c].destat = 700;
      }
    }
    cntwis = 0;
    iclear = racers[game.player].clear;
    tcnt = 30;
    auscnt = 45;
    track.haltall = false;
    game.phase = PHASE.race;
    recording.nrec = 0;
    recording.fr = 0;
  }
}

// Canvas, input and start-up (formerly the inline script of index.html).

installPointer(canvas2D, {
  onRelease: checknplay,
  keepPressedWhileTouching: () => game.phase == PHASE.race,
});

var enter = 0;

var pbr = 1;
// Enter, escape (and the handbrake outside races) confirm in the menus.
function confirmkey(pressed) {
  if (pressed && !enter) {
    enter = 1;
  }
  if (!pressed && enter) {
    enter = 0;
  }
}
// What the keys do (see input/keyboard.js).
function onKey(action, pressed) {
  if (action == "accelerate") {
    racers[game.player].u.up = pressed;
  }
  if (action == "brake") {
    racers[game.player].u.down = pressed;
  }
  if (action == "steerLeft") {
    racers[game.player].u.left = pressed;
  }
  if (action == "steerRight") {
    racers[game.player].u.right = pressed;
  }
  if (action == "handbrake") {
    racers[game.player].u.handb = pressed;
    if (game.phase != PHASE.race) {
      confirmkey(pressed);
    }
  }
  if (action == "confirm") {
    confirmkey(pressed);
  }
  if (action == "toggleArrow") {
    if (pressed) {
      if (game.phase == PHASE.race) {
        keyonx = 1;
      }
    } else {
      racers[game.player].u.arrace = !racers[game.player].u.arrace;
      keyonx = 0;
    }
  }
  if (action == "rewind") {
    if (game.phase == PHASE.race && starcnt == 0) {
      if (pressed) {
        keyonx = 11;
      } else {
        stopEngine();
        stopStageMusic();
        preprevtime();
      }
    }
    if (!pressed) {
      keyonx = 0;
    }
  }
  if (action == "lookBackLeft") {
    camera.lookBack = pressed ? -1 : 0;
  }
  if (action == "lookBackRight") {
    camera.lookBack = pressed ? 1 : 0;
  }
  if (!pressed && action == "nextCamera" && game.phase == PHASE.race) {
    camera.mode++;
    if (camera.mode == 3) {
      camera.mode = 0;
    }
  }
  if (!pressed && action == "muteSound") {
    audio.muteSound = !audio.muteSound;
    if (audio.muteSound) {
      stopEngine();
    }
  }
  if (!pressed && action == "muteMusic") {
    audio.muteMusic = !audio.muteMusic;
  }
}
installKeyboard(onKey);

function init() {
  gotGamepads();
  document.getElementById("loading").style.visibility = "hidden";
  requestAnimationFrame(mainloop);
}

function saveInfo(iname, ivalue) {
  try {
    if (typeof Storage !== "undefined") {
      if (localStorage != null) {
        localStorage.setItem(iname, ivalue);
      }
    }
  } catch (e) {}
}

function getInfo(iname) {
  var ivalue = "-1";
  try {
    if (typeof Storage !== "undefined") {
      if (localStorage != null) {
        if (localStorage.getItem(iname) != null) {
          ivalue = localStorage.getItem(iname);
        }
      }
    }
  } catch (e) {}
  var retivalue = parseInt(ivalue);
  if (Number.isNaN(retivalue)) {
    retivalue = -1;
  }
  return retivalue;
}

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState == "visible") {
    audio.muteMusic = omutemusic;
    audio.muteSound = omutegame;
  } else {
    omutemusic = audio.muteMusic;
    omutegame = audio.muteSound;
    audio.muteMusic = true;
    audio.muteSound = true;
    stopEngine();
  }
});

window.addEventListener("load", init);
