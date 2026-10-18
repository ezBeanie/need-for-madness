// The computer drivers: how every car but the player's decides what to press.

import { cosDeg, distanceSquaredXZ, distanceXZ, sinDeg } from "../core/math.js";
import { random } from "../core/random.js";
import { MAX_CARS, MODE, game } from "../core/state.js";
import { tick } from "../core/tick.js";
import { carStats } from "../data/carStats.js";
import { car, racers } from "./racers.js";
import { pieceModels, pieces, track } from "./track.js";

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
// what a driver does in a sharp turn besides steering (a turn of more than 50 degrees
// above its first gear's top speed)
const SHARP_TURN = { steer: 0, brake: 1, handbrake: 2, liftGas: 3 };

// Whom a driver chases (or flees from) and how; forgotten at the start and when the
// player winds back time.
const newPursuit = () => ({
  aimHeading: 0,
  attackTicks: 0,
  attackedCar: 0,
  afta: false,
  fixing: 0,
  aimLag: 0,
  holdBack: 0,
  ignoreMissed: false,
  bully: false,
  runbul: 0,
  reverseTicks: 0,
  oupnt: 0,
  goingToWait: false,
  apunch: 0,
  exitattack: false,
});

// What every computer driver is up to. Fields keep their original names for now.
const newDriver = () => ({
  ...newPursuit(),
  steerFreeze: 0,
  statusque: 0,
  stcnt: 0,
  steerTolerance: 5,
  cornerCutting: 1,
  rampChoice: 0,
  cntrn: 0,
  gasInTurns: false,
  sharpTurn: 0,
  landingMargin: 30,
  landingSloppiness: 0.5,
  stuntf: 0,
  avoidnlev: 0,
  trickprf: 0.5,
  usebounce: false,
  perfection: false,
  leadAhead: 0,
  stuntPhase: 0,
  gasCycle: 0,
  holdBackNow: 0,
  waitX: 0,
  waitZ: 0,
  frx: 0,
  frz: 0,
  frad: 0,
  ticksToNextAim: 0,
  ticksSinceAim: 0,
  lastTurnedLeft: false,
  lastWall: -1,
  wallTurnLeft: false,
  takeoffXy: 0,
  takeoffZy: 0,
  airTicks: 0,
  flip: 0,
  roll: 0,
  flipReverses: false,
  rollReverses: false,
  flipAfter: 0,
  rollAfter: 0,
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
    for (var j = 0; j < pieces.fixCount; j++) {
      var pyclos = -10;
      for (var i = 0; i < track.n; i++) {
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
    for (var i = 0; i < pieces.fixCount; i++) {
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
  for (var c = 1; c < game.carCount; c++) {
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
      ai[c].statusque = 0;
    }
    if (track.stage == 12) {
      if (c != boss()) {
        ai[c].steerFreeze = Math.floor(20 + 10 * random.sim());
        ai[c].reverseTicks = Math.floor(10 + 10 * random.sim());
      } else {
        ai[c].steerFreeze = 5;
      }
      ai[c].statusque = 0;
    }
    if (track.stage == 14) {
      ai[c].steerFreeze = 30;
      ai[c].statusque = 0;
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
  for (var c = 0; c < game.carCount; c++) {
    if (c != game.player) {
      var cn = car[c].typ;
      racers[c].u.left = false;
      racers[c].u.right = false;
      racers[c].u.up = false;
      racers[c].u.down = false;
      racers[c].u.handb = false;
      if (!racers[c].dest) {
        if (racers[c].mtouch) {
          if (ai[c].stcnt > ai[c].statusque) {
            rethink(c, cn);
          } else {
            if (tick.fraction >= tick.scale) {
              ai[c].stcnt++;
            }
          }
        }
        var ride = false;
        if (ai[c].usebounce) {
          ride = racers[c].wtouch;
        } else {
          ride = racers[c].mtouch;
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
            var pnt = racers[c].point;
            var powbul = 50;
            if (track.stage == 8) {
              powbul = 20;
            }
            if (track.stage == 15) {
              powbul = 40;
            }
            if (track.stage == 16) {
              if (cn == 14 || cn == 16) {
                powbul = 0;
              }
            }
            pnt = choosePathPoint(c, powbul, pnt, cn);
            pnt = headForFix(c, pnt);
            aimAtPathPoint(c, pnt);
          } else {
            chaseTarget(c);
          }
          steerToAim(c, cn);
          bounceOffWalls(c);
        } else {
          flyStunts(c, cn);
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

function headForFix(c, pnt) {
  if (track.stage != 17 && game.mode != MODE.switchCars) {
    if (
      racers[c].missedcp == 0 ||
      ai[c].ignoreMissed ||
      ai[c].fixing == FIX.jumping
    ) {
      if (ai[c].fixing != FIX.none) {
        var istr = 0;
        if (
          track.stage == 9 &&
          car[game.player].typ == 14 &&
          track.clear[c] - track.clear[game.player] >= 4
        ) {
          istr = 1;
        }
        if (track.stage == 16) {
          istr = 2;
        }
        if (ai[c].fixing == FIX.nearest) {
          if (track.stage == 15) {
            istr = 2;
          }
          var pyclos = -10;
          var closi = 0;
          for (var i = istr; i < pieces.fixCount; i++) {
            if (
              distanceSquaredXZ(
                car[c].x / 10,
                track.x[fixApproach[i]] / 10,
                car[c].z / 10,
                track.z[fixApproach[i]] / 10,
              ) < pyclos ||
              pyclos == -10
            ) {
              pyclos = distanceSquaredXZ(
                car[c].x / 10,
                track.x[fixApproach[i]] / 10,
                car[c].z / 10,
                track.z[fixApproach[i]] / 10,
              );
              closi = i;
            }
          }
          if (track.stage == 12) {
            closi = 1;
          }
          pnt = fixApproach[closi];
          if (track.special[closi]) {
            ai[c].ignoreMissed = true;
          } else {
            ai[c].ignoreMissed = false;
          }
        }
        for (var i = istr; i < pieces.fixCount; i++) {
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
  return pnt;
}

function aimAtPathPoint(c, pnt) {
  if (ai[c].ticksSinceAim > ai[c].ticksToNextAim) {
    if (!ai[c].goingToWait) {
      var ad = 0;
      if (track.x[pnt] - car[c].x >= 0) {
        ad = 180;
      }
      ai[c].aimHeading = Math.floor(
        90 +
          ad +
          Math.atan((track.z[pnt] - car[c].z) / (track.x[pnt] - car[c].x)) /
            0.017453292519943295,
      );
    } else {
      var ad = 0;
      if (ai[c].waitX - car[c].x >= 0) {
        ad = 180;
      }
      ai[c].aimHeading = Math.floor(
        90 +
          ad +
          Math.atan((ai[c].waitZ - car[c].z) / (ai[c].waitX - car[c].x)) /
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
  var ad = 0;
  var adsto =
    (distanceXZ(
      car[c].x,
      car[ai[c].attackedCar].x,
      car[c].z,
      car[ai[c].attackedCar].z,
    ) /
      2) *
    ai[c].leadAhead;
  var acx =
    car[ai[c].attackedCar].x - adsto * sinDeg(racers[ai[c].attackedCar].mxz);
  var acz =
    car[ai[c].attackedCar].z + adsto * cosDeg(racers[ai[c].attackedCar].mxz);
  if (acx - car[c].x >= 0) {
    ad = 180;
  }
  ai[c].aimHeading =
    90 +
    ad +
    Math.atan((acz - car[c].z) / (acx - car[c].x)) / 0.017453292519943295;
  if (tick.fraction >= tick.scale) {
    ai[c].attackTicks--;
  }
  if (ai[c].attackTicks <= 0) {
    ai[c].attackTicks = 0;
  }
  if (
    track.stage == 15 &&
    ai[c].exitattack &&
    !ai[c].bully &&
    racers[c].missedcp != 0
  ) {
    ai[c].attackTicks = 0;
  }
  if (track.stage == 16 && racers[c].missedcp != 0) {
    if (
      track.pos[c] == 0 ||
      (track.pos[c] == 1 && track.pos[game.player] == 0)
    ) {
      ai[c].attackTicks = 0;
    }
  }
  if (
    track.stage == 16 &&
    track.pos[game.player] > track.pos[c] &&
    racers[c].power < 80
  ) {
    ai[c].attackTicks = 0;
  }
}

function steerToAim(c, cn) {
  var crxz = car[c].xz;
  if (racers[c].u.zyinv) {
    crxz += 180;
  }
  while (crxz < 0) {
    crxz += 360;
  }
  while (crxz > 180) {
    crxz -= 360;
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
    if (Math.abs(crxz - ai[c].aimHeading) < 180) {
      if (
        Math.floor(Math.abs(crxz - ai[c].aimHeading)) > ai[c].steerTolerance
      ) {
        if (crxz > ai[c].aimHeading) {
          racers[c].u.left = true;
          ai[c].lastTurnedLeft = true;
        } else {
          racers[c].u.right = true;
          ai[c].lastTurnedLeft = false;
        }
        if (
          Math.abs(crxz - ai[c].aimHeading) > 50 &&
          racers[c].speed > carStats.swits[cn][0] &&
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
        Math.floor(Math.abs(crxz - ai[c].aimHeading)) <
        360 - ai[c].steerTolerance
      ) {
        if (crxz > ai[c].aimHeading) {
          racers[c].u.right = true;
          ai[c].lastTurnedLeft = false;
        } else {
          racers[c].u.left = true;
          ai[c].lastTurnedLeft = true;
        }
        if (
          Math.abs(crxz - ai[c].aimHeading) < 310 &&
          racers[c].speed > carStats.swits[cn][0] &&
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
      var hmlt = 1;
      if (pieceModels[pieces.list[racers[c].wall].typ].skid == 1) {
        hmlt = 3;
      }
      ai[c].steerFreeze += hmlt;
      if (ai[c].steerFreeze > 10 * hmlt) {
        ai[c].steerFreeze = 10 * hmlt;
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

function flyStunts(c, cn) {
  if (ai[c].stuntPhase == STUNT.takeoff) {
    var upv =
      ((racers[c].scy[0] +
        racers[c].scy[1] +
        racers[c].scy[2] +
        racers[c].scy[3]) *
        (car[c].y + 5)) /
      40;
    var divo = 3;
    if (track.stage == 15 || track.stage == 16) {
      divo = 10;
    }
    if (
      track.stage == 13 &&
      racers[c].pcleared == 20 &&
      racers[c].point > 32 &&
      track.clear[c] - track.clear[game.player] <= 3
    ) {
      upv = 0;
    }
    if (track.stage == 16 && racers[c].pcleared == 120 && car[c].z < 2200) {
      upv = 0;
    }
    if (
      upv > 7 &&
      (random.sim() > ai[c].trickprf / divo || ai[c].stuntf == 4)
    ) {
      ai[c].takeoffXy = racers[c].pxy;
      ai[c].takeoffZy = racers[c].pzy;
      ai[c].airTicks = 0;
      ai[c].flip = 0;
      ai[c].roll = 0;
      ai[c].flipReverses = false;
      ai[c].rollReverses = false;
      ai[c].stuntPhase = STUNT.flipping;
      if (upv < 16) {
        ai[c].flip = -1;
        ai[c].flipAfter = 0;
        ai[c].flipReverses = false;
      } else {
        if (
          (random.sim() > random.sim() && ai[c].stuntf != 3) ||
          ai[c].stuntf == 1 ||
          ai[c].stuntf == 2 ||
          ai[c].stuntf == 4
        ) {
          if (
            ai[c].stuntf == 4 &&
            racers[c].pcleared == 47 &&
            ai[c].oupnt == 0
          ) {
            ai[c].stuntf = 5;
          }
          if (
            (random.sim() > random.sim() ||
              ai[c].stuntf == 2 ||
              ai[c].stuntf == 5) &&
            ai[c].stuntf != 1 &&
            ai[c].stuntf != 4
          ) {
            ai[c].flip = -1;
          } else {
            ai[c].flip = 1;
          }
          ai[c].flipAfter = Math.floor(10 * random.sim() * ai[c].trickprf);
          if (ai[c].stuntf == 4 || ai[c].stuntf == 5 || track.stage == 16) {
            ai[c].flipAfter = 0;
          }
          if (
            random.sim() > 0.85 &&
            ai[c].stuntf != 1 &&
            ai[c].stuntf != 4 &&
            ai[c].stuntf != 5
          ) {
            ai[c].flipReverses = true;
          }
          if (
            random.sim() > ai[c].trickprf + 0.3 &&
            ai[c].stuntf != 1 &&
            ai[c].stuntf != 2 &&
            ai[c].stuntf != 4 &&
            ai[c].stuntf != 5
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
          ai[c].rollAfter = Math.floor(10 * random.sim() * ai[c].trickprf);
          if (random.sim() > 0.75) {
            ai[c].rollReverses = true;
          }
          if (random.sim() > ai[c].trickprf + 0.3) {
            if (random.sim() > random.sim() || ai[c].stuntf == 3) {
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
      if (track.stage == 16 && cn == 16) {
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
      ai[c].statusque += 30;
    }
  }
  if (ai[c].stuntPhase == STUNT.flipping) {
    ai[c].airTicks++;
    if (ai[c].roll != 0) {
      if (ai[c].airTicks > ai[c].rollAfter) {
        if (ai[c].rollReverses) {
          if (Math.abs(racers[c].pxy - ai[c].takeoffXy) > 180) {
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
          if (Math.abs(racers[c].pzy - ai[c].takeoffZy) > 180) {
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
          if (ai[c].apunch > 0) {
            racers[c].u.down = true;
            ai[c].apunch--;
          }
        }
      }
    }
    if (
      ((racers[c].scy[0] +
        racers[c].scy[1] +
        racers[c].scy[2] +
        racers[c].scy[3]) *
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
  if (ai[c].stuntPhase == STUNT.landing) {
    if (ai[c].landingStep == 0) {
      if (racers[c].dcomp != 0 || racers[c].ucomp != 0) {
        ai[c].straightenPitch = true;
      }
      if (racers[c].lcomp != 0 || racers[c].rcomp != 0) {
        ai[c].straightenRoll = true;
      }
      ai[c].landingStep = 1;
    }
    if (racers[c].wtouch) {
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
      var pzyr = racers[c].pzy + 90;
      while (pzyr < 0) {
        pzyr += 360;
      }
      while (pzyr > 180) {
        pzyr -= 360;
      }
      pzyr = Math.abs(pzyr);
      if (Math.abs(racers[c].lcomp - racers[c].rcomp) < 5) {
        if (ai[c].pressedDown || ai[c].pressedUp) {
          ai[c].pitchSettled = true;
        }
      }
      if (racers[c].dcomp > racers[c].ucomp) {
        if (racers[c].capsized) {
          if (ai[c].pitchSettled) {
            if (pzyr < 90) {
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
            if (ai[c].perfection && Math.abs(pzyr - 90) > 30) {
              if (pzyr < 90) {
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
            if (pzyr < 90) {
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
            if (ai[c].perfection && Math.abs(pzyr - 90) > 30) {
              if (pzyr < 90) {
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
    if (ai[c].straightenRoll) {
      var pxyr = racers[c].pxy + 90;
      if (racers[c].u.zyinv) {
        pxyr += 180;
      }
      while (pxyr < 0) {
        pxyr += 360;
      }
      while (pxyr > 180) {
        pxyr -= 360;
      }
      pxyr = Math.abs(pxyr);
      if (Math.abs(racers[c].lcomp - racers[c].rcomp) < 10) {
        if (ai[c].pressedLeft || ai[c].pressedRight) {
          ai[c].rollSettled = true;
        }
      }
      if (racers[c].lcomp > racers[c].rcomp) {
        if (racers[c].capsized) {
          if (ai[c].rollSettled) {
            if (pxyr > 90) {
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
            if (ai[c].perfection && Math.abs(pxyr - 90) > 30) {
              if (pxyr > 90) {
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
            if (pxyr > 90) {
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
            if (ai[c].perfection && Math.abs(pxyr - 90) > 30) {
              if (pxyr > 90) {
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
  }
}

function choosePathPoint(c, powbul, pnt, cn) {
  if (
    !ai[c].bully ||
    ai[c].fixing == FIX.nearest ||
    ai[c].fixing == FIX.close ||
    ai[c].fixing == FIX.jumping ||
    racers[c].power < powbul
  ) {
    var tpnt = 0;
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
    if (track.stage != 9 || pnt != 0) {
      if (random.sim() > ai[c].cornerCutting) {
        tpnt = pnt;
        var notimpcp = false;
        if (track.typ[tpnt] > 0) {
          var ic = 0;
          for (var i = 0; i < track.n; i++) {
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
            var ic = 0;
            for (var i = 0; i < track.n; i++) {
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
    if (track.stage == 11) {
      if (racers[c].pcleared == 18 && pnt >= 26) {
        if (pnt <= 32) {
          pnt = 32;
        } else {
          pnt = 38;
        }
      }
      if (racers[c].pcleared == 67) {
        pnt = 74;
      }
    }
    if (track.stage == 12) {
      if (racers[c].pcleared == 27 || racers[c].pcleared == 37) {
        while (track.typ[pnt] == -1) {
          pnt++;
          if (pnt >= track.n) {
            pnt = 0;
          }
        }
      }
    }
    if (track.stage == 13) {
      if (racers[c].pcleared == 20 && racers[c].focus == 36 && car[c].y < 100) {
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
      if (racers[c].pcleared == 20 && ai[c].fixing < FIX.nearest) {
        if (pnt >= 26 && pnt < 30) {
          pnt = 30;
        }
      }
      if (racers[c].pcleared == 52 && ai[c].fixing < FIX.nearest) {
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
      if ((100 * racers[c].hitmag) / carStats.maxmag[cn] < 10) {
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
    if (track.stage == 14) {
      if (racers[c].pcleared == 47 && pnt > 58 && ai[c].oupnt == 0) {
        ai[c].oupnt = 1;
      }
      if (cn != 17 || ai[c].attackedCar == 0) {
        while (track.typ[pnt] == -1) {
          pnt++;
          if (pnt >= track.n) {
            pnt = 0;
          }
        }
      }
    }
    if (track.stage == 15) {
      if (racers[c].pcleared == 10 && ai[c].fixing < FIX.nearest) {
        if (pnt != 18) {
          pnt = 18;
        }
      }
    }
    if (track.stage == 16) {
      if (ai[c].fixing != FIX.nearest && ai[c].fixing != FIX.close) {
        if (racers[c].pcleared == 152 && car[c].z < 2700) {
          pnt = 5;
        }
        if (racers[c].pcleared == 10 && car[c].x < 700) {
          pnt = 13;
        }
        if (racers[c].pcleared == 20) {
          if (car[c].z < 6200 && car[c].z > 3400) {
            pnt = 126;
          }
          if (car[c].z < 3400) {
            pnt = 35;
          }
        }
        if (racers[c].pcleared == 35 && car[c].x < 6300 && car[c].x > 4000) {
          pnt = 116;
        }
        if (racers[c].pcleared == 55 && car[c].x < 4500) {
          pnt = 59;
        }
        if (racers[c].pcleared == 64) {
          pnt = 74;
        }
        if (racers[c].pcleared == 74) {
          pnt = 82;
        }
        if (racers[c].pcleared == 82) {
          pnt = 92;
        }
        if (racers[c].pcleared == 103) {
          pnt = 112;
        }
        if (racers[c].pcleared == 112 && car[c].x > 3200) {
          pnt = 120;
        }
        if (racers[c].pcleared == 120 && car[c].z > 2800) {
          pnt = 129;
        }
        if (racers[c].pcleared == 129) {
          pnt = 152;
        }
      }
      if (
        track.clear[c] - track.clear[game.player] >= 2 &&
        distanceSquaredXZ(
          car[c].x / 10,
          car[game.player].x / 10,
          car[c].z / 10,
          car[game.player].z / 10,
        ) <
          1000 + ai[c].avoidnlev
      ) {
        var myxz = car[c].xz;
        if (racers[c].u.zyinv) {
          myxz += 180;
        }
        while (myxz < 0) {
          myxz += 360;
        }
        while (myxz > 180) {
          myxz -= 360;
        }
        var ad = 0;
        if (car[game.player].x - car[c].x >= 0) {
          ad = 180;
        }
        var pnxz = Math.floor(
          90 +
            ad +
            Math.atan(
              (car[game.player].z - car[c].z) / (car[game.player].x - car[c].x),
            ) /
              0.017453292519943295,
        );
        while (pnxz < 0) {
          pnxz += 360;
        }
        while (pnxz > 180) {
          pnxz -= 360;
        }
        var vis = Math.abs(myxz - pnxz);
        if (vis > 180) {
          vis = Math.abs(vis - 360);
        }
        if (vis < 90) {
          racers[c].wall = 0;
        }
      }
    }
    if (
      game.mode == MODE.switchCars &&
      (100 * racers[c].hitmag) / carStats.maxmag[cn] > 85
    ) {
      var myxz = car[c].xz;
      if (racers[c].u.zyinv) {
        myxz += 180;
      }
      while (myxz < 0) {
        myxz += 360;
      }
      while (myxz > 180) {
        myxz -= 360;
      }
      for (var i = 0; i < game.carCount; i++) {
        if (i != c && track.clear[i] != -1) {
          if (
            distanceSquaredXZ(
              car[c].x / 10,
              car[i].x / 10,
              car[c].z / 10,
              car[i].z / 10,
            ) <
            1000 + ai[c].avoidnlev
          ) {
            var ad = 0;
            if (car[i].x - car[c].x >= 0) {
              ad = 180;
            }
            var pnxz = Math.floor(
              90 +
                ad +
                Math.atan((car[i].z - car[c].z) / (car[i].x - car[c].x)) /
                  0.017453292519943295,
            );
            while (pnxz < 0) {
              pnxz += 360;
            }
            while (pnxz > 180) {
              pnxz -= 360;
            }
            var vis = Math.abs(myxz - pnxz);
            if (vis > 180) {
              vis = Math.abs(vis - 360);
            }
            if (vis < 45) {
              racers[c].wall = 0;
            }
            if ((100 * racers[c].hitmag) / carStats.maxmag[cn] > 95) {
              if (vis < 90) {
                racers[c].wall = 0;
              }
            }
          }
        }
      }
    }
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
    if (ai[c].bully) {
      racers[c].nofocus = true;
      if (ai[c].goingToWait) {
        ai[c].goingToWait = false;
      }
    }
  } else {
    if (track.stage != 15 || ai[c].runbul == 0) {
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
    }
    if (track.stage == 11) {
      if (pnt < 38 && pnt > 25) {
        pnt = 25;
      }
    }
    if (track.stage == 12) {
      if (!ai[c].goingToWait) {
        if (track.clear[game.player] == 0) {
          ai[c].waitX = 350;
          ai[c].waitZ = 1900;
          ai[c].frx = 350;
          ai[c].frz = 3900;
          ai[c].frad = 12000;
          ai[c].oupnt = 37;
          ai[c].goingToWait = true;
          ai[c].afta = false;
        }
        if (track.clear[game.player] == 7) {
          ai[c].waitX = 4480;
          ai[c].waitZ = 4032;
          ai[c].frx = 4480;
          ai[c].frz = 3472;
          ai[c].frad = 30000;
          ai[c].oupnt = 27;
          ai[c].goingToWait = true;
          ai[c].afta = false;
        }
        if (track.clear[game.player] == 10) {
          ai[c].waitX = 0;
          ai[c].waitZ = 4873.9;
          ai[c].frx = 0;
          ai[c].frz = 3858.9;
          ai[c].frad = 90000;
          ai[c].oupnt = 55;
          ai[c].goingToWait = true;
          ai[c].afta = false;
        }
        if (track.clear[game.player] == 14) {
          ai[c].waitX = 350;
          ai[c].waitZ = 1900;
          ai[c].frx = 1470;
          ai[c].frz = 3900;
          ai[c].frad = 45000;
          ai[c].oupnt = 37;
          ai[c].goingToWait = true;
          ai[c].afta = false;
        }
        if (track.clear[game.player] == 18) {
          ai[c].waitX = 4830;
          ai[c].waitZ = -455;
          ai[c].frx = 4830;
          ai[c].frz = 560;
          ai[c].frad = 90000;
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
          racers[game.player].pcleared == ai[c].oupnt &&
          distanceSquaredXZ(
            car[game.player].x / 10,
            ai[c].frx / 10,
            car[game.player].z / 10,
            ai[c].frz / 10,
          ) < ai[c].frad
        ) {
          ai[c].afta = true;
          ai[c].goingToWait = false;
        }
        if (
          distanceSquaredXZ(
            car[c].x / 10,
            car[game.player].x / 10,
            car[c].z / 10,
            car[game.player].z / 10,
          ) < 25
        ) {
          ai[c].afta = true;
          ai[c].goingToWait = false;
          ai[c].attackTicks = 200;
          ai[c].attackedCar = 0;
        }
      }
    }
    if (track.stage == 15) {
      if (ai[c].oupnt == -1) {
        var pyclos = -10;
        for (var i = 0; i < track.n; i++) {
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
    }
    if (track.stage == 16) {
      if (cn == 14) {
        if (racers[c].power > 60) {
          var i = racers[game.player].pcleared;
          var found = -1;
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
          var pyclos = -10;
          for (var i = 0; i < track.n; i++) {
            if (
              pieces.list[track.obi[i]].typ == 24 ||
              pieces.list[track.obi[i]].typ == 25 ||
              pieces.list[track.obi[i]].typ == 43 ||
              pieces.list[track.obi[i]].typ == 45
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
      }
      if (cn == 16) {
        if (!ai[c].goingToWait) {
          if (
            racers[game.player].pcleared == 152 ||
            racers[game.player].pcleared == 10 ||
            racers[game.player].pcleared == 20
          ) {
            ai[c].waitX = 820;
            ai[c].waitZ = 120;
            ai[c].frx = 1364;
            ai[c].frz = 218;
            ai[c].frad = 50000;
            ai[c].oupnt = 35;
            ai[c].goingToWait = true;
            ai[c].afta = false;
            ai[c].runbul = 1;
          }
          if (
            racers[game.player].pcleared == 45 ||
            racers[game.player].pcleared == 55
          ) {
            if (racers[c].power > 60) {
              ai[c].waitX = 3000;
              ai[c].waitZ = 1600;
              ai[c].frx = 4206;
              ai[c].frz = 1365;
              ai[c].frad = 30000;
              ai[c].oupnt = 64;
              ai[c].goingToWait = true;
              ai[c].afta = false;
              ai[c].runbul = 1;
            } else {
              pnt = 73;
            }
          }
          if (
            racers[game.player].pcleared == 92 ||
            racers[game.player].pcleared == 103
          ) {
            if (racers[c].power > 60) {
              ai[c].waitX = 6408.2;
              ai[c].waitZ = 1571.4;
              ai[c].frx = 6184;
              ai[c].frz = 780;
              ai[c].frad = 90000;
              ai[c].oupnt = 112;
              ai[c].goingToWait = true;
              ai[c].afta = false;
              ai[c].runbul = 0;
            } else {
              pnt = 73;
            }
          }
          if (racers[game.player].pcleared == 112 && ai[c].oupnt == 112) {
            ai[c].stcnt = 0;
            ai[c].statusque = 10;
            if (
              distanceSquaredXZ(
                car[c].x / 10,
                ai[c].frx / 10,
                car[c].z / 10,
                ai[c].frz / 10,
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
            racers[game.player].pcleared == ai[c].oupnt &&
            distanceSquaredXZ(
              car[game.player].x / 10,
              ai[c].frx / 10,
              car[game.player].z / 10,
              ai[c].frz / 10,
            ) < ai[c].frad
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
              car[game.player].x / 10,
              car[c].z / 10,
              car[game.player].z / 10,
            ) < 25
          ) {
            ai[c].afta = true;
            ai[c].goingToWait = false;
            ai[c].attackTicks = 200;
            ai[c].attackedCar = 0;
          }
        }
      }
    }
    racers[c].nofocus = true;
  }
  return pnt;
}

function rethink(c, cn) {
  var tstage = track.stage;
  ai[c].aimLag = Math.floor(
    (7 - rank(c)) * rank(game.player) * (6 - tstage * 2),
  );
  if (ai[c].aimLag < 0) {
    ai[c].aimLag = 0;
  }
  ai[c].steerTolerance = 5;
  if (track.stage == 6 || track.stage == 11) {
    ai[c].steerTolerance = 2;
  }
  if (track.stage == 12) {
    if (racers[c].pcleared == 27 || racers[c].pcleared == 17) {
      ai[c].steerTolerance = 3;
    }
  }
  if (track.stage == 16) {
    ai[c].steerTolerance = 3;
  }
  var mw = 0;
  if (track.stage == 1) {
    mw = 2;
  }
  if (track.stage == 2) {
    mw = 1.5;
  }
  if (track.stage == 3 && cn != 12) {
    mw = 0.5;
  }
  if (track.stage == 4) {
    mw = 0.5;
  }
  ai[c].holdBack = Math.floor(
    (rank(game.player) - rank(c)) *
      (rank(game.player) - rank(c)) *
      (rank(game.player) - rank(c)) *
      mw,
  );
  if (ai[c].holdBack > 80) {
    ai[c].holdBack = 80;
  }
  if (track.stage == 1) {
    if (ai[c].holdBack < 20) {
      ai[c].holdBack = 20;
    }
  }
  mw = 0;
  if (track.stage == 1 || track.stage == 2) {
    mw = 1;
  }
  if (track.stage == 3) {
    mw = 0.5;
  }
  if (track.stage == 4) {
    mw = 0.5;
  }
  if (track.stage == 5) {
    mw = 0.2;
  }
  if (track.pos[c] - track.pos[game.player] >= -1) {
    ai[c].cornerCutting -= 0.1;
    if (ai[c].cornerCutting < 0) {
      ai[c].cornerCutting = 0;
    }
  } else {
    ai[c].cornerCutting += 0.2;
    if (ai[c].cornerCutting > mw) {
      ai[c].cornerCutting = mw;
    }
  }
  if (track.stage == 9 || track.stage == 12) {
    ai[c].cornerCutting = 1;
  }
  if (track.stage == 11) {
    ai[c].cornerCutting = 0;
    if (racers[c].pcleared == 89 || racers[c].pcleared == 18) {
      ai[c].cornerCutting = 1;
    }
    if (racers[c].pcleared == 45 || racers[c].pcleared == 52) {
      ai[c].cornerCutting = 0.5;
    }
  }
  if (track.stage == 13 && racers[c].pcleared == 20) {
    ai[c].cornerCutting = 1;
  }
  if (track.stage == 14) {
    ai[c].cornerCutting = 1;
    if (cn == 17) {
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
    if (racers[c].pcleared >= 45) {
      ai[c].cornerCutting = 0;
    } else {
      ai[c].cornerCutting = 1;
    }
  }
  if (
    game.mode == MODE.switchCars &&
    (100 * racers[c].hitmag) / carStats.maxmag[cn] > 85
  ) {
    ai[c].cornerCutting = 0;
  }
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
    if (racers[c].pcleared == 18) {
      ai[c].rampChoice = RAMPS.stayBefore;
    }
  }
  if (track.stage == 12) {
    if (racers[c].pcleared == 17) {
      ai[c].rampChoice = RAMPS.stayBefore;
    }
  }
  if (track.stage == 15 || track.stage == 16) {
    ai[c].rampChoice = RAMPS.either;
  }
  if (ai[c].cntrn == 0) {
    ai[c].gasInTurns = false;
    ai[c].sharpTurn = Math.floor(random.sim() * 4);
    if (track.stage == 3 && cn == 12) {
      ai[c].sharpTurn = SHARP_TURN.brake;
      if (ai[c].attackTicks == 0) {
        ai[c].gasInTurns = true;
      }
    }
    if (track.pos[game.player] - track.pos[c] < 0 || track.stage == 10) {
      ai[c].sharpTurn = Math.floor(random.sim() * 2);
      if (ai[c].sharpTurn == SHARP_TURN.handbrake) {
        ai[c].sharpTurn = SHARP_TURN.brake;
      }
    }
    if (track.stage == 11) {
      if (racers[c].pcleared == 89) {
        if (racers[c].point >= 5) {
          ai[c].sharpTurn = SHARP_TURN.handbrake;
        } else {
          ai[c].sharpTurn = SHARP_TURN.steer;
        }
      }
      if (racers[c].pcleared == 9) {
        ai[c].sharpTurn = SHARP_TURN.handbrake;
      }
    }
    if (track.stage == 13) {
      if (
        racers[c].pcleared == 20 ||
        racers[c].pcleared == 36 ||
        racers[c].pcleared == 52
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
        if (cn == 14) {
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
    ai[c].cntrn = 5;
  } else {
    ai[c].cntrn--;
  }
  ai[c].landingMargin = Math.floor(
    (98 - racers[c].power) * 0.5 * (random.sim() * 0.5 + 0.5),
  );
  if (ai[c].landingMargin > 20) {
    ai[c].landingMargin = 20;
  }
  mw = 0;
  if (track.stage == 1) {
    mw = 0.9;
  }
  if (track.stage == 2) {
    mw = 0.7;
  }
  if (track.stage == 3) {
    mw = 0.4;
  }
  ai[c].landingSloppiness = mw + (random.sim() / 2 - 0.25);
  mw = 1;
  if (track.stage == 1) {
    mw = 5;
  }
  if (track.stage == 2) {
    mw = 2;
  }
  if (track.stage == 3) {
    mw = 1.5;
  }
  if (racers[c].power > 50) {
    if (track.pos[game.player] - track.pos[c] > 0) {
      ai[c].landingMargin *= mw;
    } else {
      ai[c].landingSloppiness = 0;
    }
  } else {
    ai[c].landingSloppiness -= 0.5;
  }
  if (track.stage == 6) {
    if (cn == 13) {
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
  ai[c].stuntf = 0;
  if (track.stage == 10) {
    if (
      track.pos[c] - track.pos[game.player] > 1 ||
      random.sim() > random.sim()
    ) {
      ai[c].stuntf = 1;
      ai[c].landingMargin = 10;
    } else {
      ai[c].stuntf = 2;
    }
  }
  if (track.stage == 11 && racers[c].pcleared == 18) {
    ai[c].stuntf = 2;
  }
  if (track.stage == 11 && cn == 16) {
    ai[c].stuntf = 3;
  }
  if (track.stage == 14) {
    if (cn == 17) {
      ai[c].stuntf = 4;
      ai[c].landingMargin = 20;
    } else {
      ai[c].landingMargin = 10;
      if (racers[c].pcleared == 47) {
        ai[c].stuntf = 2;
      }
    }
  }
  if (track.stage == 16) {
    ai[c].landingSloppiness = 0;
    ai[c].landingMargin = 20;
    if (racers[c].pcleared == 152 || racers[c].pcleared == 20) {
      ai[c].stuntf = 2;
    }
    if (racers[c].pcleared == 35) {
      ai[c].stuntf = 1;
    }
    if (racers[c].pcleared == 112) {
      ai[c].stuntf = 1;
    }
    if (racers[c].pcleared == 120) {
      ai[c].stuntf = 2;
    }
    ai[c].avoidnlev = Math.floor(2700 * random.sim());
  }
  if (game.mode == MODE.switchCars) {
    ai[c].avoidnlev = Math.floor(2700 * random.sim());
  }
  ai[c].trickprf = (racers[c].power - 38) / 50 - random.sim() * 0.5;
  if (racers[c].power < 60) {
    ai[c].trickprf = -1;
  }
  if (track.stage == 3 && cn == 12) {
    if (ai[c].trickprf > 0.7) {
      ai[c].trickprf = 0.7;
    }
  }
  if (track.stage == 6 && cn != 13) {
    if (ai[c].trickprf > 0.3) {
      ai[c].trickprf = 0.3;
    }
  }
  if (track.stage == 8) {
    if (ai[c].trickprf > 0.2) {
      ai[c].trickprf = 0.2;
    }
  }
  if (track.stage == 11) {
    if (ai[c].trickprf != -1) {
      ai[c].trickprf *= 0.75;
    }
  }
  if (track.stage == 12) {
    if (racers[c].pcleared == 55 || racers[c].pcleared == 7) {
      ai[c].trickprf = -1;
    }
  }
  if (track.stage == 14) {
    if (ai[c].trickprf > 0.5) {
      ai[c].trickprf = 0.5;
    }
  }
  if (track.stage == 17) {
    ai[c].trickprf = -1;
  }
  if (random.sim() > racers[c].power / 100) {
    ai[c].usebounce = true;
  } else {
    ai[c].usebounce = false;
  }
  if (track.stage == 4) {
    ai[c].usebounce = true;
  }
  if (track.stage == 6) {
    if (cn == 13) {
      ai[c].usebounce = false;
    } else {
      ai[c].usebounce = true;
    }
  }
  if (track.stage == 9 || track.stage == 10 || track.stage == 14) {
    ai[c].usebounce = false;
  }
  if (random.sim() > racers[c].hitmag / carStats.maxmag[cn]) {
    ai[c].perfection = false;
  } else {
    ai[c].perfection = true;
  }
  if ((100 * racers[c].hitmag) / carStats.maxmag[cn] > 60) {
    ai[c].perfection = true;
  }
  if (track.stage == 3 && cn == 12) {
    ai[c].perfection = true;
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
    ai[c].perfection = true;
  }
  if (track.stage == 15 && cn == 18) {
    ai[c].perfection = true;
  }
  chooseWhomToAttack(c, cn);
  chooseWhetherToFix(cn, c);
  chooseWhetherToBully(c, cn);
  ai[c].stcnt = 0;
  ai[c].statusque = Math.floor(20 * random.sim());
}

function chooseWhetherToFix(cn, c) {
  var norunfix = false;
  if (
    track.stage == 6 ||
    track.stage == 10 ||
    track.stage == 11 ||
    track.stage == 14
  ) {
    norunfix = true;
  }
  if (track.stage == 8 && cn != 14) {
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
      var trunfix = 50;
      if (track.stage == 16) {
        trunfix = 100;
      }
      if ((100 * racers[c].hitmag) / carStats.maxmag[cn] > trunfix) {
        ai[c].fixing = FIX.onTheWay;
      }
      if (!norunfix) {
        var runfix = 80;
        if (track.stage == 9) {
          runfix = 70;
        }
        if ((100 * racers[c].hitmag) / carStats.maxmag[cn] > runfix) {
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

function chooseWhetherToBully(c, cn) {
  if (!ai[c].bully) {
    if (track.stage == 8 && cn == 14) {
      ai[c].bully = true;
    }
    if (track.stage == 11 && cn == 16) {
      ai[c].bully = true;
    }
    if (track.stage == 12 && cn == 16) {
      ai[c].bully = true;
    }
    if (
      track.stage == 15 &&
      track.clear[game.player] - track.clear[c] >= 2 &&
      ai[c].fixing == FIX.none
    ) {
      ai[c].bully = true;
      ai[c].oupnt = -1;
    }
    if (track.stage == 16) {
      if (cn == 14 && track.clear[c] >= 1) {
        ai[c].bully = true;
      }
      if (cn == 16) {
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
        cn == 16 &&
        Math.abs(track.clear[game.player] - racers[c].clear) >= 2
      ) {
        ai[c].bully = true;
      }
    }
  } else {
  }
}

function chooseWhomToAttack(c, cn) {
  if (ai[c].attackTicks == 0) {
    var startsway = true;
    if (
      track.stage == 3 ||
      track.stage == 1 ||
      track.stage == 4 ||
      track.stage == 9 ||
      track.stage == 13 ||
      track.stage == 16
    ) {
      startsway = ai[c].afta;
    }
    if (
      track.stage == 6 ||
      track.stage == 8 ||
      track.stage == 10 ||
      track.stage == 14
    ) {
      startsway = false;
    }
    var onlyou = false;
    if (track.stage == 3 && cn == 12) {
      onlyou = true;
    }
    if (track.stage == 8 && cn == 14) {
      onlyou = true;
    }
    if (
      track.stage == 9 &&
      track.clear[game.player] >= 8 &&
      track.pos[game.player] == 0
    ) {
      onlyou = true;
    }
    if (
      track.stage == 11 ||
      track.stage == 12 ||
      track.stage == 13 ||
      track.stage == 15 ||
      track.stage == 16
    ) {
      onlyou = true;
    }
    var powtoattack = 60;
    if (track.stage == 3 || track.stage == 17) {
      powtoattack = 30;
    }
    if (track.stage == 4) {
      powtoattack = 20;
    }
    if (track.stage == 5 && c != boss()) {
      powtoattack = 40;
    }
    if ((track.stage == 2 || track.stage == 13) && cn == 16) {
      powtoattack = 50;
    }
    if (track.stage == 7) {
      powtoattack = 40;
    }
    if (track.stage == 8 && cn == 14) {
      powtoattack = 40;
    }
    if (track.stage == 9 && onlyou) {
      powtoattack = 30;
    }
    if (track.stage == 11 && ai[c].bully) {
      powtoattack = 30;
    }
    if (track.stage == 12) {
      powtoattack = 50;
    }
    if (track.stage == 15 && ai[c].bully) {
      powtoattack = 40;
    }
    if (track.stage == 16) {
      if (cn == 14) {
        powtoattack = 40;
      }
      if (cn == 16) {
        powtoattack = 50;
      }
      if (cn == 18 || cn == 12) {
        powtoattack = 50;
      }
      if (track.pos[game.player] > track.pos[c]) {
        powtoattack = 80;
      }
    }
    for (var i = 0; i < game.carCount; i++) {
      if (i != c && track.clear[i] != -1) {
        var myxz = car[c].xz;
        if (racers[c].u.zyinv) {
          myxz += 180;
        }
        while (myxz < 0) {
          myxz += 360;
        }
        while (myxz > 180) {
          myxz -= 360;
        }
        var ad = 0;
        if (car[i].x - car[c].x >= 0) {
          ad = 180;
        }
        var pnxz =
          90 +
          ad +
          Math.atan((car[i].z - car[c].z) / (car[i].x - car[c].x)) /
            0.017453292519943295;
        while (pnxz < 0) {
          pnxz += 360;
        }
        while (pnxz > 180) {
          pnxz -= 360;
        }
        var vis = Math.abs(myxz - pnxz);
        if (vis > 180) {
          vis = Math.abs(vis - 360);
        }
        var attackrad = 2000 * (Math.abs(track.clear[i] - racers[c].clear) + 1);
        if (track.stage == 3 && cn == 12) {
          if (attackrad < 12000) {
            attackrad = 12000;
          }
        }
        if (track.stage == 4) {
          if (attackrad < 4000) {
            attackrad = 4000;
          }
        }
        if (track.stage == 8 && cn == 14) {
          if (attackrad < 12000) {
            attackrad = 12000;
          }
          vis = 10;
        }
        if (track.stage == 9) {
          if (onlyou && attackrad < 12000) {
            attackrad = 12000;
          }
        }
        if (track.stage == 11) {
          if (ai[c].bully) {
            attackrad = 8000;
            vis = 10;
            ai[c].afta = true;
          } else {
            if (attackrad < 6000) {
              attackrad = 6000;
            }
          }
        }
        if (track.stage == 12 && ai[c].bully) {
          attackrad = 6000;
          vis = 10;
        }
        if (track.stage == 13) {
          if (track.clear[c] - track.clear[game.player] > 3) {
            attackrad = 21000;
          }
        }
        if (track.stage == 15) {
          attackrad *= Math.abs(track.clear[i] - racers[c].clear) + 1;
          if (ai[c].bully) {
            attackrad = 4000 * (Math.abs(track.clear[i] - racers[c].clear) + 1);
            vis = 10;
          }
        }
        if (track.stage == 16) {
          if (cn == 14) {
            attackrad = 16000;
            vis = 10;
          }
          if (cn == 16) {
            attackrad = 6000;
            vis = 10;
          }
          if (cn == 18 || cn == 12) {
            attackrad *= Math.abs(track.clear[i] - racers[c].clear) + 1;
          }
        }
        var visan = 85 + 15 * (Math.abs(track.clear[i] - racers[c].clear) + 1);
        if (track.stage == 9 && !onlyou) {
          if (
            car[game.player].typ != 14 ||
            track.clear[c] - track.clear[game.player] < 8
          ) {
            visan = 45;
          }
        }
        if (track.stage == 13) {
          visan = 45;
        }
        if (track.stage == 16) {
          if (cn == 18 || cn == 12 || cn == 17) {
            visan = 50 + 70 * Math.abs(track.clear[i] - racers[c].clear);
          }
        }
        if (
          vis < visan &&
          distanceSquaredXZ(
            car[c].x / 10,
            car[i].x / 10,
            car[c].z / 10,
            car[i].z / 10,
          ) < attackrad &&
          ai[c].afta &&
          racers[c].power > powtoattack
        ) {
          var bim = 35 - Math.abs(track.clear[i] - racers[c].clear) * 10;
          if (bim < 1) {
            bim = 1;
          }
          var atp = ((rank(c) + 1) * (7 - rank(i))) / bim;
          if (game.mode != MODE.switchCars) {
            if (track.stage != 17) {
              if (atp > 0.7) {
                atp = 0.7;
              }
            }
            if (i != game.player && track.pos[game.player] < track.pos[c]) {
              atp = 0;
            }
            if (i != game.player && onlyou) {
              atp = 0;
            }
            if (track.stage == 3) {
              if (cn == 12 || (cn == 16 && ai[c].bully)) {
                atp *= 2;
              } else {
                atp *= 0.5;
              }
            }
            if (track.stage == 5 && c == boss()) {
              atp *= 0.7;
            }
            if (track.stage == 6) {
              atp = 0;
            }
            if (track.stage == 7 && c == boss() && i == game.player) {
              atp *= 1.5;
            }
            if (track.stage == 8) {
              if (ai[c].bully && i == game.player) {
                atp = 1;
              } else {
                atp = 0;
              }
            }
            if (track.stage == 10) {
              atp = 0;
            }
            if (track.stage == 11) {
              if (ai[c].bully && i == game.player) {
                atp = 1;
              }
              if (
                track.pos[c] == 0 ||
                (track.pos[c] == 1 && track.pos[game.player] == 0)
              ) {
                atp = 0;
              }
            }
            if (track.stage == 12) {
              if (cn != 14 && cn != 16) {
                atp = 0;
              }
              if ((cn == 16 || cn == 14) && i == game.player) {
                atp = 1;
              }
            }
            if (track.stage == 14) {
              atp = 0;
            }
            if (track.stage == 15) {
              if (track.pos[c] == 0) {
                atp *= 0.5;
              }
              if (track.pos[game.player] < track.pos[c]) {
                atp *= 2;
              }
              if (ai[c].bully && i == game.player) {
                atp = 1;
              }
            }
            if (track.stage == 16) {
              if (cn != 17) {
                if (track.pos[game.player] < track.pos[c]) {
                  if (track.clear[game.player] - track.clear[c] != 1) {
                    atp *= 2;
                  }
                }
              } else {
                atp *= 0.5;
              }
              if ((cn == 14 || cn == 16) && i == game.player && ai[c].bully) {
                atp = 1;
              }
              if (
                track.pos[c] == 0 ||
                (track.pos[c] == 1 && track.pos[game.player] == 0)
              ) {
                atp = 0;
              }
              if (
                track.clear[c] - track.clear[game.player] >= 5 &&
                i == game.player
              ) {
                atp = 1;
              }
              if (cn == 11 || cn == 13 || cn == 15) {
                atp = 0;
              }
            }
          } else {
            var opxz = car[i].xz;
            if (racers[i].u.zyinv) {
              opxz += 180;
            }
            while (opxz < 0) {
              opxz += 360;
            }
            while (opxz > 180) {
              opxz -= 360;
            }
            if (Math.abs(Math.abs(myxz - opxz) - 180) < 45) {
              atp = 1;
            }
            if ((100 * racers[c].hitmag) / carStats.maxmag[cn] > 80) {
              atp = 0;
            }
          }
          if (random.sim() < atp) {
            ai[c].attackTicks =
              40 * (Math.abs(track.clear[i] - racers[c].clear) + 1);
            if (ai[c].attackTicks > 500) {
              ai[c].attackTicks = 500;
            }
            ai[c].leadAhead = 0;
            if (track.stage == 3 && cn == 12) {
              if (random.sim() > random.sim()) {
                ai[c].leadAhead = 1;
              }
            }
            if (track.stage == 4) {
              if (i == game.player && track.pos[game.player] < track.pos[c]) {
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
                if (
                  random.sim() > random.sim() ||
                  track.pos[game.player] < track.pos[c]
                ) {
                  ai[c].leadAhead = 1;
                }
              }
            }
            if (track.stage == 8 && cn == 14) {
              if (random.sim() > random.sim()) {
                ai[c].leadAhead = 0.76 + random.sim() * 0.76;
              }
            }
            if (track.stage == 9) {
              ai[c].leadAhead = 1;
              if (
                car[game.player].typ != 14 ||
                track.clear[c] - track.clear[game.player] < 8
              ) {
                if (ai[c].attackTicks > 150 && !onlyou) {
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
                if (cn == 14) {
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
                ai[c].exitattack = true;
              } else {
                ai[c].exitattack = false;
              }
            }
            if (track.stage == 16) {
              if (cn == 14) {
                ai[c].leadAhead = 0.2 + random.sim() * 0.8;
                ai[c].attackTicks = 70;
              }
              if (cn == 16) {
                if (random.sim() > random.sim()) {
                  ai[c].leadAhead = 0.7;
                }
                if (ai[c].attackTicks > 150) {
                  ai[c].attackTicks = 150;
                }
              }
              if (cn == 18 || cn == 12 || cn == 17) {
                ai[c].leadAhead = random.sim() * 1.5;
                if (
                  Math.abs(track.clear[i] - racers[c].clear) <= 2 ||
                  cn == 17
                ) {
                  ai[c].attackTicks = ai[c].attackTicks / 3;
                }
              }
            }
            ai[c].attackedCar = i;
            ai[c].sharpTurn = Math.floor(1 + random.sim() * 2);
            if (ai[c].sharpTurn == SHARP_TURN.liftGas) {
              ai[c].sharpTurn = SHARP_TURN.handbrake;
            }
          }
        }
        if (
          startsway &&
          vis > 100 &&
          distanceSquaredXZ(
            car[c].x / 10,
            car[i].x / 10,
            car[c].z / 10,
            car[i].z / 10,
          ) < 300 &&
          random.sim() > 0.6 - rank(c) / 10
        ) {
          ai[c].steerTolerance = 0;
          ai[c].aimLag = 0;
        }
      }
    }
  }
}
