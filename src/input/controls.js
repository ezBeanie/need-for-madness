// What the keys do (which key is which action: see keyboard.js).

import {
  audio,
  stopEngine,
  stopStageMusic,
  switchMusicLook,
  toggleOtherCarSounds,
} from "../audio/audio.js";
import { announce } from "../ui/hud.js";
import { PHASE, game } from "../core/state.js";
import { raceEvents } from "../race/events.js";
import { nextRaceSize } from "../race/field.js";
import { racers } from "../race/racers.js";
import { startTimeRewind } from "../race/recording.js";
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
    // outside races the space bar confirms (the replay viewer has keys of its own)
    if (game.phase != PHASE.race && game.phase != PHASE.replay) {
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
  if (!pressed && action == "otherCarSounds") {
    toggleOtherCarSounds();
    announce(
      audio.otherCars ? "Other cars' sounds: on" : "Other cars' sounds: off",
    );
  }
  if (!pressed && action == "muteMusic") {
    audio.muteMusic = !audio.muteMusic;
  }
  if (!pressed && action == "raceCars" && game.phase == PHASE.stageSelect) {
    nextRaceSize();
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
