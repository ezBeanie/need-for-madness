// The car select: the cars turn one by one in front of drifting smoke, with their strengths
// around them. Cars of later stages stay locked until those stages are won.

import { LAST_STAGE, ownStage } from "../data/stages.js";
import { t } from "../core/language.js";
import { CAR_TEXTURE } from "../render/generated.js";
import { pauseMenuMusic } from "../audio/audio.js";
import {
  drawClassicCarSelect,
  smokeAgain,
  startClassicCarSelect,
} from "../classic/carSelect.js";
import { random } from "../core/random.js";
import { MODE, PHASE, RACE_KIND, game, raceSetup } from "../core/state.js";
import { saveSetting } from "../core/storage.js";
import { CAR, carStats } from "../data/carStats.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { AFTER_LOAD, STAGE_LOAD, stageLoad } from "../loading/stageLoad.js";
import { racers } from "../race/racers.js";
import { track } from "../race/track.js";
import {
  camera,
  fitFieldOfView,
  seenHeight,
  seenWidth,
  startProjection,
  turnView,
} from "../render/camera.js";
import { interpolation, resetMatrix } from "../render/interpolation.js";
import { classicMenus } from "../render/look.js";
import {
  carModels,
  carShadows,
  menuBackdrop,
  menuSmoke,
} from "../render/scene.js";
import { layShadow } from "../render/shadows.js";
import { images } from "../ui/images.js";
import { rd, view } from "../ui/view.js";
import {
  BUTTON,
  drawButton,
  drawMusicToggle,
  drawSlantedBar,
  fillPolygon,
  pulseButtons,
  strokePolygon,
} from "../ui/widgets.js";
import { menu } from "./menuState.js";
import { SHOWCASE, poseShowcaseCar, showcase } from "./showcase.js";

const FIRST_CAR = 0;
const LAST_CAR = 18;
// the cars from here on are unlocked by winning stages
const FIRST_LOCKED_CAR = 11;
// the stage a new player practises on
const PRACTICE_STAGE = 2;

// where the car flying out goes
const SWITCH = { lastSelected: 0, next: 1, previous: -1 };
let switchingTo = SWITCH.lastSelected;
// the last car that was not locked
let lastSelected = 0;

// A new player is shown the buttons by a pointing hand: Prev, Next, then Practice, which
// it keeps pointing at until pressed.
const HAND_DONE = 167;
let handTicks = 0;

const SMOKE_PUFFS = 9;

// Scatters the smoke behind the car select.
export const scatterMenuSmoke = () => {
  for (let i = 0; i < SMOKE_PUFFS; i++) {
    const puff = {
      x: 0,
      y: 0,
      z: 0,
      sx: 0,
      sy: 0,
      rot: 0,
      rota: 0,
      mat: null,
    };
    menuSmoke[i] = puff;
    puff.rot = 360 * random.fx();
    newSpin(puff);
    puff.x = 60 - 120 * random.fx();
    puff.y = 3 + 52 * random.fx();
    puff.sx = (0.05 + random.fx() * 0.3) * randomSign();
    puff.sy = (0.1 + random.fx() * 0.4) * randomSign();
  }
};

const randomSign = () => (random.fx() > random.fx() ? -1 : 1);

const newSpin = (puff) => {
  puff.rota = (1 + 3 * random.fx()) * randomSign();
};

export function carSelectTick() {
  if (classicMenus()) {
    classicTick();
    return;
  }
  startProjection();
  camera.x = 0;
  camera.y = 0;
  camera.z = 0;
  camera.yaw = 0;
  camera.pitch = PITCH;
  placeBackdrop();
  moveShowcase();
  const type = game.carTypes[0];
  const body = carModels[type];
  body.x = 0;
  body.y =
    carStats.wly[type][1] + 1.5 * carStats.wlh[type][1] + showcase.height;
  body.z = -98;
  body.shownTexture = CAR_TEXTURE.menu;
  showcase.spin += 5;
  if (showcase.spin > 360) {
    showcase.spin -= 360;
  }
  poseShowcaseCar(type);
  layShadow(carShadows[type], body, type);
  carShadows[type].y = -21;
  mat4.rotate(
    camera.matrix,
    camera.matrix,
    camera.pitch * (Math.PI / 180),
    [1, 0, 0],
  );
  drawCarSelect();
  menu.redraw = true;
}

