// Keys and what they do in the game. The game reacts to the named actions.

const ACTIONS = {
  38: "accelerate", // arrow up
  87: "accelerate", // W
  40: "brake", // arrow down
  83: "brake", // S
  37: "steerLeft", // arrow left
  65: "steerLeft", // A
  39: "steerRight", // arrow right
  68: "steerRight", // D
  32: "handbrake", // space, also confirms outside races
  13: "confirm", // enter
  27: "confirm", // escape
  81: "toggleArrow", // Q: the arrow points to the next checkpoint or the opponents
  82: "rewind", // R: rewind time in a race
  90: "lookBackLeft", // Z: swing the camera behind the car to the left
  88: "lookBackRight", // X: ... or to the right
  86: "nextCamera", // V: the camera, in races
  71: "toggleMinimap", // G: the minimap in races
  84: "toggleAiming", // T: the camera behind the car turning to the car the arrow points at
  78: "muteSound", // N
  77: "muteMusic", // M
  79: "otherCarSounds", // O: the other cars' crashes, scrapes and skids heard or not
  67: "raceCars", // C: how many cars race, in a quick race's stage select
  66: "aiStrength", // B: how strong its opponents are
  76: "toggleLook", // L: the modern or the classic look (see render/look.js)
  75: "toggleSharp", // K: the classic look sharp or in the original's pixels
  85: "toggleClassicMenus", // U: the classic look with the original's menus and race HUD or not
};

export const actionFor = (keyCode) => ACTIONS[keyCode];

// The keys held, and those pressed since a screen last took them, by their place on the
// keyboard (event.code: "KeyW" is W on QWERTY and QWERTZ alike), for a screen with keys
// of its own (the replay viewer). Only the last few presses are kept.
export const keys = { held: new Set(), pressed: [] };
const KEPT_PRESSES = 10;

// The keys pressed since last asked: { code, shift, ctrl } each.
export const takePressedKeys = () => keys.pressed.splice(0);

const remember = (event, pressed) => {
  if (!pressed) {
    keys.held.delete(event.code);
    return;
  }
  keys.held.add(event.code);
  if (!event.repeat) {
    keys.pressed.push({
      code: event.code,
      shift: event.shiftKey,
      ctrl: event.ctrlKey || event.metaKey,
    });
    keys.pressed.splice(0, keys.pressed.length - KEPT_PRESSES);
  }
};

// A key event (or one like it): remembered, and onKey(action, pressed) called if the key
// has an action.
export const handleKey = (event, pressed, onKey) => {
  remember(event, pressed);
  const action = actionFor(event.keyCode);
  if (action) {
    onKey(action, pressed);
  }
};

// Handles every key; the page itself never reacts to keys (scrolling, ...).
export const installKeyboard = (onKey) => {
  const listen = (pressed) => (event) => {
    // the dialogs' own buttons and fields take keys as a page does (see ui/optionsMenu.js),
    // so do the main menu's
    if (event.target?.closest?.("dialog, #mainMenu")) {
      return;
    }
    event.preventDefault();
    handleKey(event, pressed, onKey);
  };
  window.addEventListener("keydown", listen(true), false);
  window.addEventListener("keyup", listen(false), false);
};
