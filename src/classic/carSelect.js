// The car select in the classic look, as the original game drew it (its carselect and
// drawSmokeCarsbg): the cars picture, blown through by smoke twice and flashing white as
// the screen opens and the car changes, the car turning over it, its name flickering above,
// its strengths in bars below, and a locked car behind falling bars.
import { random } from "../core/random.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { racers } from "../race/racers.js";
import {
  centred,
  draw,
  drawFrame,
  fill,
  font,
  mouse,
  over3D,
  overImage,
  picture,
  screen,
  startScreen,
  text,
} from "./screen.js";

// the floor the original's car select shadows the car on, our y (its ground, 495 below
// its camera at -525: 4 below where the car stands)
export const CLASSIC_FLOOR = 28;

// the strength bars: label, where its text is, where its bar is
const BARS = [
  ["Top Speed:", 98, 343, 162, 337],
  ["Acceleration:", 88, 358, 162, 352],
  ["Handling:", 110, 373, 162, 367],
  ["Stunts:", 495, 343, 536, 337],
  ["Strength:", 483, 358, 536, 352],
  ["Endurance:", 473, 373, 536, 367],
];

// the bars falling in front of a locked car
const GATE_X = [211, 240, 280, 332, 399, 466, 517, 558, 586];
const GATE_Y = [193, 213, 226, 237, 244, 239, 228, 214, 196];

const state = {
  // the smoke: 0 and 1 its two bursts, 2 the white flash, 6 done (the original's flatrstart)
  smokeStage: 0,
  radius: 0,
  // the smoke's middle, moving up and down to a goal
  middleY: 0,
  middleGoal: 0,
  // how much of the picture shows through the smoke
  through: 1,
  // the cars picture with the smoke blown into it
  flex: null,
  blink: false,
  gateY: 300,
  gateDY: GATE_X.map(() => 0),
  gateRising: GATE_X.map(() => false),
  // a button held down: 1 back, 2 next, 3 continue
  pressed: 0,
};

const carsPicture = () => picture("cars.gif", "tinted", 1);

// carsbginflex: the smoke starts afresh on the clean picture
const startSmoke = () => {
  const cars = carsPicture();
  state.flex = cars ? cars.getContext("2d").getImageData(0, 0, 670, 400) : null;
  state.radius = 0;
  state.middleY = Math.trunc(random.fx() * 160 - 80);
  state.middleGoal = Math.trunc(state.middleY + random.fx() * 160 - 80);
  state.through = 1;
};

export const startClassicCarSelect = () => {
  state.smokeStage = 0;
  state.flex = null;
  state.gateY = 300;
  state.pressed = 0;
};

// The car changes: the smoke blows again.
export const smokeAgain = () => {
  if (state.smokeStage > 1) {
    state.smokeStage = 0;
    startSmoke();
  }
  state.gateY = 300;
  state.pressed = 0;
};

let smoke = null;

// Every smoke pixel is pushed out from the picture's middle by the burst's radius and
// mixed into the cars picture, the more of the picture the darker the smoke.
const blowSmoke = () => {
  smoke ??= picture("smokey.gif", "tinted", 4)
    ?.getContext("2d")
    .getImageData(0, 0, 466, 202).data;
  if (!state.flex) {
    startSmoke();
  }
  if (!smoke || !state.flex) {
    return;
  }
  if (Math.abs(state.middleY - state.middleGoal) > 20) {
    state.middleY += state.middleY > state.middleGoal ? -20 : 20;
  } else {
    state.middleY = state.middleGoal;
    state.middleGoal = Math.trunc(state.middleY + random.fx() * 160 - 80);
  }
  state.middleY = Math.min(160, state.middleY);
  if (state.radius > 170) {
    state.smokeStage++;
    state.radius = state.smokeStage * 3;
    state.middleY = Math.trunc(random.fx() * 160 - 80);
    state.middleGoal = Math.trunc(state.middleY + random.fx() * 160 - 80);
    state.through = 1;
  }
  const px = state.flex.data;
  const [r0, g0, b0] = [smoke[0], smoke[1], smoke[2]];
  const k = state.through;
  for (let i = 0; i < 466; i++) {
    for (let j = 0; j < 202; j++) {
      const s = (i + j * 466) * 4;
      const [sr, sg, sb] = [smoke[s], smoke[s + 1], smoke[s + 2]];
      if (sr == r0 && sg == g0 && sb == b0) {
        continue;
      }
      const d = Math.fround(Math.hypot(i - 233, j - state.middleY));
      const x = i + Math.trunc(((i - 233) / d) * state.radius) + 100;
      const y = j + Math.trunc(((j - state.middleY) / d) * state.radius) + 110;
      if (x >= 670 || x <= 0 || y >= 400 || y <= 0) {
        continue;
      }
      const at = (x + y * 670) * 4;
      const mix = (picture, smoked) => {
        const a = (255 - smoked) / 255;
        return Math.min(
          255,
          Math.max(
            0,
            Math.trunc(
              (picture * (k * a) + smoked * (1 - a)) / (k * a + (1 - a)),
            ),
          ),
        );
      };
      px[at] = mix(px[at], sr);
      px[at + 1] = mix(px[at + 1], sg);
      px[at + 2] = mix(px[at + 2], sb);
    }
  }
  state.through += 2;
  state.radius += 10 + state.smokeStage * 2;
  screen.g.putImageData(state.flex, 65, 25);
};