// the modern look's camera looks down this much
const PITCH = -8;

// The backdrop facing the camera and its smoke drifting, also while the classic look
// shows the car select: the look can change before the next tick.
const placeBackdrop = () => {
  menuBackdrop.x = 0;
  menuBackdrop.y = 14;
  menuBackdrop.z = -99;
  menuBackdrop.mat = resetMatrix(menuBackdrop.mat);
  mat4.rotate(
    menuBackdrop.mat,
    menuBackdrop.mat,
    PITCH * (Math.PI / 180),
    [-1, 0, 0],
  );
  // (the photo grown evenly to cover the window, cut off at the sides or above and below)
  const cover = Math.max(seenWidth(), seenHeight());
  mat4.scale(menuBackdrop.mat, menuBackdrop.mat, [cover, cover, cover]);
  menuSmoke.forEach(driftSmoke);
};

// The puffs drift in the backdrop's plane and turn back at its edges, spinning anew.
const driftSmoke = (puff) => {
  puff.mat = resetMatrix(puff.mat);
  puff.x += puff.sx;
  if (puff.sx < 0 && puff.x < -60) {
    puff.sx = 0.05 + random.fx() * 0.3;
    newSpin(puff);
  }
  if (puff.sx > 0 && puff.x > 60) {
    puff.sx = -(0.05 + random.fx() * 0.3);
    newSpin(puff);
  }
  puff.y += puff.sy;
  if (puff.sy < 0 && puff.y < 3) {
    puff.sy = 0.1 + random.fx() * 0.4;
    newSpin(puff);
  }
  if (puff.sy > 0 && puff.y > 55) {
    puff.sy = -(0.1 + random.fx() * 0.4);
    newSpin(puff);
  }
  puff.z = -99;
  for (let k = 0; k < 3; k++) {
    puff.mat[k] = menuBackdrop.mat[k] * 4;
    puff.mat[k + 4] = menuBackdrop.mat[k + 4] * 4;
    puff.mat[k + 8] = menuBackdrop.mat[k + 8] * 4;
  }
  mat4.rotate(puff.mat, puff.mat, puff.rot * (Math.PI / 180), [0, 0, 1]);
  puff.rot += puff.rota;
  if (puff.rot > 360) {
    puff.rot -= 360;
  }
  if (puff.rot < 0) {
    puff.rot += 360;
  }
};

// The car hovers up and down; another one drops in after the last one flew out.
const moveShowcase = () => {
  if (switchesAsked.length) {
    // (the car flying out first makes way for its neighbour, as it would have)
    if (showcase.motion == SHOWCASE.flyingOut) {
      switchCar();
    }
    for (const to of switchesAsked) {
      switchingTo = to;
      switchCar();
    }
    switchesAsked = [];
    dropIn(60);
  }
  if (showcase.motion == SHOWCASE.hovering) {
    hover();
    return;
  }
  if (showcase.motion == SHOWCASE.droppingIn) {
    showcase.pitch = 0;
    showcase.dropSpeed += 0.5;
    showcase.height -= showcase.dropSpeed;
    if (showcase.height < -21) {
      showcase.height = -21;
      showcase.bob = -30;
      showcase.motion = SHOWCASE.hovering;
    }
  }
  if (showcase.motion == SHOWCASE.flyingOut) {
    showcase.height += 14;
    if (switchingTo == SWITCH.next) {
      showcase.pitch += 40;
    }
    if (switchingTo == SWITCH.previous) {
      showcase.pitch -= 40;
    }
    if (showcase.height > 100) {
      switchCar();
      dropIn(100);
    }
  }
};

const dropIn = (from) => {
  showcase.motion = SHOWCASE.droppingIn;
  showcase.dropSpeed = 0;
  showcase.height = from;
};

const hover = () => {
  if (showcase.bob >= 1) {
    if (showcase.bob == 1) {
      showcase.height += 0.7 + (11 - showcase.height) / 31;
      if (showcase.height > 10) {
        showcase.height = 10;
        showcase.bob = 2;
      }
    }
    if (showcase.bob >= 2) {
      showcase.bob++;
      if (showcase.bob == 110) {
        showcase.bob = 0;
      }
    }
  } else {
    if (showcase.bob == 0) {
      showcase.height -= 0.2 + (11 - showcase.height) / 31;
      if (showcase.height < -21) {
        showcase.height = -21;
        showcase.bob = -1;
      }
    }
    if (showcase.bob <= -1) {
      showcase.bob--;
      if (showcase.bob == -50) {
        showcase.bob = 1;
      }
    }
  }
};

