// The options: the switches that otherwise have only keys (L, K, J, U, T, G, N, M, O), for
// phones and tablets without a keyboard. A button with a gear opens them (outside races:
// in a race, the pause menu leads there), each one does what its key does.

import { audio } from "../audio/audio.js";
import { PHASE, game } from "../core/state.js";
import { onKey } from "../input/controls.js";
import { camera } from "../render/camera.js";
import { minimap } from "./minimap.js";
import { LOOK, classicMenus, look } from "../render/look.js";

const button = document.getElementById("optionsButton");
const dialog = document.getElementById("options");

// each switch: its key's action, whether it is on and what that is called
const SWITCHES = [
  ["toggleLook", () => look.current == LOOK.classic, "Classic", "Modern"],
  ["toggleSharp", () => look.sharp, "Sharp", "Original pixels"],
  ["toggleDepth", () => look.depth, "By depth", "As the original"],
  ["toggleClassicMenus", () => look.menus, "Classic", "Modern"],
  ["toggleAiming", () => camera.aims, "On", "Off"],
  ["toggleMinimap", () => minimap.shown, "On", "Off"],
  ["muteSound", () => !audio.muteSound, "On", "Off"],
  ["muteMusic", () => !audio.muteMusic, "On", "Off"],
  ["otherCarSounds", () => audio.otherCars, "On", "Off"],
];

// where the gear shows: everywhere but in the race itself and its flashes
const SHOWN_IN = [
  PHASE.mainMenu,
  PHASE.carSelect,
  PHASE.stageSelect,
  PHASE.instructions,
  PHASE.paused,
  PHASE.replay,
  PHASE.highlights,
  PHASE.raceEnd,
];

const showStates = () => {
  for (const [action, on, yes, no] of SWITCHES) {
    const item = document.getElementById(`option-${action}`);
    item.setAttribute?.("aria-pressed", on() ? "true" : "false");
    const state = item.querySelector?.(".state");
    if (state) {
      state.textContent = on() ? yes : no;
    }
  }
};

export const openOptions = () => {
  showStates();
  dialog.showModal?.();
};

export const installOptionsMenu = () => {
  for (const [action] of SWITCHES) {
    document
      .getElementById(`option-${action}`)
      .addEventListener("click", () => {
        onKey(action, false);
        showStates();
      });
  }
  button.addEventListener("click", openOptions);
  document
    .getElementById("optionsClose")
    .addEventListener("click", () => dialog.close?.());
};

// Every tick: the gear only where it belongs (the main menu has Options of its own).
export const placeOptionsButton = () => {
  const hidden =
    !SHOWN_IN.includes(game.phase) ||
    (game.phase == PHASE.mainMenu && !classicMenus());
  if (button.hidden != hidden) {
    button.hidden = hidden;
  }
};
