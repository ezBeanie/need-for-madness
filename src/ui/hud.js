// What is drawn over the race: positions, laps, damage and power, the arrow, messages, the
// buttons, and the overlays of replays, winding back time and switch mode.

import {
  spectating,
  startWatching,
  watchNext,
  watchingOthers,
} from "../race/spectate.js";
import { arrowNameOf, nameOfCar } from "../net/roomCars.js";
import {
  audio,
  playSound,
  stopEngine,
  stopStageMusic,
} from "../audio/audio.js";
import {
  cosDeg as mcos,
  distanceSquaredXZ as pyo,
  distanceXZ as py,
  rotatePoints as rotate,
  sinDeg as msin,
} from "../core/math.js";
import {
  drawClassicCountdown,
  drawClassicHighlight,
  classicInsanoPicture,
  drawClassicInsano,
  drawClassicOutcome,
  drawClassicMeters,
  drawClassicStanding,
} from "../classic/hud.js";
import { isPhone } from "../core/platform.js";
import { menu } from "../screens/menuState.js";
import { random } from "../core/random.js";
import {
  MAX_CARS,
  MODE,
  PHASE,
  finishingWins,
  game,
  raceSetup,
} from "../core/state.js";
import { saveSetting } from "../core/storage.js";
import { tick } from "../core/tick.js";
import { carStats } from "../data/carStats.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { pointer } from "../input/pointer.js";
import { COUNTDOWN } from "../race/countdown.js";
import { raceEvents } from "../race/events.js";
import {
  MISSED,
  STUNT,
  car,
  countMissedCheckpoint,
  racers,
  useUpStuntTurns,
} from "../race/racers.js";
import { HIGHLIGHT, startHighlight, recording } from "../race/recording.js";
import { VIEWER_FROM, nextCamera, openReplay } from "../race/replayViewer.js";
import {
  currentLapTicks,
  formatTime,
  isTimeAttack,
  raceTime,
  timeAttack,
} from "../race/timeAttack.js";
import { track } from "../race/track.js";
import { CAMERA, camera, faceCamera } from "../render/camera.js";
import { LOOK, classicMenus, look } from "../render/look.js";
import { newParticleModel } from "../render/models.js";
import { gl } from "../render/renderer.js";
import { scene, timeTube } from "../render/scene.js";
import { pauseMenu } from "../screens/pauseMenu.js";
import { lockstep } from "../net/lockstep.js";
import { startRaceEnd } from "../screens/raceEnd.js";
import {
  drawFreeCameraPad,
  steerFreeCamera,
  stopSteeringFreeCamera,
} from "./freeCamera.js";
import { images } from "./images.js";
import { drawMinimap } from "./minimap.js";
import { canvas2D, rd, view } from "./view.js";
import {
  AREA,
  BUTTON,
  TEXT,
  blink,
  buttons,
  drawButton,
  drawCenteredText,
  drawMeter,
  fillPolygon,
  pressOn,
  strokePolygon,
  touchArea,
} from "./widgets.js";

// What the HUD shares with the pause menu and the loading.
export const hud = {
  // ticks until a replay starts: 2 when asked for, the screen dims, at 1 it starts
  replayStartsIn: 0,
  // the blinking of the power meter and its hint
  powerBlink: false,
  // ticks the key hints have been shown, 200 and more hides them
  keyHintTicks: 0,
};

// Where a model's position appears on the screen (in pixels), given the camera matrix.
const screenPosition = (camera, model) => {
  const x = model.mat[12];
  const y = model.mat[13];
  const z = model.mat[14];
  const m = camera;
  const w =
    x * m[0 * 4 + 3] + y * m[1 * 4 + 3] + z * m[2 * 4 + 3] + m[3 * 4 + 3];
  const projected = [
    (x * m[0 * 4 + 0] + y * m[1 * 4 + 0] + z * m[2 * 4 + 0] + m[3 * 4 + 0]) / w,
    (x * m[0 * 4 + 1] + y * m[1 * 4 + 1] + z * m[2 * 4 + 1] + m[3 * 4 + 1]) / w,
  ];
  return [
    (projected[0] * 0.5 + 0.5) * view.width,
    (projected[1] * -0.5 + 0.5) * view.height,
  ];
};

// The stage's tint applied to a grey, kept within 0..255.
const tinted = (grey) => {
  const color = [...grey];
  for (let i = 0; i < 3; i++) {
    color[i] += color[i] * scene.tint[i];
    if (color[i] > 255) {
      color[i] = 255;
    }
    if (color[i] < 0) {
      color[i] = 0;
    }
  }
  return color;
};

// Switch mode: a band from every car still racing to the next one, the order the switch
// goes round in. With only the player and one opponent left there is just the player's.
function createSwitchLines() {
  const outer = tinted([200, 200, 200, 192]);
  const inner = tinted([200, 200, 200, 64]);
  for (let c = 0; c < game.carCount; c++) {
    if (racers[c].switchLine == null) {
      racers[c].switchLine = newParticleModel();
    }
    const line = racers[c].switchLine;
    if (line.loaded == 1) {
      gl.deleteBuffer(line.vbuf);
      line.vbuf = null;
      gl.deleteBuffer(line.cbuf);
      line.cbuf = null;
      gl.deleteBuffer(line.ibuf);
      line.ibuf = null;
    }
    line.on = false;
    const lastTwo = track.wasted == game.carCount - 2 && c != game.player;
    if (racers[c].wasted || lastTwo) {
      continue;
    }
    let next = c;
    next++;
    if (next == game.carCount) {
      next = 0;
    }
    while (racers[next].wasted) {
      next++;
      if (next == game.carCount) {
        next = 0;
      }
    }
    const vertices = [
      car[c].x,
      car[c].y - 4,
      car[c].z,
      car[c].x,
      car[c].y + 4,
      car[c].z,
      car[next].x,
      car[next].y - 4,
      car[next].z,
      car[next].x,
      car[next].y + 4,
      car[next].z,
    ];
    line.ni = 6;
    line.vbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, line.vbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    const colors = [];
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 4; k++) {
        colors[i * 4 + k] = (i == 0 || i == 2 ? outer : inner)[k] / 255;
      }
    }
    line.cbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, line.cbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    line.ibuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, line.ibuf);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array([0, 1, 2, 2, 3, 1]),
      gl.STATIC_DRAW,
    );
    line.alpha = true;
    line.mat = mat4.create();
    line.loaded = 1;
    line.on = true;
  }
}

// The camera while switching cars: how far behind the car (it breathes between 60 and
// 180) and how far it swings to the side (between -45 and 45 degrees). Winding back time
// spins the time tube with the swing too, and the key hint blinks with the distance.
let slide = 80;
let slideTo = 0;
let slideShrinking = false;
let swing = 0;
let swingTo = 45;
let swingBack = false;

// Insano's face while a screen over the race opens: from 5 back to 0.
const insanoFace = (ticks) => {
  if (ticks >= 40) {
    return 0;
  }
  if (ticks >= 30) {
    return 1;
  }
  if (ticks >= 25) {
    return 2;
  }
  if (ticks >= 20) {
    return 3;
  }
  if (ticks >= 15) {
    return 4;
  }
  return ticks >= 10 ? 5 : 0;
};

// the modern Insano's size on screen, at the design's scale 1
const INSANO_WIDTH = 274 * 0.7;
const INSANO_HEIGHT = 341 * 0.7;

// Insano's face, faint, beside a message (at x = 490 of the design) or the countdown (640).
// In the classic look he is the original's Insano, as high as the modern one and centred
// where that stands.
const drawInsanoAside = (face, x = 490) => {
  if (classicMenus()) {
    drawClassicInsano(face);
    return;
  }
  const classic = look.current == LOOK.classic;
  const picture = classic ? classicInsanoPicture(face) : images.insano[face];
  if (!picture) {
    return;
  }
  const height = INSANO_HEIGHT * view.scale;
  const width = classic
    ? (picture.width / picture.height) * height
    : INSANO_WIDTH * view.scale;
  rd.globalAlpha = 0.6;
  rd.drawImage(
    picture,
    x * view.scaleX -
      230 * view.scale +
      (INSANO_WIDTH * view.scale - width) / 2,
    10 * view.scaleY,
    width,
    height,
  );
  rd.globalAlpha = 1;
};

// The next car still racing after the player's.
const nextLivingCar = () => {
  let next = game.player;
  next++;
  if (next == game.carCount) {
    next = 0;
  }
  while (racers[next].wasted) {
    next++;
    if (next == game.carCount) {
      next = 0;
    }
  }
  return next;
};

// Behind car c, swung to the side, at the switch camera's distance.
const lookAt = (yaw, x, y, z) => {
  camera.pitch = 10;
  camera.yaw = yaw;
  camera.x = x - slide * msin(yaw);
  camera.z = z + slide * mcos(yaw);
  camera.y = y + 25;
};

