// The engine of the player's car: pitch and volume follow the speed through three gears,
// the revs flutter while the wheels slip, and in the air the engine revs up and down by
// itself.

import { classicEngineTick, resetClassicEngine } from "../classic/sounds.js";
import { random } from "../core/random.js";
import { game } from "../core/state.js";
import { carStats } from "../data/carStats.js";
import { raceEvents } from "../race/events.js";
import { SKID, racers } from "../race/racers.js";
import { LOOK, look } from "../render/look.js";
import {
  engine,
  loopClassicSound,
  startEngine,
  stopClassicLoops,
  stopEngine,
} from "./audio.js";
import { coolDownCarSounds } from "./carSounds.js";

// where the volume and pitch head; 1 is the engine sample as it is
let targetVolume = 1;
let targetPitch = 1;

// while the wheels slip the revs sink from slipRevs by slipRevDrop per tick, then start
// high again
let slipRevs = 2;
let slipRevDrop = 0.2;

// In the air the engine revs up to revTarget, holds, and revs down (once rising again at
// revAgainBelow) to idle. After landing it keeps that up for landingTicks.
const REV = { start: 0, up: 1, hold: 2, down: 3, idle: 4 };
let revs = REV.start;
let revLevel = 0;
let revTarget = 0;
let revUpStep = 0;
let revDownStep = 0;
let revHoldTicks = 0;
let landingTicks = 0;
let revAgainBelow = 0;

// at top speed the pitch now and then jumps, as against a rev limiter
let limiterTicks = 10;

// The revs of a race start from the beginning.
export const resetEngineSound = () => {
  revs = REV.start;
  targetPitch = 1;
  resetClassicEngine();
};

// The classic look's engine is the original's (see classic/sounds.js).
const updateClassicEngine = () => {
  if (engine.started) {
    stopEngine();
  }
  if (raceEvents.raceOverTicks) {
    stopClassicLoops();
  } else {
    const type = game.carTypes[game.player];
    classicEngineTick(racers[game.player], type, loopClassicSound);
  }
  coolDownCarSounds();
};

export function updateEngineSound() {
  if (look.current == LOOK.classic) {
    updateClassicEngine();
    return;
  }
  stopClassicLoops();
  if (!engine.started) {
    if (!raceEvents.raceOverTicks) {
      startEngine(game.carTypes[game.player], true);
    }
    coolDownCarSounds();
    return;
  }
  const car = racers[game.player];
  const type = game.carTypes[game.player];
  let atTopSpeed = false;
  const onThePedal =
    (car.u.up && car.speed > 0) || (car.u.down && car.speed < 0);
  if (car.wheelsTouch && !car.capsized) {
    if (car.grounded) {
      if (!slipping(car)) {
        atTopSpeed = followGears(car, type, onThePedal);
        if (slipRevs != 1 + 1.1 * carStats.engrev[type]) {
          restartSlipRevs(type);
        }
      } else {
        flutter(type);
      }
      if (revs != REV.start) {
        if (landingTicks == 0) {
          revs = REV.start;
        } else {
          landingTicks--;
        }
      }
    }
  } else {
    revInTheAir(car, onThePedal);
  }
  if (raceEvents.raceOverTicks == 0) {
    engine.volume.gain.value +=
      ((targetVolume - 1) * 0.75 + 1 - engine.volume.gain.value) / 10;
  } else if (engine.volume.gain.value > 0.3) {
    engine.volume.gain.value -= 0.01;
  }
  if (atTopSpeed) {
    if (limiterTicks == 0) {
      targetPitch *= 1.06;
      limiterTicks = Math.floor(random.fx() * 50);
    } else {
      limiterTicks--;
    }
  }
  const rise = Math.max(targetPitch - 1, 0);
  engine.source.playbackRate.value = 1 + rise * carStats.engrev[type];
  coolDownCarSounds();
}

