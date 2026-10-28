// The replay viewer's controls over the race (see race/replayViewer.js): the title and
// time, and a panel shown with H (or while the mouse moves) with a bar of the whole race
// to jump along and buttons, each with its key. The viewer reads the keys by their place
// on the keyboard: W A S D are the free camera's, not the arrows' as in races.

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

// --- the panel: hidden until asked for (H, or the mouse moved or the screen touched) ---

// in design units (1280 x 720)
const PANEL = { left: 40, right: 1240, top: 540, bottom: 708 };
const BAR = { left: 70, right: 1210, top: 586, height: 10 };
const BUTTONS = { left: 70, right: 1210, top: 610, height: 52, gap: 8 };
// how long the panel stays after the mouse last moved
const SHOWN_TICKS = 90;

// H keeps it shown; the mouse shows it for a while
let pinned = false;
let shownTicks = 0;
let lastPointer = { x: -1, y: -1 };

const panelShown = () => pinned || shownTicks > 0 || draggingBar;

const watchPointer = () => {
  const moved = pointer.x[0] != lastPointer.x || pointer.y[0] != lastPointer.y;
  lastPointer = { x: pointer.x[0], y: pointer.y[0] };
  if (moved || pointer.down) {
    shownTicks = SHOWN_TICKS;
  } else if (shownTicks > 0) {
    shownTicks--;
  }
};

const dx = (x) => x * view.scaleX;
const dy = (y) => y * view.scaleY;
const font = (classic, size, bold = false) => {
  rd.letterSpacing = "0px";
  rd.font = classic
    ? `bold ${Math.round(size * 0.7 * (view.height / 450))}px Arial`
    : `${bold ? "bold " : ""}${size * 0.5 * (view.scaleY + view.scaleX)}px verd`;
};

// the looks' colours: the classic one the original's menu blue and black
const COLORS = {
  classic: {
    panel: "rgba(0,0,0,0.65)",
    edge: "rgb(0,128,255)",
    played: "rgb(0,128,255)",
    unplayed: "rgba(255,255,255,0.15)",
    button: "rgba(0,0,0,0)",
    over: "rgba(0,128,255,0.25)",
    label: "rgb(0,128,255)",
    pressed: "rgb(255,255,180)",
    key: "rgb(150,150,150)",
    text: "rgb(0,128,255)",
  },
  modern: {
    panel: "rgba(0,16,32,0.6)",
    edge: "rgba(1,234,255,0.35)",
    played: "#01EAFF",
    unplayed: "rgba(255,255,255,0.18)",
    button: "rgba(255,255,255,0.08)",
    over: "rgba(1,234,255,0.25)",
    label: "#FFFFFF",
    pressed: "#01EAFF",
    key: "rgba(160,230,255,0.8)",
    text: "#FFFFFF",
  },
};

const rounded = (x, y, width, height, radius) => {
  rd.beginPath();
  if (rd.roundRect) {
    rd.roundRect(x, y, width, height, radius);
  } else {
    rd.rect(x, y, width, height);
  }
};

const over = (x, y, width, height) =>
  pointer.x[0] > x &&
  pointer.x[0] < x + width &&
  pointer.y[0] > y &&
  pointer.y[0] < y + height;

// --- the bar of the whole race ---

let draggingBar = false;

