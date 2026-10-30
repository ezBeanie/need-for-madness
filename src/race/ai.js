// The computer drivers: how every car but the player's decides what to press.

import { cosDeg, distanceSquaredXZ, distanceXZ, sinDeg } from "../core/math.js";
import { random } from "../core/random.js";
import { MAX_CARS, MODE, aiRival, game, isHuman } from "../core/state.js";
import { tick } from "../core/tick.js";
import { CAR, carStats } from "../data/carStats.js";
import { MISSED, car, racers } from "./racers.js";
import { PIECE, pieceModels, pieces, track } from "./track.js";
import { atan } from "../core/exactMath.js";

// path points marked "pr" in the stage file lie on ramps (see pathType)
const RAMP_POINT = -2;
// how a driver treats the ramps on its path
const RAMPS = { avoid: -1, either: 0, take: 1, stayBefore: 2 };
// A damaged driver heads for a fix hoop: one on its way (more than half damaged), or the
// nearest (more than 80 %); then it is close to the hoop, then jumping through it.
const FIX = { none: 0, onTheWay: 1, nearest: 2, close: 3, jumping: 4 };
// A jump: on taking off a driver decides on a stunt (or none), flips and rolls, and
// straightens up to land.
const STUNT = { none: -1, takeoff: 0, flipping: 1, landing: 2 };
// The stunt a stage asks for at its next jump (free: chosen at random). Flipping up holds the
// up key, down the down key; "at once" starts flipping right on takeoff and always jumps.
const STUNT_PLAN = {
  free: 0,
  flipUp: 1,
  flipDown: 2,
  roll: 3,
  flipUpAtOnce: 4,
  flipDownAtOnce: 5,
};
// what a driver does in a sharp turn besides steering (a turn of more than 50 degrees
// above its first gear's top speed)
const SHARP_TURN = { steer: 0, brake: 1, handbrake: 2, liftGas: 3 };

// Whom a driver chases (or flees from) and how; forgotten at the start and when the
// player winds back time.
const newPursuit = () => ({
  // the heading the driver steers to, in degrees
  aimHeading: 0,
  // ticks left attacking attackedCar (0: following the path)
  attackTicks: 0,
  attackedCar: 0,
  afta: false,
  // see FIX
  fixing: 0,
  // up to how many ticks pass between aiming anew (sloppier drivers aim less often)
  aimLag: 0,
  // ticks per gas cycle it rolls without gas, letting the player catch up (see waitAtStart)
  holdBack: 0,
  // heads for a fix hoop off the path, missed checkpoints or not
  ignoreMissed: false,
  // chases the player instead of racing
  bully: false,
  runbul: 0,
  // ticks it backs up at the start
  reverseTicks: 0,
  oupnt: 0,
  // drives to (waitX, waitZ) to lie in wait
  goingToWait: false,
  // stage 15: stops attacking on missing a checkpoint
  quitsAttackOnMissedCheckpoint: false,
});

// What every computer driver is up to. Some fields keep their original names, as they mean
// different things on different stages (afta, oupnt, runbul).
const newDriver = () => ({
  ...newPursuit(),
  // ticks it keeps its steering after hitting a wall
  steerFreeze: 0,
  // it decides anew how to drive (see rethink) after this many ticks on the ground
  rethinkAfter: 0,
  ticksSinceRethink: 0,
  // degrees off its aim it does not steer for
  steerTolerance: 5,
  // the chance of skipping path points (0..1)
  cornerCutting: 1,
  // see RAMPS
  rampChoice: 0,
  turnStyleTicks: 0,
  // keeps the gas in sharp turns
  gasInTurns: false,
  // see SHARP_TURN
  sharpTurn: 0,
  // how early it straightens up before landing
  landingMargin: 30,
  // the chance of not correcting a landing
  landingSloppiness: 0.5,
  // see STUNT_PLAN
  stuntPlan: 0,
  avoidPlayerRange: 0,
  // fewer and later stunts
  stuntCaution: 0.5,
  groundByWheels: false,
  landsPerfectly: false,
  // how far ahead of its victim it aims, in half their distance
  leadAhead: 0,
  stuntPhase: 0,
  // ticks into the gas cycle, and the hold back of this cycle
  gasCycle: 0,
  holdBackNow: 0,
  waitX: 0,
  waitZ: 0,
  // where it lies in wait for the player: a circle (ambushRadius is squared, in tenths)
  ambushX: 0,
  ambushZ: 0,
  ambushRadius: 0,
  ticksToNextAim: 0,
  ticksSinceAim: 0,
  lastTurnedLeft: false,
  lastWall: -1,
  wallTurnLeft: false,
  // a stunt: its angles at take-off, ticks in the air, flip and roll (-1, 0, 1), when
  // they start and whether they turn back after half a turn
  takeoffXy: 0,
  takeoffZy: 0,
  airTicks: 0,
  flip: 0,
  roll: 0,
  flipReverses: false,
  rollReverses: false,
  flipAfter: 0,
  rollAfter: 0,
  // straightening up to land: what it pressed, and whether pitch and roll are done
  pressedUp: false,
  pressedDown: false,
  pressedLeft: false,
  pressedRight: false,
  rollSettled: false,
  pitchSettled: false,
  straightenPitch: false,
  straightenRoll: false,
  landingStep: 0,
});

// index = car number
export const ai = Array.from({ length: MAX_CARS }, newDriver);

export const resetPursuit = (c) => {
  Object.assign(ai[c], newPursuit());
};

// The last car is the stage's special opponent (see chooseOpponents).
const boss = () => game.carCount - 1;

// The race position of car c on the scale of the original seven cars (0 first, 6 last),
// for the formulas tuned to it.
const rank = (c) =>
  game.carCount > 1 ? (track.pos[c] * 6) / (game.carCount - 1) : 0;

// per fix hoop the path point a few points before it, where drivers head to fix
const fixApproach = [0, 0, 0, 0, 0];

export function inishcontrol() {
  if (track.stage != 9) {
    for (let j = 0; j < pieces.fixCount; j++) {
      let pyclos = -10;
      for (let i = 0; i < track.n; i++) {
        if (
          distanceSquaredXZ(
            pieces.list[pieces.fixes[j]].x / 10,
            track.x[i] / 10,
            pieces.list[pieces.fixes[j]].z / 10,
            track.z[i] / 10,
          ) < pyclos ||
          pyclos == -10
        ) {
          pyclos = distanceSquaredXZ(
            pieces.list[pieces.fixes[j]].x / 10,
            track.x[i] / 10,
            pieces.list[pieces.fixes[j]].z / 10,
            track.z[i] / 10,
          );
          fixApproach[j] = i;
        }
      }
    }
    for (let i = 0; i < pieces.fixCount; i++) {
      fixApproach[i] -= 4;
      if (fixApproach[i] < 0) {
        fixApproach[i] += track.nsp;
      }
      if (track.stage == 15 && i == 2) {
        fixApproach[i] = 71;
      }
    }
  } else {
    if (track.stage == 9) {
      fixApproach[1] = 36;
      fixApproach[0] = 42;
    }
  }
  for (let c = 1; c < game.carCount; c++) {
    resetPursuit(c);
    ai[c].steerFreeze = 0;
    if (track.stage == 6) {
      ai[c].steerFreeze = 50;
    }
    if (track.stage == 7) {
      ai[c].steerFreeze = 10;
    }
    if (track.stage == 8 && c != boss()) {
      ai[c].steerFreeze = 50;
    }
    if (track.stage == 10) {
      ai[c].steerFreeze = 60;
    }
    if (track.stage == 11) {
      if (c != boss()) {
        ai[c].steerFreeze = 35;
        ai[c].reverseTicks = 25;
      } else {
        ai[c].steerFreeze = 5;
      }
      ai[c].rethinkAfter = 0;
    }
    if (track.stage == 12) {
      if (c != boss()) {
        ai[c].steerFreeze = Math.floor(20 + 10 * random.sim());
        ai[c].reverseTicks = Math.floor(10 + 10 * random.sim());
      } else {
        ai[c].steerFreeze = 5;
      }
      ai[c].rethinkAfter = 0;
    }
    if (track.stage == 14) {
      ai[c].steerFreeze = 30;
      ai[c].rethinkAfter = 0;
      if (c != boss()) {
        ai[c].reverseTicks = 1;
      }
    }
    if (track.stage == 15) {
      ai[c].steerFreeze = 40;
    }
    if (track.stage == 16) {
      ai[c].steerFreeze = 20;
    }
    racers[c].u.left = false;
    racers[c].u.right = false;
    racers[c].u.up = false;
    racers[c].u.down = false;
    racers[c].u.handb = false;
  }
}
export function control() {
  for (let c = 0; c < game.carCount; c++) {
    if (!isHuman(c)) {
      let type = car[c].typ;
      racers[c].u.left = false;
      racers[c].u.right = false;
      racers[c].u.up = false;
      racers[c].u.down = false;
      racers[c].u.handb = false;
      if (!racers[c].wasted) {
        if (racers[c].grounded) {
          if (ai[c].ticksSinceRethink > ai[c].rethinkAfter) {
            rethink(c);
          } else {
            if (tick.fraction >= tick.scale) {
              ai[c].ticksSinceRethink++;
            }
          }
        }
        let ride = false;
        if (ai[c].groundByWheels) {
          ride = racers[c].wheelsTouch;
        } else {
          ride = racers[c].grounded;
        }
        if (ride) {
          if (ai[c].stuntPhase != STUNT.takeoff) {
            ai[c].stuntPhase = STUNT.takeoff;
          }
          if (ai[c].fixing == FIX.nearest || ai[c].fixing == FIX.close) {
            ai[c].attackTicks = 0;
          }
          if (ai[c].attackTicks == 0) {
            waitAtStart(c);
            let pnt = racers[c].point;
            let powbul = 50;
            if (track.stage == 8) {
              powbul = 20;
            }
            if (track.stage == 15) {
              powbul = 40;
            }
            if (track.stage == 16) {
              if (type == CAR.elKing || type == CAR.masheen) {
                powbul = 0;
              }
            }
            pnt = choosePathPoint(c, powbul, pnt);
            pnt = headForFix(c, pnt);
            aimAtPathPoint(c, pnt);
          } else {
            chaseTarget(c);
          }
          steerToAim(c);
          bounceOffWalls(c);
        } else {
          flyStunts(c);
        }
      }
    }
  }
}

function waitAtStart(c) {
  if (ai[c].gasCycle < 30) {
    if (ai[c].reverseTicks <= 0) {
      racers[c].u.up = true;
    } else {
      racers[c].u.down = true;
      if (tick.fraction >= tick.scale) {
        ai[c].reverseTicks--;
      }
    }
  }
  if (ai[c].gasCycle < 25 + ai[c].holdBackNow) {
    if (tick.fraction >= tick.scale) {
      ai[c].gasCycle++;
    }
  } else {
    ai[c].gasCycle = 0;
    ai[c].holdBackNow = ai[c].holdBack;
  }
}

