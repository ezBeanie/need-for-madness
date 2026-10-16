// The countdown before a race: the camera circles the field high above, hints for new
// players, then the camera drops behind the player's car and the numbers count down. The
// player can skip to that drop.

import { enginsnd, resetEngineSound } from "../audio/engineSound.js";
import { isPhone } from "../core/platform.js";
import { game } from "../core/state.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { pointer } from "../input/pointer.js";
import { CAMERA, camera } from "../render/camera.js";
import { animateTrack, castShadows, placeWheels } from "../render/raceScene.js";
import { drawinter } from "../ui/hud.js";
import { images } from "../ui/images.js";
import { drawStartHint } from "../ui/insano.js";
import { rd, view } from "../ui/view.js";
import { TEXT, drawCenteredText } from "../ui/widgets.js";
import { raceEvents } from "./events.js";
import { racers } from "./racers.js";
import { track } from "./track.js";

// raceEvents.countdown: where it starts, where the race has faded in from white, and from
// where the camera is behind the car with the numbers counting down to 0
export const COUNTDOWN = { start: 186, fadedIn: 185, behindTheCar: 65 };

export function countDown() {
  if (raceEvents.countdown == COUNTDOWN.start) {
    camera.orbitHeight = 190;
    camera.pitch = 40;
    camera.orbitAngle = 250;
    camera.target = 3;
    camera.orbitHigh = true;
    camera.orbitTilt = 0;
    camera.mode = CAMERA.orbit;
  }
  if (raceEvents.countdown != 0) {
    raceEvents.countdown--;
  }
  placeWheels();
  castShadows();
  animateTrack();
  drawinter();
  // switch mode: one lap, no fixing
  if (
    game.mode == 1 &&
    raceEvents.countdown < 180 &&
    raceEvents.countdown > 80
  ) {
    drawCenteredText(132, "SWITCH MODE", 0, 0, 0, TEXT.title);
    drawCenteredText(192, "1 Lap, No Fixing", 0, 64, 128, TEXT.label);
  }
  const flying = raceEvents.countdown > COUNTDOWN.behindTheCar;
  if (
    flying &&
    !isPhone &&
    (track.stage == 1 || track.stage == 2) &&
    game.unlocked == 1
  ) {
    drawKeyboardHints();
  }
  if (raceEvents.countdown < COUNTDOWN.behindTheCar) {
    enginsnd();
  } else if (
    (track.stage == 2 && game.unlocked == 2) ||
    (track.stage == 4 && game.unlocked == 4)
  ) {
    drawStartHint();
  }
  if (
    flying &&
    (confirm.state == CONFIRM.pressed || racers[0].u.handb || pointer.down)
  ) {
    raceEvents.countdown = COUNTDOWN.behindTheCar;
    if (confirm.state == CONFIRM.pressed) {
      confirm.state = CONFIRM.used;
    }
    racers[0].u.handb = false;
  }
  if (raceEvents.countdown == COUNTDOWN.behindTheCar) {
    camera.orbitDescending = false;
    camera.orbitHeight = 90;
    camera.orbitAngle = 0;
    camera.target = 0;
    camera.orbitHigh = false;
    camera.orbitTilt = 0;
    camera.mode = CAMERA.behind;
    resetEngineSound();
    // a white flash
    rd.fillStyle = "#FFFFFF";
    rd.fillRect(0, 0, view.width, view.height);
  }
  // the race fades in from white
  if (raceEvents.countdown >= COUNTDOWN.fadedIn) {
    if (raceEvents.countdown == COUNTDOWN.fadedIn) {
      rd.globalAlpha = 0.5;
    }
    rd.fillStyle = "#FFFFFF";
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
  }
}

// The keys of the first races: the space bar and the arrow keys.
const drawKeyboardHints = () => {
  rd.drawImage(
    images.instructions[6],
    50 * view.scaleX,
    view.height * 0.5 + 120 * view.scaleY,
    345 * view.scale,
    77 * view.scale,
  );
  rd.drawImage(
    images.instructions[5],
    view.width - 80 * view.scaleX - 220 * view.scale,
    view.height * 0.5 + 40 * view.scaleY,
    220 * view.scale,
    155 * view.scale,
  );
  rd.letterSpacing = "1px";
  rd.font = "" + 17 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  rd.fillStyle = "#000000";
  rd.fillText(
    "Handbrake / Stunts",
    50 * view.scaleX + 172 * view.scale,
    view.height * 0.5 + 90 * view.scaleY,
  );
  rd.fillText(
    "Drive / Stunts",
    view.width - 80 * view.scaleX - 110 * view.scale,
    view.height * 0.5 + 10 * view.scaleY,
  );
  rd.fillText(
    "Or [W] [A] [S] [D]",
    view.width - 80 * view.scaleX - 110 * view.scale,
    view.height * 0.5 + 70 * view.scaleY + 155 * view.scale,
  );
};
