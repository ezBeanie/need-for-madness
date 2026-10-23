// The stage select in the classic look, as the original game drew it (its stageselect,
// cantgo, loadingstage and trackbg): a picture of a track scrolling left behind the
// sepia preview, now and then flashing, in a torn frame with the stage's number and name
// above. Also the screens of a locked stage and of a stage loading.
import { random } from "../core/random.js";
import {
  centred,
  draw,
  drawFrame,
  drawRoundRect,
  fillRoundRect,
  font,
  mouse,
  over3D,
  overImage,
  picture,
  startScreen,
  textButton,
} from "./screen.js";

const background = { x: [65, 735], sinceFlash: 0, flashAfter: 0 };

// trackbg: two copies of the picture scrolling left 10 pixels a frame; one frame flashes
// bright after 0 to 39 frames. (The original drew the loading screen once: there it
// stands still and does not flash.)
const drawTrackBackground = (moves = true) => {
  let bright = false;
  if (moves) {
    background.sinceFlash++;
    if (background.sinceFlash > background.flashAfter) {
      bright = true;
      background.sinceFlash = 0;
      background.flashAfter = Math.trunc(random.fx() * 40);
    }
  }
  const image = bright
    ? picture("track.jpg", "flash")
    : picture("track.jpg", "tinted", 3);
  for (let i = 0; i < 2; i++) {
    draw(image, background.x[i], 25);
    if (moves) {
      background.x[i] -= 10;
      if (background.x[i] <= -605) {
        background.x[i] = 735;
      }
    }
  }
  drawFrame();
};

const state = {
  blink: false,
  // a button held down, by its picture
  pressed: null,
};

// back, next and continue: light yellow while held, clicked when let go on them
const imageButton = (file, x, y) => {
  const image = picture(file, state.pressed == file ? "pressed" : "plain");
  draw(image, x, y);
  if (overImage(image, x, y) && mouse.pressed) {
    state.pressed = file;
  }
  const clicked =
    mouse.released && state.pressed == file && overImage(image, x, y);
  if (clicked) {
    state.pressed = null;
  }
  return clicked;
};

const releaseButtons = () => {
  if (mouse.released) {
    state.pressed = null;
  }
};

const drawTitle = () => {
  draw(picture("br.png"), 65, 25);
  draw(picture("select.gif"), 338, 35);
};

// The screen for a tick: { title, name, first, last, buttons (this game's own, as
// [id, text, x, y]), tip (lines, or null) }. Returns "back", "next", "continue", "exit", a
// button's id or null.
export const drawClassicStageSelect = ({
  title,
  name,
  first,
  last,
  buttons,
  tip,
}) => {
  startScreen();
  drawTrackBackground();
  over3D();
  drawTitle();
  let chosen = null;
  if (!first && imageButton("back.gif", 115, 135)) {
    chosen = "back";
  }
  if (!last && imageButton("next.gif", 625, 135)) {
    chosen = "next";
  }
  font(13);
  centred(80, title, [255, 128, 0]);
  centred(100, `| ${name} |`, state.blink ? [240, 240, 240] : [176, 176, 176]);
  state.blink = !state.blink;
  if (tip) {
    // the original never had tips: they show in its loading box's colours
    const height = 30 + tip.length * 20;
    fillRoundRect(115, 150, 570, height, 20, 40, [212, 214, 138]);
    drawRoundRect(115, 150, 570, height, 20, 40, [57, 64, 8]);
    font(12);
    tip.forEach((line, i) => centred(175 + i * 20, line, [58, 61, 17]));
  }
  if (imageButton("continue.gif", 355, 360)) {
    chosen = "continue";
  }
  if (textButton(" Exit X ", 670, 30)) {
    chosen = "exit";
  }
  for (const [id, label, x, y] of buttons) {
    if (textButton(label, x, y)) {
      chosen = id;
    }
  }
  releaseButtons();
  return chosen;
};

// cantgo: the next stage stays shut behind bars until this one is won, for 100 frames.
// Returns whether the screen is over.
// loadingstage: the track picture still, the frame, and a box saying to wait.
export const drawClassicLoading = (showTitle) => {
  startScreen();
  drawTrackBackground(false);
  draw(picture("br.png"), 65, 25);
  fillRoundRect(265, 201, 270, 26, 20, 40, [212, 214, 138]);
  drawRoundRect(265, 201, 270, 26, 20, 40, [57, 64, 8]);
  font(12);
  centred(219, "Loading, please wait...", [58, 61, 17]);
  if (showTitle) {
    draw(picture("select.gif"), 338, 35);
  }
};
