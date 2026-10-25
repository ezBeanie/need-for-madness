// The sounds of the classic look: the original game's own (its sounds.zip), played where
// this game plays its sounds, and its engine as the original ran it (its playsounds and
// sparkeng): one of five loops of the car's engine for how far it is into its gear, rushes
// of air while the car flies or spins its wheels.
import { random } from "../core/random.js";
import { CAR, carStats } from "../data/carStats.js";
import { SKID } from "../race/racers.js";

// The original's file for each of this game's sounds; the sounds it never had (bumps,
// winning, switching cars, reversing time) stay this game's own.
export const CLASSIC_SOUNDS = {
  0: "skid1",
  1: "skid2",
  2: "skid3",
  3: "skid1",
  4: "dustskid1",
  5: "dustskid2",
  6: "dustskid3",
  7: "dustskid1",
  // hard crashes, then the original's low ones for the medium and light ones
  8: "crash1",
  9: "crash2",
  10: "crash3",
  11: "lowcrash1",
  12: "lowcrash2",
  13: "lowcrash3",
  14: "lowcrash1",
  15: "lowcrash2",
  16: "lowcrash3",
  17: "tires",
  20: "scrape1",
  21: "scrape2",
  22: "scrape1",
  // scraping along the ground
  23: "scrape3",
  24: "scrape3",
  25: "scrape3",
  26: "scrape3",
  27: "powerup",
  28: "checkpoint",
  29: "carfixed",
  30: "firewasted",
  31: "wasted",
  34: "three",
  35: "two",
  36: "one",
  37: "go",
};

// which of the original's five engines each car type has (its enginsignature; the cars it
// never had sound like the ones nearest them)
const ENGINE = {
  [CAR.tornadoShark]: 0,
  [CAR.formula7]: 1,
  [CAR.wowCaninaro]: 2,
  [CAR.laVitaCrab]: 1,
  [CAR.nimi]: 0,
  [CAR.maxRevenge]: 3,
  [CAR.leadOxide]: 2,
  [CAR.tragdor]: 4,
  [CAR.koolKat]: 2,
  [CAR.iceCream]: 1,
  [CAR.drifterX]: 1,
  [CAR.shadowRider]: 0,
  [CAR.swordOfJustice]: 0,
  [CAR.highRider]: 3,
  [CAR.elKing]: 4,
  [CAR.mightyEight]: 1,
  [CAR.masheen]: 4,
  [CAR.radicalOne]: 0,
  [CAR.drMonstaa]: 3,
};

export const CLASSIC_FILES = [
  ...new Set(Object.values(CLASSIC_SOUNDS)),
  ...[0, 1, 2, 3, 4].flatMap((e) => [0, 1, 2, 3, 4].map((j) => `${e}${j}`)),
  ...[0, 1, 2, 3, 4, 5].map((i) => `air${i}`),
];

const state = { pwait: 7, stopcnt: 0, grounded: false, aired: false };

export const resetClassicEngine = () => {
  state.pwait = 7;
  state.stopcnt = 0;
  state.grounded = false;
  state.aired = false;
};

// One tick of the original's engine and air sounds for the player's car. loop(channel,
// file) keeps a file looping on a channel (null: silent); the engine's loops sound one at
// a time, and so do the rushes of air.
export const classicEngineTick = (car, type, loop) => {
  const engine = (n) =>
    loop("engine", n >= 0 && n <= 4 ? `${ENGINE[type]}${n}` : null);
  const air = (i) => loop("air", `air${i}`);
  // (this game's speeds and wheel pushes are a tenth of the original's)
  const speed = Math.abs(car.speed);
  const gears = carStats.swits[type];
  const pedal = (car.u.up && car.speed > 0) || (car.u.down && car.speed < 1);
  const uneven = (push) =>
    Math.abs(push[0] - (push[1] + push[0] + push[2] + push[3]) / 4) > 0.1;
  let slipping =
    (car.skid == SKID.sliding && car.u.handb) ||
    uneven(car.wheelSpeedZ) ||
    uneven(car.wheelSpeedX);
  let starting = false;
  let onThePedal = pedal;
  if (car.u.up && car.speed < 1) {
    slipping = true;
    onThePedal = true;
    starting = true;
  }
  // the loop for how far into the gear (0 to 2 of 3), the top one waiting a little
  const intoGear = (from, to) => {
    let n = Math.trunc((3 * (speed - from)) / (to - from));
    if (n == 2) {
      if (state.pwait == 0) {
        n = 0;
      } else {
        state.pwait--;
      }
    } else {
      state.pwait = 7;
    }
    return n;
  };
  if (onThePedal && car.grounded) {
    if (car.capsized) {
      engine(4);
    } else if (slipping) {
      engine(0);
      if (starting) {
        if (state.stopcnt <= 0) {
          air(5);
          state.stopcnt = 10;
        }
      } else if (state.stopcnt <= -2) {
        air(2 + Math.trunc(random.fx() * 3));
        state.stopcnt = 7;
      }
    } else if (car.power != 98) {
      if (speed > 0 && speed <= gears[0]) {
        engine(intoGear(0, gears[0]) + 1);
      }
      if (speed > gears[0] && speed <= gears[1]) {
        engine(intoGear(gears[0], gears[1]) + 1);
      }
      if (speed > gears[1] && speed <= gears[2]) {
        engine(
          Math.trunc((3 * (speed - gears[1])) / (gears[2] - gears[1])) + 1,
        );
      }
    } else {
      let n = 2;
      if (state.pwait == 0) {
        if (speed > gears[1]) {
          n = 3;
        }
      } else {
        state.pwait--;
      }
      engine(n + 1);
    }
    state.grounded = false;
    state.aired = false;
  } else {
    state.pwait = 15;
    if (!car.grounded && !state.grounded && random.fx() > 0.4) {
      air(Math.trunc(random.fx() * 4));
      state.stopcnt = 5;
      state.grounded = true;
    }
    if (!car.wheelsTouch && !state.aired) {
      air(Math.trunc(random.fx() * 4));
      state.stopcnt = 10;
      state.aired = true;
    }
    engine(0);
  }
  if (state.stopcnt != -20) {
    if (state.stopcnt == 1) {
      loop("air", null);
    }
    state.stopcnt--;
  }
};