const switchCar = () => {
  if (switchingTo == SWITCH.next) {
    game.carTypes[0]++;
    if (game.carTypes[0] == LAST_CAR + 1) {
      game.carTypes[0] = FIRST_CAR;
    }
  }
  if (switchingTo == SWITCH.previous) {
    game.carTypes[0]--;
    if (game.carTypes[0] == FIRST_CAR - 1) {
      game.carTypes[0] = LAST_CAR;
    }
  }
  if (switchingTo == SWITCH.lastSelected) {
    game.carTypes[0] = lastSelected;
  }
};

// Browsing on while a car still flies out or drops in: the next one drops in at once
// (with the next tick, which poses it first), from lower down, so the cars go by as fast
// as they are asked for.
let switchesAsked = [];
// the car browsed to so far: the one shown, after the switches still to come
const carAsked = () => {
  const coming =
    showcase.motion == SHOWCASE.flyingOut
      ? [switchingTo, ...switchesAsked]
      : switchesAsked;
  return coming.reduce((type, to) => type + to, game.carTypes[0]);
};
const flyOut = (to) => {
  if (showcase.motion == SHOWCASE.hovering) {
    switchingTo = to;
    showcase.motion = SHOWCASE.flyingOut;
    return;
  }
  // (no further than the first and the last car)
  const asked = carAsked();
  if (
    (to == SWITCH.next && asked < LAST_CAR) ||
    (to == SWITCH.previous && asked > FIRST_CAR)
  ) {
    switchesAsked.push(to);
  }
};

// The stage that unlocks the car, or 0 when it can be driven.
const unlockingStage = (type) => {
  const stage = (type - 10) * 2;
  return type >= FIRST_LOCKED_CAR && game.unlocked <= stage ? stage : 0;
};

function drawCarSelect() {
  rd.clearRect(0, 0, view.width, view.height);
  let left = (view.width - 1380 * view.scaleY) / 2;
  let right = left + 1380 * view.scaleY;
  if (left < 0) {
    left = 0;
    right = view.width;
  }
  rd.letterSpacing = "1px";
  rd.font = "" + 16 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "left";
  rd.textBaseline = "middle";
  rd.strokeStyle = "#0C0959";
  rd.lineWidth = 10 * view.scale;
  rd.strokeText(t("Select your Car"), left + 20 * view.scale, 25 * view.scaleY);
  rd.fillStyle = "#8665FF";
  rd.fillText(t("Select your Car"), left + 20 * view.scale, 25 * view.scaleY);
  // (the buttons stay while the cars change, PLAY only once the car chosen has landed)
  const type = game.carTypes[0];
  drawName(type);
  browse(type, left, right);
  const locked = unlockingStage(type);
  if (!locked && lastSelected != type) {
    lastSelected = type;
  }
  if (!locked) {
    drawStrengths(type, left, right);
  } else {
    drawUnlockHint(locked);
  }
  if (locked && showcase.motion == SHOWCASE.hovering) {
    drawLockedStand();
  }
  if (!locked && showcase.motion == SHOWCASE.hovering) {
    drawStart(right);
  }
  drawBack(left);
  pulseButtons();
  drawMusicToggle();
}

// Back to the main menu, from where the stage select has its own Back.
const drawBack = (left) => {
  if (
    browseButton({
      id: 9,
      x: left + 110 * view.scale,
      y: 720 * view.scaleY - 90 * view.scale,
      layout: BUTTON.imageThenText,
      text: " Back",
      image: images.buttons[5],
    })
  ) {
    menu.animation = 0;
    menu.continuesToCarSelect = false;
    game.phase = PHASE.mainMenu;
  }
};

const drawName = (type) => {
  rd.letterSpacing = "1px";
  rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  rd.strokeStyle = "#001A78";
  rd.lineWidth = 10 * view.scale;
  rd.strokeText(carStats.names[type], 640 * view.scaleX, 120 * view.scaleY);
  rd.fillStyle = "#C1EEFF";
  rd.fillText(carStats.names[type], 640 * view.scaleX, 120 * view.scaleY);
};

