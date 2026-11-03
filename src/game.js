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
import { canvas3D, fitCanvas3D } from "./render/renderer.js";
import { loadLook } from "./render/look.js";
import { loadMinimap } from "./ui/minimap.js";
import { canvas2D, view } from "./ui/view.js";
import { keepScreenOn } from "./ui/screenAwake.js";
import { loadAiming, startProjection, turnView } from "./render/camera.js";
import { moveCamera } from "./render/cameraMoves.js";
import { render } from "./render/drawFrame.js";
import { lookForGamepads, pollGamepads } from "./input/gamepad.js";
import {
  drawHighlightOverlay,
  drawRewindOverlay,
  drawSwitchScreen,
  drawHud,
  drawNetNotice,
  drawWaitingHud,
} from "./ui/hud.js";
import { menu } from "./screens/menuState.js";
import { carSelectTick, scatterMenuSmoke } from "./screens/carSelect.js";
import { stageLoadingTick, stageSelectTick } from "./screens/stageSelect.js";
import { instructionsTick } from "./screens/instructions.js";
import { PHASE, RACE_PHASES, game } from "./core/state.js";
import { TICK_MS, nextFraction, tick } from "./core/tick.js";
import { timeAttackTick } from "./race/timeAttack.js";
import {
  highlightTick,
  recordTick,
  recording,
  timeRewindTick,
} from "./race/recording.js";
import { cutRaceTape, recordRaceTick } from "./race/raceTape.js";
import {
  atReplayPace,
  flyCamera,
  replayViewerTick,
  viewer,
} from "./race/replayViewer.js";
import { replaySoundsTick } from "./audio/replaySounds.js";
import { drawReplayOverlay, heldArrow } from "./ui/replayControls.js";
import { installReplayDrop } from "./screens/replays.js";
import {
  installMultiplayerMenu,
  placeMultiplayerButton,
} from "./ui/multiplayerMenu.js";
import { installOptionsMenu, placeOptionsButton } from "./ui/optionsMenu.js";
import {
  installStageEditor,
  placeStageEditorButton,
} from "./editor/stageEditor.js";
import { raceEvents } from "./race/events.js";
import { control } from "./race/ai.js";
import { chipsfly, dustfly, expburn, sprksfly } from "./race/effects.js";
import { drive } from "./race/physics.js";
import { raceEndScreen, unlockedCarTick } from "./screens/raceEnd.js";
import {
  drawPauseMenuOverRace,
  pauseMenuOverRaceKeys,
  pauseMenuTick,
  quitRace,
} from "./screens/pauseMenu.js";
import {
  installMainMenu,
  mainMenuTick,
  placeMainMenu,
  resetQuestionTick,
} from "./screens/mainMenu.js";
import { loadAssets } from "./loading/assets.js";
import { updateStandings } from "./race/standings.js";
import { animateTrack, castShadows, placeWheels } from "./render/raceScene.js";
import { countDown, flashTick } from "./race/countdown.js";
import { onKey } from "./input/controls.js";
import { hostTick, startHosting } from "./net/host.js";
import { guest, guestWaitingTick, startGuesting } from "./net/guest.js";
import { ROLE, link } from "./net/link.js";
import {
  OUT_OF_SYNC,
  leaveLockstep,
  leftNotice,
  lockstep,
  lockstepTick,
  lockstepWaits,
  outOfSync,
  pressFrameKeys,
  releaseFrameKeys,
  waitingNotice,
} from "./net/lockstep.js";

// The logic runs in fixed ticks, whatever the display's refresh rate (see tick.js).
// how much time is caught up after a stall, e.g. while the tab was in the background
const MAX_CATCH_UP_MS = 250;

// a race waiting this many ticks for the other game's keys says so (a few are the
// network's unevenness)
const WAIT_SHOWN_TICKS = 15;
let waitedTicks = 0;
// whether a tick of the race ran in this logic tick
let raceRan = false;

// A frame of the race computed again, quietly (see net/lockstep.js): it was seen and heard
// already, as the game guessed it.
const runRaceFrameAgain = () => {
  drive();
  recordTick();
  recordRaceTick();
  updateStandings();
  control();
};

