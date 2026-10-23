// The race end: the result, what got unlocked (a stage, maybe a car, confetti after the
// last stage), and back to the menus.

import { CAR_TEXTURE } from "../render/generated.js";
import { stopStageMusic } from "../audio/audio.js";
import { CAR_FILES } from "../classic/cars.js";
import { classicGroundOf } from "../classic/frame.js";
import {
  UNLOCKED_CAR_Y,
  drawClassicRaceEnd,
  startClassicRaceEnd,
} from "../classic/raceEnd.js";
import { interfaceResolution } from "../core/platform.js";
import { random } from "../core/random.js";
import { PHASE, game } from "../core/state.js";
import { carStats } from "../data/carStats.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { raceEvents } from "../race/events.js";
import { fixcar } from "../race/physics.js";
import { track } from "../race/track.js";
import { interpolation } from "../render/interpolation.js";
import { LOOK, look } from "../render/look.js";
import {
  carModels,
  colorStageBackdrop,
  stageBackdrop,
} from "../render/scene.js";
import { backdropHue, cssRgb, hslToRgb } from "../ui/color.js";
import { images } from "../ui/images.js";
import { rd, view } from "../ui/view.js";
import { BUTTON, blink, drawButton } from "../ui/widgets.js";
import { menu } from "./menuState.js";
import { poseShowcaseCar, showcase } from "./showcase.js";
import { insano, pickTalkingPicture } from "../ui/insano.js";
import {
  camera,
  faceCamera,
  startProjection,
  turnView,
} from "../render/camera.js";

// menu.animation on this screen: it fades in until FADED_IN; an unlocked car is then
// presented (see unlockedCarTick) while it is UNLOCKED_CAR_SHOWN.
const FADED_IN = 50;
export const UNLOCKED_CAR_SHOWN = 76;

// The tilt of Insano and the slogan (0..1), drawn when the screen opens.
let tilt = 0;
// The car the won stage unlocks, -1 for none.
let unlockedCar = -1;
// Confetti after the last stage: 20 bursts of 29 frames, alternately from the left (-1)
// and the right (1), with a pause between them.
const confetti = { frame: 0, side: -1, pause: 0, bursts: 0 };
let confettiLoaded = false;

const unlocksStage = () =>
  raceEvents.winner && game.unlocked == track.stage && game.carCount != 1;

// Colours the stage backdrop dark in the stage's hue, behind the unlocked car.
const colorBackdropForUnlockedCar = () => {
  const hue = backdropHue();
  colorStageBackdrop(hslToRgb(hue, 0.4, 0.15), hslToRgb(hue, 0.4, 0.1));
};

export const loadConfetti = () => {
  if (!confettiLoaded) {
    for (let i = 0; i < 29; i++) {
      images.confetti[i] = new Image();
      images.confetti[i].src =
        "data/interface" + interfaceResolution + "/conf/" + i + ".png";
    }
    confettiLoaded = true;
  }
};

export const startRaceEnd = () => {
  menu.animation = 0;
  pickTalkingPicture();
  tilt = random.fx();
  unlockedCar = -1;
  raceEvents.screenTicks = 0;
  if (unlocksStage()) {
    // every second stage unlocks the next car
    if (track.stage % 2 == 0) {
      unlockedCar = 10 + track.stage / 2;
    }
    if (track.stage == 17) {
      confetti.bursts = 0;
      confetti.pause = 0;
      confetti.frame = 0;
    }
    if (unlockedCar != -1) {
      tilt = 0.4 * random.fx();
    }
  }
};

const drawInsanoAndSlogan = () => {
  rd.save();
  rd.rotate((-15 + tilt * 25) * (Math.PI / 180));
  rd.drawImage(
    images.insano[insano.picture],
    110 * tilt - 60,
    200 * view.scaleY,
    274 * view.scale,
    341 * view.scale,
  );
  rd.letterSpacing = "1px";
  rd.font = "" + 40 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "left";
  rd.textBaseline = "middle";
  rd.strokeStyle = "#0A3C00";
  rd.lineWidth = 10 * view.scale;
  const sloganX = 110 * tilt - 60 + 274 * view.scale;
  const sloganY = 200 * view.scaleY + 170 * view.scale;
  rd.strokeText("THIS. IS. MADNESS !", sloganX, sloganY);
  rd.fillStyle = "#FEA700";
  rd.fillText("THIS. IS. MADNESS !", sloganX, sloganY);
  rd.restore();
};

const darkenBackground = () => {
  const rgb = hslToRgb(backdropHue(), 0.4, 0.1);
  rd.fillStyle = cssRgb(rgb);
  rd.globalAlpha = Math.min(menu.animation / FADED_IN, 0.9);
  rd.fillRect(0, 0, view.width, view.height);
  rd.globalAlpha = 1;
};

