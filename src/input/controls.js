// What the keys do (which key is which action: see keyboard.js).

import {
  audio,
  stopEngine,
  stopStageMusic,
  switchMusicLook,
  toggleOtherCarSounds,
} from "../audio/audio.js";
import { announce, announceTarget } from "../ui/hud.js";
import { PHASE, RACE_KIND, game, raceSetup } from "../core/state.js";
import { raceEvents } from "../race/events.js";
import { nextRaceSize } from "../race/field.js";
import { racers } from "../race/racers.js";
import { startTimeRewind } from "../race/recording.js";
import { CAMERA, camera, toggleAiming } from "../render/camera.js";
import {
  look,
  toggleClassicMenus,
  toggleLook,
  toggleSharp,
} from "../render/look.js";
import { nextStrength } from "../race/career.js";
import { fitCanvas3D } from "../render/renderer.js";
import { minimap, toggleMinimap } from "../ui/minimap.js";
import { buttons } from "../ui/widgets.js";
import { pressConfirm } from "./confirm.js";
import { talk } from "../net/voice.js";
import { nextCamera } from "../race/replayViewer.js";
import { lockNext } from "../render/cameraMoves.js";
import { keys } from "./keyboard.js";
import { watchingOthers } from "../race/spectate.js";
import { loadSetting, saveSetting } from "../core/storage.js";

// the button a key shows pressed: the arrow button of the race
const ARROW_BUTTON = 1;
// as in the original; no button of the race has this id
const REWIND_BUTTON = 11;

// byKey: a stunt only begins with the handbrake in the air, the arrows then turn the car
// (else, as in the original, an arrow pressed in the air begins one too). It goes with
// the player's keys as one more (stuntKey), so every game of a race together drives the
// car alike.
export const stunts = { byKey: loadSetting("stuntsByKey") != 0 };

export const toggleStuntsByKey = () => {
  stunts.byKey = !stunts.byKey;
  saveSetting("stuntsByKey", stunts.byKey ? 1 : 0);
};

// Every tick of the race, before the cars drive: the player's way of stunting.
export const holdStuntKey = () => {
  racers[game.player].u.stuntKey = stunts.byKey;
};

export function onKey(action, pressed) {
  const input = racers[game.player].u;
  if (action == "talk") {
    talk(pressed);
  }
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
    // rewinding starts when the key is let go; a race with a guest goes on for both
    if (
      game.phase == PHASE.race &&
      raceEvents.countdown == 0 &&
      game.humans.length == 0 &&
      raceSetup.kind != RACE_KIND.timeAttack
    ) {
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
  // (watching the race go on: the replay viewer's cameras, the free one too)
  if (!pressed && action == "nextCamera" && watchingOthers()) {
    nextCamera();
  } else if (!pressed && action == "nextCamera" && game.phase == PHASE.race) {
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
  if (
    !pressed &&
    game.phase == PHASE.stageSelect &&
    raceSetup.kind == RACE_KIND.quickRace
  ) {
    if (action == "raceCars") {
      nextRaceSize();
    }
    if (action == "aiStrength") {
      nextStrength();
    }
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
  if (!pressed && action == "toggleMinimap") {
    toggleMinimap();
    announce(minimap.shown ? "Minimap: on" : "Minimap: off");
  }
  if (!pressed && action == "toggleAiming") {
    toggleAiming();
    announce(camera.aims ? "Target camera: on" : "Target camera: off");
  }
  if (!pressed && action == "lockNext" && game.phase == PHASE.race) {
    // (with Shift the nearer one)
    lockNext(
      keys.held.has("ShiftLeft") || keys.held.has("ShiftRight") ? -1 : 1,
    );
    announceTarget();
  }
  if (!pressed && action == "toggleClassicMenus") {
    toggleClassicMenus();
    fitCanvas3D();
    announce(
      look.menus ? "Classic menus and HUD: on" : "Classic menus and HUD: off",
    );
  }
}
