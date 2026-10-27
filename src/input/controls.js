// What the keys do (which key is which action: see keyboard.js).

import {
  audio,
  stopEngine,
  stopStageMusic,
  switchMusicLook,
} from "../audio/audio.js";
import { PHASE, game } from "../core/state.js";
import { raceEvents } from "../race/events.js";
import { nextRaceSize } from "../race/field.js";
import { racers } from "../race/racers.js";
import { startTimeRewind } from "../race/recording.js";
import { nextCamera, nextCar, togglePlaying } from "../race/replayViewer.js";
import { CAMERA, camera } from "../render/camera.js";
import { toggleLook, toggleSharp } from "../render/look.js";
import { fitCanvas3D } from "../render/renderer.js";
import { buttons } from "../ui/widgets.js";
import { pressConfirm } from "./confirm.js";

// the button a key shows pressed: the arrow button of the race
const ARROW_BUTTON = 1;
// as in the original; no button of the race has this id
const REWIND_BUTTON = 11;

export function onKey(action, pressed) {
  const input = racers[game.player].u;
  if (action == "accelerate") {
    input.up = pressed;
  }
  if (action == "brake") {
    input.down = pressed;
  }
  if (action == "steerLeft") {
    input.left = pressed;
  }
  if (action == "steerRight") {
    input.right = pressed;
  }
  if (action == "handbrake") {
    input.handb = pressed;
    // the space bar plays and pauses replays, outside races it confirms
    if (game.phase == PHASE.replay) {
      if (!pressed) {
        togglePlaying();
      }
    } else if (game.phase != PHASE.race) {
      pressConfirm(pressed);
    }
  }
  if (action == "confirm") {
    pressConfirm(pressed);
  }
  if (action == "toggleArrow") {
    if (pressed) {
      if (game.phase == PHASE.race) {
        buttons.pressedByKey = ARROW_BUTTON;
      }
    } else {
      input.arrace = !input.arrace;
      buttons.pressedByKey = 0;
    }
  }
  if (action == "rewind") {
    // rewinding starts when the key is let go
    if (game.phase == PHASE.race && raceEvents.countdown == 0) {
      if (pressed) {
        buttons.pressedByKey = REWIND_BUTTON;
      } else {
        stopEngine();
        stopStageMusic();
        startTimeRewind();
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
  if (!pressed && action == "nextCamera" && game.phase == PHASE.replay) {
    nextCamera();
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
  if (!pressed && action == "raceCars" && game.phase == PHASE.replay) {
    nextCar();
  }
  if (!pressed && action == "toggleLook") {
    toggleLook();
    fitCanvas3D();
    switchMusicLook();
  }
  if (!pressed && action == "toggleSharp") {
    toggleSharp();
    fitCanvas3D();
  }
}