function headForFix(c, point) {
  if (track.stage != 17 && game.mode != MODE.switchCars) {
    if (
      racers[c].missedCheckpoint == MISSED.none ||
      ai[c].ignoreMissed ||
      ai[c].fixing == FIX.jumping
    ) {
      if (ai[c].fixing != FIX.none) {
        let firstFix = 0;
        if (
          track.stage == 9 &&
          car[aiRival()].typ == CAR.elKing &&
          track.clear[c] - track.clear[aiRival()] >= 4
        ) {
          firstFix = 1;
        }
        if (track.stage == 16) {
          firstFix = 2;
        }
        if (ai[c].fixing == FIX.nearest) {
          if (track.stage == 15) {
            firstFix = 2;
          }
          let nearest = -10;
          let nearestFix = 0;
          for (let i = firstFix; i < pieces.fixCount; i++) {
            if (
              distanceSquaredXZ(
                car[c].x / 10,
                track.x[fixApproach[i]] / 10,
                car[c].z / 10,
                track.z[fixApproach[i]] / 10,
              ) < nearest ||
              nearest == -10
            ) {
              nearest = distanceSquaredXZ(
                car[c].x / 10,
                track.x[fixApproach[i]] / 10,
                car[c].z / 10,
                track.z[fixApproach[i]] / 10,
              );
              nearestFix = i;
            }
          }
          if (track.stage == 12) {
            nearestFix = 1;
          }
          point = fixApproach[nearestFix];
          if (track.special[nearestFix]) {
            ai[c].ignoreMissed = true;
          } else {
            ai[c].ignoreMissed = false;
          }
        }
        for (let i = firstFix; i < pieces.fixCount; i++) {
          if (
            distanceSquaredXZ(
              car[c].x / 10,
              track.x[fixApproach[i]] / 10,
              car[c].z / 10,
              track.z[fixApproach[i]] / 10,
            ) < 2000
          ) {
            ai[c].ignoreMissed = false;
            ai[c].holdBackNow = 0;
            ai[c].holdBack = 0;
            ai[c].sharpTurn = SHARP_TURN.handbrake;
            ai[c].ticksToNextAim = -1;
            ai[c].aimLag = 0;
            ai[c].rampChoice = RAMPS.either;
            ai[c].fixing = FIX.close;
          }
        }
        if (ai[c].fixing == FIX.close) {
          racers[c].nofocus = true;
        }
      }
    }
  }
  return point;
}

function aimAtPathPoint(c, point) {
  if (ai[c].ticksSinceAim > ai[c].ticksToNextAim) {
    if (!ai[c].goingToWait) {
      let behind = 0;
      if (track.x[point] - car[c].x >= 0) {
        behind = 180;
      }
      ai[c].aimHeading = Math.floor(
        90 +
          behind +
          atan((track.z[point] - car[c].z) / (track.x[point] - car[c].x)) /
            0.017453292519943295,
      );
    } else {
      let behind = 0;
      if (ai[c].waitX - car[c].x >= 0) {
        behind = 180;
      }
      ai[c].aimHeading = Math.floor(
        90 +
          behind +
          atan((ai[c].waitZ - car[c].z) / (ai[c].waitX - car[c].x)) /
            0.017453292519943295,
      );
    }
    ai[c].ticksSinceAim = 0;
    ai[c].ticksToNextAim = Math.floor(ai[c].aimLag * random.sim());
  } else {
    if (tick.fraction >= tick.scale) {
      ai[c].ticksSinceAim++;
    }
  }
}

function chaseTarget(c) {
  racers[c].u.up = true;
  let behind = 0;
  let lead =
    (distanceXZ(
      car[c].x,
      car[ai[c].attackedCar].x,
      car[c].z,
      car[ai[c].attackedCar].z,
    ) /
      2) *
    ai[c].leadAhead;
  let aimX =
    car[ai[c].attackedCar].x -
    lead * sinDeg(racers[ai[c].attackedCar].motionHeading);
  let aimZ =
    car[ai[c].attackedCar].z +
    lead * cosDeg(racers[ai[c].attackedCar].motionHeading);
  if (aimX - car[c].x >= 0) {
    behind = 180;
  }
  ai[c].aimHeading =
    90 +
    behind +
    atan((aimZ - car[c].z) / (aimX - car[c].x)) / 0.017453292519943295;
  if (tick.fraction >= tick.scale) {
    ai[c].attackTicks--;
  }
  if (ai[c].attackTicks <= 0) {
    ai[c].attackTicks = 0;
  }
  if (
    track.stage == 15 &&
    ai[c].quitsAttackOnMissedCheckpoint &&
    !ai[c].bully &&
    racers[c].missedCheckpoint != MISSED.none
  ) {
    ai[c].attackTicks = 0;
  }
  if (track.stage == 16 && racers[c].missedCheckpoint != MISSED.none) {
    if (track.pos[c] == 0 || (track.pos[c] == 1 && track.pos[aiRival()] == 0)) {
      ai[c].attackTicks = 0;
    }
  }
  if (
    track.stage == 16 &&
    track.pos[aiRival()] > track.pos[c] &&
    racers[c].power < 80
  ) {
    ai[c].attackTicks = 0;
  }
}

function steerToAim(c) {
  const type = car[c].typ;
  let heading = car[c].xz;
  if (racers[c].u.zyinv) {
    heading += 180;
  }
  while (heading < 0) {
    heading += 360;
  }
  while (heading > 180) {
    heading -= 360;
  }
  while (ai[c].aimHeading < 0) {
    ai[c].aimHeading += 360;
  }
  while (ai[c].aimHeading > 180) {
    ai[c].aimHeading -= 360;
  }
  if (racers[c].wall != -1 && ai[c].steerFreeze == 0) {
    ai[c].steerTolerance = 0;
  }
  if (ai[c].steerFreeze == 0) {
    if (Math.abs(heading - ai[c].aimHeading) < 180) {
      if (
        Math.floor(Math.abs(heading - ai[c].aimHeading)) > ai[c].steerTolerance
      ) {
        if (heading > ai[c].aimHeading) {
          racers[c].u.left = true;
          ai[c].lastTurnedLeft = true;
        } else {
          racers[c].u.right = true;
          ai[c].lastTurnedLeft = false;
        }
        if (
          Math.abs(heading - ai[c].aimHeading) > 50 &&
          racers[c].speed > carStats.swits[type][0] &&
          ai[c].sharpTurn != SHARP_TURN.steer
        ) {
          if (ai[c].sharpTurn == SHARP_TURN.brake) {
            racers[c].u.down = true;
          }
          if (ai[c].sharpTurn == SHARP_TURN.handbrake) {
            racers[c].u.handb = true;
          }
          if (!ai[c].gasInTurns) {
            racers[c].u.up = false;
          }
        }
      }
    } else {
      if (
        Math.floor(Math.abs(heading - ai[c].aimHeading)) <
        360 - ai[c].steerTolerance
      ) {
        if (heading > ai[c].aimHeading) {
          racers[c].u.right = true;
          ai[c].lastTurnedLeft = false;
        } else {
          racers[c].u.left = true;
          ai[c].lastTurnedLeft = true;
        }
        if (
          Math.abs(heading - ai[c].aimHeading) < 310 &&
          racers[c].speed > carStats.swits[type][0] &&
          ai[c].sharpTurn != SHARP_TURN.steer
        ) {
          if (ai[c].sharpTurn == SHARP_TURN.brake) {
            racers[c].u.down = true;
          }
          if (ai[c].sharpTurn == SHARP_TURN.handbrake) {
            racers[c].u.handb = true;
          }
          if (!ai[c].gasInTurns) {
            racers[c].u.up = false;
          }
        }
      }
    }
  }
}

function bounceOffWalls(c) {
  if (racers[c].wall != -1) {
    if (ai[c].lastWall != racers[c].wall) {
      if (ai[c].lastTurnedLeft) {
        racers[c].u.left = true;
      } else {
        racers[c].u.right = true;
      }
      ai[c].wallTurnLeft = ai[c].lastTurnedLeft;
      ai[c].lastWall = racers[c].wall;
    } else {
      if (ai[c].wallTurnLeft) {
        racers[c].u.left = true;
      } else {
        racers[c].u.right = true;
      }
    }
    if (pieceModels[pieces.list[racers[c].wall].typ].dam != 0) {
      let bump = 1;
      if (pieceModels[pieces.list[racers[c].wall].typ].skid == 1) {
        bump = 3;
      }
      ai[c].steerFreeze += bump;
      if (ai[c].steerFreeze > 10 * bump) {
        ai[c].steerFreeze = 10 * bump;
      }
    } else {
      ai[c].steerFreeze = 1;
    }
    racers[c].wall = -1;
  } else {
    if (ai[c].steerFreeze != 0) {
      ai[c].steerFreeze--;
    }
  }
}

function flyStunts(c) {
  if (ai[c].stuntPhase == STUNT.takeoff) {
    takeOff(c);
  }
  if (ai[c].stuntPhase == STUNT.flipping) {
    flyAndWaitForLanding(c);
  }
  if (ai[c].stuntPhase == STUNT.landing) {
    land(c);
  }
}

function takeOff(c) {
  const type = car[c].typ;
  let lift =
    ((racers[c].wheelSpeedY[0] +
      racers[c].wheelSpeedY[1] +
      racers[c].wheelSpeedY[2] +
      racers[c].wheelSpeedY[3]) *
      (car[c].y + 5)) /
    40;
  let cautionDivisor = 3;
  if (track.stage == 15 || track.stage == 16) {
    cautionDivisor = 10;
  }
  if (
    track.stage == 13 &&
    racers[c].clearedPathPoint == 20 &&
    racers[c].point > 32 &&
    track.clear[c] - track.clear[aiRival()] <= 3
  ) {
    lift = 0;
  }
  if (
    track.stage == 16 &&
    racers[c].clearedPathPoint == 120 &&
    car[c].z < 2200
  ) {
    lift = 0;
  }
  if (
    lift > 7 &&
    (random.sim() > ai[c].stuntCaution / cautionDivisor ||
      ai[c].stuntPlan == STUNT_PLAN.flipUpAtOnce)
  ) {
    ai[c].takeoffXy = racers[c].roll;
    ai[c].takeoffZy = racers[c].pitch;
    ai[c].airTicks = 0;
    ai[c].flip = 0;
    ai[c].roll = 0;
    ai[c].flipReverses = false;
    ai[c].rollReverses = false;
    ai[c].stuntPhase = STUNT.flipping;
    chooseFlipsAndRolls(lift, c);
    if (track.stage == 16 && type == CAR.masheen) {
      ai[c].roll = -1;
      ai[c].rollAfter = 0;
      ai[c].flip = -1;
      ai[c].flipAfter = 0;
    }
    if (ai[c].fixing == FIX.close || ai[c].fixing == FIX.jumping) {
      if (track.stage != 8) {
        if (ai[c].roll == -1) {
          ai[c].flip = -1;
        }
        ai[c].roll = 0;
        if (racers[c].power < 60) {
          ai[c].flip = -1;
        }
      } else {
        if (ai[c].flip != 0) {
          ai[c].flip = -1;
        }
        ai[c].roll = 0;
      }
    }
  } else {
    ai[c].stuntPhase = STUNT.none;
  }
  if (!ai[c].afta) {
    ai[c].afta = true;
  }
  if (ai[c].fixing == FIX.close) {
    ai[c].fixing = FIX.jumping;
    ai[c].rethinkAfter += 30;
  }
}