// The hand points at a button in two blinks after its tick `from`.
const handPointsAt = (from) =>
  (handTicks > from && handTicks < from + 10) ||
  (handTicks > from + 20 && handTicks < from + 30);

const drawHand = (x, y) => {
  rd.drawImage(images.instructions[10], x, y, 56 * view.scale, 62 * view.scale);
};

// The arrow keys and the Prev and Next buttons let the car fly out for its neighbour.
const browse = (type, left, right) => {
  const input = racers[0].u;
  if (input.right) {
    if (type != LAST_CAR) {
      flyOut(SWITCH.next);
    }
    input.right = false;
  }
  if (input.left) {
    if (type != FIRST_CAR) {
      flyOut(SWITCH.previous);
    }
    input.left = false;
  }
  const y = 430 * view.scaleY;
  if (type != FIRST_CAR) {
    if (
      browseButton({
        id: 1,
        x: left + 120 * view.scale,
        y,
        layout: BUTTON.imageThenText,
        text: " Prev",
        image: images.buttons[3],
      })
    ) {
      flyOut(SWITCH.previous);
    }
    if (handPointsAt(10)) {
      drawHand(left + 120 * view.scale, y + 30 * view.scale);
    }
  }
  if (type != LAST_CAR) {
    if (
      browseButton({
        id: 2,
        x: right - 120 * view.scale,
        y,
        layout: BUTTON.textThenImage,
        text: "Next ",
        image: images.buttons[2],
      })
    ) {
      flyOut(SWITCH.next);
    }
    if (handPointsAt(50)) {
      drawHand(right - 120 * view.scale, y + 30 * view.scale);
    }
  }
};

const browseButton = ({ id, x, y, layout, text, image }) =>
  drawButton({
    id,
    x,
    y,
    width: 140,
    height: 47,
    faceTop: "#4B00F6",
    faceBottom: "#CB81FF",
    shadowTop: "#0600F6",
    shadowBottom: "#5700F6",
    layout,
    text,
    fontSize: 15,
    textOpacity: 0.9,
    image,
    imageOpacity: 0.9,
    pulsing: false,
  });

// Six bars, three on each side, filled from 0 to 1.
const strengths = (type) => [
  ["Top Speed", Math.max((carStats.swits[type][2] - 22) / 9, 0.2)],
  [
    "Acceleration",
    Math.min(
      (carStats.acelf[type][1] *
        carStats.acelf[type][0] *
        carStats.acelf[type][2] *
        carStats.grip[type]) /
        0.77,
      1,
    ),
  ],
  ["Handling", carStats.dishandle[type]],
  [
    "Stunts",
    Math.min(
      (carStats.airc[type] * 10 * carStats.airs[type] * carStats.bounce[type] +
        28) /
        139,
      1,
    ),
  ],
  ["Strength", Math.min((carStats.moment[type] + 0.5) / 2.6, 1)],
  ["Endurance", carStats.outdam[type]],
];

const drawStrengths = (type, left, right) => {
  rd.letterSpacing = "1px";
  rd.font = "" + 11 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "right";
  rd.textBaseline = "middle";
  strengths(type).forEach(([label, filled], index) => {
    const leftSide = index < 3;
    const row = index % 3;
    const labelX = leftSide
      ? left + 180 * view.scale
      : right - 290 * view.scale;
    const barX = leftSide ? left + 300 * view.scale : right - 170 * view.scale;
    const labelY =
      row == 0 ? 200 * view.scaleY : 200 * view.scaleY + row * 40 * view.scale;
    const barY =
      row == 0
        ? 200 * view.scaleY - 7 * view.scale
        : 200 * view.scaleY - 7 * view.scale + row * 40 * view.scale;
    rd.strokeStyle = "#00284A";
    rd.lineWidth = 6 * view.scale;
    rd.strokeText(t(label), labelX, labelY);
    rd.fillStyle = "#A3D5FF";
    rd.fillText(t(label), labelX, labelY);
    drawSlantedBar({
      x: barX,
      y: barY,
      width: 200,
      height: 20,
      fillFrom: "#FF1301",
      fillTo: "#FFBA01",
      outline: "#29C2F0",
      filled,
    });
  });
};

