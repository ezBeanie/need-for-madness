// The race end in the classic look, as the original game drew it (its fleximage and
// finish): the race stood still with Madness and Coach Insano put on it, smeared, darkened
// and streaked a little more each frame for seven frames; then the result over it, what
// got unlocked (a new car turning in a flickering box) and the end of the game.
import { random } from "../core/random.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import {
  centred,
  draw,
  fill,
  font,
  freezeRace,
  frozenPixels,
  mouse,
  over3D,
  overImage,
  picture,
  screen,
  startScreen,
} from "./screen.js";

// the floor the original's race end shadows an unlocked car on, our y (its ground, 2470
// below its camera at 0: far out of sight)
export const CLASSIC_UNLOCKED_FLOOR = -222;

// how high the original showed each of its unlocked cars (its y, down), by model
export const UNLOCKED_CAR_Y = {
  maxrevenge: 365,
  leadoxide: 320,
  king: 326,
  radicalone: 350,
  drmonster: 370,
  drifter: 365,
  policecops: 320,
  mustang: 370,
  audir8: 310,
  masheen: 310,
};

const state = {
  // -2 and -1: Madness and Insano on the race; 0 to 6 the passes; 7 done
  pass: -2,
  pixels: null,
  image: null,
  blink: false,
  pressed: false,
  // the Radicalplay logo sliding out and back in at the game's end
  logoX: 212,
  logoTicks: 0,
};

export const startClassicRaceEnd = () => {
  freezeRace();
  state.pass = -2;
  state.pixels = null;
  state.image = null;
  state.pressed = false;
  state.logoX = 212;
  state.logoTicks = 0;
};

const show = () => {
  state.image ??= document.createElement("canvas");
  state.image.width = 800;
  state.image.height = 450;
  state.image.getContext("2d").putImageData(state.pixels, 0, 0);
};

// One pass: every colour mixed with the ones left of it (more each pass), warmer and
// darker, with a little noise of runs of 5 to 19 pixels.
const fleximage = (n) => {
  const px = state.pixels.data;
  let [red, green, blue] = [0, 0, 0];
  let noise = Math.trunc(random.fx() * 128);
  let run = Math.trunc(5 + random.fx() * 15);
  const k = Math.fround(0.38 * n);
  for (let i = 0; i < 360000; i++) {
    const at = i * 4;
    if (i % 800 == 0) {
      [red, green, blue] = [px[at], px[at + 1], px[at + 2]];
    } else {
      red = Math.trunc((px[at] + red * k) / (1 + k));
      green = Math.trunc((px[at + 1] + green * k) / (1 + k));
      blue = Math.trunc((px[at + 2] + blue * k) / (1 + k));
    }
    px[at] = Math.trunc((red * 17 + green + blue + noise) / 21);
    px[at + 1] = Math.trunc((green * 17 + red + blue + noise) / 22);
    px[at + 2] = Math.trunc((blue * 17 + red + green + noise) / 24);
    run--;
    if (run == 0) {
      noise = Math.trunc(random.fx() * 128);
      run = Math.trunc(5 + random.fx() * 15);
    }
  }
};

// Madness and Insano, put onto the race as it stood still
const bake = (pixels, madness, insano) => {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 450;
  const g = canvas.getContext("2d");
  g.putImageData(pixels, 0, 0);
  g.drawImage(madness, 289, 30);
  g.drawImage(insano, 135, 10);
  return g.getImageData(0, 0, 800, 450);
};

// Works the race's picture a step further; returns whether it is done.
const process = () => {
  if (state.pass == 7) {
    return true;
  }
  if (!state.pixels) {
    const frozen = frozenPixels();
    const madness = picture("madness.gif", "keyed");
    const insano = picture("d1.png");
    if (!frozen || !madness || !insano) {
      return false;
    }
    state.pixels = bake(frozen, madness, insano);
  }
  if (state.pass >= 0) {
    fleximage(state.pass);
  }
  state.pass++;
  show();
  return false;
};

// flickering between two colours every frame
const flicker = (a, b) => (state.blink ? a : b);
const YELLOWS = [
  [196, 176, 0],
  [255, 247, 165],
];

