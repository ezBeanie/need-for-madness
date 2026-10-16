// What is drawn over the race: positions, laps, damage and power, the arrow, messages, the
// buttons, and the overlays of replays, winding back time and switch mode.

import {
  audio,
  playSound,
  stopEngine,
  stopStageMusic,
} from "../audio/audio.js";
import {
  cosDeg as mcos,
  distanceSquaredXZ as pyo,
  distanceXZ as py,
  rotatePoints as rotate,
  sinDeg as msin,
} from "../core/math.js";
import { isPhone } from "../core/platform.js";
import { random } from "../core/random.js";
import { MAX_CARS, PHASE, game } from "../core/state.js";
import { saveSetting } from "../core/storage.js";
import { tick } from "../core/tick.js";
import { carStats } from "../data/carStats.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { pointer } from "../input/pointer.js";
import { raceEvents } from "../race/events.js";
import { car, racers } from "../race/racers.js";
import {
  fastforwardexit,
  hrewindhreplay,
  recording,
} from "../race/recording.js";
import { track } from "../race/track.js";
import { camera } from "../render/camera.js";
import { resetMatrix } from "../render/interpolation.js";
import { newParticleModel } from "../render/models.js";
import { gl } from "../render/renderer.js";
import { scene, timeTube } from "../render/scene.js";
import { pauseMenu } from "../screens/pauseMenu.js";
import { startRaceEnd } from "../screens/raceEnd.js";
import { images } from "./images.js";
import { rd, view } from "./view.js";
import {
  BUTTON,
  TEXT,
  blink,
  buttons,
  drawButton,
  drawCenteredText,
  drawMeter,
  fillPolygon,
  strokePolygon,
  touchArea,
} from "./widgets.js";

// What the HUD shares with the pause menu and the loading.
export const hud = {
  // ticks until a replay starts: 2 when asked for, the screen dims, at 1 it starts
  replayStartsIn: 0,
  // the blinking of the power meter and its hint
  powerBlink: false,
  // ticks the key hints have been shown, 200 and more hides them
  keyHintTicks: 0,
};

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
export function drawswitch() {
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
export function drawrevtime() {
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
var dmcnt = 0;
var dmflk = false;
var dested = [];
export function inishinter() {
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
  hud.replayStartsIn = 0;
  buttons.pulseWidth = 2;
  buttons.pulseHeight = 0.5;
  for (var i = 0; i < MAX_CARS; i++) {
    racers[i].u.arrace = false;
    racers[i].u.zyinv = false;
  }
}
export function drawinter() {
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
        hud.replayStartsIn = 2;
      } else {
        startRaceEnd();
        game.phase = PHASE.raceEnd;
      }
      stopEngine();
    }
    if (hud.replayStartsIn == 1) {
      cntreps = 0;
      camera.orbitHeight = Math.floor(90 * random.fx());
      camera.orbitAngle = Math.floor(360 * random.fx());
      hrewindhreplay();
    }
    if (hud.replayStartsIn) {
      rd.globalAlpha = 0.7;
      rd.fillStyle = "#000000";
      rd.fillRect(0, 0, view.width, view.height);
      rd.globalAlpha = 1;
      hud.replayStartsIn--;
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
    if (
      !isPhone &&
      track.stage >= 2 &&
      hud.keyHintTicks < 200 &&
      game.carCount != 1
    ) {
      if (slide < 10 || hud.keyHintTicks > 100) {
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
      hud.keyHintTicks++;
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
            if (hud.powerBlink) {
              drawCenteredText(
                176,
                "Power low, perform stunt!",
                0,
                0,
                200,
                TEXT.small,
              );
              hud.powerBlink = false;
            } else {
              drawCenteredText(
                176,
                "Power low, perform stunt!",
                255,
                100,
                0,
                TEXT.small,
              );
              hud.powerBlink = true;
            }
          }
        } else {
          if (pwcnt < 100) {
            if (hud.powerBlink) {
              drawCenteredText(
                176,
                "Try to flip your car in the air to preform stunts!",
                0,
                0,
                200,
                TEXT.small,
              );
              hud.powerBlink = false;
            } else {
              drawCenteredText(
                176,
                "Try to flip your car in the air to preform stunts!",
                255,
                100,
                0,
                TEXT.small,
              );
              hud.powerBlink = true;
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
export function drawreplay() {
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
    hud.replayStartsIn = 2;
  }
  if (confirm.state == CONFIRM.pressed) {
    hud.replayStartsIn = 2;
    confirm.state = CONFIRM.used;
  }
  if (hud.replayStartsIn == 1) {
    fastforwardexit();
  }
  if (recording.fr > 425) {
    rd.fillStyle = "#000000";
    rd.fillRect(0, 0, view.width, view.height);
  }
  if (hud.replayStartsIn) {
    rd.globalAlpha = 0.7;
    rd.fillStyle = "#000000";
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
    hud.replayStartsIn--;
  }
}
var cntreps = 0;
var lwit = false;
export function drawhreplay() {
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
export function arrow(pnt, misdcp, pntcar) {
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