function chooseFlipsAndRolls(lift, c) {
  if (lift < 16) {
    ai[c].flip = -1;
    ai[c].flipAfter = 0;
    ai[c].flipReverses = false;
  } else {
    if (
      (random.sim() > random.sim() && ai[c].stuntPlan != STUNT_PLAN.roll) ||
      ai[c].stuntPlan == STUNT_PLAN.flipUp ||
      ai[c].stuntPlan == STUNT_PLAN.flipDown ||
      ai[c].stuntPlan == STUNT_PLAN.flipUpAtOnce
    ) {
      if (
        ai[c].stuntPlan == STUNT_PLAN.flipUpAtOnce &&
        racers[c].clearedPathPoint == 47 &&
        ai[c].oupnt == 0
      ) {
        ai[c].stuntPlan = STUNT_PLAN.flipDownAtOnce;
      }
      if (
        (random.sim() > random.sim() ||
          ai[c].stuntPlan == STUNT_PLAN.flipDown ||
          ai[c].stuntPlan == STUNT_PLAN.flipDownAtOnce) &&
        ai[c].stuntPlan != STUNT_PLAN.flipUp &&
        ai[c].stuntPlan != STUNT_PLAN.flipUpAtOnce
      ) {
        ai[c].flip = -1;
      } else {
        ai[c].flip = 1;
      }
      ai[c].flipAfter = Math.floor(10 * random.sim() * ai[c].stuntCaution);
      if (
        ai[c].stuntPlan == STUNT_PLAN.flipUpAtOnce ||
        ai[c].stuntPlan == STUNT_PLAN.flipDownAtOnce ||
        track.stage == 16
      ) {
        ai[c].flipAfter = 0;
      }
      if (
        random.sim() > 0.85 &&
        ai[c].stuntPlan != STUNT_PLAN.flipUp &&
        ai[c].stuntPlan != STUNT_PLAN.flipUpAtOnce &&
        ai[c].stuntPlan != STUNT_PLAN.flipDownAtOnce
      ) {
        ai[c].flipReverses = true;
      }
      if (
        random.sim() > ai[c].stuntCaution + 0.3 &&
        ai[c].stuntPlan != STUNT_PLAN.flipUp &&
        ai[c].stuntPlan != STUNT_PLAN.flipDown &&
        ai[c].stuntPlan != STUNT_PLAN.flipUpAtOnce &&
        ai[c].stuntPlan != STUNT_PLAN.flipDownAtOnce
      ) {
        if (random.sim() > random.sim()) {
          ai[c].roll = -1;
        } else {
          ai[c].roll = 1;
        }
        ai[c].rollAfter = Math.floor(30 * random.sim());
        if (random.sim() > 0.75) {
          ai[c].rollReverses = true;
        }
      }
    } else {
      if (random.sim() > random.sim()) {
        ai[c].roll = -1;
      } else {
        ai[c].roll = 1;
      }
      ai[c].rollAfter = Math.floor(10 * random.sim() * ai[c].stuntCaution);
      if (random.sim() > 0.75) {
        ai[c].rollReverses = true;
      }
      if (random.sim() > ai[c].stuntCaution + 0.3) {
        if (random.sim() > random.sim() || ai[c].stuntPlan == STUNT_PLAN.roll) {
          ai[c].flip = -1;
        } else {
          ai[c].flip = 1;
        }
        ai[c].flipAfter = Math.floor(30 * random.sim());
        if (random.sim() > 0.85) {
          ai[c].flipReverses = true;
        }
      }
    }
  }
}

function flyAndWaitForLanding(c) {
  ai[c].airTicks++;
  if (ai[c].roll != 0) {
    if (ai[c].airTicks > ai[c].rollAfter) {
      if (ai[c].rollReverses) {
        if (Math.abs(racers[c].roll - ai[c].takeoffXy) > 180) {
          if (ai[c].roll == -1) {
            ai[c].roll = 1;
          } else {
            ai[c].roll = -1;
          }
          ai[c].rollReverses = false;
        }
      }
      if (ai[c].roll == -1) {
        racers[c].u.handb = true;
        racers[c].u.left = true;
      } else {
        racers[c].u.handb = true;
        racers[c].u.right = true;
      }
    }
  }
  if (ai[c].flip != 0) {
    if (ai[c].airTicks > ai[c].flipAfter) {
      if (ai[c].flipReverses) {
        if (Math.abs(racers[c].pitch - ai[c].takeoffZy) > 180) {
          if (ai[c].flip == -1) {
            ai[c].flip = 1;
          } else {
            ai[c].flip = -1;
          }
          ai[c].flipReverses = false;
        }
      }
      if (ai[c].flip == -1) {
        racers[c].u.handb = true;
        racers[c].u.down = true;
      } else {
        racers[c].u.handb = true;
        racers[c].u.up = true;
      }
    }
  }
  if (
    ((racers[c].wheelSpeedY[0] +
      racers[c].wheelSpeedY[1] +
      racers[c].wheelSpeedY[2] +
      racers[c].wheelSpeedY[3]) *
      100) /
      (car[c].y + 5) <
    -ai[c].landingMargin
  ) {
    ai[c].pressedUp = false;
    ai[c].pressedDown = false;
    ai[c].pressedLeft = false;
    ai[c].pressedRight = false;
    ai[c].rollSettled = false;
    ai[c].pitchSettled = false;
    ai[c].straightenPitch = false;
    ai[c].straightenRoll = false;
    ai[c].stuntPhase = STUNT.landing;
    ai[c].landingStep = 0;
  }
}

function land(c) {
  if (ai[c].landingStep == 0) {
    if (racers[c].flipBackSpeed != 0 || racers[c].flipForwardSpeed != 0) {
      ai[c].straightenPitch = true;
    }
    if (racers[c].rollLeftSpeed != 0 || racers[c].rollRightSpeed != 0) {
      ai[c].straightenRoll = true;
    }
    ai[c].landingStep = 1;
  }
  if (racers[c].wheelsTouch) {
    if (ai[c].landingStep == 1) {
      ai[c].landingStep = 2;
    }
  } else {
    if (ai[c].landingStep == 2) {
      if (racers[c].capsized && random.sim() > ai[c].landingSloppiness) {
        if (ai[c].straightenPitch) {
          ai[c].straightenRoll = true;
          ai[c].straightenPitch = false;
        } else {
          if (ai[c].straightenRoll) {
            ai[c].straightenPitch = true;
            ai[c].straightenRoll = false;
          }
        }
      }
      ai[c].landingStep = 3;
    }
  }
  if (ai[c].straightenPitch) {
    straightenPitch(c);
  }
  if (ai[c].straightenRoll) {
    straightenRoll(c);
  }
}

function straightenPitch(c) {
  let pitch = racers[c].pitch + 90;
  while (pitch < 0) {
    pitch += 360;
  }
  while (pitch > 180) {
    pitch -= 360;
  }
  pitch = Math.abs(pitch);
  if (Math.abs(racers[c].rollLeftSpeed - racers[c].rollRightSpeed) < 5) {
    if (ai[c].pressedDown || ai[c].pressedUp) {
      ai[c].pitchSettled = true;
    }
  }
  if (racers[c].flipBackSpeed > racers[c].flipForwardSpeed) {
    if (racers[c].capsized) {
      if (ai[c].pitchSettled) {
        if (pitch < 90) {
          racers[c].u.up = true;
        } else {
          racers[c].u.down = true;
        }
      } else {
        if (!ai[c].pressedDown) {
          racers[c].u.down = true;
        }
      }
    } else {
      if (ai[c].pitchSettled) {
        if (ai[c].landsPerfectly && Math.abs(pitch - 90) > 30) {
          if (pitch < 90) {
            racers[c].u.up = true;
          } else {
            racers[c].u.down = true;
          }
        }
      } else {
        if (random.sim() > ai[c].landingSloppiness) {
          racers[c].u.up = true;
        }
      }
      ai[c].pressedDown = true;
    }
  } else {
    if (racers[c].capsized) {
      if (ai[c].pitchSettled) {
        if (pitch < 90) {
          racers[c].u.up = true;
        } else {
          racers[c].u.down = true;
        }
      } else {
        if (!ai[c].pressedUp) {
          racers[c].u.up = true;
        }
      }
    } else {
      if (ai[c].pitchSettled) {
        if (ai[c].landsPerfectly && Math.abs(pitch - 90) > 30) {
          if (pitch < 90) {
            racers[c].u.up = true;
          } else {
            racers[c].u.down = true;
          }
        }
      } else {
        if (random.sim() > ai[c].landingSloppiness) {
          racers[c].u.down = true;
        }
      }
      ai[c].pressedUp = true;
    }
  }
}

function straightenRoll(c) {
  let roll = racers[c].roll + 90;
  if (racers[c].u.zyinv) {
    roll += 180;
  }
  while (roll < 0) {
    roll += 360;
  }
  while (roll > 180) {
    roll -= 360;
  }
  roll = Math.abs(roll);
  if (Math.abs(racers[c].rollLeftSpeed - racers[c].rollRightSpeed) < 10) {
    if (ai[c].pressedLeft || ai[c].pressedRight) {
      ai[c].rollSettled = true;
    }
  }
  if (racers[c].rollLeftSpeed > racers[c].rollRightSpeed) {
    if (racers[c].capsized) {
      if (ai[c].rollSettled) {
        if (roll > 90) {
          racers[c].u.left = true;
        } else {
          racers[c].u.right = true;
        }
      } else {
        if (!ai[c].pressedLeft) {
          racers[c].u.left = true;
        }
      }
    } else {
      if (ai[c].rollSettled) {
        if (ai[c].landsPerfectly && Math.abs(roll - 90) > 30) {
          if (roll > 90) {
            racers[c].u.left = true;
          } else {
            racers[c].u.right = true;
          }
        }
      } else {
        if (random.sim() > ai[c].landingSloppiness) {
          racers[c].u.right = true;
        }
      }
      ai[c].pressedLeft = true;
    }
  } else {
    if (racers[c].capsized) {
      if (ai[c].rollSettled) {
        if (roll > 90) {
          racers[c].u.left = true;
        } else {
          racers[c].u.right = true;
        }
      } else {
        if (!ai[c].pressedRight) {
          racers[c].u.right = true;
        }
      }
    } else {
      if (ai[c].rollSettled) {
        if (ai[c].landsPerfectly && Math.abs(roll - 90) > 30) {
          if (roll > 90) {
            racers[c].u.left = true;
          } else {
            racers[c].u.right = true;
          }
        }
      } else {
        if (random.sim() > ai[c].landingSloppiness) {
          racers[c].u.left = true;
        }
      }
      ai[c].pressedRight = true;
    }
  }
}

