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
import { gl, keepDamageTexture } from "../render/renderer.js";
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
import { SKID, car, racers } from "./racers.js";
import { HIGHLIGHT, catchHighlight, recording } from "./recording.js";
import { PIECE, pieceModels, pieces, track } from "./track.js";

const drag = 0.05;
const lonorm = [];
export function inishmad() {
  for (let c = 0; c < MAX_CARS; c++) {
    racers[c].mxz = 0;
    racers[c].cxz = 0;
    racers[c].dominate = [];
    racers[c].caught = [];
    for (let i = 0; i < MAX_CARS; i++) {
      racers[c].dominate[i] = false;
      racers[c].caught[i] = false;
    }
    racers[c].pzy = 0;
    racers[c].pxy = 0;
    racers[c].speed = 0;
    racers[c].scy = [];
    racers[c].scx = [];
    racers[c].scz = [];
    for (let i = 0; i < 4; i++) {
      racers[c].scy[i] = 0;
      racers[c].scx[i] = 0;
      racers[c].scz[i] = 0;
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
    racers[c].mtouch = true;
    racers[c].wtouch = true;
    racers[c].cntouch = 0;
    racers[c].capsized = false;
    racers[c].txz = 0;
    racers[c].fxz = 0;
    racers[c].pmlt = 1;
    racers[c].nmlt = 1;
    racers[c].dcnt = 0;
    racers[c].skid = SKID.gripping;
    racers[c].pushed = false;
    racers[c].gtouch = false;
    racers[c].pl = false;
    racers[c].pr = false;
    racers[c].pd = false;
    racers[c].pu = false;
    racers[c].actl = false;
    racers[c].actr = false;
    racers[c].actu = false;
    racers[c].actd = false;
    racers[c].loop = 0;
    racers[c].ucomp = 0;
    racers[c].dcomp = 0;
    racers[c].lcomp = 0;
    racers[c].rcomp = 0;
    racers[c].uwall = false;
    racers[c].lxz = 0;
    racers[c].travxy = 0;
    racers[c].travzy = 0;
    racers[c].travxz = 0;
    racers[c].trcnt = 0;
    racers[c].capcnt = 0;
    racers[c].srfcnt = 0;
    racers[c].rtab = false;
    racers[c].ftab = false;
    racers[c].btab = false;
    racers[c].surfer = false;
    racers[c].powerup = 0;
    racers[c].xtpower = 0;
    racers[c].tilt = 0;
    racers[c].crank = [];
    racers[c].lcrank = [];
    for (let i = 0; i < 4; i++) {
      racers[c].crank[i] = 0;
      racers[c].lcrank[i] = 0;
    }
    racers[c].squash = 0;
    racers[c].nbsq = 0;
    racers[c].hitmag = 0;
    racers[c].cntdest = 0;
    racers[c].dest = false;
    racers[c].embos = 0;
    racers[c].embodir = 0;
    racers[c].embomag = 0;
    racers[c].bshft = 0;
    racers[c].pcleared = track.pcs;
    racers[c].clear = 0;
    racers[c].nlaps = 0;
    racers[c].focus = -1;
    racers[c].power = 98;
    racers[c].missedcp = 0;
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
      if (racers[0].wtouch) {
        if (flipont) {
          racers[0].pxy += 180;
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
  let pitch = Math.abs(racers[c].pzy);
  while (pitch > 270) {
    pitch -= 360;
  }
  pitch = Math.abs(pitch);
  if (pitch > 90) {
    pitchedOver = true;
  }
  let rolledOver = false;
  let roll = Math.abs(racers[c].pxy);
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
  if (racers[c].mtouch) {
    racers[c].loop = 0;
  }
  touchDownFromStunt(c);
  watchPlayerStuntKeys(c);
  startStuntWithHandbrake(c);
  startStunt(c);
  if (!racers[c].dest) {
    if (racers[c].loop == 2) {
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
    (racers[c].scx[0] +
      racers[c].scx[1] +
      racers[c].scx[2] +
      racers[c].scx[3]) /
    4;
  let avgSpeedZ =
    (racers[c].scz[0] +
      racers[c].scz[1] +
      racers[c].scz[2] +
      racers[c].scz[3]) /
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
  step.touchedGround = racers[c].mtouch;
  if (racers[c].mtouch) {
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
    racers[c].mtouch = true;
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
    if (!racers[c].mtouch && racers[c].wtouch) {
      if (racers[c].cntouch == 10) {
        racers[c].mtouch = true;
      } else {
        racers[c].cntouch++;
      }
    } else {
      racers[c].cntouch = 0;
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
  if (racers[c].uwall) {
    racers[c].uwall = false;
  }
  if (
    tick.fraction >= tick.scale &&
    racers[c].lastcolido != 0 &&
    !racers[c].dest
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
        (racers[c].pcleared == 27 || racers[c].pcleared == 35) &&
        pnt < 29
      ) {
        pnt = 33;
      }
      let ic = racers[c].pcleared + 1;
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
          pnt < racers[c].pcleared
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
      if (racers[c].missedcp != -1) {
        racers[c].missedcp = -1;
      }
    } else {
      if (racers[c].missedcp != 0) {
        racers[c].missedcp = 0;
      }
    }
  } else {
    pnt = racers[c].focus;
    if (c == game.player) {
      if (
        racers[c].missedcp == 0 &&
        racers[c].mtouch &&
        Math.sqrt(
          distanceSquaredXZ(
            car[c].x / 10,
            track.x[racers[c].focus] / 10,
            car[c].z / 10,
            track.z[racers[c].focus] / 10,
          ),
        ) > 80
      ) {
        racers[c].missedcp = 1;
      }
      if (
        racers[c].missedcp == -2 &&
        Math.sqrt(
          distanceSquaredXZ(
            car[c].x / 10,
            track.x[racers[c].focus] / 10,
            car[c].z / 10,
            track.z[racers[c].focus] / 10,
          ),
        ) < 40
      ) {
        racers[c].missedcp = 0;
      }
      if (
        racers[c].missedcp != 0 &&
        racers[c].mtouch &&
        Math.sqrt(
          distanceSquaredXZ(
            car[c].x / 10,
            track.x[racers[c].focus] / 10,
            car[c].z / 10,
            track.z[racers[c].focus] / 10,
          ),
        ) < 25
      ) {
        racers[c].missedcp = 68;
      }
    } else {
      racers[c].missedcp = 1;
    }
    if (racers[c].nofocus) {
      racers[c].focus = -1;
      racers[c].missedcp = 0;
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
      racers[c].body.alpha = 1;
      if (car[c].fcnt % 2 == 0) {
        if (random.fx() > 0.333) {
          if (random.fx() > random.fx()) {
            racers[c].body.alpha = 3;
          } else {
            racers[c].body.alpha = 2;
          }
        }
      }
      if (tick.fraction >= tick.scale) {
        if (car[c].fcnt == 20) {
          racers[c].squash = 0;
          racers[c].nbsq = 0;
          racers[c].hitmag = 0;
          racers[c].cntdest = 0;
          racers[c].dest = false;
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
  if (!racers[c].mtouch) {
    if (racers[c].trcnt != 1) {
      racers[c].trcnt = 1;
      racers[c].lxz = car[c].xz;
    }
    if (racers[c].loop == 2 || racers[c].loop == -1) {
      racers[c].travxy += (racers[c].rcomp - racers[c].lcomp) * tick.scale;
      if (Math.abs(racers[c].travxy) > 135) {
        racers[c].rtab = true;
      }
      racers[c].travzy += (racers[c].ucomp - racers[c].dcomp) * tick.scale;
      if (racers[c].travzy > 135) {
        racers[c].ftab = true;
      }
      if (racers[c].travzy < -135) {
        racers[c].btab = true;
      }
    }
    if (racers[c].lxz != car[c].xz) {
      racers[c].travxz += racers[c].lxz - car[c].xz;
      racers[c].lxz = car[c].xz;
    }
    if (tick.fraction >= tick.scale) {
      if (racers[c].srfcnt < 10) {
        if (racers[c].uwall) {
          racers[c].surfer = true;
        }
        racers[c].srfcnt++;
      }
    }
  } else {
    if (!racers[c].dest) {
      if (!racers[c].capsized) {
        if (racers[c].capcnt != 0) {
          racers[c].capcnt = 0;
        }
        if (racers[c].gtouch && tick.fraction >= tick.scale) {
          if (racers[c].trcnt != 0) {
            if (racers[c].trcnt == 9) {
              racers[c].powerup = 0;
              if (Math.abs(racers[c].travxy) > 90) {
                racers[c].powerup += Math.abs(racers[c].travxy) / 24;
              } else {
                if (racers[c].rtab) {
                  racers[c].powerup += 30;
                }
              }
              if (Math.abs(racers[c].travzy) > 90) {
                racers[c].powerup += Math.abs(racers[c].travzy) / 18;
              } else {
                if (racers[c].ftab) {
                  racers[c].powerup += 40;
                }
                if (racers[c].btab) {
                  racers[c].powerup += 40;
                }
              }
              if (Math.abs(racers[c].travxz) > 90) {
                racers[c].powerup += Math.abs(racers[c].travxz) / 18;
              }
              if (racers[c].surfer) {
                racers[c].powerup += 30;
              }
              racers[c].power += racers[c].powerup;
              if (
                c == game.player &&
                racers[c].powerup > recording.bestPowerUp &&
                recording.highlight <= HIGHLIGHT.stunt &&
                (racers[c].powerup > 60 || track.stage == 1 || track.stage == 2)
              ) {
                recording.stuntCatchTicks = 43;
                recording.bestPowerUp = racers[c].powerup;
              }
              if (racers[c].power > 98) {
                racers[c].power = 98;
                if (racers[c].powerup > 150) {
                  racers[c].xtpower = 200;
                } else {
                  racers[c].xtpower = 100;
                }
              }
            }
            if (racers[c].trcnt == 10) {
              racers[c].travxy = 0;
              racers[c].travzy = 0;
              racers[c].travxz = 0;
              racers[c].ftab = false;
              racers[c].rtab = false;
              racers[c].btab = false;
              racers[c].trcnt = 0;
              racers[c].srfcnt = 0;
              racers[c].surfer = false;
            } else {
              racers[c].trcnt++;
            }
          }
        }
      } else {
        if (racers[c].trcnt != 0) {
          racers[c].travxy = 0;
          racers[c].travzy = 0;
          racers[c].travxz = 0;
          racers[c].ftab = false;
          racers[c].rtab = false;
          racers[c].btab = false;
          racers[c].trcnt = 0;
          racers[c].srfcnt = 0;
          racers[c].surfer = false;
        }
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
              Math.abs(racers[c].scz[i]) < flmat &&
              Math.abs(racers[c].scx[i]) < flmat
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
              racers[c].pxy += 180;
              car[c].xy += 180;
              racers[c].capcnt = 0;
            }
          }
        }
      }
      if (racers[c].trcnt == 0 && racers[c].speed != 0) {
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
        if (racers[c].xtpower == 0) {
          if (racers[c].power > 0) {
            racers[c].power -=
              (racers[c].power * racers[c].power * racers[c].power * pfact) /
              carStats.powerloss[type];
          } else {
            racers[c].power = 0;
          }
        } else {
          racers[c].xtpower--;
        }
      }
    }
  }
}

function recordHowWasted(c) {
  if (racers[c].dest) {
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
  if (racers[c].scy[2] != racers[c].scy[0]) {
    pitchTilt = tiltBetween(
      c,
      0,
      2,
      Math.abs(car[c].keyz[0]) + Math.abs(car[c].keyz[2]),
      step,
    );
  }
  if (racers[c].scy[3] != racers[c].scy[1]) {
    otherPitchTilt = tiltBetween(
      c,
      1,
      3,
      Math.abs(car[c].keyz[1]) + Math.abs(car[c].keyz[3]),
      step,
    );
  }
  if (racers[c].scy[1] != racers[c].scy[0]) {
    rollTilt = tiltBetween(
      c,
      0,
      1,
      Math.abs(car[c].keyx[0]) + Math.abs(car[c].keyx[1]),
      step,
    );
  }
  if (racers[c].scy[3] != racers[c].scy[2]) {
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
    racers[c].pzy += pitchTilt * tick.scale;
  } else {
    racers[c].pzy -= pitchTilt * tick.scale;
  }
  if (!rolledOver) {
    racers[c].pxy += rollTilt * tick.scale;
  } else {
    racers[c].pxy -= rollTilt * tick.scale;
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
    (racers[c].scz[0] * racers[c].nmlt -
      racers[c].scz[1] * racers[c].pmlt +
      racers[c].scz[2] * racers[c].pmlt -
      racers[c].scz[3] * racers[c].nmlt +
      racers[c].scx[0] * racers[c].pmlt +
      racers[c].scx[1] * racers[c].nmlt -
      racers[c].scx[2] * racers[c].nmlt -
      racers[c].scx[3] * racers[c].pmlt);
}

function settleLevel(c, step) {
  if (step.wheelsOnGround == 4) {
    let tat = 0;
    while (racers[c].pzy < 360) {
      racers[c].pzy += 360;
      car[c].zy += 360;
    }
    while (racers[c].pzy > 360) {
      racers[c].pzy -= 360;
      car[c].zy -= 360;
    }
    if (racers[c].pzy < 190 && racers[c].pzy > 170) {
      racers[c].pzy = 180;
      car[c].zy = 180;
      tat++;
    }
    if (racers[c].pzy > 350 || racers[c].pzy < 10) {
      racers[c].pzy = 0;
      car[c].zy = 0;
      tat++;
    }
    while (racers[c].pxy < 360) {
      racers[c].pxy += 360;
      car[c].xy += 360;
    }
    while (racers[c].pxy > 360) {
      racers[c].pxy -= 360;
      car[c].xy -= 360;
    }
    if (racers[c].pxy < 190 && racers[c].pxy > 170) {
      racers[c].pxy = 180;
      car[c].xy = 180;
      tat++;
    }
    if (racers[c].pxy > 350 || racers[c].pxy < 10) {
      racers[c].pxy = 0;
      car[c].xy = 0;
      tat++;
    }
    if (tat == 2) {
      racers[c].mtouch = true;
    }
  }
}

function placeOnWheels(c, wheelDrop, airPush, flipSign, step) {
  car[c].y =
    (step.wheelY[0] + step.wheelY[1] + step.wheelY[2] + step.wheelY[3]) / 4 -
    wheelDrop * cosDeg(racers[c].pzy) * cosDeg(racers[c].pxy) +
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
    wheelDrop * sinDeg(racers[c].pxy) * cosDeg(car[c].xz) -
    wheelDrop * sinDeg(racers[c].pzy) * sinDeg(car[c].xz) +
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
    wheelDrop * sinDeg(racers[c].pxy) * sinDeg(car[c].xz) -
    wheelDrop * sinDeg(racers[c].pzy) * cosDeg(car[c].xz) +
    airPush.z * tick.scale;
}

function followTilt(c) {
  if (Math.abs(racers[c].speed) > 10 || !racers[c].mtouch) {
    if (Math.abs(racers[c].pxy - car[c].xy) >= 4 * tick.scale) {
      if (racers[c].pxy > car[c].xy) {
        car[c].xy += 2 * tick.scale + (racers[c].pxy - car[c].xy) / 2;
      } else {
        car[c].xy -= 2 * tick.scale + (car[c].xy - racers[c].pxy) / 2;
      }
    } else {
      car[c].xy = racers[c].pxy;
    }
    if (Math.abs(racers[c].pzy - car[c].zy) >= 4 * tick.scale) {
      if (racers[c].pzy > car[c].zy) {
        car[c].zy += 2 * tick.scale + (racers[c].pzy - car[c].zy) / 2;
      } else {
        car[c].zy -= 2 * tick.scale + (car[c].zy - racers[c].pzy) / 2;
      }
    } else {
      car[c].zy = racers[c].pzy;
    }
  }
}

function leanIntoTurns(c, type) {
  if (racers[c].wtouch && !racers[c].capsized) {
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
    if (racers[c].gtouch) {
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
    if (racers[c].mtouch && step.surface == DUST.sand) {
      car[c].zy +=
        ((random.sim() * 5 * racers[c].speed) / carStats.swits[type][2] -
          (2.5 * racers[c].speed) / carStats.swits[type][2]) *
        (carStats.bounce[type] - 0.3);
      car[c].xy +=
        ((random.sim() * 5 * racers[c].speed) / carStats.swits[type][2] -
          (2.5 * racers[c].speed) / carStats.swits[type][2]) *
        (carStats.bounce[type] - 0.3);
    }
    if (racers[c].wtouch && step.surface == DUST.ground) {
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
    if (racers[c].hitmag >= carStats.maxmag[type]) {
      if (recording.tape.cars[c].wastedAt == 700) {
        recording.tape.cars[c].wastedAt = 430;
        if (racers[c].lastcolido != 0) {
          recording.tape.cars[c].playerHitTicks = racers[c].lastcolido;
        }
      }
      if (racers[c].cntdest < 6) {
        if (racers[c].embos == 0) {
          racers[c].body.alpha = 1;
          racers[c].embodir = Math.floor(random.fx() * 3);
          if (racers[c].embodir == 3) {
            racers[c].embodir = 0;
          }
          racers[c].embomag = 1.2 + random.fx() * 0.2;
        }
        if (racers[c].embos == 1) {
          racers[c].body.alpha = 2;
        }
        racers[c].embos++;
        if (racers[c].embos == 2) {
          racers[c].embos = 0;
          racers[c].cntdest++;
        }
      } else {
        if (racers[c].cntdest == 6) {
          racers[c].body.alpha = 1;
          racers[c].embodir = 0;
          chipburn(c);
          racers[c].embos = 0;
          racers[c].cntdest = 7;
        }
        firexp(
          c,
          avgSpeedX,
          (racers[c].scy[0] +
            racers[c].scy[1] +
            racers[c].scy[2] +
            racers[c].scy[3]) /
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
        racers[c].dest = true;
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
                racers[c].scz[0] +
                  racers[c].scz[1] +
                  racers[c].scz[2] +
                  racers[c].scz[3],
              ) /
                4 &&
          Math.abs(car[c].x - track.x[i]) < 70 &&
          Math.abs(car[c].y - track.y[i] - 15) < 45
        ) {
          if (racers[c].clear == ic + racers[c].nlaps * track.nsp - 1) {
            racers[c].clear = ic + racers[c].nlaps * track.nsp;
            racers[c].pcleared = i;
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
                racers[c].scx[0] +
                  racers[c].scx[1] +
                  racers[c].scx[2] +
                  racers[c].scx[3],
              ) /
                4 &&
          Math.abs(car[c].z - track.z[i]) < 70 &&
          Math.abs(car[c].y - track.y[i] - 15) < 45
        ) {
          if (racers[c].clear == ic + racers[c].nlaps * track.nsp - 1) {
            racers[c].clear = ic + racers[c].nlaps * track.nsp;
            racers[c].pcleared = i;
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
            racers[c].scx[k],
            racers[c].scy[k],
            racers[c].scz[k],
            1,
          );
        }
        if (c == game.player && step.sparkKind[k]) {
          groundScrapeSound(
            step.sparkKind[k],
            racers[c].scx[k],
            racers[c].scy[k],
            racers[c].scz[k],
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
        racers[c].scx[k],
        racers[c].scy[k],
        racers[c].scz[k],
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
        racers[c].scx[k],
        racers[c].scy[k],
        racers[c].scz[k],
        1,
      );
      if (c == game.player) {
        groundScrapeSound(
          1,
          racers[c].scx[k],
          racers[c].scy[k],
          racers[c].scz[k],
        );
      }
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
    racers[c].mtouch = true;
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
        (racers[c].scz[k] <= 1.2 || atAnySpeed)
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
        (racers[c].scz[k] >= -1.2 || atAnySpeed)
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
        (racers[c].scx[k] <= 1.2 || atAnySpeed)
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
        (racers[c].scx[k] >= -1.2 || atAnySpeed)
      ) {
        step.hitWall = true;
        bounceOffWallFacingMinusX(c, k, type, colx, rad.dam, false, step);
        hitPieceWall(c, o, false);
      }
    }
  }
}

function landOnFlat(c, k, type, coly, step) {
  racers[c].wtouch = true;
  racers[c].gtouch = true;
  if (!step.touchedGround) {
    if (racers[c].scy[k] != -0.7) {
      let mag = racers[c].scy[k] / 33.33;
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
        racers[c].scx[k],
        racers[c].scz[k],
        mag * carStats.simag[type],
        0,
        racers[c].capsized && racers[c].mtouch,
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
  regn(2, k, Math.abs(racers[c].scy[k] * bounce), c);
  if (racers[c].scy[k] < 0) {
    racers[c].scy[k] += Math.abs(racers[c].scy[k] * bounce);
  }
  step.axleOnGround[Math.floor(k * 0.5)] = 1;
}

function landOnSlope(tri, c, k, type, o, coly, colz, colx, i, step) {
  let bounceramp = false;
  if (Math.abs(tri.nz) > Math.abs(tri.nx)) {
    if (
      (tri.nz > 0 && racers[c].scz[k] < 0) ||
      (tri.nz < 0 && racers[c].scz[k] > 0)
    ) {
      bounceramp = true;
    }
  } else {
    if (
      (tri.nx > 0 && racers[c].scx[k] < 0) ||
      (tri.nx < 0 && racers[c].scx[k] > 0)
    ) {
      bounceramp = true;
    }
  }
  if (bounceramp) {
    const bounce = groundBounce(c, type);
    if (racers[c].scy[k] < 0) {
      racers[c].scy[k] += Math.abs(racers[c].scy[k] * bounce);
    }
    if (pieces.list[o].typ == PIECE.tside) {
      for (let ka = 0; ka < 4; ka++) {
        if (Math.abs(tri.nz) > Math.abs(tri.nx)) {
          if (tri.nz > 0) {
            racers[c].scz[ka] += Math.abs(racers[c].scy[k] * bounce * 0.4);
          } else {
            racers[c].scz[ka] -= Math.abs(racers[c].scy[k] * bounce * 0.4);
          }
        } else {
          if (tri.nx > 0) {
            racers[c].scx[ka] += Math.abs(racers[c].scy[k] * bounce * 0.4);
          } else {
            racers[c].scx[ka] -= Math.abs(racers[c].scy[k] * bounce * 0.4);
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
  racers[c].scy[k] += difco;
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
  racers[c].wtouch = true;
  racers[c].gtouch = false;
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
        racers[c].scx[i],
        racers[c].scz[i],
        mag * carStats.simag[type],
        0,
        racers[c].capsized && racers[c].mtouch,
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
  racers[c].uwall = true;
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
        racers[c].scx[k],
        racers[c].scy[k],
        racers[c].scz[k],
        2,
      );
      if (c == game.player) {
        scrapeSound(racers[c].scx[k], racers[c].scy[k], racers[c].scz[k]);
      }
    }
  }
  const bounce = wallBounce(c, type, step);
  regn(1, k, Math.abs(racers[c].scz[k] * bounce * damage), c);
  if (racers[c].scz[k] <= 0) {
    racers[c].scz[k] += Math.abs(racers[c].scz[k] * bounce);
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
        racers[c].scx[k],
        racers[c].scy[k],
        racers[c].scz[k],
        2,
      );
      if (c == game.player) {
        scrapeSound(racers[c].scx[k], racers[c].scy[k], racers[c].scz[k]);
      }
    }
  }
  const bounce = wallBounce(c, type, step);
  regn(1, k, -Math.abs(racers[c].scz[k] * bounce * damage), c);
  if (racers[c].scz[k] >= 0) {
    racers[c].scz[k] -= Math.abs(racers[c].scz[k] * bounce);
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
        racers[c].scx[k],
        racers[c].scy[k],
        racers[c].scz[k],
        2,
      );
      if (c == game.player) {
        scrapeSound(racers[c].scx[k], racers[c].scy[k], racers[c].scz[k]);
      }
    }
  }
  const bounce = wallBounce(c, type, step);
  regn(0, k, Math.abs(racers[c].scx[k] * bounce * damage), c);
  if (racers[c].scx[k] <= 0) {
    racers[c].scx[k] += Math.abs(racers[c].scx[k] * bounce);
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
        racers[c].scx[k],
        racers[c].scy[k],
        racers[c].scz[k],
        2,
      );
      if (c == game.player) {
        scrapeSound(racers[c].scx[k], racers[c].scy[k], racers[c].scz[k]);
      }
    }
  }
  const bounce = wallBounce(c, type, step);
  regn(0, k, -Math.abs(racers[c].scx[k] * bounce * damage), c);
  if (racers[c].scx[k] >= 0) {
    racers[c].scx[k] -= Math.abs(racers[c].scx[k] * bounce);
  }
  racers[c].skid = SKID.takeSpeedFromMotion;
}

function placeWheelPoints(c, wheelDrop, step) {
  for (let i = 0; i < 4; i++) {
    step.wheelX[i] = car[c].keyx[i] + car[c].x;
    step.wheelY[i] = wheelDrop + car[c].y;
    step.wheelZ[i] = car[c].z + car[c].keyz[i];
    racers[c].scy[i] -= 0.7 * tick.scale;
  }
  rotatePoints(step.wheelX, step.wheelY, car[c].x, car[c].y, racers[c].pxy, 4);
  rotatePoints(step.wheelY, step.wheelZ, car[c].y, car[c].z, racers[c].pzy, 4);
  rotatePoints(step.wheelX, step.wheelZ, car[c].x, car[c].z, car[c].xz, 4);
}

function keepWheelSpeedsTogether(c, avgSpeedX, avgSpeedZ) {
  for (let i = 0; i < 4; i++) {
    if (racers[c].scx[i] - avgSpeedX > 20) {
      racers[c].scx[i] = 20 + avgSpeedX;
    }
    if (racers[c].scx[i] - avgSpeedX < -20) {
      racers[c].scx[i] = avgSpeedX - 20;
    }
    if (racers[c].scz[i] - avgSpeedZ > 20) {
      racers[c].scz[i] = 20 + avgSpeedZ;
    }
    if (racers[c].scz[i] - avgSpeedZ < -20) {
      racers[c].scz[i] = avgSpeedZ - 20;
    }
  }
}

function moveWheelPoints(c, step) {
  for (let i = 0; i < 4; i++) {
    step.wheelY[i] += racers[c].scy[i] * tick.scale;
    step.wheelX[i] +=
      ((racers[c].scx[0] +
        racers[c].scx[1] +
        racers[c].scx[2] +
        racers[c].scx[3]) /
        4) *
      tick.scale;
    step.wheelZ[i] +=
      ((racers[c].scz[0] +
        racers[c].scz[1] +
        racers[c].scz[2] +
        racers[c].scz[3]) /
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
      racers[c].wtouch = true;
      racers[c].gtouch = true;
      if (!step.touchedGround) {
        if (racers[c].scy[i] != -0.7) {
          let mag = racers[c].scy[i] / 33.33;
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
            racers[c].scx[i],
            racers[c].scz[i],
            mag * carStats.simag[type],
            0,
            racers[c].capsized && racers[c].mtouch,
          );
        }
      }
      step.wheelY[i] = 0;
      const bounce = groundBounce(c, type);
      regn(2, i, Math.abs(racers[c].scy[i] * bounce), c);
      if (racers[c].scy[i] < 0) {
        racers[c].scy[i] += Math.abs(racers[c].scy[i] * bounce);
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
  grip -= (Math.abs(racers[c].txz - car[c].xz) * racers[c].speed) / 250;
  if (racers[c].u.handb) {
    grip -= Math.abs(racers[c].txz - car[c].xz) * 4;
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
  let driveX = -(racers[c].speed * sinDeg(car[c].xz) * cosDeg(racers[c].pzy));
  let driveZ = racers[c].speed * cosDeg(car[c].xz) * cosDeg(racers[c].pzy);
  let driveY = -(racers[c].speed * sinDeg(racers[c].pzy));
  if (racers[c].capsized || racers[c].dest || track.haltall) {
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
    if (Math.abs(racers[c].scx[i] - driveX) > grip * tick.scale) {
      if (racers[c].scx[i] < driveX) {
        racers[c].scx[i] += grip * tick.scale;
      } else {
        racers[c].scx[i] -= grip * tick.scale;
      }
    } else {
      racers[c].scx[i] = driveX;
    }
    if (Math.abs(racers[c].scz[i] - driveZ) > grip * tick.scale) {
      if (racers[c].scz[i] < driveZ) {
        racers[c].scz[i] += grip * tick.scale;
      } else {
        racers[c].scz[i] -= grip * tick.scale;
      }
    } else {
      racers[c].scz[i] = driveZ;
    }
    if (Math.abs(racers[c].scy[i] - driveY) > grip * tick.scale) {
      if (racers[c].scy[i] < driveY) {
        racers[c].scy[i] += grip * tick.scale;
      } else {
        racers[c].scy[i] -= grip * tick.scale;
      }
    } else {
      racers[c].scy[i] = driveY;
    }
    if (tick.fraction >= tick.scale) {
      kickUpDust(grip, type, c, i, step);
    }
    totalX += racers[c].scx[i];
    totalZ += racers[c].scz[i];
  }
  racers[c].txz = car[c].xz;
  let side = 1;
  if (totalX > 0) {
    side = -1;
  }
  let cos = 0;
  if (totalX != 0 || totalZ != 0) {
    cos = totalZ / Math.sqrt(totalX * totalX + totalZ * totalZ);
  }
  racers[c].mxz = (Math.acos(cos) / 0.017453292519943295) * side;
  if (racers[c].skid == SKID.takeSpeedFromMotion) {
    if (!racers[c].capsized) {
      totalX = totalX / 4;
      totalZ = totalZ / 4;
      if (turnedRound) {
        racers[c].speed = -(
          Math.sqrt(totalX * totalX + totalZ * totalZ) *
          cosDeg(racers[c].mxz - car[c].xz)
        );
      } else {
        racers[c].speed =
          Math.sqrt(totalX * totalX + totalZ * totalZ) *
          cosDeg(racers[c].mxz - car[c].xz);
      }
    }
    racers[c].skid = SKID.gripping;
  }
  if (racers[c].capsized && totalX == 0 && totalZ == 0) {
    step.surface = DUST.road;
  }
  racers[c].mtouch = false;
}

function kickUpDust(grip, type, c, i, step) {
  if (grip < carStats.grip[type]) {
    if (racers[c].txz != car[c].xz) {
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
          racers[c].scx[i],
          racers[c].scz[i],
          mag * carStats.simag[type],
          racers[c].tilt,
          racers[c].capsized && racers[c].mtouch,
        );
        if (c == game.player && !racers[c].capsized) {
          skidSound(
            step.surface,
            step.onTrackPiece,
            Math.sqrt(
              racers[c].scx[i] * racers[c].scx[i] +
                racers[c].scz[i] * racers[c].scz[i],
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
            racers[c].scx[i],
            racers[c].scz[i],
            1.1 * carStats.simag[type],
            racers[c].tilt,
            racers[c].capsized && racers[c].mtouch,
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
            racers[c].scx[i],
            racers[c].scz[i],
            1.15 * carStats.simag[type],
            racers[c].tilt,
            racers[c].capsized && racers[c].mtouch,
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
    Math.abs(sinDeg(racers[c].pxy)) + Math.abs(sinDeg(racers[c].pzy));
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
    Math.abs(cosDeg(racers[c].pxy)) + Math.abs(cosDeg(racers[c].pzy));
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
  if (racers[c].scy[b] < racers[c].scy[a]) {
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
  if (racers[c].wtouch) {
    if (racers[c].loop == 2 || racers[c].loop == -1) {
      racers[c].loop = -1;
      if (racers[c].u.left) {
        racers[c].pl = true;
      }
      if (racers[c].u.right) {
        racers[c].pr = true;
      }
      if (racers[c].u.up) {
        racers[c].pu = true;
      }
      if (racers[c].u.down) {
        racers[c].pd = true;
      }
    }
    racers[c].ucomp = 0;
    racers[c].dcomp = 0;
    racers[c].lcomp = 0;
    racers[c].rcomp = 0;
  }
}

function watchPlayerStuntKeys(c) {
  if (c == game.player) {
    if (!racers[c].wtouch) {
      if (racers[c].u.up) {
        if (!racers[c].actu) {
          if (racers[c].loop == 0) {
            racers[c].loop = 1;
          }
        }
      } else {
        racers[c].actu = false;
      }
      if (racers[c].u.down) {
        if (!racers[c].actd) {
          if (racers[c].loop == 0) {
            racers[c].loop = 1;
          }
        }
      } else {
        racers[c].actd = false;
      }
      if (racers[c].u.left) {
        if (!racers[c].actl) {
          if (racers[c].loop == 0) {
            racers[c].loop = 1;
          }
        }
      } else {
        racers[c].actl = false;
      }
      if (racers[c].u.right) {
        if (!racers[c].actr) {
          if (racers[c].loop == 0) {
            racers[c].loop = 1;
          }
        }
      } else {
        racers[c].actr = false;
      }
    } else {
      racers[c].actl = true;
      racers[c].actr = true;
      racers[c].actu = true;
      racers[c].actd = true;
    }
  }
}

function startStuntWithHandbrake(c) {
  if (racers[c].u.handb) {
    if (!racers[c].pushed) {
      if (!racers[c].wtouch) {
        if (racers[c].loop == 0) {
          racers[c].loop = 1;
          racers[c].actl = false;
          racers[c].actr = false;
          racers[c].actu = false;
          racers[c].actd = false;
        }
      } else {
        if (racers[c].gtouch) {
          racers[c].pushed = true;
        }
      }
    }
  } else {
    racers[c].pushed = false;
  }
}

function startStunt(c) {
  if (racers[c].loop == 1) {
    let avay =
      (racers[c].scy[0] +
        racers[c].scy[1] +
        racers[c].scy[2] +
        racers[c].scy[3]) /
      4;
    for (let i = 0; i < 4; i++) {
      racers[c].scy[i] = avay;
    }
    racers[c].loop = 2;
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
  if (racers[c].wtouch) {
    if (!racers[c].capsized) {
      if (!racers[c].u.handb) {
        racers[c].fxz = (car[c].wxz / (turnRadius * 3)) * tick.scale;
      } else {
        racers[c].fxz = (car[c].wxz / turnRadius) * tick.scale;
      }
      car[c].xz += (car[c].wxz / turnRadius) * tick.scale;
    }
    racers[c].wtouch = false;
    racers[c].gtouch = false;
  } else {
    car[c].xz += racers[c].fxz;
  }
}

function swingCameraHeading(c) {
  if (racers[c].speed > 3 || racers[c].speed < -7) {
    while (Math.abs(racers[c].mxz - racers[c].cxz) > 180) {
      if (racers[c].cxz > racers[c].mxz) {
        racers[c].cxz -= 360;
      } else {
        if (racers[c].cxz < racers[c].mxz) {
          racers[c].cxz += 360;
        }
      }
    }
    if (Math.abs(racers[c].mxz - racers[c].cxz) < 30) {
      racers[c].cxz += (racers[c].mxz - racers[c].cxz) / 4;
    } else {
      if (racers[c].cxz > racers[c].mxz) {
        racers[c].cxz -= 10 * tick.scale;
      }
      if (racers[c].cxz < racers[c].mxz) {
        racers[c].cxz += 10 * tick.scale;
      }
    }
  }
}

function rotateInStunt(c, type, airPush, rollSign, flipSign, pitchedOver) {
  if (racers[c].u.up && !racers[c].actu) {
    if (racers[c].ucomp == 0) {
      racers[c].ucomp = 10 + (-racers[c].scy[0] * 10 + 50) / 20;
      if (racers[c].ucomp < 5) {
        racers[c].ucomp = 5;
      }
      if (racers[c].ucomp > 10) {
        racers[c].ucomp = 10;
      }
      racers[c].ucomp *= carStats.airs[type];
    }
    if (racers[c].ucomp < 20) {
      racers[c].ucomp += 0.5 * carStats.airs[type];
    }
    airPush.x = -carStats.airc[type] * sinDeg(car[c].xz) * rollSign;
    airPush.z = carStats.airc[type] * cosDeg(car[c].xz) * rollSign;
  } else {
    if (racers[c].ucomp != 0) {
      if (racers[c].ucomp > -2) {
        racers[c].ucomp -= 0.5 * carStats.airs[type];
      }
    }
  }
  if (racers[c].u.down && !racers[c].actd) {
    if (racers[c].dcomp == 0) {
      racers[c].dcomp = 10 + (-racers[c].scy[0] * 10 + 50) / 20;
      if (racers[c].dcomp < 5) {
        racers[c].dcomp = 5;
      }
      if (racers[c].dcomp > 10) {
        racers[c].dcomp = 10;
      }
      racers[c].dcomp *= carStats.airs[type];
    }
    if (racers[c].dcomp < 20) {
      racers[c].dcomp += 0.5 * carStats.airs[type];
    }
    airPush.y = carStats.airc[type];
  } else {
    if (racers[c].dcomp != 0) {
      if (racers[c].ucomp > -2) {
        racers[c].dcomp -= 0.5 * carStats.airs[type];
      }
    }
  }
  if (racers[c].u.left && !racers[c].actl) {
    if (racers[c].lcomp == 0) {
      racers[c].lcomp = 5;
    }
    if (racers[c].lcomp < 20) {
      racers[c].lcomp += 2 * carStats.airs[type];
    }
    airPush.x = carStats.airc[type] * cosDeg(car[c].xz) * flipSign;
    airPush.z = carStats.airc[type] * sinDeg(car[c].xz) * flipSign;
  } else {
    if (racers[c].lcomp > 0) {
      racers[c].lcomp -= 2 * carStats.airs[type];
    }
  }
  if (racers[c].u.right && !racers[c].actr) {
    if (racers[c].rcomp == 0) {
      racers[c].rcomp = 5;
    }
    if (racers[c].rcomp < 20) {
      racers[c].rcomp += 2 * carStats.airs[type];
    }
    airPush.x = -carStats.airc[type] * cosDeg(car[c].xz) * flipSign;
    airPush.z = -carStats.airc[type] * sinDeg(car[c].xz) * flipSign;
  } else {
    if (racers[c].rcomp > 0) {
      racers[c].rcomp -= 2 * carStats.airs[type];
    }
  }
  racers[c].pzy -=
    (racers[c].dcomp - racers[c].ucomp) * cosDeg(racers[c].pxy) * tick.scale;
  if (pitchedOver) {
    car[c].xz -=
      (racers[c].dcomp - racers[c].ucomp) * sinDeg(racers[c].pxy) * tick.scale;
  } else {
    car[c].xz +=
      (racers[c].dcomp - racers[c].ucomp) * sinDeg(racers[c].pxy) * tick.scale;
  }
  racers[c].pxy += (racers[c].rcomp - racers[c].lcomp) * tick.scale;
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
  if (racers[c].loop == -1) {
    rotateAfterStunt(c, type, pitchedOver);
  }
}

function rotateAfterStunt(c, type, pitchedOver) {
  if (car[c].y > 15) {
    if (racers[c].u.left) {
      if (!racers[c].pl) {
        if (racers[c].lcomp == 0) {
          racers[c].lcomp = 5 * carStats.airs[type];
        }
        if (racers[c].lcomp < 20) {
          racers[c].lcomp += 2 * carStats.airs[type];
        }
      }
    } else {
      if (racers[c].lcomp > 0) {
        racers[c].lcomp -= 2 * carStats.airs[type];
      }
      racers[c].pl = false;
    }
    if (racers[c].u.right) {
      if (!racers[c].pr) {
        if (racers[c].rcomp == 0) {
          racers[c].rcomp = 5 * carStats.airs[type];
        }
        if (racers[c].rcomp < 20) {
          racers[c].rcomp += 2 * carStats.airs[type];
        }
      }
    } else {
      if (racers[c].rcomp > 0) {
        racers[c].rcomp -= 2 * carStats.airs[type];
      }
      racers[c].pr = false;
    }
    if (racers[c].u.up) {
      if (!racers[c].pu) {
        if (racers[c].ucomp == 0) {
          racers[c].ucomp = 5 * carStats.airs[type];
        }
        if (racers[c].ucomp < 20) {
          racers[c].ucomp += 2 * carStats.airs[type];
        }
      }
    } else {
      if (racers[c].ucomp > 0) {
        racers[c].ucomp -= 2 * carStats.airs[type];
      }
      racers[c].pu = false;
    }
    if (racers[c].u.down) {
      if (!racers[c].pd) {
        if (racers[c].dcomp == 0) {
          racers[c].dcomp = 5 * carStats.airs[type];
        }
        if (racers[c].dcomp < 20) {
          racers[c].dcomp += 2 * carStats.airs[type];
        }
      }
    } else {
      if (racers[c].dcomp > 0) {
        racers[c].dcomp -= 2 * carStats.airs[type];
      }
      racers[c].pd = false;
    }
    racers[c].pzy -=
      (racers[c].dcomp - racers[c].ucomp) * cosDeg(racers[c].pxy) * tick.scale;
    if (pitchedOver) {
      car[c].xz -=
        (racers[c].dcomp - racers[c].ucomp) *
        sinDeg(racers[c].pxy) *
        tick.scale;
    } else {
      car[c].xz +=
        (racers[c].dcomp - racers[c].ucomp) *
        sinDeg(racers[c].pxy) *
        tick.scale;
    }
    racers[c].pxy += (racers[c].rcomp - racers[c].lcomp) * tick.scale;
  }
}

function colide(c, xc) {
  let pyclos;
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
      if (
        Math.abs(
          racers[c].power * racers[c].speed * carStats.moment[car[c].typ],
        ) !=
        Math.abs(
          racers[xc].power * racers[xc].speed * carStats.moment[car[xc].typ],
        )
      ) {
        if (
          Math.abs(
            racers[c].power * racers[c].speed * carStats.moment[car[c].typ],
          ) >
          Math.abs(
            racers[xc].power * racers[xc].speed * carStats.moment[car[xc].typ],
          )
        ) {
          racers[c].dominate[xc] = true;
        } else {
          racers[c].dominate[xc] = false;
        }
      } else {
        if (carStats.moment[car[c].typ] > carStats.moment[car[xc].typ]) {
          racers[c].dominate[xc] = true;
        } else {
          racers[c].dominate[xc] = false;
        }
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
    // the corners of both cars, only needed when c pushes xc
    let kx = [],
      ky = [],
      kz = [];
    let xkx = [],
      xky = [],
      xkz = [];
    for (let i = 0; i < 4; i++) {
      kx[i] = car[c].x + car[c].keyx[i];
      if (racers[c].capsized) {
        ky[i] = car[c].y + carStats.flipy[car[c].typ] + racers[c].squash;
      } else {
        ky[i] = car[c].y + car[c].grat;
      }
      kz[i] = car[c].z + car[c].keyz[i];
      xkx[i] = car[xc].x + car[xc].keyx[i];
      if (racers[xc].capsized) {
        xky[i] = car[xc].y + carStats.flipy[car[xc].typ] + racers[xc].squash;
      } else {
        xky[i] = car[xc].y + car[xc].grat;
      }
      xkz[i] = car[xc].z + car[xc].keyz[i];
    }
    rotatePoints(kx, ky, car[c].x, car[c].y, car[c].xy, 4);
    rotatePoints(ky, kz, car[c].y, car[c].z, car[c].zy, 4);
    rotatePoints(kx, kz, car[c].x, car[c].z, car[c].xz, 4);
    rotatePoints(xkx, xky, car[xc].x, car[xc].y, car[xc].xy, 4);
    rotatePoints(xky, xkz, car[xc].y, car[xc].z, car[xc].zy, 4);
    rotatePoints(xkx, xkz, car[xc].x, car[xc].z, car[xc].xz, 4);
    let crad =
      ((racers[c].scz[0] -
        racers[xc].scz[0] +
        racers[c].scz[1] -
        racers[xc].scz[1] +
        racers[c].scz[2] -
        racers[xc].scz[2] +
        racers[c].scz[3] -
        racers[xc].scz[3]) *
        (racers[c].scz[0] -
          racers[xc].scz[0] +
          racers[c].scz[1] -
          racers[xc].scz[1] +
          racers[c].scz[2] -
          racers[xc].scz[2] +
          racers[c].scz[3] -
          racers[xc].scz[3]) +
        (racers[c].scx[0] -
          racers[xc].scx[0] +
          racers[c].scx[1] -
          racers[xc].scx[1] +
          racers[c].scx[2] -
          racers[xc].scx[2] +
          racers[c].scx[3] -
          racers[xc].scx[3]) *
          (racers[c].scx[0] -
            racers[xc].scx[0] +
            racers[c].scx[1] -
            racers[xc].scx[1] +
            racers[c].scx[2] -
            racers[xc].scx[2] +
            racers[c].scx[3] -
            racers[xc].scx[3])) /
      16;
    let arad = 70;
    for (let i = 0; i < 4; i++) {
      let gotcol = false;
      for (let j = 0; j < 4; j++) {
        if (
          distanceSquared(kx[i], xkx[j], ky[i], xky[j], kz[i], xkz[j]) <
          (crad + arad) *
            (carStats.comprad[car[xc].typ] + carStats.comprad[car[c].typ])
        ) {
          if (
            Math.abs(racers[c].scx[i] * carStats.moment[car[c].typ]) >
            Math.abs(racers[xc].scx[j] * carStats.moment[car[xc].typ])
          ) {
            let tm = racers[xc].scx[j] * carStats.revpush[car[c].typ];
            if (tm > 30) {
              tm = 30;
            }
            if (tm < -30) {
              tm = -30;
            }
            let vctm = racers[c].scx[i] * carStats.push[car[c].typ];
            if (vctm > 30) {
              vctm = 30;
            }
            if (vctm < -30) {
              vctm = -30;
            }
            racers[xc].scx[j] += vctm;
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(0, j, vctm * carStats.moment[car[c].typ], xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            racers[c].scx[i] -= tm;
            regn(0, i, -tm * carStats.moment[car[c].typ], c);
            racers[c].scy[i] += carStats.revlift[car[c].typ];
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(2, j, carStats.revlift[car[c].typ] * 7, xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            if (random.fx() > random.fx()) {
              sprks(
                car[c].typ,
                (kx[i] + xkx[j]) / 2,
                (ky[i] + xky[j]) / 2,
                (kz[i] + xkz[j]) / 2,
                (racers[xc].scx[j] + racers[c].scx[i]) / 4,
                (racers[xc].scy[j] + racers[c].scy[i]) / 4,
                (racers[xc].scz[j] + racers[c].scz[i]) / 4,
                2,
              );
            }
          }
          if (
            Math.abs(racers[c].scz[i] * carStats.moment[car[c].typ]) >
            Math.abs(racers[xc].scz[j] * carStats.moment[car[xc].typ])
          ) {
            let tm = racers[xc].scz[j] * carStats.revpush[car[c].typ];
            if (tm > 30) {
              tm = 30;
            }
            if (tm < -30) {
              tm = -30;
            }
            let vctm = racers[c].scz[i] * carStats.push[car[c].typ];
            if (vctm > 30) {
              vctm = 30;
            }
            if (vctm < -30) {
              vctm = -30;
            }
            racers[xc].scz[j] += vctm;
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(1, j, vctm * carStats.moment[car[c].typ], xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            racers[c].scz[i] -= tm;
            regn(1, i, -tm * carStats.moment[car[c].typ], c);
            racers[c].scy[i] += carStats.revlift[car[c].typ];
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(2, j, carStats.revlift[car[c].typ] * 7, xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            if (random.fx() > random.fx()) {
              sprks(
                car[c].typ,
                (kx[i] + xkx[j]) / 2,
                (ky[i] + xky[j]) / 2,
                (kz[i] + xkz[j]) / 2,
                (racers[xc].scx[j] + racers[c].scx[i]) / 4,
                (racers[xc].scy[j] + racers[c].scy[i]) / 4,
                (racers[xc].scz[j] + racers[c].scz[i]) / 4,
                2,
              );
            }
          }
          if (c == game.player) {
            racers[xc].lastcolido = 70;
          }
          if (xc == game.player) {
            racers[c].lastcolido = 70;
          }
          racers[xc].scy[j] += carStats.lift[car[c].typ];
          gotcol = true;
        }
      }
      if (!gotcol && racers[c].mtouch && racers[xc].mtouch) {
        let intrsct = false;
        let aro = Math.abs(
          (xkx[1] - xkx[0]) * (xkz[2] - xkz[0]) -
            (xkx[2] - xkx[0]) * (xkz[1] - xkz[0]),
        );
        let ar1 = Math.abs(
          (xkx[0] - kx[i]) * (xkz[1] - kz[i]) -
            (xkx[1] - kx[i]) * (xkz[0] - kz[i]),
        );
        let ar2 = Math.abs(
          (xkx[1] - kx[i]) * (xkz[2] - kz[i]) -
            (xkx[2] - kx[i]) * (xkz[1] - kz[i]),
        );
        let ar3 = Math.abs(
          (xkx[2] - kx[i]) * (xkz[0] - kz[i]) -
            (xkx[0] - kx[i]) * (xkz[2] - kz[i]),
        );
        if (ar1 + ar2 + ar3 < aro + 10) {
          intrsct = true;
        }
        if (!intrsct) {
          aro = Math.abs(
            (xkx[1] - xkx[3]) * (xkz[2] - xkz[3]) -
              (xkx[2] - xkx[3]) * (xkz[1] - xkz[3]),
          );
          ar1 = Math.abs(
            (xkx[3] - kx[i]) * (xkz[1] - kz[i]) -
              (xkx[1] - kx[i]) * (xkz[3] - kz[i]),
          );
          ar2 = Math.abs(
            (xkx[1] - kx[i]) * (xkz[2] - kz[i]) -
              (xkx[2] - kx[i]) * (xkz[1] - kz[i]),
          );
          ar3 = Math.abs(
            (xkx[2] - kx[i]) * (xkz[3] - kz[i]) -
              (xkx[3] - kx[i]) * (xkz[2] - kz[i]),
          );
          if (ar1 + ar2 + ar3 < aro + 10) {
            intrsct = true;
          }
        }
        if (intrsct) {
          let j = 0;
          let closj = distanceSquared(
            kx[i],
            xkx[0],
            ky[i],
            xky[0],
            kz[i],
            xkz[0],
          );
          for (let k = 1; k < 4; k++) {
            pyclos = distanceSquared(
              kx[i],
              xkx[k],
              ky[i],
              xky[k],
              kz[i],
              xkz[k],
            );
            if (pyclos < closj) {
              closj = pyclos;
              j = k;
            }
          }
          if (
            Math.abs(racers[c].scx[i] * carStats.moment[car[c].typ]) >
            Math.abs(racers[xc].scx[j] * carStats.moment[car[xc].typ])
          ) {
            let tm = racers[xc].scx[j] * carStats.revpush[car[c].typ];
            if (tm > 30) {
              tm = 30;
            }
            if (tm < -30) {
              tm = -30;
            }
            let vctm = racers[c].scx[i] * carStats.push[car[c].typ];
            if (vctm > 30) {
              vctm = 30;
            }
            if (vctm < -30) {
              vctm = -30;
            }
            racers[xc].scx[j] += vctm;
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(0, j, vctm * carStats.moment[car[c].typ], xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            racers[c].scx[i] -= tm;
            regn(0, i, -tm * carStats.moment[car[c].typ], c);
            racers[c].scy[i] += carStats.revlift[car[c].typ];
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(2, j, carStats.revlift[car[c].typ] * 7, xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            if (random.fx() > random.fx()) {
              sprks(
                car[c].typ,
                (kx[i] + xkx[j]) / 2,
                (ky[i] + xky[j]) / 2,
                (kz[i] + xkz[j]) / 2,
                (racers[xc].scx[j] + racers[c].scx[i]) / 4,
                (racers[xc].scy[j] + racers[c].scy[i]) / 4,
                (racers[xc].scz[j] + racers[c].scz[i]) / 4,
                2,
              );
            }
          }
          if (
            Math.abs(racers[c].scz[i] * carStats.moment[car[c].typ]) >
            Math.abs(racers[xc].scz[j] * carStats.moment[car[xc].typ])
          ) {
            let tm = racers[xc].scz[j] * carStats.revpush[car[c].typ];
            if (tm > 30) {
              tm = 30;
            }
            if (tm < -30) {
              tm = -30;
            }
            let vctm = racers[c].scz[i] * carStats.push[car[c].typ];
            if (vctm > 30) {
              vctm = 30;
            }
            if (vctm < -30) {
              vctm = -30;
            }
            racers[xc].scz[j] += vctm;
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(1, j, vctm * carStats.moment[car[c].typ], xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            racers[c].scz[i] -= tm;
            regn(1, i, -tm * carStats.moment[car[c].typ], c);
            racers[c].scy[i] += carStats.revlift[car[c].typ];
            if (c == game.player) {
              racers[xc].colidim = true;
            }
            regn(2, j, carStats.revlift[car[c].typ] * 7, xc);
            if (racers[xc].colidim) {
              racers[xc].colidim = false;
            }
            if (random.fx() > random.fx()) {
              sprks(
                car[c].typ,
                (kx[i] + xkx[j]) / 2,
                (ky[i] + xky[j]) / 2,
                (kz[i] + xkz[j]) / 2,
                (racers[xc].scx[j] + racers[c].scx[i]) / 4,
                (racers[xc].scy[j] + racers[c].scy[i]) / 4,
                (racers[xc].scz[j] + racers[c].scz[i]) / 4,
                2,
              );
            }
          }
          if (c == game.player) {
            racers[xc].lastcolido = 70;
          }
          if (xc == game.player) {
            racers[c].lastcolido = 70;
          }
          racers[xc].scy[j] += carStats.lift[car[c].typ];
        }
      }
    }
  }
}
// Dents regn made, waiting to be scratched into their car's texture. In a pile-up that
// takes millions of steps in one tick, and it is only seen, so the drawing scratches as
// many as fit into a frame (see paintDents).
const dents = [];
let nextDent = 0;

// Scratches a dent into the damage texture: strokes walk from the dented spot (pxc, pyc),
// greying, darkening and breaking windows on their way; a broken window (modpix 3) ends
// the glass breaking for the following strokes. Returns the steps it took.
function scratchDent({ pixels, c, pxc, pyc, cmag, modpix }) {
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
    let dent = dents[nextDent++];
    if (dent.pixels == dent.model.damagePixels) {
      steps += scratchDent(dent);
      dent.model.damagedPixels = true;
    }
  }
  // a pile-up queues tens of thousands of dents; shifting each one off would copy them all
  if (nextDent == dents.length) {
    dents.length = 0;
    nextDent = 0;
  }
  return steps;
}
export function regn(nr, k, mag, c) {
  if (game.phase == PHASE.race) {
    mag *= carStats.dammult[car[c].typ];
  }
  if (Math.abs(mag) > 10) {
    if (game.phase == PHASE.race) {
      recording.tape.cars[c].hitAt[recording.tape.cars[c].hitCount] = 430;
      recording.tape.cars[c].hitSide[recording.tape.cars[c].hitCount] = nr;
      recording.tape.cars[c].hitPoint[recording.tape.cars[c].hitCount] = k;
      recording.tape.cars[c].hitMag[recording.tape.cars[c].hitCount] = mag;
      recording.tape.cars[c].hitMtouch[recording.tape.cars[c].hitCount] =
        racers[c].mtouch;
      recording.tape.cars[c].hitCount++;
    }
    if (mag > 10) {
      mag -= 10;
    }
    if (mag < -10) {
      mag += 10;
    }
    let zsing = 0,
      xsing = 0;
    let nr2stop = false;
    if (nr == 2) {
      nr2stop = true;
      let rzy = car[c].zy,
        rxy = car[c].xy;
      while (rzy < 360) {
        rzy += 360;
      }
      while (rzy > 360) {
        rzy -= 360;
      }
      if (rzy < 210 && rzy > 150) {
        zsing = -1;
      }
      if (rzy > 330 || rzy < 30) {
        zsing = 1;
      }
      while (rxy < 360) {
        rxy += 360;
      }
      while (rxy > 360) {
        rxy -= 360;
      }
      if (rxy < 210 && rxy > 150) {
        xsing = -1;
      }
      if (rxy > 330 || rxy < 30) {
        xsing = 1;
      }
      if (xsing * zsing == 0 || racers[c].mtouch) {
        nr2stop = false;
      }
      if (xsing * zsing == -1) {
        if (racers[c].nbsq > 0) {
          nr2stop = false;
          nr = 3;
          racers[c].nbsq = 0;
        } else {
          racers[c].nbsq++;
        }
      }
      if (game.phase == PHASE.race && (c == game.player || racers[c].colidim)) {
        crashSound(mag, xsing * zsing);
      }
    } else {
      if (game.phase == PHASE.race && (c == game.player || racers[c].colidim)) {
        crashSound(mag, 0);
      }
    }
    let rad = racers[c].body;
    if (!nr2stop) {
      if (rad.iscar == 1) {
        rad.dvert = [];
        for (let i = 0; i < rad.ni; i++) {
          rad.dvert[i * 3] = -rad.vrt[rad.tri[i * 3] * 3];
          rad.dvert[i * 3 + 1] = rad.vrt[rad.tri[i * 3] * 3 + 1];
          rad.dvert[i * 3 + 2] = rad.vrt[rad.tri[i * 3] * 3 + 2];
        }
        rad.iscar = 2;
      }
      let pixels = rad.damagePixels;
      let pixelread = pixels != null;
      let tsq = 0,
        nsq = 0;
      for (let i = 0; i < rad.ni; i++) {
        let tmag = 0;
        let modpix = 0;
        if (
          nr < 3 &&
          distanceSquaredXZ(
            car[c].keyx[k],
            rad.dvert[i * 3],
            car[c].keyz[k],
            rad.dvert[i * 3 + 2],
          ) < carStats.clrad[car[c].typ]
        ) {
          tmag = (mag / 30) * random.sim();
          if (nr == 0) {
            rad.dvert[i * 3 + 2] -=
              tmag * sinDeg(car[c].xz) * cosDeg(car[c].zy);
            rad.dvert[i * 3] += tmag * cosDeg(car[c].xz) * cosDeg(car[c].xy);
          }
          if (nr == 1) {
            rad.dvert[i * 3 + 2] +=
              tmag * cosDeg(car[c].xz) * cosDeg(car[c].zy);
            rad.dvert[i * 3] += tmag * sinDeg(car[c].xz) * cosDeg(car[c].xy);
          }
          if (nr == 2) {
            rad.dvert[i * 3 + 2] -= tmag * sinDeg(car[c].zy);
            rad.dvert[i * 3] += tmag * sinDeg(car[c].xy);
          }
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
            racers[c].hitmag += Math.abs(tmag) * 0.667;
          }
          modpix = 1;
        }
        // The original also let vertices near the roof's height count, but it looked up
        // msquash by car index and type (msquash[c][typ]), which is never a number, so
        // only vertices above it ever do. With 20 cars that lookup crashed for car 19.
        if (
          nr == 3 &&
          rad.dvert[i * 3 + 1] >
            carStats.flipy[car[c].typ] + racers[c].squash &&
          Math.abs(racers[c].squash) < carStats.msquash[car[c].typ]
        ) {
          tmag = (mag / 15) * random.sim();
          rad.dvert[i * 3 + 1] -= tmag;
          tsq -= tmag;
          nsq++;
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
            racers[c].hitmag += Math.abs(tmag) * 0.667;
          }
          modpix = 2;
        }
        if (pixelread && modpix) {
          let pxc = Math.round(rad.tex[rad.tri[i * 3 + 2] * 2] * 256);
          let pyc = Math.round((1 - rad.tex[rad.tri[i * 3 + 2] * 2 + 1]) * 256);
          let cmag =
            Math.abs(tmag) *
            11 *
            carStats.dammult[car[c].typ] *
            carStats.colrdammult[car[c].typ];
          dents.push({ model: rad, pixels, c, pxc, pyc, cmag, modpix });
        }
      }
      if (nr == 3 && nsq > 0) {
        racers[c].squash += tsq / nsq;
      }
      rad.damagedVertices = true;
      rad.loaded = 2;
    }
  }
}
export function fixcar(c) {
  let rad = racers[c].body;
  rad.alpha = 1;
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
