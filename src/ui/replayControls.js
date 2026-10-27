// The replay viewer's controls over the race (see race/replayViewer.js): the time, a
// bar of the whole race to jump along, and buttons. Keys: space plays and pauses, the
// arrows left and right step (held: wind), up and down change the speed, V the camera,
// C the car followed, Enter or Escape closes it.

import { game } from "../core/state.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { pointer } from "../input/pointer.js";
import { drawClassicReplayLabel } from "../classic/hud.js";
import { racers } from "../race/racers.js";
import {
  SPEEDS,
  VIEWER_FROM,
  changeSpeed,
  closeReplay,
  lastFrame,
  nextCamera,
  nextCar,
  seekReplay,
  togglePlaying,
  viewer,
} from "../race/replayViewer.js";
import { LOOK, look } from "../render/look.js";
import { leaveOpenedReplay, saveReplay } from "../screens/replays.js";
import { CAMERA, camera } from "../render/camera.js";
import { BUTTON, drawButton } from "./widgets.js";
import { rd, view } from "./view.js";

const TICK_SECONDS = 0.035;
// a jump of the buttons back and forth
const JUMP_FRAMES = Math.round(5 / TICK_SECONDS);
const CAMERA_NAMES = {
  [CAMERA.orbit]: "Orbit",
  [CAMERA.behind]: "Behind",
  [CAMERA.trackside]: "Track",
};

// -1 or 1 while the left or right arrow is held
export const heldArrow = () => {
  const input = racers[game.player].u;
  return input.left ? -1 : input.right ? 1 : 0;
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
  rd.font = `bold ${Math.round(13 * (view.height / 450))}px Arial`;
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

const button = (id, label, index, count) => {
  const x = ((index + 0.5) * 1280 * view.scaleX) / count;
  const y = 720 * view.scaleY - 80 * view.scale;
  if (look.current == LOOK.classic) {
    return classicButton(id, label, x, y, 120 * view.scale, 40 * view.scale);
  }
  return drawButton({
    id,
    x,
    y,
    width: 120,
    height: 46,
    faceTop: "#019DFF",
    faceBottom: "#01EAFF",
    shadowTop: "#004A78",
    shadowBottom: "#016D77",
    layout: BUTTON.textOnly,
    text: label,
    fontSize: 15,
    textOpacity: 0.8,
    image: null,
    imageOpacity: 0,
    pulsing: false,
  });
};

// Back to where the viewer was opened from; after a replay file, the main menu.
const exit = () => {
  const fromFile = viewer.from == VIEWER_FROM.file;
  closeReplay();
  if (fromFile) {
    leaveOpenedReplay();
  }
};

// what the buttons do, in their order (a replay file needs no saving again)
const buttons = () => [
  ...BUTTONS,
  ...(viewer.from == VIEWER_FROM.file ? [] : [["Save", saveReplay]]),
  ["Exit", exit],
];
const BUTTONS = [
  ["<< 5 Sec", () => seekReplay(viewer.frame - JUMP_FRAMES)],
  [() => (viewer.playing ? "Pause" : "Play"), togglePlaying],
  ["5 Sec >>", () => seekReplay(viewer.frame + JUMP_FRAMES)],
  [() => `Speed ${SPEEDS[viewer.speed]}x`, () => changeSpeed(1)],
  [() => CAMERA_NAMES[camera.mode] ?? "Camera", nextCamera],
  [() => `Car ${camera.target + 1}`, nextCar],
];

// --- the overlay ---

const drawInfo = (classic) => {
  const state = viewer.playing
    ? `${SPEEDS[viewer.speed]}x`
    : viewer.frame == lastFrame()
      ? "End"
      : "Paused";
  const line = `${time(viewer.frame)} / ${time(lastFrame())}   ${state}`;
  rd.textAlign = "left";
  rd.textBaseline = "middle";
  if (classic) {
    rd.font = `bold ${Math.round(13 * (view.height / 450))}px Arial`;
    rd.fillStyle = "rgb(0,128,255)";
    rd.fillText(line, BAR.left * view.scaleX, (BAR.top - 18) * view.scaleY);
    return;
  }
  rd.letterSpacing = "1px";
  rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
  rd.fillStyle = "rgb(0,32,64)";
  rd.fillText("REPLAY", 20 * view.scaleX, 35 * view.scaleY);
  rd.font = "" + 10 * (view.scaleY + view.scaleX) + "px verd";
  rd.letterSpacing = "0px";
  rd.fillText(line, 20 * view.scaleX, 80 * view.scaleY);
};

const readKeys = () => {
  const input = racers[game.player].u;
  if (input.up) {
    changeSpeed(1);
    input.up = false;
  }
  if (input.down) {
    changeSpeed(-1);
    input.down = false;
  }
  if (confirm.state == CONFIRM.pressed) {
    confirm.state = CONFIRM.used;
    exit();
  }
};

export function drawReplayOverlay() {
  rd.clearRect(0, 0, view.width, view.height);
  const classic = look.current == LOOK.classic;
  if (classic) {
    drawClassicReplayLabel();
  }
  drawInfo(classic);
  drawBar(classic);
  const all = buttons();
  all.forEach(([label, act], i) => {
    const text = typeof label == "function" ? label() : label;
    if (button(20 + i, text, i, all.length)) {
      act();
    }
  });
  readKeys();
}
