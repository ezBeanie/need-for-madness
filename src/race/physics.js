// How cars drive, hit the stage and each other, and take damage.

import { playSound } from "../audio/audio.js";
import {
  bumpSound,
  crashSound,
  groundScrapeSound,
  scrapeSound,
  skidSound,
} from "../audio/carSounds.js";
import {
  cosDeg,
  distanceSquared,
  distanceSquaredXZ,
  distanceXZ,
  rotateAxes,
  rotatePoints,
  sinDeg,
} from "../core/math.js";
import { random } from "../core/random.js";
import { MAX_CARS, MODE, PHASE, game } from "../core/state.js";
import { tick } from "../core/tick.js";
import { carStats } from "../data/carStats.js";
import { BLEND, gl, keepDamageTexture } from "../render/renderer.js";
import { carModels, carTextures, scene } from "../render/scene.js";
import {
  DUST,
  burn,
  chipaway,
  chipburn,
  dustup,
  effects,
  firexp,
  sprks,
} from "./effects.js";
import { raceEvents } from "./events.js";
import { MISSED, SKID, STUNT, car, racers } from "./racers.js";
import { HIGHLIGHT, catchHighlight, recording } from "./recording.js";
import { PIECE, pieceModels, pieces, track } from "./track.js";

const drag = 0.05;
const lonorm = [];
export function inishmad() {
  for (let c = 0; c < MAX_CARS; c++) {
    // (a wall of the stage before, which may be gone: its piece's model with it)
    racers[c].wall = -1;
    racers[c].motionHeading = 0;
    racers[c].cameraHeading = 0;
    racers[c].dominate = [];
    racers[c].caught = [];
    for (let i = 0; i < MAX_CARS; i++) {
      racers[c].dominate[i] = false;
      racers[c].caught[i] = false;
    }
    racers[c].pitch = 0;
    racers[c].roll = 0;
    racers[c].speed = 0;
    racers[c].wheelSpeedY = [];
    racers[c].wheelSpeedX = [];
    racers[c].wheelSpeedZ = [];
    for (let i = 0; i < 4; i++) {
      racers[c].wheelSpeedY[i] = 0;
      racers[c].wheelSpeedX[i] = 0;
      racers[c].wheelSpeedZ[i] = 0;
    }
    racers[c].forca =
      ((Math.sqrt(
        car[c].keyz[0] * car[c].keyz[0] + car[c].keyx[0] * car[c].keyx[0],
      ) +
        Math.sqrt(
          car[c].keyz[1] * car[c].keyz[1] + car[c].keyx[1] * car[c].keyx[1],
        ) +
        Math.sqrt(
          car[c].keyz[2] * car[c].keyz[2] + car[c].keyx[2] * car[c].keyx[2],
        ) +
        Math.sqrt(
          car[c].keyz[3] * car[c].keyz[3] + car[c].keyx[3] * car[c].keyx[3],
        )) /
        1000) *
      (carStats.bounce[car[c].typ] - 0.3);
    racers[c].grounded = true;
    racers[c].wheelsTouch = true;
    racers[c].groundedTicks = 0;
    racers[c].capsized = false;
    racers[c].lastGripHeading = 0;
    racers[c].airTurn = 0;
    racers[c].pmlt = 1;
    racers[c].nmlt = 1;
    racers[c].dcnt = 0;
    racers[c].skid = SKID.gripping;
    racers[c].handbrakeHeldOnGround = false;
    racers[c].onFlatGround = false;
    racers[c].landedHoldingLeft = false;
    racers[c].landedHoldingRight = false;
    racers[c].landedHoldingDown = false;
    racers[c].landedHoldingUp = false;
    racers[c].leftHeldFromGround = false;
    racers[c].rightHeldFromGround = false;
    racers[c].upHeldFromGround = false;
    racers[c].downHeldFromGround = false;
    racers[c].stunt = STUNT.none;
    racers[c].flipForwardSpeed = 0;
    racers[c].flipBackSpeed = 0;
    racers[c].rollLeftSpeed = 0;
    racers[c].rollRightSpeed = 0;
    racers[c].touchedWall = false;
    racers[c].lastHeading = 0;
    racers[c].rolled = 0;
    racers[c].flipped = 0;
    racers[c].spun = 0;
    racers[c].countingStunt = 0;
    racers[c].capcnt = 0;
    racers[c].surfTicks = 0;
    racers[c].rolledFar = false;
    racers[c].flippedFarForward = false;
    racers[c].flippedFarBack = false;
    racers[c].surfed = false;
    racers[c].stuntPower = 0;
    racers[c].extraPower = 0;
    racers[c].tilt = 0;
    racers[c].crank = [];
    racers[c].lcrank = [];
    for (let i = 0; i < 4; i++) {
      racers[c].crank[i] = 0;
      racers[c].lcrank[i] = 0;
    }
    racers[c].squash = 0;
    racers[c].nbsq = 0;
    racers[c].damage = 0;
    racers[c].cntdest = 0;
    racers[c].wasted = false;
    racers[c].embos = 0;
    racers[c].embodir = 0;
    racers[c].embomag = 0;
    racers[c].bshft = 0;
    racers[c].clearedPathPoint = track.pcs;
    racers[c].clear = 0;
    racers[c].nlaps = 0;
    racers[c].focus = -1;
    racers[c].power = 98;
    racers[c].missedCheckpoint = MISSED.none;
    racers[c].lastcolido = 0;
    racers[c].nofocus = false;
    racers[c].point = 0;
    track.dested[c] = 0;
  }
  for (let i = 0; i < 2; i++) {
    lonorm[i] = 0;
  }
}
let flipont = false;
export function drive() {
  if (game.carCount != 1) {
    for (let c = 0; c < game.carCount; c++) {
      for (let xc = 0; xc < game.carCount; xc++) {
        if (xc != c) {
          colide(c, xc);
        }
      }
    }
  }
  if (raceEvents.onautocorrect) {
    if (racers[0].capsized) {
      if (racers[0].wheelsTouch) {
        if (flipont) {
          racers[0].roll += 180;
          flipont = false;
        }
      } else {
        flipont = true;
      }
    }
  }
  for (let c = 0; c < game.carCount; c++) {
    driveCar(c);
  }
}

function driveCar(c) {
  let type = car[c].typ;
  let flipSign = 1;
  let rollSign = 1;
  let pitchedOver = false,
    turnedRound = false;
  racers[c].capsized = false;
  let pitch = Math.abs(racers[c].pitch);
  while (pitch > 270) {
    pitch -= 360;
  }
  pitch = Math.abs(pitch);
  if (pitch > 90) {
    pitchedOver = true;
  }
  let rolledOver = false;
  let roll = Math.abs(racers[c].roll);
  while (roll > 270) {
    roll -= 360;
  }
  roll = Math.abs(roll);
  if (roll > 90) {
    rolledOver = true;
    rollSign = -1;
  }
  let wheelDrop = -car[c].grat;
  if (pitchedOver) {
    if (rolledOver) {
      rolledOver = false;
      turnedRound = true;
    } else {
      rolledOver = true;
      racers[c].capsized = true;
    }
    flipSign = -1;
  } else {
    if (rolledOver) {
      racers[c].capsized = true;
    }
  }
  if (racers[c].capsized) {
    wheelDrop = carStats.flipy[type] + racers[c].squash;
  }
  racers[c].u.zyinv = pitchedOver;
  // how the stunt keys push the car in the air
  const airPush = { x: 0, y: 0, z: 0 };
  if (racers[c].grounded) {
    racers[c].stunt = STUNT.none;
  }
  touchDownFromStunt(c);
  watchPlayerStuntKeys(c);
  startStuntWithHandbrake(c);
  startStunt(c);
  if (!racers[c].wasted) {
    if (racers[c].stunt == STUNT.flying) {
      rotateInStunt(c, type, airPush, rollSign, flipSign, pitchedOver);
    } else {
      driveOnGround(c, type, pitchedOver);
    }
  }
  rollWheels(c, type);
  steerFrontWheels(c, type);
  turnWithFrontWheels(c);
  swingCameraHeading(c);
  // where the wheels are and what they meet in this step, shared with its parts
  const step = { wheelX: [], wheelY: [], wheelZ: [], hitWall: false };
  placeWheelPoints(c, wheelDrop, step);
  let avgSpeedX =
    (racers[c].wheelSpeedX[0] +
      racers[c].wheelSpeedX[1] +
      racers[c].wheelSpeedX[2] +
      racers[c].wheelSpeedX[3]) /
    4;
  let avgSpeedZ =
    (racers[c].wheelSpeedZ[0] +
      racers[c].wheelSpeedZ[1] +
      racers[c].wheelSpeedZ[2] +
      racers[c].wheelSpeedZ[3]) /
    4;
  keepWheelSpeedsTogether(c, avgSpeedX, avgSpeedZ);
  moveWheelPoints(c, step);
  step.surface = DUST.ground;
  step.onTrackPiece = false;
  const under = pieceUnder(c);
  if (under != -1) {
    step.surface = pieceModels[pieces.list[under].typ].skid;
    step.onTrackPiece = true;
  }
  step.touchedGround = racers[c].grounded;
  if (racers[c].grounded) {
    gripGround(type, c, turnedRound, step);
  } else {
    if (racers[c].skid != SKID.takeSpeedFromMotion) {
      racers[c].skid = SKID.takeSpeedFromMotion;
    }
  }
  step.sparkKind = [];
  step.axleOnGround = [0, 0];
  step.wheelsOnGround = bounceWheelsOffGround(c, type, step);
  step.reachZ =
    Math.abs(carStats.boundr[type] * car[c].mat[10]) +
    Math.abs(2 * car[c].mat[8]);
  step.reachX =
    Math.abs(carStats.boundr[type] * car[c].mat[8]) +
    Math.abs(2 * car[c].mat[10]);
  step.slopeContacts = 0;
  for (let o = 0; o < pieces.count; o++) {
    meetPiece(o, c, type, step);
  }
  if (step.slopeContacts == 4) {
    racers[c].grounded = true;
  }
  bumpOnAxles(c, step, avgSpeedX, avgSpeedZ);
  throwScrapeSparks(c, type, step);
  bounceOffStageLimits(c, type, step);
  if (tick.fraction >= tick.scale) {
    for (let i = 0; i < 4; i++) {
      // The original also had `if (crank[c][i] == lcrank[c][i]) crank[c][i][k] = 0;` here,
      // a write onto a number that never had any effect (and throws in strict mode).
      racers[c].lcrank[i] = racers[c].crank[i];
    }
  }
  tiltWithWheels(c, pitchedOver, rolledOver, step);
  turnFromWallHits(c, step);
  settleLevel(c, step);
  if (tick.fraction >= tick.scale) {
    if (!racers[c].grounded && racers[c].wheelsTouch) {
      if (racers[c].groundedTicks == 10) {
        racers[c].grounded = true;
      } else {
        racers[c].groundedTicks++;
      }
    } else {
      racers[c].groundedTicks = 0;
    }
  }
  placeOnWheels(c, wheelDrop, airPush, flipSign, step);
  followTilt(c);
  leanIntoTurns(c, type);
  shakeOnRoughGround(c, type, step);
  burnWhenWasted(c, type, avgSpeedX, avgSpeedZ);
  const nearest = passCheckpoints(c);
  reportCheckpoints(c);
  racers[c].point = pathPointAhead(c, nearest);
  if (racers[c].nofocus) {
    racers[c].nofocus = false;
  }
  passFixHoops(c);
  trackStunt(c, type);
  if (racers[c].touchedWall) {
    racers[c].touchedWall = false;
  }
  if (
    tick.fraction >= tick.scale &&
    racers[c].lastcolido != 0 &&
    !racers[c].wasted
  ) {
    racers[c].lastcolido--;
  }
  recordHowWasted(c);
  countDownStuntHighlight(c);
  orientBody(c);
}

function reportCheckpoints(c) {
  if (c == game.player) {
    raceEvents.oncheckpoint = racers[c].clear;
    while (raceEvents.oncheckpoint >= track.nsp) {
      raceEvents.oncheckpoint -= track.nsp;
    }
    if (racers[c].clear == track.nlaps * track.nsp - 1) {
      raceEvents.onlastcheck = true;
    }
    if (track.haltall) {
      raceEvents.onlastcheck = false;
    }
  }
}

function pathPointAhead(c, pnt) {
  if (racers[c].focus == -1) {
    if (c == game.player) {
      pnt += 2;
    } else {
      pnt++;
    }
    if (!racers[c].nofocus) {
      if (
        track.stage == 5 &&
        (racers[c].clearedPathPoint == 27 ||
          racers[c].clearedPathPoint == 35) &&
        pnt < 29
      ) {
        pnt = 33;
      }
      let ic = racers[c].clearedPathPoint + 1;
      if (ic >= track.n) {
        ic = 0;
      }
      while (track.typ[ic] <= 0) {
        ic++;
        if (ic >= track.n) {
          ic = 0;
        }
      }
      if (pnt > ic) {
        if (
          racers[c].clear != racers[c].nlaps * track.nsp ||
          pnt < racers[c].clearedPathPoint
        ) {
          if (track.stage != 9 || ic != 9 || pnt < 16) {
            pnt = ic;
            racers[c].focus = pnt;
          } else {
            pnt = 0;
          }
        }
      }
    }
    if (pnt >= track.n) {
      pnt -= track.n;
    }
    if (track.typ[pnt] == -3) {
      pnt = 0;
    }
    if (c == game.player) {
      if (racers[c].missedCheckpoint != MISSED.following) {
        racers[c].missedCheckpoint = MISSED.following;
      }
    } else {
      if (racers[c].missedCheckpoint != MISSED.none) {
        racers[c].missedCheckpoint = MISSED.none;
      }
    }
  } else {
    pnt = racers[c].focus;
    if (c == game.player) {
      if (
        racers[c].missedCheckpoint == MISSED.none &&
        racers[c].grounded &&
        Math.sqrt(
          distanceSquaredXZ(
            car[c].x / 10,
            track.x[racers[c].focus] / 10,
            car[c].z / 10,
            track.z[racers[c].focus] / 10,
          ),
        ) > 80
      ) {
        racers[c].missedCheckpoint = MISSED.started;
      }
      if (
        racers[c].missedCheckpoint == MISSED.warned &&
        Math.sqrt(
          distanceSquaredXZ(
            car[c].x / 10,
            track.x[racers[c].focus] / 10,
            car[c].z / 10,
            track.z[racers[c].focus] / 10,
          ),
        ) < 40
      ) {
        racers[c].missedCheckpoint = MISSED.none;
      }
      if (
        racers[c].missedCheckpoint != MISSED.none &&
        racers[c].grounded &&
        Math.sqrt(
          distanceSquaredXZ(
            car[c].x / 10,
            track.x[racers[c].focus] / 10,
            car[c].z / 10,
            track.z[racers[c].focus] / 10,
          ),
        ) < 25
      ) {
        racers[c].missedCheckpoint = MISSED.comingBack;
      }
    } else {
      racers[c].missedCheckpoint = MISSED.started;
    }
    if (racers[c].nofocus) {
      racers[c].focus = -1;
      racers[c].missedCheckpoint = MISSED.none;
    }
  }
  return pnt;
}

