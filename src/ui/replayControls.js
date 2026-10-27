// The replay viewer's controls over the race (see race/replayViewer.js): the time, a
// bar of the whole race to jump along, buttons with their keys above them, and a list of
// all keys (H). The viewer reads the keys by their place on the keyboard: W A S D are
// the free camera's, not the arrows' as in races.

import { CONFIRM, confirm } from "../input/confirm.js";
import { keys, takePressedKeys } from "../input/keyboard.js";
import { pointer } from "../input/pointer.js";
import { drawClassicReplayLabel } from "../classic/hud.js";
import {
  SPEEDS,
  VIEWER_FROM,
  changeSpeed,
  closeReplay,
  lastFrame,
  moveFreeCamera,
  nextCamera,
  nextCar,
  seekReplay,
  togglePlaying,
  viewer,
} from "../race/replayViewer.js";
import { stopReplaySounds } from "../audio/replaySounds.js";
import { LOOK, look } from "../render/look.js";
import { leaveOpenedReplay, saveReplay } from "../screens/replays.js";
import { CAMERA, camera } from "../render/camera.js";
import { BUTTON, drawButton } from "./widgets.js";
import { rd, view } from "./view.js";

const TICK_SECONDS = 0.035;
// a jump back and forth
const JUMP_FRAMES = Math.round(5 / TICK_SECONDS);
const CAMERA_NAMES = {
  [CAMERA.orbit]: "Orbit",
  [CAMERA.behind]: "Behind",
  [CAMERA.trackside]: "Track",
  [CAMERA.free]: "Free",
};
// the free camera: how far it moves and turns a tick (Shift: faster), and per pixel
// the mouse is dragged
const FREE_MOVE = 6;
const FREE_FAST = 4;
const FREE_TURN = 2.5;
const DRAG_TURN = 0.25;

// -1 or 1 while the left or right arrow is held (without Shift: that jumps)
export const heldArrow = () => {
  if (keys.held.has("ShiftLeft") || keys.held.has("ShiftRight")) {
    return 0;
  }
  return keys.held.has("ArrowLeft") ? -1 : keys.held.has("ArrowRight") ? 1 : 0;
};

const time = (frame) => {
  const seconds = frame * TICK_SECONDS;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
};

// --- the bar of the whole race, in design units (1280 x 720) ---

const BAR = { left: 80, right: 1200, top: 600, height: 14 };

const barRect = () => ({
  x: BAR.left * view.scaleX,
  y: BAR.top * view.scaleY,
  width: (BAR.right - BAR.left) * view.scaleX,
  height: BAR.height * view.scale,
});

let draggingBar = false;

const drawBar = (classic) => {
  const { x, y, width, height } = barRect();
  const played = lastFrame() > 0 ? viewer.frame / lastFrame() : 1;
  rd.globalAlpha = 0.6;
  rd.fillStyle = classic ? "#000000" : "#002040";
  rd.fillRect(x, y, width, height);
  rd.globalAlpha = 1;
  rd.fillStyle = classic ? "rgb(0,128,255)" : "#01EAFF";
  rd.fillRect(x, y, width * played, height);
  rd.fillStyle = "#FFFFFF";
  rd.fillRect(x + width * played - 2, y - 4, 4, height + 8);
  // pressed on it (with room around), and dragged: the race jumps along
  const reach = 12 * view.scale;
  const over =
    pointer.x[0] > x - reach &&
    pointer.x[0] < x + width + reach &&
    pointer.y[0] > y - reach &&
    pointer.y[0] < y + height + reach;
  if (!pointer.down) {
    draggingBar = false;
  } else if (over) {
    draggingBar = true;
  }
  if (draggingBar) {
    const along = Math.min(1, Math.max(0, (pointer.x[0] - x) / width));
    const frame = Math.round(along * lastFrame());
    if (frame != viewer.frame) {
      seekReplay(frame);
    }
  }
};

// --- buttons ---

// classic buttons: the one pressed, by its id
let pressedId = 0;

// The original's blue, its bold Arial; clicked when let go on it.
const classicButton = (id, label, x, y, width, height) => {
  const left = x - width / 2;
  const over =
    pointer.x[0] > left &&
    pointer.x[0] < left + width &&
    pointer.y[0] > y &&
    pointer.y[0] < y + height;
  rd.fillStyle = over && pointer.down ? "rgb(255,255,180)" : "rgb(1,157,255)";
  rd.fillRect(left, y, width, height);
  rd.strokeStyle = "#000000";
  rd.lineWidth = Math.max(1, view.scale);
  rd.strokeRect(left, y, width, height);
  rd.fillStyle = "#000000";
  rd.font = `bold ${Math.round(12 * (view.height / 450))}px Arial`;
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  rd.fillText(label, x, y + height / 2);
  if (pointer.down && over && !draggingBar) {
    pressedId = id;
  }
  const clicked = !pointer.down && pressedId == id && over;
  if (!pointer.down && pressedId == id) {
    pressedId = 0;
  }
  return clicked;
};