function choosePathPoint(c, powbul, pnt) {
  const type = car[c].typ;
  if (
    !ai[c].bully ||
    ai[c].fixing == FIX.nearest ||
    ai[c].fixing == FIX.close ||
    ai[c].fixing == FIX.jumping ||
    racers[c].power < powbul
  ) {
    pnt = takeOrAvoidRamps(c, pnt);
    pnt = cutCorners(pnt, c);
    pnt = routeOnStage11(c, pnt);
    pnt = routeOnStage12(c, pnt);
    pnt = routeOnStage13(c, pnt, type);
    pnt = routeOnStage14(c, pnt, type);
    pnt = routeOnStage15(c, pnt);
    pnt = routeOnStage16(c, pnt);
    nearlyWastedInSwitchMode(c, type);
    pnt = stayBeforeRamp(c, pnt);
    if (ai[c].bully) {
      racers[c].nofocus = true;
      if (ai[c].goingToWait) {
        ai[c].goingToWait = false;
      }
    }
  } else {
    pnt = bullyPathPoint(c, pnt, type);
    racers[c].nofocus = true;
  }
  return pnt;
}

function takeOrAvoidRamps(c, pnt) {
  let tpnt;
  if (ai[c].rampChoice == RAMPS.take && track.typ[pnt] <= 0) {
    tpnt = pnt + 1;
    if (tpnt >= track.n) {
      tpnt = 0;
    }
    if (track.typ[tpnt] == RAMP_POINT) {
      pnt = tpnt;
    }
  }
  if (ai[c].rampChoice == RAMPS.avoid) {
    if (track.typ[pnt] == RAMP_POINT) {
      pnt++;
      if (pnt >= track.n) {
        pnt = 0;
      }
    }
  }
  return pnt;
}

function cutCorners(pnt, c) {
  let tpnt;
  if (track.stage != 9 || pnt != 0) {
    if (random.sim() > ai[c].cornerCutting) {
      tpnt = pnt;
      let notimpcp = false;
      if (track.typ[tpnt] > 0) {
        let ic = 0;
        for (let i = 0; i < track.n; i++) {
          if (track.typ[i] > 0 && i < tpnt) {
            ic++;
          }
        }
        notimpcp = racers[c].clear != ic + racers[c].nlaps * track.nsp;
      }
      while (
        track.typ[tpnt] == 0 ||
        track.typ[tpnt] == -1 ||
        track.typ[tpnt] == -3 ||
        notimpcp
      ) {
        pnt = tpnt;
        tpnt++;
        if (tpnt >= track.n) {
          tpnt = 0;
        }
        notimpcp = false;
        if (track.typ[tpnt] > 0) {
          let ic = 0;
          for (let i = 0; i < track.n; i++) {
            if (track.typ[i] > 0 && i < tpnt) {
              ic++;
            }
          }
          notimpcp = racers[c].clear != ic + racers[c].nlaps * track.nsp;
        }
      }
    } else {
      if (random.sim() > ai[c].cornerCutting) {
        while (track.typ[pnt] == -1) {
          pnt++;
          if (pnt >= track.n) {
            pnt = 0;
          }
        }
      }
    }
  }
  return pnt;
}

function routeOnStage11(c, pnt) {
  if (track.stage == 11) {
    if (racers[c].clearedPathPoint == 18 && pnt >= 26) {
      if (pnt <= 32) {
        pnt = 32;
      } else {
        pnt = 38;
      }
    }
    if (racers[c].clearedPathPoint == 67) {
      pnt = 74;
    }
  }
  return pnt;
}

function routeOnStage12(c, pnt) {
  if (track.stage == 12) {
    if (racers[c].clearedPathPoint == 27 || racers[c].clearedPathPoint == 37) {
      while (track.typ[pnt] == -1) {
        pnt++;
        if (pnt >= track.n) {
          pnt = 0;
        }
      }
    }
  }
  return pnt;
}

function routeOnStage13(c, pnt, type) {
  if (track.stage == 13) {
    if (
      racers[c].clearedPathPoint == 20 &&
      racers[c].focus == 36 &&
      car[c].y < 100
    ) {
      pnt = 30;
      if (
        distanceSquaredXZ(
          car[c].x / 10,
          track.x[30] / 10,
          car[c].z / 10,
          track.z[30] / 10,
        ) < 1000
      ) {
        racers[c].focus = -1;
      }
    }
    if (racers[c].clearedPathPoint == 20 && ai[c].fixing < FIX.nearest) {
      if (pnt >= 26 && pnt < 30) {
        pnt = 30;
      }
    }
    if (racers[c].clearedPathPoint == 52 && ai[c].fixing < FIX.nearest) {
      pnt = 60;
    }
    if (ai[c].fixing == FIX.close || ai[c].fixing == FIX.jumping) {
      racers[c].nofocus = true;
      if (pnt < 66) {
        pnt = 66;
      }
    }
    if (ai[c].fixing == FIX.onTheWay) {
      fixApproach[0] = 61;
    }
    if (ai[c].fixing == FIX.nearest) {
      fixApproach[0] = 65;
    }
    if ((100 * racers[c].damage) / carStats.maxmag[type] < 10) {
      ai[c].fixing = FIX.none;
    }
    if (ai[c].fixing == FIX.close) {
      ai[c].oupnt++;
      if (ai[c].oupnt == 300) {
        ai[c].fixing = FIX.none;
      }
    } else {
      if (ai[c].oupnt != 0) {
        ai[c].oupnt = 0;
      }
    }
  }
  return pnt;
}

function routeOnStage14(c, pnt, type) {
  if (track.stage == 14) {
    if (racers[c].clearedPathPoint == 47 && pnt > 58 && ai[c].oupnt == 0) {
      ai[c].oupnt = 1;
    }
    if (type != CAR.radicalOne || ai[c].attackedCar == 0) {
      while (track.typ[pnt] == -1) {
        pnt++;
        if (pnt >= track.n) {
          pnt = 0;
        }
      }
    }
  }
  return pnt;
}

function routeOnStage15(c, pnt) {
  if (track.stage == 15) {
    if (racers[c].clearedPathPoint == 10 && ai[c].fixing < FIX.nearest) {
      if (pnt != 18) {
        pnt = 18;
      }
    }
  }
  return pnt;
}

function routeOnStage16(c, pnt) {
  if (track.stage == 16) {
    if (ai[c].fixing != FIX.nearest && ai[c].fixing != FIX.close) {
      if (racers[c].clearedPathPoint == 152 && car[c].z < 2700) {
        pnt = 5;
      }
      if (racers[c].clearedPathPoint == 10 && car[c].x < 700) {
        pnt = 13;
      }
      if (racers[c].clearedPathPoint == 20) {
        if (car[c].z < 6200 && car[c].z > 3400) {
          pnt = 126;
        }
        if (car[c].z < 3400) {
          pnt = 35;
        }
      }
      if (
        racers[c].clearedPathPoint == 35 &&
        car[c].x < 6300 &&
        car[c].x > 4000
      ) {
        pnt = 116;
      }
      if (racers[c].clearedPathPoint == 55 && car[c].x < 4500) {
        pnt = 59;
      }
      if (racers[c].clearedPathPoint == 64) {
        pnt = 74;
      }
      if (racers[c].clearedPathPoint == 74) {
        pnt = 82;
      }
      if (racers[c].clearedPathPoint == 82) {
        pnt = 92;
      }
      if (racers[c].clearedPathPoint == 103) {
        pnt = 112;
      }
      if (racers[c].clearedPathPoint == 112 && car[c].x > 3200) {
        pnt = 120;
      }
      if (racers[c].clearedPathPoint == 120 && car[c].z > 2800) {
        pnt = 129;
      }
      if (racers[c].clearedPathPoint == 129) {
        pnt = 152;
      }
    }
    if (
      track.clear[c] - track.clear[aiRival()] >= 2 &&
      distanceSquaredXZ(
        car[c].x / 10,
        car[aiRival()].x / 10,
        car[c].z / 10,
        car[aiRival()].z / 10,
      ) <
        1000 + ai[c].avoidPlayerRange
    ) {
      let myxz = car[c].xz;
      if (racers[c].u.zyinv) {
        myxz += 180;
      }
      while (myxz < 0) {
        myxz += 360;
      }
      while (myxz > 180) {
        myxz -= 360;
      }
      let ad = 0;
      if (car[aiRival()].x - car[c].x >= 0) {
        ad = 180;
      }
      let pnxz = Math.floor(
        90 +
          ad +
          atan((car[aiRival()].z - car[c].z) / (car[aiRival()].x - car[c].x)) /
            0.017453292519943295,
      );
      while (pnxz < 0) {
        pnxz += 360;
      }
      while (pnxz > 180) {
        pnxz -= 360;
      }
      let vis = Math.abs(myxz - pnxz);
      if (vis > 180) {
        vis = Math.abs(vis - 360);
      }
      if (vis < 90) {
        racers[c].wall = 0;
      }
    }
  }
  return pnt;
}

function nearlyWastedInSwitchMode(c, type) {
  if (
    game.mode == MODE.switchCars &&
    (100 * racers[c].damage) / carStats.maxmag[type] > 85
  ) {
    let myxz = car[c].xz;
    if (racers[c].u.zyinv) {
      myxz += 180;
    }
    while (myxz < 0) {
      myxz += 360;
    }
    while (myxz > 180) {
      myxz -= 360;
    }
    for (let i = 0; i < game.carCount; i++) {
      if (i != c && track.clear[i] != -1) {
        if (
          distanceSquaredXZ(
            car[c].x / 10,
            car[i].x / 10,
            car[c].z / 10,
            car[i].z / 10,
          ) <
          1000 + ai[c].avoidPlayerRange
        ) {
          let ad = 0;
          if (car[i].x - car[c].x >= 0) {
            ad = 180;
          }
          let pnxz = Math.floor(
            90 +
              ad +
              atan((car[i].z - car[c].z) / (car[i].x - car[c].x)) /
                0.017453292519943295,
          );
          while (pnxz < 0) {
            pnxz += 360;
          }
          while (pnxz > 180) {
            pnxz -= 360;
          }
          let vis = Math.abs(myxz - pnxz);
          if (vis > 180) {
            vis = Math.abs(vis - 360);
          }
          if (vis < 45) {
            racers[c].wall = 0;
          }
          if ((100 * racers[c].damage) / carStats.maxmag[type] > 95) {
            if (vis < 90) {
              racers[c].wall = 0;
            }
          }
        }
      }
    }
  }
}

