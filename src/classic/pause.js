// The pause in the classic look, as the original game drew it (its pauseimage and
// pausedgame): the race stood still in grey, smeared to the right, with a blue field
// behind the "Paused" picture and its four choices, the chosen one lit.
import { CONFIRM, confirm } from "../input/confirm.js";
import { racers } from "../race/racers.js";
import {
  centred,
  draw,
  drawRoundRect,
  fillRoundRect,
  font,
  freezeRace,
  frozenPixels,
  mouse,
  overon,
  picture,
  screen,
  startScreen,
  text,
} from "./screen.js";

// resume, instant replay, the game instructions, quit, as paused.gif lists them
const CHOICES = [
  [329, 45, 137, 22],
  [320, 73, 155, 22],
  [303, 99, 190, 22],
  [341, 125, 109, 22],
];

const state = { image: null, shaded: false };

export const startClassicPause = () => {
  freezeRace();
  state.image = null;
  state.shaded = false;
};

// Every pixel the average of its colours, running on from the pixels left of it (a
// thirty-third of it new), in grey, in blue behind the picture. (The original's field
// starts a pixel right of the picture.)
const pauseImage = (pixels) => {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 450;
  const data = new ImageData(new Uint8ClampedArray(pixels.data), 800, 450);
  const px = data.data;
  let fieldX = 0;
  let fieldRow = 0;
  let v = 0;
  for (let i = 0; i < 360000; i++) {
    const at = i * 4;
    const sum = px[at] + px[at + 1] + px[at + 2];
    v = i % 800 == 0 ? Math.trunc(sum / 3) : Math.trunc((sum + v * 30) / 33);
    if (i > 800 * (8 + fieldRow) + 281 && fieldRow < 188) {
      px[at] = Math.trunc((v + 60) / 3);
      px[at + 1] = Math.trunc((v + 135) / 3);
      px[at + 2] = Math.trunc((v + 220) / 3);
      fieldX++;
      if (fieldX == 237) {
        fieldRow++;
        fieldX = 0;
      }
    } else {
      px[at] = v;
      px[at + 1] = v;
      px[at + 2] = v;
    }
    px[at + 3] = 255;
  }
  canvas.getContext("2d").putImageData(data, 0, 0);
  return canvas;
};

// The screen for a tick, with the choice selected (0 to 3) and whether "not enough to
// replay" shows. Returns the choice made or -1, and the selection as it is now.
export const drawClassicPause = (selected, tooShort) => {
  startScreen();
  const pixels = frozenPixels();
  if (!state.image && pixels) {
    state.image = pauseImage(pixels);
  }
  if (state.image) {
    screen.g.drawImage(state.image, 0, 0);
  }
  const input = racers[0].u;
  if (input.up) {
    selected = (selected + 3) % 4;
    input.up = false;
  }
  if (input.down) {
    selected = (selected + 1) % 4;
    input.down = false;
  }
  CHOICES.forEach(([x, y, w, h], i) => {
    if (overon(x, y, w, h)) {
      if (mouse.moved && !mouse.down) {
        selected = i;
      }
      if (mouse.pressed) {
        selected = i;
        state.shaded = true;
      }
    }
  });
  const [x, y, w, h] = CHOICES[selected];
  fillRoundRect(x, y, w, h, 7, 20, [64, 143, 223]);
  drawRoundRect(
    x,
    y,
    w,
    h,
    7,
    20,
    state.shaded ? [225, 200, 255] : [0, 89, 223],
  );
  draw(picture("paused.gif"), 281, 8);
  if (tooShort) {
    fillRoundRect(200, 73, 400, 23, 7, 20, [64, 143, 223]);
    drawRoundRect(200, 73, 400, 23, 7, 20, [0, 89, 223]);
    font(12);
    const s =
      "Sorry not enough replay data to play available, please try again later.";
    const tx = Math.trunc(400 - screen.g.measureText(s).width / 2);
    text(s, tx + 1, 90, [0, 0, 0]);
    centred(89, s, [255, 255, 255]);
  }
  let chosen = -1;
  if (confirm.state == CONFIRM.pressed) {
    confirm.state = CONFIRM.used;
    chosen = selected;
  }
  if (mouse.released && state.shaded) {
    state.shaded = false;
    if (overon(x, y, w, h)) {
      chosen = selected;
    }
  }
  return { chosen, selected };
};