const drawResult = () => {
  const headline = raceEvents.winner ? "Congradulations!" : "Game Over";
  rd.letterSpacing = "1px";
  rd.font = "" + 30 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  rd.strokeStyle = "#783800";
  rd.lineWidth = 10 * view.scale;
  rd.strokeText(headline, 640 * view.scaleX, 100 * view.scaleY);
  const gradient = rd.createLinearGradient(
    640 * view.scaleX,
    70 * view.scaleY,
    640 * view.scaleX,
    130 * view.scaleY,
  );
  gradient.addColorStop(0, "#FF5B01");
  gradient.addColorStop(1, "#FF9601");
  rd.fillStyle = gradient;
  rd.fillText(headline, 640 * view.scaleX, 100 * view.scaleY);
  rd.globalAlpha = 0.7;
  rd.letterSpacing = "1px";
  rd.font = "" + 18 * (view.scaleY + view.scaleX) + "px junk";
  rd.fillStyle = "#FFA627";
  rd.fillText(
    (raceEvents.winner ? "You won at stage " : "You lost at stage ") +
      track.stage +
      "",
    640 * view.scaleX,
    190 * view.scaleY,
  );
  rd.fillStyle = "#FF5B01";
  rd.fillText(track.name, 640 * view.scaleX, 240 * view.scaleY);
  rd.globalAlpha = 1;
};

const drawConfetti = () => {
  if (confetti.bursts >= 20) {
    return;
  }
  if (confetti.pause != 0) {
    confetti.pause--;
    return;
  }
  if (Math.floor(confetti.frame) <= 28) {
    rd.drawImage(
      images.confetti[Math.floor(confetti.frame)],
      confetti.side * 170 * view.scaleX,
      0,
      1280 * view.scaleX,
      720 * view.scaleY,
    );
    confetti.frame += 0.5;
  } else {
    confetti.pause = 30;
    confetti.frame = 0;
    confetti.side = confetti.side == 1 ? -1 : 1;
    confetti.bursts++;
  }
};

const drawUnlocked = () => {
  rd.letterSpacing = "1px";
  rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
  rd.fillStyle = "#94CA00";
  if (blink.on) {
    rd.fillStyle = "#BCFA00";
    blink.on = false;
  } else {
    blink.on = true;
  }
  if (track.stage != 17) {
    const andCar =
      unlockedCar != -1 ? " and " + carStats.names[unlockedCar] + "" : "";
    rd.fillText(
      "Stage " + (track.stage + 1) + "" + andCar + " is now unlocked!",
      640 * view.scaleX,
      340 * view.scaleY,
    );
  } else {
    rd.fillText(
      "Wooohooo you finished the game!",
      640 * view.scaleX,
      340 * view.scaleY,
    );
    rd.fillText(
      "You're Awesome! You're truly a MAD DRIVER!",
      640 * view.scaleX,
      410 * view.scaleY,
    );
    drawConfetti();
  }
};

const drawPracticeFinished = () => {
  rd.letterSpacing = "1px";
  rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
  rd.fillStyle = "#94CA00";
  rd.fillText("Practice game finished", 640 * view.scaleX, 340 * view.scaleY);
};

// Unlocking waits for the player to continue; otherwise the menus follow by themselves.
const continueOrWait = () => {
  if (unlocksStage()) {
    if (confirm.state == CONFIRM.pressed) {
      stopStageMusic();
      leaveRaceEnd();
      confirm.state = CONFIRM.used;
    }
    if (
      drawButton({
        id: 7,
        x: 640 * view.scaleX,
        y: view.height - 60 * view.scale - 40 * view.scaleY,
        width: 250,
        height: 60,
        faceTop: "#FF1301",
        faceBottom: "#FF8A01",
        shadowTop: "#780800",
        shadowBottom: "#784100",
        layout: BUTTON.textThenImage,
        text: "Continue ",
        fontSize: 20,
        textOpacity: 0.8,
        image: images.buttons[1],
        imageOpacity: 0.8,
        pulsing: false,
      })
    ) {
      stopStageMusic();
      leaveRaceEnd();
    }
  } else {
    raceEvents.screenTicks++;
    if (raceEvents.screenTicks == 30) {
      stopStageMusic();
      leaveRaceEnd();
    }
  }
};

// Fades in, repairs the cars, then presents the unlocked car if there is one.
const fadeIn = () => {
  menu.animation++;
  if (menu.animation == FADED_IN) {
    for (let c = 0; c < game.carCount; c++) {
      fixcar(c);
    }
    if (unlockedCar != -1) {
      menu.animation = UNLOCKED_CAR_SHOWN;
      colorBackdropForUnlockedCar();
      menu.redraw = true;
      showcase.height = -20;
      showcase.bob = 0;
      showcase.dropSpeed = 100;
      game.carTypes[0] = unlockedCar;
    }
  }
};

// the tick the classic race end was last shown: when it opens it takes the race's picture
let classicTick = -2;