function stayBeforeRamp(c, pnt) {
  let tpnt;
  if (ai[c].rampChoice == RAMPS.stayBefore) {
    tpnt = pnt + 1;
    if (tpnt >= track.n) {
      tpnt = 0;
    }
    if (track.typ[tpnt] == RAMP_POINT && pnt != racers[c].point) {
      pnt--;
      if (pnt < 0) {
        pnt += track.n;
      }
    }
  }
  return pnt;
}

function bullyPathPoint(c, pnt, type) {
  if (track.stage != 15 || ai[c].runbul == 0) {
    pnt = pathPointBehind(pnt);
  }
  if (track.stage == 11) {
    if (pnt < 38 && pnt > 25) {
      pnt = 25;
    }
  }
  if (track.stage == 12) {
    bullyOnStage12(c);
  }
  if (track.stage == 15) {
    pnt = bullyOnStage15(c, pnt);
  }
  if (track.stage == 16) {
    pnt = bullyOnStage16(type, c, pnt);
  }
  return pnt;
}

function pathPointBehind(pnt) {
  pnt -= 2;
  if (pnt < 0) {
    pnt += track.n;
  }
  while (track.typ[pnt] == -4) {
    pnt--;
    if (pnt < 0) {
      pnt += track.n;
    }
  }
  return pnt;
}

function bullyOnStage12(c) {
  if (!ai[c].goingToWait) {
    if (track.clear[aiRival()] == 0) {
      ai[c].waitX = 350;
      ai[c].waitZ = 1900;
      ai[c].ambushX = 350;
      ai[c].ambushZ = 3900;
      ai[c].ambushRadius = 12000;
      ai[c].oupnt = 37;
      ai[c].goingToWait = true;
      ai[c].afta = false;
    }
    if (track.clear[aiRival()] == 7) {
      ai[c].waitX = 4480;
      ai[c].waitZ = 4032;
      ai[c].ambushX = 4480;
      ai[c].ambushZ = 3472;
      ai[c].ambushRadius = 30000;
      ai[c].oupnt = 27;
      ai[c].goingToWait = true;
      ai[c].afta = false;
    }
    if (track.clear[aiRival()] == 10) {
      ai[c].waitX = 0;
      ai[c].waitZ = 4873.9;
      ai[c].ambushX = 0;
      ai[c].ambushZ = 3858.9;
      ai[c].ambushRadius = 90000;
      ai[c].oupnt = 55;
      ai[c].goingToWait = true;
      ai[c].afta = false;
    }
    if (track.clear[aiRival()] == 14) {
      ai[c].waitX = 350;
      ai[c].waitZ = 1900;
      ai[c].ambushX = 1470;
      ai[c].ambushZ = 3900;
      ai[c].ambushRadius = 45000;
      ai[c].oupnt = 37;
      ai[c].goingToWait = true;
      ai[c].afta = false;
    }
    if (track.clear[aiRival()] == 18) {
      ai[c].waitX = 4830;
      ai[c].waitZ = -455;
      ai[c].ambushX = 4830;
      ai[c].ambushZ = 560;
      ai[c].ambushRadius = 90000;
      ai[c].oupnt = 17;
      ai[c].goingToWait = true;
      ai[c].afta = false;
    }
  }
  if (ai[c].goingToWait) {
    if (
      distanceSquaredXZ(
        car[c].x / 10,
        ai[c].waitX / 10,
        car[c].z / 10,
        ai[c].waitZ / 10,
      ) < 10000
    ) {
      if (racers[c].speed > 5) {
        racers[c].u.up = false;
      }
    }
    if (
      distanceSquaredXZ(
        car[c].x / 10,
        ai[c].waitX / 10,
        car[c].z / 10,
        ai[c].waitZ / 10,
      ) < 200
    ) {
      racers[c].u.up = false;
      racers[c].u.handb = true;
    }
    if (
      racers[aiRival()].clearedPathPoint == ai[c].oupnt &&
      distanceSquaredXZ(
        car[aiRival()].x / 10,
        ai[c].ambushX / 10,
        car[aiRival()].z / 10,
        ai[c].ambushZ / 10,
      ) < ai[c].ambushRadius
    ) {
      ai[c].afta = true;
      ai[c].goingToWait = false;
    }
    if (
      distanceSquaredXZ(
        car[c].x / 10,
        car[aiRival()].x / 10,
        car[c].z / 10,
        car[aiRival()].z / 10,
      ) < 25
    ) {
      ai[c].afta = true;
      ai[c].goingToWait = false;
      ai[c].attackTicks = 200;
      ai[c].attackedCar = 0;
    }
  }
}

function bullyOnStage15(c, pnt) {
  if (ai[c].oupnt == -1) {
    let pyclos = -10;
    for (let i = 0; i < track.n; i++) {
      if (track.typ[i] == RAMP_POINT && i < 71) {
        if (
          distanceSquaredXZ(
            car[c].x / 10,
            track.x[i] / 10,
            car[c].z / 10,
            track.z[i] / 10,
          ) < pyclos ||
          pyclos == -10
        ) {
          pyclos = distanceSquaredXZ(
            car[c].x / 10,
            track.x[i] / 10,
            car[c].z / 10,
            track.z[i] / 10,
          );
          ai[c].oupnt = i;
        }
      }
    }
    ai[c].oupnt--;
    if (ai[c].oupnt < 0) {
      ai[c].oupnt += track.n;
    }
  }
  if (ai[c].oupnt >= 0 && ai[c].oupnt < track.n) {
    pnt = ai[c].oupnt;
    if (
      distanceSquaredXZ(
        car[c].x / 10,
        track.x[pnt] / 10,
        car[c].z / 10,
        track.z[pnt] / 10,
      ) < 800
    ) {
      ai[c].oupnt = -Math.floor(75 + random.sim() * 200);
      ai[c].runbul = Math.floor(50 + random.sim() * 100);
    }
  }
  if (ai[c].oupnt < -1) {
    ai[c].oupnt++;
  }
  if (ai[c].runbul != 0) {
    ai[c].runbul--;
  }
  return pnt;
}

function bullyOnStage16(type, c, pnt) {
  if (type == CAR.elKing) {
    pnt = bullyAsElKingOnStage16(c, pnt);
  }
  if (type == CAR.masheen) {
    pnt = bullyAsMasheenOnStage16(c, pnt);
  }
  return pnt;
}

function bullyAsElKingOnStage16(c, pnt) {
  if (racers[c].power > 60) {
    let i = racers[aiRival()].clearedPathPoint;
    let found = -1;
    while (found == -1) {
      i++;
      if (i >= track.n) {
        i -= track.n;
        found = 152;
      }
      if (track.typ[i] == 1 || track.typ[i] == 2) {
        found = i;
      }
    }
    if (found == 129) {
      found = 152;
    }
    if (
      distanceSquaredXZ(
        car[c].x / 10,
        track.x[found] / 10,
        car[c].z / 10,
        track.z[found] / 10,
      ) < 1000
    ) {
      ai[c].attackedCar = 0;
      ai[c].leadAhead = 1;
      ai[c].attackTicks = 100;
    }
    pnt = found;
  } else {
    let pyclos = -10;
    for (let i = 0; i < track.n; i++) {
      if (
        pieces.list[track.obi[i]].typ == PIECE.offramp ||
        pieces.list[track.obi[i]].typ == PIECE.sofframp ||
        pieces.list[track.obi[i]].typ == PIECE.offhill ||
        pieces.list[track.obi[i]].typ == PIECE.uphill
      ) {
        if (
          distanceSquaredXZ(
            car[c].x / 10,
            track.x[i] / 10,
            car[c].z / 10,
            track.z[i] / 10,
          ) < pyclos ||
          pyclos == -10
        ) {
          pyclos = distanceSquaredXZ(
            car[c].x / 10,
            track.x[i] / 10,
            car[c].z / 10,
            track.z[i] / 10,
          );
          pnt = i;
        }
      }
    }
  }
  return pnt;
}

function bullyAsMasheenOnStage16(c, pnt) {
  if (!ai[c].goingToWait) {
    if (
      racers[aiRival()].clearedPathPoint == 152 ||
      racers[aiRival()].clearedPathPoint == 10 ||
      racers[aiRival()].clearedPathPoint == 20
    ) {
      ai[c].waitX = 820;
      ai[c].waitZ = 120;
      ai[c].ambushX = 1364;
      ai[c].ambushZ = 218;
      ai[c].ambushRadius = 50000;
      ai[c].oupnt = 35;
      ai[c].goingToWait = true;
      ai[c].afta = false;
      ai[c].runbul = 1;
    }
    if (
      racers[aiRival()].clearedPathPoint == 45 ||
      racers[aiRival()].clearedPathPoint == 55
    ) {
      if (racers[c].power > 60) {
        ai[c].waitX = 3000;
        ai[c].waitZ = 1600;
        ai[c].ambushX = 4206;
        ai[c].ambushZ = 1365;
        ai[c].ambushRadius = 30000;
        ai[c].oupnt = 64;
        ai[c].goingToWait = true;
        ai[c].afta = false;
        ai[c].runbul = 1;
      } else {
        pnt = 73;
      }
    }
    if (
      racers[aiRival()].clearedPathPoint == 92 ||
      racers[aiRival()].clearedPathPoint == 103
    ) {
      if (racers[c].power > 60) {
        ai[c].waitX = 6408.2;
        ai[c].waitZ = 1571.4;
        ai[c].ambushX = 6184;
        ai[c].ambushZ = 780;
        ai[c].ambushRadius = 90000;
        ai[c].oupnt = 112;
        ai[c].goingToWait = true;
        ai[c].afta = false;
        ai[c].runbul = 0;
      } else {
        pnt = 73;
      }
    }
    if (racers[aiRival()].clearedPathPoint == 112 && ai[c].oupnt == 112) {
      ai[c].ticksSinceRethink = 0;
      ai[c].rethinkAfter = 10;
      if (
        distanceSquaredXZ(
          car[c].x / 10,
          ai[c].ambushX / 10,
          car[c].z / 10,
          ai[c].ambushZ / 10,
        ) < 100
      ) {
        ai[c].attackTicks = 200;
        ai[c].attackedCar = 0;
        ai[c].leadAhead = 0.7;
        ai[c].oupnt = -1;
      }
    }
  }
  if (ai[c].goingToWait) {
    if (
      distanceSquaredXZ(
        car[c].x / 10,
        ai[c].waitX / 10,
        car[c].z / 10,
        ai[c].waitZ / 10,
      ) < 10000
    ) {
      if (racers[c].speed > 5) {
        racers[c].u.up = false;
      }
    }
    if (
      distanceSquaredXZ(
        car[c].x / 10,
        ai[c].waitX / 10,
        car[c].z / 10,
        ai[c].waitZ / 10,
      ) < 200
    ) {
      racers[c].u.up = false;
      racers[c].u.handb = true;
    }
    if (
      racers[aiRival()].clearedPathPoint == ai[c].oupnt &&
      distanceSquaredXZ(
        car[aiRival()].x / 10,
        ai[c].ambushX / 10,
        car[aiRival()].z / 10,
        ai[c].ambushZ / 10,
      ) < ai[c].ambushRadius
    ) {
      ai[c].afta = true;
      ai[c].goingToWait = false;
      if (ai[c].runbul) {
        ai[c].attackTicks = 200;
        ai[c].attackedCar = 0;
        ai[c].leadAhead = 0.7;
      }
    }
    if (
      distanceSquaredXZ(
        car[c].x / 10,
        car[aiRival()].x / 10,
        car[c].z / 10,
        car[aiRival()].z / 10,
      ) < 25
    ) {
      ai[c].afta = true;
      ai[c].goingToWait = false;
      ai[c].attackTicks = 200;
      ai[c].attackedCar = 0;
    }
  }
  return pnt;
}

