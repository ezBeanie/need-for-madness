// The replay viewer's controls over the race (see race/replayViewer.js): the title, time
// and car followed; a hint, and the controls only when asked for (H, or the hint
// clicked): a bar of the whole race to jump along and a low row of buttons, each with
// its key; and the cars to follow, driving in at the screen's edges (Tab). The viewer
// reads the keys by their place on the keyboard: W A S D are the free camera's, not the
// arrows' as in races.

import { game } from "../core/state.js";
import { carStats } from "../data/carStats.js";
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
import { classicMenus } from "../render/look.js";
import { leaveOpenedReplay, saveReplay } from "../screens/replays.js";
import { CAMERA, camera } from "../render/camera.js";
import { isPhone } from "../core/platform.js";
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
  if (picker.open) {
    return 0;
  }
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

// --- the controls: hidden until asked for (H, or the hint clicked or touched) ---

// Where the controls go, in the window's pixels: a row of buttons along the bottom (two
// rows on a narrow screen), the bar of the race above it, a line of the other keys
// above that. Big enough to touch on phones, where the keys go unmentioned.
const layout = () => {
  const touch = isPhone;
  const margin = Math.max(6, 16 * view.scale);
  const gap = Math.max(4, 6 * view.scale);
  const row = Math.max(touch ? 44 : 28, 36 * view.scale);
  const count = controls().length;
  const width = view.width - 2 * margin;
  const fewest = touch ? 88 : 100;
  const perRow = Math.max(
    1,
    Math.min(count, Math.floor((width + gap) / (fewest + gap))),
  );
  const rows = Math.ceil(count / perRow);
  const buttonsTop = view.height - margin - rows * row - (rows - 1) * gap;
  const seek = { x: margin, width, height: row, y: buttonsTop - gap - row };
  const lineHeight = Math.max(touch ? 32 : 18, 18 * view.scale);
  const line = { y: seek.y - gap - lineHeight, height: lineHeight };
  const buttonAt = (i) => {
    const r = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - r * perRow);
    const each = (width - gap * (inRow - 1)) / inRow;
    return {
      x: margin + (i % perRow) * (each + gap),
      y: buttonsTop + r * (row + gap),
      width: each,
      height: row,
    };
  };
  return { touch, seek, line, buttonAt, top: line.y - gap };
};

let shown = false;
let lastPointer = { x: -1, y: -1 };
let pointerMoved = false;

const panelShown = () => shown || draggingBar;

const watchPointer = () => {
  pointerMoved = pointer.x[0] != lastPointer.x || pointer.y[0] != lastPointer.y;
  lastPointer = { x: pointer.x[0], y: pointer.y[0] };
};

const dx = (x) => x * view.scaleX;
const dy = (y) => y * view.scaleY;
const font = (classic, size, bold = false) => {
  rd.letterSpacing = "0px";
  rd.font = classic
    ? `bold ${Math.round(size * 0.7 * (view.height / 450))}px Arial`
    : `${bold ? "bold " : ""}${size * 0.5 * (view.scaleY + view.scaleX)}px verd`;
};