// its key, small above it
const drawKey = (key, x, y, classic) => {
  rd.font = classic
    ? `bold ${Math.round(9 * (view.height / 450))}px Arial`
    : "" + 6 * (view.scaleY + view.scaleX) + "px verd";
  rd.letterSpacing = "0px";
  rd.textAlign = "center";
  rd.textBaseline = "bottom";
  rd.fillStyle = classic ? "rgb(0,128,255)" : "rgb(0,32,64)";
  rd.fillText(key, x, y - 4 * view.scale);
};

const button = (id, label, key, index, count) => {
  const classic = look.current == LOOK.classic;
  // (spread over the screen, a margin left and right for their slanted ends)
  const x = (40 + ((index + 0.5) * 1200) / count) * view.scaleX;
  const y = 720 * view.scaleY - 80 * view.scale;
  drawKey(key, x, y, classic);
  if (classic) {
    return classicButton(id, label, x, y, 112 * view.scale, 40 * view.scale);
  }
  return drawButton({
    id,
    x,
    y,
    width: 112,
    height: 46,
    faceTop: "#019DFF",
    faceBottom: "#01EAFF",
    shadowTop: "#004A78",
    shadowBottom: "#016D77",
    layout: BUTTON.textOnly,
    text: label,
    fontSize: 13,
    textOpacity: 0.8,
    image: null,
    imageOpacity: 0,
    pulsing: false,
  });
};

// Back to where the viewer was opened from; after a replay file, the main menu.
const exit = () => {
  const fromFile = viewer.from == VIEWER_FROM.file;
  stopReplaySounds();
  closeReplay();
  if (fromFile) {
    leaveOpenedReplay();
  }
};

const jump = (frames) => seekReplay(viewer.frame + frames);
const canSave = () => viewer.from != VIEWER_FROM.file;
const save = () => {
  if (canSave()) {
    saveReplay();
  }
};

// The controls: [label, key shown, what it does, the keys (code, with Shift)]. A replay
// file needs no saving again.
const controls = () => [
  ["<< 5 Sec", "Shift+Left", () => jump(-JUMP_FRAMES)],
  [viewer.playing ? "Pause" : "Play", "Space", togglePlaying],
  ["5 Sec >>", "Shift+Right", () => jump(JUMP_FRAMES)],
  ["Slower", "Down", () => changeSpeed(-1)],
  ["Faster", "Up", () => changeSpeed(1)],
  [CAMERA_NAMES[camera.mode] ?? "Camera", "V", nextCamera],
  [`Car ${camera.target + 1}`, "C", () => nextCar()],
  ...(canSave() ? [["Save", "Ctrl+S", save]] : []),
  ["Exit", "Esc", exit],
];

// what the keys do that have no button of their own, or more than one key
const KEYS = {
  Space: togglePlaying,
  KeyV: nextCamera,
  KeyH: () => (help = !help),
  Home: () => seekReplay(0),
  End: () => seekReplay(lastFrame()),
  ArrowUp: () => changeSpeed(1),
  ArrowDown: () => changeSpeed(-1),
};

const readKeys = () => {
  for (const { code, shift, ctrl } of takePressedKeys()) {
    if (code == "KeyC") {
      nextCar(shift ? -1 : 1);
    } else if (code == "KeyS" && ctrl) {
      save();
    } else if (shift && (code == "ArrowLeft" || code == "ArrowRight")) {
      jump(code == "ArrowLeft" ? -JUMP_FRAMES : JUMP_FRAMES);
    } else {
      KEYS[code]?.();
    }
  }
  if (confirm.state == CONFIRM.pressed) {
    confirm.state = CONFIRM.used;
    exit();
  }
};

// --- the free camera: W A S D, Q and E down and up, Shift faster, the mouse to look ---

let dragFrom = null;