function passFixHoops(c) {
  if (game.mode != MODE.switchCars) {
    if (!car[c].fcnt) {
      for (let i = 0; i < pieces.fixCount; i++) {
        if (
          Math.abs(pieces.list[pieces.fixes[i]].mat[10]) >
          Math.abs(pieces.list[pieces.fixes[i]].mat[8])
        ) {
          if (
            Math.abs(car[c].z - pieces.list[pieces.fixes[i]].z) < 20 &&
            distanceXZ(
              car[c].x,
              pieces.list[pieces.fixes[i]].x,
              car[c].y,
              pieces.list[pieces.fixes[i]].y,
            ) < 55
          ) {
            car[c].fcnt = 20;
            recording.tape.cars[c].fixAt[recording.tape.cars[c].fixCount] = 430;
            recording.tape.cars[c].fixCount++;
            if (c == game.player) {
              playSound(29, 1);
            }
          }
        } else {
          if (
            Math.abs(car[c].x - pieces.list[pieces.fixes[i]].x) < 20 &&
            distanceXZ(
              car[c].z,
              pieces.list[pieces.fixes[i]].z,
              car[c].y,
              pieces.list[pieces.fixes[i]].y,
            ) < 55
          ) {
            car[c].fcnt = 20;
            recording.tape.cars[c].fixAt[recording.tape.cars[c].fixCount] = 430;
            recording.tape.cars[c].fixCount++;
            if (c == game.player) {
              playSound(29, 1);
            }
          }
        }
      }
    } else {
      raceEvents.onelec = true;
      racers[c].body.alpha = BLEND.alpha;
      if (car[c].fcnt % 2 == 0) {
        if (random.fx() > 0.333) {
          if (random.fx() > random.fx()) {
            racers[c].body.alpha = BLEND.brightGlow;
          } else {
            racers[c].body.alpha = BLEND.glow;
          }
        }
      }
      if (tick.fraction >= tick.scale) {
        if (car[c].fcnt == 20) {
          racers[c].squash = 0;
          racers[c].nbsq = 0;
          racers[c].damage = 0;
          racers[c].cntdest = 0;
          racers[c].wasted = false;
          if (c == game.player) {
            raceEvents.playerWreckTicks = 0;
          }
        }
        if (car[c].fcnt == 5) {
          fixcar(c);
        }
        car[c].fcnt--;
      }
    }
  }
}

function trackStunt(c, type) {
  if (!racers[c].grounded) {
    countStuntInAir(c);
  } else if (!racers[c].wasted) {
    if (!racers[c].capsized) {
      if (racers[c].capcnt != 0) {
        racers[c].capcnt = 0;
      }
      if (
        racers[c].onFlatGround &&
        tick.fraction >= tick.scale &&
        racers[c].countingStunt != 0
      ) {
        if (racers[c].countingStunt == 9) {
          rewardStunt(c);
        }
        if (racers[c].countingStunt == 10) {
          forgetStunt(c);
        } else {
          racers[c].countingStunt++;
        }
      }
    } else {
      if (racers[c].countingStunt != 0) {
        forgetStunt(c);
      }
      flipBackWhenCapsized(c, type);
    }
    if (racers[c].countingStunt == 0 && racers[c].speed != 0) {
      drainPower(c, type);
    }
  }
}

// Adds up how far the car rolls, flips and spins in the air, and whether it surfs a wall
// on the way up.
function countStuntInAir(c) {
  if (racers[c].countingStunt != 1) {
    racers[c].countingStunt = 1;
    racers[c].lastHeading = car[c].xz;
  }
  if (
    racers[c].stunt == STUNT.flying ||
    racers[c].stunt == STUNT.touchingDown
  ) {
    racers[c].rolled +=
      (racers[c].rollRightSpeed - racers[c].rollLeftSpeed) * tick.scale;
    if (Math.abs(racers[c].rolled) > 135) {
      racers[c].rolledFar = true;
    }
    racers[c].flipped +=
      (racers[c].flipForwardSpeed - racers[c].flipBackSpeed) * tick.scale;
    if (racers[c].flipped > 135) {
      racers[c].flippedFarForward = true;
    }
    if (racers[c].flipped < -135) {
      racers[c].flippedFarBack = true;
    }
  }
  if (racers[c].lastHeading != car[c].xz) {
    racers[c].spun += racers[c].lastHeading - car[c].xz;
    racers[c].lastHeading = car[c].xz;
  }
  if (tick.fraction >= tick.scale) {
    if (racers[c].surfTicks < 10) {
      if (racers[c].touchedWall) {
        racers[c].surfed = true;
      }
      racers[c].surfTicks++;
    }
  }
}

// Turns the stunt into power some ticks after landing it.
function rewardStunt(c) {
  racers[c].stuntPower = 0;
  if (Math.abs(racers[c].rolled) > 90) {
    racers[c].stuntPower += Math.abs(racers[c].rolled) / 24;
  } else {
    if (racers[c].rolledFar) {
      racers[c].stuntPower += 30;
    }
  }
  if (Math.abs(racers[c].flipped) > 90) {
    racers[c].stuntPower += Math.abs(racers[c].flipped) / 18;
  } else {
    if (racers[c].flippedFarForward) {
      racers[c].stuntPower += 40;
    }
    if (racers[c].flippedFarBack) {
      racers[c].stuntPower += 40;
    }
  }
  if (Math.abs(racers[c].spun) > 90) {
    racers[c].stuntPower += Math.abs(racers[c].spun) / 18;
  }
  if (racers[c].surfed) {
    racers[c].stuntPower += 30;
  }
  racers[c].power += racers[c].stuntPower;
  if (
    c == game.player &&
    racers[c].stuntPower > recording.bestPowerUp &&
    recording.highlight <= HIGHLIGHT.stunt &&
    (racers[c].stuntPower > 60 || track.stage == 1 || track.stage == 2)
  ) {
    recording.stuntCatchTicks = 43;
    recording.bestPowerUp = racers[c].stuntPower;
  }
  if (racers[c].power > 98) {
    racers[c].power = 98;
    if (racers[c].stuntPower > 150) {
      racers[c].extraPower = 200;
    } else {
      racers[c].extraPower = 100;
    }
  }
}

function forgetStunt(c) {
  racers[c].rolled = 0;
  racers[c].flipped = 0;
  racers[c].spun = 0;
  racers[c].flippedFarForward = false;
  racers[c].rolledFar = false;
  racers[c].flippedFarBack = false;
  racers[c].countingStunt = 0;
  racers[c].surfTicks = 0;
  racers[c].surfed = false;
}

// Rights a car lying still on its roof after a while; in the first races the player is
// righted sooner, even while still sliding.
function flipBackWhenCapsized(c, type) {
  let flmat = 7,
    capto = 30;
  if (c == game.player) {
    if (track.stage == 1 && game.unlocked == 1) {
      flmat = 30;
      capto = 10;
    }
    if (track.stage == 2 && game.unlocked == 2) {
      flmat = 30;
      capto = 10;
    }
    if (track.stage == 3 && game.unlocked == 3) {
      flmat = 25;
      capto = 15;
    }
    if (track.stage == 4 && game.unlocked == 4) {
      flmat = 20;
      capto = 20;
    }
    if (track.stage == 5 && game.unlocked == 5) {
      flmat = 14;
      capto = 25;
    }
  }
  if (racers[c].capcnt == 0) {
    let out = 0;
    for (let i = 0; i < 4; i++) {
      if (
        Math.abs(racers[c].wheelSpeedZ[i]) < flmat &&
        Math.abs(racers[c].wheelSpeedX[i]) < flmat
      ) {
        out++;
      }
    }
    if (out == 4) {
      racers[c].capcnt = 1;
    }
  } else {
    if (tick.fraction >= tick.scale) {
      racers[c].capcnt++;
      if (racers[c].capcnt == capto) {
        racers[c].speed = 0;
        car[c].y += carStats.flipy[type];
        racers[c].roll += 180;
        car[c].xy += 180;
        racers[c].capcnt = 0;
      }
    }
  }
}

// Power fades while driving without a stunt; the first races fade it slower for the player.
function drainPower(c, type) {
  let pfact = 1;
  if (c == game.player) {
    if (track.stage == 1 && game.unlocked == 1) {
      pfact = 0.6;
    }
    if (track.stage == 2 && game.unlocked == 2) {
      pfact = 0.7;
    }
    if (track.stage == 3 && game.unlocked == 3) {
      pfact = 0.8;
    }
    if (track.stage == 4 && game.unlocked == 4) {
      pfact = 0.9;
    }
  }
  if (racers[c].extraPower == 0) {
    if (racers[c].power > 0) {
      racers[c].power -=
        (racers[c].power * racers[c].power * racers[c].power * pfact) /
        carStats.powerloss[type];
    } else {
      racers[c].power = 0;
    }
  } else {
    racers[c].extraPower--;
  }
}

function recordHowWasted(c) {
  if (racers[c].wasted) {
    if (track.dested[c] == 0) {
      if (racers[c].lastcolido == 0) {
        track.dested[c] = 1;
      } else {
        track.dested[c] = 2;
      }
    }
  } else {
    if (track.dested[c] != 0 && track.dested[c] != 3) {
      track.dested[c] = 0;
    }
  }
}

function countDownStuntHighlight(c) {
  if (
    c == game.player &&
    recording.stuntCatchTicks != 0 &&
    recording.highlight <= HIGHLIGHT.stunt
  ) {
    recording.stuntCatchTicks--;
    if (recording.stuntCatchTicks == 0) {
      catchHighlight(1);
      if (recording.highlight == HIGHLIGHT.stunt) {
        recording.highlightAt = 265 + random.fx() * 30;
      }
    }
  }
}

function orientBody(c) {
  let xmt = [1, 0, 0];
  let ymt = [0, 1, 0];
  let zmt = [0, 0, 1];
  rotateAxes(xmt, ymt, car[c].xy);
  rotateAxes(ymt, zmt, car[c].zy);
  rotateAxes(xmt, zmt, car[c].xz);
  car[c].mat[0] = xmt[0];
  car[c].mat[1] = ymt[0];
  car[c].mat[2] = zmt[0];
  car[c].mat[4] = xmt[1];
  car[c].mat[5] = ymt[1];
  car[c].mat[6] = zmt[1];
  car[c].mat[8] = xmt[2];
  car[c].mat[9] = ymt[2];
  car[c].mat[10] = zmt[2];
  if (racers[c].embodir) {
    car[c].mat[racers[c].embodir * 4] *= racers[c].embomag;
    car[c].mat[racers[c].embodir * 4 + 1] *= racers[c].embomag;
    car[c].mat[racers[c].embodir * 4 + 2] *= racers[c].embomag;
  }
}

function tiltWithWheels(c, pitchedOver, rolledOver, step) {
  let pitchTilt = 0,
    otherPitchTilt = 0,
    rollTilt = 0,
    otherRollTilt = 0;
  if (racers[c].wheelSpeedY[2] != racers[c].wheelSpeedY[0]) {
    pitchTilt = tiltBetween(
      c,
      0,
      2,
      Math.abs(car[c].keyz[0]) + Math.abs(car[c].keyz[2]),
      step,
    );
  }
  if (racers[c].wheelSpeedY[3] != racers[c].wheelSpeedY[1]) {
    otherPitchTilt = tiltBetween(
      c,
      1,
      3,
      Math.abs(car[c].keyz[1]) + Math.abs(car[c].keyz[3]),
      step,
    );
  }
  if (racers[c].wheelSpeedY[1] != racers[c].wheelSpeedY[0]) {
    rollTilt = tiltBetween(
      c,
      0,
      1,
      Math.abs(car[c].keyx[0]) + Math.abs(car[c].keyx[1]),
      step,
    );
  }
  if (racers[c].wheelSpeedY[3] != racers[c].wheelSpeedY[2]) {
    otherRollTilt = tiltBetween(
      c,
      2,
      3,
      Math.abs(car[c].keyx[2]) + Math.abs(car[c].keyx[3]),
      step,
    );
  }
  if (Math.abs(otherPitchTilt) > Math.abs(pitchTilt)) {
    pitchTilt = otherPitchTilt;
  }
  if (Math.abs(otherRollTilt) > Math.abs(rollTilt)) {
    rollTilt = otherRollTilt;
  }
  if (!pitchedOver) {
    racers[c].pitch += pitchTilt * tick.scale;
  } else {
    racers[c].pitch -= pitchTilt * tick.scale;
  }
  if (!rolledOver) {
    racers[c].roll += rollTilt * tick.scale;
  } else {
    racers[c].roll -= rollTilt * tick.scale;
  }
}

function turnFromWallHits(c, step) {
  if (step.hitWall) {
    let dxz = Math.abs(car[c].xz + 45);
    while (dxz > 180) {
      dxz -= 360;
    }
    if (Math.abs(dxz) > 90) {
      racers[c].pmlt = 1;
    } else {
      racers[c].pmlt = -1;
    }
    dxz = Math.abs(car[c].xz - 45);
    while (dxz > 180) {
      dxz -= 360;
    }
    if (Math.abs(dxz) > 90) {
      racers[c].nmlt = 1;
    } else {
      racers[c].nmlt = -1;
    }
  }
  car[c].xz +=
    racers[c].forca *
    10 *
    tick.scale *
    (racers[c].wheelSpeedZ[0] * racers[c].nmlt -
      racers[c].wheelSpeedZ[1] * racers[c].pmlt +
      racers[c].wheelSpeedZ[2] * racers[c].pmlt -
      racers[c].wheelSpeedZ[3] * racers[c].nmlt +
      racers[c].wheelSpeedX[0] * racers[c].pmlt +
      racers[c].wheelSpeedX[1] * racers[c].nmlt -
      racers[c].wheelSpeedX[2] * racers[c].nmlt -
      racers[c].wheelSpeedX[3] * racers[c].pmlt);
}

function settleLevel(c, step) {
  if (step.wheelsOnGround == 4) {
    let tat = 0;
    while (racers[c].pitch < 360) {
      racers[c].pitch += 360;
      car[c].zy += 360;
    }
    while (racers[c].pitch > 360) {
      racers[c].pitch -= 360;
      car[c].zy -= 360;
    }
    if (racers[c].pitch < 190 && racers[c].pitch > 170) {
      racers[c].pitch = 180;
      car[c].zy = 180;
      tat++;
    }
    if (racers[c].pitch > 350 || racers[c].pitch < 10) {
      racers[c].pitch = 0;
      car[c].zy = 0;
      tat++;
    }
    while (racers[c].roll < 360) {
      racers[c].roll += 360;
      car[c].xy += 360;
    }
    while (racers[c].roll > 360) {
      racers[c].roll -= 360;
      car[c].xy -= 360;
    }
    if (racers[c].roll < 190 && racers[c].roll > 170) {
      racers[c].roll = 180;
      car[c].xy = 180;
      tat++;
    }
    if (racers[c].roll > 350 || racers[c].roll < 10) {
      racers[c].roll = 0;
      car[c].xy = 0;
      tat++;
    }
    if (tat == 2) {
      racers[c].grounded = true;
    }
  }
}