// The camera flies from the player's car to the next one (ticks 20 to 100).
const placeSwitchCamera = (ticks) => {
  const from = camera.target;
  const to = camera.nextTarget;
  if (ticks < 20) {
    lookAt(
      racers[from].cameraHeading - 180 + swing,
      car[from].x,
      car[from].y,
      car[from].z,
    );
  }
  if (ticks >= 20 && ticks < 100) {
    const fromShare = 100 - ticks;
    const toShare = ticks - 20;
    const yaw =
      (racers[from].cameraHeading * fromShare +
        racers[to].cameraHeading * toShare) /
        80 -
      180 +
      swing;
    camera.pitch = 10;
    camera.yaw = yaw;
    camera.x =
      (car[from].x * fromShare + car[to].x * toShare) / 80 - slide * msin(yaw);
    camera.z =
      (car[from].z * fromShare + car[to].z * toShare) / 80 + slide * mcos(yaw);
    camera.y = (car[from].y * fromShare + car[to].y * toShare) / 80 + 25;
  }
  if (ticks >= 100) {
    lookAt(
      racers[to].cameraHeading - 180 + swing,
      car[to].x,
      car[to].y,
      car[to].z,
    );
  }
};

const breatheSwitchCamera = (ticks) => {
  if (ticks >= 100) {
    slide += (80 - slide) / 17;
    swing += -swing / 17;
    return;
  }
  if (!slideShrinking) {
    slide += 1;
    if (slide > slideTo) {
      slideTo = 60;
      slideShrinking = true;
    }
  } else {
    slide -= 1;
    if (slide < slideTo) {
      slideTo = 180;
      slideShrinking = false;
    }
  }
  if (!swingBack) {
    swing += 1;
    if (swing > swingTo) {
      swingTo = -45;
      swingBack = true;
    }
  } else {
    swing -= 1;
    if (swing < swingTo) {
      swingTo = 45;
      swingBack = false;
    }
  }
};

// The player takes over the next car: laps start over, the controls carry over, and the
// time until the next switch is longer.
const takeOverNextCar = () => {
  raceEvents.onlastcheck = false;
  for (let i = 0; i < game.carCount; i++) {
    racers[i].clearedPathPoint = track.pcs;
    racers[i].clear = 0;
    racers[i].nlaps = 0;
    racers[i].missedCheckpoint = MISSED.none;
    racers[i].focus = -1;
  }
  const from = racers[game.player].u;
  const to = racers[camera.nextTarget].u;
  to.left = from.left;
  to.right = from.right;
  to.up = from.up;
  to.down = from.down;
  to.handb = from.handb;
  to.arrace = from.arrace;
  raceEvents.checkpointsAnnounced = 0;
  game.player = camera.nextTarget;
  camera.target = game.player;
  track.switchtime += 134;
  switchTimer = track.switchtime;
  game.phase = PHASE.race;
  camera.mode = CAMERA.behind;
};

// Switch mode: "SWITCHING CARS" while the camera flies to the next car, which the player
// drives from then on.
export function drawSwitchScreen() {
  rd.clearRect(0, 0, view.width, view.height);
  const ticks = raceEvents.screenTicks;
  if (ticks == 0) {
    camera.mode = CAMERA.free;
    slide = 80;
    slideTo = 180;
    slideShrinking = false;
    swing = 0;
    if (random.fx() > random.fx()) {
      swingTo = 45;
      swingBack = false;
    } else {
      swingTo = -45;
      swingBack = true;
    }
    camera.nextTarget = nextLivingCar();
    stopEngine();
  }
  placeSwitchCamera(ticks);
  breatheSwitchCamera(ticks);
  if (ticks == 10) {
    playSound(38, 1);
  }
  if (ticks >= 10 && ticks < 90) {
    if (messageBlink) {
      drawCenteredText(132, "SWITCHING CARS", 0, 0, 0, TEXT.title);
      messageBlink = false;
    } else {
      drawCenteredText(132, "SWITCHING CARS", 0, 64, 128, TEXT.title);
      messageBlink = true;
    }
    if (messageBlink) {
      drawCenteredText(192, "Laps Reset, Time +10", 0, 0, 0, TEXT.label);
    } else {
      drawCenteredText(192, "Laps Reset, Time +10", 0, 128, 255, TEXT.label);
    }
    drawInsanoAside(insanoFace(ticks));
  }
  raceEvents.screenTicks++;
  if (raceEvents.screenTicks == 125) {
    takeOverNextCar();
  }
}

// Winding back time: "Reversing Time", a ticking clock, and the time tube spinning around
// the camera, faster the further back it goes.
export function drawRewindOverlay() {
  rd.clearRect(0, 0, view.width, view.height);
  const ticks = raceEvents.screenTicks;
  if (ticks == 5) {
    playSound(41, 1);
  }
  if (ticks >= 10 && ticks < 90) {
    if (messageBlink) {
      drawCenteredText(132, "Reversing Time", 0, 0, 0, TEXT.title);
      messageBlink = false;
    } else {
      drawCenteredText(132, "Reversing Time", 0, 64, 128, TEXT.title);
      messageBlink = true;
    }
    drawInsanoAside(insanoFace(ticks));
  }
  const ticksToGo = Math.abs(recording.frame - (429 - recording.recordedTicks));
  if (ticksToGo > 30) {
    if (ticksToGo > 100) {
      if (ticks % 30 == 0) {
        playSound(42, 1);
      }
    } else if (ticks % 50 == 0) {
      playSound(42, 1);
    }
  }
  raceEvents.screenTicks++;
  faceCamera(timeTube);
  mat4.rotate(timeTube.mat, timeTube.mat, swing * (Math.PI / 180), [0, 0, 1]);
  swing += ticksToGo > 100 ? 20 : 10;
  if (swing > 360) {
    swing -= 360;
  }
  timeTube.x = car[camera.target].x - timeTube.mat[8] * 170;
  timeTube.y = car[camera.target].y - timeTube.mat[9] * 170;
  timeTube.z = car[camera.target].z - timeTube.mat[10] * 170;
}

// The touch controls on phones held in the last frame.
const touchHeld = {
  left: false,
  right: false,
  accelerate: false,
  brake: false,
  handbrake: false,
  arrow: false,
};
// switch mode: ticks left until the next switch (800 a minute)
let switchTimer = 800;
// where the arrow points as last announced: at the cars or along the track
let arrowAtCars = false;
// the angle between the car's heading and the arrow (see arrow)
let arrowAngle = 0;
// ticks the car drove the wrong way, and the ticks "Wrong Way!" has been shown since the
// last checkpoint
let wrongWayTicks = 0;
let wrongWayShown = 0;
let warningBlink = false;
// the number of the countdown (3, 2, 1, 0 for "Go!") and the ticks it stays
let countdownNumber = 0;
let countdownNumberTicks = 0;
// teaches stunts: 1 not yet in the air, 2 has been in the air, 0 has looped; 3 and 4
// take turns showing how to flip the car
let stuntHint = 1;
let powerHintTicks = 0;
// the message in the middle (checkpoint, wasted cars, power up, ...), shown while
// raceEvents.messageTicks < 30; an important one is not replaced by power ups
let message = "";
let messageImportant = false;
let messageBlink = false;
// the praise for the last stunt, shown while raceEvents.stuntTicks < 45
let stuntText = "";
const PRAISE = [
  ["Cool", "Alright", "Nice"],
  ["Wicked", "Amazing", "Super"],
  ["Awesome", "Ripping", "Radical"],
  ["What the...?", "You're a super star!!!!", "Who are you again...?"],
  ["surf style", "off the lip", "bounce back"],
];
const EXCLAMATIONS = ["!", "!!", "!!!"];
let damageBlinkTicks = 0;
let damageBlink = false;
// how the HUD last saw each car wasted (see track.dested), to announce changes
const knownWrecks = [];

export function resetHud() {
  game.player = 0;
  pauseMenu.overRace = false;
  track.switchtime = 800;
  switchTimer = track.switchtime;
  raceEvents.oncheckpoint = -1;
  raceEvents.onlastcheck = false;
  raceEvents.checkpointFlash = 0;
  arrowAtCars = false;
  arrowAngle = 0;
  wrongWayTicks = 0;
  wrongWayShown = 0;
  raceEvents.messageTicks = 30;
  messageImportant = false;
  powerHintTicks = 0;
  raceEvents.stuntTicks = 45;
  raceEvents.countdown = COUNTDOWN.start;
  countdownNumber = 0;
  countdownNumberTicks = 0;
  raceEvents.checkpointsAnnounced = 0;
  for (let i = 0; i < MAX_CARS; i++) {
    knownWrecks[i] = 0;
  }
  raceEvents.raceOverTicks = 0;
  camera.mode = CAMERA.behind;
  camera.target = 0;
  recording.frozen = false;
  raceEvents.playerWreckTicks = 0;
  damageBlinkTicks = 0;
  hud.replayStartsIn = 0;
  buttons.pulseWidth = 2;
  buttons.pulseHeight = 0.5;
  for (let i = 0; i < MAX_CARS; i++) {
    racers[i].u.arrace = false;
    racers[i].u.zyinv = false;
  }
}

const once = () => tick.fraction >= tick.scale;

// Text in the middle that blinks between black and a colour.
const drawBlinking = (y, text, r, g, b) => {
  if (blink.on) {
    drawCenteredText(y, text, 0, 0, 0, TEXT.small);
    blink.on = false;
  } else {
    drawCenteredText(y, text, r, g, b, TEXT.small);
    blink.on = true;
  }
};

