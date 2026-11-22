// The options: a screen of the switches that otherwise have only keys (L, K, U, T, G, N,
// M, O), for phones and tablets without a keyboard. The main menu opens it, and an Options
// button the other menus (outside races: in a race, the pause menu leads there); each switch
// does what its key does.

import { canFullscreen, isFullscreen, toggleFullscreen } from "./fullscreen.js";
import {
  audio,
  setMusicVolume,
  setOtherCarsVolume,
  setSoundVolume,
  setVoiceVolume,
} from "../audio/audio.js";
import { PHASE, game } from "../core/state.js";
import { onKey, stunts, toggleStuntsByKey } from "../input/controls.js";
import { camera } from "../render/camera.js";
import { minimap } from "./minimap.js";
import { LOOK, classicMenus, look } from "../render/look.js";
import { tellHost } from "../net/guest.js";
import { sendPlayers } from "../net/host.js";
import { ROLE, link } from "../net/link.js";
import { own, setOwnName } from "../net/roomCars.js";
import { toggleByVoice, toggleVoice, voice } from "../net/voice.js";
import { ghost, toggleGhost } from "../race/ghost.js";
import { isPhone } from "../core/platform.js";
import { chooseQuality, graphics } from "../render/graphics.js";
import { fitCanvas3D } from "../render/renderer.js";
import { menu } from "../screens/menuState.js";
import { askOfflineStatus, installOffline } from "./offline.js";
import { CHANGELOG, VERSION } from "../data/changelog.js";
import {
  language,
  onLanguage,
  setLanguage,
  t,
  translatePage,
} from "../core/language.js";
import {
  arrangeTouchControls,
  setTouchSize,
  touchLayout,
} from "./touchLayout.js";

const button = document.getElementById("optionsButton");
const dialog = document.getElementById("options");

