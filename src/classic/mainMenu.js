// The main menu in the classic look, as the original game drew it (its maini and mainbg):
// a pattern scrolling down over orange, the clouds with the Madness logo, Coach Insano
// fading in and out, the cars flying by, and the options on a dark patch, the chosen one
// boxed in a blinking outline. The original offered multiplayer and credits; this game
// offers to play, the instructions and, once all is won, to reset the game.
import { random } from "../core/random.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { racers } from "../race/racers.js";
import {
  draw,
  drawFrame,
  drawRoundRect,
  fill,
  mouse,
  overon,
  picture,
  screen,
  startScreen,
  textButton,
} from "./screen.js";

export const OPTION = { play: 0, instructions: 1, reset: 2, replay: 3 };

// The options as the original had them: its box, its blinking colours, and the row of
// its labels picture (options.png) the label is in. Each option takes the original's
// row of the same place; the instructions were its third.
const OPTIONS = [
  {
    box: [343, 110],
    colors: [
      [200, 200, 0],
      [255, 128, 0],
    ],
    row: 0,
  },
  {
    box: [301, 196],
    colors: [
      [200, 128, 0],
      [255, 128, 0],
    ],
    row: 2,
  },
  {
    box: [345, 110],
    colors: [
      [200, 0, 0],
      [255, 128, 0],
    ],
    row: null,
  },
];
const TOP = 261;
const ROW = 30;

const state = {
  // Insano's fade (0 to 399) and shake
  fade: 0,
  shake: 0,
  shakeX: 0,
  shakeY: 0,
  selected: 0,
  // the outline's blink
  blink: false,
  // the mouse went down on the selected option
  shaded: false,
};

// mainbg: a pattern (its holes letting the colour under it through) scrolling down over
// a colour, 8 pixels a frame over orange in the menus (mode 1), 2 over khaki in the
// instructions (mode 2), where it gives way to a light blue on their last page.
const BACKGROUNDS = {
  1: { color: [255, 176, 67], speed: 8 },
  2: { color: [188, 170, 122], speed: 2 },
};
const background = { mode: 0, y: [0, -400], blue: 0.2 };

export const drawMenuBackground = (mode = 1, turnsBlue = false) => {
  if (mode != background.mode) {
    background.mode = mode;
    background.y = [0, -400];
    background.blue = 0.2;
  }
  let color = BACKGROUNDS[mode].color;
  if (turnsBlue) {
    const f = background.blue;
    color = [
      Math.trunc(176 * f + 191 * (1 - f)),
      Math.trunc(202 * f + 184 * (1 - f)),
      Math.trunc(255 * f + 124 * (1 - f)),
    ];
    background.blue = Math.min(0.85, background.blue + 0.025);
  } else {
    background.blue = 0.2;
  }
  fill(65, 25, 670, 400, color);
  const pattern = picture("bgmain.jpg", "tinted", 2);
  for (let k = 0; k < 2; k++) {
    if (!turnsBlue) {
      draw(pattern, 65, 25 + background.y[k]);
    }
    background.y[k] += BACKGROUNDS[mode].speed;
    if (background.y[k] >= 400) {
      background.y[k] = -400;
    }
  }
  drawFrame();
};

// Insano fades in to a fifth over 160 frames, stays, and fades out by frame 400; he shakes
// a little every other frame.
const drawInsano = () => {
  let alpha = Math.min(0.2, state.fade / 800);
  if (state.fade > 200) {
    alpha = Math.max(0, (400 - state.fade) / 1000);
  }
  state.fade = (state.fade + 1) % 400;
  draw(picture("d1.png"), 351 + state.shakeX, 28 + state.shakeY, alpha);
  if (state.shake == 0) {
    state.shakeX = Math.trunc(5 - 11 * random.fx());
    state.shakeY = Math.trunc(5 - 11 * random.fx());
  }
  state.shake = (state.shake + 1) % 2;
};

const drawOption = (option, index) => {
  const { box, colors, row } = OPTIONS[option];
  const y = TOP + index * ROW;
  const [x, w] = box;
  if (index == state.selected) {
    if (state.shaded) {
      fill(x, y, w, 22, [140, 70, 0]);
      state.blink = false;
    }
    drawRoundRect(x, y, w, 22, 7, 20, colors[state.blink ? 0 : 1]);
    state.blink = !state.blink;
  } else {
    drawRoundRect(x, y, w, 22, 7, 20, [0, 0, 0]);
  }
  const labels = picture("options.png");
  if (labels && row != null) {
    // the label's row of the picture, which lies at (294, 265) in the original
    screen.g.drawImage(labels, 0, row * ROW, 211, ROW, 294, y + 4, 211, ROW);
  }
  if (row == null) {
    // a label the original never had, in the game's own cartoon font
    screen.g.font = "17px junk";
    screen.g.textAlign = "center";
    screen.g.textBaseline = "alphabetic";
    screen.g.fillStyle = "rgb(214,96,0)";
    screen.g.fillText("Reset Game", 400, y + 17);
    screen.g.textAlign = "left";
  }
  if (overon(x, y, w, 22)) {
    if (mouse.moved && !mouse.down) {
      state.selected = index;
    }
    if (mouse.pressed) {
      state.selected = index;
      state.shaded = true;
    }
  }
};

// Draws the menu for a tick and returns the option chosen, or -1.
export const classicMainMenu = (offersReset) => {
  startScreen();
  drawMenuBackground();
  draw(picture("logomadbg.jpg"), 65, 25, 0.6);
  draw(picture("logomad.png"), 233, 186);
  drawInsano();
  draw(picture("logocars.png"), 66, 33);
  draw(picture("opback.png"), 247, 237);
  const options = offersReset
    ? [OPTION.play, OPTION.instructions, OPTION.reset]
    : [OPTION.play, OPTION.instructions];
  if (state.selected >= options.length) {
    state.selected = 0;
  }
  const input = racers[0].u;
  if (input.up) {
    state.selected = (state.selected + options.length - 1) % options.length;
    input.up = false;
  }
  if (input.down) {
    state.selected = (state.selected + 1) % options.length;
    input.down = false;
  }
  options.forEach((option, index) => drawOption(option, index));
  draw(picture("byrd.png"), 72, 410);
  draw(picture("nfmcoms.png"), 567, 410);
  let chosen = -1;
  // the original had no replay files: one of its rounded buttons
  if (textButton(" Open Replay ", 620, 33)) {
    chosen = OPTION.replay;
  }
  if (confirm.state == CONFIRM.pressed) {
    confirm.state = CONFIRM.used;
    chosen = options[state.selected];
  }
  if (mouse.released && state.shaded) {
    state.shaded = false;
    const [x, w] = OPTIONS[options[state.selected]].box;
    if (overon(x, TOP + state.selected * ROW, w, 22)) {
      chosen = options[state.selected];
    }
  }
  return chosen;
};