// The touch controls of phones: steering, accelerating, braking, the handbrake and the
// arrow. They press the keys of the player's car while a finger is on them.
const TOUCH = [
  { image: 0, x: 130, y: 622, key: "left" },
  { image: 1, x: 320, y: 662, key: "right" },
  { image: 3, x: 1150, y: 622, key: "accelerate" },
  { image: 2, x: 960, y: 662, key: "brake" },
];
const CONTROL_FOR = {
  left: "left",
  right: "right",
  accelerate: "up",
  brake: "down",
  handbrake: "handb",
};

const touchControlsShown = () =>
  isPhone &&
  !watchingOthers() &&
  !(
    raceEvents.countdown > 65 &&
    (raceSetup.newestStage == 2 || raceSetup.newestStage == 4) &&
    track.stage == raceSetup.newestStage
  );

// The arrow button is there in races with opponents, after the first stage.
const arrowButtonShown = () =>
  game.carCount != 1 && (track.stage != 1 || raceSetup.newestStage != 1);

const drawTouchControls = () => {
  for (const { image, x, y, key } of TOUCH) {
    if (touchHeld[key]) {
      rd.globalAlpha = 0.4;
    }
    rd.drawImage(
      images.touchControls[image],
      x * view.scaleX - 64 * view.scale,
      y * view.scaleY - 128 * view.scale,
      128 * view.scale,
      128 * view.scale,
    );
    rd.globalAlpha = 1;
  }
  if (touchHeld.handbrake) {
    rd.globalAlpha = 0.4;
  }
  rd.drawImage(
    images.touchControls[4],
    1260 * view.scaleX - 154 * view.scale,
    440 * view.scaleY - 111 * view.scale,
    154 * view.scale,
    111 * view.scale,
  );
  rd.globalAlpha = 1;
  if (arrowButtonShown()) {
    if (touchHeld.arrow) {
      rd.globalAlpha = 0.4;
    }
    rd.drawImage(
      images.touchControls[5],
      20 * view.scaleX,
      440 * view.scaleY - 111 * view.scale,
      154 * view.scale,
      111 * view.scale,
    );
    rd.globalAlpha = 1;
  }
};

// Each finger presses the control closest to it (within 200 units).
const pressTouchControls = () => {
  const u = racers[game.player].u;
  for (const key of Object.keys(CONTROL_FOR)) {
    if (touchHeld[key]) {
      u[CONTROL_FOR[key]] = false;
      touchHeld[key] = false;
    }
  }
  // As in the original, only the last finger counts: the arrow can be pressed again when
  // a single finger is off it, or when no finger is counted.
  let fingersOffArrow = 0;
  if (pointer.down) {
    let onArrow = false;
    for (let i = 0; i < pointer.count; i++) {
      onArrow = false;
      let closest = -1;
      const xs = [
        130 * view.scaleX,
        320 * view.scaleX,
        1150 * view.scaleX,
        960 * view.scaleX,
        1260 * view.scaleX - 77 * view.scale,
        20 * view.scaleX + 77 * view.scale,
      ];
      const ys = [
        622 * view.scaleY - 64 * view.scale,
        662 * view.scaleY - 64 * view.scale,
        622 * view.scaleY - 64 * view.scale,
        662 * view.scaleY - 64 * view.scale,
        440 * view.scaleY - 55.5 * view.scale,
        440 * view.scaleY - 55.5 * view.scale,
      ];
      let closestDistance = 200 * view.scale;
      const controls = arrowButtonShown() ? 6 : 5;
      for (let k = 0; k < controls; k++) {
        const distance = py(xs[k], pointer.x[i], ys[k], pointer.y[i]);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = k;
        }
      }
      const key = ["left", "right", "accelerate", "brake", "handbrake"][
        closest
      ];
      if (key) {
        u[CONTROL_FOR[key]] = true;
        touchHeld[key] = true;
      }
      if (closest == 5) {
        if (!touchHeld.arrow) {
          u.arrace = !u.arrace;
          touchHeld.arrow = true;
        }
        onArrow = true;
      }
    }
    if (!onArrow) {
      fingersOffArrow++;
    }
  }
  if (fingersOffArrow == pointer.count) {
    touchHeld.arrow = false;
  }
};

// Is the race over? Says so (all cars wasted, the player's car wasted, someone finished)
// and stops the race.
// The race's end in big letters: the original's pictures in the classic look.
const drawOutcome = (text, picture) => {
  if (classicMenus()) {
    drawClassicOutcome(picture);
  } else {
    drawCenteredText(132, text, 0, 0, 0, TEXT.title);
  }
};

const raceOutcome = () => {
  let over = false;
  if (track.wasted == game.carCount - 1 && game.carCount != 1) {
    drawOutcome("You Wasted'em!", "youwastedem");
    drawBlinking(192, "You Won, all cars have been wasted!", 0, 128, 255);
    if (!track.haltall) {
      playSound(33, 1);
    }
    track.haltall = true;
    over = true;
    raceEvents.winner = true;
  }
  // the last car standing wins, the player's wasted before
  if (!over && !finishingWins() && track.haltall) {
    const last = racers
      .slice(0, game.carCount)
      .findIndex((racer) => !racer.wasted);
    if (last != -1 && last != game.player) {
      drawOutcome("You Lost!", "youlost");
      drawBlinking(
        192,
        `${nameOfCar(last)} is the last survivor!`,
        0,
        128,
        255,
      );
      raceEvents.winner = false;
      over = true;
    }
  }
  if (!over) {
    if (racers[game.player].wasted && raceEvents.playerWreckTicks == 16) {
      // (watching the others race on, the wreck's title is gone)
      if (!watchingOthers()) {
        drawOutcome("You're Wasted!", "yourwasted");
      }
      over = true;
      raceEvents.winner = false;
    }
  }
  if (racers[game.player].cntdest != 0 && raceEvents.playerWreckTicks < 16) {
    raceEvents.playerWreckTicks++;
    if (raceEvents.playerWreckTicks == 1) {
      playSound(31, 1);
    }
    if (raceEvents.playerWreckTicks == 16) {
      playSound(30, 1);
    }
  }
  if (!over && finishingWins()) {
    for (let i = 0; i < game.carCount; i++) {
      if (track.clear[i] == track.nlaps * track.nsp && track.pos[i] == 0) {
        if (i == game.player && isTimeAttack()) {
          drawOutcome("Finished!", "youwon");
          drawBlinking(192, finishedIn(), 0, 128, 255);
          raceEvents.winner = true;
          if (!track.haltall) {
            playSound(32, 1);
          }
        } else if (i == game.player) {
          drawOutcome("You Won!", "youwon");
          drawBlinking(192, "You finished first, nice job!", 0, 128, 255);
          raceEvents.winner = true;
          if (!track.haltall) {
            playSound(32, 1);
          }
        } else {
          drawOutcome("You Lost!", "youlost");
          drawBlinking(
            192,
            `${nameOfCar(i)} finished first, race over!`,
            0,
            128,
            255,
          );
          raceEvents.winner = false;
        }
        track.haltall = true;
        over = true;
      }
    }
  }
  return over;
};

// The car watched after the player's was wasted, racing together (see race/spectate.js):
// its name in a small bar at the top, arrows beside it to watch the one before or the
// next, and the camera to switch. The free camera flies (see freeCamera.js).
const WATCH_CAMERAS = {
  [CAMERA.orbit]: "Orbit",
  [CAMERA.behind]: "Behind",
  [CAMERA.trackside]: "Track",
  [CAMERA.free]: "Free",
};

const drawWatchBar = () => {
  const scale = view.scale;
  const height = Math.max(isPhone ? 30 : 26, 30 * scale);
  const top = 82 * view.scaleY;
  const font = Math.round(height * 0.45);
  rd.save();
  rd.font = `${font}px sans-serif`;
  rd.textBaseline = "middle";
  rd.textAlign = "center";
  const name =
    camera.mode == CAMERA.free
      ? "Free camera"
      : `Watching ${nameOfCar(camera.target)}`;
  const parts = [
    { id: 40, text: "‹", act: () => watchNext(-1) },
    { id: 0, text: name },
    { id: 41, text: "›", act: () => watchNext(1) },
    {
      id: 42,
      text: `📷 ${WATCH_CAMERAS[camera.mode] ?? "Camera"}`,
      act: nextCamera,
    },
  ];
  const pad = height * 0.45;
  const widths = parts.map(({ text, id }) =>
    id == 40 || id == 41 ? height : rd.measureText(text).width + pad * 2,
  );
  const gap = 4 * scale;
  const total =
    widths.reduce((sum, w) => sum + w, 0) + gap * (parts.length - 1);
  let left = view.width / 2 - total / 2;
  let chosen = null;
  parts.forEach((part, i) => {
    const width = widths[i];
    const { clicked, pressed } = part.act
      ? pressOn(part.id, left, top, width, height)
      : { clicked: false, pressed: false };
    rd.globalAlpha = part.act ? (pressed ? 0.75 : 0.45) : 0.35;
    rd.fillStyle = "#000000";
    rd.beginPath();
    rd.roundRect(left, top, width, height, height / 2);
    rd.fill();
    rd.globalAlpha = 0.9;
    rd.fillStyle = "#FFFFFF";
    rd.fillText(part.text, left + width / 2, top + height / 2);
    if (clicked) {
      chosen = part.act;
    }
    left += width + gap;
  });
  if (!isPhone) {
    rd.globalAlpha = 0.6;
    rd.font = `${Math.round(font * 0.8)}px sans-serif`;
    rd.fillText(
      camera.mode == CAMERA.free
        ? "W A S D Q E to fly, drag to look · V camera · Esc menu"
        : "Steer for another car · V camera · Esc menu",
      view.width / 2,
      top + height * 1.6,
    );
  }
  rd.restore();
  chosen?.();
  if (camera.mode == CAMERA.free) {
    drawFreeCameraPad(view.height);
    steerFreeCamera(
      view.height,
      (x, y) => y > top + height * 2 || Math.abs(x - view.width / 2) > total,
    );
  } else {
    stopSteeringFreeCamera();
  }
};