// each switch: its key's action, whether it is on and what that is called
const SWITCHES = [
  ["toggleLook", () => look.current == LOOK.classic, "Classic", "Modern"],
  ["toggleSharp", () => look.sharp, "Sharp", "Original pixels"],
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

// each volume slider: its input, what it sets and reads
const VOLUMES = [
  ["musicVolume", setMusicVolume, () => audio.musicVolume],
  ["soundVolume", setSoundVolume, () => audio.soundVolume],
  ["otherCarsVolume", setOtherCarsVolume, () => audio.otherCarsVolume],
  ["voiceVolume", setVoiceVolume, () => audio.voiceVolume],
];

const showTouchSize = () => {
  const percent = Math.round(touchLayout.size * 100);
  document.getElementById("touchSize").value = String(percent);
  document.getElementById("touchSizeShown").textContent = `${percent}%`;
};

const showVolumes = () => {
  for (const [id, , volume] of VOLUMES) {
    const percent = Math.round(volume() * 100);
    document.getElementById(id).value = String(percent);
    document.getElementById(`${id}Shown`).textContent = `${percent}%`;
  }
};

const showSwitch = (id, on, yes, no) => {
  const item = document.getElementById(id);
  item.setAttribute?.("aria-pressed", on ? "true" : "false");
  const state = item.querySelector?.(".state");
  if (state) {
    state.textContent = t(on ? yes : no);
  }
};

const showStates = () => {
  for (const [action, on, yes, no] of SWITCHES) {
    showSwitch(`option-${action}`, on(), yes, no);
  }
  // (these have no key: their switches are the options' alone)
  showSwitch("ghostShown", ghost.shown, "On", "Off");
  showSwitch("stuntsByKey", stunts.byKey, "On", "Off");
  showSwitch("fullscreenShown", isFullscreen(), "On", "Off");
  showSwitch("voiceChat", voice.on, "On", "Off");
  showSwitch("voiceByVoice", voice.byVoice, "By voice", "Push to talk");
};

export const openOptions = () => {
  showStates();
  showVolumes();
  showTouchSize();
  // (only where there are touch controls)
  document.getElementById("optionsTouch").hidden = !isPhone;
  document.getElementById("playerName").value = own.name;
  document.getElementById("languageChosen").value = language.current;
  document.getElementById("graphicsChosen").value = String(graphics.quality);
  askOfflineStatus();
  dialog.showModal?.();
};

// The game's version, and what changed in each, out of the way at the options' end (what
// changed stays English, as it was written).
const showVersion = () => {
  document.getElementById("gameVersion").textContent = t("Version {version}", {
    version: VERSION,
  });
};

const showChangelog = () => {
  const changelog = document.getElementById("changelog");
  for (const { version, date, changes } of CHANGELOG) {
    const title = document.createElement("h4");
    title.textContent = `${version} (${date})`;
    const list = document.createElement("ul");
    for (const change of changes) {
      const item = document.createElement("li");
      item.textContent = change;
      list.append(item);
    }
    changelog.append(title, list);
  }
};

export const installOptionsMenu = () => {
  installOffline();
  showVersion();
  showChangelog();
  // (the page and what is shown of it at once in the language chosen; a language saved
  // translates the page as the game starts)
  const graphicsChosen = document.getElementById("graphicsChosen");
  graphicsChosen.addEventListener("change", () => {
    chooseQuality(Number(graphicsChosen.value));
    // (the picture drawn anew in its pixels, also in the menus)
    fitCanvas3D();
    menu.redraw = true;
  });
  const languageChosen = document.getElementById("languageChosen");
  languageChosen.addEventListener("change", () =>
    setLanguage(languageChosen.value),
  );
  onLanguage(() => {
    showVersion();
    showStates();
  });
  if (language.current != "en") {
    translatePage();
  }
  for (const [action] of SWITCHES) {
    document
      .getElementById(`option-${action}`)
      .addEventListener("click", () => {
        onKey(action, false);
        showStates();
      });
  }
  for (const [id, set] of VOLUMES) {
    document.getElementById(id).addEventListener("input", (event) => {
      set(Number(event.target.value) / 100);
      showVolumes();
    });
  }
  document.getElementById("touchSize").addEventListener("input", (event) => {
    setTouchSize(Number(event.target.value) / 100);
    showTouchSize();
  });
  document
    .getElementById("touchArrange")
    .addEventListener("click", arrangeTouchControls);
  document.getElementById("ghostShown").addEventListener("click", () => {
    toggleGhost();
    showStates();
  });
  document.getElementById("stuntsByKey").addEventListener("click", () => {
    toggleStuntsByKey();
    showStates();
  });
  document.getElementById("fullscreenItem").hidden = !canFullscreen();
  document
    .getElementById("fullscreenShown")
    .addEventListener("click", toggleFullscreen);
  // (also left by the browser itself: a phone's back gesture, Escape)
  for (const name of ["fullscreenchange", "webkitfullscreenchange"]) {
    document.addEventListener(name, showStates);
  }
  document.getElementById("voiceChat").addEventListener("click", () => {
    toggleVoice();
    showStates();
  });
  document.getElementById("voiceByVoice").addEventListener("click", () => {
    toggleByVoice();
    showStates();
  });
  // (kept with every letter typed: the options may close without the field losing its
  // focus; the room hears of a new name once it is typed)
  const name = document.getElementById("playerName");
  name.addEventListener("input", () => setOwnName(name.value));
  name.addEventListener("change", () => {
    setOwnName(name.value);
    name.value = own.name;
    if (link.role == ROLE.host) {
      sendPlayers();
    }
    tellHost();
  });
  button.addEventListener("click", openOptions);
  document
    .getElementById("optionsClose")
    .addEventListener("click", () => dialog.close?.());
};

// Every tick: the button only where it belongs (the main menu has Options of its own).
export const placeOptionsButton = () => {
  const hidden =
    !SHOWN_IN.includes(game.phase) ||
    (game.phase == PHASE.mainMenu && !classicMenus());
  if (button.hidden != hidden) {
    button.hidden = hidden;
  }
};
