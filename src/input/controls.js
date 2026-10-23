// What the keys do (which key is which action: see keyboard.js).

import {
  audio,
  stopEngine,
  stopStageMusic,
  switchMusicLook,
} from "../audio/audio.js";
import { PHASE, RACE_PHASES, game } from "../core/state.js";
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

// The 3D picture is shown mirrored (see render/renderer.js): in races the car's left is
// the screen's right. Menus keep left and right.
export const steeringSide = (side) => {
  if (!RACE_PHASES.includes(game.phase)) {
    return side;
  }
  return side == "left" ? "right" : "left";
};

// the steering keys held, by the screen's sides
const held = { left: false, right: false };

const steerByKeys = (input) => {
  input[steeringSide("left")] = held.left;
  input[steeringSide("right")] = held.right;
};

export function onKey(action, pressed) {
  const input = racers[game.player].u;
  if (action == "accelerate") {
    input.up = pressed;
  }
  if (action == "brake") {
    input.down = pressed;
  }
  if (action == "steerLeft") {
    held.left = pressed;
    steerByKeys(input);
  }
  if (action == "steerRight") {
    held.right = pressed;
    steerByKeys(input);
  }
  if (action == "handbrake") {
    input.handb = pressed;
    // outside races the space bar confirms
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
  // (the camera swings the world's way, which the mirrored picture turns round)
  if (action == "lookBackLeft") {
    camera.lookBack = pressed ? 1 : 0;
  }
  if (action == "lookBackRight") {
    camera.lookBack = pressed ? -1 : 0;
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