// A game that came only to watch the race going on (see net/watch.js): the bar of the car
// watched; once the race is over, a Continue back to the menu.
const drawWatcherHud = () => {
  if (watchingOthers()) {
    if (confirm.state == CONFIRM.pressed) {
      confirm.state = CONFIRM.used;
      pause();
    }
    drawWatchBar();
  } else if (track.haltall) {
    drawCenteredText(120, "Race over", 255, 255, 255, TEXT.heading);
    if (
      drawButton({
        id: 7,
        x: 640 * view.scaleX,
        y: view.height - 60 * view.scale - 40 * view.scaleY,
        width: 250,
        height: 60,
        faceTop: "#019DFF",
        faceBottom: "#01BAFF",
        shadowTop: "#004A78",
        shadowBottom: "#015777",
        layout: BUTTON.textThenImage,
        text: "Continue ",
        fontSize: 20,
        textOpacity: 0.8,
        image: images.buttons[1],
        imageOpacity: 0.8,
        pulsing: false,
      }) ||
      confirm.state == CONFIRM.pressed
    ) {
      confirm.state = CONFIRM.used;
      menu.animation = 0;
      menu.continuesToCarSelect = false;
      game.phase = PHASE.mainMenu;
    }
  }
  drawCornerButtons(false);
};

// After the race: remembers the unlocked stage, waits for "Continue" (or the handbrake)
// and goes on to the highlight replay or the race end.
const afterRaceOver = () => {
  if (raceEvents.raceOverTicks == 0) {
    if (
      raceEvents.winner &&
      raceSetup.newestStage == track.stage &&
      game.carCount != 1 &&
      track.stage != 17
    ) {
      saveSetting("unlocked", game.unlocked + 1);
    }
  }
  raceEvents.raceOverTicks++;
  // watching the race go on, it is left by the menu
  if (watchingOthers()) {
    if (confirm.state == CONFIRM.pressed) {
      confirm.state = CONFIRM.used;
      pause();
    }
    drawWatchBar();
    return;
  }
  let leave = false;
  if (racers[game.player].u.handb && raceEvents.raceOverTicks > 50) {
    leave = true;
    racers[game.player].u.handb = false;
  }
  if (confirm.state == CONFIRM.pressed) {
    leave = true;
    confirm.state = CONFIRM.used;
  }
  const buttonAt = (id, x, text) =>
    drawButton({
      id,
      x,
      y: view.height - 60 * view.scale - 40 * view.scaleY,
      width: 250,
      height: 60,
      faceTop: "#019DFF",
      faceBottom: "#01BAFF",
      shadowTop: "#004A78",
      shadowBottom: "#015777",
      layout: id == 7 ? BUTTON.textThenImage : BUTTON.textOnly,
      text,
      fontSize: 20,
      textOpacity: 0.8,
      image: id == 7 ? images.buttons[1] : null,
      imageOpacity: id == 7 ? 0.8 : 0,
      pulsing: false,
    });
  if (buttonAt(7, 640 * view.scaleX + 145 * view.scale, "Continue ")) {
    leave = true;
  }
  // racing together the race goes on to be watched; else its replay
  const watchRace = spectating();
  if (
    buttonAt(
      8,
      640 * view.scaleX - 145 * view.scale,
      watchRace ? "Watch Race" : "Watch Replay",
    )
  ) {
    if (watchRace) {
      startWatching();
    } else {
      stopEngine();
      openReplay(VIEWER_FROM.raceOver, 0);
      return;
    }
  }
  if (leave) {
    if (recording.highlight) {
      hud.replayStartsIn = 2;
    } else {
      startRaceEnd();
      game.phase = PHASE.raceEnd;
    }
    stopEngine();
  }
  if (hud.replayStartsIn == 1) {
    highlightPlays = 0;
    camera.orbitHeight = Math.floor(90 * random.fx());
    camera.orbitAngle = Math.floor(360 * random.fx());
    startHighlight();
  }
  if (hud.replayStartsIn) {
    rd.globalAlpha = 0.7;
    rd.fillStyle = "#000000";
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
    hud.replayStartsIn--;
  }
};

const pause = () => {
  pauseMenu.selected = 0;
  // (racing together, the race goes on for the others: the menu shows over it)
  if (lockstep.active) {
    pauseMenu.overRace = true;
    return;
  }
  stopStageMusic();
  stopEngine();
  game.phase = PHASE.paused;
};

// Switch mode: the time until the player switches to another car.
// Time attack's clock under the race: the race's time, the lap and the best lap.
const drawClock = () => {
  const { best, laps } = timeAttack;
  const lap = Math.min(laps.length + 1, track.nlaps);
  const bestLap = Math.min(best?.lap ?? Infinity, ...laps);
  drawCenteredText(
    636,
    `Lap ${lap}/${track.nlaps}   ${formatTime(currentLapTicks())}` +
      (Number.isFinite(bestLap) ? `   Best lap ${formatTime(bestLap)}` : ""),
    0,
    0,
    0,
    TEXT.label,
  );
  drawCenteredText(670, formatTime(raceTime()), 0, 0, 0, TEXT.heading);
};

const finishedIn = () => {
  const { best, newBest } = timeAttack;
  const time = `Your time: ${formatTime(raceTime())}`;
  if (newBest.race) {
    return `${time}, a new best!`;
  }
  // (stages made in the editor keep no best times)
  if (!best) {
    return time;
  }
  return (
    `${time}, best ${formatTime(best.race)}` +
    (newBest.lap ? ", but a new best lap!" : "")
  );
};

const drawSwitchTimer = () => {
  switchTimer--;
  const minutes = Math.floor(switchTimer / 800);
  const seconds = Math.floor((switchTimer / 800 - minutes) * 60);
  drawCenteredText(
    670,
    "0" + minutes + ":" + (seconds < 10 ? "0" : "") + "" + seconds,
    0,
    0,
    0,
    TEXT.heading,
  );
  if (
    switchTimer == 120 ||
    switchTimer == 90 ||
    switchTimer == 60 ||
    switchTimer == 30
  ) {
    playSound(39, 1);
  }
  if (switchTimer == 0) {
    playSound(40, 1);
    createSwitchLines();
    raceEvents.screenTicks = 0;
    game.phase = PHASE.switchScreen;
  }
};

// A message in the middle of the race, for a moment.
export const announce = (text) => {
  messageImportant = false;
  message = text;
  raceEvents.messageTicks = -5;
};

const announceArrowTarget = () => {
  arrowAtCars = racers[game.player].u.arrace;
  if (arrowAtCars) {
    messageImportant = true;
    message = " Arrow now pointing at >  CARS";
    raceEvents.messageTicks = -5;
  }
  if (!arrowAtCars) {
    messageImportant = false;
    message = " Arrow now pointing at >  TRACK";
    raceEvents.messageTicks = -5;
    wrongWayTicks = 20;
  }
};

// the ticks of a missed checkpoint's warning that show its message
const MISSED_MESSAGE_FROM = 15;
const MISSED_MESSAGE_UNTIL = 50;

// Under the arrow: a missed checkpoint, or driving the wrong way.
const drawTrackWarnings = () => {
  const player = racers[game.player];
  if (player.missedCheckpoint >= MISSED.started) {
    if (
      player.missedCheckpoint > MISSED_MESSAGE_FROM &&
      player.missedCheckpoint < MISSED_MESSAGE_UNTIL
    ) {
      if (warningBlink) {
        drawCenteredText(112, "Check Point Missed!", 255, 0, 0, TEXT.label);
      } else {
        drawCenteredText(
          112,
          "Check Point Missed!",
          255,
          128,
          0,
          TEXT.faintLabel,
        );
      }
    }
    // (racing together, the race counts it, see updateStandings)
    if (once() && game.humans.length == 0) {
      countMissedCheckpoint(player);
    }
  } else if (player.grounded && wrongWayShown < 70) {
    if (once()) {
      if (Math.abs(arrowAngle) > 100) {
        wrongWayTicks++;
      } else if (wrongWayTicks != 0) {
        wrongWayTicks--;
      }
    }
    if (wrongWayTicks > 40) {
      if (once()) {
        wrongWayShown++;
      }
      wrongWayTicks = 40;
      if (warningBlink) {
        drawCenteredText(112, "Wrong Way!", 255, 128, 0, TEXT.label);
        warningBlink = false;
      } else {
        drawCenteredText(112, "Wrong Way!", 255, 0, 0, TEXT.faintLabel);
        warningBlink = true;
      }
    }
  }
};