const drawBar = (colors) => {
  const x = dx(BAR.left);
  const y = dy(BAR.top);
  const width = dx(BAR.right - BAR.left);
  const height = BAR.height * view.scale;
  const played = lastFrame() > 0 ? viewer.frame / lastFrame() : 1;
  rd.fillStyle = colors.unplayed;
  rounded(x, y, width, height, height / 2);
  rd.fill();
  rd.fillStyle = colors.played;
  rounded(x, y, Math.max(height, width * played), height, height / 2);
  rd.fill();
  rd.beginPath();
  rd.arc(x + width * played, y + height / 2, height, 0, 2 * Math.PI);
  rd.fillStyle = "#FFFFFF";
  rd.fill();
  // pressed on it (with room around), and dragged: the race jumps along
  const reach = 12 * view.scale;
  if (!pointer.down) {
    draggingBar = false;
  } else if (
    over(x - reach, y - reach, width + 2 * reach, height + 2 * reach)
  ) {
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

// --- buttons: flat, the label and its key below it; clicked when let go on them ---

// the button pressed, by its index
let pressed = -1;

const button = (index, count, label, key, classic, colors) => {
  const { left, right, top, height, gap } = BUTTONS;
  const each = (right - left - gap * (count - 1)) / count;
  const x = dx(left + index * (each + gap));
  const y = dy(top);
  const width = dx(each);
  const h = dy(height);
  const hovered = over(x, y, width, h);
  if (pointer.down && hovered && !draggingBar && pressed == -1) {
    pressed = index;
  }
  rd.fillStyle = hovered ? colors.over : colors.button;
  rounded(x, y, width, h, 8 * view.scale);
  rd.fill();
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  font(classic, 15, true);
  rd.fillStyle = pressed == index && hovered ? colors.pressed : colors.label;
  rd.fillText(label, x + width / 2, y + h * 0.38);
  font(classic, 10);
  rd.fillStyle = colors.key;
  rd.fillText(key, x + width / 2, y + h * 0.75);
  const clicked = !pointer.down && pressed == index && hovered;
  return clicked;
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
  KeyH: () => (pinned = !pinned),
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
  const onRace = !panelShown() || pointer.y[0] < dy(PANEL.top);
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

// --- the overlay ---

const MORE_KEYS =
  "Left / Right: a step (hold: wind)     Home / End: start / end     " +
  "Free camera: W A S D, Q / E, Shift, drag to look     Behind: Z / X look back";

const stateOf = () =>
  viewer.playing
    ? `${SPEEDS[viewer.speed]}x`
    : viewer.frame == lastFrame()
      ? "End"
      : "Paused";

// top left: the title, the time and how fast it plays
const drawTitle = (classic, colors) => {
  const line = `${time(viewer.frame)} / ${time(lastFrame())}   ${stateOf()}`;
  rd.textAlign = "left";
  rd.textBaseline = "middle";
  if (classic) {
    // (the original's flickering "Replay >>" at the top)
    drawClassicReplayLabel();
    rd.textAlign = "left";
    font(classic, 14);
    rd.fillStyle = colors.text;
    rd.fillText(line, dx(20), dy(35));
    return;
  }
  rd.letterSpacing = "1px";
  rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
  rd.fillStyle = "rgb(0,32,64)";
  rd.fillText("REPLAY", dx(20), dy(35));
  font(classic, 20);
  rd.fillStyle = "rgb(0,32,64)";
  rd.fillText(line, dx(20), dy(80));
};

// bottom middle, while the panel is hidden
const drawHint = (classic, colors) => {
  const text = "Press H for the replay controls";
  font(classic, 15, true);
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  const x = dx(640);
  const y = dy(690);
  const width = rd.measureText(text).width + dx(40);
  rd.fillStyle = colors.panel;
  rounded(x - width / 2, y - dy(18), width, dy(36), dy(18));
  rd.fill();
  rd.fillStyle = colors.text;
  rd.fillText(text, x, y);
};

const drawPanel = (classic, colors) => {
  const x = dx(PANEL.left);
  const y = dy(PANEL.top);
  const width = dx(PANEL.right - PANEL.left);
  const height = dy(PANEL.bottom - PANEL.top);
  rd.fillStyle = colors.panel;
  rounded(x, y, width, height, 14 * view.scale);
  rd.fill();
  rd.strokeStyle = colors.edge;
  rd.lineWidth = Math.max(1, view.scale);
  rd.stroke();
  font(classic, 13);
  rd.fillStyle = colors.text;
  rd.textBaseline = "middle";
  rd.textAlign = "left";
  rd.fillText(
    `${CAMERA_NAMES[camera.mode] ?? "Camera"} camera,  car ${camera.target + 1}`,
    dx(BAR.left),
    dy(563),
  );
  rd.textAlign = "right";
  rd.fillText(
    pinned ? "H: hide the controls" : "H: keep the controls",
    dx(BAR.right),
    dy(563),
  );
  drawBar(colors);
  const all = controls();
  const chosen = all
    .map(([label, key], i) =>
      button(i, all.length, label, key, classic, colors),
    )
    .indexOf(true);
  if (!pointer.down) {
    pressed = -1;
  }
  font(classic, 10);
  rd.fillStyle = colors.key;
  rd.textAlign = "center";
  rd.fillText(MORE_KEYS, dx(640), dy(684));
  all[chosen]?.[2]();
};

export function drawReplayOverlay() {
  rd.clearRect(0, 0, view.width, view.height);
  const classic = look.current == LOOK.classic;
  const colors = classic ? COLORS.classic : COLORS.modern;
  watchPointer();
  drawTitle(classic, colors);
  if (panelShown()) {
    drawPanel(classic, colors);
  } else {
    pressed = -1;
    drawHint(classic, colors);
  }
  readKeys();
  moveFree();
}
