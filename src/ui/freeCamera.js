// The free camera's controls, in the replay viewer and watching a race together: W A S D,
// Q and E down and up, Z and X to turn, Shift faster, the mouse dragged to look. On touch
// screens a pad flies it (pushed up: forward, aside: sideways) and two buttons beside it
// lift and lower it; a finger dragged elsewhere looks round.

import { isPhone } from "../core/platform.js";
import { keys } from "../input/keyboard.js";
import { pointer } from "../input/pointer.js";
import { moveFreeCamera } from "../race/replayViewer.js";
import { rd, view } from "./view.js";

// how far it moves and turns a tick (Shift: faster), and per pixel dragged
const MOVE = 6;
const FAST = 4;
const TURN = 2.5;
const DRAG_TURN = 0.25;
// the pad and the buttons (design units): their size, and how far from the corner
const PAD = 70;
const BUTTON = 34;
const MARGIN = 30;

// the finger (or mouse) looking round: where it was last tick
let dragFrom = null;

// Where the pad and the up and down buttons are, with their bottom at bottom (pixels).
const placeOf = (bottom) => {
  const pad = PAD * view.scale;
  const button = BUTTON * view.scale;
  const margin = MARGIN * view.scale;
  return {
    pad: { x: margin + pad, y: bottom - margin - pad, r: pad },
    up: { x: margin * 2 + pad * 2 + button, y: bottom - margin - pad * 1.5 },
    down: { x: margin * 2 + pad * 2 + button, y: bottom - margin - pad * 0.5 },
    button,
  };
};

const within = (x, y, at, r) => Math.hypot(x - at.x, y - at.y) < r;

// Every tick while the free camera is on: moved by the keys, the pad and the pointer.
// bottom: where the pad's corner is; looks(x, y): whether a pointer there looks round
// (not on other controls).
export const steerFreeCamera = (bottom, looks = () => true) => {
  const held = (code) => (keys.held.has(code) ? 1 : 0);
  const step =
    MOVE *
    (keys.held.has("ShiftLeft") || keys.held.has("ShiftRight") ? FAST : 1);
  let forward = (held("KeyW") - held("KeyS")) * step;
  let side = (held("KeyD") - held("KeyA")) * step;
  let up = (held("KeyE") - held("KeyQ")) * step;
  let yaw = (held("KeyX") - held("KeyZ")) * TURN;
  let pitch = 0;
  const place = placeOf(bottom);
  let looking = null;
  for (let i = 0; pointer.down && i < Math.max(pointer.count, 1); i++) {
    const x = pointer.x[i];
    const y = pointer.y[i];
    if (isPhone && within(x, y, place.pad, place.pad.r * 1.4)) {
      const { r } = place.pad;
      forward -= (Math.max(-r, Math.min(r, y - place.pad.y)) / r) * MOVE * FAST;
      side += (Math.max(-r, Math.min(r, x - place.pad.x)) / r) * MOVE * FAST;
    } else if (isPhone && within(x, y, place.up, place.button)) {
      up += MOVE * FAST;
    } else if (isPhone && within(x, y, place.down, place.button)) {
      up -= MOVE * FAST;
    } else if (!looking && (dragFrom || looks(x, y))) {
      looking = { x, y };
    }
  }
  if (looking && dragFrom) {
    yaw += (looking.x - dragFrom.x) * DRAG_TURN;
    pitch += (looking.y - dragFrom.y) * DRAG_TURN;
  }
  dragFrom = looking;
  moveFreeCamera(forward, side, up, yaw, pitch);
};

export const stopSteeringFreeCamera = () => {
  dragFrom = null;
};

const circle = (at, r, fill) => {
  rd.fillStyle = fill;
  rd.beginPath();
  rd.arc(at.x, at.y, r, 0, Math.PI * 2);
  rd.fill();
};

// The pad and the buttons, on touch screens.
export const drawFreeCameraPad = (bottom) => {
  if (!isPhone) {
    return;
  }
  const place = placeOf(bottom);
  rd.save();
  circle(place.pad, place.pad.r, "rgba(0, 0, 0, 0.25)");
  circle(place.pad, place.pad.r * 0.35, "rgba(255, 255, 255, 0.35)");
  circle(place.up, place.button, "rgba(0, 0, 0, 0.25)");
  circle(place.down, place.button, "rgba(0, 0, 0, 0.25)");
  rd.fillStyle = "rgba(255, 255, 255, 0.8)";
  rd.font = `${Math.round(place.button)}px sans-serif`;
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  rd.fillText("▲", place.up.x, place.up.y);
  rd.fillText("▼", place.down.x, place.down.y);
  rd.restore();
};