// Top left: lap, wasted opponents and the position.
const drawStanding = () => {
  if (classicMenus()) {
    drawClassicStanding(
      racers[game.player].nlaps + 1,
      track.nlaps,
      track.wasted,
      game.carCount - 1,
      track.pos[game.player] + 1,
    );
    return;
  }
  rd.letterSpacing = "1px";
  rd.font = "" + 11 * (view.scaleY + view.scaleX) + "px junk";
  rd.textBaseline = "middle";
  rd.textAlign = "left";
  rd.fillStyle = "#000000";
  rd.fillText("Lap", 20 * view.scale, 19 * view.scale);
  rd.fillText("Wasted", 130 * view.scale, 19 * view.scale);
  // on phones the arrow button is not up here
  const phoneShift = isPhone ? 70 : 0;
  rd.fillText("Position", (60 + phoneShift) * view.scale, 55 * view.scale);
  rd.letterSpacing = "2px";
  rd.fillStyle = "#000078";
  rd.fillText(
    "" + (racers[game.player].nlaps + 1) + "/" + track.nlaps + "",
    68 * view.scale,
    19 * view.scale,
  );
  rd.fillText(
    "" + track.wasted + "/" + (game.carCount - 1) + "",
    217 * view.scale,
    19 * view.scale,
  );
  const position = track.pos[game.player];
  const suffix =
    position == 0 ? "st" : position == 1 ? "nd" : position == 2 ? "rd" : "th";
  rd.letterSpacing = "1px";
  rd.font = "" + 15 * (view.scaleY + view.scaleX) + "px junk";
  const place = "" + (position + 1);
  rd.fillText(place, (157 + phoneShift) * view.scale, 56 * view.scale);
  // the original raced at most seven cars; a tens digit pushes the suffix along
  const tensWidth =
    place.length > 1 ? rd.measureText(place.slice(0, -1)).width : 0;
  rd.font = "" + 11 * (view.scaleY + view.scaleX) + "px junk";
  rd.fillStyle = "#000000";
  rd.fillText(
    suffix,
    (176 + phoneShift) * view.scale + tensWidth,
    55 * view.scale,
  );
};

// The button that switches the arrow between the track and the cars.
const drawArrowButton = () => {
  const colors = arrowAtCars
    ? ["#7DBDFF", "#7872FF", "#1767B9", "#2018C2"]
    : ["#89C800", "#CADC00", "#4B6E00", "#778200"];
  if (
    drawButton({
      id: 1,
      x: 80 * view.scale,
      y: 90 * view.scale,
      width: 100,
      height: 60,
      faceTop: colors[0],
      faceBottom: colors[1],
      shadowTop: colors[2],
      shadowBottom: colors[3],
      layout: BUTTON.textThenImage,
      text: "A",
      fontSize: 22,
      textOpacity: 0.76,
      image: images.buttons[0],
      imageOpacity: 1,
      pulsing: false,
    })
  ) {
    racers[game.player].u.arrace = !arrowAtCars;
  }
};

// Top right: the damage meter (yellow to red, blinking when nearly wasted) and the power
// meter (blinking while stunt praise is shown).
const drawMeters = () => {
  if (classicMenus()) {
    drawClassicMeters(
      racers[game.player].damage / carStats.maxmag[car[game.player].typ],
      racers[game.player].power,
      raceEvents.stuntTicks < 45 && blink.on,
      once(),
    );
    return;
  }
  const metersX =
    view.width / view.height < 1.3
      ? view.width - 200 * view.scale
      : view.width - 290 * view.scale;
  rd.font = "" + 11 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "right";
  rd.fillStyle = "#000000";
  rd.fillText("Damage", metersX - 15 * view.scale, 19 * view.scale);
  rd.fillText("Power", metersX - 15 * view.scale, 55 * view.scale);
  let damage =
    98 * (racers[game.player].damage / carStats.maxmag[car[game.player].typ]);
  if (damage > 98) {
    damage = 98;
  }
  let green = 200;
  if (damage > 33) {
    green = 200 - 189 * ((damage - 33) / 65);
  }
  if (damage > 70) {
    if (damageBlinkTicks < 10) {
      if (damageBlink) {
        green = 170;
        damageBlink = false;
      } else {
        damageBlink = true;
      }
    }
    if (once()) {
      damageBlinkTicks++;
    }
    if (damageBlinkTicks > 167 - damage * 1.5) {
      damageBlinkTicks = 0;
    }
  }
  drawMeter(
    metersX,
    6 * view.scale,
    "#FC4D00",
    "#B20000",
    "rgb(" + 255 + "," + green + "," + 0 + ")",
    damage / 98,
  );
  const power = racers[game.player].power;
  let r = power == 98 ? 64 : 128;
  let g = 190 + power * 0.37;
  let b = 255;
  if (raceEvents.stuntTicks < 45 && blink.on) {
    r = 128;
    g = 244;
    b = 255;
  }
  drawMeter(
    metersX,
    42 * view.scale,
    "#00B0DC",
    "#005C96",
    "rgb(" + r + "," + g + "," + b + ")",
    power / 98,
  );
};

// A sound or music toggle in the top right corner: dimmed while held.
const drawToggle = (id, y, muted, toggle, onImage) => {
  const x = view.width - 77.5 * view.scale;
  const area = touchArea(id, x, y, 58 * view.scale, 42 * view.scale);
  if (area == AREA.held) {
    rd.globalAlpha = 0.5;
  }
  if (area == AREA.clicked) {
    toggle();
  }
  rd.drawImage(
    images.soundToggles[muted() ? onImage + 1 : onImage],
    x,
    y,
    58 * view.scale,
    42 * view.scale,
  );
  rd.globalAlpha = 1;
};

// Top right corner: pause, sound and music.
const drawCornerButtons = (raceOver) => {
  // narrow screens leave the meters room above the buttons
  const shift = view.width / view.height < 1.3 ? 76 * view.scale : 0;
  const pauseX = view.width - 87 * view.scale;
  const pauseArea = touchArea(
    2,
    pauseX,
    10 * view.scale + shift,
    77 * view.scale,
    53 * view.scale,
  );
  if (pauseArea != AREA.clicked) {
    // the pause button, pressed while held
    rd.drawImage(
      images.soundToggles[pauseArea],
      pauseX,
      10 * view.scale + shift,
      77 * view.scale,
      53 * view.scale,
    );
  } else if (!raceOver) {
    pause();
  }
  drawToggle(
    3,
    73 * view.scale + shift,
    () => audio.muteSound,
    () => {
      if (!audio.muteSound) {
        audio.muteSound = true;
        stopEngine();
      } else {
        audio.muteSound = false;
      }
    },
    2,
  );
  drawToggle(
    4,
    125 * view.scale + shift,
    () => audio.muteMusic,
    () => {
      audio.muteMusic = !audio.muteMusic;
    },
    4,
  );
};

// The key hint next to the arrow button, blinking for a while from stage 2 on. It blinks
// with the counter the switch screen slides with, as in the original.
const drawKeyHint = () => {
  if (slide < 10 || hud.keyHintTicks > 100) {
    rd.drawImage(
      images.instructions[9],
      80 * view.scale + 50 * view.scale + 30 * view.scale,
      85 * view.scale,
      72 * view.scale,
      75 * view.scale,
    );
  }
  slide++;
  if (slide > 12) {
    slide = 0;
  }
  hud.keyHintTicks++;
};

// The countdown: Insano pulling faces, the numbers and "Go!".
const drawCountdown = () => {
  const countdown = raceEvents.countdown;
  if ((countdown != 0 || countdownNumberTicks > 4) && countdown < 65) {
    const numbers = { 63: [3, 34], 41: [2, 35], 24: [1, 36], 2: [0, 37] };
    if (numbers[countdown]) {
      countdownNumber = numbers[countdown][0];
      countdownNumberTicks = 16;
      playSound(numbers[countdown][1], 1);
    }
    let face = 0;
    if (countdown <= 63 && countdown > 52) {
      face = 1;
    }
    if (countdown <= 41 && countdown > 32) {
      face = 4;
    }
    if (countdown <= 24 && countdown > 13) {
      face = 2;
    }
    if (countdown <= 2) {
      face = 3;
    }
    if (countdown == 0 && countdownNumberTicks < 7) {
      face = 1;
    }
    drawInsanoAside(face, 640);
  }
  if (countdownNumberTicks != 0 && classicMenus()) {
    drawClassicCountdown(countdownNumber);
    countdownNumberTicks--;
  } else if (countdownNumberTicks != 0) {
    drawCenteredText(
      100,
      countdownNumber != 0 ? "" + countdownNumber : "Go!",
      0,
      0,
      0,
      TEXT.title,
    );
    countdownNumberTicks--;
  }
};