const drawUnlockedCar = (name) => {
  centred(200, "And:", flicker(...YELLOWS));
  if (random.fx() > 0.5) {
    screen.g.globalAlpha = 0.5;
    fill(226, 211, 344, 125, [236, 226, 202]);
    screen.g.globalAlpha = 1;
  }
  fill(226, 211, 348, 4, [0, 0, 0]);
  fill(226, 211, 4, 125, [0, 0, 0]);
  fill(226, 332, 348, 4, [0, 0, 0]);
  fill(570, 211, 4, 125, [0, 0, 0]);
  over3D();
  if (random.fx() > 0.5) {
    screen.g.globalAlpha = 0.4;
    for (let i = 0; i < 30; i++) {
      fill(230, 215 + 4 * i, 340, 1, [236, 226, 202]);
    }
    screen.g.globalAlpha = 1;
  }
  centred(320, `${name} has been unlocked!`, flicker(...YELLOWS));
};

const BLUE = [144, 167, 255];

const drawGameFinished = () => {
  font(13);
  centred(180, "Woohoooo you finished NFM !!!", flicker(BLUE, [228, 240, 255]));
  if (state.blink) {
    centred(210, "You're Awesome!", BLUE);
  } else {
    centred(212, "You're Awesome!", [228, 240, 255]);
  }
  centred(240, "You're truly a RADICAL GAMER!", flicker(BLUE, [255, 100, 100]));
  fill(0, 255, 800, 62, [0, 0, 0]);
  draw(
    picture("radicalplay.gif"),
    state.logoX + Math.trunc(8 * random.fx() - 4),
    255,
  );
  if (state.logoX != 212) {
    state.logoX += 40;
    if (state.logoX > 800) {
      state.logoX = -468;
    }
  }
  state.logoTicks = (state.logoTicks + 1) % 70;
  if (state.logoTicks == 40) {
    state.logoX = 213;
  }
  if (state.logoX == 212) {
    font(11);
    centred(309, "A Game by Radicalplay.com", flicker(BLUE, [228, 240, 255]));
  }
  centred(350, "Now get up and dance!", flicker(BLUE, [228, 240, 255]));
};

// The screen for a tick: { won, stage, label ("Stage 3"), name, unlocks (the next stage), finished (the
// last stage was won), car (the name of the car unlocked, or null), practice }. Returns
// { done: the picture is worked, chosen: continue was chosen }.
export const drawClassicRaceEnd = ({
  won,
  stage,
  label,
  name,
  unlocks,
  finished,
  car,
  practice,
}) => {
  const done = process();
  if (!state.image) {
    // the race still shows until its picture is there
    return { done: false, chosen: false };
  }
  startScreen();
  screen.g.drawImage(state.image, 0, 0);
  if (!done) {
    return { done: false, chosen: false };
  }
  font(11);
  const at = ` ${label}!`;
  if (won) {
    draw(picture("congrad.gif"), 265, 87);
    centred(137, `You Won!  At${at}`, [255, 161, 85]);
    centred(154, name, [255, 115, 0]);
  } else {
    draw(picture("gameov.gif"), 315, 117);
    centred(167, `You Lost!  At${at}`, [255, 161, 85]);
    centred(184, name, [255, 115, 0]);
  }
  if (unlocks && finished) {
    drawGameFinished();
  } else if (unlocks) {
    font(13);
    const pin = car ? -20 : 60;
    centred(
      200 + pin,
      `Stage ${stage + 1} is now unlocked!`,
      flicker(...YELLOWS),
    );
    if (car) {
      drawUnlockedCar(car);
    }
    font(11);
    centred(car ? 360 : 280, "GAME SAVED", [230, 167, 0]);
  }
  if (practice) {
    // the original had no practice: its colours of what got unlocked
    font(13);
    centred(260, "Practice game finished", flicker(...YELLOWS));
  }
  state.blink = !state.blink;
  const button = picture("continue.gif", state.pressed ? "pressed" : "plain");
  draw(button, 355, 380);
  let chosen = false;
  if (overImage(button, 355, 380) && mouse.pressed) {
    state.pressed = true;
  }
  if (mouse.released && state.pressed) {
    state.pressed = false;
    chosen = overImage(button, 355, 380);
  }
  if (confirm.state == CONFIRM.pressed) {
    confirm.state = CONFIRM.used;
    chosen = true;
  }
  return { done: true, chosen };
};