const moveFree = () => {
  if (camera.mode != CAMERA.free) {
    dragFrom = null;
    return;
  }
  const held = (code) => (keys.held.has(code) ? 1 : 0);
  const fast =
    keys.held.has("ShiftLeft") || keys.held.has("ShiftRight") ? FREE_FAST : 1;
  const step = FREE_MOVE * fast;
  let yaw = 0;
  let pitch = 0;
  // dragged on the race (not on the controls below it)
  const onRace = pointer.y[0] < (BAR.top - 30) * view.scaleY;
  if (pointer.down && (dragFrom || onRace)) {
    if (dragFrom) {
      yaw = (pointer.x[0] - dragFrom.x) * DRAG_TURN;
      pitch = (pointer.y[0] - dragFrom.y) * DRAG_TURN;
    }
    dragFrom = { x: pointer.x[0], y: pointer.y[0] };
  } else {
    dragFrom = null;
  }
  moveFreeCamera(
    (held("KeyW") - held("KeyS")) * step,
    (held("KeyD") - held("KeyA")) * step,
    (held("KeyE") - held("KeyQ")) * step,
    yaw + (held("KeyX") - held("KeyZ")) * FREE_TURN,
    pitch,
  );
};

// --- the list of keys ---

let help = false;

const HELP = [
  ["Space", "Play / pause"],
  ["Left / Right", "One step back / on (hold: wind)"],
  ["Shift + Left / Right", "5 seconds back / on"],
  ["Home / End", "To the start / the end"],
  ["Up / Down", "Faster / slower"],
  ["V", "Camera: orbit, behind, track, free"],
  ["C / Shift + C", "Next / previous car"],
  ["W A S D", "Free camera: move"],
  ["Q / E", "Free camera: down / up"],
  ["Z / X, mouse", "Free camera: turn, drag to look"],
  ["Shift", "Free camera: faster"],
  ["Z / X", "Behind the car: look back"],
  ["Ctrl + S", "Save the replay as a file"],
  ["Esc / Enter", "Close the replay"],
  ["H", "Show / hide these keys"],
];

const drawHelp = (classic) => {
  const x = 340 * view.scaleX;
  const y = 120 * view.scaleY;
  const row = 26 * view.scaleY;
  rd.globalAlpha = 0.75;
  rd.fillStyle = "#000000";
  rd.fillRect(
    x - 20 * view.scaleX,
    y - 30 * view.scaleY,
    640 * view.scaleX,
    row * (HELP.length + 1),
  );
  rd.globalAlpha = 1;
  rd.textBaseline = "middle";
  rd.letterSpacing = "0px";
  rd.font = classic
    ? `bold ${Math.round(12 * (view.height / 450))}px Arial`
    : "" + 8 * (view.scaleY + view.scaleX) + "px verd";
  HELP.forEach(([key, what], i) => {
    rd.textAlign = "left";
    rd.fillStyle = classic ? "rgb(0,128,255)" : "#01EAFF";
    rd.fillText(key, x, y + i * row);
    rd.fillStyle = "#FFFFFF";
    rd.fillText(what, x + 230 * view.scaleX, y + i * row);
  });
};

// --- the overlay ---

const drawInfo = (classic) => {
  const state = viewer.playing
    ? `${SPEEDS[viewer.speed]}x`
    : viewer.frame == lastFrame()
      ? "End"
      : "Paused";
  const line = `${time(viewer.frame)} / ${time(lastFrame())}   ${state}`;
  const hint = help ? "H: hide the keys" : "H: show all keys";
  rd.textAlign = "left";
  rd.textBaseline = "middle";
  if (classic) {
    rd.font = `bold ${Math.round(13 * (view.height / 450))}px Arial`;
    rd.fillStyle = "rgb(0,128,255)";
    rd.fillText(line, BAR.left * view.scaleX, (BAR.top - 18) * view.scaleY);
    rd.textAlign = "right";
    rd.fillText(hint, BAR.right * view.scaleX, (BAR.top - 18) * view.scaleY);
    return;
  }
  rd.letterSpacing = "1px";
  rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
  rd.fillStyle = "rgb(0,32,64)";
  rd.fillText("REPLAY", 20 * view.scaleX, 35 * view.scaleY);
  rd.font = "" + 10 * (view.scaleY + view.scaleX) + "px verd";
  rd.letterSpacing = "0px";
  rd.fillText(line, 20 * view.scaleX, 80 * view.scaleY);
  rd.font = "" + 8 * (view.scaleY + view.scaleX) + "px verd";
  rd.fillText(hint, 20 * view.scaleX, 115 * view.scaleY);
};

export function drawReplayOverlay() {
  rd.clearRect(0, 0, view.width, view.height);
  const classic = look.current == LOOK.classic;
  if (classic) {
    drawClassicReplayLabel();
  }
  drawInfo(classic);
  drawBar(classic);
  const all = controls();
  all.forEach(([label, key, act], i) => {
    if (button(20 + i, label, key, i, all.length)) {
      act();
    }
  });
  if (help) {
    drawHelp(classic);
  }
  readKeys();
  moveFree();
}
