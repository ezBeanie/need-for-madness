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
  32: "handbrake", // space, also plays and pauses replays and confirms outside races
  13: "confirm", // enter
  27: "confirm", // escape
  81: "toggleArrow", // Q: the arrow points to the next checkpoint or the opponents
  82: "rewind", // R: rewind time in a race
  90: "lookBackLeft", // Z: swing the camera behind the car to the left
  88: "lookBackRight", // X: ... or to the right
  86: "nextCamera", // V: the camera, in races and replays
  78: "muteSound", // N
  77: "muteMusic", // M
  67: "raceCars", // C: how many cars race, in the stage select; the car a replay follows
  76: "toggleLook", // L: the modern or the classic look (see render/look.js)
  75: "toggleSharp", // K: the classic look sharp or in the original's pixels
};

export const actionFor = (keyCode) => ACTIONS[keyCode];

// Calls onKey(action, pressed) for every key with an action. The page itself never
// reacts to keys (scrolling, ...).
export const installKeyboard = (onKey) => {
  const listen = (pressed) => (event) => {
    event.preventDefault();
    const action = actionFor(event.keyCode);
    if (action) {
      onKey(action, pressed);
    }
  };
  window.addEventListener("keydown", listen(true), false);
  window.addEventListener("keyup", listen(false), false);
};