function rethink(c) {
  chooseAimLag(c);
  chooseHoldBack(c);
  chooseCornerCutting(c);
  chooseRamps(c);
  chooseTurnStyle(c);
  chooseLandingCare(c);
  chooseStuntPlan(c);
  chooseStuntCaution(c);
  chooseLandingHabits(c);
  chooseWhomToAttack(c);
  chooseWhetherToFix(c);
  chooseWhetherToBully(c);
  ai[c].ticksSinceRethink = 0;
  ai[c].rethinkAfter = Math.floor(20 * random.sim());
}

function chooseAimLag(c) {
  let tstage = track.stage;
  ai[c].aimLag = Math.floor((7 - rank(c)) * rank(aiRival()) * (6 - tstage * 2));
  if (ai[c].aimLag < 0) {
    ai[c].aimLag = 0;
  }
  ai[c].steerTolerance = 5;
  if (track.stage == 6 || track.stage == 11) {
    ai[c].steerTolerance = 2;
  }
  if (track.stage == 12) {
    if (racers[c].clearedPathPoint == 27 || racers[c].clearedPathPoint == 17) {
      ai[c].steerTolerance = 3;
    }
  }
  if (track.stage == 16) {
    ai[c].steerTolerance = 3;
  }
}

function chooseHoldBack(c) {
  const type = car[c].typ;
  let holdBackScale = 0;
  if (track.stage == 1) {
    holdBackScale = 2;
  }
  if (track.stage == 2) {
    holdBackScale = 1.5;
  }
  if (track.stage == 3 && type != CAR.swordOfJustice) {
    holdBackScale = 0.5;
  }
  if (track.stage == 4) {
    holdBackScale = 0.5;
  }
  ai[c].holdBack = Math.floor(
    (rank(aiRival()) - rank(c)) *
      (rank(aiRival()) - rank(c)) *
      (rank(aiRival()) - rank(c)) *
      holdBackScale,
  );
  if (ai[c].holdBack > 80) {
    ai[c].holdBack = 80;
  }
  if (track.stage == 1) {
    if (ai[c].holdBack < 20) {
      ai[c].holdBack = 20;
    }
  }
}

function chooseCornerCutting(c) {
  const type = car[c].typ;
  let maxCutting = 0;
  if (track.stage == 1 || track.stage == 2) {
    maxCutting = 1;
  }
  if (track.stage == 3) {
    maxCutting = 0.5;
  }
  if (track.stage == 4) {
    maxCutting = 0.5;
  }
  if (track.stage == 5) {
    maxCutting = 0.2;
  }
  if (track.pos[c] - track.pos[aiRival()] >= -1) {
    ai[c].cornerCutting -= 0.1;
    if (ai[c].cornerCutting < 0) {
      ai[c].cornerCutting = 0;
    }
  } else {
    ai[c].cornerCutting += 0.2;
    if (ai[c].cornerCutting > maxCutting) {
      ai[c].cornerCutting = maxCutting;
    }
  }
  if (track.stage == 9 || track.stage == 12) {
    ai[c].cornerCutting = 1;
  }
  if (track.stage == 11) {
    ai[c].cornerCutting = 0;
    if (racers[c].clearedPathPoint == 89 || racers[c].clearedPathPoint == 18) {
      ai[c].cornerCutting = 1;
    }
    if (racers[c].clearedPathPoint == 45 || racers[c].clearedPathPoint == 52) {
      ai[c].cornerCutting = 0.5;
    }
  }
  if (track.stage == 13 && racers[c].clearedPathPoint == 20) {
    ai[c].cornerCutting = 1;
  }
  if (track.stage == 14) {
    ai[c].cornerCutting = 1;
    if (type == CAR.radicalOne) {
      if (random.sim() > 0.8) {
        ai[c].attackedCar = 1;
      } else {
        ai[c].attackedCar = 0;
      }
    }
  }
  if (track.stage == 15) {
    ai[c].cornerCutting = 0;
  }
  if (track.stage == 16) {
    if (racers[c].clearedPathPoint >= 45) {
      ai[c].cornerCutting = 0;
    } else {
      ai[c].cornerCutting = 1;
    }
  }
  if (
    game.mode == MODE.switchCars &&
    (100 * racers[c].damage) / carStats.maxmag[type] > 85
  ) {
    ai[c].cornerCutting = 0;
  }
}

function chooseRamps(c) {
  ai[c].rampChoice = Math.floor(random.sim() * 4 - 2);
  if (ai[c].rampChoice == RAMPS.stayBefore) {
    ai[c].rampChoice = RAMPS.take;
  }
  if (racers[c].power == 98) {
    ai[c].rampChoice = RAMPS.avoid;
  }
  if (racers[c].power < 75 && ai[c].rampChoice == RAMPS.avoid) {
    ai[c].rampChoice = RAMPS.either;
  }
  if (racers[c].power < 60) {
    ai[c].rampChoice = RAMPS.take;
  }
  if (track.stage == 11) {
    if (racers[c].clearedPathPoint == 18) {
      ai[c].rampChoice = RAMPS.stayBefore;
    }
  }
  if (track.stage == 12) {
    if (racers[c].clearedPathPoint == 17) {
      ai[c].rampChoice = RAMPS.stayBefore;
    }
  }
  if (track.stage == 15 || track.stage == 16) {
    ai[c].rampChoice = RAMPS.either;
  }
}

function chooseTurnStyle(c) {
  const type = car[c].typ;
  if (ai[c].turnStyleTicks == 0) {
    ai[c].gasInTurns = false;
    ai[c].sharpTurn = Math.floor(random.sim() * 4);
    if (track.stage == 3 && type == CAR.swordOfJustice) {
      ai[c].sharpTurn = SHARP_TURN.brake;
      if (ai[c].attackTicks == 0) {
        ai[c].gasInTurns = true;
      }
    }
    if (track.pos[aiRival()] - track.pos[c] < 0 || track.stage == 10) {
      ai[c].sharpTurn = Math.floor(random.sim() * 2);
      if (ai[c].sharpTurn == SHARP_TURN.handbrake) {
        ai[c].sharpTurn = SHARP_TURN.brake;
      }
    }
    if (track.stage == 11) {
      if (racers[c].clearedPathPoint == 89) {
        if (racers[c].point >= 5) {
          ai[c].sharpTurn = SHARP_TURN.handbrake;
        } else {
          ai[c].sharpTurn = SHARP_TURN.steer;
        }
      }
      if (racers[c].clearedPathPoint == 9) {
        ai[c].sharpTurn = SHARP_TURN.handbrake;
      }
    }
    if (track.stage == 13) {
      if (
        racers[c].clearedPathPoint == 20 ||
        racers[c].clearedPathPoint == 36 ||
        racers[c].clearedPathPoint == 52
      ) {
        ai[c].sharpTurn = SHARP_TURN.brake;
      } else {
        if (ai[c].sharpTurn == SHARP_TURN.liftGas) {
          ai[c].sharpTurn = SHARP_TURN.brake;
        }
      }
    }
    if (track.stage == 14) {
      ai[c].sharpTurn = SHARP_TURN.steer;
    }
    if (ai[c].attackTicks != 0) {
      ai[c].sharpTurn = SHARP_TURN.handbrake;
      if (
        track.stage == 9 ||
        track.stage == 11 ||
        track.stage == 13 ||
        track.stage == 16 ||
        track.stage == 17
      ) {
        ai[c].sharpTurn = Math.floor(random.sim() * 3);
        if (ai[c].sharpTurn == SHARP_TURN.liftGas) {
          ai[c].sharpTurn = SHARP_TURN.handbrake;
        }
      }
      if (track.stage == 16) {
        if (type == CAR.elKing) {
          ai[c].sharpTurn = SHARP_TURN.steer;
        }
      }
    }
    if (
      track.stage == 6 ||
      track.stage == 7 ||
      track.stage == 8 ||
      track.stage == 10 ||
      track.stage == 11 ||
      track.stage == 12 ||
      track.stage == 14 ||
      track.stage == 16 ||
      track.stage == 17
    ) {
      ai[c].gasInTurns = true;
    }
    ai[c].turnStyleTicks = 5;
  } else {
    ai[c].turnStyleTicks--;
  }
}

function chooseLandingCare(c) {
  const type = car[c].typ;
  ai[c].landingMargin = Math.floor(
    (98 - racers[c].power) * 0.5 * (random.sim() * 0.5 + 0.5),
  );
  if (ai[c].landingMargin > 20) {
    ai[c].landingMargin = 20;
  }
  let sloppiness = 0;
  if (track.stage == 1) {
    sloppiness = 0.9;
  }
  if (track.stage == 2) {
    sloppiness = 0.7;
  }
  if (track.stage == 3) {
    sloppiness = 0.4;
  }
  ai[c].landingSloppiness = sloppiness + (random.sim() / 2 - 0.25);
  let marginScale = 1;
  if (track.stage == 1) {
    marginScale = 5;
  }
  if (track.stage == 2) {
    marginScale = 2;
  }
  if (track.stage == 3) {
    marginScale = 1.5;
  }
  if (racers[c].power > 50) {
    if (track.pos[aiRival()] - track.pos[c] > 0) {
      ai[c].landingMargin *= marginScale;
    } else {
      ai[c].landingSloppiness = 0;
    }
  } else {
    ai[c].landingSloppiness -= 0.5;
  }
  if (track.stage == 6) {
    if (type == CAR.highRider) {
      ai[c].landingSloppiness = 0;
    }
  }
  if (
    track.stage == 8 ||
    track.stage == 10 ||
    track.stage == 12 ||
    track.stage == 14 ||
    track.stage == 16
  ) {
    ai[c].landingSloppiness = 0;
  }
}

