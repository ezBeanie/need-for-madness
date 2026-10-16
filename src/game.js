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
import { interpolation } from "./render/interpolation.js";
import { canvas3D, gl, setWorld } from "./render/renderer.js";
import { canvas2D, rd, view } from "./ui/view.js";
import { CAMERA, camera, startProjection, turnView } from "./render/camera.js";
import { moveCamera } from "./render/cameraMoves.js";
import { render } from "./render/drawFrame.js";
import { lookForGamepads, pollGamepads } from "./input/gamepad.js";
import { scene } from "./render/scene.js";
import {
  drawHighlightOverlay,
  drawReplayOverlay,
  drawRewindOverlay,
  drawSwitchScreen,
  drawinter,
} from "./ui/hud.js";
import { menu } from "./screens/menuState.js";
import { carselect, scatterMenuSmoke } from "./screens/carSelect.js";
import { stageloading, stageselect } from "./screens/stageSelect.js";
import { gameinstructions } from "./screens/instructions.js";
import { PHASE, game } from "./core/state.js";
import { tick } from "./core/tick.js";
import { racers } from "./race/racers.js";
import { track } from "./race/track.js";
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
import { chipsfly, dustfly, expburn, sprksfly } from "./race/effects.js";
import { drive } from "./race/physics.js";
import { raceEndScreen, unlockedcar } from "./screens/raceEnd.js";
import { pausedgame } from "./screens/pauseMenu.js";
import { drawmain, resetgame } from "./screens/mainMenu.js";
import { loaddata } from "./loading/assets.js";
import { checkstat } from "./race/standings.js";
import { nextRaceSize } from "./race/field.js";
import { animateTrack, castShadows, placeWheels } from "./render/raceScene.js";
import { countDown } from "./race/countdown.js";

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