const drawUnlockHint = (stage) => {
  rd.letterSpacing = "1px";
  rd.font = "" + 17 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  rd.strokeStyle = "#00284A";
  rd.lineWidth = 10 * view.scale;
  const text = t("This car unlocks when  stage {stage}  is completed!", {
    stage,
  });
  rd.strokeText(text, 640 * view.scaleX, 200 * view.scaleY);
  rd.fillStyle = "#A3D5FF";
  rd.fillText(text, 640 * view.scaleX, 200 * view.scaleY);
};

// A locked glass case around the car's place, with a padlock at its front.
const drawLockedStand = () => {
  // x of the case's corner posts, from its middle in units of the screen height
  const post = (offset) =>
    640 * view.scaleX + offset * view.scaleY - 3 * view.scaleY;
  const backY = 560 * view.scaleY + 108 * view.scaleY;
  const frontY = 600 * view.scaleY + 108 * view.scaleY;
  const pane = (xs, ys) => {
    rd.fillStyle = "#21AEFF";
    rd.globalAlpha = 0.5;
    fillPolygon(xs, ys, 4);
    rd.globalAlpha = 1;
    rd.strokeStyle = "#002748";
    rd.lineWidth = 2 * view.scaleY;
    strokePolygon(xs, ys, 4);
  };
  pane(
    [post(-300), post(-300), post(-120), post(-120)],
    [564 * view.scaleY, backY, frontY, 604 * view.scaleY],
  );
  pane(
    [post(120), post(120), post(-120), post(-120)],
    [604 * view.scaleY, frontY, frontY, 604 * view.scaleY],
  );
  pane(
    [post(300), post(300), post(120), post(120)],
    [564 * view.scaleY, backY, frontY, 604 * view.scaleY],
  );
  const postImage = (image, offset, top) => {
    rd.drawImage(image, post(offset), top, 6 * view.scaleY, 111 * view.scaleY);
  };
  postImage(images.loadingBarLeft, -300, 560 * view.scaleY);
  postImage(images.loadingBarLeft, -120, 600 * view.scaleY);
  postImage(images.loadingBarRight, 120, 600 * view.scaleY);
  postImage(images.loadingBarRight, 300, 560 * view.scaleY);
  rd.drawImage(
    images.locked,
    640 * view.scaleX - 29 * view.scaleY,
    619 * view.scaleY,
    58 * view.scaleY,
    72 * view.scaleY,
  );
};

// PLAY leads to the stage select; a new player can only practise.
const drawStart = (right) => {
  if (
    drawButton({
      id: 3,
      x: right - 150 * view.scale,
      y: 720 * view.scaleY - 100 * view.scale,
      width: 200,
      height: 70,
      faceTop: "#0057E6",
      faceBottom: "#65EFFF",
      shadowTop: "#440078",
      shadowBottom: "#2F00A8",
      layout: BUTTON.textThenImage,
      text: "PLAY ",
      fontSize: 25,
      textOpacity: 0.9,
      image: images.buttons[1],
      imageOpacity: 0.9,
      pulsing: true,
    })
  ) {
    openStageSelect();
  }
  if (game.unlocked != 1) {
    if (confirm.state == CONFIRM.pressed) {
      openStageSelect();
    }
    return;
  }
  if (handTicks != HAND_DONE) {
    handTicks++;
    if (handTicks > 130) {
      handTicks = 90;
    }
  }
  const y = 720 * view.scaleY - 90 * view.scale;
  if (
    drawButton({
      id: 5,
      x: 640 * view.scaleX,
      y,
      width: 220,
      height: 60,
      faceTop: "#0057E6",
      faceBottom: "#65EFFF",
      shadowTop: "#440078",
      shadowBottom: "#2F00A8",
      layout: BUTTON.textOnly,
      text: "Practice ",
      fontSize: 22,
      textOpacity: 0.9,
      image: null,
      imageOpacity: 0,
      pulsing: false,
    })
  ) {
    practise();
  }
  if (handPointsAt(100)) {
    drawHand(640 * view.scaleX, y + 25 * view.scale);
  }
  if (confirm.state == CONFIRM.pressed) {
    practise();
  }
};