// The classic race end works the race's picture first, then fades in at once; it waits
// for continue.
const classicRaceEnd = () => {
  if (classicTick != interpolation.tick - 1) {
    startClassicRaceEnd();
  }
  classicTick = interpolation.tick;
  const { done, chosen } = drawClassicRaceEnd({
    won: raceEvents.winner,
    stage: track.stage,
    name: track.name,
    unlocks: unlocksStage(),
    finished: track.stage == 17,
    car:
      menu.animation == UNLOCKED_CAR_SHOWN
        ? carStats.names[game.carTypes[0]]
        : null,
    practice: game.carCount == 1,
  });
  if (done && menu.animation < FADED_IN) {
    menu.animation = FADED_IN - 1;
    fadeIn();
  }
  if (chosen) {
    stopStageMusic();
    leaveRaceEnd();
  }
};

// Every tick of the race end screen.
export const raceEndScreen = () => {
  if (look.current == LOOK.classic) {
    classicRaceEnd();
    return;
  }
  rd.clearRect(0, 0, view.width, view.height);
  if (menu.animation == UNLOCKED_CAR_SHOWN) {
    rd.globalAlpha = 0.1;
  }
  drawInsanoAndSlogan();
  rd.globalAlpha = 1;
  if (menu.animation != UNLOCKED_CAR_SHOWN) {
    darkenBackground();
  }
  if (menu.animation >= FADED_IN) {
    drawResult();
    if (unlocksStage()) {
      drawUnlocked();
    }
    if (game.carCount == 1) {
      drawPracticeFinished();
    }
    continueOrWait();
  } else {
    fadeIn();
  }
};

// Unlocks the next stage (after the last one a random stage comes up) and goes back to
// the main menu.
const leaveRaceEnd = () => {
  if (unlocksStage()) {
    if (track.stage != 17) {
      game.unlocked++;
      track.stage = game.unlocked;
    } else {
      track.stage = Math.floor(3 + random.sim() * 13);
    }
  }
  menu.animation = 0;
  menu.continuesToCarSelect = true;
  game.phase = PHASE.mainMenu;
};

// The unlocked car turns in front of the stage backdrop, rocking its nose up and down.
export function unlockedCarTick() {
  if (menu.animation == UNLOCKED_CAR_SHOWN && look.current == LOOK.classic) {
    classicUnlockedCarTick();
    return;
  }
  if (menu.animation == UNLOCKED_CAR_SHOWN) {
    startProjection();
    camera.x = 0;
    camera.y = 0;
    camera.z = 0;
    camera.yaw = 0;
    camera.pitch = 0;
    const type = game.carTypes[0];
    const body = carModels[type];
    body.x = 0;
    body.y = carStats.wly[type][1] + 1.5 * carStats.wlh[type][1] - 17;
    body.z = -80;
    body.shownTexture = CAR_TEXTURE.menu;
    showcase.spin += 2;
    if (showcase.spin > 360) {
      showcase.spin -= 360;
    }
    // here showcase.height is the pitch, rising while bob is 1, turning every 100 ticks
    showcase.pitch = showcase.height;
    if (showcase.bob) {
      showcase.height++;
      if (showcase.height > 20) {
        showcase.height = 20;
      }
    } else {
      showcase.height--;
      if (showcase.height < -20) {
        showcase.height = -20;
      }
    }
    showcase.dropSpeed--;
    if (showcase.dropSpeed == 0) {
      if (showcase.bob == 0) {
        showcase.bob = 1;
      } else {
        showcase.bob = 0;
      }
      showcase.dropSpeed = 100;
    }
    poseShowcaseCar(type);
    faceCamera(stageBackdrop);
    stageBackdrop.mat[0] *= view.aspect * 0.5625;
    stageBackdrop.mat[1] *= view.aspect * 0.5625;
    stageBackdrop.mat[2] *= view.aspect * 0.5625;
    stageBackdrop.x = 0;
    stageBackdrop.y = 0;
    stageBackdrop.z = -90;
    turnView();
    menu.redraw = true;
  }
}

// The classic look's unlocked car, as the original's: its camera 2.5 up and 100 before the
// car, looking straight ahead with the original's wider view; the car turning.
const classicUnlockedCarTick = () => {
  camera.matrix = mat4.create();
  mat4.perspective(
    camera.matrix,
    2 * Math.atan(225 / 400),
    view.aspect,
    0.1,
    7000,
  );
  camera.x = 0;
  camera.y = 2.5;
  camera.z = -5;
  camera.yaw = 180;
  camera.pitch = 0;
  turnView();
  const type = game.carTypes[0];
  const body = carModels[type];
  // where the original had it, its middle that high (down) and its wheels grat below
  const grat = classicGroundOf(type);
  const y = UNLOCKED_CAR_Y[CAR_FILES[type]] ?? 390 - grat;
  body.x = 0;
  body.y =
    (250 - (y + grat)) / 10 +
    carStats.wly[type][1] +
    1.5 * carStats.wlh[type][1];
  body.z = 100;
  body.shownTexture = CAR_TEXTURE.menu;
  body.wzy = (body.wzy ?? 0) - 10;
  if (body.wzy < -30) {
    body.wzy += 30;
  }
  showcase.spin = (showcase.spin + 5) % 360;
  showcase.pitch = 0;
  poseShowcaseCar(type);
  menu.redraw = true;
};