function chooseStuntPlan(c) {
  const type = car[c].typ;
  ai[c].stuntPlan = STUNT_PLAN.free;
  if (track.stage == 10) {
    if (
      track.pos[c] - track.pos[aiRival()] > 1 ||
      random.sim() > random.sim()
    ) {
      ai[c].stuntPlan = STUNT_PLAN.flipUp;
      ai[c].landingMargin = 10;
    } else {
      ai[c].stuntPlan = STUNT_PLAN.flipDown;
    }
  }
  if (track.stage == 11 && racers[c].clearedPathPoint == 18) {
    ai[c].stuntPlan = STUNT_PLAN.flipDown;
  }
  if (track.stage == 11 && type == CAR.masheen) {
    ai[c].stuntPlan = STUNT_PLAN.roll;
  }
  if (track.stage == 14) {
    if (type == CAR.radicalOne) {
      ai[c].stuntPlan = STUNT_PLAN.flipUpAtOnce;
      ai[c].landingMargin = 20;
    } else {
      ai[c].landingMargin = 10;
      if (racers[c].clearedPathPoint == 47) {
        ai[c].stuntPlan = STUNT_PLAN.flipDown;
      }
    }
  }
  if (track.stage == 16) {
    ai[c].landingSloppiness = 0;
    ai[c].landingMargin = 20;
    if (racers[c].clearedPathPoint == 152 || racers[c].clearedPathPoint == 20) {
      ai[c].stuntPlan = STUNT_PLAN.flipDown;
    }
    if (racers[c].clearedPathPoint == 35) {
      ai[c].stuntPlan = STUNT_PLAN.flipUp;
    }
    if (racers[c].clearedPathPoint == 112) {
      ai[c].stuntPlan = STUNT_PLAN.flipUp;
    }
    if (racers[c].clearedPathPoint == 120) {
      ai[c].stuntPlan = STUNT_PLAN.flipDown;
    }
    ai[c].avoidPlayerRange = Math.floor(2700 * random.sim());
  }
  if (game.mode == MODE.switchCars) {
    ai[c].avoidPlayerRange = Math.floor(2700 * random.sim());
  }
}

function chooseStuntCaution(c) {
  const type = car[c].typ;
  ai[c].stuntCaution = (racers[c].power - 38) / 50 - random.sim() * 0.5;
  if (racers[c].power < 60) {
    ai[c].stuntCaution = -1;
  }
  if (track.stage == 3 && type == CAR.swordOfJustice) {
    if (ai[c].stuntCaution > 0.7) {
      ai[c].stuntCaution = 0.7;
    }
  }
  if (track.stage == 6 && type != CAR.highRider) {
    if (ai[c].stuntCaution > 0.3) {
      ai[c].stuntCaution = 0.3;
    }
  }
  if (track.stage == 8) {
    if (ai[c].stuntCaution > 0.2) {
      ai[c].stuntCaution = 0.2;
    }
  }
  if (track.stage == 11) {
    if (ai[c].stuntCaution != -1) {
      ai[c].stuntCaution *= 0.75;
    }
  }
  if (track.stage == 12) {
    if (racers[c].clearedPathPoint == 55 || racers[c].clearedPathPoint == 7) {
      ai[c].stuntCaution = -1;
    }
  }
  if (track.stage == 14) {
    if (ai[c].stuntCaution > 0.5) {
      ai[c].stuntCaution = 0.5;
    }
  }
  if (track.stage == 17) {
    ai[c].stuntCaution = -1;
  }
}

function chooseLandingHabits(c) {
  const type = car[c].typ;
  if (random.sim() > racers[c].power / 100) {
    ai[c].groundByWheels = true;
  } else {
    ai[c].groundByWheels = false;
  }
  if (track.stage == 4) {
    ai[c].groundByWheels = true;
  }
  if (track.stage == 6) {
    if (type == CAR.highRider) {
      ai[c].groundByWheels = false;
    } else {
      ai[c].groundByWheels = true;
    }
  }
  if (track.stage == 9 || track.stage == 10 || track.stage == 14) {
    ai[c].groundByWheels = false;
  }
  if (random.sim() > racers[c].damage / carStats.maxmag[type]) {
    ai[c].landsPerfectly = false;
  } else {
    ai[c].landsPerfectly = true;
  }
  if ((100 * racers[c].damage) / carStats.maxmag[type] > 60) {
    ai[c].landsPerfectly = true;
  }
  if (track.stage == 3 && type == CAR.swordOfJustice) {
    ai[c].landsPerfectly = true;
  }
  if (
    track.stage == 6 ||
    track.stage == 8 ||
    track.stage == 10 ||
    track.stage == 11 ||
    track.stage == 12 ||
    track.stage == 14 ||
    track.stage == 16 ||
    track.stage == 17
  ) {
    ai[c].landsPerfectly = true;
  }
  if (track.stage == 15 && type == CAR.drMonstaa) {
    ai[c].landsPerfectly = true;
  }
}

function chooseWhetherToFix(c) {
  const type = car[c].typ;
  let norunfix = false;
  if (
    track.stage == 6 ||
    track.stage == 10 ||
    track.stage == 11 ||
    track.stage == 14
  ) {
    norunfix = true;
  }
  if (track.stage == 8 && type != CAR.elKing) {
    norunfix = true;
  }
  if (track.stage == 15 && !ai[c].bully) {
    norunfix = true;
  }
  if (track.stage == 17) {
    norunfix = true;
  }
  if (game.mode != MODE.switchCars) {
    if (ai[c].fixing != FIX.close) {
      ai[c].fixing = FIX.none;
      let trunfix = 50;
      if (track.stage == 16) {
        trunfix = 100;
      }
      if ((100 * racers[c].damage) / carStats.maxmag[type] > trunfix) {
        ai[c].fixing = FIX.onTheWay;
      }
      if (!norunfix) {
        let runfix = 80;
        if (track.stage == 9) {
          runfix = 70;
        }
        if ((100 * racers[c].damage) / carStats.maxmag[type] > runfix) {
          ai[c].fixing = FIX.nearest;
        }
      }
    } else {
      ai[c].holdBack = 0;
      ai[c].aimLag = 0;
      ai[c].cornerCutting = 1;
      ai[c].steerTolerance = 2;
    }
  }
}

function chooseWhetherToBully(c) {
  const type = car[c].typ;
  if (!ai[c].bully) {
    if (track.stage == 8 && type == CAR.elKing) {
      ai[c].bully = true;
    }
    if (track.stage == 11 && type == CAR.masheen) {
      ai[c].bully = true;
    }
    if (track.stage == 12 && type == CAR.masheen) {
      ai[c].bully = true;
    }
    if (
      track.stage == 15 &&
      track.clear[aiRival()] - track.clear[c] >= 2 &&
      ai[c].fixing == FIX.none
    ) {
      ai[c].bully = true;
      ai[c].oupnt = -1;
    }
    if (track.stage == 16) {
      if (type == CAR.elKing && track.clear[c] >= 1) {
        ai[c].bully = true;
      }
      if (type == CAR.masheen) {
        ai[c].bully = true;
      }
    }
    if (
      (track.stage == 5 ||
        track.stage == 6 ||
        track.stage == 8 ||
        track.stage == 10 ||
        track.stage == 14) &&
      track.stage != game.unlocked
    ) {
      if (
        type == CAR.masheen &&
        Math.abs(track.clear[aiRival()] - racers[c].clear) >= 2
      ) {
        ai[c].bully = true;
      }
    }
  } else {
  }
}

function chooseWhomToAttack(c) {
  const type = car[c].typ;
  if (ai[c].attackTicks == 0) {
    const swervesAway = swervesFromCars(c);
    const onlyPlayer = attacksOnlyThePlayer(type);
    const powerToAttack = powerNeededToAttack(c, type, onlyPlayer);
    for (let other = 0; other < game.carCount; other++) {
      if (other != c && track.clear[other] != -1) {
        considerAttacking(
          c,
          other,
          type,
          onlyPlayer,
          powerToAttack,
          swervesAway,
        );
      }
    }
  }
}

function considerAttacking(
  c,
  other,
  type,
  onlyPlayer,
  powerToAttack,
  swervesAway,
) {
  let heading = car[c].xz;
  if (racers[c].u.zyinv) {
    heading += 180;
  }
  while (heading < 0) {
    heading += 360;
  }
  while (heading > 180) {
    heading -= 360;
  }
  let halfTurn = 0;
  if (car[other].x - car[c].x >= 0) {
    halfTurn = 180;
  }
  let headingToOther =
    90 +
    halfTurn +
    atan((car[other].z - car[c].z) / (car[other].x - car[c].x)) /
      0.017453292519943295;
  while (headingToOther < 0) {
    headingToOther += 360;
  }
  while (headingToOther > 180) {
    headingToOther -= 360;
  }
  let angleOff = Math.abs(heading - headingToOther);
  if (angleOff > 180) {
    angleOff = Math.abs(angleOff - 360);
  }
  let attackRange = 2000 * (Math.abs(track.clear[other] - racers[c].clear) + 1);
  if (track.stage == 3 && type == CAR.swordOfJustice) {
    if (attackRange < 12000) {
      attackRange = 12000;
    }
  }
  if (track.stage == 4) {
    if (attackRange < 4000) {
      attackRange = 4000;
    }
  }
  if (track.stage == 8 && type == CAR.elKing) {
    if (attackRange < 12000) {
      attackRange = 12000;
    }
    angleOff = 10;
  }
  if (track.stage == 9) {
    if (onlyPlayer && attackRange < 12000) {
      attackRange = 12000;
    }
  }
  if (track.stage == 11) {
    if (ai[c].bully) {
      attackRange = 8000;
      angleOff = 10;
      ai[c].afta = true;
    } else {
      if (attackRange < 6000) {
        attackRange = 6000;
      }
    }
  }
  if (track.stage == 12 && ai[c].bully) {
    attackRange = 6000;
    angleOff = 10;
  }
  if (track.stage == 13) {
    if (track.clear[c] - track.clear[aiRival()] > 3) {
      attackRange = 21000;
    }
  }
  if (track.stage == 15) {
    attackRange *= Math.abs(track.clear[other] - racers[c].clear) + 1;
    if (ai[c].bully) {
      attackRange = 4000 * (Math.abs(track.clear[other] - racers[c].clear) + 1);
      angleOff = 10;
    }
  }
  if (track.stage == 16) {
    if (type == CAR.elKing) {
      attackRange = 16000;
      angleOff = 10;
    }
    if (type == CAR.masheen) {
      attackRange = 6000;
      angleOff = 10;
    }
    if (type == CAR.drMonstaa || type == CAR.swordOfJustice) {
      attackRange *= Math.abs(track.clear[other] - racers[c].clear) + 1;
    }
  }
  const sight = sightAngle(onlyPlayer, c, type, other);
  if (
    angleOff < sight &&
    distanceSquaredXZ(
      car[c].x / 10,
      car[other].x / 10,
      car[c].z / 10,
      car[other].z / 10,
    ) < attackRange &&
    ai[c].afta &&
    racers[c].power > powerToAttack
  ) {
    let closeness = 35 - Math.abs(track.clear[other] - racers[c].clear) * 10;
    if (closeness < 1) {
      closeness = 1;
    }
    let chance = ((rank(c) + 1) * (7 - rank(other))) / closeness;
    chance = attackChance(chance, other, c, onlyPlayer, type, heading);
    if (random.sim() < chance) {
      startAttack(c, other, type, onlyPlayer);
    }
  }
  if (
    swervesAway &&
    angleOff > 100 &&
    distanceSquaredXZ(
      car[c].x / 10,
      car[other].x / 10,
      car[c].z / 10,
      car[other].z / 10,
    ) < 300 &&
    random.sim() > 0.6 - rank(c) / 10
  ) {
    ai[c].steerTolerance = 0;
    ai[c].aimLag = 0;
  }
}

