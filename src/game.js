import {
  cosDeg as mcos,
  distance as pyd,
  sinDeg as msin,
} from "./core/math.js";
import { isPhone } from "./core/platform.js";
import { random } from "./core/random.js";
import {
  audio,
  isEngineLoaded,
  loadEngine,
  pauseMusic,
  playStageMusic,
  resumeMusic,
  stopEngine,
  stopStageMusic,
  unlockAudio,
} from "./audio/audio.js";
import { enginsnd, resetEngineSound } from "./audio/engineSound.js";
import { installKeyboard } from "./input/keyboard.js";
import { CONFIRM, confirm, pressConfirm } from "./input/confirm.js";
import { saveSetting } from "./core/storage.js";
import { images } from "./ui/images.js";
import { TEXT, buttons, drawCenteredText } from "./ui/widgets.js";
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
  setWorld,
} from "./render/renderer.js";
import { canvas2D, rd, view } from "./ui/view.js";
import { camera, faceCamera, startProjection } from "./render/camera.js";
import { isLeftWheel, placeWheel } from "./render/wheels.js";
import { layShadow } from "./render/shadows.js";
import { lookForGamepads, pollGamepads } from "./input/gamepad.js";
import {
  carModels,
  carShadows,
  checkpointText,
  dustSprite,
  dustTextures,
  electricity,
  explosionModels,
  finishText,
  fixHoop,
  ground,
  menuBackdrop,
  menuSmoke,
  scene,
  showcaseWheels,
  sky,
  sparkModels,
  spriteTextures,
  stageBackdrop,
  timeTube,
  wheelDisks,
  wheelTreads,
  wheelTreadsLow,
} from "./render/scene.js";
import {
  drawHighlightOverlay,
  drawReplayOverlay,
  drawRewindOverlay,
  drawSwitchScreen,
  drawinter,
  inishinter,
} from "./ui/hud.js";
import { menu } from "./screens/menuState.js";
import { carselect, scatterMenuSmoke } from "./screens/carSelect.js";
import {
  stageSelect,
  stageloading,
  stageselect,
} from "./screens/stageSelect.js";
import { gameinstructions } from "./screens/instructions.js";
import { MAX_CARS, PHASE, RACE_SIZES, game } from "./core/state.js";
import { tick } from "./core/tick.js";
import { car, racers } from "./race/racers.js";
import { carStats } from "./data/carStats.js";
import { pieceModels, pieces, spinFixHoops, track } from "./race/track.js";
import {
  hreplay,
  inishrecord,
  preprevtime,
  record,
  recording,
  replay,
  revtime,
} from "./race/recording.js";
import { raceEvents } from "./race/events.js";
import { control, inishcontrol } from "./race/ai.js";
import {
  chipsfly,
  dustfly,
  effects,
  expburn,
  sprksfly,
} from "./race/effects.js";
import { drive, inishmad, paintDents } from "./race/physics.js";
import {
  UNLOCKED_CAR_SHOWN,
  raceEndScreen,
  unlockedcar,
} from "./screens/raceEnd.js";
import { pausedgame } from "./screens/pauseMenu.js";
import { drawStartHint } from "./ui/insano.js";
import { drawmain, resetgame } from "./screens/mainMenu.js";
import { gamecartextures } from "./render/generated.js";
import { loaddata } from "./loading/assets.js";
import { checkstat } from "./race/standings.js";