const learnStunts = () => {
  const player = racers[game.player];
  if (stuntHint != 0) {
    if (
      player.stunt == STUNT.flying &&
      (Math.abs(player.rolled) > 110 || Math.abs(player.flipped) > 110)
    ) {
      stuntHint = 0;
    }
    if (stuntHint == 1 && !player.grounded) {
      stuntHint = 2;
    }
  }
};

const drawBlinkingHint = (text) => {
  if (hud.powerBlink) {
    drawCenteredText(176, text, 0, 0, 200, TEXT.small);
    hud.powerBlink = false;
  } else {
    drawCenteredText(176, text, 255, 100, 0, TEXT.small);
    hud.powerBlink = true;
  }
};

// With little power left the HUD asks for stunts, and once in a while shows how.
const drawPowerHint = () => {
  const player = racers[game.player];
  if (player.power >= 40) {
    if (powerHintTicks != 0) {
      powerHintTicks = 0;
    }
    return;
  }
  if (
    raceEvents.messageTicks == 30 &&
    raceEvents.stuntTicks == 45 &&
    player.grounded &&
    player.capcnt == 0
  ) {
    if (stuntHint != 3) {
      if (powerHintTicks < 70 || (powerHintTicks < 100 && stuntHint != 0)) {
        drawBlinkingHint("Power low, perform stunt!");
      }
    } else if (powerHintTicks < 100) {
      drawBlinkingHint("Try to flip your car in the air to preform stunts!");
    }
    if (once()) {
      powerHintTicks++;
    }
    if (powerHintTicks == 300) {
      powerHintTicks = 0;
      if (stuntHint >= 2) {
        stuntHint++;
        if (stuntHint == 5) {
          stuntHint = 3;
        }
      }
    }
  }
};

// The message, the stunt praise or "Bad Landing!".
const drawMessages = () => {
  if (racers[game.player].capcnt != 0) {
    if (messageBlink) {
      drawCenteredText(176, "Bad Landing!", 0, 0, 200, TEXT.label);
      messageBlink = false;
    } else {
      drawCenteredText(176, "Bad Landing!", 255, 100, 0, TEXT.label);
      messageBlink = true;
    }
    return;
  }
  if (raceEvents.messageTicks < 30) {
    if (messageBlink) {
      drawCenteredText(167, message, 0, 0, 0, TEXT.label);
      messageBlink = false;
    } else {
      if (!messageImportant) {
        drawCenteredText(167, message, 0, 128, 255, TEXT.label);
      } else {
        drawCenteredText(167, message, 255, 128, 0, TEXT.label);
      }
      messageBlink = true;
    }
    if (once()) {
      raceEvents.messageTicks++;
    }
  } else if (messageImportant) {
    messageImportant = false;
  }
  if (raceEvents.stuntTicks < 45) {
    if (blink.on) {
      drawCenteredText(136, stuntText, 59, 156, 255, TEXT.small);
      blink.on = false;
    } else {
      drawCenteredText(136, stuntText, 0, 107, 216, TEXT.small);
      blink.on = true;
    }
    if (once()) {
      raceEvents.stuntTicks++;
    }
  }
};

const LOOPS = {
  1: "Forward loop",
  2: "double Forward",
  3: "triple Forward",
  "-1": "Backloop",
  "-2": "double Back",
  "-3": "triple Back",
};
const SPINS = { 1: "Rollspin", 2: "double Rollspin", 3: "triple Rollspin" };

// The name of the stunt that just landed: loops (flipped), roll spins (rolled) and turns
// (spun) the car made in the air, e.g. "double Forward with Rollspin by 360". Uses up the
// car's counted turns. Each part makes the praise shorter (raceEvents.stuntTicks).
const nameStunt = (player) => {
  let loopName = "";
  let spinName = "";
  let text = "";
  const { loops, rolls, degrees, beyond } = useUpStuntTurns(player);
  loopName = LOOPS[loops] ?? "";
  if (loops >= 4) {
    loopName = "massive Forward looping";
  }
  if (loops <= -4) {
    loopName = "massive Back looping";
  }
  if (loops == 0) {
    if (player.flippedFarForward && player.flippedFarBack) {
      loopName = "Tabletop and reversed Tabletop";
    } else if (player.flippedFarForward || player.flippedFarBack) {
      loopName = "Tabletop";
    }
  }
  if (
    (loops > 0 && player.flippedFarBack) ||
    (loops < 0 && player.flippedFarForward)
  ) {
    loopName = "Hanged " + loopName;
  }
  if (loopName != "") {
    text += " " + loopName;
  }
  if (rolls == 0 && player.rolledFar) {
    spinName = loopName == "" ? "Tabletop" : "Flipside";
  }
  spinName = SPINS[rolls] ?? spinName;
  if (rolls >= 4) {
    spinName = "massive Roll spinning";
  }
  if (degrees != 0) {
    if (loopName == "" && spinName == "") {
      text += " " + degrees;
    } else {
      if (spinName != "") {
        text += (loopName == "" ? " " : " with ") + spinName;
      }
      text += " by " + degrees;
    }
    if (beyond) {
      text += " and beyond";
    }
  } else if (spinName != "") {
    text += (loopName == "" ? " " : " by ") + spinName;
  }
  if (text != "") {
    raceEvents.stuntTicks -= 15;
  }
  if (loopName != "") {
    raceEvents.stuntTicks -= 25;
  }
  if (spinName != "") {
    raceEvents.stuntTicks -= 25;
  }
  if (degrees != 0) {
    raceEvents.stuntTicks -= 25;
  }
  return text;
};

// Praises a landed stunt, more for the more power it gave, and tells the power up.
const praiseStunt = () => {
  const player = racers[game.player];
  // (racing together, the race uses the turns up, see useUpStuntTurns)
  stuntText = nameStunt(game.humans.length == 0 ? player : { ...player });
  if (raceEvents.stuntTicks >= 45) {
    return;
  }
  playSound(27, 1);
  if (raceEvents.onautocorrect) {
    raceEvents.onautocorrect--;
  }
  if (raceEvents.stuntTicks < -20) {
    raceEvents.stuntTicks = -20;
  }
  let level = 0;
  if (player.stuntPower > 20) {
    level = 1;
  }
  if (player.stuntPower > 40) {
    level = 2;
  }
  if (player.stuntPower > 150) {
    level = 3;
  }
  if (player.surfed) {
    stuntText = " " + PRAISE[4][Math.floor(random.fx() * 2.99)] + stuntText;
  }
  if (level != 3) {
    stuntText =
      PRAISE[level][Math.floor(random.fx() * 2.99)] +
      stuntText +
      EXCLAMATIONS[level];
  } else {
    stuntText = PRAISE[level][Math.floor(random.fx() * 2.99)];
  }
  if (!messageImportant) {
    raceEvents.messageTicks = raceEvents.stuntTicks;
    message =
      player.power != 98
        ? "POWER UP " + Math.floor((100 * player.stuntPower) / 98) + "%"
        : "POWER TO THE MAX";
  }
};

// Messages about the fixed car, wasted opponents and passed checkpoints.
const announceEvents = () => {
  const player = racers[game.player];
  if (car[game.player].fcnt == 2) {
    if (!messageImportant) {
      message = "Car Fixed";
      raceEvents.messageTicks = 0;
    }
  }
  if (game.carCount != 1) {
    for (let i = 0; i < game.carCount; i++) {
      if (knownWrecks[i] != track.dested[i] && i != game.player) {
        knownWrecks[i] = track.dested[i];
        // (with a guest, a car hit last by the other human was not wasted by this one)
        const byYou = knownWrecks[i] == 2 && racers[i].lastHitBy == game.player;
        if (knownWrecks[i] == 1 || (knownWrecks[i] == 2 && !byYou)) {
          messageImportant = true;
          message = "" + carStats.names[game.carTypes[i]] + " has been wasted!";
          raceEvents.messageTicks = -15;
        }
        if (byYou) {
          messageImportant = true;
          message = "You wasted " + carStats.names[game.carTypes[i]] + "!";
          raceEvents.messageTicks = -15;
        }
      }
    }
  }
  if (raceEvents.checkpointsAnnounced != player.clear && player.clear != 0) {
    if (!messageImportant) {
      message = classicMenus() ? "Checkpoint!" : "Check Point";
      raceEvents.messageTicks = 15;
    }
    raceEvents.checkpointsAnnounced = player.clear;
    playSound(28, 1);
    wrongWayShown = 0;
    if (wrongWayTicks != 0) {
      wrongWayTicks = 0;
    }
  }
};