function swervesFromCars(c) {
  let swervesAway = true;
  if (
    track.stage == 3 ||
    track.stage == 1 ||
    track.stage == 4 ||
    track.stage == 9 ||
    track.stage == 13 ||
    track.stage == 16
  ) {
    swervesAway = ai[c].afta;
  }
  if (
    track.stage == 6 ||
    track.stage == 8 ||
    track.stage == 10 ||
    track.stage == 14
  ) {
    swervesAway = false;
  }
  return swervesAway;
}

function attacksOnlyThePlayer(type) {
  let onlyPlayer = false;
  if (track.stage == 3 && type == CAR.swordOfJustice) {
    onlyPlayer = true;
  }
  if (track.stage == 8 && type == CAR.elKing) {
    onlyPlayer = true;
  }
  if (
    track.stage == 9 &&
    track.clear[aiRival()] >= 8 &&
    track.pos[aiRival()] == 0
  ) {
    onlyPlayer = true;
  }
  if (
    track.stage == 11 ||
    track.stage == 12 ||
    track.stage == 13 ||
    track.stage == 15 ||
    track.stage == 16
  ) {
    onlyPlayer = true;
  }
  return onlyPlayer;
}

function powerNeededToAttack(c, type, onlyPlayer) {
  let power = 60;
  if (track.stage == 3 || track.stage == 17) {
    power = 30;
  }
  if (track.stage == 4) {
    power = 20;
  }
  if (track.stage == 5 && c != boss()) {
    power = 40;
  }
  if ((track.stage == 2 || track.stage == 13) && type == CAR.masheen) {
    power = 50;
  }
  if (track.stage == 7) {
    power = 40;
  }
  if (track.stage == 8 && type == CAR.elKing) {
    power = 40;
  }
  if (track.stage == 9 && onlyPlayer) {
    power = 30;
  }
  if (track.stage == 11 && ai[c].bully) {
    power = 30;
  }
  if (track.stage == 12) {
    power = 50;
  }
  if (track.stage == 15 && ai[c].bully) {
    power = 40;
  }
  if (track.stage == 16) {
    if (type == CAR.elKing) {
      power = 40;
    }
    if (type == CAR.masheen) {
      power = 50;
    }
    if (type == CAR.drMonstaa || type == CAR.swordOfJustice) {
      power = 50;
    }
    if (track.pos[aiRival()] > track.pos[c]) {
      power = 80;
    }
  }
  return power;
}

function sightAngle(onlyPlayer, c, type, other) {
  let sight = 85 + 15 * (Math.abs(track.clear[other] - racers[c].clear) + 1);
  if (track.stage == 9 && !onlyPlayer) {
    if (
      car[aiRival()].typ != CAR.elKing ||
      track.clear[c] - track.clear[aiRival()] < 8
    ) {
      sight = 45;
    }
  }
  if (track.stage == 13) {
    sight = 45;
  }
  if (track.stage == 16) {
    if (
      type == CAR.drMonstaa ||
      type == CAR.swordOfJustice ||
      type == CAR.radicalOne
    ) {
      sight = 50 + 70 * Math.abs(track.clear[other] - racers[c].clear);
    }
  }
  return sight;
}

function attackChance(chance, other, c, onlyPlayer, type, heading) {
  if (game.mode != MODE.switchCars) {
    if (track.stage != 17) {
      if (chance > 0.7) {
        chance = 0.7;
      }
    }
    if (other != aiRival() && track.pos[aiRival()] < track.pos[c]) {
      chance = 0;
    }
    if (other != aiRival() && onlyPlayer) {
      chance = 0;
    }
    if (track.stage == 3) {
      if (type == CAR.swordOfJustice || (type == CAR.masheen && ai[c].bully)) {
        chance *= 2;
      } else {
        chance *= 0.5;
      }
    }
    if (track.stage == 5 && c == boss()) {
      chance *= 0.7;
    }
    if (track.stage == 6) {
      chance = 0;
    }
    if (track.stage == 7 && c == boss() && other == aiRival()) {
      chance *= 1.5;
    }
    if (track.stage == 8) {
      if (ai[c].bully && other == aiRival()) {
        chance = 1;
      } else {
        chance = 0;
      }
    }
    if (track.stage == 10) {
      chance = 0;
    }
    if (track.stage == 11) {
      if (ai[c].bully && other == aiRival()) {
        chance = 1;
      }
      if (
        track.pos[c] == 0 ||
        (track.pos[c] == 1 && track.pos[aiRival()] == 0)
      ) {
        chance = 0;
      }
    }
    if (track.stage == 12) {
      if (type != CAR.elKing && type != CAR.masheen) {
        chance = 0;
      }
      if ((type == CAR.masheen || type == CAR.elKing) && other == aiRival()) {
        chance = 1;
      }
    }
    if (track.stage == 14) {
      chance = 0;
    }
    if (track.stage == 15) {
      if (track.pos[c] == 0) {
        chance *= 0.5;
      }
      if (track.pos[aiRival()] < track.pos[c]) {
        chance *= 2;
      }
      if (ai[c].bully && other == aiRival()) {
        chance = 1;
      }
    }
    if (track.stage == 16) {
      if (type != CAR.radicalOne) {
        if (track.pos[aiRival()] < track.pos[c]) {
          if (track.clear[aiRival()] - track.clear[c] != 1) {
            chance *= 2;
          }
        }
      } else {
        chance *= 0.5;
      }
      if (
        (type == CAR.elKing || type == CAR.masheen) &&
        other == aiRival() &&
        ai[c].bully
      ) {
        chance = 1;
      }
      if (
        track.pos[c] == 0 ||
        (track.pos[c] == 1 && track.pos[aiRival()] == 0)
      ) {
        chance = 0;
      }
      if (track.clear[c] - track.clear[aiRival()] >= 5 && other == aiRival()) {
        chance = 1;
      }
      if (
        type == CAR.shadowRider ||
        type == CAR.highRider ||
        type == CAR.mightyEight
      ) {
        chance = 0;
      }
    }
  } else {
    let otherHeading = car[other].xz;
    if (racers[other].u.zyinv) {
      otherHeading += 180;
    }
    while (otherHeading < 0) {
      otherHeading += 360;
    }
    while (otherHeading > 180) {
      otherHeading -= 360;
    }
    if (Math.abs(Math.abs(heading - otherHeading) - 180) < 45) {
      chance = 1;
    }
    if ((100 * racers[c].damage) / carStats.maxmag[type] > 80) {
      chance = 0;
    }
  }
  return chance;
}

function startAttack(c, other, type, onlyPlayer) {
  ai[c].attackTicks = 40 * (Math.abs(track.clear[other] - racers[c].clear) + 1);
  if (ai[c].attackTicks > 500) {
    ai[c].attackTicks = 500;
  }
  ai[c].leadAhead = 0;
  if (track.stage == 3 && type == CAR.swordOfJustice) {
    if (random.sim() > random.sim()) {
      ai[c].leadAhead = 1;
    }
  }
  if (track.stage == 4) {
    if (other == aiRival() && track.pos[aiRival()] < track.pos[c]) {
      ai[c].leadAhead = 1.5;
    } else {
      ai[c].leadAhead = random.sim();
    }
  }
  if (track.stage == 5) {
    ai[c].leadAhead = random.sim() * 1.5;
  }
  if (track.stage == 7) {
    if (c != boss()) {
      if (random.sim() > random.sim() || track.pos[aiRival()] < track.pos[c]) {
        ai[c].leadAhead = 1;
      }
    }
  }
  if (track.stage == 8 && type == CAR.elKing) {
    if (random.sim() > random.sim()) {
      ai[c].leadAhead = 0.76 + random.sim() * 0.76;
    }
  }
  if (track.stage == 9) {
    ai[c].leadAhead = 1;
    if (
      car[aiRival()].typ != CAR.elKing ||
      track.clear[c] - track.clear[aiRival()] < 8
    ) {
      if (ai[c].attackTicks > 150 && !onlyPlayer) {
        ai[c].attackTicks = 150;
      }
    }
  }
  if (track.stage == 11) {
    if (ai[c].bully) {
      ai[c].leadAhead = 0.7;
      if (ai[c].attackTicks > 150) {
        ai[c].attackTicks = 150;
      }
    } else {
      ai[c].leadAhead = random.sim();
    }
  }
  if (track.stage == 12) {
    if (random.sim() > random.sim()) {
      ai[c].leadAhead = 0.7;
      if (type == CAR.elKing) {
        ai[c].leadAhead += 0.7;
      }
    }
    if (ai[c].bully) {
      if (ai[c].attackTicks > 150) {
        ai[c].attackTicks = 150;
      }
    }
  }
  if (track.stage == 13) {
    if (ai[c].attackTicks > 60) {
      ai[c].attackTicks = 60;
    }
  }
  if (track.stage == 15) {
    ai[c].leadAhead = random.sim() * 1.5;
    ai[c].attackTicks = ai[c].attackTicks / 2;
    if (random.sim() > random.sim()) {
      ai[c].quitsAttackOnMissedCheckpoint = true;
    } else {
      ai[c].quitsAttackOnMissedCheckpoint = false;
    }
  }
  if (track.stage == 16) {
    if (type == CAR.elKing) {
      ai[c].leadAhead = 0.2 + random.sim() * 0.8;
      ai[c].attackTicks = 70;
    }
    if (type == CAR.masheen) {
      if (random.sim() > random.sim()) {
        ai[c].leadAhead = 0.7;
      }
      if (ai[c].attackTicks > 150) {
        ai[c].attackTicks = 150;
      }
    }
    if (
      type == CAR.drMonstaa ||
      type == CAR.swordOfJustice ||
      type == CAR.radicalOne
    ) {
      ai[c].leadAhead = random.sim() * 1.5;
      if (
        Math.abs(track.clear[other] - racers[c].clear) <= 2 ||
        type == CAR.radicalOne
      ) {
        ai[c].attackTicks = ai[c].attackTicks / 3;
      }
    }
  }
  ai[c].attackedCar = other;
  ai[c].sharpTurn = Math.floor(1 + random.sim() * 2);
  if (ai[c].sharpTurn == SHARP_TURN.liftGas) {
    ai[c].sharpTurn = SHARP_TURN.handbrake;
  }
}
