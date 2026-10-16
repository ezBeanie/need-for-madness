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
import { enginsnd } from "./audio/engineSound.js";
import { installKeyboard } from "./input/keyboard.js";
import { pressConfirm } from "./input/confirm.js";
import { buttons } from "./ui/widgets.js";
import { installPointer } from "./input/pointer.js";
import {
  attachTo,
  interpolation,
  placeCamera,
} from "./render/interpolation.js";
import {
  canvas3D,
  drawModel,
  drawParticle,
  gl,
  setWorld,
} from "./render/renderer.js";
import { canvas2D, rd, view } from "./ui/view.js";
import { CAMERA, camera, startProjection, turnView } from "./render/camera.js";
import { moveCamera } from "./render/cameraMoves.js";
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
} from "./ui/hud.js";
import { menu } from "./screens/menuState.js";
import { carselect, scatterMenuSmoke } from "./screens/carSelect.js";
import {
  stageSelect,
  stageloading,
  stageselect,
} from "./screens/stageSelect.js";
import { gameinstructions } from "./screens/instructions.js";
import { PHASE, game } from "./core/state.js";
import { tick } from "./core/tick.js";
import { car, racers } from "./race/racers.js";
import { pieceModels, pieces, track } from "./race/track.js";
import {
  hreplay,
  preprevtime,
  record,
  recording,
  replay,
  revtime,
} from "./race/recording.js";
import { raceEvents } from "./race/events.js";
import { control } from "./race/ai.js";
import {
  chipsfly,
  dustfly,
  effects,
  expburn,
  sprksfly,
} from "./race/effects.js";
import { drive, paintDents } from "./race/physics.js";
import {
  UNLOCKED_CAR_SHOWN,
  raceEndScreen,
  unlockedcar,
} from "./screens/raceEnd.js";
import { pausedgame } from "./screens/pauseMenu.js";
import { drawmain, resetgame } from "./screens/mainMenu.js";
import { loaddata } from "./loading/assets.js";
import { checkstat } from "./race/standings.js";
import { nextRaceSize } from "./race/field.js";
import { animateTrack, castShadows, placeWheels } from "./render/raceScene.js";
import { countDown } from "./race/countdown.js";

// Fase whose 3D scene has been drawn from a finished logic tick and may be redrawn every frame.
var framefase = -1;
var renderedfase = -1;
function gameworks() {
  startProjection();
  raceEvents.onelec = false;
  if (game.phase == PHASE.race) {
    if (raceEvents.countdown == 0) {
      drive();
      placeWheels();
      castShadows();
      chipsfly();
      sprksfly();
      dustfly();
      expburn();
      animateTrack();
      record();
      checkstat();
      control();
      drawinter();
      enginsnd();
    } else {
      countDown();
    }
  }
  if (game.phase == PHASE.replay) {
    replay();
    placeWheels();
    castShadows();
    chipsfly();
    sprksfly();
    dustfly();
    expburn();
    animateTrack();
    drawReplayOverlay();
  }
  if (game.phase == PHASE.highlights) {
    hreplay();
    placeWheels();
    castShadows();
    if (!recording.onpausefr) {
      chipsfly();
      sprksfly();
    }
    dustfly();
    expburn();
    animateTrack();
    drawHighlightOverlay();
  }
  if (game.phase == PHASE.switchScreen) {
    drawSwitchScreen();
  }
  if (game.phase == PHASE.timeRewind) {
    revtime();
    placeWheels();
    castShadows();
    chipsfly();
    sprksfly();
    dustfly();
    expburn();
    animateTrack();
    drawRewindOverlay();
  }
  moveCamera();
  turnView();
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
    if (camera.mode == CAMERA.flyTo) {
      camera.mode = CAMERA.behind;
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