// Handbrake skids, or the wheels far from even (scx, scz: how each wheel is pushed).
const slipping = (car) => {
  const uneven = (push) =>
    Math.abs(push[0] - (push[1] + push[0] + push[2] + push[3]) / 4) > 0.1;
  return (
    (car.skid == SKID.sliding && car.u.handb) ||
    uneven(car.scz) ||
    uneven(car.scx)
  );
};

// Returns whether the car is at its top speed.
const followGears = (car, type, onThePedal) => {
  const speed = Math.abs(car.speed);
  const gearTop = carStats.swits[type];
  if (!onThePedal) {
    const amp = speed / gearTop[2];
    targetVolume = 1 + amp * 0.5;
    targetPitch = 1 + amp;
    return false;
  }
  // how far into the gear, squared
  const intoGear = (from, to) => {
    const amp = (speed - from) / (to - from);
    return amp * amp;
  };
  if (speed > 0 && speed <= gearTop[0]) {
    let amp = speed / gearTop[0];
    amp *= amp;
    targetVolume = 1 + amp;
    targetPitch = 1 + amp;
  }
  if (speed > gearTop[0] && speed <= gearTop[1]) {
    const amp = intoGear(gearTop[0], gearTop[1]);
    targetVolume = 1 + amp;
    targetPitch = Math.min(1.2 + amp, 2.1);
  }
  if (speed > gearTop[1] && speed <= gearTop[2]) {
    const amp = intoGear(gearTop[1], gearTop[2]);
    targetVolume = 1 + amp;
    targetPitch = 1.6 + amp;
    if (targetPitch > 2.2) {
      targetPitch = 2.2;
      return true;
    }
  }
  return false;
};

const restartSlipRevs = (type) => {
  slipRevs = 1 + 1.1 * carStats.engrev[type];
  slipRevDrop = 0.02 + 0.16 * random.fx();
};

const flutter = (type) => {
  targetVolume = Math.min(slipRevs, 2);
  targetPitch = slipRevs;
  slipRevs -= slipRevDrop;
  if (slipRevs < 1 + 0.5 * carStats.engrev[type]) {
    restartSlipRevs(type);
  }
};

const revInTheAir = (car, onThePedal) => {
  if (revs == REV.start) {
    landingTicks = 20;
    revLevel = targetPitch;
    revTarget = Math.max(revLevel + 0.3 + 0.2 * random.fx(), 2);
    revUpStep = 0.1 + 0.3 * random.fx();
    revDownStep = 0.1 + 0.2 * random.fx();
    revHoldTicks = Math.floor(5 + 5 * random.fx());
    revs = REV.up;
    revAgainBelow =
      random.fx() > random.fx() ? revTarget * (0.8 + 0.15 * random.fx()) : 0;
  }
  if (revs == REV.up) {
    revLevel += revUpStep;
    targetVolume = Math.min(revLevel, 2);
    targetPitch = revLevel;
    if (revLevel > revTarget) {
      revs = REV.hold;
    }
  }
  if (revs == REV.hold) {
    revHoldTicks--;
    if (revHoldTicks == 0) {
      revs = REV.down;
    }
  }
  if (revs == REV.down) {
    revLevel -= revDownStep;
    if (revLevel < revAgainBelow) {
      revLevel = revTarget;
      revAgainBelow = 0;
    }
    if (revLevel < 0.5) {
      revLevel = 0.5;
      revs = REV.idle;
    }
    targetVolume = Math.min(revLevel, 2);
    targetPitch = Math.max(revLevel, 1.4);
  }
  // idle, the pedal moves the revs again (while grounded)
  if (revs == REV.idle && car.grounded) {
    targetPitch = onThePedal ? targetPitch + 0.1 : targetPitch - 0.2;
    targetPitch = Math.min(Math.max(targetPitch, 1.4), 2);
    targetVolume = Math.min((targetPitch - 1.4) * 2.5 + 0.5, 2);
  }
};
