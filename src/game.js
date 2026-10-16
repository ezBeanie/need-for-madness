import {
  isSpecialFix,
  parseStage,
  pathType,
  valueOf,
} from "./data/stageFormat.js";
import {
  cosDeg as mcos,
  distance as pyd,
  distanceSquaredXZ as pyo,
  distanceXZ as py,
  rotateAxes as rotomat,
  rotatePoints as rotate,
  sinDeg as msin,
} from "./core/math.js";
import { interfaceResolution, isPhone } from "./core/platform.js";
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
import { coolDownCarSounds } from "./audio/carSounds.js";
import { installKeyboard } from "./input/keyboard.js";
import { CONFIRM, confirm, pressConfirm } from "./input/confirm.js";
import { loadSetting, saveSetting } from "./core/storage.js";
import { images } from "./ui/images.js";
import {
  BUTTON,
  TEXT,
  anyButtonHeld,
  blink,
  buttons,
  drawButton,
  drawCenteredText,
  drawMeter,
  drawMusicToggle,
  fillPolygon,
  fillScaledShape,
  strokePolygon,
  strokeScaledPolygon,
  touchArea,
} from "./ui/widgets.js";
import { installPointer, pointer } from "./input/pointer.js";
import {
  attachTo,
  interpolation,
  placeCamera,
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
  keepDamageTexture,
} from "./render/renderer.js";
import {
  loadModel,
  loadParticleModel,
  newModel,
  newParticleModel,
} from "./render/models.js";
import { canvas2D, rd, view } from "./ui/view.js";
import { camera } from "./render/camera.js";
import {
  carModels,
  carShadows,
  carTextures,
  checkpointText,
  dustSprite,
  electricity,
  finishText,
  fixHoop,
  ground,
  menuBackdrop,
  scene,
  sky,
  sparkModels,
  stageBackdrop,
  timeTube,
  wheelDisk,
  wheelTread,
  wheelTreadLow,
} from "./render/scene.js";
import { pauseMenu } from "./screens/pauseMenu.js";
import { menu, showcase } from "./screens/menuState.js";
import { loading } from "./loading/progress.js";
import { game, MAX_CARS, PHASE } from "./core/state.js";
import { tick } from "./core/tick.js";
import { car, racers } from "./race/racers.js";
import { carStats } from "./data/carStats.js";
import { pieceModels, pieces, track } from "./race/track.js";
import {
  catchnow,
  fastforwardexit,
  hreplay,
  hrewindhreplay,
  inishrecord,
  preprevtime,
  record,
  recording,
  replay,
  revtime,
  rewindreplay,
} from "./race/recording.js";
import { raceEvents } from "./race/events.js";
import { control, inishcontrol } from "./race/ai.js";
import {
  chipsfly,
  dustfly,
  expburn,
  sprksfly,
  effects,
} from "./race/effects.js";
import { drive, fixcar, inishmad, paintDents } from "./race/physics.js";
import { hslToRgb, rgbToHsl } from "./ui/color.js";
import {
  UNLOCKED_CAR_SHOWN,
  loadConfetti,
  raceEndScreen,
  startRaceEnd,
} from "./screens/raceEnd.js";