// Everything drawn over the race, every tick.
export function drawHud() {
  rd.clearRect(0, 0, view.width, view.height);
  if (lockstep.watching) {
    drawWatcherHud();
    return;
  }
  // (the arrow names it again whenever it is drawn)
  camera.aimedCar = -1;
  if (touchControlsShown()) {
    drawTouchControls();
    pressTouchControls();
  }
  const raceOver = raceOutcome();
  if (raceOver) {
    afterRaceOver();
  } else {
    if (raceEvents.raceOverTicks != 0) {
      raceEvents.raceOverTicks = 0;
    }
    if (confirm.state == CONFIRM.pressed && raceEvents.countdown <= 65) {
      confirm.state = CONFIRM.used;
      pause();
    }
  }
  if (raceEvents.countdown <= 65) {
    if (
      game.mode == MODE.switchCars &&
      raceEvents.countdown == 0 &&
      !raceOver
    ) {
      drawSwitchTimer();
    }
    if (isTimeAttack() && raceEvents.countdown == 0) {
      drawClock();
    }
    if (
      game.carCount != 1 &&
      arrowAtCars != racers[game.player].u.arrace &&
      track.stage != 16
    ) {
      announceArrowTarget();
    }
    if (
      !raceOver &&
      raceEvents.countdown == 0 &&
      camera.mode == CAMERA.behind &&
      track.stage != 16
    ) {
      arrow(
        racers[game.player].point,
        racers[game.player].missedCheckpoint,
        arrowAtCars,
      );
      if (
        !arrowAtCars &&
        raceEvents.stuntTicks == 45 &&
        racers[game.player].capcnt == 0
      ) {
        drawTrackWarnings();
      }
    }
    drawStanding();
    drawMinimap();
    if (!isPhone && arrowButtonShown()) {
      drawArrowButton();
    }
    drawMeters();
    // (watching the race go on, the menu leaves it)
    drawCornerButtons(raceOver && !watchingOthers());
    if (
      !isPhone &&
      track.stage >= 2 &&
      hud.keyHintTicks < 200 &&
      game.carCount != 1
    ) {
      drawKeyHint();
    }
  }
  if (!raceOver) {
    drawCountdown();
    learnStunts();
    drawPowerHint();
    drawMessages();
    if (racers[game.player].countingStunt == 10 && once()) {
      praiseStunt();
    }
    announceEvents();
  }
}

// the HUD as the race was drawn last before it began to wait
let waitingHud = null;

// The HUD of a race as drawn last, from its first tick of waiting on: what waiting draws
// goes on it, not on itself again (the soft edges of buttons and texts drawn over
// themselves would thicken tick by tick).
const standAsDrawnLast = (first) => {
  waitingHud ??= document.createElement("canvas");
  const sized =
    waitingHud.width == canvas2D.width && waitingHud.height == canvas2D.height;
  rd.save();
  rd.setTransform(1, 0, 0, 1, 0, 0);
  if (first || !sized) {
    waitingHud.width = canvas2D.width;
    waitingHud.height = canvas2D.height;
    waitingHud.getContext("2d").drawImage(canvas2D, 0, 0);
  } else {
    rd.clearRect(0, 0, canvas2D.width, canvas2D.height);
    rd.drawImage(waitingHud, 0, 0);
  }
  rd.restore();
};

// A race waiting for another game's keys (see net/lockstep.js) stands as it was drawn
// last (first: from this tick on), and its menu opened, to leave it.
export const drawWaitingHud = (first) => {
  standAsDrawnLast(first);
  if (confirm.state == CONFIRM.pressed && raceEvents.countdown <= 65) {
    confirm.state = CONFIRM.used;
    pause();
  }
  if (raceEvents.countdown <= 65) {
    drawCornerButtons(false);
  }
};

// Racing together: what the HUD tells about the other games, a line each, and how long a
// message takes to the host and back (the first thing to know when the race waits).
export const drawNetNotice = (notices, ping) => {
  notices
    .filter(Boolean)
    .forEach((notice, i) =>
      drawCenteredText(192 + 40 * i, notice, 0, 0, 0, TEXT.label),
    );
  if (ping != null) {
    drawCenteredText(706, `Ping ${ping} ms`, 0, 0, 0, TEXT.small);
  }
};

const darken = (alpha) => {
  rd.globalAlpha = alpha;
  rd.fillStyle = "#000000";
  rd.fillRect(0, 0, view.width, view.height);
  rd.globalAlpha = 1;
};

const flash = () => {
  rd.globalAlpha = 0.5;
  rd.fillStyle = "#FFFFFF";
  rd.fillRect(0, 0, view.width, view.height);
  rd.globalAlpha = 1;
};

// The bottom right button of the replays.
const replayButton = (text, faceBottom, shadowBottom) =>
  drawButton({
    id: 1,
    x: view.width - 100 * view.scale - 30 * view.scaleX,
    y: view.height - 60 * view.scale - 30 * view.scaleY,
    width: 170,
    height: 60,
    faceTop: "#019DFF",
    faceBottom,
    shadowTop: "#004A78",
    shadowBottom,
    layout: BUTTON.textThenImage,
    text,
    fontSize: 20,
    textOpacity: 0.7,
    image: images.buttons[1],
    imageOpacity: 0.7,
    pulsing: false,
  });

// How often the highlight has played; after the second time the race end follows.
let highlightPlays = 0;
// the last tick flashed (a stunt highlight flashes at random, never twice in a row)
let flashed = false;

// The replay goes on unless it holds still (onpausefr), and starts over at its end.
const playOrHold = (playing) => {
  recording.frozen = false;
  if (playing) {
    recording.frame++;
    if (recording.frame == 430) {
      recording.frame = 0;
      recording.held = 0;
      startHighlight();
      highlightPlays++;
    }
  } else {
    recording.frozen = true;
  }
};

// Stunts and wasted cars: the camera circles the car and the replay holds still at the
// peak, flashing.
const holdAtPeak = (flashes) => {
  flashes();
  if (
    recording.frame > recording.highlightAt &&
    recording.held != recording.holdTicks
  ) {
    recording.held++;
  }
  camera.mode = CAMERA.orbit;
  camera.target = recording.highlightCar;
  playOrHold(recording.held == 0 || recording.held == recording.holdTicks);
};

const STUNT_FLASHES = [4, 7, 44, 47, 94, 97];
const WASTED_FLASHES = [4, 44, 94];

const stuntFlashes = () => {
  if (recording.holdTicks == 98 && STUNT_FLASHES.includes(recording.held)) {
    flash();
  }
  if (recording.holdTicks == 43) {
    if (recording.held >= 1 && recording.held < 43) {
      if (recording.held % Math.floor(2 + random.fx() * 3) == 0 && !flashed) {
        flash();
        flashed = true;
      } else {
        flashed = false;
      }
    }
  }
};

const wastedFlashes = () => {
  if (recording.holdTicks == 95 && WASTED_FLASHES.includes(recording.held)) {
    flash();
  }
};

// The camera tours the cars while the replay holds still: every 30 ticks it rests on a
// car (rests), in between it flies from one car to another (flights). The replay holds
// still from the given replayed ticks on until the next rest.
const tourCars = ({ rests, flights, holdFrom }) => {
  const stop = Math.floor(recording.held / 30);
  const between = recording.held % 30;
  if (between == 0) {
    camera.mode = CAMERA.orbit;
    camera.target = rests[stop];
  } else {
    camera.mode = CAMERA.flyTo;
    camera.target = flights[stop][0];
    camera.nextTarget = flights[stop][1];
    camera.transition = between;
  }
  holdFrom.forEach((frame, i) => {
    if (recording.frame > frame && recording.held < (i + 1) * 30) {
      recording.held++;
    }
  });
  playOrHold(recording.held % 30 == 0);
};

// What the highlight shows, under its title: in the classic look as the original's
// (flickering while it starts).
const caption = (text) => {
  if (classicMenus()) {
    drawClassicHighlight(text, recording.frame < 50);
  } else {
    drawCenteredText(90, text, 0, 32, 64, TEXT.label);
  }
};

const showHighlight = () => {
  const car = recording.highlightCar;
  const other = recording.otherCar;
  switch (recording.highlight) {
    case HIGHLIGHT.stunt:
      caption(track.stage > 2 ? "Stunts!" : "Best Stunt!");
      holdAtPeak(stuntFlashes);
      break;
    case HIGHLIGHT.wasted:
      caption("Wasted!");
      holdAtPeak(wastedFlashes);
      break;
    case HIGHLIGHT.wastedThemAll:
      caption("You Wasted'em!");
      if (recording.held == 13 || recording.held == 16) {
        flash();
      }
      tourCars({
        rests: [car, other],
        flights: [[car, other]],
        holdFrom: [recording.highlightAt],
      });
      break;
    case HIGHLIGHT.closeWin:
      caption("Close Finish!");
      tourCars({
        rests: [car, other, car, other],
        flights: [
          [car, other],
          [other, 0],
          [car, other],
        ],
        holdFrom: [228, 328, 400],
      });
      break;
    case HIGHLIGHT.closeLoss:
      caption("Close Finish!  Almost got it!");
      tourCars({
        rests: [car, other, car, other, car],
        flights: [
          [car, other],
          [other, 0],
          [car, other],
          [other, 0],
        ],
        holdFrom: [128, 228, 328, 400],
      });
      break;
  }
};

const toRaceEnd = () => {
  startRaceEnd();
  game.phase = PHASE.raceEnd;
};