// a font so many pixels high: the classic look's the original's bold Arial
const pixelFont = (size, bold = false) => {
  rd.letterSpacing = "0px";
  rd.font = classicMenus()
    ? `bold ${Math.round(size)}px Arial`
    : `${bold ? "bold " : ""}${Math.round(size)}px verd`;
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

// --- the bar of the whole race: its own element, the times at its ends ---

let draggingBar = false;

const drawSeekBar = (colors, { seek }) => {
  const box = seek;
  rd.fillStyle = colors.panel;
  rounded(box.x, box.y, box.width, box.height, box.height / 2);
  rd.fill();
  pixelFont(box.height * 0.36, true);
  rd.fillStyle = colors.text;
  rd.textBaseline = "middle";
  const middle = box.y + box.height / 2;
  const inset = box.height * 0.5;
  rd.textAlign = "left";
  rd.fillText(time(viewer.frame), box.x + inset, middle);
  rd.textAlign = "right";
  rd.fillText(time(lastFrame()), box.x + box.width - inset, middle);
  const timeWidth = rd.measureText("00:00.0").width + inset * 1.5;
  const x = box.x + timeWidth;
  const width = box.width - 2 * timeWidth;
  const height = Math.max(6, box.height * 0.22);
  const y = middle - height / 2;
  const played = lastFrame() > 0 ? viewer.frame / lastFrame() : 1;
  rd.fillStyle = colors.unplayed;
  rounded(x, y, width, height, height / 2);
  rd.fill();
  rd.fillStyle = colors.played;
  rounded(x, y, Math.max(height, width * played), height, height / 2);
  rd.fill();
  rd.beginPath();
  rd.arc(x + width * played, middle, height, 0, 2 * Math.PI);
  rd.fillStyle = "#FFFFFF";
  rd.fill();
  // pressed on it (anywhere on its element), and dragged: the race jumps along
  if (!pointer.down) {
    draggingBar = false;
  } else if (over(box.x, box.y, box.width, box.height)) {
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

// --- buttons: flat and low, the label and its key beside it; clicked when let go ---

// the button pressed, by its index
let pressed = -1;

const button = (index, box, label, key, colors) => {
  const { x, y, width, height: h } = box;
  const hovered = over(x, y, width, h);
  if (pointer.down && hovered && !draggingBar && pressed == -1) {
    pressed = index;
  }
  rd.fillStyle = hovered ? colors.over : colors.panel;
  rounded(x, y, width, h, h / 2);
  rd.fill();
  rd.textBaseline = "middle";
  rd.textAlign = "left";
  pixelFont(h * 0.3);
  const keyWidth = key ? rd.measureText(key).width : 0;
  pixelFont(h * 0.36, true);
  const labelWidth = rd.measureText(label).width;
  const space = key ? h * 0.18 : 0;
  const textLeft = x + (width - labelWidth - space - keyWidth) / 2;
  rd.fillStyle = pressed == index && hovered ? colors.pressed : colors.label;
  rd.fillText(label, textLeft, y + h / 2);
  if (key) {
    pixelFont(h * 0.3);
    rd.fillStyle = colors.key;
    rd.fillText(key, textLeft + labelWidth + space, y + h / 2);
  }
  return !pointer.down && pressed == index && hovered;
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
  ["<< 5 s", "\u21e7\u2190", () => jump(-JUMP_FRAMES)],
  [viewer.playing ? "Pause" : "Play", "Space", togglePlaying],
  ["5 s >>", "\u21e7\u2192", () => jump(JUMP_FRAMES)],
  ["Slower", "\u2193", () => changeSpeed(-1)],
  ["Faster", "\u2191", () => changeSpeed(1)],
  [CAMERA_NAMES[camera.mode] ?? "Camera", "V", nextCamera],
  ["Cars", "Tab", togglePicker],
  ...(canSave() ? [["Save", "Ctrl+S", save]] : []),
  ["Exit", "Esc", exit],
];

// what the keys do that have no button of their own, or more than one key
const KEYS = {
  Tab: togglePicker,
  Space: togglePlaying,
  KeyV: nextCamera,
  KeyH: () => (shown = !shown),
  Home: () => seekReplay(0),
  End: () => seekReplay(lastFrame()),
  ArrowUp: () => changeSpeed(1),
  ArrowDown: () => changeSpeed(-1),
};

const readKeys = () => {
  let escaped = false;
  for (const { code, shift, ctrl } of takePressedKeys()) {
    escaped ||= code == "Escape";
    if (picker.open && pickerKey(code)) {
      continue;
    }
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
    // (Enter follows the chosen car while the list shows; Escape still leaves)
    if (!picker.open || escaped) {
      exit();
    }
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
  const onRace = !panelShown() || pointer.y[0] < layout().top;
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

// --- the list of cars to follow: a picture of each, its name ---

// the player's own car is marked
const carName = (c) =>
  carStats.names[game.carTypes[c]] + (c == game.player ? " (You)" : "");

const picker = { open: false, choice: 0 };
// the pictures, by look and car type (see tools/replay/carPictures.mjs)
const pictures = new Map();

const pictureOf = (classic, type) => {
  const key = `${classic ? "classic" : "modern"}/car${type}`;
  if (!pictures.has(key)) {
    const image = new Image();
    image.src = `data/cars/${key}.jpg`;
    pictures.set(key, image);
  }
  const image = pictures.get(key);
  return image.complete && image.naturalWidth ? image : null;
};

function togglePicker() {
  picker.open = !picker.open;
  picker.choice = camera.target;
  picker.ticks = 0;
}

// (the list stays: only Tab, or its button, takes it away)
const pick = (c) => {
  picker.choice = c;
  if (c != camera.target) {
    nextCar(c - camera.target);
  }
};

// The cars drive in from the screen's edges: the first half down the left, the others
// down the right. Where car c's card is: { side (0 left, 1 right), row }.
const cardOf = (c, count) => {
  const perSide = Math.ceil(count / 2);
  return c < perSide
    ? { side: 0, row: c, perSide }
    : { side: 1, row: c - perSide, perSide };
};

// While the list shows, the arrows choose a car and Enter follows it (the rest of the
// keys do what they always do). Returns whether the key was the list's.
const pickerKey = (code) => {
  const count = game.carCount;
  const { side, row, perSide } = cardOf(picker.choice, count);
  const at = (s, r) =>
    Math.min(count - 1, s * perSide + Math.max(0, Math.min(perSide - 1, r)));
  if (code == "ArrowUp" || code == "ArrowDown") {
    picker.choice = at(side, row + (code == "ArrowUp" ? -1 : 1));
  } else if (code == "ArrowLeft" || code == "ArrowRight") {
    picker.choice = at(code == "ArrowLeft" ? 0 : 1, row);
  } else if (code == "Enter") {
    pick(picker.choice);
  } else {
    return false;
  }
  return true;
};

// the cards in design units: as wide as a picture 5 by 3 at its tallest, the name on it
// the cards: at most so wide and high (design units), at least so high to be touched
// (pixels), a picture 5 by 3 with the name on it; below the title, above the controls
const CARD = { width: 210, tallest: 126, smallest: 56, gap: 8, margin: 14 };
const TITLE_BOTTOM = 130;

// ticks the cards take to drive in
const DRIVE_IN = 8;

const drawPicker = (classic, colors) => {
  const count = game.carCount;
  const { perSide } = cardOf(0, count);
  // in pixels: down to the controls, or the hint
  const top = dy(TITLE_BOTTOM) + 8;
  const bottom = panelShown()
    ? layout().top
    : view.height - 3 * layout().seek.height;
  const gap = dy(CARD.gap);
  // in more columns on each side while too few would make them too small to touch
  let columns = 1;
  let rows = perSide;
  const fit = () => (bottom - top - gap * (rows - 1)) / rows;
  while (fit() < CARD.smallest && columns < perSide) {
    columns++;
    rows = Math.ceil(perSide / columns);
  }
  const tall = Math.max(CARD.smallest, Math.min(dy(CARD.tallest), fit()));
  const width = Math.min(dx(CARD.width), (tall * 5) / 3);
  const sideWidth = columns * width + (columns - 1) * gap;
  // driving in: fast, then slowing down
  picker.ticks = Math.min(DRIVE_IN, (picker.ticks ?? 0) + 1);
  const t = picker.ticks / DRIVE_IN;
  const inBy = (1 - (1 - t) ** 3) * (sideWidth + dx(CARD.margin));
  let clicked = -1;
  for (let c = 0; c < count; c++) {
    const { side, row: place } = cardOf(c, count);
    const column = place % columns;
    const row = Math.floor(place / columns);
    const sideLeft = side == 0 ? inBy - sideWidth : view.width - inBy;
    const x = sideLeft + column * (width + gap);
    const y = top + row * (tall + gap);
    const w = width;
    const h = tall;
    const hovered = over(x, y, w, h);
    if (hovered && pointerMoved) {
      picker.choice = c;
    }
    const chosen = c == picker.choice;
    rd.fillStyle = colors.panel;
    rounded(x, y, w, h, 10 * view.scale);
    rd.fill();
    const picture = pictureOf(classic, game.carTypes[c]);
    rd.save();
    rounded(x, y, w, h, 10 * view.scale);
    rd.clip();
    if (picture) {
      rd.drawImage(picture, x, y, w, h);
    }
    // the name on a dark strip along the bottom
    const strip = Math.max(16, h * 0.22);
    rd.fillStyle = "rgba(0,0,0,0.6)";
    rd.fillRect(x, y + h - strip, w, strip);
    rd.restore();
    rd.strokeStyle = chosen ? colors.pressed : colors.edge;
    rd.lineWidth = (chosen ? 3 : 1) * view.scale;
    rounded(x, y, w, h, 10 * view.scale);
    rd.stroke();
    // (a long name smaller, to fit)
    pixelFont(strip * 0.6, true);
    const nameWidth = rd.measureText(carName(c)).width;
    if (nameWidth > w * 0.92) {
      pixelFont((strip * 0.6 * w * 0.92) / nameWidth, true);
    }
    rd.textAlign = "center";
    rd.textBaseline = "middle";
    rd.fillStyle = c == camera.target ? colors.pressed : "#FFFFFF";
    rd.fillText(carName(c), x + w / 2, y + h - strip / 2);
    // (a card's press told from a button's: both may show at once)
    if (hovered && pointer.down) {
      pressed = `car${c}`;
    }
    if (hovered && !pointer.down && pressed == `car${c}`) {
      clicked = c;
    }
  }
  // (the press is let go of after the controls below had their look at it)
  if (clicked >= 0) {
    pick(clicked);
  }
};

// --- the overlay ---

// the keys with no button, and the free camera's while it is on
const keysLine = () =>
  "\u2190 \u2192: a step (hold: wind)     Home / End: start / end     " +
  (camera.mode == CAMERA.free
    ? "Free camera: W A S D, Q / E, Shift, drag to look"
    : camera.mode == CAMERA.behind
      ? "Z / X: look back"
      : "C / \u21e7C: next / previous car") +
  "     H: hide";

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
    font(classic, 16, true);
    rd.fillText(carName(camera.target), dx(20), dy(62));
    return;
  }
  rd.letterSpacing = "1px";
  rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
  rd.fillStyle = "rgb(0,32,64)";
  rd.fillText("REPLAY", dx(20), dy(35));
  font(classic, 20);
  rd.fillStyle = "rgb(0,32,64)";
  rd.fillText(line, dx(20), dy(80));
  font(classic, 22, true);
  rd.fillText(carName(camera.target), dx(20), dy(118));
};

// A line of text in a pill, its middle at (x, y) and so high, in pixels; returns
// whether it was clicked.
const drawPill = (colors, text, x, y, height, id) => {
  pixelFont(height * 0.42, true);
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  const width = Math.min(
    view.width - 12,
    rd.measureText(text).width + height * 1.2,
  );
  const left = x - width / 2;
  const top = y - height / 2;
  const hovered = over(left, top, width, height);
  rd.fillStyle = hovered ? colors.over : colors.panel;
  rounded(left, top, width, height, height / 2);
  rd.fill();
  rd.fillStyle = colors.text;
  rd.fillText(text, x, y);
  if (hovered && pointer.down) {
    pressed = id;
  }
  return hovered && !pointer.down && pressed == id;
};

// the hint at the bottom, while the controls are hidden; it shows them when clicked
const drawHint = (colors) => {
  const { touch } = layout();
  const height = Math.max(touch ? 44 : 30, 34 * view.scale);
  const text = picker.open
    ? touch
      ? "Tap a car to follow it.   Tap here for the controls"
      : "Click a car to follow it   Tab: hide the cars   H: the controls"
    : touch
      ? "Tap here for the replay controls"
      : "Press H for the replay controls";
  if (
    drawPill(colors, text, view.width / 2, view.height - height, height, "hint")
  ) {
    shown = true;
  }
};

const drawControls = (colors) => {
  const place = layout();
  // the other keys; on a phone, where to hide the controls again
  const line = place.touch ? "Tap here to hide the controls" : keysLine();
  if (
    drawPill(
      colors,
      line,
      view.width / 2,
      place.line.y + place.line.height / 2,
      place.line.height,
      "line",
    )
  ) {
    shown = false;
  }
  drawSeekBar(colors, place);
  const all = controls();
  const chosen = all
    .map(([label, key], i) =>
      button(i, place.buttonAt(i), label, place.touch ? "" : key, colors),
    )
    .indexOf(true);
  all[chosen]?.[2]();
};

export function drawReplayOverlay() {
  rd.clearRect(0, 0, view.width, view.height);
  const classic = classicMenus();
  const colors = classic ? COLORS.classic : COLORS.modern;
  watchPointer();
  drawTitle(classic, colors);
  if (picker.open) {
    drawPicker(classic, colors);
  }
  if (panelShown()) {
    drawControls(colors);
  } else {
    drawHint(colors);
  }
  if (!pointer.down) {
    pressed = -1;
  }
  readKeys();
  moveFree();
}