const drawBackground = () => {
  if (state.smokeStage == 6) {
    draw(carsPicture(), 65, 25);
  } else if (state.smokeStage <= 1) {
    blowSmoke();
  } else {
    fill(65, 25, 670, 400, [255, 255, 255]);
    startSmoke();
    state.smokeStage = 6;
  }
};

// Each bar a wave further up and back down, one after the other, while the car is locked.
const drawGates = () => {
  if (state.gateY == 300) {
    state.gateDY.fill(0);
    state.gateRising.fill(false);
    state.gateRising[0] = true;
  }
  const gate = picture("pgate.gif");
  GATE_X.forEach((x, i) => {
    draw(gate, x, GATE_Y[i] + state.gateDY[i] - state.gateY);
    if (state.smokeStage != 6) {
      return;
    }
    const top = 80 + Math.trunc(100 / (i + 1));
    const step = Math.trunc((top - Math.abs(state.gateDY[i])) / 3);
    if (state.gateRising[i]) {
      state.gateDY[i] -= step;
      if (state.gateDY[i] < -(70 + Math.trunc(100 / (i + 1)))) {
        state.gateRising[i] = false;
        if (i != 8) {
          state.gateRising[i + 1] = true;
        }
      }
    } else {
      state.gateDY[i] = Math.min(0, state.gateDY[i] + step);
    }
  });
  if (state.gateY != 0) {
    state.gateY -= 100;
  }
};

// statb, its unfilled part blacked out, and its frame over it
const drawBar = (x, y, filled) => {
  draw(picture("statb.gif"), x, y);
  fill(
    Math.trunc(x + 156 * filled),
    y,
    Math.trunc(156 * (1 - filled) + 1),
    7,
    [0, 0, 0],
  );
  draw(picture("statbo.gif"), x, y);
};

const BUTTONS = [
  null,
  ["back.gif", 95, 275],
  ["next.gif", 645, 275],
  ["continue.gif", 355, 385],
];

const button = (index) => {
  const [file, x, y] = BUTTONS[index];
  const image = picture(file, state.pressed == index ? "pressed" : "plain");
  draw(image, x, y);
  if (overImage(image, x, y) && mouse.pressed) {
    state.pressed = index;
  }
};

// The screen for a tick. car: { name, strengths (6 from 0 to 1), lockedUntil (the stage
// that unlocks it, 0 when it is not locked), first, last, shown (it has landed) }.
// Returns "back", "next", "continue" or null.
export const drawClassicCarSelect = (car) => {
  startScreen();
  drawFrame();
  drawBackground();
  draw(picture("selectcar.gif"), 321, 37);
  over3D();
  let chosen = null;
  if (car.shown) {
    font(13);
    if (state.blink) {
      centred(95 + (state.smokeStage < 6 ? 2 : 0), car.name, [240, 240, 240]);
    } else {
      centred(95, car.name, [176, 176, 176]);
    }
    state.blink = !state.blink;
    if (!car.first) {
      button(1);
    }
    if (!car.last) {
      button(2);
    }
    if (car.lockedUntil) {
      drawGates();
      if (state.smokeStage == 6) {
        centred(355, "[ Car Locked ]", [210, 210, 210]);
        centred(
          375,
          `This car unlocks when stage ${car.lockedUntil} is completed...`,
          [255, 96, 0],
        );
      }
    } else if (state.smokeStage == 6) {
      font(11);
      BARS.forEach(([label, tx, ty, bx, by], i) => {
        text(label, tx, ty, [181, 120, 40]);
        drawBar(bx, by, car.strengths[i]);
      });
    }
    button(3);
    const input = racers[0].u;
    if (input.left) {
      input.left = false;
      chosen = car.first ? null : "back";
    }
    if (input.right) {
      input.right = false;
      chosen = car.last ? null : "next";
    }
    if (confirm.state == CONFIRM.pressed && !car.lockedUntil) {
      confirm.state = CONFIRM.used;
      chosen = "continue";
    }
  }
  if (mouse.released && state.pressed) {
    const [file, x, y] = BUTTONS[state.pressed];
    const hit = overImage(picture(file), x, y);
    const action = ["", "back", "next", "continue"][state.pressed];
    state.pressed = 0;
    if (hit && car.shown && !(action == "continue" && car.lockedUntil)) {
      chosen = action;
    }
  }
  return chosen;
};