// The highlight replay after a race: it plays twice, or is skipped, then the race end
// follows. On the very first stage a tap skips it.
export function drawHighlightOverlay() {
  rd.clearRect(0, 0, view.width, view.height);
  // the original's title is a picture, and it goes on with Enter or a click
  if (classicMenus()) {
    showHighlight();
    if (
      (highlightPlays == 2 && recording.frame == 427) ||
      confirm.state == CONFIRM.pressed ||
      pointer.down
    ) {
      confirm.state = CONFIRM.used;
      pointer.down = false;
      toRaceEnd();
    }
    if (recording.frame >= 428) {
      darken(0.7);
    }
    return;
  }
  rd.letterSpacing = "1px";
  rd.font = "" + 24 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  const gradient = rd.createLinearGradient(
    640 * view.scaleX,
    40 * view.scaleY - 10 * view.scale,
    640 * view.scaleX,
    40 * view.scaleY + 10 * view.scale,
  );
  gradient.addColorStop(0, "#006ED4");
  gradient.addColorStop(1, "#A3E6FF");
  rd.fillStyle = gradient;
  rd.fillText("Game Highlight", 640 * view.scaleX, 40 * view.scaleY);
  rd.strokeStyle = "#003E78";
  rd.lineWidth = 1.5 * view.scale;
  rd.strokeText("Game Highlight", 640 * view.scaleX, 40 * view.scaleY);
  showHighlight();
  if (highlightPlays == 2 && recording.frame == 427) {
    toRaceEnd();
  }
  if (confirm.state == CONFIRM.pressed) {
    confirm.state = CONFIRM.used;
    toRaceEnd();
  }
  if (
    replayButton("Skip ", "#01BAFF", "#015777") ||
    (pointer.down && track.stage == 1 && game.unlocked == 1)
  ) {
    toRaceEnd();
  }
  if (recording.frame >= 428) {
    darken(0.7);
  }
}
// The arrow lies on a plane before the screen: its seven corners (x, z) around the
// centre (ARROW_CENTER_X, ARROW_CENTER_Z), at the height ARROW_Y, seen in perspective.
const ARROW_CENTER_X = 0;
const ARROW_CENTER_Z = 700;
const ARROW_Y = -315;
const ARROW_X = [0, -35, -10, -15, 15, 10, 35];
const ARROW_Z = [810, 750, 750, 650, 650, 750, 750];

// The perspective of the arrow's plane.
const projectX = (x, z) => ((z - 400) * -x) / z + x;
const projectY = (y, z) => ((z - 400) * -y) / z + y;

// The heading (degrees) from the player's car to (x, z).
const headingTo = (x, z) => {
  const half = x - car[game.player].x > 0 ? 0 : 180;
  return -(
    90 +
    half +
    Math.atan((z - car[game.player].z) / (x - car[game.player].x)) /
      0.017453292519943295
  );
};

// Which opponents are in front of the player's car and on the screen (horizontally).
const onScreen = [];
const markCarsOnScreen = () => {
  const player = car[game.player];
  const forward = [player.mat[8], player.mat[9], player.mat[10]];
  const along = [
    (c) => car[c].x - player.x,
    (c) => car[c].y - player.y,
    (c) => car[c].z - player.z,
  ];
  for (let i = 0; i < game.carCount; i++) {
    onScreen[i] = false;
    if (i == game.player) {
      continue;
    }
    // ahead along the axis the car points along most
    let inFront = false;
    for (let axis = 0; axis < 3; axis++) {
      const others = [0, 1, 2].filter((a) => a != axis);
      if (others.every((a) => Math.abs(forward[axis]) > Math.abs(forward[a]))) {
        inFront = forward[axis] > 0 ? along[axis](i) > 0 : along[axis](i) < 0;
      }
    }
    if (inFront) {
      const position = screenPosition(camera.matrix, car[i]);
      if (
        position[0] > -(15 * view.scaleX) &&
        position[0] < view.width + 15 * view.scaleX
      ) {
        onScreen[i] = true;
      }
    }
  }
};

// The closest opponent still racing, preferring those on the screen; its name goes on
// top of the screen.
const closestOpponent = () => {
  markCarsOnScreen();
  let target = 0;
  let closest = -1;
  let foundOnScreen = false;
  for (let i = 0; i < game.carCount; i++) {
    if (i == game.player) {
      continue;
    }
    const distance = pyo(
      car[game.player].x / 10,
      car[i].x / 10,
      car[game.player].z / 10,
      car[i].z / 10,
    );
    if (
      (distance < closest || closest == -1) &&
      (!foundOnScreen || onScreen[i]) &&
      track.dested[i] == 0
    ) {
      target = i;
      closest = distance;
      if (onScreen[i]) {
        foundOnScreen = true;
      }
    }
  }
  return target;
};

const drawTargetName = (target) => {
  const name = arrowNameOf(target);
  drawCenteredText(
    16,
    "[" + "  ".repeat(name.length) + "]",
    76,
    67,
    240,
    TEXT.label,
  );
  drawCenteredText(18, name, 0, 0, 0, TEXT.label);
};

// Turns the drawn arrow towards the heading: in steps of 10 degrees, or 15 the other way
// round when that is shorter.
const turnArrowTowards = (heading) => {
  if (Math.abs(arrowAngle - heading) < 180) {
    if (Math.abs(arrowAngle - heading) < 10) {
      arrowAngle = heading;
    } else if (arrowAngle < heading) {
      arrowAngle += 10;
    } else {
      arrowAngle -= 10;
    }
    return;
  }
  if (heading < 0) {
    arrowAngle += 15;
    if (arrowAngle > 180) {
      arrowAngle -= 360;
    }
  }
  if (heading > 0) {
    arrowAngle -= 15;
    if (arrowAngle < -180) {
      arrowAngle += 360;
    }
  }
};

// the outline is one of the original's pixels in the classic look
const arrowOutline = () =>
  classicMenus() ? view.height / 450 : 2.6 * view.scale;

const projectArrow = (xs, ys, zs) => {
  for (let i = 0; i < 7; i++) {
    xs[i] = projectX(xs[i], zs[i]) * 1.6 * view.scale;
    ys[i] = projectY(ys[i], zs[i]) * 1.6 * view.scale;
    xs[i] += 640 * view.scaleX;
    ys[i] += (360 + view.widescreenShift) * view.scaleY;
  }
};

// Along the track the arrow fades out when it points straight ahead, turns red when it
// points backwards, and blinks after a missed checkpoint.
const drawTrackArrow = (xs, ys, missed) => {
  const angle = Math.abs(arrowAngle);
  const fades = angle <= 45 && missed != MISSED.warned && wrongWayTicks == 0;
  let r = 190;
  let g = 255;
  const b = 0;
  if (missed < MISSED.started) {
    if (fades) {
      rd.globalAlpha = angle / 45;
    }
    if (angle >= 90) {
      r = (r * (140 - angle) + 255 * (angle - 90)) / 50;
      if (r > 255) {
        r = 255;
      }
    }
  } else if (warningBlink) {
    r = 255;
    warningBlink = false;
  } else {
    r = 255;
    g = 220;
    warningBlink = true;
  }
  rd.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
  fillPolygon(xs, ys, 7);
  rd.globalAlpha = 1;
  r = 115;
  g = 170;
  if (missed < MISSED.started) {
    if (fades) {
      rd.globalAlpha = angle / 45;
    }
  } else if (warningBlink) {
    r = 255;
    g = 0;
  }
  rd.strokeStyle = "rgb(" + r + "," + g + "," + b + ")";
  rd.lineWidth = arrowOutline();
  strokePolygon(xs, ys, 7);
  rd.globalAlpha = 1;
};

const drawCarArrow = (xs, ys) => {
  rd.fillStyle = "rgb(" + 159 + "," + 207 + "," + 255 + ")";
  fillPolygon(xs, ys, 7);
  rd.strokeStyle = "rgb(" + 120 + "," + 114 + "," + 255 + ")";
  rd.lineWidth = arrowOutline();
  strokePolygon(xs, ys, 7);
};

// The arrow on top of the screen: towards the path point the car heads for, or to the
// closest opponent. missed is the car's missed checkpoint counter.
export function arrow(pathPoint, missed, atCars) {
  const xs = [...ARROW_X];
  const ys = Array(7).fill(ARROW_Y);
  const zs = [...ARROW_Z];
  let heading = 0;
  if (!atCars) {
    heading = headingTo(track.x[pathPoint], track.z[pathPoint]);
  } else {
    const target = closestOpponent();
    camera.aimedCar = target;
    heading = headingTo(car[target].x, car[target].z);
    drawTargetName(target);
  }
  heading += camera.yaw;
  while (heading < 0) {
    heading += 360;
  }
  while (heading > 180) {
    heading -= 360;
  }
  // it points at most sideways and a little back
  const limit = atCars ? 100 : 130;
  if (heading > limit) {
    heading = limit;
  }
  if (heading < -limit) {
    heading = -limit;
  }
  turnArrowTowards(heading);
  rotate(xs, zs, ARROW_CENTER_X, ARROW_CENTER_Z, arrowAngle, 7);
  if (!atCars) {
    if (
      Math.abs(arrowAngle) > 7 ||
      missed >= MISSED.started ||
      missed == MISSED.warned ||
      wrongWayTicks != 0
    ) {
      projectArrow(xs, ys, zs);
      drawTrackArrow(xs, ys, missed);
    }
  } else {
    projectArrow(xs, ys, zs);
    drawCarArrow(xs, ys);
  }
}
