// Gamepads and joysticks: the sticks or the face buttons drive, the shoulder buttons toggle
// the arrow, pull the handbrake and look back, every further button confirms. With the
// target camera on in a race, the right stick to a side chooses the car it turns to and a
// click on the left stick lets go of it.

import { PHASE, game } from "../core/state.js";
import { racers } from "../race/racers.js";
import { camera } from "../render/camera.js";
import { lockNext } from "../render/cameraMoves.js";
import { CONFIRM, confirm } from "./confirm.js";

const BUTTON = {
  accelerate: 0,
  steerRight: 1,
  brake: 2,
  steerLeft: 3,
  toggleArrow: 4,
  handbrake: 5,
  lookBackLeft: 6,
  lookBackRight: 7,
  // this one and all after it
  firstConfirm: 8,
  // the left stick clicked, on a standard gamepad
  leftStick: 10,
};
// how far the right stick is tilted to choose the next target, and back to choose again
const AIM_TILT = 0.6;
const AIM_RELEASED = 0.3;
// pads with fewer buttons have no shoulder buttons
const SHOULDER_BUTTONS = 8;
const STICK_DEAD_ZONE = 0.1;
// after its last press a gamepad keeps releasing what it lets go of for this many ticks,
// then it leaves the inputs to the keyboard
const RELEASE_TICKS = 10;

let connected = false;
// how often the game still looks for gamepads (at start and when the main menu is left)
let searchesLeft = 4;
// per gamepad
const releaseTicks = [0, 0, 0, 0, 0, 0, 0, 0];
let arrowToggleHeld = false;
// the right stick's last choice of a target (-1, 1), until it comes back
let aimTilt = 0;

export const lookForGamepads = () => {
  if (!searchesLeft) {
    return;
  }
  connected = false;
  try {
    if (navigator.getGamepads) {
      const pads = navigator.getGamepads();
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] != null) {
          connected = true;
        }
      }
    }
  } catch (e) {
    // a permissions policy can forbid the gamepad API
  }
  searchesLeft--;
};

export const pollGamepads = () => {
  if (!connected) {
    return;
  }
  const pads = navigator.getGamepads();
  for (let i = 0; i < pads.length; i++) {
    if (releaseTicks[i] == null) {
      releaseTicks[i] = 0;
    }
    if (pads[i] != null && pads[i].connected) {
      readGamepad(pads[i], i);
    }
  }
};

const readGamepad = (pad, index) => {
  const tilted = (axis, towardsNegative) => {
    const value = pad.axes[axis];
    return Math.abs(value) > STICK_DEAD_ZONE && value < 0 === towardsNegative;
  };
  const pressed = (button) => pad.buttons[button]?.pressed;
  const input = racers[game.player].u;
  const aiming = camera.aims && game.phase == PHASE.race;
  // a pressed input holds, a released one is let go of only while the pad is in use
  const hold = (isPressed, set) => {
    if (isPressed) {
      set(true);
      releaseTicks[index] = RELEASE_TICKS;
    } else if (releaseTicks[index]) {
      set(false);
    }
  };
  // (aiming, the right stick's sideways chooses the target instead of steering)
  const left = tilted(0, true) || (!aiming && tilted(2, true));
  const right = tilted(0, false) || (!aiming && tilted(2, false));
  if (aiming) {
    chooseTarget(pad.axes[2] ?? 0);
    if (pressed(BUTTON.leftStick)) {
      camera.lockedCar = -1;
    }
  }
  const up = tilted(1, true) || tilted(3, true);
  const down = tilted(1, false) || tilted(3, false);
  hold(pressed(BUTTON.accelerate) || up, (on) => (input.up = on));
  hold(pressed(BUTTON.brake) || down, (on) => (input.down = on));
  hold(pressed(BUTTON.steerLeft) || left, (on) => (input.left = on));
  hold(pressed(BUTTON.steerRight) || right, (on) => (input.right = on));
  if (pad.buttons.length >= SHOULDER_BUTTONS) {
    hold(pressed(BUTTON.toggleArrow), (on) => {
      if (on && !arrowToggleHeld) {
        input.arrace = !input.arrace;
      }
      arrowToggleHeld = on;
    });
    hold(pressed(BUTTON.handbrake), (on) => (input.handb = on));
    hold(pressed(BUTTON.lookBackLeft), lookBack(-1));
    hold(pressed(BUTTON.lookBackRight), lookBack(1));
  }
  let confirming = false;
  for (let b = BUTTON.firstConfirm; b < pad.buttons.length; b++) {
    if (pressed(b) && !(aiming && b == BUTTON.leftStick)) {
      confirming = true;
    }
  }
  hold(confirming, (on) => {
    if (on && !confirm.state) {
      confirm.state = CONFIRM.pressed;
    }
    if (!on && confirm.state) {
      confirm.state = CONFIRM.released;
    }
  });
  if (releaseTicks[index]) {
    releaseTicks[index]--;
  }
};

const chooseTarget = (tilt) => {
  if (Math.abs(tilt) < AIM_RELEASED) {
    aimTilt = 0;
  } else if (Math.abs(tilt) > AIM_TILT && aimTilt != Math.sign(tilt)) {
    aimTilt = Math.sign(tilt);
    lockNext(aimTilt);
  }
};

// Looks back to one side while held; letting go only ends looking back to that side.
const lookBack = (side) => (on) => {
  if (on) {
    camera.lookBack = side;
  } else if (camera.lookBack == side) {
    camera.lookBack = 0;
  }
};