// The race and everything that replays it: the cars drive (or replay), wheels, shadows,
// effects and the track follow, the overlay is drawn over it, the camera moves. Racing
// together, the race waits for the other game's keys (see net/lockstep.js).
function raceTick() {
  startProjection();
  raceEvents.onelec = false;
  if (game.phase == PHASE.race) {
    pauseMenuOverRaceKeys();
  }
  if (game.phase == PHASE.race) {
    if (lockstepWaits()) {
      waitedTicks++;
      drawWaitingHud(waitedTicks == 1);
    } else {
      waitedTicks = 0;
      raceRan = true;
      pressFrameKeys(runRaceFrameAgain);
      if (raceEvents.countdown == 0) {
        drive();
        moveScenery(true);
        recordTick();
        recordRaceTick();
        updateStandings();
        control();
        releaseFrameKeys();
        timeAttackTick();
        drawHud();
        updateEngineSound();
      } else {
        releaseFrameKeys();
        countDown();
      }
    }
    drawNetNotice(
      [
        outOfSync() ? OUT_OF_SYNC : leftNotice(),
        waitedTicks > WAIT_SHOWN_TICKS ? waitingNotice() : null,
      ],
      link.role == ROLE.guest ? guest.ping : null,
    );
    drawPauseMenuOverRace();
  }
  if (game.phase == PHASE.replay) {
    const from = viewer.frame;
    replayViewerTick(heldArrow());
    // (standing or winding back, the effects stand too)
    if (!atReplayPace(() => moveScenery(true))) {
      placeWheels();
      castShadows();
    }
    replaySoundsTick(from, viewer.frame, viewer.playing);
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
    if (game.phase == PHASE.race) {
      cutRaceTape(recording.resumedFrom);
    }
    moveScenery(true);
    drawRewindOverlay();
  }
  moveCamera();
  if (game.phase == PHASE.replay) {
    flyCamera();
  }
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
  guestWaitingTick();
  hostTick();
  lockstepTick();
  raceRan = false;
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
  // (racing together, where the original's ticks fall is part of the race, which may wait)
  if (!lockstep.active || raceRan) {
    tick.fraction = nextFraction(tick.fraction);
  }
  placeMainMenu();
  placeOptionsButton();
  placeMultiplayerButton();
  placeStageEditorButton();
  interpolation.tick++;
}

// The game fills what is on screen: the visual viewport, which is smaller than the window
// in a zoomed page (Samsung Internet may keep a page zoomed in, even an installed game,
// whose zoom cannot be undone), and lies where the zoom has panned to.
const fitToWindow = () => {
  const seen = window.visualViewport ?? {
    width: window.innerWidth,
    height: window.innerHeight,
    pageLeft: 0,
    pageTop: 0,
  };
  for (const canvas of [canvas3D, canvas2D]) {
    canvas.style.left = `${seen.pageLeft}px`;
    canvas.style.top = `${seen.pageTop}px`;
  }
  const width = Math.round(seen.width);
  const height = Math.round(seen.height);
  if (view.width == width && view.height == height) {
    return;
  }
  view.width = width;
  view.height = height;
  view.aspect = view.width / view.height;
  view.scaleX = view.width / 1280;
  view.scaleY = view.height / 720;
  view.scale = (view.scaleX + view.scaleY) / 2;
  view.widescreenShift = (view.width / view.height - 1.777) * 76;
  canvas2D.width = view.width;
  canvas2D.height = view.height;
  for (const canvas of [canvas3D, canvas2D]) {
    canvas.style.width = "" + view.width + "px";
    canvas.style.height = "" + view.height + "px";
  }
  fitCanvas3D();
};

loadLook();
loadAiming();
loadMinimap();
// (the window may already be the size the canvases start with)
fitCanvas3D();

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

installReplayDrop(window);
startHosting();
startGuesting();
installOptionsMenu();
installMainMenu();
installMultiplayerMenu();
installStageEditor();

installPointer(canvas2D, {
  // a click or touch allows audio (see unlockAudio)
  onRelease: () => {
    unlockAudio(game.phase == PHASE.race);
    keepScreenOn();
  },
  keepPressedWhileTouching: () => game.phase == PHASE.race,
});
installKeyboard(onKey);
document.addEventListener("keydown", keepScreenOn);
// (so too the buttons and dialogs over the game: a guest may join and wait for the race
// without touching the game itself)
document.addEventListener("click", (event) => {
  if (event.target != canvas2D) {
    unlockAudio(false);
    keepScreenOn();
  }
});

// A hidden tab is silent and gets its sound settings back when it shows again.
let mutedBeforeHiding = { music: false, sound: false };
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState == "visible") {
    audio.muteMusic = mutedBeforeHiding.music;
    audio.muteSound = mutedBeforeHiding.sound;
    keepScreenOn();
  } else {
    mutedBeforeHiding = { music: audio.muteMusic, sound: audio.muteSound };
    audio.muteMusic = true;
    audio.muteSound = true;
    stopEngine();
    // (a hidden game runs no ticks: racing together, the others would take it for gone
    // while its player raced on once it shows again, so it leaves the race at once)
    if (lockstep.active) {
      leaveLockstep();
      quitRace();
    }
  }
});

// Installed as an app, the game starts without the network too (see public/sw.js); not in
// the dev server, whose files change with every edit.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

// (a check for racing together, see net/determinism.js)
if (new URLSearchParams(globalThis.location?.search).has("determinism")) {
  import("./net/determinism.js").then(({ checkDeterminism }) =>
    checkDeterminism(runTick),
  );
}

window.addEventListener("load", () => {
  lookForGamepads();
  document.getElementById("loading").style.visibility = "hidden";
  requestAnimationFrame(runFrame);
});