function placeOnWheels(c, wheelDrop, airPush, flipSign, step) {
  car[c].y =
    (step.wheelY[0] + step.wheelY[1] + step.wheelY[2] + step.wheelY[3]) / 4 -
    wheelDrop * cosDeg(racers[c].pitch) * cosDeg(racers[c].roll) +
    airPush.y * tick.scale;
  car[c].x =
    (step.wheelX[0] -
      car[c].keyx[0] * cosDeg(car[c].xz) +
      flipSign * car[c].keyz[0] * sinDeg(car[c].xz) +
      step.wheelX[1] -
      car[c].keyx[1] * cosDeg(car[c].xz) +
      flipSign * car[c].keyz[1] * sinDeg(car[c].xz) +
      step.wheelX[2] -
      car[c].keyx[2] * cosDeg(car[c].xz) +
      flipSign * car[c].keyz[2] * sinDeg(car[c].xz) +
      step.wheelX[3] -
      car[c].keyx[3] * cosDeg(car[c].xz) +
      flipSign * car[c].keyz[3] * sinDeg(car[c].xz)) /
      4 +
    wheelDrop * sinDeg(racers[c].roll) * cosDeg(car[c].xz) -
    wheelDrop * sinDeg(racers[c].pitch) * sinDeg(car[c].xz) +
    airPush.x * tick.scale;
  car[c].z =
    (step.wheelZ[0] -
      flipSign * car[c].keyz[0] * cosDeg(car[c].xz) -
      car[c].keyx[0] * sinDeg(car[c].xz) +
      step.wheelZ[1] -
      flipSign * car[c].keyz[1] * cosDeg(car[c].xz) -
      car[c].keyx[1] * sinDeg(car[c].xz) +
      step.wheelZ[2] -
      flipSign * car[c].keyz[2] * cosDeg(car[c].xz) -
      car[c].keyx[2] * sinDeg(car[c].xz) +
      step.wheelZ[3] -
      flipSign * car[c].keyz[3] * cosDeg(car[c].xz) -
      car[c].keyx[3] * sinDeg(car[c].xz)) /
      4 +
    wheelDrop * sinDeg(racers[c].roll) * sinDeg(car[c].xz) -
    wheelDrop * sinDeg(racers[c].pitch) * cosDeg(car[c].xz) +
    airPush.z * tick.scale;
}

function followTilt(c) {
  if (Math.abs(racers[c].speed) > 10 || !racers[c].grounded) {
    if (Math.abs(racers[c].roll - car[c].xy) >= 4 * tick.scale) {
      if (racers[c].roll > car[c].xy) {
        car[c].xy += 2 * tick.scale + (racers[c].roll - car[c].xy) / 2;
      } else {
        car[c].xy -= 2 * tick.scale + (car[c].xy - racers[c].roll) / 2;
      }
    } else {
      car[c].xy = racers[c].roll;
    }
    if (Math.abs(racers[c].pitch - car[c].zy) >= 4 * tick.scale) {
      if (racers[c].pitch > car[c].zy) {
        car[c].zy += 2 * tick.scale + (racers[c].pitch - car[c].zy) / 2;
      } else {
        car[c].zy -= 2 * tick.scale + (car[c].zy - racers[c].pitch) / 2;
      }
    } else {
      car[c].zy = racers[c].pitch;
    }
  }
}

function leanIntoTurns(c, type) {
  if (racers[c].wheelsTouch && !racers[c].capsized) {
    let mtilt =
      (racers[c].speed / carStats.swits[type][2]) *
      14 *
      (carStats.bounce[type] - 0.4);
    if (racers[c].u.left && racers[c].tilt < mtilt && racers[c].tilt >= 0) {
      racers[c].tilt += 0.4 * tick.scale;
    } else {
      if (racers[c].u.right && racers[c].tilt > -mtilt && racers[c].tilt <= 0) {
        racers[c].tilt -= 0.4 * tick.scale;
      } else {
        if (Math.abs(racers[c].tilt) > 3 * (carStats.bounce[type] - 0.4)) {
          if (racers[c].tilt > 0) {
            racers[c].tilt -= 3 * (carStats.bounce[type] - 0.3);
          } else {
            racers[c].tilt += 3 * (carStats.bounce[type] - 0.3);
          }
        } else {
          racers[c].tilt = 0;
        }
      }
    }
    car[c].xy += racers[c].tilt;
    if (racers[c].onFlatGround) {
      car[c].y -= (Math.abs(racers[c].tilt) / 30) * tick.scale;
    }
  } else {
    if (racers[c].tilt != 0) {
      racers[c].tilt = 0;
    }
  }
}

function shakeOnRoughGround(c, type, step) {
  if (tick.fraction >= tick.scale) {
    if (racers[c].grounded && step.surface == DUST.sand) {
      car[c].zy +=
        ((random.sim() * 5 * racers[c].speed) / carStats.swits[type][2] -
          (2.5 * racers[c].speed) / carStats.swits[type][2]) *
        (carStats.bounce[type] - 0.3);
      car[c].xy +=
        ((random.sim() * 5 * racers[c].speed) / carStats.swits[type][2] -
          (2.5 * racers[c].speed) / carStats.swits[type][2]) *
        (carStats.bounce[type] - 0.3);
    }
    if (racers[c].wheelsTouch && step.surface == DUST.ground) {
      car[c].zy +=
        ((random.sim() * 3.34 * racers[c].speed) / carStats.swits[type][2] -
          (1.67 * racers[c].speed) / carStats.swits[type][2]) *
        (carStats.bounce[type] - 0.3);
      car[c].xy +=
        ((random.sim() * 3.34 * racers[c].speed) / carStats.swits[type][2] -
          (1.67 * racers[c].speed) / carStats.swits[type][2]) *
        (carStats.bounce[type] - 0.3);
    }
  }
}

function burnWhenWasted(c, type, avgSpeedX, avgSpeedZ) {
  if (tick.fraction >= tick.scale) {
    if (racers[c].damage >= carStats.maxmag[type]) {
      if (recording.tape.cars[c].wastedAt == 700) {
        recording.tape.cars[c].wastedAt = 430;
        if (racers[c].lastcolido != 0) {
          recording.tape.cars[c].playerHitTicks = racers[c].lastcolido;
        }
      }
      if (racers[c].cntdest < 6) {
        if (racers[c].embos == 0) {
          racers[c].body.alpha = BLEND.alpha;
          racers[c].embodir = Math.floor(random.fx() * 3);
          if (racers[c].embodir == 3) {
            racers[c].embodir = 0;
          }
          racers[c].embomag = 1.2 + random.fx() * 0.2;
        }
        if (racers[c].embos == 1) {
          racers[c].body.alpha = BLEND.glow;
        }
        racers[c].embos++;
        if (racers[c].embos == 2) {
          racers[c].embos = 0;
          racers[c].cntdest++;
        }
      } else {
        if (racers[c].cntdest == 6) {
          racers[c].body.alpha = BLEND.alpha;
          racers[c].embodir = 0;
          chipburn(c);
          racers[c].embos = 0;
          racers[c].cntdest = 7;
        }
        firexp(
          c,
          avgSpeedX,
          (racers[c].wheelSpeedY[0] +
            racers[c].wheelSpeedY[1] +
            racers[c].wheelSpeedY[2] +
            racers[c].wheelSpeedY[3]) /
            4,
          avgSpeedZ,
        );
        if (racers[c].cntdest < 24) {
          racers[c].embos++;
          if (racers[c].embos == 5) {
            burn(c);
            racers[c].embos = 0;
            racers[c].cntdest++;
          }
        }
      }
      if (racers[c].cntdest == 4) {
        racers[c].wasted = true;
      }
    }
  }
}

// Clears the checkpoints the car drives through, counts its laps and returns the path
// point nearest to it. Points before the checkpoint it cleared last count as 7 times as
// far, so the nearest is one ahead, unless the car lost its way (nofocus).
function passCheckpoints(c) {
  let pnt = 0,
    pyclos = 0;
  let ic = 0;
  let weight;
  if (racers[c].nofocus) {
    weight = 1;
  } else {
    weight = 7;
  }
  for (let i = 0; i < track.n; i++) {
    if (track.typ[i] > 0) {
      ic++;
      if (track.typ[i] == 1) {
        if (racers[c].clear == ic + racers[c].nlaps * track.nsp) {
          weight = 1;
        }
        if (
          Math.abs(car[c].z - track.z[i]) <
            6 +
              Math.abs(
                racers[c].wheelSpeedZ[0] +
                  racers[c].wheelSpeedZ[1] +
                  racers[c].wheelSpeedZ[2] +
                  racers[c].wheelSpeedZ[3],
              ) /
                4 &&
          Math.abs(car[c].x - track.x[i]) < 70 &&
          Math.abs(car[c].y - track.y[i] - 15) < 45
        ) {
          if (racers[c].clear == ic + racers[c].nlaps * track.nsp - 1) {
            racers[c].clear = ic + racers[c].nlaps * track.nsp;
            racers[c].clearedPathPoint = i;
            racers[c].focus = -1;
          }
        }
      }
      if (track.typ[i] == 2) {
        if (racers[c].clear == ic + racers[c].nlaps * track.nsp) {
          weight = 1;
        }
        if (
          Math.abs(car[c].x - track.x[i]) <
            6 +
              Math.abs(
                racers[c].wheelSpeedX[0] +
                  racers[c].wheelSpeedX[1] +
                  racers[c].wheelSpeedX[2] +
                  racers[c].wheelSpeedX[3],
              ) /
                4 &&
          Math.abs(car[c].z - track.z[i]) < 70 &&
          Math.abs(car[c].y - track.y[i] - 15) < 45
        ) {
          if (racers[c].clear == ic + racers[c].nlaps * track.nsp - 1) {
            racers[c].clear = ic + racers[c].nlaps * track.nsp;
            racers[c].clearedPathPoint = i;
            racers[c].focus = -1;
          }
        }
      }
    }
    if (
      distanceSquaredXZ(
        car[c].x / 10,
        track.x[i] / 10,
        car[c].z / 10,
        track.z[i] / 10,
      ) *
        weight <
        pyclos ||
      pyclos == 0
    ) {
      pnt = i;
      pyclos =
        distanceSquaredXZ(
          car[c].x / 10,
          track.x[i] / 10,
          car[c].z / 10,
          track.z[i] / 10,
        ) * weight;
    }
  }
  if (racers[c].clear == ic + racers[c].nlaps * track.nsp) {
    racers[c].nlaps++;
  }
  return pnt;
}

function bumpOnAxles(c, step, avgSpeedX, avgSpeedZ) {
  if (c == game.player) {
    for (let i = 0; i < 2; i++) {
      if (lonorm[i] != step.axleOnGround[i]) {
        if (lonorm[i] > 0 && step.axleOnGround[i] > 0) {
          if (Math.abs(lonorm[i] - step.axleOnGround[i]) > 0.015) {
            bumpSound(
              i,
              Math.sqrt(avgSpeedX * avgSpeedX + avgSpeedZ * avgSpeedZ),
              step.surface,
            );
          }
        }
        lonorm[i] = step.axleOnGround[i];
      }
    }
  }
}

function throwScrapeSparks(c, type, step) {
  if (tick.fraction >= tick.scale) {
    let allsparks = 0;
    for (let k = 0; k < 4; k++) {
      if (step.sparkKind[k] == 1) {
        allsparks++;
      }
    }
    if (allsparks != 4) {
      for (let k = 0; k < 4; k++) {
        if (step.sparkKind[k] == 1) {
          sprks(
            type,
            step.wheelX[k],
            step.wheelY[k],
            step.wheelZ[k],
            racers[c].wheelSpeedX[k],
            racers[c].wheelSpeedY[k],
            racers[c].wheelSpeedZ[k],
            1,
          );
        }
        if (step.sparkKind[k]) {
          groundScrapeOf(
            c,
            step.sparkKind[k],
            racers[c].wheelSpeedX[k],
            racers[c].wheelSpeedY[k],
            racers[c].wheelSpeedZ[k],
          );
        }
      }
    } else {
      let k = Math.floor(random.fx() * 4);
      if (k == 4) {
        k = 0;
      }
      sprks(
        type,
        (step.wheelX[k] + car[c].x) / 2,
        step.wheelY[k],
        (step.wheelZ[k] + car[c].z) / 2,
        racers[c].wheelSpeedX[k],
        racers[c].wheelSpeedY[k],
        racers[c].wheelSpeedZ[k],
        1,
      );
      k = Math.floor(random.fx() * 4);
      if (k == 4) {
        k = 0;
      }
      sprks(
        type,
        (step.wheelX[k] + car[c].x) / 2,
        step.wheelY[k],
        (step.wheelZ[k] + car[c].z) / 2,
        racers[c].wheelSpeedX[k],
        racers[c].wheelSpeedY[k],
        racers[c].wheelSpeedZ[k],
        1,
      );
      groundScrapeOf(
        c,
        1,
        racers[c].wheelSpeedX[k],
        racers[c].wheelSpeedY[k],
        racers[c].wheelSpeedZ[k],
      );
    }
  }
}

function bounceOffStageLimits(c, type, step) {
  for (let k = 0; k < 4; k++) {
    if (
      step.wheelZ[k] < track.limb + step.reachZ &&
      step.wheelZ[k] > track.limb + step.reachZ - 20
    ) {
      bounceOffWallFacingPlusZ(c, k, type, track.limb, 1, true, step);
      step.hitWall = true;
      racers[c].wall = track.limbo;
    }
    if (
      step.wheelZ[k] > track.limt - step.reachZ &&
      step.wheelZ[k] < track.limt - step.reachZ + 20
    ) {
      bounceOffWallFacingMinusZ(c, k, type, track.limt, 1, true, step);
      step.hitWall = true;
      racers[c].wall = track.limto;
    }
    if (
      step.wheelX[k] < track.limr + step.reachX &&
      step.wheelX[k] > track.limr + step.reachX - 20
    ) {
      bounceOffWallFacingPlusX(c, k, type, track.limr, 1, true, step);
      step.hitWall = true;
      racers[c].wall = track.limro;
    }
    if (
      step.wheelX[k] > track.liml - step.reachX &&
      step.wheelX[k] < track.liml - step.reachX + 20
    ) {
      bounceOffWallFacingMinusX(c, k, type, track.liml, 1, true, step);
      step.hitWall = true;
      racers[c].wall = track.limlo;
    }
  }
}

