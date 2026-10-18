// Need for Madness: every 35 ms one logic tick of whatever is on screen, every display
// frame one drawing, and the start-up.

import { random } from "./core/random.js";
import {
  audio,
  pauseMusic,
  resumeMusic,
  stopEngine,
  unlockAudio,
} from "./audio/audio.js";
import { updateEngineSound } from "./audio/engineSound.js";
import { installKeyboard } from "./input/keyboard.js";
import { installPointer } from "./input/pointer.js";
import { interpolation } from "./render/interpolation.js";
import { canvas3D, gl } from "./render/renderer.js";
import { canvas2D, view } from "./ui/view.js";
import { startProjection, turnView } from "./render/camera.js";
import { moveCamera } from "./render/cameraMoves.js";
import { render } from "./render/drawFrame.js";
import { lookForGamepads, pollGamepads } from "./input/gamepad.js";
import {
  drawHighlightOverlay,
  drawReplayOverlay,
  drawRewindOverlay,
  drawSwitchScreen,
  drawHud,
} from "./ui/hud.js";
import { menu } from "./screens/menuState.js";
import { carSelectTick, scatterMenuSmoke } from "./screens/carSelect.js";
import { stageLoadingTick, stageSelectTick } from "./screens/stageSelect.js";
import { instructionsTick } from "./screens/instructions.js";
import { PHASE, RACE_PHASES, game } from "./core/state.js";
import { tick } from "./core/tick.js";
import {
  highlightTick,
  recordTick,
  recording,
  replayTick,
  timeRewindTick,
} from "./race/recording.js";
import { raceEvents } from "./race/events.js";
import { control } from "./race/ai.js";
import { chipsfly, dustfly, expburn, sprksfly } from "./race/effects.js";
import { drive } from "./race/physics.js";
import { raceEndScreen, unlockedCarTick } from "./screens/raceEnd.js";
import { pauseMenuTick } from "./screens/pauseMenu.js";
import { mainMenuTick, resetQuestionTick } from "./screens/mainMenu.js";
import { loadAssets } from "./loading/assets.js";
import { updateStandings } from "./race/standings.js";
import { animateTrack, castShadows, placeWheels } from "./render/raceScene.js";
import { countDown, flashTick } from "./race/countdown.js";
import { onKey } from "./input/controls.js";

// The logic runs in fixed ticks, whatever the display's refresh rate (see tick.js).
const TICK_MS = 35;
// how much time is caught up after a stall, e.g. while the tab was in the background
const MAX_CATCH_UP_MS = 250;

// The race and everything that replays it: the cars drive (or replay), wheels, shadows,
// effects and the track follow, the overlay is drawn over it, the camera moves.
function raceTick() {
  startProjection();
  raceEvents.onelec = false;
  if (game.phase == PHASE.race) {
    if (raceEvents.countdown == 0) {
      drive();
      moveScenery(true);
      recordTick();
      updateStandings();
      control();
      drawHud();
      updateEngineSound();
    } else {
      countDown();
    }
  }
  if (game.phase == PHASE.replay) {
    replayTick();
    moveScenery(true);
    drawReplayOverlay();
  }
  if (game.phase == PHASE.highlights) {
    highlightTick();
    // a highlight held still keeps chips and sparks where they are
    moveScenery(!recording.frozen);
    drawHighlightOverlay();
  }
  if (game.phase == PHASE.switchScreen) {
    drawSwitchScreen();
  }
  if (game.phase == PHASE.timeRewind) {
    timeRewindTick();
    moveScenery(true);
    drawRewindOverlay();
  }
  moveCamera();
  turnView();
  menu.redraw = true;
}

const moveScenery = (chipsAndSparksFly) => {
  placeWheels();
  castShadows();
  if (chipsAndSparksFly) {
    chipsfly();
    sprksfly();
  }
  dustfly();
  expburn();
  animateTrack();
};

// What runs in a logic tick, by phase, in this order: when one changes the phase, the
// next one runs in the same tick.
const TICKS = [
  [[PHASE.loading], loadAssets],
  [[PHASE.mainMenu], mainMenuTick],
  [[PHASE.carSelect], carSelectTick],
  [[PHASE.stageLoading], stageLoadingTick],
  [[PHASE.stageSelect], stageSelectTick],
  [[PHASE.instructions], instructionsTick],
  [RACE_PHASES, raceTick],
  [[PHASE.paused], pauseMenuTick],
  [
    [PHASE.raceEnd],
    () => {
      raceEndScreen();
      unlockedCarTick();
    },
  ],
  [[PHASE.resetQuestion], resetQuestionTick],
  [[PHASE.startFlash], flashTick],
];

let musicPaused = false;

export function runTick() {
  fitToWindow();
  pollGamepads();
  for (const [phases, run] of TICKS) {
    if (phases.includes(game.phase)) {
      run();
    }
  }
  if (audio.muteMusic && !musicPaused) {
    pauseMusic();
    musicPaused = true;
  }
  if (!audio.muteMusic && musicPaused) {
    resumeMusic();
    musicPaused = false;
  }
  if (tick.fraction >= tick.scale) {
    tick.fraction -= 1;
  }
  tick.fraction += tick.scale;
  interpolation.tick++;
}

const fitToWindow = () => {
  if (view.width == window.innerWidth && view.height == window.innerHeight) {
    return;
  }
  view.width = window.innerWidth;
  view.height = window.innerHeight;
  view.aspect = view.width / view.height;
  view.scaleX = view.width / 1280;
  view.scaleY = view.height / 720;
  view.scale = (view.scaleX + view.scaleY) / 2;
  view.widescreenShift = (view.width / view.height - 1.777) * 76;
  for (const canvas of [canvas3D, canvas2D]) {
    canvas.width = view.width;
    canvas.height = view.height;
    canvas.style.width = "" + view.width + "px";
    canvas.style.height = "" + view.height + "px";
  }
  gl.viewport(0, 0, view.width, view.height);
};

// time not run as logic ticks yet, and when the last frame came
let pendingMs = 0;
let lastFrameTime = -1;

export function runFrame(now) {
  if (lastFrameTime == -1) {
    lastFrameTime = now - TICK_MS;
  }
  pendingMs += Math.min(now - lastFrameTime, MAX_CATCH_UP_MS);
  lastFrameTime = now;
  while (pendingMs >= TICK_MS) {
    runTick();
    pendingMs -= TICK_MS;
  }
  interpolation.alpha = pendingMs / TICK_MS;
  render();
  requestAnimationFrame(runFrame);
}

// its random draws belong here, between the others made while loading
scatterMenuSmoke();
// The original drew the tilt of the race end screen here, while loading; it is drawn again
// before it shows. The draw stays so the randomness after it is as it was.
random.fx();

installPointer(canvas2D, {
  // a click or touch allows audio (see unlockAudio)
  onRelease: () => unlockAudio(game.phase == PHASE.race),
  keepPressedWhileTouching: () => game.phase == PHASE.race,
});
installKeyboard(onKey);

// A hidden tab is silent and gets its sound settings back when it shows again.
let mutedBeforeHiding = { music: false, sound: false };
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState == "visible") {
    audio.muteMusic = mutedBeforeHiding.music;
    audio.muteSound = mutedBeforeHiding.sound;
  } else {
    mutedBeforeHiding = { music: audio.muteMusic, sound: audio.muteSound };
    audio.muteMusic = true;
    audio.muteSound = true;
    stopEngine();
  }
});

window.addEventListener("load", () => {
  lookForGamepads();
  document.getElementById("loading").style.visibility = "hidden";
  requestAnimationFrame(runFrame);
});