// Formerly undeclared, so implicitly global: declared here to keep their behaviour in strict mode.
function cartextures() {
  for (var i = 0; i < 19; i++) {
    var loadthis = false;
    if (loading.stanza == 0) {
      loadthis = true;
    }
    if (loading.stanza == 1) {
      for (var c = 0; c < game.carCount; c++) {
        if (game.carTypes[c] == i) {
          loadthis = true;
        }
      }
    }
    if (loading.stanza == 2) {
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
  if (sky.loaded == 4) {
    gl.deleteTexture(sky.texture);
    sky.texture = null;
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
  sky.texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, sky.texture);
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
    if (loading.stanza == 0) {
      loadthis = true;
    }
    if (loading.stanza == 1) {
      for (var i = 0; i < game.carCount; i++) {
        if (game.carTypes[i] == c) {
          loadthis = true;
        }
      }
    }
    if (loading.stanza == 2) {
      loadthis = true;
      for (var i = 0; i < game.carCount; i++) {
        if (game.carTypes[i] == c) {
          loadthis = false;
        }
      }
    }
    if (loadthis) {
      for (var k = 0; k < 2; k++) {
        tired[c][k].ni = wheelDisk.tri.length / 3;
        var indice = [];
        var vert = [];
        var norm = [];
        var texu = [];
        for (var i = 0; i < tired[c][k].ni; i++) {
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
          if (tcrad > tired[c][k].colrad) {
            tired[c][k].colrad = tcrad;
          }
          norm[i * 3] = wheelDisk.nrm[wheelDisk.tri[i * 3 + 1] * 3];
          norm[i * 3 + 1] = wheelDisk.nrm[wheelDisk.tri[i * 3 + 1] * 3 + 1];
          norm[i * 3 + 2] = wheelDisk.nrm[wheelDisk.tri[i * 3 + 1] * 3 + 2];
          texu[i * 2] = wheelDisk.tex[wheelDisk.tri[i * 3 + 2] * 2];
          texu[i * 2 + 1] = 1 - wheelDisk.tex[wheelDisk.tri[i * 3 + 2] * 2 + 1];
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
        tiren[c][k].ni = wheelTread.indice.length;
        var vert = [];
        var norm = [];
        var col = [];
        for (var i = 0; i < wheelTread.vert.length / 3; i++) {
          vert[i * 3] = wheelTread.vert[i * 3] * 1.1 * carStats.wlh[c][k];
          vert[i * 3 + 1] =
            wheelTread.vert[i * 3 + 1] * 1.1 * carStats.wlh[c][k];
          vert[i * 3 + 2] = wheelTread.vert[i * 3 + 2] * 1.1 * wlw[c][k];
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
          new Uint16Array(wheelTread.indice),
          gl.STATIC_DRAW,
        );
        tiren[c][k].mat = mat4.create();
        tiren[c][k].loaded = 1;
        tirel[c][k].ni = wheelTreadLow.indice.length;
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
          new Uint16Array(wheelTreadLow.indice),
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
    racers[c].wheels[0].x =
      car[c].x -
      carStats.wlx[cn][0] * car[c].mat[0] -
      carStats.wly[cn][0] * car[c].mat[4] +
      carStats.wlz[cn][0] * car[c].mat[8];
    racers[c].wheels[0].y =
      car[c].y -
      carStats.wlx[cn][0] * car[c].mat[1] -
      carStats.wly[cn][0] * car[c].mat[5] +
      carStats.wlz[cn][0] * car[c].mat[9];
    racers[c].wheels[0].z =
      car[c].z -
      carStats.wlx[cn][0] * car[c].mat[2] -
      carStats.wly[cn][0] * car[c].mat[6] +
      carStats.wlz[cn][0] * car[c].mat[10];
    racers[c].wheels[0].mat = resetMatrix(racers[c].wheels[0].mat);
    for (var k = 0; k < 12; k++) {
      racers[c].wheels[0].mat[k] = car[c].mat[k];
    }
    mat4.rotate(
      racers[c].wheels[0].mat,
      racers[c].wheels[0].mat,
      (90 - car[c].wxz) * (Math.PI / 180),
      [0, 1, 0],
    );
    mat4.rotate(
      racers[c].wheels[0].mat,
      racers[c].wheels[0].mat,
      car[c].wzy * (Math.PI / 180),
      [0, 0, -1],
    );
    racers[c].wheels[1].x =
      car[c].x +
      carStats.wlx[cn][0] * car[c].mat[0] -
      carStats.wly[cn][0] * car[c].mat[4] +
      carStats.wlz[cn][0] * car[c].mat[8];
    racers[c].wheels[1].y =
      car[c].y +
      carStats.wlx[cn][0] * car[c].mat[1] -
      carStats.wly[cn][0] * car[c].mat[5] +
      carStats.wlz[cn][0] * car[c].mat[9];
    racers[c].wheels[1].z =
      car[c].z +
      carStats.wlx[cn][0] * car[c].mat[2] -
      carStats.wly[cn][0] * car[c].mat[6] +
      carStats.wlz[cn][0] * car[c].mat[10];
    racers[c].wheels[1].mat = resetMatrix(racers[c].wheels[1].mat);
    for (var k = 0; k < 12; k++) {
      racers[c].wheels[1].mat[k] = car[c].mat[k];
    }
    mat4.rotate(
      racers[c].wheels[1].mat,
      racers[c].wheels[1].mat,
      (-90 - car[c].wxz) * (Math.PI / 180),
      [0, 1, 0],
    );
    mat4.rotate(
      racers[c].wheels[1].mat,
      racers[c].wheels[1].mat,
      car[c].wzy * (Math.PI / 180),
      [0, 0, 1],
    );
    racers[c].wheels[2].x =
      car[c].x -
      carStats.wlx[cn][1] * car[c].mat[0] -
      carStats.wly[cn][1] * car[c].mat[4] +
      carStats.wlz[cn][1] * car[c].mat[8];
    racers[c].wheels[2].y =
      car[c].y -
      carStats.wlx[cn][1] * car[c].mat[1] -
      carStats.wly[cn][1] * car[c].mat[5] +
      carStats.wlz[cn][1] * car[c].mat[9];
    racers[c].wheels[2].z =
      car[c].z -
      carStats.wlx[cn][1] * car[c].mat[2] -
      carStats.wly[cn][1] * car[c].mat[6] +
      carStats.wlz[cn][1] * car[c].mat[10];
    racers[c].wheels[2].mat = resetMatrix(racers[c].wheels[2].mat);
    for (var k = 0; k < 12; k++) {
      racers[c].wheels[2].mat[k] = car[c].mat[k];
    }
    mat4.rotate(
      racers[c].wheels[2].mat,
      racers[c].wheels[2].mat,
      90 * (Math.PI / 180),
      [0, 1, 0],
    );
    mat4.rotate(
      racers[c].wheels[2].mat,
      racers[c].wheels[2].mat,
      car[c].wzy * (Math.PI / 180),
      [0, 0, -1],
    );
    racers[c].wheels[3].x =
      car[c].x +
      carStats.wlx[cn][1] * car[c].mat[0] -
      carStats.wly[cn][1] * car[c].mat[4] +
      carStats.wlz[cn][1] * car[c].mat[8];
    racers[c].wheels[3].y =
      car[c].y +
      carStats.wlx[cn][1] * car[c].mat[1] -
      carStats.wly[cn][1] * car[c].mat[5] +
      carStats.wlz[cn][1] * car[c].mat[9];
    racers[c].wheels[3].z =
      car[c].z +
      carStats.wlx[cn][1] * car[c].mat[2] -
      carStats.wly[cn][1] * car[c].mat[6] +
      carStats.wlz[cn][1] * car[c].mat[10];
    racers[c].wheels[3].mat = resetMatrix(racers[c].wheels[3].mat);
    for (var k = 0; k < 12; k++) {
      racers[c].wheels[3].mat[k] = car[c].mat[k];
    }
    mat4.rotate(
      racers[c].wheels[3].mat,
      racers[c].wheels[3].mat,
      -90 * (Math.PI / 180),
      [0, 1, 0],
    );
    mat4.rotate(
      racers[c].wheels[3].mat,
      racers[c].wheels[3].mat,
      car[c].wzy * (Math.PI / 180),
      [0, 0, 1],
    );
    for (var j = 0; j < 4; j++) {
      racers[c].wheels[j].dist = pyd(
        racers[c].wheels[j].x,
        camera.x,
        racers[c].wheels[j].y,
        camera.y,
        racers[c].wheels[j].z,
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
        racers[c].shadow.x = car[c].x;
        racers[c].shadow.z = car[c].z;
        racers[c].shadow.ont = 2;
        racers[c].shadow.mat[0] = car[c].mat[0];
        racers[c].shadow.mat[2] = car[c].mat[2];
        racers[c].shadow.mat[4] = car[c].mat[8];
        racers[c].shadow.mat[6] = car[c].mat[10];
        racers[c].shadow.mat[8] = -car[c].mat[4];
        racers[c].shadow.mat[10] = -car[c].mat[6];
      } else {
        racers[c].shadow.x =
          car[c].x - carStats.shadadj[car[c].typ] * car[c].mat[8];
        racers[c].shadow.z =
          car[c].z - carStats.shadadj[car[c].typ] * car[c].mat[10];
        racers[c].shadow.ont = 1;
        racers[c].shadow.mat[0] = car[c].mat[8];
        racers[c].shadow.mat[2] = car[c].mat[10];
        racers[c].shadow.mat[4] = car[c].mat[0];
        racers[c].shadow.mat[6] = car[c].mat[2];
        racers[c].shadow.mat[8] = -car[c].mat[4];
        racers[c].shadow.mat[10] = -car[c].mat[6];
      }
    } else {
      racers[c].shadow.x =
        car[c].x - carStats.shadadj[car[c].typ] * car[c].mat[8];
      racers[c].shadow.z =
        car[c].z - carStats.shadadj[car[c].typ] * car[c].mat[10];
      racers[c].shadow.ont = 0;
      racers[c].shadow.mat[0] = car[c].mat[8];
      racers[c].shadow.mat[2] = car[c].mat[10];
      racers[c].shadow.mat[4] = car[c].mat[4];
      racers[c].shadow.mat[6] = car[c].mat[6];
      racers[c].shadow.mat[8] = car[c].mat[0];
      racers[c].shadow.mat[10] = car[c].mat[2];
    }
    racers[c].shadow.intershad = false;
    racers[c].shadow.y = 0.4;
    racers[c].shadow.mat[1] = 0;
    racers[c].shadow.mat[5] = 1;
    racers[c].shadow.mat[9] = 0;
    for (var i = 0; i < pieces.count; i++) {
      if (pieceModels[pieces.list[i].typ].intershad) {
        pieceModels[pieces.list[i].typ].x = pieces.list[i].x;
        pieceModels[pieces.list[i].typ].y = pieces.list[i].y;
        pieceModels[pieces.list[i].typ].z = pieces.list[i].z;
        pieceModels[pieces.list[i].typ].mat = pieces.list[i].mat;
        shadowmap(car[c], racers[c].shadow, pieceModels[pieces.list[i].typ]);
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
function colorbgst() {
  gl.deleteBuffer(stageBackdrop.cbuf);
  stageBackdrop.cbuf = null;
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
  for (var i = 0; i < checkpointText.vert.length / 3; i++) {
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
  stageBackdrop.cbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, stageBackdrop.cbuf);
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
var impimg = new Image();
impimg.src = "data/interface" + interfaceResolution + "/loading.png";

var grndimg = [];

var skyimg = [];
var haloimg = null;

var tireimg = [];

var spritexture = [];
var explode = [];
for (var i = 0; i < 3; i++) {
  explode[i] = newModel();
}

function loaddata() {
  if (gl) {
    drawloading();
    if (loading.step == 0) {
      if (loading.stanza == 0) {
        menu.skipIntro = false;
        game.carTypes[0] = loadSetting("carsel");
        if (game.carTypes[0] == -1) {
          game.carTypes[0] = 5;
          menu.skipIntro = true;
          raceEvents.onautocorrect = 2;
        }
        game.unlocked = loadSetting("unlocked");
        if (game.unlocked == -1) {
          game.unlocked = 1;
        }
        game.raceCars = loadSetting("racecars");
        if (!RACE_SIZES.includes(game.raceCars)) {
          game.raceCars = 7;
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
    if (loading.step == 1) {
      var frm = 0,
        tro = 3;
      if (loading.stanza == 1) {
        frm = 2;
        tro = 3;
      }
      if (loading.stanza == 2) {
        frm = 0;
        tro = 2;
      }
      loadModel("data/3D/ground.r3d", ground);
      for (var i = frm; i < tro; i++) {
        grndimg[i] = new Image();
        grndimg[i].onload = function () {
          loading.loaded += 17;
        };
        grndimg[i].src = "data/3D/textures/ground" + (i + 1) + ".png";
      }
      loadModel("data/3D/skydom.r3d", sky);
      for (var i = frm; i < tro; i++) {
        skyimg[i] = new Image();
        skyimg[i].onload = function () {
          loading.loaded += 24;
        };
        skyimg[i].src = "data/3D/textures/sky" + (i + 1) + ".png";
      }
      haloimg = new Image();
      haloimg.onload = function () {
        loading.loaded += 5;
      };
      haloimg.src = "data/3D/textures/halo.png";
    }
    if (loading.step == 2) {
      if (loading.stanza != 2) {
        loadModel("data/3D/tiredisk.r3d", wheelDisk);
        loadParticleModel("data/3D/tire.prt", wheelTread);
        loadParticleModel("data/3D/tirelow.prt", wheelTreadLow);
        loadParticleModel("data/3D/cptext.prt", checkpointText);
        loadParticleModel("data/3D/fntext.prt", finishText);
        loadParticleModel("data/3D/timetube.prt", timeTube);
      }
      if (loading.stanza != 1) {
        loadParticleModel("data/3D/bg.prt", stageBackdrop);
      }
    }
    if (loading.step == 3) {
      for (var i = 0; i < 19; i++) {
        var loadthis = false;
        if (loading.stanza == 0) {
          loadthis = true;
        }
        if (loading.stanza == 1) {
          for (var c = 0; c < game.carCount; c++) {
            if (game.carTypes[c] == i) {
              loadthis = true;
            }
          }
        }
        if (loading.stanza == 2) {
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
          carTextures[i] = new Image();
          carTextures[i].onload = function () {
            loading.loaded += 9;
          };
          carTextures[i].src = "data/3D/textures/car" + i + ".png";
          tireimg[i] = new Image();
          tireimg[i].onload = function () {
            loading.loaded += 2;
          };
          tireimg[i].src = "data/3D/textures/t" + i + ".png";
        }
      }
    }
    if (loading.step == 4) {
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
          if (loading.stanza == 0) {
            loadthis = true;
          }
          if (loading.stanza == 1) {
            for (var k = 0; k < onfrst.length; k++) {
              if (onfrst[k] == i) {
                loadthis = true;
              }
            }
          }
          if (loading.stanza == 2) {
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
    if (loading.step == 5) {
      if (loading.stanza != 2) {
        loadModel("data/3D/sprite.r3d", dustSprite);
        for (var i = 0; i < 3; i++) {
          spritexture[i] = new Image();
          spritexture[i].onload = function () {
            loading.loaded++;
          };
          spritexture[i].src = "data/3D/textures/sp" + i + ".png";
        }
        loadModel("data/3D/fixdisk.r3d", fixHoop);
        loadModel("data/3D/elec.r3d", electricity);
        for (var i = 0; i < 3; i++) {
          loadModel("data/3D/exp" + i + ".r3d", explode[i]);
        }
      }
    }
    if (loading.step == 6) {
      var onfrst = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 17, 18];
      for (var i = 0; i < 19; i++) {
        var loadthis = false;
        if (loading.stanza == 0) {
          loadthis = true;
        }
        if (loading.stanza == 1) {
          for (var k = 0; k < onfrst.length; k++) {
            if (onfrst[k] == i) {
              loadthis = true;
            }
          }
        }
        if (loading.stanza == 2) {
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
    if (loading.step == 7) {
      if (loading.stanza != 1) {
        loadModel("data/3D/bg.r3d", menuBackdrop);
      }
      if (loading.stanza != 2) {
        if (isPhone) {
          for (var i = 0; i < 6; i++) {
            images.touchControls[i] = new Image();
            images.touchControls[i].onload = function () {
              loading.loaded++;
            };
            images.touchControls[i].src =
              "data/interface" + interfaceResolution + "/cn" + i + ".png";
          }
        }
        for (var i = 0; i < 7; i++) {
          images.buttons[i] = new Image();
          images.buttons[i].onload = function () {
            loading.loaded++;
          };
          images.buttons[i].src =
            "data/interface" + interfaceResolution + "/btn" + (i + 1) + ".png";
        }
        for (var i = 0; i < 6; i++) {
          images.soundToggles[i] = new Image();
          images.soundToggles[i].onload = function () {
            loading.loaded++;
          };
          images.soundToggles[i].src =
            "data/interface" + interfaceResolution + "/mu" + i + ".png";
        }
      }
    }
    if (loading.step == 8) {
      if (loading.stanza != 1) {
        images.loadingBarLeft = new Image();
        images.loadingBarLeft.onload = function () {
          loading.loaded++;
        };
        images.loadingBarLeft.src =
          "data/interface" + interfaceResolution + "/lbar.png";
        images.loadingBarRight = new Image();
        images.loadingBarRight.onload = function () {
          loading.loaded++;
        };
        images.loadingBarRight.src =
          "data/interface" + interfaceResolution + "/rbar.png";
        images.locked = new Image();
        images.locked.onload = function () {
          loading.loaded++;
        };
        images.locked.src =
          "data/interface" + interfaceResolution + "/locked.png";
        images.menuBackground = new Image();
        images.menuBackground.onload = function () {
          loading.loaded += 402;
        };
        images.menuBackground.src =
          "data/interface" + interfaceResolution + "/mainbg.png";
        images.rider = new Image();
        images.rider.onload = function () {
          loading.loaded += 14;
        };
        images.rider.src =
          "data/interface" + interfaceResolution + "/rider.png";
        images.logo = new Image();
        images.logo.onload = function () {
          loading.loaded += 20;
        };
        images.logo.src = "data/interface" + interfaceResolution + "/logo.png";
      }
      if (loading.stanza != 2) {
        for (var i = 0; i < 6; i++) {
          images.insano[i] = new Image();
          images.insano[i].onload = function () {
            loading.loaded += 20;
          };
          images.insano[i].src =
            "data/interface" + interfaceResolution + "/insano" + i + ".png";
        }
        for (var i = 0; i < 11; i++) {
          if (i < 5 || !isPhone || i == 8 || i == 10) {
            images.instructions[i] = new Image();
            images.instructions[i].onload = function () {
              loading.loaded += 13;
            };
            images.instructions[i].src =
              "data/interface1/int" + (i + 1) + ".png";
          }
        }
      }
    }
    if (loading.step != 9) {
      loading.step++;
    }
    if (wheelDisk.loaded == 1) {
      loading.loaded++;
      wheelDisk.loaded++;
    }
    if (wheelTread.loaded == 1) {
      loading.loaded++;
      wheelTread.loaded++;
    }
    if (wheelTreadLow.loaded == 1) {
      loading.loaded++;
      wheelTreadLow.loaded++;
    }
    if (checkpointText.loaded == 1) {
      loading.loaded += 4;
      checkpointText.loaded++;
    }
    if (finishText.loaded == 1) {
      loading.loaded += 4;
      finishText.loaded++;
    }
    if (timeTube.loaded == 1) {
      loading.loaded++;
      timeTube.loaded++;
    }
    if (stageBackdrop.loaded == 1) {
      loading.loaded++;
      stageBackdrop.loaded++;
    }
    if (ground.loaded && ground.loaded == ground.nt + 1) {
      loading.loaded++;
      ground.loaded++;
    }
    if (sky.loaded && sky.loaded == sky.nt + 1) {
      loading.loaded++;
      sky.loaded++;
    }
    for (var i = 0; i < 19; i++) {
      if (carModels[i].loaded && carModels[i].loaded == carModels[i].nt + 1) {
        loading.loaded += 31;
        carModels[i].loaded++;
      }
    }
    for (var i = 0; i < 66; i++) {
      if (
        i != 40 &&
        pieceModels[i].loaded &&
        pieceModels[i].loaded == pieceModels[i].nt + 1
      ) {
        loading.loaded += 7;
        pieceModels[i].loaded++;
      }
    }
    for (var i = 0; i < 19; i++) {
      if (textureGroups[i].loaded == 1) {
        loading.loaded += 44;
        textureGroups[i].loaded++;
      }
    }
    if (dustSprite.loaded && dustSprite.loaded == dustSprite.nt + 1) {
      loading.loaded++;
      dustSprite.loaded++;
    }
    if (fixHoop.loaded && fixHoop.loaded == fixHoop.nt + 1) {
      loading.loaded++;
      fixHoop.loaded++;
    }
    if (electricity.loaded && electricity.loaded == electricity.nt + 1) {
      loading.loaded++;
      electricity.loaded++;
    }
    for (var i = 0; i < 3; i++) {
      if (explode[i].loaded && explode[i].loaded == explode[i].nt + 1) {
        loading.loaded += 18;
        explode[i].loaded++;
      }
    }
    if (menuBackdrop.loaded && menuBackdrop.loaded == menuBackdrop.nt + 1) {
      loading.loaded += 309;
      menuBackdrop.loaded++;
    }
    if (loading.loaded == loading.total) {
      cartextures();
      createwheels();
      if (loading.stanza == 0 || loading.stanza == 1) {
        creatdustextures();
        for (var i = 0; i < 43; i++) {
          loadSound(i);
        }
      }
      if (loading.stanza == 0) {
        menu.animation = 0;
        game.phase = PHASE.mainMenu;
      }
      if (loading.stanza == 1) {
        stageloadtyp = 2;
        stageload = -1;
        game.phase = PHASE.stageLoading;
      }
      if (loading.stanza == 2) {
        menu.animation = 0;
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
            track.limr = limit + 5;
            track.limro = pieces.count;
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
            track.liml = limit - 5;
            track.limlo = pieces.count;
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
            track.limt = limit - 5;
            track.limto = pieces.count;
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
            track.limb = limit + 5;
            track.limbo = pieces.count;
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
        setupcars();
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

function cpanimate() {
  for (var i = 0; i < pieces.fixCount; i++) {
    mat4.rotate(
      pieces.list[pieces.fixes[i]].mat,
      pieces.list[pieces.fixes[i]].mat,
      11 * tick.scale * (Math.PI / 180),
      [0, 0, 1],
    );
  }
  fixHoop.ont++;
  if (fixHoop.ont == 5) {
    fixHoop.ont = 0;
  }
  if (raceEvents.onelec) {
    electricity.mat = resetMatrix(electricity.mat);
    mat4.rotate(
      electricity.mat,
      electricity.mat,
      camera.yaw * (Math.PI / 180),
      [0, -1, 0],
    );
    mat4.rotate(
      electricity.mat,
      electricity.mat,
      camera.pitch * (Math.PI / 180),
      [-1, 0, 0],
    );
    electricity.ont++;
    if (electricity.ont == 5) {
      electricity.ont = 0;
    }
  }
  if (track.stage == 1) {
    raceEvents.checkpointFlash++;
  } else {
    raceEvents.checkpointFlash += 0.2;
  }
  if (raceEvents.checkpointFlash >= 5) {
    raceEvents.checkpointFlash = 0;
  }
  if (raceEvents.oncheckpoint != -1) {
    checkpointText.x = pieces.list[track.obn[raceEvents.oncheckpoint]].x;
    checkpointText.y = pieces.list[track.obn[raceEvents.oncheckpoint]].y + 80;
    checkpointText.z = pieces.list[track.obn[raceEvents.oncheckpoint]].z;
    for (var i = 0; i < 16; i++) {
      checkpointText.mat[i] =
        pieces.list[track.obn[raceEvents.oncheckpoint]].mat[i];
    }
    var flipit = false;
    if (Math.abs(checkpointText.mat[8]) > Math.abs(checkpointText.mat[10])) {
      if (camera.x < checkpointText.x) {
        checkpointText.x -= 6.7;
      } else {
        checkpointText.x += 6.7;
      }
      if (checkpointText.mat[8] > 0 && camera.x < checkpointText.x) {
        flipit = true;
      }
      if (checkpointText.mat[8] < 0 && camera.x > checkpointText.x) {
        flipit = true;
      }
    } else {
      if (camera.z < checkpointText.z) {
        checkpointText.z -= 6.7;
      } else {
        checkpointText.z += 6.7;
      }
      if (checkpointText.mat[10] > 0 && camera.z < checkpointText.z) {
        flipit = true;
      }
      if (checkpointText.mat[10] < 0 && camera.z > checkpointText.z) {
        flipit = true;
      }
    }
    if (flipit) {
      mat4.rotate(
        checkpointText.mat,
        checkpointText.mat,
        180 * (Math.PI / 180),
        [0, 1, 0],
      );
    }
    if (raceEvents.onlastcheck) {
      for (var i = 0; i < 16; i++) {
        finishText.mat[i] = checkpointText.mat[i];
      }
      finishText.x = pieces.list[track.obn[raceEvents.oncheckpoint]].x;
      finishText.y = pieces.list[track.obn[raceEvents.oncheckpoint]].y + 52;
      finishText.z = pieces.list[track.obn[raceEvents.oncheckpoint]].z;
    }
  }
}

// Fase whose 3D scene has been drawn from a finished logic tick and may be redrawn every frame.
var framefase = -1;
var renderedfase = -1;
function gameworks() {
  var fieldOfView = (55 * Math.PI) / 180;
  var zNear = 0.1;
  var zFar = 7000;
  camera.matrix = mat4.create();
  mat4.perspective(camera.matrix, fieldOfView, view.aspect, zNear, zFar);
  raceEvents.onelec = false;
  if (game.phase == PHASE.race) {
    if (raceEvents.countdown == 0) {
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
      if (raceEvents.countdown == 186) {
        camera.orbitHeight = 190;
        camera.pitch = 40;
        camera.orbitAngle = 250;
        camera.target = 3;
        camera.orbitHigh = true;
        camera.orbitTilt = 0;
        camera.mode = 1;
      }
      if (raceEvents.countdown != 0) {
        raceEvents.countdown--;
      }
      setwheelspos();
      shadoworks();
      cpanimate();
      drawinter();
      if (
        game.mode == 1 &&
        raceEvents.countdown < 180 &&
        raceEvents.countdown > 80
      ) {
        drawCenteredText(132, "SWITCH MODE", 0, 0, 0, TEXT.title);
        drawCenteredText(192, "1 Lap, No Fixing", 0, 64, 128, TEXT.label);
      }
      if (
        raceEvents.countdown > 65 &&
        !isPhone &&
        (track.stage == 1 || track.stage == 2) &&
        game.unlocked == 1
      ) {
        rd.drawImage(
          images.instructions[6],
          50 * view.scaleX,
          view.height * 0.5 + 120 * view.scaleY,
          345 * view.scale,
          77 * view.scale,
        );
        rd.drawImage(
          images.instructions[5],
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
      if (raceEvents.countdown < 65) {
        enginsnd();
      } else {
        if (track.stage == 2 && game.unlocked == 2) {
          drawonbordo();
        }
        if (track.stage == 4 && game.unlocked == 4) {
          drawonbordo();
        }
      }
      if (raceEvents.countdown > 65) {
        if (
          confirm.state == CONFIRM.pressed ||
          racers[0].u.handb ||
          pointer.down
        ) {
          raceEvents.countdown = 65;
          if (confirm.state == CONFIRM.pressed) {
            confirm.state = CONFIRM.used;
          }
          racers[0].u.handb = false;
        }
      }
      if (raceEvents.countdown == 65) {
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
      if (raceEvents.countdown >= 185) {
        if (raceEvents.countdown == 185) {
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
  sky.x = camera.x;
  sky.z = camera.z;
  var skf = 0.6 + camera.y / 4000;
  sky.mat = resetMatrix(sky.mat);
  sky.mat[4] *= skf;
  sky.mat[5] *= skf;
  sky.mat[6] *= skf;
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
  menu.redraw = true;
}
var csxz = 0,
  cszy = 0;

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
  menuBackdrop.x = 0;
  menuBackdrop.y = 14;
  menuBackdrop.z = -99;
  menuBackdrop.mat = resetMatrix(menuBackdrop.mat);
  mat4.rotate(
    menuBackdrop.mat,
    menuBackdrop.mat,
    camera.pitch * (Math.PI / 180),
    [-1, 0, 0],
  );
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
      smoke[i].mat[k] = menuBackdrop.mat[k] * 4;
      smoke[i].mat[k + 4] = menuBackdrop.mat[k + 4] * 4;
      smoke[i].mat[k + 8] = menuBackdrop.mat[k + 8] * 4;
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
    if (showcase.bob >= 1) {
      if (showcase.bob == 1) {
        showcase.height += 0.7 + (11 - showcase.height) / 31;
        if (showcase.height > 10) {
          showcase.height = 10;
          showcase.bob = 2;
        }
      }
      if (showcase.bob >= 2) {
        showcase.bob++;
        if (showcase.bob == 110) {
          showcase.bob = 0;
        }
      }
    } else {
      if (showcase.bob == 0) {
        showcase.height -= 0.2 + (11 - showcase.height) / 31;
        if (showcase.height < -21) {
          showcase.height = -21;
          showcase.bob = -1;
        }
      }
      if (showcase.bob <= -1) {
        showcase.bob--;
        if (showcase.bob == -50) {
          showcase.bob = 1;
        }
      }
    }
  } else {
    if (flyout == 1) {
      cszy = 0;
      showcase.dropSpeed += 0.5;
      showcase.height -= showcase.dropSpeed;
      if (showcase.height < -21) {
        showcase.height = -21;
        showcase.bob = -30;
        flyout = 0;
      }
    }
    if (flyout == 2) {
      showcase.height += 7;
      if (nextc == 1) {
        cszy += 20;
      }
      if (nextc == -1) {
        cszy -= 20;
      }
      if (showcase.height > 100) {
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
        showcase.dropSpeed = 0;
        showcase.height = 100;
      }
    }
  }
  carModels[game.carTypes[0]].x = 0;
  carModels[game.carTypes[0]].y =
    carStats.wly[game.carTypes[0]][1] +
    1.5 * carStats.wlh[game.carTypes[0]][1] +
    showcase.height;
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
  menu.redraw = true;
}
var hit = 4500,
  ptr = 0,
  ptcnt = -10;
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
  fixHoop.ont++;
  if (fixHoop.ont == 5) {
    fixHoop.ont = 0;
  }
  raceEvents.checkpointFlash++;
  if (raceEvents.checkpointFlash >= 5) {
    raceEvents.checkpointFlash = 0;
  }
  stageBackdrop.mat = resetMatrix(stageBackdrop.mat);
  mat4.rotate(
    stageBackdrop.mat,
    stageBackdrop.mat,
    camera.yaw * (Math.PI / 180),
    [0, -1, 0],
  );
  mat4.rotate(
    stageBackdrop.mat,
    stageBackdrop.mat,
    camera.pitch * (Math.PI / 180),
    [-1, 0, 0],
  );
  stageBackdrop.mat[0] *= view.aspect * 0.5625;
  stageBackdrop.mat[1] *= view.aspect * 0.5625;
  stageBackdrop.mat[2] *= view.aspect * 0.5625;
  stageBackdrop.x = camera.x - 106 * stageBackdrop.mat[8];
  stageBackdrop.y = camera.y - 106 * stageBackdrop.mat[9];
  stageBackdrop.z = camera.z - 106 * stageBackdrop.mat[10];
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
  menu.redraw = true;
}
function unlockedcar() {
  if (menu.animation == UNLOCKED_CAR_SHOWN) {
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
    cszy = showcase.height;
    if (showcase.bob) {
      showcase.height++;
      if (showcase.height > 20) {
        showcase.height = 20;
      }
    } else {
      showcase.height--;
      if (showcase.height < -20) {
        showcase.height = -20;
      }
    }
    showcase.dropSpeed--;
    if (showcase.dropSpeed == 0) {
      if (showcase.bob == 0) {
        showcase.bob = 1;
      } else {
        showcase.bob = 0;
      }
      showcase.dropSpeed = 100;
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
    stageBackdrop.mat = resetMatrix(stageBackdrop.mat);
    mat4.rotate(
      stageBackdrop.mat,
      stageBackdrop.mat,
      camera.yaw * (Math.PI / 180),
      [0, -1, 0],
    );
    mat4.rotate(
      stageBackdrop.mat,
      stageBackdrop.mat,
      camera.pitch * (Math.PI / 180),
      [-1, 0, 0],
    );
    stageBackdrop.mat[0] *= view.aspect * 0.5625;
    stageBackdrop.mat[1] *= view.aspect * 0.5625;
    stageBackdrop.mat[2] *= view.aspect * 0.5625;
    stageBackdrop.x = 0;
    stageBackdrop.y = 0;
    stageBackdrop.z = -90;
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
    menu.redraw = true;
  }
}
// About 2 ms per frame for scratching car damage into textures (see paintDents).
var SCRATCH_STEPS_PER_FRAME = 100000;
function render(now) {
  interpolation.frame++;
  paintDents(SCRATCH_STEPS_PER_FRAME);
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
    if (menu.redraw || framefase == game.phase) {
      framefase = game.phase;
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      drawModel(ground);
      drawModel(sky);
      if (game.phase == PHASE.timeRewind) {
        drawParticle(timeTube);
      }
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      for (var i = 0; i < pieces.count; i++) {
        if (pieces.list[i].iscp) {
          if (
            raceEvents.oncheckpoint + 1 == pieces.list[i].iscp &&
            (Math.round(raceEvents.checkpointFlash) == 0 ||
              raceEvents.checkpointFlash == 1)
          ) {
            if (Math.round(raceEvents.checkpointFlash) == 0) {
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
        var shadow = Object.assign(carShadows[car[c].typ], racers[c].shadow);
        if (shadow.intershad) {
          gl.disable(gl.DEPTH_TEST);
        }
        drawModel(shadow);
        if (shadow.intershad) {
          gl.enable(gl.DEPTH_TEST);
        }
      }
      for (var i = 0; i < effects.nchp; i++) {
        drawModel(effects.chip[i]);
      }
      if (raceEvents.oncheckpoint != -1) {
        drawParticle(checkpointText);
        if (raceEvents.onlastcheck) {
          drawParticle(finishText);
        }
      }
      for (var c = 0; c < game.carCount; c++) {
        for (var w = 0; w < 4; w++) {
          attachTo(racers[c].wheels[w].mat, car[c]);
        }
        for (var w = 0; w < 4; w++) {
          var k = 0;
          if (w >= 2) {
            k = 1;
          }
          if (racers[c].wheels[w].dist < 250) {
            tiren[car[c].typ][k].x = racers[c].wheels[w].x;
            tiren[car[c].typ][k].y = racers[c].wheels[w].y;
            tiren[car[c].typ][k].z = racers[c].wheels[w].z;
            tiren[car[c].typ][k].mat = racers[c].wheels[w].mat;
            drawParticle(tiren[car[c].typ][k]);
          } else {
            tirel[car[c].typ][k].x = racers[c].wheels[w].x;
            tirel[car[c].typ][k].y = racers[c].wheels[w].y;
            tirel[car[c].typ][k].z = racers[c].wheels[w].z;
            tirel[car[c].typ][k].mat = racers[c].wheels[w].mat;
            drawParticle(tirel[car[c].typ][k]);
          }
        }
        racers[c].body.x = car[c].x;
        racers[c].body.y = car[c].y;
        racers[c].body.z = car[c].z;
        racers[c].body.mat = car[c].mat;
        drawModel(racers[c].body);
        for (var w = 0; w < 4; w++) {
          var k = 0;
          if (w >= 2) {
            k = 1;
          }
          tired[car[c].typ][k].x = racers[c].wheels[w].x;
          tired[car[c].typ][k].y = racers[c].wheels[w].y;
          tired[car[c].typ][k].z = racers[c].wheels[w].z;
          tired[car[c].typ][k].mat = racers[c].wheels[w].mat;
          drawModel(tired[car[c].typ][k]);
        }
      }
      if (raceEvents.onelec) {
        for (var c = 0; c < game.carCount; c++) {
          if (car[c].fcnt) {
            electricity.x = car[c].x;
            electricity.y = car[c].y;
            electricity.z = car[c].z;
            mat4.rotate(
              electricity.mat,
              electricity.mat,
              random.fx() * 360 * (Math.PI / 180),
              [0, 0, 1],
            );
            drawModel(electricity);
          }
        }
      }
      if (game.mode != 1) {
        for (var i = 0; i < pieces.fixCount; i++) {
          fixHoop.x = pieces.list[pieces.fixes[i]].x;
          fixHoop.y = pieces.list[pieces.fixes[i]].y;
          fixHoop.z = pieces.list[pieces.fixes[i]].z;
          fixHoop.mat = pieces.list[pieces.fixes[i]].mat;
          drawModel(fixHoop);
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
          dustSprite.x = effects.dust[i].x;
          dustSprite.y = effects.dust[i].y;
          dustSprite.z = effects.dust[i].z;
          dustSprite.mat = effects.dust[i].mat;
          dustSprite.texture =
            dtexture[effects.dust[i].tx][Math.floor(effects.dust[i].ta)];
          drawModel(dustSprite);
        }
      }
      menu.redraw = false;
    }
  }
  if (game.phase == PHASE.carSelect) {
    if (menu.redraw || framefase == game.phase) {
      framefase = game.phase;
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      drawModel(menuBackdrop);
      for (var i = 0; i < 9; i++) {
        dustSprite.x = smoke[i].x;
        dustSprite.y = smoke[i].y;
        dustSprite.z = smoke[i].z;
        dustSprite.mat = smoke[i].mat;
        var ui = i;
        while (ui >= 3) {
          ui -= 3;
        }
        dustSprite.texture = stexture[ui];
        drawModel(dustSprite);
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
      menu.redraw = false;
    }
  }
  if (game.phase == PHASE.stageSelect) {
    if (menu.redraw || framefase == game.phase) {
      framefase = game.phase;
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      drawParticle(stageBackdrop);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      if (!flkun) {
        for (var i = 0; i < track.obi[track.n - 1] + adod; i++) {
          if (pieces.list[i].iscp) {
            if (
              Math.round(raceEvents.checkpointFlash) == 0 ||
              raceEvents.checkpointFlash == 1
            ) {
              if (Math.round(raceEvents.checkpointFlash) == 0) {
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
          fixHoop.x = pieces.list[pieces.fixes[i]].x;
          fixHoop.y = pieces.list[pieces.fixes[i]].y;
          fixHoop.z = pieces.list[pieces.fixes[i]].z;
          fixHoop.mat = pieces.list[pieces.fixes[i]].mat;
          drawModel(fixHoop);
        }
      }
      menu.redraw = false;
    }
  }
  if (game.phase == PHASE.raceEnd && menu.animation == UNLOCKED_CAR_SHOWN) {
    if (menu.redraw || framefase == game.phase) {
      framefase = game.phase;
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      drawParticle(stageBackdrop);
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
      menu.redraw = false;
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
// The start grid: one car in the middle, then two side by side, and so on backwards.
var xstart = Array.from({ length: MAX_CARS }, (_, i) => [0, -35, 35][i % 3]);
var zstart = Array.from(
  { length: MAX_CARS },
  (_, i) => -76 + 38 * (Math.floor(i / 3) * 2 + (i % 3 == 0 ? 0 : 1)),
);
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
// Chooses the opponents and puts all cars on the start grid.
function setupcars() {
  track.insih();
  if (loading.stanza != 1) {
    sortcars(track.stage);
  }
  inishinter();
  inishcars();
  inishcontrol();
  inishmad();
  inishrecord();
}
// The field size can change in the stage select after the stage loaded with its cars.
var sortedcars = 0;
function applyracecars() {
  if (sortedcars != game.raceCars) {
    setupcars();
    gamecartextures();
  }
}
function sortcars(stage) {
  game.carCount = game.raceCars;
  sortedcars = game.raceCars;
  for (var i = 1; i < game.carCount; i++) {
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
    var tries = 0;
    while (!oks[i]) {
      tries++;
      game.carTypes[i] = Math.floor(random.sim() * (28 + 10 * (stage / 17)));
      if (game.carTypes[i] >= 19) {
        game.carTypes[i] -= 19;
      }
      if (game.carTypes[i] == 19) {
        game.carTypes[i] = 18;
      }
      oks[i] = true;
      // the original seven always differ; beyond them there are not enough car types
      if (i < 7 || tries < 50) {
        for (var j = 0; j < game.carCount; j++) {
          if (i != j && game.carTypes[i] == game.carTypes[j]) {
            oks[i] = false;
          }
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
    for (var i = 0; i < game.carCount; i++) {
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
    for (var i = 0; i < game.carCount; i++) {
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
    for (var i = 0; i < game.carCount; i++) {
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
            if (!confirm.state) {
              confirm.state = CONFIRM.pressed;
            }
            gpress[i] = 10;
          } else {
            if (gpress[i]) {
              if (confirm.state) {
                confirm.state = CONFIRM.released;
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
    raceEndScreen();
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
    if (raceEvents.holdcnt == 0) {
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
    if (!raceEvents.holdcnt) {
      startEngine(game.carTypes[game.player], true);
    }
  }
  coolDownCarSounds();
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
  if (pauseMenu.selected == 0) {
    on = 1;
  }
  if (
    drawButton({
      id: 1,
      x: 640 * view.scaleX,
      y: 95 * view.scaleY + 35 * view.scale,
      width: 350,
      height: 60,
      faceTop: bton[on][0],
      faceBottom: bton[on][1],
      shadowTop: bton[on][2],
      shadowBottom: bton[on][3],
      layout: BUTTON.textThenImage,
      text: "Resume Game ",
      fontSize: 20,
      textOpacity: 0.8,
      image: images.buttons[1],
      imageOpacity: 0.8,
      pulsing: on,
    })
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
  if (pauseMenu.selected == 1) {
    on = 1;
  }
  if (
    drawButton({
      id: 2,
      x: 640 * view.scaleX,
      y: 95 * view.scaleY + 125 * view.scale,
      width: 350,
      height: 60,
      faceTop: bton[on][0],
      faceBottom: bton[on][1],
      shadowTop: bton[on][2],
      shadowBottom: bton[on][3],
      layout: BUTTON.textOnly,
      text: "Instant Replay",
      fontSize: 20,
      textOpacity: 0.8,
      image: null,
      imageOpacity: 0,
      pulsing: on,
    })
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
  if (pauseMenu.selected == 2) {
    on = 1;
  }
  if (
    drawButton({
      id: 3,
      x: 640 * view.scaleX,
      y: 95 * view.scaleY + 215 * view.scale,
      width: 380,
      height: 60,
      faceTop: bton[on][0],
      faceBottom: bton[on][1],
      shadowTop: bton[on][2],
      shadowBottom: bton[on][3],
      layout: BUTTON.textOnly,
      text: "Game Instructions",
      fontSize: 20,
      textOpacity: 0.8,
      image: null,
      imageOpacity: 0,
      pulsing: on,
    })
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
  if (pauseMenu.selected == 3) {
    on = 1;
  }
  if (
    drawButton({
      id: 4,
      x: 640 * view.scaleX,
      y: 95 * view.scaleY + 305 * view.scale,
      width: 250,
      height: 60,
      faceTop: bton[on][0],
      faceBottom: bton[on][1],
      shadowTop: bton[on][2],
      shadowBottom: bton[on][3],
      layout: BUTTON.textOnly,
      text: "x Quit Game",
      fontSize: 20,
      textOpacity: 0.8,
      image: null,
      imageOpacity: 0,
      pulsing: on,
    })
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
    pauseMenu.selected--;
    if (pauseMenu.selected == -1) {
      pauseMenu.selected = 3;
    }
    racers[game.player].u.up = false;
  }
  if (racers[game.player].u.down) {
    pauseMenu.selected++;
    if (pauseMenu.selected == 4) {
      pauseMenu.selected = 0;
    }
    racers[game.player].u.down = false;
  }
  if (noten) {
    if (blink.on) {
      rgb = hslToRgb(hsl[0], 1, 0.7);
      blink.on = false;
    } else {
      rgb = hslToRgb(hsl[0], 1, 0.6);
      blink.on = true;
    }
    drawCenteredText(
      600,
      "Not enough gameplay was recorded yet!",
      rgb[0],
      rgb[1],
      rgb[2],
      TEXT.small,
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
  if (confirm.state == CONFIRM.pressed) {
    if (pauseMenu.selected == 0) {
      if (!playedforeplay) {
        resumeStageMusic();
      } else {
        playedforeplay = false;
      }
      game.phase = PHASE.race;
      noten = 0;
    }
    if (pauseMenu.selected == 1) {
      if (recording.nrec >= 430) {
        onbreplay = 2;
        resumeStageMusic();
        playedforeplay = true;
        noten = 0;
      } else {
        noten = 30;
      }
    }
    if (pauseMenu.selected == 2) {
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
    if (pauseMenu.selected == 3) {
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
    confirm.state = CONFIRM.used;
  }
  if (!buttons.pulseWidthGrowing) {
    buttons.pulseWidth -= 0.03;
    if (buttons.pulseWidth < 0.5) {
      buttons.pulseWidth = 0.5;
      buttons.pulseWidthGrowing = true;
    }
  } else {
    buttons.pulseWidth += 0.03;
    if (buttons.pulseWidth > 2) {
      buttons.pulseWidth = 2;
      buttons.pulseWidthGrowing = false;
    }
  }
  if (!buttons.pulseHeightGrowing) {
    buttons.pulseHeight -= 0.5;
    if (buttons.pulseHeight < 0.1) {
      buttons.pulseHeight = 0.1;
      buttons.pulseHeightGrowing = true;
    }
  } else {
    buttons.pulseHeight += 0.5;
    if (buttons.pulseHeight > 2) {
      buttons.pulseHeight = 2;
      buttons.pulseHeightGrowing = false;
    }
  }
}
function afterquitgame() {
  if (loading.stanza == 1) {
    loading.step = 0;
    loading.loaded = 500;
    loading.total = 2458;
    loading.stanza = 2;
    menu.skipIntro = false;
    game.phase = PHASE.loading;
  } else {
    menu.animation = 0;
    menu.skipIntro = false;
    game.phase = PHASE.mainMenu;
  }
}

var canreset = false;
var cnf = 0;
var cnl = 0;
var relit = "RE-LIT";
function drawmain() {
  rd.fillStyle = "#000000";
  rd.fillRect(0, 0, view.width, view.height);
  if (menu.animation == 0) {
    playMenuMusic();
    cnf = 0;
  }
  var lefy = (view.width - 1280 * view.scaleY) / 2;
  var rigy = lefy + 1280 * view.scaleY;
  rd.drawImage(images.menuBackground, lefy, 0, 1280 * view.scaleY, view.height);
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
    rd.drawImage(
      images.insano[0],
      ixf,
      iyf,
      274 * view.scaleY,
      341 * view.scaleY,
    );
    rd.drawImage(images.rider, rxf, ryf, 386 * view.scaleY, 191 * view.scaleY);
    rd.globalAlpha = 1;
  }
  if (cnf == 25) {
    rd.drawImage(
      images.logo,
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
  if (!menu.skipIntro) {
    if (
      drawButton({
        id: 1,
        x: rigy - 230 * view.scale,
        y: 720 * view.scaleY - 200 * view.scale,
        width: 360,
        height: 60,
        faceTop: "#FF1301",
        faceBottom: "#FF8A01",
        shadowTop: "#780800",
        shadowBottom: "#784100",
        layout: BUTTON.textOnly,
        text: "Game Instructions",
        fontSize: 19,
        textOpacity: 0.9,
        image: null,
        imageOpacity: 0,
        pulsing: false,
      })
    ) {
      pauseMenuMusic();
      instmain = true;
      ifase = 0;
      dudo = 250;
      game.phase = PHASE.instructions;
    }
    if (
      drawButton({
        id: 3,
        x: rigy - 150 * view.scale,
        y: 720 * view.scaleY - 100 * view.scale,
        width: 200,
        height: 70,
        faceTop: "#FF3D01",
        faceBottom: "#FFB401",
        shadowTop: "#771D01",
        shadowBottom: "#775401",
        layout: BUTTON.textThenImage,
        text: "PLAY ",
        fontSize: 25,
        textOpacity: 0.9,
        image: images.buttons[1],
        imageOpacity: 0.9,
        pulsing: true,
      })
    ) {
      menu.animation = 29;
      cnf = 25;
    }
    if (menu.animation < 29) {
      if (confirm.state == CONFIRM.pressed) {
        menu.animation = 29;
        confirm.state = CONFIRM.used;
      }
    }
    if (canreset) {
      if (
        drawButton({
          id: 7,
          x: rigy - 450 * view.scale,
          y: 720 * view.scaleY - 90 * view.scale,
          width: 280,
          height: 60,
          faceTop: "#FF1301",
          faceBottom: "#FF8A01",
          shadowTop: "#780800",
          shadowBottom: "#784100",
          layout: BUTTON.textOnly,
          text: "Reset Game",
          fontSize: 22,
          textOpacity: 0.9,
          image: null,
          imageOpacity: 0,
          pulsing: 0,
        })
      ) {
        dudo = 250;
        game.phase = PHASE.resetQuestion;
      }
    }
    drawMusicToggle();
  }
  if (!menu.skipIntro) {
    if (menu.animation != 15) {
      menu.animation++;
    } else {
      if (cnf != 25) {
        cnf++;
      }
    }
  } else {
    if (cnf != 25) {
      cnf++;
      menu.animation = 1;
    } else {
      menu.animation++;
    }
  }
  if (menu.animation >= 30) {
    rd.globalAlpha = (menu.animation - 50) / 10;
    rd.fillStyle = "#000000";
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
    if (menu.animation == 40) {
      gotGamepads();
      game.player = 0;
      racers[game.player].u.left = false;
      racers[game.player].u.right = false;
      racers[game.player].u.up = false;
      racers[game.player].u.down = false;
      racers[game.player].u.handb = false;
      flyout = 1;
      showcase.dropSpeed = 0;
      showcase.height = 100;
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
  if (!buttons.pulseWidthGrowing) {
    buttons.pulseWidth -= 0.03;
    if (buttons.pulseWidth < 0.5) {
      buttons.pulseWidth = 0.5;
      buttons.pulseWidthGrowing = true;
    }
  } else {
    buttons.pulseWidth += 0.03;
    if (buttons.pulseWidth > 2) {
      buttons.pulseWidth = 2;
      buttons.pulseWidthGrowing = false;
    }
  }
  if (!buttons.pulseHeightGrowing) {
    buttons.pulseHeight -= 0.5;
    if (buttons.pulseHeight < 0.1) {
      buttons.pulseHeight = 0.1;
      buttons.pulseHeightGrowing = true;
    }
  } else {
    buttons.pulseHeight += 0.5;
    if (buttons.pulseHeight > 2) {
      buttons.pulseHeight = 2;
      buttons.pulseHeightGrowing = false;
    }
  }
}
var instmain = false;
var ifase = 0;

var dudo = 0;
function gameinstructions() {
  rd.fillStyle = "#000000";
  rd.fillRect(0, 0, view.width, view.height);
  if (instmain) {
    var lefy = (view.width - 1280 * view.scaleY) / 2;
    rd.drawImage(
      images.menuBackground,
      lefy,
      0,
      1280 * view.scaleY,
      view.height,
    );
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
  if (blink.on) {
    blink.on = false;
  } else {
    blink.on = true;
  }
  if (dudo > 0) {
    if (blink.on) {
      menu.insanoPicture = Math.floor(random.fx() * 6);
      if (menu.insanoPicture == 6) {
        menu.insanoPicture = 5;
      }
    }
    dudo--;
  } else {
    menu.insanoPicture = 2;
  }
  rd.drawImage(
    images.insano[menu.insanoPicture],
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
      images.instructions[0],
      200 * fm + 20 * fm,
      topo + 190 * fm,
      485 * fm,
      265 * fm,
    );
    rd.drawImage(
      images.instructions[1],
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
      images.instructions[4],
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
    drawMeter(
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
      images.instructions[2],
      200 * fm + 150 * fm,
      topo + 233 * fm,
      402 * fm,
      231 * fm,
    );
    rd.drawImage(
      images.instructions[3],
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
        images.instructions[6],
        200 * fm + 200 * fm,
        topo + 220 * fm,
        345 * fm,
        77 * fm,
      );
      rd.drawImage(
        images.instructions[5],
        200 * fm + 670 * fm,
        topo + 170 * fm,
        220 * fm,
        155 * fm,
      );
      rd.drawImage(
        images.instructions[7],
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
        images.touchControls[0],
        200 * fm + 150 * fm,
        topo + 110 * fm,
        128 * fm,
        128 * fm,
      );
      rd.drawImage(
        images.touchControls[1],
        200 * fm + 300 * fm,
        topo + 110 * fm,
        128 * fm,
        128 * fm,
      );
      rd.drawImage(
        images.touchControls[3],
        200 * fm + 550 * fm,
        topo + 110 * fm,
        128 * fm,
        128 * fm,
      );
      rd.drawImage(
        images.touchControls[2],
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
        images.touchControls[4],
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
        drawButton({
          id: 1,
          x: 240 * fm + 285 * view.scale,
          y: topo + 250 * fm,
          width: 570,
          height: 60,
          faceTop: "#0075D8",
          faceBottom: "#299DFF",
          shadowTop: "#003F74",
          shadowBottom: "#006AC4",
          layout: BUTTON.textOnly,
          text: "Additional Keyboard Controls",
          fontSize: 18,
          textOpacity: 0.9,
          image: null,
          imageOpacity: 0,
          pulsing: false,
        })
      ) {
        dudo = 250;
        ifase++;
      }
      if (
        drawButton({
          id: 2,
          x: 240 * fm + 140 * view.scale,
          y: topo + 350 * fm,
          width: 280,
          height: 60,
          faceTop: "#0075D8",
          faceBottom: "#299DFF",
          shadowTop: "#003F74",
          shadowBottom: "#006AC4",
          layout: BUTTON.textOnly,
          text: "Music Credits",
          fontSize: 18,
          textOpacity: 0.9,
          image: null,
          imageOpacity: 0,
          pulsing: false,
        })
      ) {
        dudo = 250;
        ifase += 2;
      }
    } else {
      if (
        drawButton({
          id: 2,
          x: 240 * fm + 140 * view.scale,
          y: topo + 300 * fm,
          width: 280,
          height: 60,
          faceTop: "#0075D8",
          faceBottom: "#299DFF",
          shadowTop: "#003F74",
          shadowBottom: "#006AC4",
          layout: BUTTON.textOnly,
          text: "Music Credits",
          fontSize: 18,
          textOpacity: 0.9,
          image: null,
          imageOpacity: 0,
          pulsing: false,
        })
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
    if (confirm.state == CONFIRM.pressed) {
      ifase = 4;
      dudo = 250;
      confirm.state = CONFIRM.used;
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
      drawButton({
        id: 1,
        x: 1170 * fm - 75 * view.scale,
        y: topo + 430 * fm,
        width: 150,
        height: 60,
        faceTop: "#0075D8",
        faceBottom: "#299DFF",
        shadowTop: "#003F74",
        shadowBottom: "#006AC4",
        layout: BUTTON.textThenImage,
        text: "Next ",
        fontSize: 18,
        textOpacity: 0.9,
        image: images.buttons[2],
        imageOpacity: 0.9,
        pulsing: true,
      })
    ) {
      dudo = 250;
      ifase++;
    }
    if (confirm.state == CONFIRM.pressed) {
      ifase++;
      dudo = 250;
      confirm.state = CONFIRM.used;
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
    if (confirm.state == CONFIRM.pressed) {
      ifase = 4;
      dudo = 250;
      confirm.state = CONFIRM.used;
    }
  }
  if (ifase > 0) {
    if (
      drawButton({
        id: 4,
        x: 240 * fm + 75 * view.scale,
        y: topo + 560 * fm - 65 * view.scale,
        width: 150,
        height: 60,
        faceTop: "#0075D8",
        faceBottom: "#299DFF",
        shadowTop: "#003F74",
        shadowBottom: "#006AC4",
        layout: BUTTON.imageThenText,
        text: " Back",
        fontSize: 18,
        textOpacity: 0.9,
        image: images.buttons[3],
        imageOpacity: 0.9,
        pulsing: false,
      })
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
      drawButton({
        id: 3,
        x: 1280 * fm - 70 * fm - 100 * view.scale,
        y: topo + 560 * fm - 65 * view.scale,
        width: 200,
        height: 60,
        faceTop: "#0075D8",
        faceBottom: "#299DFF",
        shadowTop: "#003F74",
        shadowBottom: "#006AC4",
        layout: BUTTON.textThenImage,
        text: "Next ",
        fontSize: 20,
        textOpacity: 0.9,
        image: images.buttons[1],
        imageOpacity: 0.9,
        pulsing: true,
      })
    ) {
      ifase++;
      dudo = 250;
    }
    if (confirm.state == CONFIRM.pressed) {
      ifase++;
      dudo = 250;
      confirm.state = CONFIRM.used;
    }
  }
  if (ifase == 4) {
    if (
      drawButton({
        id: 3,
        x: 1280 * fm - 70 * fm - 110 * view.scale,
        y: topo + 560 * fm - 65 * view.scale,
        width: 220,
        height: 60,
        faceTop: "#0075D8",
        faceBottom: "#299DFF",
        shadowTop: "#003F74",
        shadowBottom: "#006AC4",
        layout: BUTTON.textThenImage,
        text: "Finish ",
        fontSize: 20,
        textOpacity: 0.9,
        image: images.buttons[1],
        imageOpacity: 0.9,
        pulsing: true,
      })
    ) {
      if (instmain) {
        game.phase = PHASE.mainMenu;
        playMenuMusic();
      } else {
        game.phase = PHASE.paused;
      }
    }
    if (confirm.state == CONFIRM.pressed) {
      if (instmain) {
        game.phase = PHASE.mainMenu;
        playMenuMusic();
      } else {
        game.phase = PHASE.paused;
      }
      confirm.state = CONFIRM.used;
    }
  }
  if (!anyButtonHeld() && pointer.down) {
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
  rd.drawImage(images.menuBackground, lefy, 0, 1280 * view.scaleY, view.height);
  var fm = view.scaleX;
  if (view.scaleX / view.scaleY > 1.2) {
    fm *= 1.2 / (view.scaleX / view.scaleY);
  }
  if (blink.on) {
    blink.on = false;
  } else {
    blink.on = true;
  }
  if (dudo > 0) {
    if (blink.on) {
      menu.insanoPicture = Math.floor(random.fx() * 6);
      if (menu.insanoPicture == 6) {
        menu.insanoPicture = 5;
      }
    }
    dudo--;
  } else {
    menu.insanoPicture = 2;
  }
  rd.drawImage(
    images.insano[menu.insanoPicture],
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
    drawButton({
      id: 3,
      x: 730 * fm,
      y: topo + 410 * fm - 65 * view.scale,
      width: 500,
      height: 60,
      faceTop: "#0075D8",
      faceBottom: "#299DFF",
      shadowTop: "#003F74",
      shadowBottom: "#006AC4",
      layout: BUTTON.textOnly,
      text: "Yes!  Reset my game now",
      fontSize: 20,
      textOpacity: 0.9,
      image: null,
      imageOpacity: 0,
      pulsing: false,
    })
  ) {
    game.unlocked = 1;
    track.stage = game.unlocked;
    saveSetting("unlocked", game.unlocked);
    game.carTypes[0] = 5;
    saveSetting("carsel", game.carTypes[0]);
    canreset = false;
    game.phase = PHASE.mainMenu;
  }
  if (
    drawButton({
      id: 4,
      x: 240 * fm + 100 * view.scale,
      y: topo + 560 * fm - 65 * view.scale,
      width: 200,
      height: 60,
      faceTop: "#0075D8",
      faceBottom: "#299DFF",
      shadowTop: "#003F74",
      shadowBottom: "#006AC4",
      layout: BUTTON.imageThenText,
      text: " Cancel",
      fontSize: 18,
      textOpacity: 0.9,
      image: images.buttons[3],
      imageOpacity: 0.9,
      pulsing: false,
    })
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
  var perc = loading.loaded / loading.total;
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

var slide = 80;
var slideto = 0;
var slidedir = false;
var swing = 0;
var swingto = 45;
var swingdir = false;
function drawswitch() {
  rd.clearRect(0, 0, view.width, view.height);
  if (raceEvents.switcnt == 0) {
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
  if (raceEvents.switcnt < 20) {
    camera.pitch = 10;
    var kcxz = racers[camera.target].cxz - 180 + swing;
    camera.yaw = kcxz;
    camera.x = car[camera.target].x - slide * msin(kcxz);
    camera.z = car[camera.target].z + slide * mcos(kcxz);
    camera.y = car[camera.target].y + 25;
  }
  if (raceEvents.switcnt >= 20 && raceEvents.switcnt < 100) {
    var fcs1 = 100 - raceEvents.switcnt;
    var fcs2 = raceEvents.switcnt - 20;
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
  if (raceEvents.switcnt >= 100) {
    camera.pitch = 10;
    var kcxz = racers[camera.nextTarget].cxz - 180 + swing;
    camera.yaw = kcxz;
    camera.x = car[camera.nextTarget].x - slide * msin(kcxz);
    camera.z = car[camera.nextTarget].z + slide * mcos(kcxz);
    camera.y = car[camera.nextTarget].y + 25;
  }
  if (raceEvents.switcnt >= 100) {
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
  if (raceEvents.switcnt == 10) {
    playSound(38, 1);
  }
  if (raceEvents.switcnt >= 10 && raceEvents.switcnt < 90) {
    if (tflk) {
      drawCenteredText(132, "SWITCHING CARS", 0, 0, 0, TEXT.title);
      tflk = false;
    } else {
      drawCenteredText(132, "SWITCHING CARS", 0, 64, 128, TEXT.title);
      tflk = true;
    }
    if (tflk) {
      drawCenteredText(192, "Laps Reset, Time +10", 0, 0, 0, TEXT.label);
    } else {
      drawCenteredText(192, "Laps Reset, Time +10", 0, 128, 255, TEXT.label);
    }
    var duds = 0;
    if (raceEvents.switcnt >= 10 && raceEvents.switcnt < 15) {
      duds = 5;
    }
    if (raceEvents.switcnt >= 15 && raceEvents.switcnt < 20) {
      duds = 4;
    }
    if (raceEvents.switcnt >= 20 && raceEvents.switcnt < 25) {
      duds = 3;
    }
    if (raceEvents.switcnt >= 25 && raceEvents.switcnt < 30) {
      duds = 2;
    }
    if (raceEvents.switcnt >= 30 && raceEvents.switcnt < 40) {
      duds = 1;
    }
    if (raceEvents.switcnt >= 40) {
      duds = 0;
    }
    rd.globalAlpha = 0.6;
    rd.drawImage(
      images.insano[duds],
      490 * view.scaleX - 230 * view.scale,
      10 * view.scaleY,
      274 * view.scale * 0.7,
      341 * view.scale * 0.7,
    );
    rd.globalAlpha = 1;
  }
  raceEvents.switcnt++;
  if (raceEvents.switcnt == 125) {
    raceEvents.onlastcheck = false;
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
    raceEvents.iclear = 0;
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
  if (raceEvents.switcnt == 5) {
    playSound(41, 1);
  }
  if (raceEvents.switcnt >= 10 && raceEvents.switcnt < 90) {
    if (tflk) {
      drawCenteredText(132, "Reversing Time", 0, 0, 0, TEXT.title);
      tflk = false;
    } else {
      drawCenteredText(132, "Reversing Time", 0, 64, 128, TEXT.title);
      tflk = true;
    }
    var duds = 0;
    if (raceEvents.switcnt >= 10 && raceEvents.switcnt < 15) {
      duds = 5;
    }
    if (raceEvents.switcnt >= 15 && raceEvents.switcnt < 20) {
      duds = 4;
    }
    if (raceEvents.switcnt >= 20 && raceEvents.switcnt < 25) {
      duds = 3;
    }
    if (raceEvents.switcnt >= 25 && raceEvents.switcnt < 30) {
      duds = 2;
    }
    if (raceEvents.switcnt >= 30 && raceEvents.switcnt < 40) {
      duds = 1;
    }
    if (raceEvents.switcnt >= 40) {
      duds = 0;
    }
    rd.globalAlpha = 0.6;
    rd.drawImage(
      images.insano[duds],
      490 * view.scaleX - 230 * view.scale,
      10 * view.scaleY,
      274 * view.scale * 0.7,
      341 * view.scale * 0.7,
    );
    rd.globalAlpha = 1;
  }
  if (Math.abs(recording.fr - (429 - recording.nrec)) > 30) {
    if (Math.abs(recording.fr - (429 - recording.nrec)) > 100) {
      if (raceEvents.switcnt % 30 == 0) {
        playSound(42, 1);
      }
    } else {
      if (raceEvents.switcnt % 50 == 0) {
        playSound(42, 1);
      }
    }
  }
  raceEvents.switcnt++;
  timeTube.mat = resetMatrix(timeTube.mat);
  mat4.rotate(
    timeTube.mat,
    timeTube.mat,
    camera.yaw * (Math.PI / 180),
    [0, -1, 0],
  );
  mat4.rotate(
    timeTube.mat,
    timeTube.mat,
    camera.pitch * (Math.PI / 180),
    [-1, 0, 0],
  );
  mat4.rotate(timeTube.mat, timeTube.mat, swing * (Math.PI / 180), [0, 0, 1]);
  if (Math.abs(recording.fr - (429 - recording.nrec)) > 100) {
    swing += 20;
  } else {
    swing += 10;
  }
  if (swing > 360) {
    swing -= 360;
  }
  timeTube.x = car[camera.target].x - timeTube.mat[8] * 170;
  timeTube.y = car[camera.target].y - timeTube.mat[9] * 170;
  timeTube.z = car[camera.target].z - timeTube.mat[10] * 170;
}
var wasu = false,
  wasd = false,
  wasl = false,
  wasr = false,
  wash = false,
  wast = false;

var timer = 800;

var arrace = false;
var ana = 0,
  cntan = 0,
  cntovn = 0;
var flk = false;

var gocnt = 0;
var gocntdrop = 0;
var looped = 1;

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

var pwcnt = 0;
var pwflk = false;
var dmcnt = 0;
var dmflk = false;

var dested = [];
var onbreplay = 0;

var cntkeys = 0;
function inishinter() {
  game.player = 0;
  track.switchtime = 800;
  timer = track.switchtime;
  raceEvents.oncheckpoint = -1;
  raceEvents.onlastcheck = false;
  raceEvents.checkpointFlash = 0;
  arrace = false;
  ana = 0;
  cntan = 0;
  cntovn = 0;
  raceEvents.tcnt = 30;
  wasay = false;
  pwcnt = 0;
  raceEvents.auscnt = 45;
  raceEvents.countdown = 186;
  gocnt = 0;
  gocntdrop = 0;
  raceEvents.iclear = 0;
  for (var i = 0; i < MAX_CARS; i++) {
    dested[i] = 0;
  }
  raceEvents.holdcnt = 0;
  camera.mode = 0;
  camera.target = 0;
  recording.onpausefr = false;
  raceEvents.cntwis = 0;
  dmcnt = 0;
  onbreplay = 0;
  buttons.pulseWidth = 2;
  buttons.pulseHeight = 0.5;
  for (var i = 0; i < MAX_CARS; i++) {
    racers[i].u.arrace = false;
    racers[i].u.zyinv = false;
  }
}
function drawinter() {
  rd.clearRect(0, 0, view.width, view.height);
  var showpcn = isPhone;
  if (
    showpcn &&
    raceEvents.countdown > 65 &&
    track.stage == 2 &&
    game.unlocked == 2
  ) {
    showpcn = false;
  }
  if (
    showpcn &&
    raceEvents.countdown > 65 &&
    track.stage == 4 &&
    game.unlocked == 4
  ) {
    showpcn = false;
  }
  if (showpcn) {
    if (wasl) {
      rd.globalAlpha = 0.4;
    }
    rd.drawImage(
      images.touchControls[0],
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
      images.touchControls[1],
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
      images.touchControls[3],
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
      images.touchControls[2],
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
      images.touchControls[4],
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
        images.touchControls[5],
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
    drawCenteredText(132, "You Wasted'em!", 0, 0, 0, TEXT.title);
    if (blink.on) {
      drawCenteredText(
        192,
        "You Won, all cars have been wasted!",
        0,
        0,
        0,
        TEXT.small,
      );
      blink.on = false;
    } else {
      drawCenteredText(
        192,
        "You Won, all cars have been wasted!",
        0,
        128,
        255,
        TEXT.small,
      );
      blink.on = true;
    }
    if (!track.haltall) {
      playSound(33, 1);
    }
    track.haltall = true;
    holdit = true;
    raceEvents.winner = true;
  }
  if (!holdit) {
    if (racers[game.player].dest && raceEvents.cntwis == 16) {
      drawCenteredText(132, "You're Wasted!", 0, 0, 0, TEXT.title);
      holdit = true;
      raceEvents.winner = false;
    }
  }
  if (racers[game.player].cntdest != 0 && raceEvents.cntwis < 16) {
    raceEvents.cntwis++;
    if (raceEvents.cntwis == 1) {
      playSound(31, 1);
    }
    if (raceEvents.cntwis == 16) {
      playSound(30, 1);
    }
  }
  if (!holdit) {
    for (var i = 0; i < game.carCount; i++) {
      if (track.clear[i] == track.nlaps * track.nsp && track.pos[i] == 0) {
        if (i == game.player) {
          drawCenteredText(132, "You Won!", 0, 0, 0, TEXT.title);
          if (blink.on) {
            drawCenteredText(
              192,
              "You finished first, nice job!",
              0,
              0,
              0,
              TEXT.small,
            );
            blink.on = false;
          } else {
            drawCenteredText(
              192,
              "You finished first, nice job!",
              0,
              128,
              255,
              TEXT.small,
            );
            blink.on = true;
          }
          raceEvents.winner = true;
          if (!track.haltall) {
            playSound(32, 1);
          }
        } else {
          drawCenteredText(132, "You Lost!", 0, 0, 0, TEXT.title);
          if (blink.on) {
            drawCenteredText(
              192,
              "" +
                carStats.names[game.carTypes[i]] +
                " finished first, race over!",
              0,
              0,
              0,
              TEXT.small,
            );
            blink.on = false;
          } else {
            drawCenteredText(
              192,
              "" +
                carStats.names[game.carTypes[i]] +
                " finished first, race over!",
              0,
              128,
              255,
              TEXT.small,
            );
            blink.on = true;
          }
          raceEvents.winner = false;
        }
        track.haltall = true;
        holdit = true;
      }
    }
  }
  if (holdit) {
    if (raceEvents.holdcnt == 0) {
      if (
        raceEvents.winner &&
        game.unlocked == track.stage &&
        game.carCount != 1 &&
        track.stage != 17
      ) {
        saveSetting("unlocked", game.unlocked + 1);
      }
    }
    raceEvents.holdcnt++;
    var exitnow = false;
    if (racers[game.player].u.handb && raceEvents.holdcnt > 50) {
      exitnow = true;
      racers[game.player].u.handb = false;
    }
    if (confirm.state == CONFIRM.pressed) {
      exitnow = true;
      confirm.state = CONFIRM.used;
    }
    if (
      drawButton({
        id: 7,
        x: 640 * view.scaleX,
        y: view.height - 60 * view.scale - 40 * view.scaleY,
        width: 250,
        height: 60,
        faceTop: "#019DFF",
        faceBottom: "#01BAFF",
        shadowTop: "#004A78",
        shadowBottom: "#015777",
        layout: BUTTON.textThenImage,
        text: "Continue ",
        fontSize: 20,
        textOpacity: 0.8,
        image: images.buttons[1],
        imageOpacity: 0.8,
        pulsing: false,
      })
    ) {
      exitnow = true;
    }
    /*if (winner){if (holdcnt==150) { exitnow=true; }}else{if (drawbutton(7,(640*mw),(canh-(55*avm)-(20*mh)),270,60,"#89C800","#CADC00","#4B6E00","#778200",0,"Continue ",20,0.8,btimg[1],0.8,false)) { exitnow=true; }}*/ if (
      exitnow
    ) {
      if (recording.htyp) {
        onbreplay = 2;
      } else {
        startRaceEnd();
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
    if (raceEvents.holdcnt != 0) {
      raceEvents.holdcnt = 0;
    }
    if (confirm.state == CONFIRM.pressed && raceEvents.countdown <= 65) {
      confirm.state = CONFIRM.used;
      pauseMenu.selected = 0;
      stopStageMusic();
      stopEngine();
      game.phase = PHASE.paused;
    }
  }
  if (raceEvents.countdown <= 65) {
    if (game.mode == 1 && raceEvents.countdown == 0 && !holdit) {
      timer--;
      var minutes = Math.floor(timer / 800);
      var seconds = Math.floor((timer / 800 - minutes) * 60);
      var adlz = "";
      if (seconds < 10) {
        adlz = "0";
      }
      drawCenteredText(
        670,
        "0" + minutes + ":" + adlz + "" + seconds,
        0,
        0,
        0,
        TEXT.heading,
      );
      if (timer == 120 || timer == 90 || timer == 60 || timer == 30) {
        playSound(39, 1);
      }
      if (timer == 0) {
        playSound(40, 1);
        createswitches();
        raceEvents.switcnt = 0;
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
        raceEvents.tcnt = -5;
      }
      if (!arrace) {
        wasay = false;
        say = " Arrow now pointing at >  TRACK";
        raceEvents.tcnt = -5;
        cntan = 20;
      }
    }
    if (
      !holdit &&
      raceEvents.countdown == 0 &&
      camera.mode == 0 &&
      track.stage != 16
    ) {
      arrow(racers[game.player].point, racers[game.player].missedcp, arrace);
      if (
        !arrace &&
        raceEvents.auscnt == 45 &&
        racers[game.player].capcnt == 0
      ) {
        if (racers[game.player].missedcp > 0) {
          if (
            racers[game.player].missedcp > 15 &&
            racers[game.player].missedcp < 50
          ) {
            if (flk) {
              drawCenteredText(
                112,
                "Check Point Missed!",
                255,
                0,
                0,
                TEXT.label,
              );
            } else {
              drawCenteredText(
                112,
                "Check Point Missed!",
                255,
                128,
                0,
                TEXT.faintLabel,
              );
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
                drawCenteredText(112, "Wrong Way!", 255, 128, 0, TEXT.label);
                flk = false;
              } else {
                drawCenteredText(112, "Wrong Way!", 255, 0, 0, TEXT.faintLabel);
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
          drawButton({
            id: 1,
            x: 80 * view.scale,
            y: 90 * view.scale,
            width: 100,
            height: 60,
            faceTop: "#7DBDFF",
            faceBottom: "#7872FF",
            shadowTop: "#1767B9",
            shadowBottom: "#2018C2",
            layout: BUTTON.textThenImage,
            text: "A",
            fontSize: 22,
            textOpacity: 0.76,
            image: images.buttons[0],
            imageOpacity: 1,
            pulsing: false,
          })
        ) {
          racers[game.player].u.arrace = false;
        }
      } else {
        if (
          drawButton({
            id: 1,
            x: 80 * view.scale,
            y: 90 * view.scale,
            width: 100,
            height: 60,
            faceTop: "#89C800",
            faceBottom: "#CADC00",
            shadowTop: "#4B6E00",
            shadowBottom: "#778200",
            layout: BUTTON.textThenImage,
            text: "A",
            fontSize: 22,
            textOpacity: 0.76,
            image: images.buttons[0],
            imageOpacity: 1,
            pulsing: false,
          })
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
    drawMeter(
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
    if (raceEvents.auscnt < 45 && blink.on) {
      r = 128;
      g = 244;
      b = 255;
    }
    drawMeter(
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
    var onycl = touchArea(
      2,
      view.width - 87 * view.scale,
      10 * view.scale + adwn,
      77 * view.scale,
      53 * view.scale,
    );
    if (onycl != 2) {
      rd.drawImage(
        images.soundToggles[onycl],
        view.width - 87 * view.scale,
        10 * view.scale + adwn,
        77 * view.scale,
        53 * view.scale,
      );
    } else {
      if (!holdit) {
        pauseMenu.selected = 0;
        stopStageMusic();
        stopEngine();
        game.phase = PHASE.paused;
      }
    }
    onycl = touchArea(
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
      images.soundToggles[onycl],
      view.width - 77.5 * view.scale,
      73 * view.scale + adwn,
      58 * view.scale,
      42 * view.scale,
    );
    rd.globalAlpha = 1;
    onycl = touchArea(
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
      images.soundToggles[onycl],
      view.width - 77.5 * view.scale,
      125 * view.scale + adwn,
      58 * view.scale,
      42 * view.scale,
    );
    rd.globalAlpha = 1;
    if (!isPhone && track.stage >= 2 && cntkeys < 200 && game.carCount != 1) {
      if (slide < 10 || cntkeys > 100) {
        rd.drawImage(
          images.instructions[9],
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
    if (
      (raceEvents.countdown != 0 || gocntdrop > 4) &&
      raceEvents.countdown < 65
    ) {
      if (raceEvents.countdown == 63) {
        gocnt = 3;
        gocntdrop = 16;
        playSound(34, 1);
      }
      if (raceEvents.countdown == 41) {
        gocnt = 2;
        gocntdrop = 16;
        playSound(35, 1);
      }
      if (raceEvents.countdown == 24) {
        gocnt = 1;
        gocntdrop = 16;
        playSound(36, 1);
      }
      if (raceEvents.countdown == 2) {
        gocnt = 0;
        gocntdrop = 16;
        playSound(37, 1);
      }
      var duds = 0;
      if (raceEvents.countdown <= 63 && raceEvents.countdown > 52) {
        duds = 1;
      }
      if (raceEvents.countdown <= 41 && raceEvents.countdown > 32) {
        duds = 4;
      }
      if (raceEvents.countdown <= 24 && raceEvents.countdown > 13) {
        duds = 2;
      }
      if (raceEvents.countdown <= 2) {
        duds = 3;
      }
      if (raceEvents.countdown == 0 && gocntdrop < 7) {
        duds = 1;
      }
      rd.globalAlpha = 0.6;
      rd.drawImage(
        images.insano[duds],
        640 * view.scaleX - 230 * view.scale,
        10 * view.scaleY,
        274 * view.scale * 0.7,
        341 * view.scale * 0.7,
      );
      rd.globalAlpha = 1;
    }
    if (gocntdrop != 0) {
      if (gocnt != 0) {
        drawCenteredText(100, "" + gocnt, 0, 0, 0, TEXT.title);
      } else {
        drawCenteredText(100, "Go!", 0, 0, 0, TEXT.title);
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
        raceEvents.tcnt == 30 &&
        raceEvents.auscnt == 45 &&
        racers[game.player].mtouch &&
        racers[game.player].capcnt == 0
      ) {
        if (looped != 3) {
          if (pwcnt < 70 || (pwcnt < 100 && looped != 0)) {
            if (pwflk) {
              drawCenteredText(
                176,
                "Power low, perform stunt!",
                0,
                0,
                200,
                TEXT.small,
              );
              pwflk = false;
            } else {
              drawCenteredText(
                176,
                "Power low, perform stunt!",
                255,
                100,
                0,
                TEXT.small,
              );
              pwflk = true;
            }
          }
        } else {
          if (pwcnt < 100) {
            if (pwflk) {
              drawCenteredText(
                176,
                "Try to flip your car in the air to preform stunts!",
                0,
                0,
                200,
                TEXT.small,
              );
              pwflk = false;
            } else {
              drawCenteredText(
                176,
                "Try to flip your car in the air to preform stunts!",
                255,
                100,
                0,
                TEXT.small,
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
      if (raceEvents.tcnt < 30) {
        if (tflk) {
          drawCenteredText(167, say, 0, 0, 0, TEXT.label);
          tflk = false;
        } else {
          if (!wasay) {
            drawCenteredText(167, say, 0, 128, 255, TEXT.label);
          } else {
            drawCenteredText(167, say, 255, 128, 0, TEXT.label);
          }
          tflk = true;
        }
        if (tick.fraction >= tick.scale) {
          raceEvents.tcnt++;
        }
      } else {
        if (wasay) {
          wasay = false;
        }
      }
      if (raceEvents.auscnt < 45) {
        if (blink.on) {
          drawCenteredText(136, asay, 59, 156, 255, TEXT.small);
          blink.on = false;
        } else {
          drawCenteredText(136, asay, 0, 107, 216, TEXT.small);
          blink.on = true;
        }
        if (tick.fraction >= tick.scale) {
          raceEvents.auscnt++;
        }
      }
    } else {
      if (tflk) {
        drawCenteredText(176, "Bad Landing!", 0, 0, 200, TEXT.label);
        tflk = false;
      } else {
        drawCenteredText(176, "Bad Landing!", 255, 100, 0, TEXT.label);
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
        raceEvents.auscnt -= 15;
      }
      if (loopin != "") {
        raceEvents.auscnt -= 25;
      }
      if (spin != "") {
        raceEvents.auscnt -= 25;
      }
      if (lp != 0) {
        raceEvents.auscnt -= 25;
      }
      if (raceEvents.auscnt < 45) {
        playSound(27, 1);
        if (raceEvents.onautocorrect) {
          raceEvents.onautocorrect--;
        }
        if (raceEvents.auscnt < -20) {
          raceEvents.auscnt = -20;
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
          raceEvents.tcnt = raceEvents.auscnt;
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
        raceEvents.tcnt = 0;
      }
    }
    if (game.carCount != 1) {
      for (var i = 0; i < game.carCount; i++) {
        if (dested[i] != track.dested[i] && i != game.player) {
          dested[i] = track.dested[i];
          if (dested[i] == 1) {
            wasay = true;
            say = "" + carStats.names[game.carTypes[i]] + " has been wasted!";
            raceEvents.tcnt = -15;
          }
          if (dested[i] == 2) {
            wasay = true;
            say = "You wasted " + carStats.names[game.carTypes[i]] + "!";
            raceEvents.tcnt = -15;
          }
        }
      }
    }
    if (
      raceEvents.iclear != racers[game.player].clear &&
      racers[game.player].clear != 0
    ) {
      if (!wasay) {
        say = "Check Point";
        raceEvents.tcnt = 15;
      }
      raceEvents.iclear = racers[game.player].clear;
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
  if (raceEvents.countdown > 130) {
    if (pwflk) {
      menu.insanoPicture = Math.floor(random.fx() * 6);
      if (menu.insanoPicture == 6) {
        menu.insanoPicture = 5;
      }
    }
  } else {
    menu.insanoPicture = 2;
  }
  rd.drawImage(
    images.insano[menu.insanoPicture],
    10 * fm,
    topo,
    274 * fm * 0.7,
    341 * fm * 0.7,
  );
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
      images.instructions[4],
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
    drawMeter(
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
      drawButton({
        id: 1,
        x: 200 * fm + 240 * fm,
        y: topo + 130 * fm,
        width: 100,
        height: 60,
        faceTop: "#89C800",
        faceBottom: "#CADC00",
        shadowTop: "#4B6E00",
        shadowBottom: "#778200",
        layout: BUTTON.textThenImage,
        text: "A",
        fontSize: 22,
        textOpacity: 0.76,
        image: images.buttons[0],
        imageOpacity: 1,
        pulsing: false,
      });
    } else {
      rd.drawImage(
        images.touchControls[5],
        200 * fm + 165 * fm,
        topo + 130 * fm,
        154 * view.scale,
        111 * view.scale,
      );
    }
    rd.drawImage(
      images.instructions[8],
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
    drawButton({
      id: 1,
      x: view.width - 100 * view.scale - 30 * view.scaleX,
      y: view.height - 60 * view.scale - 30 * view.scaleY,
      width: 170,
      height: 60,
      faceTop: "#019DFF",
      faceBottom: "#01EAFF",
      shadowTop: "#004A78",
      shadowBottom: "#016D77",
      layout: BUTTON.textThenImage,
      text: "Exit ",
      fontSize: 20,
      textOpacity: 0.7,
      image: images.buttons[1],
      imageOpacity: 0.7,
      pulsing: false,
    })
  ) {
    onbreplay = 2;
  }
  if (confirm.state == CONFIRM.pressed) {
    onbreplay = 2;
    confirm.state = CONFIRM.used;
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
      drawCenteredText(90, "Stunts!", 0, 32, 64, TEXT.label);
    } else {
      drawCenteredText(90, "Best Stunt!", 0, 32, 64, TEXT.label);
    }
    if (recording.rmode == 98) {
      if (
        recording.holdf == 4 ||
        recording.holdf == 7 ||
        recording.holdf == 44 ||
        recording.holdf == 47 ||
        recording.holdf == 94 ||
        recording.holdf == 97
      ) {
        rd.globalAlpha = 0.5;
        rd.fillStyle = "#FFFFFF";
        rd.fillRect(0, 0, view.width, view.height);
        rd.globalAlpha = 1;
      }
    }
    if (recording.rmode == 43) {
      if (recording.holdf >= 1 && recording.holdf < 43) {
        if (recording.holdf % Math.floor(2 + random.fx() * 3) == 0 && !lwit) {
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
    if (recording.fr > recording.hat && recording.holdf != recording.rmode) {
      recording.holdf++;
    }
    camera.mode = 1;
    camera.target = recording.hcim;
    recording.onpausefr = false;
    if (recording.holdf == 0 || recording.holdf == recording.rmode) {
      recording.fr++;
      if (recording.fr == 430) {
        recording.fr = 0;
        recording.holdf = 0;
        hrewindhreplay();
        cntreps++;
      }
    } else {
      recording.onpausefr = true;
    }
  }
  if (recording.htyp == 2) {
    drawCenteredText(90, "Wasted!", 0, 32, 64, TEXT.label);
    if (recording.rmode == 95) {
      if (
        recording.holdf == 4 ||
        recording.holdf == 44 ||
        recording.holdf == 94
      ) {
        rd.globalAlpha = 0.5;
        rd.fillStyle = "#FFFFFF";
        rd.fillRect(0, 0, view.width, view.height);
        rd.globalAlpha = 1;
      }
    }
    if (recording.fr > recording.hat && recording.holdf != recording.rmode) {
      recording.holdf++;
    }
    camera.mode = 1;
    camera.target = recording.hcim;
    recording.onpausefr = false;
    if (recording.holdf == 0 || recording.holdf == recording.rmode) {
      recording.fr++;
      if (recording.fr == 430) {
        recording.fr = 0;
        recording.holdf = 0;
        hrewindhreplay();
        cntreps++;
      }
    } else {
      recording.onpausefr = true;
    }
  }
  if (recording.htyp == 3) {
    drawCenteredText(90, "You Wasted'em!", 0, 32, 64, TEXT.label);
    if (recording.holdf == 13 || recording.holdf == 16) {
      rd.globalAlpha = 0.5;
      rd.fillStyle = "#FFFFFF";
      rd.fillRect(0, 0, view.width, view.height);
      rd.globalAlpha = 1;
    }
    if (recording.holdf == 0) {
      camera.mode = 1;
      camera.target = recording.hcim;
    }
    if (recording.holdf > 0 && recording.holdf < 30) {
      camera.mode = 3;
      camera.target = recording.hcim;
      camera.nextTarget = recording.hscar;
      camera.transition = recording.holdf;
    }
    if (recording.holdf == 30) {
      camera.mode = 1;
      camera.target = recording.hscar;
    }
    if (recording.fr > recording.hat && recording.holdf != 30) {
      recording.holdf++;
    }
    recording.onpausefr = false;
    if (recording.holdf == 0 || recording.holdf == 30) {
      recording.fr++;
      if (recording.fr == 430) {
        recording.fr = 0;
        recording.holdf = 0;
        hrewindhreplay();
        cntreps++;
      }
    } else {
      recording.onpausefr = true;
    }
  }
  if (recording.htyp == 4) {
    drawCenteredText(90, "Close Finish!", 0, 32, 64, TEXT.label);
    if (recording.holdf == 0) {
      camera.mode = 1;
      camera.target = recording.hcim;
    }
    if (recording.holdf > 0 && recording.holdf < 30) {
      camera.mode = 3;
      camera.target = recording.hcim;
      camera.nextTarget = recording.hscar;
      camera.transition = recording.holdf;
    }
    if (recording.holdf == 30) {
      camera.mode = 1;
      camera.target = recording.hscar;
    }
    if (recording.holdf > 30 && recording.holdf < 60) {
      camera.mode = 3;
      camera.target = recording.hscar;
      camera.nextTarget = 0;
      camera.transition = recording.holdf - 30;
    }
    if (recording.holdf == 60) {
      camera.mode = 1;
      camera.target = recording.hcim;
    }
    if (recording.holdf > 60 && recording.holdf < 90) {
      camera.mode = 3;
      camera.target = recording.hcim;
      camera.nextTarget = recording.hscar;
      camera.transition = recording.holdf - 60;
    }
    if (recording.holdf == 90) {
      camera.mode = 1;
      camera.target = recording.hscar;
    }
    if (recording.fr > 228 && recording.holdf < 30) {
      recording.holdf++;
    }
    if (recording.fr > 328 && recording.holdf < 60) {
      recording.holdf++;
    }
    if (recording.fr > 400 && recording.holdf < 90) {
      recording.holdf++;
    }
    recording.onpausefr = false;
    if (
      recording.holdf == 0 ||
      recording.holdf == 30 ||
      recording.holdf == 60 ||
      recording.holdf == 90
    ) {
      recording.fr++;
      if (recording.fr == 430) {
        recording.fr = 0;
        recording.holdf = 0;
        hrewindhreplay();
        cntreps++;
      }
    } else {
      recording.onpausefr = true;
    }
  }
  if (recording.htyp == 5) {
    drawCenteredText(
      90,
      "Close Finish!  Almost got it!",
      0,
      32,
      64,
      TEXT.label,
    );
    if (recording.holdf == 0) {
      camera.mode = 1;
      camera.target = recording.hcim;
    }
    if (recording.holdf > 0 && recording.holdf < 30) {
      camera.mode = 3;
      camera.target = recording.hcim;
      camera.nextTarget = recording.hscar;
      camera.transition = recording.holdf;
    }
    if (recording.holdf == 30) {
      camera.mode = 1;
      camera.target = recording.hscar;
    }
    if (recording.holdf > 30 && recording.holdf < 60) {
      camera.mode = 3;
      camera.target = recording.hscar;
      camera.nextTarget = 0;
      camera.transition = recording.holdf - 30;
    }
    if (recording.holdf == 60) {
      camera.mode = 1;
      camera.target = recording.hcim;
    }
    if (recording.holdf > 60 && recording.holdf < 90) {
      camera.mode = 3;
      camera.target = recording.hcim;
      camera.nextTarget = recording.hscar;
      camera.transition = recording.holdf - 60;
    }
    if (recording.holdf == 90) {
      camera.mode = 1;
      camera.target = recording.hscar;
    }
    if (recording.holdf > 90 && recording.holdf < 120) {
      camera.mode = 3;
      camera.target = recording.hscar;
      camera.nextTarget = 0;
      camera.transition = recording.holdf - 90;
    }
    if (recording.holdf == 120) {
      camera.mode = 1;
      camera.target = recording.hcim;
    }
    if (recording.fr > 128 && recording.holdf < 30) {
      recording.holdf++;
    }
    if (recording.fr > 228 && recording.holdf < 60) {
      recording.holdf++;
    }
    if (recording.fr > 328 && recording.holdf < 90) {
      recording.holdf++;
    }
    if (recording.fr > 400 && recording.holdf < 120) {
      recording.holdf++;
    }
    recording.onpausefr = false;
    if (
      recording.holdf == 0 ||
      recording.holdf == 30 ||
      recording.holdf == 60 ||
      recording.holdf == 90 ||
      recording.holdf == 120
    ) {
      recording.fr++;
      if (recording.fr == 430) {
        recording.fr = 0;
        recording.holdf = 0;
        hrewindhreplay();
        cntreps++;
      }
    } else {
      recording.onpausefr = true;
    }
  }
  if (cntreps == 2 && recording.fr == 427) {
    startRaceEnd();
    game.phase = PHASE.raceEnd;
  }
  if (confirm.state == CONFIRM.pressed) {
    confirm.state = CONFIRM.used;
    startRaceEnd();
    game.phase = PHASE.raceEnd;
  }
  if (
    drawButton({
      id: 1,
      x: view.width - 100 * view.scale - 30 * view.scaleX,
      y: view.height - 60 * view.scale - 30 * view.scaleY,
      width: 170,
      height: 60,
      faceTop: "#019DFF",
      faceBottom: "#01BAFF",
      shadowTop: "#004A78",
      shadowBottom: "#015777",
      layout: BUTTON.textThenImage,
      text: "Skip ",
      fontSize: 20,
      textOpacity: 0.7,
      image: images.buttons[1],
      imageOpacity: 0.7,
      pulsing: false,
    }) ||
    (pointer.down && track.stage == 1 && game.unlocked == 1)
  ) {
    startRaceEnd();
    game.phase = PHASE.raceEnd;
  }
  if (recording.fr >= 428) {
    rd.globalAlpha = 0.7;
    rd.fillStyle = "#000000";
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
  }
}
// The original drew the tilt of the race end screen here, while loading; it is drawn again
// before it shows. The draw stays so the randomness after it is as it was.
random.fx();
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
        drawButton({
          id: 1,
          x: lefy + 120 * view.scale,
          y: 430 * view.scaleY,
          width: 140,
          height: 47,
          faceTop: "#4B00F6",
          faceBottom: "#CB81FF",
          shadowTop: "#0600F6",
          shadowBottom: "#5700F6",
          layout: BUTTON.imageThenText,
          text: " Prev",
          fontSize: 15,
          textOpacity: 0.9,
          image: images.buttons[3],
          imageOpacity: 0.9,
          pulsing: false,
        })
      ) {
        nextc = -1;
        flyout = 2;
      }
      if ((handson > 10 && handson < 20) || (handson > 30 && handson < 40)) {
        rd.drawImage(
          images.instructions[10],
          lefy + 120 * view.scale,
          430 * view.scaleY + 30 * view.scale,
          56 * view.scale,
          62 * view.scale,
        );
      }
    }
    if (game.carTypes[0] != 18) {
      if (
        drawButton({
          id: 2,
          x: rigy - 120 * view.scale,
          y: 430 * view.scaleY,
          width: 140,
          height: 47,
          faceTop: "#4B00F6",
          faceBottom: "#CB81FF",
          shadowTop: "#0600F6",
          shadowBottom: "#5700F6",
          layout: BUTTON.textThenImage,
          text: "Next ",
          fontSize: 15,
          textOpacity: 0.9,
          image: images.buttons[2],
          imageOpacity: 0.9,
          pulsing: false,
        })
      ) {
        nextc = 1;
        flyout = 2;
      }
      if ((handson > 50 && handson < 60) || (handson > 70 && handson < 80)) {
        rd.drawImage(
          images.instructions[10],
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
      strokePolygon(xp, yp, 4);
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
      strokePolygon(xp, yp, 4);
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
      strokePolygon(xp, yp, 4);
      rd.drawImage(
        images.loadingBarLeft,
        640 * view.scaleX - 300 * view.scaleY - 3 * view.scaleY,
        560 * view.scaleY,
        6 * view.scaleY,
        111 * view.scaleY,
      );
      rd.drawImage(
        images.loadingBarLeft,
        640 * view.scaleX - 120 * view.scaleY - 3 * view.scaleY,
        600 * view.scaleY,
        6 * view.scaleY,
        111 * view.scaleY,
      );
      rd.drawImage(
        images.loadingBarRight,
        640 * view.scaleX + 120 * view.scaleY - 3 * view.scaleY,
        600 * view.scaleY,
        6 * view.scaleY,
        111 * view.scaleY,
      );
      rd.drawImage(
        images.loadingBarRight,
        640 * view.scaleX + 300 * view.scaleY - 3 * view.scaleY,
        560 * view.scaleY,
        6 * view.scaleY,
        111 * view.scaleY,
      );
      rd.drawImage(
        images.locked,
        640 * view.scaleX - 29 * view.scaleY,
        619 * view.scaleY,
        58 * view.scaleY,
        72 * view.scaleY,
      );
    }
    if (!clocked) {
      if (
        drawButton({
          id: 3,
          x: rigy - 150 * view.scale,
          y: 720 * view.scaleY - 100 * view.scale,
          width: 200,
          height: 70,
          faceTop: "#0057E6",
          faceBottom: "#65EFFF",
          shadowTop: "#440078",
          shadowBottom: "#2F00A8",
          layout: BUTTON.textThenImage,
          text: "PLAY ",
          fontSize: 25,
          textOpacity: 0.9,
          image: images.buttons[1],
          imageOpacity: 0.9,
          pulsing: true,
        })
      ) {
        saveSetting("carsel", game.carTypes[0]);
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
          drawButton({
            id: 5,
            x: 640 * view.scaleX,
            y: 720 * view.scaleY - 90 * view.scale,
            width: 220,
            height: 60,
            faceTop: "#0057E6",
            faceBottom: "#65EFFF",
            shadowTop: "#440078",
            shadowBottom: "#2F00A8",
            layout: BUTTON.textOnly,
            text: "Practice ",
            fontSize: 22,
            textOpacity: 0.9,
            image: null,
            imageOpacity: 0,
            pulsing: false,
          })
        ) {
          saveSetting("carsel", game.carTypes[0]);
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
            images.instructions[10],
            640 * view.scaleX,
            720 * view.scaleY - 90 * view.scale + 25 * view.scale,
            56 * view.scale,
            62 * view.scale,
          );
        }
        if (confirm.state == CONFIRM.pressed) {
          saveSetting("carsel", game.carTypes[0]);
          pauseMenuMusic();
          track.stage = 2;
          stageloadtyp = 2;
          stageload = -1;
          game.phase = PHASE.stageLoading;
          handson = 167;
        }
      } else {
        if (confirm.state == CONFIRM.pressed) {
          saveSetting("carsel", game.carTypes[0]);
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
  if (!buttons.pulseWidthGrowing) {
    buttons.pulseWidth -= 0.03;
    if (buttons.pulseWidth < 0.5) {
      buttons.pulseWidth = 0.5;
      buttons.pulseWidthGrowing = true;
    }
  } else {
    buttons.pulseWidth += 0.03;
    if (buttons.pulseWidth > 2) {
      buttons.pulseWidth = 2;
      buttons.pulseWidthGrowing = false;
    }
  }
  if (!buttons.pulseHeightGrowing) {
    buttons.pulseHeight -= 0.5;
    if (buttons.pulseHeight < 0.1) {
      buttons.pulseHeight = 0.1;
      buttons.pulseHeightGrowing = true;
    }
  } else {
    buttons.pulseHeight += 0.5;
    if (buttons.pulseHeight > 2) {
      buttons.pulseHeight = 2;
      buttons.pulseHeightGrowing = false;
    }
  }
  drawMusicToggle();
}
var alipha = 0;
var bgsload = null;
var stageloadtyp = 0;
function stageloading() {
  rd.clearRect(0, 0, view.width, view.height);
  if (stageload == 0 && (menu.redraw || stageloadtyp == 2)) {
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
        menu.insanoPicture = 0;
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
      if (blink.on || flkun > 10) {
        rd.drawImage(
          images.locked,
          640 * view.scaleX - 29 * view.scaleY,
          250 * view.scaleY,
          58 * view.scaleY,
          72 * view.scaleY,
        );
      }
      if (blink.on) {
        blink.on = false;
      } else {
        blink.on = true;
      }
      flkun++;
      if (flkun == 30) {
        flkun = 0;
        blink.on = false;
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
      if (blink.on) {
        blink.on = false;
      } else {
        blink.on = true;
      }
      if (dudo > 50) {
        if (blink.on) {
          menu.insanoPicture = Math.floor(random.fx() * 6);
          if (menu.insanoPicture == 6) {
            menu.insanoPicture = 5;
          }
        }
      }
      dudo++;
      if (dudo >= 67) {
        dudo = 0;
      }
      rd.globalAlpha = 0.6;
      rd.drawImage(
        images.insano[menu.insanoPicture],
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
  strokeScaledPolygon(xsp, ysp, 50);
  rgb = hslToRgb(hsl[0], 1, 0.4);
  rd.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
  fillScaledShape(0, 0, xsp, ysp, 0, 17, 1280, 0);
  fillScaledShape(1280, 0, xsp, ysp, 16, 26, 1280, 720);
  fillScaledShape(1280, 720, xsp, ysp, 25, 42, 0, 720);
  fillScaledShape(0, 720, xsp, ysp, 41, 51, 0, 0);
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
      loadConfetti();
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
        drawButton({
          id: 9,
          x: 210 * view.scale,
          y: 130 * view.scaleY,
          width: 150,
          height: 56,
          faceTop: "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
          faceBottom: "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
          shadowTop: "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
          shadowBottom: "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
          layout: BUTTON.imageThenText,
          text: " Back",
          fontSize: 20,
          textOpacity: 0.7,
          image: images.buttons[5],
          imageOpacity: 0.7,
          pulsing: false,
        })
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
      if (
        drawButton({
          id: 11,
          x: view.width - 210 * view.scale,
          y: 130 * view.scaleY,
          width: 190,
          height: 56,
          faceTop: "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
          faceBottom: "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
          shadowTop: "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
          shadowBottom: "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
          layout: BUTTON.textOnly,
          text: `${game.raceCars} Cars  [C]`,
          fontSize: 20,
          textOpacity: 0.7,
          image: null,
          imageOpacity: 0,
          pulsing: false,
        })
      ) {
        nextRaceSize();
      }
      if (track.stage > 1) {
        if (
          drawButton({
            id: 3,
            x: 190 * view.scale,
            y: 360 * view.scaleY,
            width: 140,
            height: 47,
            faceTop: "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
            faceBottom: "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
            shadowTop: "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
            shadowBottom:
              "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
            layout: BUTTON.imageThenText,
            text: " Prev",
            fontSize: 15,
            textOpacity: 0.9,
            image: images.buttons[3],
            imageOpacity: 0.9,
            pulsing: false,
          })
        ) {
          track.stage--;
          stageload = -1;
          flkun = 1;
        }
      }
      if (track.stage < 17) {
        if (
          drawButton({
            id: 2,
            x: view.width - 190 * view.scale,
            y: 360 * view.scaleY,
            width: 140,
            height: 47,
            faceTop: "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
            faceBottom: "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
            shadowTop: "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
            shadowBottom:
              "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
            layout: BUTTON.textThenImage,
            text: "Next ",
            fontSize: 15,
            textOpacity: 0.9,
            image: images.buttons[2],
            imageOpacity: 0.9,
            pulsing: false,
          })
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
            drawButton({
              id: 6,
              x: 70 * view.scaleX + 357 * view.scale,
              y: 720 * view.scaleY - 157 * view.scale,
              width: 120,
              height: 60,
              faceTop: "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
              faceBottom:
                "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
              shadowTop: "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
              shadowBottom:
                "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
              layout: BUTTON.textOnly,
              text: "TIP ",
              fontSize: 22,
              textOpacity: 0.9,
              image: null,
              imageOpacity: 0,
              pulsing: false,
            })
          ) {
            ontip = true;
            dudo = 0;
          }
        } else {
          if (track.stage == 1 || track.stage == 2) {
            if (
              drawButton({
                id: 8,
                x: view.width - 510 * view.scale,
                y: 720 * view.scaleY - 180 * view.scale,
                width: 220,
                height: 60,
                faceTop: "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
                faceBottom:
                  "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
                shadowTop:
                  "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
                shadowBottom:
                  "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
                layout: BUTTON.textOnly,
                text: "Practice ",
                fontSize: 22,
                textOpacity: 0.9,
                image: null,
                imageOpacity: 0,
                pulsing: false,
              })
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
          drawButton({
            id: 10,
            x: view.width - 550 * view.scale,
            y: 720 * view.scaleY - 190 * view.scale,
            width: 300,
            height: 70,
            faceTop: "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
            faceBottom: "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
            shadowTop: "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
            shadowBottom:
              "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
            layout: BUTTON.textThenImage,
            text: "PLAY SWITCH ",
            fontSize: 20,
            textOpacity: 0.9,
            image: images.buttons[1],
            imageOpacity: 0.9,
            pulsing: true,
          })
        ) {
          applyracecars();
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
      if (
        drawButton({
          id: 1,
          x: view.width - 220 * view.scale,
          y: 720 * view.scaleY - 190 * view.scale,
          width: 200,
          height: 70,
          faceTop: "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
          faceBottom: "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
          shadowTop: "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
          shadowBottom: "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
          layout: BUTTON.textThenImage,
          text: "PLAY ",
          fontSize: 25,
          textOpacity: 0.9,
          image: images.buttons[1],
          imageOpacity: 0.9,
          pulsing: true,
        })
      ) {
        applyracecars();
        game.mode = 0;
        pauseMenuMusic();
        startflash();
      }
      if (confirm.state == CONFIRM.pressed) {
        applyracecars();
        game.mode = 0;
        pauseMenuMusic();
        startflash();
        confirm.state = CONFIRM.used;
      }
      if (!buttons.pulseWidthGrowing) {
        buttons.pulseWidth -= 0.03;
        if (buttons.pulseWidth < 0.5) {
          buttons.pulseWidth = 0.5;
          buttons.pulseWidthGrowing = true;
        }
      } else {
        buttons.pulseWidth += 0.03;
        if (buttons.pulseWidth > 2) {
          buttons.pulseWidth = 2;
          buttons.pulseWidthGrowing = false;
        }
      }
      if (!buttons.pulseHeightGrowing) {
        buttons.pulseHeight -= 0.5;
        if (buttons.pulseHeight < 0.1) {
          buttons.pulseHeight = 0.1;
          buttons.pulseHeightGrowing = true;
        }
      } else {
        buttons.pulseHeight += 0.5;
        if (buttons.pulseHeight > 2) {
          buttons.pulseHeight = 2;
          buttons.pulseHeightGrowing = false;
        }
      }
    } else {
      var fm = view.scaleX;
      if (view.scaleX / view.scaleY > 1.2) {
        fm *= 1.2 / (view.scaleX / view.scaleY);
      }
      var topo = 260 * view.scaleY;
      if (blink.on) {
        blink.on = false;
      } else {
        blink.on = true;
      }
      if (dudo < 200) {
        if (blink.on) {
          menu.insanoPicture = Math.floor(random.fx() * 6);
          if (menu.insanoPicture == 6) {
            menu.insanoPicture = 5;
          }
        }
        dudo++;
      } else {
        menu.insanoPicture = 2;
      }
      rd.drawImage(
        images.insano[menu.insanoPicture],
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
        drawButton({
          id: 6,
          x: 1140 * fm - 80 * view.scale,
          y: topo + 210 * fm,
          width: 160,
          height: 60,
          faceTop: "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
          faceBottom: "rgb(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ")",
          shadowTop: "rgb(" + rgb3[0] + "," + rgb3[1] + "," + rgb3[2] + ")",
          shadowBottom: "rgb(" + rgb4[0] + "," + rgb4[1] + "," + rgb4[2] + ")",
          layout: BUTTON.textThenImage,
          text: "Okay ",
          fontSize: 21,
          textOpacity: 0.9,
          image: images.buttons[1],
          imageOpacity: 0.9,
          pulsing: false,
        })
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
  drawMusicToggle();
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
  menu.redraw = false;
  game.phase = PHASE.race;
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
    drawCenteredText(16, "[" + stspace + "]", 76, 67, 240, TEXT.label);
    drawCenteredText(18, carStats.names[car[pnti].typ], 0, 0, 0, TEXT.label);
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
      strokePolygon(xp, yp, 7);
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
    strokePolygon(xp, yp, 7);
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
function xs(x, z) {
  return ((z - 400) * -x) / z + x;
}
function ys(y, z) {
  return ((z - 400) * -y) / z + y;
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

// Canvas, input and start-up (formerly the inline script of index.html).

installPointer(canvas2D, {
  onRelease: checknplay,
  keepPressedWhileTouching: () => game.phase == PHASE.race,
});

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
      pressConfirm(pressed);
    }
  }
  if (action == "confirm") {
    pressConfirm(pressed);
  }
  if (action == "toggleArrow") {
    if (pressed) {
      if (game.phase == PHASE.race) {
        buttons.pressedByKey = 1;
      }
    } else {
      racers[game.player].u.arrace = !racers[game.player].u.arrace;
      buttons.pressedByKey = 0;
    }
  }
  if (action == "rewind") {
    if (game.phase == PHASE.race && raceEvents.countdown == 0) {
      if (pressed) {
        buttons.pressedByKey = 11;
      } else {
        stopEngine();
        stopStageMusic();
        preprevtime();
      }
    }
    if (!pressed) {
      buttons.pressedByKey = 0;
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
  if (!pressed && action == "raceCars" && game.phase == PHASE.stageSelect) {
    nextRaceSize();
  }
}
installKeyboard(onKey);

function init() {
  gotGamepads();
  document.getElementById("loading").style.visibility = "hidden";
  requestAnimationFrame(mainloop);
}

// The field sizes the stage select offers, 7 as in the original.
var RACE_SIZES = [7, 10, 15, 20];
function nextRaceSize() {
  game.raceCars =
    RACE_SIZES[(RACE_SIZES.indexOf(game.raceCars) + 1) % RACE_SIZES.length];
  saveSetting("racecars", game.raceCars);
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
