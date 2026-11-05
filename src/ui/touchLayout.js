// Where the touch controls lie and how big they are. Each has a place of its own as the
// original laid them out for 1280x720, its size following the screen's but no bigger than
// on a large phone (on a tablet or an unfolded foldable they would cover too much); the
// player may make them bigger or smaller and move each one (see the options), kept as
// fractions of the screen so they keep their place when it turns or folds.

import { loadText, saveSetting } from "../core/storage.js";
import { images } from "./images.js";
import { view } from "./view.js";

// the controls, their pictures (see images.touchControls), their sizes at a scale of 1 and
// their middles in the 1280x720 layout: x, then y from the top and the size's part above
export const TOUCH_CONTROLS = {
  left: { image: 0, width: 128, height: 128, x: 130, y: 622, above: 64 },
  right: { image: 1, width: 128, height: 128, x: 320, y: 662, above: 64 },
  accelerate: { image: 3, width: 128, height: 128, x: 1150, y: 622, above: 64 },
  brake: { image: 2, width: 128, height: 128, x: 960, y: 662, above: 64 },
  handbrake: {
    image: 4,
    width: 154,
    height: 111,
    x: 1260,
    y: 440,
    above: 55.5,
    fromRight: 77,
  },
  arrow: {
    image: 5,
    width: 154,
    height: 111,
    x: 20,
    y: 440,
    above: 55.5,
    fromLeft: 77,
  },
};
const NAMES = {
  left: "Steer left",
  right: "Steer right",
  accelerate: "Accelerate",
  brake: "Brake",
  handbrake: "Handbrake",
  arrow: "Arrow",
};

// the scale of a large phone held sideways (128 pixels a control at most)
const BIGGEST_SCALE = 0.75;
export const SIZES = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4];

// size: the player's factor; at: by control, its middle as fractions of the screen's
// width and height (none: the original's place)
export const touchLayout = { size: 1, at: {} };

const isFraction = (n) => Number.isFinite(n) && n >= 0 && n <= 1;

export const loadTouchLayout = () => {
  try {
    const stored = JSON.parse(loadText("touchLayout") || "{}");
    touchLayout.size = SIZES.includes(stored.size) ? stored.size : 1;
    touchLayout.at = {};
    for (const key of Object.keys(TOUCH_CONTROLS)) {
      const at = stored.at?.[key];
      if (Array.isArray(at) && at.length == 2 && at.every(isFraction)) {
        touchLayout.at[key] = at;
      }
    }
  } catch {
    touchLayout.size = 1;
    touchLayout.at = {};
  }
};

const saveTouchLayout = () =>
  saveSetting("touchLayout", JSON.stringify(touchLayout));

export const setTouchSize = (size) => {
  if (SIZES.includes(size)) {
    touchLayout.size = size;
    saveTouchLayout();
  }
};

// how big the controls are drawn, relative to the 1280x720 layout's
export const touchScale = () =>
  Math.min(view.scale, BIGGEST_SCALE) * touchLayout.size;

// Where control key is drawn, in pixels: its middle, width and height.
export const touchControlAt = (key) => {
  const control = TOUCH_CONTROLS[key];
  const scale = touchScale();
  const width = control.width * scale;
  const height = control.height * scale;
  const at = touchLayout.at[key];
  if (at) {
    return { x: at[0] * view.width, y: at[1] * view.height, width, height };
  }
  const shift = ((control.fromLeft ?? 0) - (control.fromRight ?? 0)) * scale;
  return {
    x: control.x * view.scaleX + shift,
    y: control.y * view.scaleY - control.above * scale,
    width,
    height,
  };
};

// The arranging: the controls over the screen, each dragged (or moved with the arrow keys)
// where the player wants it; Done keeps the places, Reset brings back the original's.
const dialog = document.getElementById("touchLayout");
const area = document.getElementById("touchLayoutControls");
// a key press moves a control this much of the screen (with shift five times as far)
const KEY_STEP = 0.01;

const place = (button, key) => {
  const { x, y, width, height } = touchControlAt(key);
  button.style.left = `${x - width / 2}px`;
  button.style.top = `${y - height / 2}px`;
  button.style.width = `${width}px`;
  button.style.height = `${height}px`;
};

const clamp = (n) => Math.min(1, Math.max(0, n));

const moveTo = (button, key, fx, fy) => {
  touchLayout.at[key] = [clamp(fx), clamp(fy)];
  place(button, key);
};

const controlButton = (key) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "touch-control";
  button.setAttribute("aria-label", `${NAMES[key]}: move with the arrow keys`);
  const picture = document.createElement("img");
  picture.alt = "";
  picture.src = images.touchControls[TOUCH_CONTROLS[key].image]?.src ?? "";
  picture.draggable = false;
  button.append(picture);
  let grab = null;
  button.addEventListener("pointerdown", (event) => {
    const { x, y } = touchControlAt(key);
    grab = { dx: event.clientX - x, dy: event.clientY - y };
    button.setPointerCapture?.(event.pointerId);
  });
  button.addEventListener("pointermove", (event) => {
    if (grab) {
      moveTo(
        button,
        key,
        (event.clientX - grab.dx) / view.width,
        (event.clientY - grab.dy) / view.height,
      );
    }
  });
  const letGo = () => {
    grab = null;
  };
  button.addEventListener("pointerup", letGo);
  button.addEventListener("pointercancel", letGo);
  button.addEventListener("keydown", (event) => {
    const step = KEY_STEP * (event.shiftKey ? 5 : 1);
    const move = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[event.key];
    if (move) {
      event.preventDefault();
      const { x, y } = touchControlAt(key);
      moveTo(button, key, x / view.width + move[0], y / view.height + move[1]);
    }
  });
  place(button, key);
  return button;
};

// (the places before, should the arranging be left without Done)
let before = {};

export const arrangeTouchControls = () => {
  before = { ...touchLayout.at };
  area.replaceChildren(...Object.keys(TOUCH_CONTROLS).map(controlButton));
  dialog.showModal?.();
};

export const installTouchLayout = () => {
  loadTouchLayout();
  document.getElementById("touchLayoutDone").addEventListener("click", () => {
    saveTouchLayout();
    before = { ...touchLayout.at };
    dialog.close?.();
  });
  document.getElementById("touchLayoutReset").addEventListener("click", () => {
    touchLayout.at = {};
    Object.keys(TOUCH_CONTROLS).forEach((key, i) =>
      place(area.children[i], key),
    );
  });
  // (Escape leaves without keeping)
  dialog.addEventListener("close", () => {
    touchLayout.at = before;
  });
};