// The classic look's car select, as the original's: its camera 26.6 above the floor the
// car stands on and 100 before it, looking down 10 degrees with its wider view. A new car
// flies up somersaulting for 10 ticks and the next drops in for 10, 10 above its place.
const classic = { lastTick: -2, flip: 0, to: SWITCH.next, height: 0 };
// where the original's car stands (34 above its 0)
const CLASSIC_STAND = 28.4;

const classicTick = () => {
  if (classic.lastTick != interpolation.tick - 1) {
    startClassicCarSelect();
    classic.flip = 0;
    classic.height = 0;
    showcase.pitch = 0;
  }
  classic.lastTick = interpolation.tick;
  placeBackdrop();
  // back in the modern look the car hovers, from the bottom of its hover
  showcase.motion = SHOWCASE.hovering;
  showcase.height = -21;
  showcase.bob = -30;
  camera.matrix = mat4.create();
  mat4.perspective(
    camera.matrix,
    fitFieldOfView(2 * Math.atan(225 / 400)),
    view.aspect,
    0.1,
    7000,
  );
  camera.x = 0;
  camera.y = 55;
  camera.z = -5;
  camera.yaw = 180;
  camera.pitch = 10;
  turnView();
  if (classic.flip > 10) {
    classic.height += 10;
    showcase.pitch += classic.to == SWITCH.next ? 20 : -20;
  } else if (classic.flip > 0) {
    if (classic.flip == 10) {
      switchingTo = classic.to;
      switchCar();
      classic.height = 110;
      showcase.pitch = 0;
    }
    classic.height -= 10;
  } else {
    classic.height = 0;
    showcase.spin = (showcase.spin + 5) % 360;
  }
  if (classic.flip > 0) {
    classic.flip--;
  }
  const type = game.carTypes[0];
  const body = carModels[type];
  const ground = carStats.wly[type][1] + 1.5 * carStats.wlh[type][1];
  body.x = 0;
  body.y = CLASSIC_STAND + ground + classic.height;
  // (the original shows its biggest car a little farther away)
  body.z = type == CAR.masheen ? 100 : 95;
  body.shownTexture = CAR_TEXTURE.menu;
  body.wzy = (body.wzy ?? 0) - 10;
  if (body.wzy < -30) {
    body.wzy += 30;
  }
  poseShowcaseCar(type);
  const locked = unlockingStage(type);
  if (!locked) {
    lastSelected = type;
  }
  const chosen = drawClassicCarSelect({
    name: carStats.names[type],
    strengths: strengths(type).map(([, filled]) => filled),
    lockedUntil: locked,
    first: type == FIRST_CAR,
    last: type == LAST_CAR,
    shown: classic.flip == 0,
  });
  if ((chosen == "next" || chosen == "back") && classic.flip == 0) {
    classic.to = chosen == "next" ? SWITCH.next : SWITCH.previous;
    classic.flip = 20;
    smokeAgain();
  }
  if (chosen == "continue") {
    if (game.unlocked == 1) {
      practise();
    } else {
      openStageSelect();
    }
  }
  menu.redraw = true;
};

const openStageSelect = () => {
  saveSetting("carsel", game.carTypes[0]);
  // the original's stages and the player's own are all open; of this game's own only those
  // won, and the campaign races no others
  if (
    (ownStage(track.stage) && track.stage > game.unlocked) ||
    (!ownStage(track.stage) && raceSetup.kind == RACE_KIND.campaign)
  ) {
    track.stage = Math.min(game.unlocked, LAST_STAGE);
  }
  // switch mode needs all stages won
  if (game.unlocked != LAST_STAGE && game.mode == MODE.switchCars) {
    track.stage = game.unlocked;
    game.mode = MODE.championship;
  }
  stageLoad.after = AFTER_LOAD.stageSelect;
  stageLoad.progress = STAGE_LOAD.requested;
  game.phase = PHASE.stageLoading;
};

const practise = () => {
  saveSetting("carsel", game.carTypes[0]);
  pauseMenuMusic();
  track.stage = PRACTICE_STAGE;
  stageLoad.after = AFTER_LOAD.race;
  stageLoad.progress = STAGE_LOAD.requested;
  game.phase = PHASE.stageLoading;
  handTicks = HAND_DONE;
};