function setwheelspos() {
  for (var c = 0; c < game.carCount; c++) {
    var cn = car[c].typ;
    for (var w = 0; w < 4; w++) {
      var wheel = racers[c].wheels[w];
      // the front wheels steer
      placeWheel(wheel, car[c], cn, w, w < 2 ? car[c].wxz : 0);
      mat4.rotate(
        wheel.mat,
        wheel.mat,
        car[c].wzy * (Math.PI / 180),
        isLeftWheel(w) ? [0, 0, -1] : [0, 0, 1],
      );
    }
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
    layShadow(racers[c].shadow, car[c], car[c].typ);
    racers[c].shadow.intershad = false;
    racers[c].shadow.y = 0.4;
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

function cpanimate() {
  spinFixHoops();
  if (raceEvents.onelec) {
    faceCamera(electricity);
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
  startProjection();
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
          drawStartHint();
        }
        if (track.stage == 4 && game.unlocked == 4) {
          drawStartHint();
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
        resetEngineSound();
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
    drawReplayOverlay();
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
    drawHighlightOverlay();
  }
  if (game.phase == PHASE.switchScreen) {
    drawSwitchScreen();
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
    drawRewindOverlay();
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

// its random draws belong here, between the others made while loading
scatterMenuSmoke();
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
            wheelTreads[car[c].typ][k].x = racers[c].wheels[w].x;
            wheelTreads[car[c].typ][k].y = racers[c].wheels[w].y;
            wheelTreads[car[c].typ][k].z = racers[c].wheels[w].z;
            wheelTreads[car[c].typ][k].mat = racers[c].wheels[w].mat;
            drawParticle(wheelTreads[car[c].typ][k]);
          } else {
            wheelTreadsLow[car[c].typ][k].x = racers[c].wheels[w].x;
            wheelTreadsLow[car[c].typ][k].y = racers[c].wheels[w].y;
            wheelTreadsLow[car[c].typ][k].z = racers[c].wheels[w].z;
            wheelTreadsLow[car[c].typ][k].mat = racers[c].wheels[w].mat;
            drawParticle(wheelTreadsLow[car[c].typ][k]);
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
          wheelDisks[car[c].typ][k].x = racers[c].wheels[w].x;
          wheelDisks[car[c].typ][k].y = racers[c].wheels[w].y;
          wheelDisks[car[c].typ][k].z = racers[c].wheels[w].z;
          wheelDisks[car[c].typ][k].mat = racers[c].wheels[w].mat;
          drawModel(wheelDisks[car[c].typ][k]);
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
          drawParticle(racers[c].switchLine);
        }
      }
      for (var i = 0; i < effects.nexp; i++) {
        if (effects.exp[effects.ewer[i]].ani != -1) {
          explosionModels[effects.exp[effects.ewer[i]].typ].x =
            effects.exp[effects.ewer[i]].x;
          explosionModels[effects.exp[effects.ewer[i]].typ].y =
            effects.exp[effects.ewer[i]].y;
          explosionModels[effects.exp[effects.ewer[i]].typ].z =
            effects.exp[effects.ewer[i]].z;
          explosionModels[effects.exp[effects.ewer[i]].typ].ont = Math.floor(
            effects.exp[effects.ewer[i]].ani,
          );
          explosionModels[effects.exp[effects.ewer[i]].typ].mat =
            effects.exp[effects.ewer[i]].mat;
          drawModel(explosionModels[effects.exp[effects.ewer[i]].typ]);
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
            dustTextures[effects.dust[i].tx][Math.floor(effects.dust[i].ta)];
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
        dustSprite.x = menuSmoke[i].x;
        dustSprite.y = menuSmoke[i].y;
        dustSprite.z = menuSmoke[i].z;
        dustSprite.mat = menuSmoke[i].mat;
        var ui = i;
        while (ui >= 3) {
          ui -= 3;
        }
        dustSprite.texture = spriteTextures[ui];
        drawModel(dustSprite);
      }
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      drawModel(carShadows[game.carTypes[0]]);
      for (var w = 0; w < 4; w++) {
        attachTo(
          showcaseWheels[game.carTypes[0]][w].mat,
          carModels[game.carTypes[0]],
        );
      }
      for (var w = 0; w < 4; w++) {
        var k = 0;
        if (w >= 2) {
          k = 1;
        }
        wheelTreads[game.carTypes[0]][k].x =
          showcaseWheels[game.carTypes[0]][w].x;
        wheelTreads[game.carTypes[0]][k].y =
          showcaseWheels[game.carTypes[0]][w].y;
        wheelTreads[game.carTypes[0]][k].z =
          showcaseWheels[game.carTypes[0]][w].z;
        wheelTreads[game.carTypes[0]][k].mat =
          showcaseWheels[game.carTypes[0]][w].mat;
        drawParticle(wheelTreads[game.carTypes[0]][k]);
      }
      drawModel(carModels[game.carTypes[0]]);
      for (var w = 0; w < 4; w++) {
        var k = 0;
        if (w >= 2) {
          k = 1;
        }
        wheelDisks[game.carTypes[0]][k].x =
          showcaseWheels[game.carTypes[0]][w].x;
        wheelDisks[game.carTypes[0]][k].y =
          showcaseWheels[game.carTypes[0]][w].y;
        wheelDisks[game.carTypes[0]][k].z =
          showcaseWheels[game.carTypes[0]][w].z;
        wheelDisks[game.carTypes[0]][k].mat =
          showcaseWheels[game.carTypes[0]][w].mat;
        drawModel(wheelDisks[game.carTypes[0]][k]);
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
      if (!stageSelect.hiddenTicks) {
        for (var i = 0; i < track.obi[track.n - 1] + track.addons; i++) {
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
        attachTo(
          showcaseWheels[game.carTypes[0]][w].mat,
          carModels[game.carTypes[0]],
        );
      }
      for (var w = 0; w < 4; w++) {
        var k = 0;
        if (w >= 2) {
          k = 1;
        }
        wheelTreads[game.carTypes[0]][k].x =
          showcaseWheels[game.carTypes[0]][w].x;
        wheelTreads[game.carTypes[0]][k].y =
          showcaseWheels[game.carTypes[0]][w].y;
        wheelTreads[game.carTypes[0]][k].z =
          showcaseWheels[game.carTypes[0]][w].z;
        wheelTreads[game.carTypes[0]][k].mat =
          showcaseWheels[game.carTypes[0]][w].mat;
        drawParticle(wheelTreads[game.carTypes[0]][k]);
      }
      drawModel(carModels[game.carTypes[0]]);
      for (var w = 0; w < 4; w++) {
        var k = 0;
        if (w >= 2) {
          k = 1;
        }
        wheelDisks[game.carTypes[0]][k].x =
          showcaseWheels[game.carTypes[0]][w].x;
        wheelDisks[game.carTypes[0]][k].y =
          showcaseWheels[game.carTypes[0]][w].y;
        wheelDisks[game.carTypes[0]][k].z =
          showcaseWheels[game.carTypes[0]][w].z;
        wheelDisks[game.carTypes[0]][k].mat =
          showcaseWheels[game.carTypes[0]][w].mat;
        drawModel(wheelDisks[game.carTypes[0]][k]);
      }
      menu.redraw = false;
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
export function setupcars() {
  track.insih();
  sortcars(track.stage);

  inishinter();
  inishcars();
  inishcontrol();
  inishmad();
  inishrecord();
}
// The field size can change in the stage select after the stage loaded with its cars.
var sortedcars = 0;
export function applyracecars() {
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
  pollGamepads();
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
// The original drew the tilt of the race end screen here, while loading; it is drawn again
// before it shows. The draw stays so the randomness after it is as it was.
random.fx();

export function startflash() {
  cntspark = 2;
  game.phase = PHASE.startFlash;
}
function aftersparkstart() {
  playStageMusic(track.stage);
  setWorld(
    scene.tint,
    scene.fog,
    scene.light[0],
    scene.light[1],
    scene.light[2],
    scene.fogDistance,
  );
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
  lookForGamepads();
  document.getElementById("loading").style.visibility = "hidden";
  requestAnimationFrame(mainloop);
}

export function nextRaceSize() {
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