function meetPiece(o, c, type, step) {
  const piece = pieces.list[o];
  const rad = pieceModels[piece.typ];
  let sandSlopeContacts = 0;
  let flatContacts = 0;
  if (rad.intershad || rad.interact) {
    if (
      Math.abs(car[c].x - piece.x) < rad.colrad + carModels[type].colrad &&
      Math.abs(car[c].y - piece.y) < rad.colrad + carModels[type].colrad &&
      Math.abs(car[c].z - piece.z) < rad.colrad + carModels[type].colrad
    ) {
      rad.x = piece.x;
      rad.y = piece.y;
      rad.z = piece.z;
      rad.mat = piece.mat;
      const passesWalls = passesWallsOf(piece.typ, car[c].y);
      const passesGround = piece.typ == PIECE.froad;
      for (let k = 0; k < 4; k++) {
        if (
          Math.abs(step.wheelX[k] - piece.x) < piece.bx &&
          Math.abs(step.wheelZ[k] - piece.z) < piece.bz &&
          Math.abs(step.wheelY[k] - piece.y) < piece.by
        ) {
          for (let i = 0; i < rad.ni / 3; i++) {
            const tri = triangleOf(rad, i);
            // the wheel seen from the piece, a little higher for walls
            const at = {
              x: step.wheelX[k] - rad.x,
              y: step.wheelY[k] + 7 - rad.y,
              z: step.wheelZ[k] - rad.z,
            };
            if (Math.abs(tri.ny) < rad.walarc && !passesWalls) {
              const atAnySpeed =
                !rad.interact && reshapeWall(tri, piece.typ, i);
              bounceOffWalls(c, k, type, o, rad, tri, at, atAnySpeed, step);
            }
            if (piece.typ == PIECE.halfpipe) {
              tri.ny = Math.abs(tri.ny);
            }
            if (tri.ny > 0.4 && !passesGround) {
              if (overTriangle(tri.x, tri.z, at.x, at.z)) {
                let coly = pointOnTriangle(
                  tri.z,
                  tri.x,
                  tri.y,
                  step.wheelZ[k],
                  rad.z,
                  step.wheelX[k],
                  rad.x,
                  rad.y,
                );
                if (Math.abs(tri.ny) == 1) {
                  if (
                    step.wheelY[k] < coly - 0.05 &&
                    step.wheelY[k] > coly - 20
                  ) {
                    flatContacts++;
                    landOnFlat(c, k, type, coly, step);
                  }
                } else {
                  let colx = pointOnTriangle(
                    tri.z,
                    tri.y,
                    tri.x,
                    step.wheelZ[k],
                    rad.z,
                    step.wheelY[k],
                    rad.y,
                    rad.x,
                  );
                  let colz = pointOnTriangle(
                    tri.y,
                    tri.x,
                    tri.z,
                    step.wheelY[k],
                    rad.y,
                    step.wheelX[k],
                    rad.x,
                    rad.z,
                  );
                  if (step.wheelY[k] < coly && step.wheelY[k] > coly - 20) {
                    if (step.surface == DUST.sand) {
                      sandSlopeContacts++;
                    } else {
                      step.slopeContacts++;
                    }
                    landOnSlope(tri, c, k, type, o, coly, colz, colx, i, step);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  if (sandSlopeContacts == 4) {
    racers[c].grounded = true;
  }
  if (flatContacts == 4) {
    step.wheelsOnGround = 4;
  }
}

// Whether wheels pass through the piece's walls: the sideoffs' always, the rolls' and the
// launchpad's once the car is high enough to be on top of them.
function passesWallsOf(typ, carY) {
  return (
    typ == PIECE.sideoff ||
    typ == PIECE.bsideoff ||
    ((typ == PIECE.roll1 || typ == PIECE.roll2) && carY > 70) ||
    ((typ == PIECE.roll5 || typ == PIECE.roll3) && carY > 140) ||
    (typ == PIECE.roll4 && carY > 280) ||
    (typ == PIECE.roll6 && carY > 310) ||
    (typ == PIECE.launchpad && carY > 100)
  );
}

// Reshapes a wall triangle of a solid piece before the wheels meet it: most walls reach
// 100 further down so wheels cannot slip under them, and two tside triangles become steep
// ramps. Returns whether those ramps bounce wheels whatever their speed.
function reshapeWall(tri, typ, i) {
  if (typ != PIECE.tside) {
    let verlow = 10000;
    for (let j = 0; j < 3; j++) {
      if (tri.y[j] < verlow) {
        verlow = tri.y[j];
      }
    }
    for (let j = 0; j < 3; j++) {
      if (Math.abs(tri.y[j] - verlow) < 2) {
        tri.y[j] -= 100;
      }
    }
    return false;
  }
  if (i == 43) {
    if (Math.abs(tri.nz) == 1) {
      tri.x[0] = -tri.x[1];
      tri.x[2] = -tri.x[1];
      tri.y[0] += 50;
      tri.y[1] = -10;
      tri.y[2] = -10;
    }
    if (Math.abs(tri.nx) == 1) {
      tri.z[0] = -tri.z[1];
      tri.z[2] = -tri.z[1];
      tri.y[0] += 50;
      tri.y[1] = -10;
      tri.y[2] = -10;
    }
    return true;
  }
  if (i == 44) {
    if (Math.abs(tri.nz) == 1) {
      tri.x[1] = -tri.x[0];
      tri.y[1] += 50;
      tri.y[2] += 50;
      tri.y[0] = -10;
    }
    if (Math.abs(tri.nx) == 1) {
      tri.z[1] = -tri.z[0];
      tri.y[1] += 50;
      tri.y[2] += 50;
      tri.y[0] = -10;
    }
    return true;
  }
  return false;
}

function bounceOffWalls(c, k, type, o, rad, tri, at, atAnySpeed, step) {
  if (Math.abs(tri.nz) > Math.abs(tri.nx)) {
    if (overTriangle(tri.x, tri.y, at.x, at.y)) {
      let colz = pointOnTriangle(
        tri.y,
        tri.x,
        tri.z,
        step.wheelY[k],
        rad.y,
        step.wheelX[k],
        rad.x,
        rad.z,
      );
      if (
        pieces.list[o].bnd[0] != 1 &&
        tri.nz > 0 &&
        step.wheelZ[k] < colz + step.reachZ &&
        step.wheelZ[k] > colz + step.reachZ - rad.bndmax &&
        (racers[c].wheelSpeedZ[k] <= 1.2 || atAnySpeed)
      ) {
        step.hitWall = true;
        bounceOffWallFacingPlusZ(c, k, type, colz, rad.dam, false, step);
        hitPieceWall(c, o, true);
      }
      if (
        pieces.list[o].bnd[1] != 1 &&
        tri.nz < 0 &&
        step.wheelZ[k] > colz - step.reachZ &&
        step.wheelZ[k] < colz - step.reachZ + rad.bndmax &&
        (racers[c].wheelSpeedZ[k] >= -1.2 || atAnySpeed)
      ) {
        step.hitWall = true;
        bounceOffWallFacingMinusZ(c, k, type, colz, rad.dam, false, step);
        hitPieceWall(c, o, true);
      }
    }
  } else {
    if (overTriangle(tri.y, tri.z, at.y, at.z)) {
      let colx = pointOnTriangle(
        tri.z,
        tri.y,
        tri.x,
        step.wheelZ[k],
        rad.z,
        step.wheelY[k],
        rad.y,
        rad.x,
      );
      if (
        pieces.list[o].bnd[2] != 1 &&
        tri.nx > 0 &&
        step.wheelX[k] < colx + step.reachX &&
        step.wheelX[k] > colx + step.reachX - rad.bndmax &&
        (racers[c].wheelSpeedX[k] <= 1.2 || atAnySpeed)
      ) {
        step.hitWall = true;
        bounceOffWallFacingPlusX(c, k, type, colx, rad.dam, false, step);
        hitPieceWall(c, o, false);
      }
      if (
        pieces.list[o].bnd[3] != 1 &&
        tri.nx < 0 &&
        step.wheelX[k] > colx - step.reachX &&
        step.wheelX[k] < colx - step.reachX + rad.bndmax &&
        (racers[c].wheelSpeedX[k] >= -1.2 || atAnySpeed)
      ) {
        step.hitWall = true;
        bounceOffWallFacingMinusX(c, k, type, colx, rad.dam, false, step);
        hitPieceWall(c, o, false);
      }
    }
  }
}

function landOnFlat(c, k, type, coly, step) {
  racers[c].wheelsTouch = true;
  racers[c].onFlatGround = true;
  if (!step.touchedGround) {
    if (racers[c].wheelSpeedY[k] != -0.7) {
      let mag = racers[c].wheelSpeedY[k] / 33.33;
      if (mag > 0.3) {
        mag = 0.3;
      }
      if (step.surface == DUST.road) {
        mag += 1.1;
      } else {
        mag += 1.2;
      }
      dustup(
        step.surface,
        c,
        k,
        step.wheelX[k],
        step.wheelY[k],
        step.wheelZ[k],
        racers[c].wheelSpeedX[k],
        racers[c].wheelSpeedZ[k],
        mag * carStats.simag[type],
        0,
        racers[c].capsized && racers[c].grounded,
      );
    }
  }
  step.wheelY[k] = coly;
  if (racers[c].capsized) {
    if (
      step.onTrackPiece &&
      (step.surface == DUST.road || step.surface == DUST.ground)
    ) {
      step.sparkKind[k] = 1;
    } else {
      step.sparkKind[k] = 2;
    }
  }
  const bounce = groundBounce(c, type);
  regn(HIT.fromBelow, k, Math.abs(racers[c].wheelSpeedY[k] * bounce), c);
  if (racers[c].wheelSpeedY[k] < 0) {
    racers[c].wheelSpeedY[k] += Math.abs(racers[c].wheelSpeedY[k] * bounce);
  }
  step.axleOnGround[Math.floor(k * 0.5)] = 1;
}

function landOnSlope(tri, c, k, type, o, coly, colz, colx, i, step) {
  let bounceramp = false;
  if (Math.abs(tri.nz) > Math.abs(tri.nx)) {
    if (
      (tri.nz > 0 && racers[c].wheelSpeedZ[k] < 0) ||
      (tri.nz < 0 && racers[c].wheelSpeedZ[k] > 0)
    ) {
      bounceramp = true;
    }
  } else {
    if (
      (tri.nx > 0 && racers[c].wheelSpeedX[k] < 0) ||
      (tri.nx < 0 && racers[c].wheelSpeedX[k] > 0)
    ) {
      bounceramp = true;
    }
  }
  if (bounceramp) {
    const bounce = groundBounce(c, type);
    if (racers[c].wheelSpeedY[k] < 0) {
      racers[c].wheelSpeedY[k] += Math.abs(racers[c].wheelSpeedY[k] * bounce);
    }
    if (pieces.list[o].typ == PIECE.tside) {
      for (let ka = 0; ka < 4; ka++) {
        if (Math.abs(tri.nz) > Math.abs(tri.nx)) {
          if (tri.nz > 0) {
            racers[c].wheelSpeedZ[ka] += Math.abs(
              racers[c].wheelSpeedY[k] * bounce * 0.4,
            );
          } else {
            racers[c].wheelSpeedZ[ka] -= Math.abs(
              racers[c].wheelSpeedY[k] * bounce * 0.4,
            );
          }
        } else {
          if (tri.nx > 0) {
            racers[c].wheelSpeedX[ka] += Math.abs(
              racers[c].wheelSpeedY[k] * bounce * 0.4,
            );
          } else {
            racers[c].wheelSpeedX[ka] -= Math.abs(
              racers[c].wheelSpeedY[k] * bounce * 0.4,
            );
          }
        }
      }
    }
  }
  let trzy = Math.acos(Math.abs(tri.ny)) / 0.017453292519943295;
  let arct = 1 + (50 - Math.abs(trzy)) / 30;
  if (arct < 1) {
    arct = 1;
  }
  let difco = (coly - step.wheelY[k]) / (arct * tick.scale);
  racers[c].wheelSpeedY[k] += difco;
  step.wheelY[k] = coly;
  if (difco > 0) {
    difco *= 20;
    difco = 100 - difco;
    if (difco < 2) {
      difco = 2;
    }
    if (Math.abs(tri.nz) > Math.abs(tri.nx)) {
      if (Math.abs(colz - step.wheelZ[k]) < 100) {
        step.wheelZ[k] += (colz - step.wheelZ[k]) / difco;
      }
    } else {
      if (Math.abs(colx - step.wheelX[k]) < 100) {
        step.wheelX[k] += (colx - step.wheelX[k]) / difco;
      }
    }
  }
  racers[c].wheelsTouch = true;
  racers[c].onFlatGround = false;
  if (racers[c].capsized) {
    if (
      step.onTrackPiece &&
      (step.surface == DUST.road || step.surface == DUST.ground)
    ) {
      step.sparkKind[k] = 1;
    } else {
      step.sparkKind[k] = 2;
    }
  }
  if (!step.touchedGround) {
    if (step.surface != DUST.road) {
      let mag = 1.4;
      dustup(
        step.surface,
        c,
        i,
        step.wheelX[i],
        step.wheelY[i],
        step.wheelZ[i],
        racers[c].wheelSpeedX[i],
        racers[c].wheelSpeedZ[i],
        mag * carStats.simag[type],
        0,
        racers[c].capsized && racers[c].grounded,
      );
    }
  }
  step.axleOnGround[Math.floor(k * 0.5)] = tri.ny;
}

// Whether the AI remembers a hit wall to steer away from it: not rises, not tsides (but
// on stage 13), not froads on stage 16 and, for walls along z, not slides on stage 14.
function aiAvoidsWall(typ, alongZ) {
  return (
    typ != PIECE.uprise &&
    typ != PIECE.riseroad &&
    (typ != PIECE.tside || track.stage == 13) &&
    (!alongZ || typ != PIECE.slide10 || track.stage != 14) &&
    (typ != PIECE.froad || track.stage != 16)
  );
}

// A piece's wall, unlike the stage limits, can make a jump count as surfing and is one
// the AI may remember to steer away from.
function hitPieceWall(c, o, alongZ) {
  racers[c].touchedWall = true;
  if (aiAvoidsWall(pieces.list[o].typ, alongZ)) {
    racers[c].wall = o;
  }
}

function bounceOffWallFacingPlusZ(
  c,
  k,
  type,
  wallAt,
  damage,
  lowSparksOnly,
  step,
) {
  for (let j = 0; j < 4; j++) {
    if (k != j) {
      if (step.wheelZ[j] >= wallAt + step.reachZ) {
        step.wheelZ[j] -= step.wheelZ[k] - (wallAt + step.reachZ);
      }
    }
  }
  step.wheelZ[k] = wallAt + step.reachZ;
  if (tick.fraction >= tick.scale && (!lowSparksOnly || step.wheelY[k] < 20)) {
    racers[c].crank[k]++;
    if (racers[c].crank[k] > 2) {
      sprks(
        type,
        step.wheelX[k],
        step.wheelY[k],
        step.wheelZ[k] - step.reachZ,
        racers[c].wheelSpeedX[k],
        racers[c].wheelSpeedY[k],
        racers[c].wheelSpeedZ[k],
        2,
      );
      scrapeOf(
        c,
        racers[c].wheelSpeedX[k],
        racers[c].wheelSpeedY[k],
        racers[c].wheelSpeedZ[k],
      );
    }
  }
  const bounce = wallBounce(c, type, step);
  regn(HIT.alongZ, k, Math.abs(racers[c].wheelSpeedZ[k] * bounce * damage), c);
  if (racers[c].wheelSpeedZ[k] <= 0) {
    racers[c].wheelSpeedZ[k] += Math.abs(racers[c].wheelSpeedZ[k] * bounce);
  }
  racers[c].skid = SKID.takeSpeedFromMotion;
}

function bounceOffWallFacingMinusZ(
  c,
  k,
  type,
  wallAt,
  damage,
  lowSparksOnly,
  step,
) {
  for (let j = 0; j < 4; j++) {
    if (k != j) {
      if (step.wheelZ[j] <= wallAt - step.reachZ) {
        step.wheelZ[j] -= step.wheelZ[k] - (wallAt - step.reachZ);
      }
    }
  }
  step.wheelZ[k] = wallAt - step.reachZ;
  if (tick.fraction >= tick.scale && (!lowSparksOnly || step.wheelY[k] < 20)) {
    racers[c].crank[k]++;
    if (racers[c].crank[k] > 2) {
      sprks(
        type,
        step.wheelX[k],
        step.wheelY[k],
        step.wheelZ[k] + step.reachZ,
        racers[c].wheelSpeedX[k],
        racers[c].wheelSpeedY[k],
        racers[c].wheelSpeedZ[k],
        2,
      );
      scrapeOf(
        c,
        racers[c].wheelSpeedX[k],
        racers[c].wheelSpeedY[k],
        racers[c].wheelSpeedZ[k],
      );
    }
  }
  const bounce = wallBounce(c, type, step);
  regn(HIT.alongZ, k, -Math.abs(racers[c].wheelSpeedZ[k] * bounce * damage), c);
  if (racers[c].wheelSpeedZ[k] >= 0) {
    racers[c].wheelSpeedZ[k] -= Math.abs(racers[c].wheelSpeedZ[k] * bounce);
  }
  racers[c].skid = SKID.takeSpeedFromMotion;
}

function bounceOffWallFacingPlusX(
  c,
  k,
  type,
  wallAt,
  damage,
  lowSparksOnly,
  step,
) {
  for (let j = 0; j < 4; j++) {
    if (k != j) {
      if (step.wheelX[j] >= wallAt + step.reachX) {
        step.wheelX[j] -= step.wheelX[k] - (wallAt + step.reachX);
      }
    }
  }
  step.wheelX[k] = wallAt + step.reachX;
  if (tick.fraction >= tick.scale && (!lowSparksOnly || step.wheelY[k] < 20)) {
    racers[c].crank[k]++;
    if (racers[c].crank[k] > 2) {
      sprks(
        type,
        step.wheelX[k] - step.reachX,
        step.wheelY[k],
        step.wheelZ[k],
        racers[c].wheelSpeedX[k],
        racers[c].wheelSpeedY[k],
        racers[c].wheelSpeedZ[k],
        2,
      );
      scrapeOf(
        c,
        racers[c].wheelSpeedX[k],
        racers[c].wheelSpeedY[k],
        racers[c].wheelSpeedZ[k],
      );
    }
  }
  const bounce = wallBounce(c, type, step);
  regn(HIT.alongX, k, Math.abs(racers[c].wheelSpeedX[k] * bounce * damage), c);
  if (racers[c].wheelSpeedX[k] <= 0) {
    racers[c].wheelSpeedX[k] += Math.abs(racers[c].wheelSpeedX[k] * bounce);
  }
  racers[c].skid = SKID.takeSpeedFromMotion;
}

function bounceOffWallFacingMinusX(
  c,
  k,
  type,
  wallAt,
  damage,
  lowSparksOnly,
  step,
) {
  for (let j = 0; j < 4; j++) {
    if (k != j) {
      if (step.wheelX[j] <= wallAt - step.reachX) {
        step.wheelX[j] -= step.wheelX[k] - (wallAt - step.reachX);
      }
    }
  }
  step.wheelX[k] = wallAt - step.reachX;
  if (tick.fraction >= tick.scale && (!lowSparksOnly || step.wheelY[k] < 20)) {
    racers[c].crank[k]++;
    if (racers[c].crank[k] > 2) {
      sprks(
        type,
        step.wheelX[k] + step.reachX,
        step.wheelY[k],
        step.wheelZ[k],
        racers[c].wheelSpeedX[k],
        racers[c].wheelSpeedY[k],
        racers[c].wheelSpeedZ[k],
        2,
      );
      scrapeOf(
        c,
        racers[c].wheelSpeedX[k],
        racers[c].wheelSpeedY[k],
        racers[c].wheelSpeedZ[k],
      );
    }
  }
  const bounce = wallBounce(c, type, step);
  regn(HIT.alongX, k, -Math.abs(racers[c].wheelSpeedX[k] * bounce * damage), c);
  if (racers[c].wheelSpeedX[k] >= 0) {
    racers[c].wheelSpeedX[k] -= Math.abs(racers[c].wheelSpeedX[k] * bounce);
  }
  racers[c].skid = SKID.takeSpeedFromMotion;
}

function placeWheelPoints(c, wheelDrop, step) {
  for (let i = 0; i < 4; i++) {
    step.wheelX[i] = car[c].keyx[i] + car[c].x;
    step.wheelY[i] = wheelDrop + car[c].y;
    step.wheelZ[i] = car[c].z + car[c].keyz[i];
    racers[c].wheelSpeedY[i] -= 0.7 * tick.scale;
  }
  rotatePoints(step.wheelX, step.wheelY, car[c].x, car[c].y, racers[c].roll, 4);
  rotatePoints(
    step.wheelY,
    step.wheelZ,
    car[c].y,
    car[c].z,
    racers[c].pitch,
    4,
  );
  rotatePoints(step.wheelX, step.wheelZ, car[c].x, car[c].z, car[c].xz, 4);
}

function keepWheelSpeedsTogether(c, avgSpeedX, avgSpeedZ) {
  for (let i = 0; i < 4; i++) {
    if (racers[c].wheelSpeedX[i] - avgSpeedX > 20) {
      racers[c].wheelSpeedX[i] = 20 + avgSpeedX;
    }
    if (racers[c].wheelSpeedX[i] - avgSpeedX < -20) {
      racers[c].wheelSpeedX[i] = avgSpeedX - 20;
    }
    if (racers[c].wheelSpeedZ[i] - avgSpeedZ > 20) {
      racers[c].wheelSpeedZ[i] = 20 + avgSpeedZ;
    }
    if (racers[c].wheelSpeedZ[i] - avgSpeedZ < -20) {
      racers[c].wheelSpeedZ[i] = avgSpeedZ - 20;
    }
  }
}

function moveWheelPoints(c, step) {
  for (let i = 0; i < 4; i++) {
    step.wheelY[i] += racers[c].wheelSpeedY[i] * tick.scale;
    step.wheelX[i] +=
      ((racers[c].wheelSpeedX[0] +
        racers[c].wheelSpeedX[1] +
        racers[c].wheelSpeedX[2] +
        racers[c].wheelSpeedX[3]) /
        4) *
      tick.scale;
    step.wheelZ[i] +=
      ((racers[c].wheelSpeedZ[0] +
        racers[c].wheelSpeedZ[1] +
        racers[c].wheelSpeedZ[2] +
        racers[c].wheelSpeedZ[3]) /
        4) *
      tick.scale;
  }
}

function bounceWheelsOffGround(c, type, step) {
  let wheelsOnGround = 0;
  for (let i = 0; i < 4; i++) {
    step.sparkKind[i] = 0;
    if (step.wheelY[i] < -0.05) {
      wheelsOnGround++;
      racers[c].wheelsTouch = true;
      racers[c].onFlatGround = true;
      if (!step.touchedGround) {
        if (racers[c].wheelSpeedY[i] != -0.7) {
          let mag = racers[c].wheelSpeedY[i] / 33.33;
          if (mag > 0.3) {
            mag = 0.3;
          }
          if (step.surface == DUST.road) {
            mag += 1.1;
          } else {
            mag += 1.2;
          }
          dustup(
            step.surface,
            c,
            i,
            step.wheelX[i],
            step.wheelY[i],
            step.wheelZ[i],
            racers[c].wheelSpeedX[i],
            racers[c].wheelSpeedZ[i],
            mag * carStats.simag[type],
            0,
            racers[c].capsized && racers[c].grounded,
          );
        }
      }
      step.wheelY[i] = 0;
      const bounce = groundBounce(c, type);
      regn(HIT.fromBelow, i, Math.abs(racers[c].wheelSpeedY[i] * bounce), c);
      if (racers[c].wheelSpeedY[i] < 0) {
        racers[c].wheelSpeedY[i] += Math.abs(racers[c].wheelSpeedY[i] * bounce);
      }
      if (racers[c].capsized) {
        if (
          step.onTrackPiece &&
          (step.surface == DUST.road || step.surface == DUST.ground)
        ) {
          step.sparkKind[i] = 1;
        } else {
          step.sparkKind[i] = 2;
        }
      }
      step.axleOnGround[Math.floor(i * 0.5)] = 1;
    }
  }
  return wheelsOnGround;
}

function gripGround(type, c, turnedRound, step) {
  let grip = carStats.grip[type];
  grip -=
    (Math.abs(racers[c].lastGripHeading - car[c].xz) * racers[c].speed) / 250;
  if (racers[c].u.handb) {
    grip -= Math.abs(racers[c].lastGripHeading - car[c].xz) * 4;
  }
  if (grip < carStats.grip[type]) {
    if (racers[c].skid != SKID.takeSpeedFromMotion) {
      racers[c].skid = SKID.sliding;
    }
    racers[c].speed -= (racers[c].speed / 100) * tick.scale;
  } else {
    if (racers[c].skid == SKID.sliding) {
      racers[c].skid = SKID.takeSpeedFromMotion;
    }
  }
  if (step.surface == DUST.ground) {
    grip *= 0.75;
  }
  if (step.surface == DUST.sand) {
    grip *= 0.55;
  }
  let driveX = -(racers[c].speed * sinDeg(car[c].xz) * cosDeg(racers[c].pitch));
  let driveZ = racers[c].speed * cosDeg(car[c].xz) * cosDeg(racers[c].pitch);
  let driveY = -(racers[c].speed * sinDeg(racers[c].pitch));
  if (racers[c].capsized || racers[c].wasted || track.haltall) {
    driveX = 0;
    driveZ = 0;
    driveY = 0;
    grip = carStats.grip[type] / 5;
    if (racers[c].speed > 0) {
      racers[c].speed -= 0.2 * tick.scale;
    } else {
      racers[c].speed += 0.2 * tick.scale;
    }
  }
  if (Math.abs(racers[c].speed) > drag) {
    if (racers[c].speed > 0) {
      racers[c].speed -= drag * tick.scale;
    } else {
      racers[c].speed += drag * tick.scale;
    }
  } else {
    racers[c].speed = 0;
  }
  if (type == 10) {
    if (grip < 0.5) {
      grip = 0.5;
    }
  }
  if (grip < 0.1) {
    grip = 0.1;
  }
  let totalX = 0,
    totalZ = 0;
  for (let i = 0; i < 4; i++) {
    if (Math.abs(racers[c].wheelSpeedX[i] - driveX) > grip * tick.scale) {
      if (racers[c].wheelSpeedX[i] < driveX) {
        racers[c].wheelSpeedX[i] += grip * tick.scale;
      } else {
        racers[c].wheelSpeedX[i] -= grip * tick.scale;
      }
    } else {
      racers[c].wheelSpeedX[i] = driveX;
    }
    if (Math.abs(racers[c].wheelSpeedZ[i] - driveZ) > grip * tick.scale) {
      if (racers[c].wheelSpeedZ[i] < driveZ) {
        racers[c].wheelSpeedZ[i] += grip * tick.scale;
      } else {
        racers[c].wheelSpeedZ[i] -= grip * tick.scale;
      }
    } else {
      racers[c].wheelSpeedZ[i] = driveZ;
    }
    if (Math.abs(racers[c].wheelSpeedY[i] - driveY) > grip * tick.scale) {
      if (racers[c].wheelSpeedY[i] < driveY) {
        racers[c].wheelSpeedY[i] += grip * tick.scale;
      } else {
        racers[c].wheelSpeedY[i] -= grip * tick.scale;
      }
    } else {
      racers[c].wheelSpeedY[i] = driveY;
    }
    if (tick.fraction >= tick.scale) {
      kickUpDust(grip, type, c, i, step);
    }
    totalX += racers[c].wheelSpeedX[i];
    totalZ += racers[c].wheelSpeedZ[i];
  }
  racers[c].lastGripHeading = car[c].xz;
  let side = 1;
  if (totalX > 0) {
    side = -1;
  }
  let cos = 0;
  if (totalX != 0 || totalZ != 0) {
    cos = totalZ / Math.sqrt(totalX * totalX + totalZ * totalZ);
  }
  racers[c].motionHeading = (Math.acos(cos) / 0.017453292519943295) * side;
  if (racers[c].skid == SKID.takeSpeedFromMotion) {
    if (!racers[c].capsized) {
      totalX = totalX / 4;
      totalZ = totalZ / 4;
      if (turnedRound) {
        racers[c].speed = -(
          Math.sqrt(totalX * totalX + totalZ * totalZ) *
          cosDeg(racers[c].motionHeading - car[c].xz)
        );
      } else {
        racers[c].speed =
          Math.sqrt(totalX * totalX + totalZ * totalZ) *
          cosDeg(racers[c].motionHeading - car[c].xz);
      }
    }
    racers[c].skid = SKID.gripping;
  }
  if (racers[c].capsized && totalX == 0 && totalZ == 0) {
    step.surface = DUST.road;
  }
  racers[c].grounded = false;
}

function kickUpDust(grip, type, c, i, step) {
  if (grip < carStats.grip[type]) {
    if (racers[c].lastGripHeading != car[c].xz) {
      racers[c].dcnt++;
    } else {
      if (racers[c].dcnt != 0) {
        racers[c].dcnt = 0;
      }
    }
    if (
      racers[c].dcnt > (40 * grip) / carStats.grip[type] ||
      racers[c].capsized
    ) {
      let mag = 1;
      if (step.surface != DUST.road) {
        mag = 1.2;
      }
      if (random.fx() > 0.65) {
        dustup(
          step.surface,
          c,
          i,
          step.wheelX[i],
          step.wheelY[i],
          step.wheelZ[i],
          racers[c].wheelSpeedX[i],
          racers[c].wheelSpeedZ[i],
          mag * carStats.simag[type],
          racers[c].tilt,
          racers[c].capsized && racers[c].grounded,
        );
        if (!racers[c].capsized) {
          skidOf(
            c,
            step.surface,
            step.onTrackPiece,
            Math.sqrt(
              racers[c].wheelSpeedX[i] * racers[c].wheelSpeedX[i] +
                racers[c].wheelSpeedZ[i] * racers[c].wheelSpeedZ[i],
            ),
          );
        }
      }
    } else {
      if (step.surface == DUST.ground) {
        if (random.fx() > 0.8) {
          dustup(
            step.surface,
            c,
            i,
            step.wheelX[i],
            step.wheelY[i],
            step.wheelZ[i],
            racers[c].wheelSpeedX[i],
            racers[c].wheelSpeedZ[i],
            1.1 * carStats.simag[type],
            racers[c].tilt,
            racers[c].capsized && racers[c].grounded,
          );
        }
      }
      if (step.surface == DUST.sand) {
        if (random.fx() > 0.6) {
          dustup(
            step.surface,
            c,
            i,
            step.wheelX[i],
            step.wheelY[i],
            step.wheelZ[i],
            racers[c].wheelSpeedX[i],
            racers[c].wheelSpeedZ[i],
            1.15 * carStats.simag[type],
            racers[c].tilt,
            racers[c].capsized && racers[c].grounded,
          );
        }
      }
    }
  } else {
    if (racers[c].dcnt != 0) {
      racers[c].dcnt -= 2;
      if (racers[c].dcnt < 0) {
        racers[c].dcnt = 0;
      }
    }
  }
}

// Triangle i of a track piece's collision model, turned with the piece: its corners and the
// normal of its face.
function triangleOf(rad, i) {
  const tri = { x: [], y: [], z: [], nx: 0, ny: 0, nz: 0 };
  for (let v = 0; v < 3; v++) {
    const vp = rad.tri[i * 9 + v * 3];
    tri.x[v] =
      -(rad.vrt[vp * 3] * rad.mat[0]) + rad.vrt[vp * 3 + 2] * rad.mat[8];
    tri.y[v] = rad.vrt[vp * 3 + 1];
    tri.z[v] = rad.vrt[vp * 3 + 2] * rad.mat[10] - rad.vrt[vp * 3] * rad.mat[2];
  }
  const vp = rad.tri[i * 9 + 1];
  tri.nx = -(rad.nrm[vp * 3] * rad.mat[0]) + rad.nrm[vp * 3 + 2] * rad.mat[8];
  tri.ny = rad.nrm[vp * 3 + 1];
  tri.nz = rad.nrm[vp * 3 + 2] * rad.mat[10] - rad.nrm[vp * 3] * rad.mat[2];
  return tri;
}

// Whether the point (p, q) lies over the triangle with the corners (a[i], b[i]), seen along
// the third axis, with some slack: the triangles it makes with the edges add up to no more.
function overTriangle(a, b, p, q) {
  const whole = Math.abs(
    (a[1] - a[0]) * (b[2] - b[0]) - (a[2] - a[0]) * (b[1] - b[0]),
  );
  const part1 = Math.abs((a[0] - p) * (b[1] - q) - (a[1] - p) * (b[0] - q));
  const part2 = Math.abs((a[1] - p) * (b[2] - q) - (a[2] - p) * (b[1] - q));
  const part3 = Math.abs((a[2] - p) * (b[0] - q) - (a[0] - p) * (b[2] - q));
  return part1 + part2 + part3 <= whole + 10;
}

// Where the triangle with the corners (u[i], v[i], w[i]), placed at base*, lies along w at
// (atU, atV): found on its edges from corner 0 at the height atU, then between those points.
function pointOnTriangle(u, v, w, atU, baseU, atV, baseV, baseW) {
  let along = 0;
  if (u[0] - u[1] != 0) {
    along = (atU - (u[1] + baseU)) / (u[0] - u[1]);
  }
  const v1 = v[1] + (v[0] - v[1]) * along;
  const w1 = w[1] + (w[0] - w[1]) * along;
  along = 0;
  if (u[0] - u[2] != 0) {
    along = (atU - (u[2] + baseU)) / (u[0] - u[2]);
  }
  const v2 = v[2] + (v[0] - v[2]) * along;
  const w2 = w[2] + (w[0] - w[2]) * along;
  along = 0;
  if (v2 - v1 != 0) {
    along = (atV - (v1 + baseV)) / (v2 - v1);
  }
  return w1 + baseW + (w2 - w1) * along;
}

// How strongly a wheel bounces back off the ground: more when the car lands tilted.
function groundBounce(c, type) {
  let bounce =
    Math.abs(sinDeg(racers[c].roll)) + Math.abs(sinDeg(racers[c].pitch));
  bounce = bounce / 3;
  if (bounce > 0.4) {
    bounce = 0.4;
  }
  bounce += carStats.bounce[type];
  if (bounce < 1.1) {
    bounce = 1.1;
  }
  return bounce;
}

// How strongly a wheel bounces back off a wall: more when the car is upright, less once it
// touched the ground this tick.
function wallBounce(c, type, step) {
  let bounce =
    Math.abs(cosDeg(racers[c].roll)) + Math.abs(cosDeg(racers[c].pitch));
  bounce = bounce / 4;
  if (bounce > 0.3) {
    bounce = 0.3;
  }
  if (step.touchedGround) {
    bounce = 0;
  }
  bounce += carStats.bounce[type] - 0.2;
  if (bounce < 1.1) {
    bounce = 1.1;
  }
  return bounce;
}

// How many degrees the line between wheels a and b tilts, given their distance on the flat
// car, negative when b falls faster than a. A tilt too small to measure counts as 1.
function tiltBetween(c, a, b, span, step) {
  let sign = 1;
  if (racers[c].wheelSpeedY[b] < racers[c].wheelSpeedY[a]) {
    sign = -1;
  }
  const cos =
    Math.sqrt(
      (step.wheelZ[a] - step.wheelZ[b]) * (step.wheelZ[a] - step.wheelZ[b]) +
        (step.wheelY[a] - step.wheelY[b]) * (step.wheelY[a] - step.wheelY[b]) +
        (step.wheelX[a] - step.wheelX[b]) * (step.wheelX[a] - step.wheelX[b]),
    ) / span;
  if (cos >= 0.9998) {
    return sign;
  }
  return (Math.acos(cos) / 0.017453292519943295) * sign;
}

// the last track piece with its own surface the car is above, or -1
function pieceUnder(c) {
  let under = -1;
  for (let o = 0; o < pieces.count; o++) {
    if (pieceModels[pieces.list[o].typ].skid != -1) {
      let bigX =
        pieces.list[o].x +
        pieceModels[pieces.list[o].typ].bx * pieces.list[o].mat[0] +
        pieceModels[pieces.list[o].typ].bz * pieces.list[o].mat[8];
      let smallX =
        pieces.list[o].x +
        pieceModels[pieces.list[o].typ].sx * pieces.list[o].mat[0] +
        pieceModels[pieces.list[o].typ].sz * pieces.list[o].mat[8];
      let bigZ =
        pieces.list[o].z +
        pieceModels[pieces.list[o].typ].bz * pieces.list[o].mat[10] +
        pieceModels[pieces.list[o].typ].bx * pieces.list[o].mat[2];
      let smallZ =
        pieces.list[o].z +
        pieceModels[pieces.list[o].typ].sz * pieces.list[o].mat[10] +
        pieceModels[pieces.list[o].typ].sx * pieces.list[o].mat[2];
      let inside = 0;
      if (bigX > smallX) {
        if (car[c].x > smallX && car[c].x < bigX) {
          inside++;
        }
      } else {
        if (car[c].x > bigX && car[c].x < smallX) {
          inside++;
        }
      }
      if (bigZ > smallZ) {
        if (car[c].z > smallZ && car[c].z < bigZ) {
          inside++;
        }
      } else {
        if (car[c].z > bigZ && car[c].z < smallZ) {
          inside++;
        }
      }
      if (inside == 2) {
        under = o;
      }
    }
  }
  return under;
}

function touchDownFromStunt(c) {
  if (racers[c].wheelsTouch) {
    if (
      racers[c].stunt == STUNT.flying ||
      racers[c].stunt == STUNT.touchingDown
    ) {
      racers[c].stunt = STUNT.touchingDown;
      if (racers[c].u.left) {
        racers[c].landedHoldingLeft = true;
      }
      if (racers[c].u.right) {
        racers[c].landedHoldingRight = true;
      }
      if (racers[c].u.up) {
        racers[c].landedHoldingUp = true;
      }
      if (racers[c].u.down) {
        racers[c].landedHoldingDown = true;
      }
    }
    racers[c].flipForwardSpeed = 0;
    racers[c].flipBackSpeed = 0;
    racers[c].rollLeftSpeed = 0;
    racers[c].rollRightSpeed = 0;
  }
}

function watchPlayerStuntKeys(c) {
  if (c == game.player) {
    if (!racers[c].wheelsTouch) {
      if (racers[c].u.up) {
        if (!racers[c].upHeldFromGround) {
          if (racers[c].stunt == STUNT.none) {
            racers[c].stunt = STUNT.starting;
          }
        }
      } else {
        racers[c].upHeldFromGround = false;
      }
      if (racers[c].u.down) {
        if (!racers[c].downHeldFromGround) {
          if (racers[c].stunt == STUNT.none) {
            racers[c].stunt = STUNT.starting;
          }
        }
      } else {
        racers[c].downHeldFromGround = false;
      }
      if (racers[c].u.left) {
        if (!racers[c].leftHeldFromGround) {
          if (racers[c].stunt == STUNT.none) {
            racers[c].stunt = STUNT.starting;
          }
        }
      } else {
        racers[c].leftHeldFromGround = false;
      }
      if (racers[c].u.right) {
        if (!racers[c].rightHeldFromGround) {
          if (racers[c].stunt == STUNT.none) {
            racers[c].stunt = STUNT.starting;
          }
        }
      } else {
        racers[c].rightHeldFromGround = false;
      }
    } else {
      racers[c].leftHeldFromGround = true;
      racers[c].rightHeldFromGround = true;
      racers[c].upHeldFromGround = true;
      racers[c].downHeldFromGround = true;
    }
  }
}

function startStuntWithHandbrake(c) {
  if (racers[c].u.handb) {
    if (!racers[c].handbrakeHeldOnGround) {
      if (!racers[c].wheelsTouch) {
        if (racers[c].stunt == STUNT.none) {
          racers[c].stunt = STUNT.starting;
          racers[c].leftHeldFromGround = false;
          racers[c].rightHeldFromGround = false;
          racers[c].upHeldFromGround = false;
          racers[c].downHeldFromGround = false;
        }
      } else {
        if (racers[c].onFlatGround) {
          racers[c].handbrakeHeldOnGround = true;
        }
      }
    }
  } else {
    racers[c].handbrakeHeldOnGround = false;
  }
}

function startStunt(c) {
  if (racers[c].stunt == STUNT.starting) {
    let avay =
      (racers[c].wheelSpeedY[0] +
        racers[c].wheelSpeedY[1] +
        racers[c].wheelSpeedY[2] +
        racers[c].wheelSpeedY[3]) /
      4;
    for (let i = 0; i < 4; i++) {
      racers[c].wheelSpeedY[i] = avay;
    }
    racers[c].stunt = STUNT.flying;
  }
}

function rollWheels(c, type) {
  let turns = (200 * racers[c].speed) / (154 * carStats.simag[type]);
  car[c].wzy -= turns * tick.scale;
  if (car[c].wzy < -360) {
    car[c].wzy += 360;
  }
  if (car[c].wzy > 360) {
    car[c].wzy -= 360;
  }
}

function steerFrontWheels(c, type) {
  if (racers[c].u.left) {
    car[c].wxz -= carStats.turn[type] * tick.scale;
    if (car[c].wxz < -36) {
      car[c].wxz = -36;
    }
  }
  if (racers[c].u.right) {
    car[c].wxz += carStats.turn[type] * tick.scale;
    if (car[c].wxz > 36) {
      car[c].wxz = 36;
    }
  }
  if (car[c].wxz != 0 && !racers[c].u.left && !racers[c].u.right) {
    if (Math.abs(racers[c].speed) < 1) {
      if (Math.abs(car[c].wxz) <= tick.scale) {
        car[c].wxz = 0;
      }
      if (car[c].wxz > 0) {
        car[c].wxz -= tick.scale;
      }
      if (car[c].wxz < 0) {
        car[c].wxz += tick.scale;
      }
    } else {
      if (Math.abs(car[c].wxz) < carStats.turn[type] * 2 * tick.scale) {
        car[c].wxz = 0;
      }
      if (car[c].wxz > 0) {
        car[c].wxz -= carStats.turn[type] * 2 * tick.scale;
      }
      if (car[c].wxz < 0) {
        car[c].wxz += carStats.turn[type] * 2 * tick.scale;
      }
    }
  }
}

function turnWithFrontWheels(c) {
  let turnRadius = 36 / (racers[c].speed * racers[c].speed);
  if (turnRadius < 5) {
    turnRadius = 5;
  }
  if (racers[c].speed < 0) {
    turnRadius = -turnRadius;
  }
  if (racers[c].wheelsTouch) {
    if (!racers[c].capsized) {
      if (!racers[c].u.handb) {
        racers[c].airTurn = (car[c].wxz / (turnRadius * 3)) * tick.scale;
      } else {
        racers[c].airTurn = (car[c].wxz / turnRadius) * tick.scale;
      }
      car[c].xz += (car[c].wxz / turnRadius) * tick.scale;
    }
    racers[c].wheelsTouch = false;
    racers[c].onFlatGround = false;
  } else {
    car[c].xz += racers[c].airTurn;
  }
}

function swingCameraHeading(c) {
  if (racers[c].speed > 3 || racers[c].speed < -7) {
    while (Math.abs(racers[c].motionHeading - racers[c].cameraHeading) > 180) {
      if (racers[c].cameraHeading > racers[c].motionHeading) {
        racers[c].cameraHeading -= 360;
      } else {
        if (racers[c].cameraHeading < racers[c].motionHeading) {
          racers[c].cameraHeading += 360;
        }
      }
    }
    if (Math.abs(racers[c].motionHeading - racers[c].cameraHeading) < 30) {
      racers[c].cameraHeading +=
        (racers[c].motionHeading - racers[c].cameraHeading) / 4;
    } else {
      if (racers[c].cameraHeading > racers[c].motionHeading) {
        racers[c].cameraHeading -= 10 * tick.scale;
      }
      if (racers[c].cameraHeading < racers[c].motionHeading) {
        racers[c].cameraHeading += 10 * tick.scale;
      }
    }
  }
}

function rotateInStunt(c, type, airPush, rollSign, flipSign, pitchedOver) {
  if (racers[c].u.up && !racers[c].upHeldFromGround) {
    if (racers[c].flipForwardSpeed == 0) {
      racers[c].flipForwardSpeed =
        10 + (-racers[c].wheelSpeedY[0] * 10 + 50) / 20;
      if (racers[c].flipForwardSpeed < 5) {
        racers[c].flipForwardSpeed = 5;
      }
      if (racers[c].flipForwardSpeed > 10) {
        racers[c].flipForwardSpeed = 10;
      }
      racers[c].flipForwardSpeed *= carStats.airs[type];
    }
    if (racers[c].flipForwardSpeed < 20) {
      racers[c].flipForwardSpeed += 0.5 * carStats.airs[type];
    }
    airPush.x = -carStats.airc[type] * sinDeg(car[c].xz) * rollSign;
    airPush.z = carStats.airc[type] * cosDeg(car[c].xz) * rollSign;
  } else {
    if (racers[c].flipForwardSpeed != 0) {
      if (racers[c].flipForwardSpeed > -2) {
        racers[c].flipForwardSpeed -= 0.5 * carStats.airs[type];
      }
    }
  }
  if (racers[c].u.down && !racers[c].downHeldFromGround) {
    if (racers[c].flipBackSpeed == 0) {
      racers[c].flipBackSpeed = 10 + (-racers[c].wheelSpeedY[0] * 10 + 50) / 20;
      if (racers[c].flipBackSpeed < 5) {
        racers[c].flipBackSpeed = 5;
      }
      if (racers[c].flipBackSpeed > 10) {
        racers[c].flipBackSpeed = 10;
      }
      racers[c].flipBackSpeed *= carStats.airs[type];
    }
    if (racers[c].flipBackSpeed < 20) {
      racers[c].flipBackSpeed += 0.5 * carStats.airs[type];
    }
    airPush.y = carStats.airc[type];
  } else {
    if (racers[c].flipBackSpeed != 0) {
      if (racers[c].flipForwardSpeed > -2) {
        racers[c].flipBackSpeed -= 0.5 * carStats.airs[type];
      }
    }
  }
  if (racers[c].u.left && !racers[c].leftHeldFromGround) {
    if (racers[c].rollLeftSpeed == 0) {
      racers[c].rollLeftSpeed = 5;
    }
    if (racers[c].rollLeftSpeed < 20) {
      racers[c].rollLeftSpeed += 2 * carStats.airs[type];
    }
    airPush.x = carStats.airc[type] * cosDeg(car[c].xz) * flipSign;
    airPush.z = carStats.airc[type] * sinDeg(car[c].xz) * flipSign;
  } else {
    if (racers[c].rollLeftSpeed > 0) {
      racers[c].rollLeftSpeed -= 2 * carStats.airs[type];
    }
  }
  if (racers[c].u.right && !racers[c].rightHeldFromGround) {
    if (racers[c].rollRightSpeed == 0) {
      racers[c].rollRightSpeed = 5;
    }
    if (racers[c].rollRightSpeed < 20) {
      racers[c].rollRightSpeed += 2 * carStats.airs[type];
    }
    airPush.x = -carStats.airc[type] * cosDeg(car[c].xz) * flipSign;
    airPush.z = -carStats.airc[type] * sinDeg(car[c].xz) * flipSign;
  } else {
    if (racers[c].rollRightSpeed > 0) {
      racers[c].rollRightSpeed -= 2 * carStats.airs[type];
    }
  }
  racers[c].pitch -=
    (racers[c].flipBackSpeed - racers[c].flipForwardSpeed) *
    cosDeg(racers[c].roll) *
    tick.scale;
  if (pitchedOver) {
    car[c].xz -=
      (racers[c].flipBackSpeed - racers[c].flipForwardSpeed) *
      sinDeg(racers[c].roll) *
      tick.scale;
  } else {
    car[c].xz +=
      (racers[c].flipBackSpeed - racers[c].flipForwardSpeed) *
      sinDeg(racers[c].roll) *
      tick.scale;
  }
  racers[c].roll +=
    (racers[c].rollRightSpeed - racers[c].rollLeftSpeed) * tick.scale;
}

function driveOnGround(c, type, pitchedOver) {
  let power = racers[c].power;
  if (power < 40) {
    power = 40;
  }
  if (racers[c].u.down) {
    if (racers[c].speed > 0) {
      racers[c].speed -= (carStats.handb[type] / 2) * tick.scale;
    } else {
      let sw = 0;
      for (let i = 0; i < 2; i++) {
        if (
          racers[c].speed <=
          -(
            carStats.swits[type][i] / 2 +
            (power * carStats.swits[type][i]) / 196
          )
        ) {
          sw++;
        }
      }
      if (sw != 2) {
        racers[c].speed -=
          (carStats.acelf[type][sw] / 2 +
            (power * carStats.acelf[type][sw]) / 196) *
          tick.scale;
      } else {
        racers[c].speed = -(
          (carStats.swits[type][1] / 2 +
            (power * carStats.swits[type][1]) / 196) *
          tick.scale
        );
      }
    }
  }
  if (racers[c].u.up) {
    if (racers[c].speed < 0) {
      racers[c].speed += carStats.handb[type] * tick.scale;
    } else {
      let sw = 0;
      for (let i = 0; i < 3; i++) {
        if (
          racers[c].speed >=
          carStats.swits[type][i] / 2 + (power * carStats.swits[type][i]) / 196
        ) {
          sw++;
        }
      }
      if (sw != 3) {
        racers[c].speed +=
          (carStats.acelf[type][sw] / 2 +
            (power * carStats.acelf[type][sw]) / 196) *
          tick.scale;
      } else {
        racers[c].speed =
          carStats.swits[type][2] / 2 + (power * carStats.swits[type][2]) / 196;
      }
    }
  }
  if (racers[c].u.handb) {
    if (Math.abs(racers[c].speed) > carStats.handb[type]) {
      if (racers[c].speed < 0) {
        racers[c].speed += carStats.handb[type] * tick.scale;
      } else {
        racers[c].speed -= carStats.handb[type] * tick.scale;
      }
    }
  }
  if (racers[c].stunt == STUNT.touchingDown) {
    rotateAfterStunt(c, type, pitchedOver);
  }
}

function rotateAfterStunt(c, type, pitchedOver) {
  if (car[c].y > 15) {
    if (racers[c].u.left) {
      if (!racers[c].landedHoldingLeft) {
        if (racers[c].rollLeftSpeed == 0) {
          racers[c].rollLeftSpeed = 5 * carStats.airs[type];
        }
        if (racers[c].rollLeftSpeed < 20) {
          racers[c].rollLeftSpeed += 2 * carStats.airs[type];
        }
      }
    } else {
      if (racers[c].rollLeftSpeed > 0) {
        racers[c].rollLeftSpeed -= 2 * carStats.airs[type];
      }
      racers[c].landedHoldingLeft = false;
    }
    if (racers[c].u.right) {
      if (!racers[c].landedHoldingRight) {
        if (racers[c].rollRightSpeed == 0) {
          racers[c].rollRightSpeed = 5 * carStats.airs[type];
        }
        if (racers[c].rollRightSpeed < 20) {
          racers[c].rollRightSpeed += 2 * carStats.airs[type];
        }
      }
    } else {
      if (racers[c].rollRightSpeed > 0) {
        racers[c].rollRightSpeed -= 2 * carStats.airs[type];
      }
      racers[c].landedHoldingRight = false;
    }
    if (racers[c].u.up) {
      if (!racers[c].landedHoldingUp) {
        if (racers[c].flipForwardSpeed == 0) {
          racers[c].flipForwardSpeed = 5 * carStats.airs[type];
        }
        if (racers[c].flipForwardSpeed < 20) {
          racers[c].flipForwardSpeed += 2 * carStats.airs[type];
        }
      }
    } else {
      if (racers[c].flipForwardSpeed > 0) {
        racers[c].flipForwardSpeed -= 2 * carStats.airs[type];
      }
      racers[c].landedHoldingUp = false;
    }
    if (racers[c].u.down) {
      if (!racers[c].landedHoldingDown) {
        if (racers[c].flipBackSpeed == 0) {
          racers[c].flipBackSpeed = 5 * carStats.airs[type];
        }
        if (racers[c].flipBackSpeed < 20) {
          racers[c].flipBackSpeed += 2 * carStats.airs[type];
        }
      }
    } else {
      if (racers[c].flipBackSpeed > 0) {
        racers[c].flipBackSpeed -= 2 * carStats.airs[type];
      }
      racers[c].landedHoldingDown = false;
    }
    racers[c].pitch -=
      (racers[c].flipBackSpeed - racers[c].flipForwardSpeed) *
      cosDeg(racers[c].roll) *
      tick.scale;
    if (pitchedOver) {
      car[c].xz -=
        (racers[c].flipBackSpeed - racers[c].flipForwardSpeed) *
        sinDeg(racers[c].roll) *
        tick.scale;
    } else {
      car[c].xz +=
        (racers[c].flipBackSpeed - racers[c].flipForwardSpeed) *
        sinDeg(racers[c].roll) *
        tick.scale;
    }
    racers[c].roll +=
      (racers[c].rollRightSpeed - racers[c].rollLeftSpeed) * tick.scale;
  }
}

function colide(c, xc) {
  if (
    distanceSquared(
      car[c].x,
      car[xc].x,
      car[c].y,
      car[xc].y,
      car[c].z,
      car[xc].z,
    ) <
    (racers[c].body.colrad * racers[c].body.colrad +
      racers[xc].body.colrad * racers[xc].body.colrad) *
      1.5
  ) {
    if (
      !racers[c].caught[xc] &&
      (racers[c].speed != 0 || racers[xc].speed != 0)
    ) {
      // the car with more momentum pushes the other, the heavier one on a tie
      const momentum = Math.abs(
        racers[c].power * racers[c].speed * carStats.moment[car[c].typ],
      );
      const xMomentum = Math.abs(
        racers[xc].power * racers[xc].speed * carStats.moment[car[xc].typ],
      );
      if (momentum != xMomentum) {
        racers[c].dominate[xc] = momentum > xMomentum;
      } else {
        racers[c].dominate[xc] =
          carStats.moment[car[c].typ] > carStats.moment[car[xc].typ];
      }
      racers[c].caught[xc] = true;
    }
  } else {
    if (racers[c].caught[xc]) {
      racers[c].caught[xc] = false;
      racers[c].dominate[xc] = false;
    }
  }
  if (racers[c].dominate[xc]) {
    const at = cornersOf(c);
    const xat = cornersOf(xc);
    let crad =
      ((racers[c].wheelSpeedZ[0] -
        racers[xc].wheelSpeedZ[0] +
        racers[c].wheelSpeedZ[1] -
        racers[xc].wheelSpeedZ[1] +
        racers[c].wheelSpeedZ[2] -
        racers[xc].wheelSpeedZ[2] +
        racers[c].wheelSpeedZ[3] -
        racers[xc].wheelSpeedZ[3]) *
        (racers[c].wheelSpeedZ[0] -
          racers[xc].wheelSpeedZ[0] +
          racers[c].wheelSpeedZ[1] -
          racers[xc].wheelSpeedZ[1] +
          racers[c].wheelSpeedZ[2] -
          racers[xc].wheelSpeedZ[2] +
          racers[c].wheelSpeedZ[3] -
          racers[xc].wheelSpeedZ[3]) +
        (racers[c].wheelSpeedX[0] -
          racers[xc].wheelSpeedX[0] +
          racers[c].wheelSpeedX[1] -
          racers[xc].wheelSpeedX[1] +
          racers[c].wheelSpeedX[2] -
          racers[xc].wheelSpeedX[2] +
          racers[c].wheelSpeedX[3] -
          racers[xc].wheelSpeedX[3]) *
          (racers[c].wheelSpeedX[0] -
            racers[xc].wheelSpeedX[0] +
            racers[c].wheelSpeedX[1] -
            racers[xc].wheelSpeedX[1] +
            racers[c].wheelSpeedX[2] -
            racers[xc].wheelSpeedX[2] +
            racers[c].wheelSpeedX[3] -
            racers[xc].wheelSpeedX[3])) /
      16;
    let arad = 70;
    for (let i = 0; i < 4; i++) {
      let gotcol = false;
      for (let j = 0; j < 4; j++) {
        if (
          distanceSquared(
            at.x[i],
            xat.x[j],
            at.y[i],
            xat.y[j],
            at.z[i],
            xat.z[j],
          ) <
          (crad + arad) *
            (carStats.comprad[car[xc].typ] + carStats.comprad[car[c].typ])
        ) {
          crashCorners(c, xc, i, j, at, xat);
          gotcol = true;
        }
      }
      // a corner that already sank into the other car, wherever its corners are
      if (
        !gotcol &&
        racers[c].grounded &&
        racers[xc].grounded &&
        (overTriangleXZ(at, i, xat, 0, 1, 2) ||
          overTriangleXZ(at, i, xat, 3, 1, 2))
      ) {
        crashCorners(c, xc, i, nearestCorner(at, i, xat), at, xat);
      }
    }
  }
}

// The corners of a car, where it touches others.
function cornersOf(c) {
  const at = { x: [], y: [], z: [] };
  for (let i = 0; i < 4; i++) {
    at.x[i] = car[c].x + car[c].keyx[i];
    if (racers[c].capsized) {
      at.y[i] = car[c].y + carStats.flipy[car[c].typ] + racers[c].squash;
    } else {
      at.y[i] = car[c].y + car[c].grat;
    }
    at.z[i] = car[c].z + car[c].keyz[i];
  }
  rotatePoints(at.x, at.y, car[c].x, car[c].y, car[c].xy, 4);
  rotatePoints(at.y, at.z, car[c].y, car[c].z, car[c].zy, 4);
  rotatePoints(at.x, at.z, car[c].x, car[c].z, car[c].xz, 4);
  return at;
}

// Whether corner i of one car lies, seen from above, in the triangle of corners a, b and d
// of the other (with some slack).
function overTriangleXZ(at, i, xat, a, b, d) {
  const aro = Math.abs(
    (xat.x[b] - xat.x[a]) * (xat.z[d] - xat.z[a]) -
      (xat.x[d] - xat.x[a]) * (xat.z[b] - xat.z[a]),
  );
  const ar1 = Math.abs(
    (xat.x[a] - at.x[i]) * (xat.z[b] - at.z[i]) -
      (xat.x[b] - at.x[i]) * (xat.z[a] - at.z[i]),
  );
  const ar2 = Math.abs(
    (xat.x[b] - at.x[i]) * (xat.z[d] - at.z[i]) -
      (xat.x[d] - at.x[i]) * (xat.z[b] - at.z[i]),
  );
  const ar3 = Math.abs(
    (xat.x[d] - at.x[i]) * (xat.z[a] - at.z[i]) -
      (xat.x[a] - at.x[i]) * (xat.z[d] - at.z[i]),
  );
  return ar1 + ar2 + ar3 < aro + 10;
}

function nearestCorner(at, i, xat) {
  let j = 0;
  let closj = distanceSquared(
    at.x[i],
    xat.x[0],
    at.y[i],
    xat.y[0],
    at.z[i],
    xat.z[0],
  );
  for (let k = 1; k < 4; k++) {
    const pyclos = distanceSquared(
      at.x[i],
      xat.x[k],
      at.y[i],
      xat.y[k],
      at.z[i],
      xat.z[k],
    );
    if (pyclos < closj) {
      closj = pyclos;
      j = k;
    }
  }
  return j;
}

// Corner i of car c, the one dominating, crashes into corner j of car xc.
function crashCorners(c, xc, i, j, at, xat) {
  pushCornerAlong(
    c,
    xc,
    i,
    j,
    at,
    xat,
    racers[c].wheelSpeedX,
    racers[xc].wheelSpeedX,
    HIT.alongX,
  );
  pushCornerAlong(
    c,
    xc,
    i,
    j,
    at,
    xat,
    racers[c].wheelSpeedZ,
    racers[xc].wheelSpeedZ,
    HIT.alongZ,
  );
  if (c == game.player) {
    racers[xc].lastcolido = 70;
  }
  if (xc == game.player) {
    racers[c].lastcolido = 70;
  }
  racers[xc].wheelSpeedY[j] += carStats.lift[car[c].typ];
}

// Along one axis (with the corner speeds sc and xsc), the corner moving harder pushes the
// other away and is slowed and lifted itself; both cars dent.
function pushCornerAlong(c, xc, i, j, at, xat, sc, xsc, hitSide) {
  if (
    Math.abs(sc[i] * carStats.moment[car[c].typ]) >
    Math.abs(xsc[j] * carStats.moment[car[xc].typ])
  ) {
    let tm = xsc[j] * carStats.revpush[car[c].typ];
    if (tm > 30) {
      tm = 30;
    }
    if (tm < -30) {
      tm = -30;
    }
    let vctm = sc[i] * carStats.push[car[c].typ];
    if (vctm > 30) {
      vctm = 30;
    }
    if (vctm < -30) {
      vctm = -30;
    }
    xsc[j] += vctm;
    dentHitCar(c, xc, hitSide, j, vctm * carStats.moment[car[c].typ]);
    sc[i] -= tm;
    regn(hitSide, i, -tm * carStats.moment[car[c].typ], c);
    racers[c].wheelSpeedY[i] += carStats.revlift[car[c].typ];
    dentHitCar(c, xc, HIT.fromBelow, j, carStats.revlift[car[c].typ] * 7);
    if (random.fx() > random.fx()) {
      sprks(
        car[c].typ,
        (at.x[i] + xat.x[j]) / 2,
        (at.y[i] + xat.y[j]) / 2,
        (at.z[i] + xat.z[j]) / 2,
        (racers[xc].wheelSpeedX[j] + racers[c].wheelSpeedX[i]) / 4,
        (racers[xc].wheelSpeedY[j] + racers[c].wheelSpeedY[i]) / 4,
        (racers[xc].wheelSpeedZ[j] + racers[c].wheelSpeedZ[i]) / 4,
        2,
      );
    }
  }
}

// Dents car xc, hit by car c; colidim lets regn sound the crash when the player hit it.
function dentHitCar(c, xc, hitSide, j, mag) {
  if (c == game.player) {
    racers[xc].colidim = true;
  }
  regn(hitSide, j, mag, xc);
  if (racers[xc].colidim) {
    racers[xc].colidim = false;
  }
}
// Dents regn made, waiting to be scratched into their car's texture. In a pile-up that
// takes millions of steps in one tick, and it is only seen, so the drawing scratches as
// many as fit into a frame (see paintDents). Each hit queues its dented spots together,
// four numbers a spot (pxc, pyc, cmag, modpix): a pile-up dents tens of thousands.
const dents = [];
let nextDent = 0;
let nextSpot = 0;

// Scratches a dent into the damage texture: strokes walk from the dented spot (pxc, pyc),
// greying, darkening and breaking windows on their way; a broken window (modpix 3) ends
// the glass breaking for the following strokes. Returns the steps it took.
function scratchDent({ pixels, c, spots }, at) {
  let pxc = spots[at];
  let pyc = spots[at + 1];
  let cmag = spots[at + 2];
  let modpix = spots[at + 3];
  let glassColor = scene.glassColor;
  let fx = random.scratch;
  let steps = 0;
  let npt = Math.round(cmag + fx() * cmag);
  for (let p = 0; p < npt; p++) {
    let pxv = Math.round(6 * fx() - 3);
    let pyv = Math.round(6 * fx() - 3);
    if (pxv == 0 && pyv == 0) {
      let ein = 1;
      if (fx() > fx()) {
        ein = -1;
      }
      if (fx() > fx()) {
        pxv += ein;
      } else {
        pyv += ein;
      }
    }
    let px = pxc + pxv;
    let py = pyc + pyv;
    let rnp = Math.round(20 + fx() * 100);
    let glass = false;
    let ongrey = false;
    if (modpix == 2) {
      glass = true;
    }
    while (rnp > 0 || glass) {
      steps++;
      let pp = px * 4 + py * 256 * 4;
      if (pp < 0 || pp >= pixels.length) {
        // Off the texture: the original read undefined there, which counts as grey, and
        // drew the random amount it then could not write.
        fx();
        ongrey = true;
        if (glass) {
          glass = false;
          rnp = 0;
        }
      } else if (
        pixels[pp] == pixels[pp + 1] &&
        pixels[pp + 1] == pixels[pp + 2]
      ) {
        pixels[pp] += Math.round(fx() * 10 - 5);
        if (pixels[pp] < 0) {
          pixels[pp] = 0;
        }
        if (pixels[pp] > 192) {
          pixels[pp] = 192;
        }
        pixels[pp + 1] = pixels[pp];
        pixels[pp + 2] = pixels[pp];
        if (!ongrey) {
          ongrey = true;
        }
        if (glass) {
          glass = false;
          rnp = 0;
        }
      } else {
        if (
          pixels[pp] == glassColor[0] &&
          pixels[pp + 1] == glassColor[1] &&
          pixels[pp + 2] == glassColor[2]
        ) {
          if (!glass) {
            if (fx() > 0.95) {
              glass = true;
            }
            rnp = 0;
          }
          if (modpix == 2) {
            if (fx() < 0.5) {
              glass = false;
            }
            rnp = 0;
            modpix = 3;
          }
          if (glass) {
            pixels[pp + 3] -= 150;
            if (pixels[pp + 3] < 0) {
              pixels[pp + 3] = 0;
            }
          }
        } else {
          if (!glass && !ongrey) {
            let av = (Math.abs(pxv) + Math.abs(pyv)) / 2 + 1;
            if (av < 2) {
              av = 2;
            }
            pixels[pp] = (65 + pixels[pp] * av) / (1 + av);
            pixels[pp + 1] = (57 + pixels[pp + 1] * av) / (1 + av);
            pixels[pp + 2] = (55 + pixels[pp + 2] * av) / (1 + av);
            car[c].ctxl[0] = px / 256;
            car[c].ctxl[1] = py / 256;
            if (fx() > 0.8) {
              if (Math.abs(pxv) < Math.abs(pyv)) {
                pxv += Math.round(fx() * 2 - 1);
              } else {
                pyv += Math.round(fx() * 2 - 1);
              }
            }
          } else {
            glass = false;
            rnp = 0;
          }
        }
      }
      px += pxv;
      py += pyv;
      rnp--;
    }
  }
  return steps;
}

// Scratches waiting dents until maxSteps are taken; the rest waits for the next frame.
// Dents of a texture that was repaired or replaced since are dropped.
export function paintDents(maxSteps) {
  let steps = 0;
  while (nextDent < dents.length && steps < maxSteps) {
    const dent = dents[nextDent];
    if (dent.pixels == dent.model.damagePixels) {
      steps += scratchDent(dent, nextSpot);
      dent.model.damagedPixels = true;
    }
    nextSpot += 4;
    if (nextSpot == dent.spots.length) {
      nextDent++;
      nextSpot = 0;
    }
  }
  // a pile-up queues tens of thousands of dents; shifting each one off would copy them all
  if (nextDent == dents.length) {
    dents.length = 0;
    nextDent = 0;
  }
  return steps;
}
// How a car is hit, for regn: along its x or z, from below (landing, or lifted by another
// car), or onto its roof, which a hit from below turns into when the car lies on it.
export const HIT = { alongX: 0, alongZ: 1, fromBelow: 2, onRoof: 3 };

export function regn(hitSide, k, mag, c) {
  if (game.phase == PHASE.race) {
    mag *= carStats.dammult[car[c].typ];
  }
  if (Math.abs(mag) > 10) {
    if (game.phase == PHASE.race) {
      recordHit(c, hitSide, k, mag);
    }
    if (mag > 10) {
      mag -= 10;
    }
    if (mag < -10) {
      mag += 10;
    }
    let zsing = 0,
      xsing = 0;
    let keepsShape = false;
    if (hitSide == HIT.fromBelow) {
      keepsShape = true;
      zsing = uprightness(car[c].zy);
      xsing = uprightness(car[c].xy);
      if (xsing * zsing == 0 || racers[c].grounded) {
        keepsShape = false;
      }
      if (xsing * zsing == -1) {
        if (racers[c].nbsq > 0) {
          keepsShape = false;
          hitSide = HIT.onRoof;
          racers[c].nbsq = 0;
        } else {
          racers[c].nbsq++;
        }
      }
      if (game.phase == PHASE.race) {
        crashSound(mag, xsing * zsing, crashHeardAs(c));
      }
    } else {
      if (game.phase == PHASE.race) {
        crashSound(mag, 0, crashHeardAs(c));
      }
    }
    if (!keepsShape) {
      dentBody(c, racers[c].body, hitSide, k, mag);
    }
  }
}

// How car c's sounds are heard (see audio/carSounds.js): null as the player's own,
// else as another car's from where it is. Crashes into the player sound as its own.
const heardAs = (c) => (c == game.player ? null : c);

// Told of every scrape, ground scrape and skid sound of a car, heard or not: the race tape
// keeps them for replays (see raceTape.js). Only heard, so the simulation is the same.
export const carSoundTape = { record: null };
export const CAR_SOUND = { scrape: 0, groundScrape: 1, skid: 2 };

const scrapeOf = (c, sx, sy, sz) => {
  carSoundTape.record?.(c, CAR_SOUND.scrape, 0, sx, sy, sz);
  scrapeSound(sx, sy, sz, heardAs(c));
};

const groundScrapeOf = (c, kind, sx, sy, sz) => {
  carSoundTape.record?.(c, CAR_SOUND.groundScrape, kind, sx, sy, sz);
  groundScrapeSound(kind, sx, sy, sz, heardAs(c));
};

const skidOf = (c, surface, onTrackPiece, mag) => {
  carSoundTape.record?.(
    c,
    CAR_SOUND.skid,
    surface,
    onTrackPiece ? 1 : 0,
    mag,
    0,
  );
  // (only the player's skids are heard: the others' would squeal all the time)
  if (c == game.player) {
    skidSound(surface, onTrackPiece, mag);
  }
};
const crashHeardAs = (c) => (racers[c].colidim ? null : heardAs(c));

// The hit is replayed from the tape in instant replays and highlights (see recording.js).
function recordHit(c, hitSide, k, mag) {
  recording.tape.cars[c].hitAt[recording.tape.cars[c].hitCount] = 430;
  recording.tape.cars[c].hitSide[recording.tape.cars[c].hitCount] = hitSide;
  recording.tape.cars[c].hitPoint[recording.tape.cars[c].hitCount] = k;
  recording.tape.cars[c].hitMag[recording.tape.cars[c].hitCount] = mag;
  recording.tape.cars[c].hitMtouch[recording.tape.cars[c].hitCount] =
    racers[c].grounded;
  recording.tape.cars[c].hitCount++;
}

// 1 when an angle of the car is about level, -1 when it is about upside down, else 0.
function uprightness(angle) {
  while (angle < 360) {
    angle += 360;
  }
  while (angle > 360) {
    angle -= 360;
  }
  if (angle > 330 || angle < 30) {
    return 1;
  }
  if (angle < 210 && angle > 150) {
    return -1;
  }
  return 0;
}

// Moves the body's vertices near corner k (or its roof) by the hit, chipping bits off,
// and queues the dents for its texture.
function dentBody(c, rad, hitSide, k, mag) {
  // the body's own copy of its vertices, mirrored, made on its first hit
  if (rad.iscar == 1) {
    rad.dvert = [];
    for (let i = 0; i < rad.ni; i++) {
      rad.dvert[i * 3] = -rad.vrt[rad.tri[i * 3] * 3];
      rad.dvert[i * 3 + 1] = rad.vrt[rad.tri[i * 3] * 3 + 1];
      rad.dvert[i * 3 + 2] = rad.vrt[rad.tri[i * 3] * 3 + 2];
    }
    rad.iscar = 2;
  }
  const pixels = rad.damagePixels;
  const spots = pixels != null ? [] : null;
  if (hitSide == HIT.onRoof) {
    crushRoof(c, rad, mag, spots);
  } else {
    dentNearCorner(c, rad, hitSide, k, mag, spots);
  }
  if (spots?.length) {
    dents.push({ model: rad, pixels, c, spots });
  }
  rad.damagedVertices = true;
  rad.loaded = 2;
  bodyDamage.dent?.(c, hitSide, k, mag);
}

// Told of every dent and repair of a car's body: the classic look dents its own models
// of the cars (see classic/damage.js). Only seen, so the simulation is the same.
export const bodyDamage = { dent: null, repair: null };

// A pile-up dents tens of thousands of vertices in a tick, hence what stays the same for
// every vertex is looked up once.
function dentNearCorner(c, rad, hitSide, k, mag, spots) {
  const dvert = rad.dvert;
  const keyX = car[c].keyx[k];
  const keyZ = car[c].keyz[k];
  const reach = carStats.clrad[car[c].typ];
  const sinXZ = sinDeg(car[c].xz);
  const cosXZ = cosDeg(car[c].xz);
  const sinXY = sinDeg(car[c].xy);
  const cosXY = cosDeg(car[c].xy);
  const sinZY = sinDeg(car[c].zy);
  const cosZY = cosDeg(car[c].zy);
  for (let i = 0; i < rad.ni; i++) {
    if (distanceSquaredXZ(keyX, dvert[i * 3], keyZ, dvert[i * 3 + 2]) < reach) {
      const tmag = (mag / 30) * random.sim();
      if (hitSide == HIT.alongX) {
        dvert[i * 3 + 2] -= tmag * sinXZ * cosZY;
        dvert[i * 3] += tmag * cosXZ * cosXY;
      }
      if (hitSide == HIT.alongZ) {
        dvert[i * 3 + 2] += tmag * cosXZ * cosZY;
        dvert[i * 3] += tmag * sinXZ * cosXY;
      }
      if (hitSide == HIT.fromBelow) {
        dvert[i * 3 + 2] -= tmag * sinZY;
        dvert[i * 3] += tmag * sinXY;
      }
      chipAndScratch(c, rad, i, tmag, 1, spots);
    }
  }
}

// The original also let vertices near the roof's height count, but it looked up msquash
// by car index and type (msquash[c][typ]), which is never a number, so only vertices
// above it ever do. With 20 cars that lookup crashed for car 19.
function crushRoof(c, rad, mag, spots) {
  let tsq = 0,
    nsq = 0;
  for (let i = 0; i < rad.ni; i++) {
    if (
      rad.dvert[i * 3 + 1] > carStats.flipy[car[c].typ] + racers[c].squash &&
      Math.abs(racers[c].squash) < carStats.msquash[car[c].typ]
    ) {
      const tmag = (mag / 15) * random.sim();
      rad.dvert[i * 3 + 1] -= tmag;
      tsq -= tmag;
      nsq++;
      chipAndScratch(c, rad, i, tmag, 2, spots);
    }
  }
  if (nsq > 0) {
    racers[c].squash += tsq / nsq;
  }
}

// After a vertex is dented: a chip may fly off, the car takes the damage, and the spot
// is queued to be scratched into the texture (modpix 1 for a dent, 2 for a crushed roof).
function chipAndScratch(c, rad, i, tmag, modpix, spots) {
  if (Math.abs(tmag) > 0.1) {
    if (random.fx() > 0.91) {
      if (game.phase != PHASE.replayRewind) {
        chipaway(
          c,
          rad.dvert[i * 3],
          rad.dvert[i * 3 + 1],
          rad.dvert[i * 3 + 2],
          tmag,
        );
      }
    }
  }
  if (game.phase == PHASE.race) {
    racers[c].damage += Math.abs(tmag) * 0.667;
  }
  if (spots) {
    spots.push(
      Math.round(rad.tex[rad.tri[i * 3 + 2] * 2] * 256),
      Math.round((1 - rad.tex[rad.tri[i * 3 + 2] * 2 + 1]) * 256),
      Math.abs(tmag) *
        11 *
        carStats.dammult[car[c].typ] *
        carStats.colrdammult[car[c].typ],
      modpix,
    );
  }
}
export function fixcar(c) {
  bodyDamage.repair?.(c);
  let rad = racers[c].body;
  rad.alpha = BLEND.alpha;
  rad.dvert = [];
  for (var i = 0; i < rad.ni; i++) {
    rad.dvert[i * 3] = -rad.vrt[rad.tri[i * 3] * 3];
    rad.dvert[i * 3 + 1] = rad.vrt[rad.tri[i * 3] * 3 + 1];
    rad.dvert[i * 3 + 2] = rad.vrt[rad.tri[i * 3] * 3 + 2];
  }
  rad.iscar = 2;
  rad.loaded = 0;
  gl.deleteBuffer(rad.vbuf);
  rad.vbuf = null;
  rad.vbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rad.vbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rad.dvert), gl.STATIC_DRAW);
  rad.damagedVertices = false;
  const brokenTexture = rad.texture[1];
  gl.deleteTexture(brokenTexture);
  rad.texture[1] = gl.createTexture();
  // chips still flying would show the deleted texture
  for (let i = 0; i < effects.chipCount; i++) {
    if (effects.chips[i].texture === brokenTexture) {
      effects.chips[i].texture = rad.texture[1];
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, rad.texture[1]);
  // The repaired texture is the one raceCarTextures made when the stage loaded; copying
  // it avoids reading it back from the GPU, which waits for all drawing queued so far.
  if (rad.cleanPixels) {
    let clean = Uint8Array.from(rad.cleanPixels);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      256,
      256,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      clean,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
    keepDamageTexture(rad, clean);
    rad.loaded = 2;
    return;
  }
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    carTextures[car[c].typ],
  );
  gl.generateMipmap(gl.TEXTURE_2D);
  let framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    rad.texture[1],
    0,
  );
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
    var pixels = new Uint8Array(256 * 256 * 4);
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    for (let p = 0; p < 256 * 256 * 4; p += 4) {
      if (pixels[p] == 116 && pixels[p + 1] == 130 && pixels[p + 2] == 140) {
        pixels[p] = scene.glassColor[0];
        pixels[p + 1] = scene.glassColor[1];
        pixels[p + 2] = scene.glassColor[2];
        pixels[p + 3] = 210;
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, rad.texture[1]);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      256,
      256,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
  } else {
    pixels = null;
  }
  gl.deleteFramebuffer(framebuffer);
  keepDamageTexture(rad, pixels);
  rad.loaded = 2;
}
