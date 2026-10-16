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
import { MAX_CARS, PHASE, game } from "../core/state.js";
import { tick } from "../core/tick.js";
import { carStats } from "../data/carStats.js";
import { gl } from "../render/renderer.js";
import { carModels, carTextures, scene } from "../render/scene.js";
import { burn, chipaway, chipburn, dustup, firexp, sprks } from "./effects.js";
import { raceEvents } from "./events.js";
import { car, racers } from "./racers.js";
import { catchnow, recording } from "./recording.js";
import { pieceModels, pieces, track } from "./track.js";

const drag = 0.05;
const lonorm = [];
export function inishmad() {
  for (var c = 0; c < MAX_CARS; c++) {
    racers[c].mxz = 0;
    racers[c].cxz = 0;
    racers[c].dominate = [];
    racers[c].caught = [];
    for (var i = 0; i < MAX_CARS; i++) {
      racers[c].dominate[i] = false;
      racers[c].caught[i] = false;
    }
    racers[c].pzy = 0;
    racers[c].pxy = 0;
    racers[c].speed = 0;
    racers[c].scy = [];
    racers[c].scx = [];
    racers[c].scz = [];
    for (var i = 0; i < 4; i++) {
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
    racers[c].skid = 0;
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
    for (var i = 0; i < 4; i++) {
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
  for (var i = 0; i < 2; i++) {
    lonorm[i] = 0;
  }
}
let flipont = false;
export function drive() {
  if (game.carCount != 1) {
    for (var c = 0; c < game.carCount; c++) {
      for (var xc = 0; xc < game.carCount; xc++) {
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
  for (var c = 0; c < game.carCount; c++) {
    var cn = car[c].typ;
    var mlt = 1;
    var cov = 1;
    var zyinv = false,
      doublinv = false,
      spinlocate = false;
    racers[c].capsized = false;
    var izy = Math.abs(racers[c].pzy);
    while (izy > 270) {
      izy -= 360;
    }
    izy = Math.abs(izy);
    if (izy > 90) {
      zyinv = true;
    }
    var xyinv = false;
    var ixy = Math.abs(racers[c].pxy);
    while (ixy > 270) {
      ixy -= 360;
    }
    ixy = Math.abs(ixy);
    if (ixy > 90) {
      xyinv = true;
      cov = -1;
    }
    var keyy = -car[c].grat;
    if (zyinv) {
      if (xyinv) {
        xyinv = false;
        doublinv = true;
      } else {
        xyinv = true;
        racers[c].capsized = true;
      }
      mlt = -1;
    } else {
      if (xyinv) {
        racers[c].capsized = true;
      }
    }
    if (racers[c].capsized) {
      keyy = carStats.flipy[cn] + racers[c].squash;
    }
    racers[c].u.zyinv = zyinv;
    var xtrim = 0,
      ztrim = 0,
      ytrim = 0;
    if (racers[c].mtouch) {
      racers[c].loop = 0;
    }
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
    if (racers[c].loop == 1) {
      var avay =
        (racers[c].scy[0] +
          racers[c].scy[1] +
          racers[c].scy[2] +
          racers[c].scy[3]) /
        4;
      for (var i = 0; i < 4; i++) {
        racers[c].scy[i] = avay;
      }
      racers[c].loop = 2;
    }
    if (!racers[c].dest) {
      if (racers[c].loop == 2) {
        if (racers[c].u.up && !racers[c].actu) {
          if (racers[c].ucomp == 0) {
            racers[c].ucomp = 10 + (-racers[c].scy[0] * 10 + 50) / 20;
            if (racers[c].ucomp < 5) {
              racers[c].ucomp = 5;
            }
            if (racers[c].ucomp > 10) {
              racers[c].ucomp = 10;
            }
            racers[c].ucomp *= carStats.airs[cn];
          }
          if (racers[c].ucomp < 20) {
            racers[c].ucomp += 0.5 * carStats.airs[cn];
          }
          xtrim = -carStats.airc[cn] * sinDeg(car[c].xz) * cov;
          ztrim = carStats.airc[cn] * cosDeg(car[c].xz) * cov;
        } else {
          if (racers[c].ucomp != 0) {
            if (racers[c].ucomp > -2) {
              racers[c].ucomp -= 0.5 * carStats.airs[cn];
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
            racers[c].dcomp *= carStats.airs[cn];
          }
          if (racers[c].dcomp < 20) {
            racers[c].dcomp += 0.5 * carStats.airs[cn];
          }
          ytrim = carStats.airc[cn];
        } else {
          if (racers[c].dcomp != 0) {
            if (racers[c].ucomp > -2) {
              racers[c].dcomp -= 0.5 * carStats.airs[cn];
            }
          }
        }
        if (racers[c].u.left && !racers[c].actl) {
          if (racers[c].lcomp == 0) {
            racers[c].lcomp = 5;
          }
          if (racers[c].lcomp < 20) {
            racers[c].lcomp += 2 * carStats.airs[cn];
          }
          xtrim = carStats.airc[cn] * cosDeg(car[c].xz) * mlt;
          ztrim = carStats.airc[cn] * sinDeg(car[c].xz) * mlt;
        } else {
          if (racers[c].lcomp > 0) {
            racers[c].lcomp -= 2 * carStats.airs[cn];
          }
        }
        if (racers[c].u.right && !racers[c].actr) {
          if (racers[c].rcomp == 0) {
            racers[c].rcomp = 5;
          }
          if (racers[c].rcomp < 20) {
            racers[c].rcomp += 2 * carStats.airs[cn];
          }
          xtrim = -carStats.airc[cn] * cosDeg(car[c].xz) * mlt;
          ztrim = -carStats.airc[cn] * sinDeg(car[c].xz) * mlt;
        } else {
          if (racers[c].rcomp > 0) {
            racers[c].rcomp -= 2 * carStats.airs[cn];
          }
        }
        racers[c].pzy -=
          (racers[c].dcomp - racers[c].ucomp) *
          cosDeg(racers[c].pxy) *
          tick.scale;
        if (zyinv) {
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
      } else {
        var upower = racers[c].power;
        if (upower < 40) {
          upower = 40;
        }
        if (racers[c].u.down) {
          if (racers[c].speed > 0) {
            racers[c].speed -= (carStats.handb[cn] / 2) * tick.scale;
          } else {
            var sw = 0;
            for (var i = 0; i < 2; i++) {
              if (
                racers[c].speed <=
                -(
                  carStats.swits[cn][i] / 2 +
                  (upower * carStats.swits[cn][i]) / 196
                )
              ) {
                sw++;
              }
            }
            if (sw != 2) {
              racers[c].speed -=
                (carStats.acelf[cn][sw] / 2 +
                  (upower * carStats.acelf[cn][sw]) / 196) *
                tick.scale;
            } else {
              racers[c].speed = -(
                (carStats.swits[cn][1] / 2 +
                  (upower * carStats.swits[cn][1]) / 196) *
                tick.scale
              );
            }
          }
        }
        if (racers[c].u.up) {
          if (racers[c].speed < 0) {
            racers[c].speed += carStats.handb[cn] * tick.scale;
          } else {
            var sw = 0;
            for (var i = 0; i < 3; i++) {
              if (
                racers[c].speed >=
                carStats.swits[cn][i] / 2 +
                  (upower * carStats.swits[cn][i]) / 196
              ) {
                sw++;
              }
            }
            if (sw != 3) {
              racers[c].speed +=
                (carStats.acelf[cn][sw] / 2 +
                  (upower * carStats.acelf[cn][sw]) / 196) *
                tick.scale;
            } else {
              racers[c].speed =
                carStats.swits[cn][2] / 2 +
                (upower * carStats.swits[cn][2]) / 196;
            }
          }
        }
        if (racers[c].u.handb) {
          if (Math.abs(racers[c].speed) > carStats.handb[cn]) {
            if (racers[c].speed < 0) {
              racers[c].speed += carStats.handb[cn] * tick.scale;
            } else {
              racers[c].speed -= carStats.handb[cn] * tick.scale;
            }
          }
        }
        if (racers[c].loop == -1) {
          if (car[c].y > 15) {
            if (racers[c].u.left) {
              if (!racers[c].pl) {
                if (racers[c].lcomp == 0) {
                  racers[c].lcomp = 5 * carStats.airs[cn];
                }
                if (racers[c].lcomp < 20) {
                  racers[c].lcomp += 2 * carStats.airs[cn];
                }
              }
            } else {
              if (racers[c].lcomp > 0) {
                racers[c].lcomp -= 2 * carStats.airs[cn];
              }
              racers[c].pl = false;
            }
            if (racers[c].u.right) {
              if (!racers[c].pr) {
                if (racers[c].rcomp == 0) {
                  racers[c].rcomp = 5 * carStats.airs[cn];
                }
                if (racers[c].rcomp < 20) {
                  racers[c].rcomp += 2 * carStats.airs[cn];
                }
              }
            } else {
              if (racers[c].rcomp > 0) {
                racers[c].rcomp -= 2 * carStats.airs[cn];
              }
              racers[c].pr = false;
            }
            if (racers[c].u.up) {
              if (!racers[c].pu) {
                if (racers[c].ucomp == 0) {
                  racers[c].ucomp = 5 * carStats.airs[cn];
                }
                if (racers[c].ucomp < 20) {
                  racers[c].ucomp += 2 * carStats.airs[cn];
                }
              }
            } else {
              if (racers[c].ucomp > 0) {
                racers[c].ucomp -= 2 * carStats.airs[cn];
              }
              racers[c].pu = false;
            }
            if (racers[c].u.down) {
              if (!racers[c].pd) {
                if (racers[c].dcomp == 0) {
                  racers[c].dcomp = 5 * carStats.airs[cn];
                }
                if (racers[c].dcomp < 20) {
                  racers[c].dcomp += 2 * carStats.airs[cn];
                }
              }
            } else {
              if (racers[c].dcomp > 0) {
                racers[c].dcomp -= 2 * carStats.airs[cn];
              }
              racers[c].pd = false;
            }
            racers[c].pzy -=
              (racers[c].dcomp - racers[c].ucomp) *
              cosDeg(racers[c].pxy) *
              tick.scale;
            if (zyinv) {
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
      }
    }
    var wrots = (200 * racers[c].speed) / (154 * carStats.simag[cn]);
    car[c].wzy -= wrots * tick.scale;
    if (car[c].wzy < -360) {
      car[c].wzy += 360;
    }
    if (car[c].wzy > 360) {
      car[c].wzy -= 360;
    }
    if (racers[c].u.left) {
      car[c].wxz -= carStats.turn[cn] * tick.scale;
      if (car[c].wxz < -36) {
        car[c].wxz = -36;
      }
    }
    if (racers[c].u.right) {
      car[c].wxz += carStats.turn[cn] * tick.scale;
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
        if (Math.abs(car[c].wxz) < carStats.turn[cn] * 2 * tick.scale) {
          car[c].wxz = 0;
        }
        if (car[c].wxz > 0) {
          car[c].wxz -= carStats.turn[cn] * 2 * tick.scale;
        }
        if (car[c].wxz < 0) {
          car[c].wxz += carStats.turn[cn] * 2 * tick.scale;
        }
      }
    }
    var divt = 36 / (racers[c].speed * racers[c].speed);
    if (divt < 5) {
      divt = 5;
    }
    if (racers[c].speed < 0) {
      divt = -divt;
    }
    if (racers[c].wtouch) {
      if (!racers[c].capsized) {
        if (!racers[c].u.handb) {
          racers[c].fxz = (car[c].wxz / (divt * 3)) * tick.scale;
        } else {
          racers[c].fxz = (car[c].wxz / divt) * tick.scale;
        }
        car[c].xz += (car[c].wxz / divt) * tick.scale;
      }
      racers[c].wtouch = false;
      racers[c].gtouch = false;
    } else {
      car[c].xz += racers[c].fxz;
    }
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
    var kx = [];
    var kz = [];
    var ky = [];
    for (var i = 0; i < 4; i++) {
      kx[i] = car[c].keyx[i] + car[c].x;
      ky[i] = keyy + car[c].y;
      kz[i] = car[c].z + car[c].keyz[i];
      racers[c].scy[i] -= 0.7 * tick.scale;
    }
    rotatePoints(kx, ky, car[c].x, car[c].y, racers[c].pxy, 4);
    rotatePoints(ky, kz, car[c].y, car[c].z, racers[c].pzy, 4);
    rotatePoints(kx, kz, car[c].x, car[c].z, car[c].xz, 4);
    var wastouch = false;
    var arch = 0;
    var avnx =
      (racers[c].scx[0] +
        racers[c].scx[1] +
        racers[c].scx[2] +
        racers[c].scx[3]) /
      4;
    var avnz =
      (racers[c].scz[0] +
        racers[c].scz[1] +
        racers[c].scz[2] +
        racers[c].scz[3]) /
      4;
    for (var i = 0; i < 4; i++) {
      if (racers[c].scx[i] - avnx > 20) {
        racers[c].scx[i] = 20 + avnx;
      }
      if (racers[c].scx[i] - avnx < -20) {
        racers[c].scx[i] = avnx - 20;
      }
      if (racers[c].scz[i] - avnz > 20) {
        racers[c].scz[i] = 20 + avnz;
      }
      if (racers[c].scz[i] - avnz < -20) {
        racers[c].scz[i] = avnz - 20;
      }
    }
    for (var i = 0; i < 4; i++) {
      ky[i] += racers[c].scy[i] * tick.scale;
      kx[i] +=
        ((racers[c].scx[0] +
          racers[c].scx[1] +
          racers[c].scx[2] +
          racers[c].scx[3]) /
          4) *
        tick.scale;
      kz[i] +=
        ((racers[c].scz[0] +
          racers[c].scz[1] +
          racers[c].scz[2] +
          racers[c].scz[3]) /
          4) *
        tick.scale;
    }
    var tskd = 1;
    var ontsprk = false;
    for (var o = 0; o < pieces.count; o++) {
      if (pieceModels[pieces.list[o].typ].skid != -1) {
        var bx =
          pieces.list[o].x +
          pieceModels[pieces.list[o].typ].bx * pieces.list[o].mat[0] +
          pieceModels[pieces.list[o].typ].bz * pieces.list[o].mat[8];
        var sx =
          pieces.list[o].x +
          pieceModels[pieces.list[o].typ].sx * pieces.list[o].mat[0] +
          pieceModels[pieces.list[o].typ].sz * pieces.list[o].mat[8];
        var bz =
          pieces.list[o].z +
          pieceModels[pieces.list[o].typ].bz * pieces.list[o].mat[10] +
          pieceModels[pieces.list[o].typ].bx * pieces.list[o].mat[2];
        var sz =
          pieces.list[o].z +
          pieceModels[pieces.list[o].typ].sz * pieces.list[o].mat[10] +
          pieceModels[pieces.list[o].typ].sx * pieces.list[o].mat[2];
        var intr = 0;
        if (bx > sx) {
          if (car[c].x > sx && car[c].x < bx) {
            intr++;
          }
        } else {
          if (car[c].x > bx && car[c].x < sx) {
            intr++;
          }
        }
        if (bz > sz) {
          if (car[c].z > sz && car[c].z < bz) {
            intr++;
          }
        } else {
          if (car[c].z > bz && car[c].z < sz) {
            intr++;
          }
        }
        if (intr == 2) {
          tskd = pieceModels[pieces.list[o].typ].skid;
          ontsprk = true;
        }
      }
    }
    if (racers[c].mtouch) {
      var ugrip = carStats.grip[cn];
      ugrip -= (Math.abs(racers[c].txz - car[c].xz) * racers[c].speed) / 250;
      if (racers[c].u.handb) {
        ugrip -= Math.abs(racers[c].txz - car[c].xz) * 4;
      }
      if (ugrip < carStats.grip[cn]) {
        if (racers[c].skid != 2) {
          racers[c].skid = 1;
        }
        racers[c].speed -= (racers[c].speed / 100) * tick.scale;
      } else {
        if (racers[c].skid == 1) {
          racers[c].skid = 2;
        }
      }
      if (tskd == 1) {
        ugrip *= 0.75;
      }
      if (tskd == 2) {
        ugrip *= 0.55;
      }
      var motorx = -(
        racers[c].speed *
        sinDeg(car[c].xz) *
        cosDeg(racers[c].pzy)
      );
      var motorz = racers[c].speed * cosDeg(car[c].xz) * cosDeg(racers[c].pzy);
      var motory = -(racers[c].speed * sinDeg(racers[c].pzy));
      if (racers[c].capsized || racers[c].dest || track.haltall) {
        motorx = 0;
        motorz = 0;
        motory = 0;
        ugrip = carStats.grip[cn] / 5;
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
      if (cn == 10) {
        if (ugrip < 0.5) {
          ugrip = 0.5;
        }
      }
      if (ugrip < 0.1) {
        ugrip = 0.1;
      }
      var avcx = 0,
        avcz = 0;
      for (var i = 0; i < 4; i++) {
        if (Math.abs(racers[c].scx[i] - motorx) > ugrip * tick.scale) {
          if (racers[c].scx[i] < motorx) {
            racers[c].scx[i] += ugrip * tick.scale;
          } else {
            racers[c].scx[i] -= ugrip * tick.scale;
          }
        } else {
          racers[c].scx[i] = motorx;
        }
        if (Math.abs(racers[c].scz[i] - motorz) > ugrip * tick.scale) {
          if (racers[c].scz[i] < motorz) {
            racers[c].scz[i] += ugrip * tick.scale;
          } else {
            racers[c].scz[i] -= ugrip * tick.scale;
          }
        } else {
          racers[c].scz[i] = motorz;
        }
        if (Math.abs(racers[c].scy[i] - motory) > ugrip * tick.scale) {
          if (racers[c].scy[i] < motory) {
            racers[c].scy[i] += ugrip * tick.scale;
          } else {
            racers[c].scy[i] -= ugrip * tick.scale;
          }
        } else {
          racers[c].scy[i] = motory;
        }
        if (tick.fraction >= tick.scale) {
          if (ugrip < carStats.grip[cn]) {
            if (racers[c].txz != car[c].xz) {
              racers[c].dcnt++;
            } else {
              if (racers[c].dcnt != 0) {
                racers[c].dcnt = 0;
              }
            }
            if (
              racers[c].dcnt > (40 * ugrip) / carStats.grip[cn] ||
              racers[c].capsized
            ) {
              var mag = 1;
              if (tskd != 0) {
                mag = 1.2;
              }
              if (random.fx() > 0.65) {
                dustup(
                  tskd,
                  c,
                  i,
                  kx[i],
                  ky[i],
                  kz[i],
                  racers[c].scx[i],
                  racers[c].scz[i],
                  mag * carStats.simag[cn],
                  racers[c].tilt,
                  racers[c].capsized && racers[c].mtouch,
                );
                if (c == game.player && !racers[c].capsized) {
                  skidSound(
                    tskd,
                    ontsprk,
                    Math.sqrt(
                      racers[c].scx[i] * racers[c].scx[i] +
                        racers[c].scz[i] * racers[c].scz[i],
                    ),
                  );
                }
              }
            } else {
              if (tskd == 1) {
                if (random.fx() > 0.8) {
                  dustup(
                    tskd,
                    c,
                    i,
                    kx[i],
                    ky[i],
                    kz[i],
                    racers[c].scx[i],
                    racers[c].scz[i],
                    1.1 * carStats.simag[cn],
                    racers[c].tilt,
                    racers[c].capsized && racers[c].mtouch,
                  );
                }
              }
              if (tskd == 2) {
                if (random.fx() > 0.6) {
                  dustup(
                    tskd,
                    c,
                    i,
                    kx[i],
                    ky[i],
                    kz[i],
                    racers[c].scx[i],
                    racers[c].scz[i],
                    1.15 * carStats.simag[cn],
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
        avcx += racers[c].scx[i];
        avcz += racers[c].scz[i];
      }
      racers[c].txz = car[c].xz;
      if (avcx > 0) {
        mlt = -1;
      } else {
        mlt = 1;
      }
      if (avcx != 0 || avcz != 0) {
        arch = avcz / Math.sqrt(avcx * avcx + avcz * avcz);
      } else {
        arch = 0;
      }
      racers[c].mxz = (Math.acos(arch) / 0.017453292519943295) * mlt;
      if (racers[c].skid == 2) {
        if (!racers[c].capsized) {
          avcx = avcx / 4;
          avcz = avcz / 4;
          if (doublinv) {
            racers[c].speed = -(
              Math.sqrt(avcx * avcx + avcz * avcz) *
              cosDeg(racers[c].mxz - car[c].xz)
            );
          } else {
            racers[c].speed =
              Math.sqrt(avcx * avcx + avcz * avcz) *
              cosDeg(racers[c].mxz - car[c].xz);
          }
        }
        racers[c].skid = 0;
      }
      if (racers[c].capsized && avcx == 0 && avcz == 0) {
        tskd = 0;
      }
      racers[c].mtouch = false;
      wastouch = true;
    } else {
      if (racers[c].skid != 2) {
        racers[c].skid = 2;
      }
    }
    var ntr = 0;
    var sprkon = [];
    var onorm = [0, 0];
    for (var i = 0; i < 4; i++) {
      sprkon[i] = 0;
      if (ky[i] < -0.05) {
        ntr++;
        racers[c].wtouch = true;
        racers[c].gtouch = true;
        if (!wastouch) {
          if (racers[c].scy[i] != -0.7) {
            var mag = racers[c].scy[i] / 33.33;
            if (mag > 0.3) {
              mag = 0.3;
            }
            if (tskd == 0) {
              mag += 1.1;
            } else {
              mag += 1.2;
            }
            dustup(
              tskd,
              c,
              i,
              kx[i],
              ky[i],
              kz[i],
              racers[c].scx[i],
              racers[c].scz[i],
              mag * carStats.simag[cn],
              0,
              racers[c].capsized && racers[c].mtouch,
            );
          }
        }
        ky[i] = 0;
        var bmac =
          Math.abs(sinDeg(racers[c].pxy)) + Math.abs(sinDeg(racers[c].pzy));
        bmac = bmac / 3;
        if (bmac > 0.4) {
          bmac = 0.4;
        }
        bmac += carStats.bounce[cn];
        if (bmac < 1.1) {
          bmac = 1.1;
        }
        regn(2, i, Math.abs(racers[c].scy[i] * bmac), c);
        if (racers[c].scy[i] < 0) {
          racers[c].scy[i] += Math.abs(racers[c].scy[i] * bmac);
        }
        if (racers[c].capsized) {
          if (ontsprk && (tskd == 0 || tskd == 1)) {
            sprkon[i] = 1;
          } else {
            sprkon[i] = 2;
          }
        }
        onorm[Math.floor(i * 0.5)] = 1;
      }
    }
    var zboundr =
      Math.abs(carStats.boundr[cn] * car[c].mat[10]) +
      Math.abs(2 * car[c].mat[8]);
    var xboundr =
      Math.abs(carStats.boundr[cn] * car[c].mat[8]) +
      Math.abs(2 * car[c].mat[10]);
    var ntron = 0;
    for (var o = 0; o < pieces.count; o++) {
      var ntroff = 0;
      var ntrt = 0;
      if (
        pieceModels[pieces.list[o].typ].intershad ||
        pieceModels[pieces.list[o].typ].interact
      ) {
        if (
          Math.abs(car[c].x - pieces.list[o].x) <
            pieceModels[pieces.list[o].typ].colrad + carModels[cn].colrad &&
          Math.abs(car[c].y - pieces.list[o].y) <
            pieceModels[pieces.list[o].typ].colrad + carModels[cn].colrad &&
          Math.abs(car[c].z - pieces.list[o].z) <
            pieceModels[pieces.list[o].typ].colrad + carModels[cn].colrad
        ) {
          pieceModels[pieces.list[o].typ].x = pieces.list[o].x;
          pieceModels[pieces.list[o].typ].y = pieces.list[o].y;
          pieceModels[pieces.list[o].typ].z = pieces.list[o].z;
          pieceModels[pieces.list[o].typ].mat = pieces.list[o].mat;
          var rad = pieceModels[pieces.list[o].typ];
          var cancelbnd = false;
          if (pieces.list[o].typ == 33 || pieces.list[o].typ == 34) {
            cancelbnd = true;
          }
          if (
            (pieces.list[o].typ == 46 || pieces.list[o].typ == 47) &&
            car[c].y > 70
          ) {
            cancelbnd = true;
          }
          if (
            (pieces.list[o].typ == 50 || pieces.list[o].typ == 48) &&
            car[c].y > 140
          ) {
            cancelbnd = true;
          }
          if (pieces.list[o].typ == 49 && car[c].y > 280) {
            cancelbnd = true;
          }
          if (pieces.list[o].typ == 51 && car[c].y > 310) {
            cancelbnd = true;
          }
          if (pieces.list[o].typ == 40 && car[c].y > 100) {
            cancelbnd = true;
          }
          var cancelpln = false;
          if (pieces.list[o].typ == 1) {
            cancelpln = true;
          }
          for (var k = 0; k < 4; k++) {
            if (
              Math.abs(kx[k] - pieces.list[o].x) < pieces.list[o].bx &&
              Math.abs(kz[k] - pieces.list[o].z) < pieces.list[o].bz &&
              Math.abs(ky[k] - pieces.list[o].y) < pieces.list[o].by
            ) {
              var normx = 0,
                normy = 0,
                normz = 0;
              for (var i = 0; i < rad.ni / 3; i++) {
                var vertx = [];
                var verty = [];
                var vertz = [];
                for (var v = 0; v < 3; v++) {
                  var vp = rad.tri[i * 9 + v * 3];
                  vertx[v] =
                    -(rad.vrt[vp * 3] * rad.mat[0]) +
                    rad.vrt[vp * 3 + 2] * rad.mat[8];
                  verty[v] = rad.vrt[vp * 3 + 1];
                  vertz[v] =
                    rad.vrt[vp * 3 + 2] * rad.mat[10] -
                    rad.vrt[vp * 3] * rad.mat[2];
                }
                var vp = rad.tri[i * 9 + 1];
                normx =
                  -(rad.nrm[vp * 3] * rad.mat[0]) +
                  rad.nrm[vp * 3 + 2] * rad.mat[8];
                normy = rad.nrm[vp * 3 + 1];
                normz =
                  rad.nrm[vp * 3 + 2] * rad.mat[10] -
                  rad.nrm[vp * 3] * rad.mat[2];
                var crx = kx[k] - rad.x;
                var cry = ky[k] + 7 - rad.y;
                var crz = kz[k] - rad.z;
                if (Math.abs(normy) < rad.walarc && !cancelbnd) {
                  var bncbth = false;
                  if (!rad.interact) {
                    if (pieces.list[o].typ != 39) {
                      var verlow = 10000;
                      for (var j = 0; j < 3; j++) {
                        if (verty[j] < verlow) {
                          verlow = verty[j];
                        }
                      }
                      for (var j = 0; j < 3; j++) {
                        if (Math.abs(verty[j] - verlow) < 2) {
                          verty[j] -= 100;
                        }
                      }
                    } else {
                      if (i == 43) {
                        if (Math.abs(normz) == 1) {
                          vertx[0] = -vertx[1];
                          vertx[2] = -vertx[1];
                          for (var j = 0; j < 3; j++) {
                            vertz[j] *= 1;
                          }
                          verty[0] += 50;
                          verty[1] = -10;
                          verty[2] = -10;
                        }
                        if (Math.abs(normx) == 1) {
                          vertz[0] = -vertz[1];
                          vertz[2] = -vertz[1];
                          for (var j = 0; j < 3; j++) {
                            vertx[j] *= 1;
                          }
                          verty[0] += 50;
                          verty[1] = -10;
                          verty[2] = -10;
                        }
                        bncbth = true;
                      }
                      if (i == 44) {
                        if (Math.abs(normz) == 1) {
                          vertx[1] = -vertx[0];
                          for (var j = 0; j < 3; j++) {
                            vertz[j] *= 1;
                          }
                          verty[1] += 50;
                          verty[2] += 50;
                          verty[0] = -10;
                        }
                        if (Math.abs(normx) == 1) {
                          vertz[1] = -vertz[0];
                          for (var j = 0; j < 3; j++) {
                            vertx[j] *= 1;
                          }
                          verty[1] += 50;
                          verty[2] += 50;
                          verty[0] = -10;
                        }
                        bncbth = true;
                      }
                    }
                  }
                  if (Math.abs(normz) > Math.abs(normx)) {
                    var areaOrig = Math.abs(
                      (vertx[1] - vertx[0]) * (verty[2] - verty[0]) -
                        (vertx[2] - vertx[0]) * (verty[1] - verty[0]),
                    );
                    var area1 = Math.abs(
                      (vertx[0] - crx) * (verty[1] - cry) -
                        (vertx[1] - crx) * (verty[0] - cry),
                    );
                    var area2 = Math.abs(
                      (vertx[1] - crx) * (verty[2] - cry) -
                        (vertx[2] - crx) * (verty[1] - cry),
                    );
                    var area3 = Math.abs(
                      (vertx[2] - crx) * (verty[0] - cry) -
                        (vertx[0] - crx) * (verty[2] - cry),
                    );
                    if (area1 + area2 + area3 <= areaOrig + 10) {
                      var fct = 0;
                      if (verty[0] - verty[1] != 0) {
                        fct =
                          (ky[k] - (verty[1] + rad.y)) / (verty[0] - verty[1]);
                      } else {
                        fct = 0;
                      }
                      var lx = vertx[1] + (vertx[0] - vertx[1]) * fct;
                      var lz = vertz[1] + (vertz[0] - vertz[1]) * fct;
                      if (verty[0] - verty[2] != 0) {
                        fct =
                          (ky[k] - (verty[2] + rad.y)) / (verty[0] - verty[2]);
                      } else {
                        fct = 0;
                      }
                      var tx = vertx[2] + (vertx[0] - vertx[2]) * fct;
                      var tz = vertz[2] + (vertz[0] - vertz[2]) * fct;
                      if (tx - lx != 0) {
                        fct = (kx[k] - (lx + rad.x)) / (tx - lx);
                      } else {
                        fct = 0;
                      }
                      var colz = lz + rad.z + (tz - lz) * fct;
                      if (
                        pieces.list[o].bnd[0] != 1 &&
                        normz > 0 &&
                        kz[k] < colz + zboundr &&
                        kz[k] > colz + zboundr - rad.bndmax &&
                        (racers[c].scz[k] <= 1.2 || bncbth)
                      ) {
                        for (var j = 0; j < 4; j++) {
                          if (k != j) {
                            if (kz[j] >= colz + zboundr) {
                              kz[j] -= kz[k] - (colz + zboundr);
                            }
                          }
                        }
                        kz[k] = colz + zboundr;
                        if (tick.fraction >= tick.scale) {
                          racers[c].crank[k]++;
                          if (racers[c].crank[k] > 2) {
                            sprks(
                              cn,
                              kx[k],
                              ky[k],
                              kz[k] - zboundr,
                              racers[c].scx[k],
                              racers[c].scy[k],
                              racers[c].scz[k],
                              2,
                            );
                            if (c == game.player) {
                              scrapeSound(
                                racers[c].scx[k],
                                racers[c].scy[k],
                                racers[c].scz[k],
                              );
                            }
                          }
                        }
                        var bmac =
                          Math.abs(cosDeg(racers[c].pxy)) +
                          Math.abs(cosDeg(racers[c].pzy));
                        bmac = bmac / 4;
                        if (bmac > 0.3) {
                          bmac = 0.3;
                        }
                        if (wastouch) {
                          bmac = 0;
                        }
                        bmac += carStats.bounce[cn] - 0.2;
                        if (bmac < 1.1) {
                          bmac = 1.1;
                        }
                        regn(
                          1,
                          k,
                          Math.abs(racers[c].scz[k] * bmac * rad.dam),
                          c,
                        );
                        if (racers[c].scz[k] <= 0) {
                          racers[c].scz[k] += Math.abs(racers[c].scz[k] * bmac);
                        }
                        racers[c].skid = 2;
                        spinlocate = true;
                        racers[c].uwall = true;
                        if (
                          pieces.list[o].typ != 35 &&
                          pieces.list[o].typ != 36 &&
                          (pieces.list[o].typ != 39 || track.stage == 13) &&
                          (pieces.list[o].typ != 20 || track.stage != 14) &&
                          (pieces.list[o].typ != 1 || track.stage != 16)
                        ) {
                          racers[c].wall = o;
                        }
                      }
                      if (
                        pieces.list[o].bnd[1] != 1 &&
                        normz < 0 &&
                        kz[k] > colz - zboundr &&
                        kz[k] < colz - zboundr + rad.bndmax &&
                        (racers[c].scz[k] >= -1.2 || bncbth)
                      ) {
                        for (var j = 0; j < 4; j++) {
                          if (k != j) {
                            if (kz[j] <= colz - zboundr) {
                              kz[j] -= kz[k] - (colz - zboundr);
                            }
                          }
                        }
                        kz[k] = colz - zboundr;
                        if (tick.fraction >= tick.scale) {
                          racers[c].crank[k]++;
                          if (racers[c].crank[k] > 2) {
                            sprks(
                              cn,
                              kx[k],
                              ky[k],
                              kz[k] + zboundr,
                              racers[c].scx[k],
                              racers[c].scy[k],
                              racers[c].scz[k],
                              2,
                            );
                            if (c == game.player) {
                              scrapeSound(
                                racers[c].scx[k],
                                racers[c].scy[k],
                                racers[c].scz[k],
                              );
                            }
                          }
                        }
                        var bmac =
                          Math.abs(cosDeg(racers[c].pxy)) +
                          Math.abs(cosDeg(racers[c].pzy));
                        bmac = bmac / 4;
                        if (bmac > 0.3) {
                          bmac = 0.3;
                        }
                        if (wastouch) {
                          bmac = 0;
                        }
                        bmac += carStats.bounce[cn] - 0.2;
                        if (bmac < 1.1) {
                          bmac = 1.1;
                        }
                        regn(
                          1,
                          k,
                          -Math.abs(racers[c].scz[k] * bmac * rad.dam),
                          c,
                        );
                        if (racers[c].scz[k] >= 0) {
                          racers[c].scz[k] -= Math.abs(racers[c].scz[k] * bmac);
                        }
                        racers[c].skid = 2;
                        spinlocate = true;
                        racers[c].uwall = true;
                        if (
                          pieces.list[o].typ != 35 &&
                          pieces.list[o].typ != 36 &&
                          (pieces.list[o].typ != 39 || track.stage == 13) &&
                          (pieces.list[o].typ != 20 || track.stage != 14) &&
                          (pieces.list[o].typ != 1 || track.stage != 16)
                        ) {
                          racers[c].wall = o;
                        }
                      }
                    }
                  } else {
                    var areaOrig = Math.abs(
                      (verty[1] - verty[0]) * (vertz[2] - vertz[0]) -
                        (verty[2] - verty[0]) * (vertz[1] - vertz[0]),
                    );
                    var area1 = Math.abs(
                      (verty[0] - cry) * (vertz[1] - crz) -
                        (verty[1] - cry) * (vertz[0] - crz),
                    );
                    var area2 = Math.abs(
                      (verty[1] - cry) * (vertz[2] - crz) -
                        (verty[2] - cry) * (vertz[1] - crz),
                    );
                    var area3 = Math.abs(
                      (verty[2] - cry) * (vertz[0] - crz) -
                        (verty[0] - cry) * (vertz[2] - crz),
                    );
                    if (area1 + area2 + area3 <= areaOrig + 10) {
                      var fct = 0;
                      if (vertz[0] - vertz[1] != 0) {
                        fct =
                          (kz[k] - (vertz[1] + rad.z)) / (vertz[0] - vertz[1]);
                      } else {
                        fct = 0;
                      }
                      var lx = vertx[1] + (vertx[0] - vertx[1]) * fct;
                      var ly = verty[1] + (verty[0] - verty[1]) * fct;
                      if (vertz[0] - vertz[2] != 0) {
                        fct =
                          (kz[k] - (vertz[2] + rad.z)) / (vertz[0] - vertz[2]);
                      } else {
                        fct = 0;
                      }
                      var tx = vertx[2] + (vertx[0] - vertx[2]) * fct;
                      var ty = verty[2] + (verty[0] - verty[2]) * fct;
                      if (ty - ly != 0) {
                        fct = (ky[k] - (ly + rad.y)) / (ty - ly);
                      } else {
                        fct = 0;
                      }
                      var colx = lx + rad.x + (tx - lx) * fct;
                      if (
                        pieces.list[o].bnd[2] != 1 &&
                        normx > 0 &&
                        kx[k] < colx + xboundr &&
                        kx[k] > colx + xboundr - rad.bndmax &&
                        (racers[c].scx[k] <= 1.2 || bncbth)
                      ) {
                        for (var j = 0; j < 4; j++) {
                          if (k != j) {
                            if (kx[j] >= colx + xboundr) {
                              kx[j] -= kx[k] - (colx + xboundr);
                            }
                          }
                        }
                        kx[k] = colx + xboundr;
                        if (tick.fraction >= tick.scale) {
                          racers[c].crank[k]++;
                          if (racers[c].crank[k] > 2) {
                            sprks(
                              cn,
                              kx[k] - xboundr,
                              ky[k],
                              kz[k],
                              racers[c].scx[k],
                              racers[c].scy[k],
                              racers[c].scz[k],
                              2,
                            );
                            if (c == game.player) {
                              scrapeSound(
                                racers[c].scx[k],
                                racers[c].scy[k],
                                racers[c].scz[k],
                              );
                            }
                          }
                        }
                        var bmac =
                          Math.abs(cosDeg(racers[c].pxy)) +
                          Math.abs(cosDeg(racers[c].pzy));
                        bmac = bmac / 4;
                        if (bmac > 0.3) {
                          bmac = 0.3;
                        }
                        if (wastouch) {
                          bmac = 0;
                        }
                        bmac += carStats.bounce[cn] - 0.2;
                        if (bmac < 1.1) {
                          bmac = 1.1;
                        }
                        regn(
                          0,
                          k,
                          Math.abs(racers[c].scx[k] * bmac * rad.dam),
                          c,
                        );
                        if (racers[c].scx[k] <= 0) {
                          racers[c].scx[k] += Math.abs(racers[c].scx[k] * bmac);
                        }
                        racers[c].skid = 2;
                        spinlocate = true;
                        racers[c].uwall = true;
                        if (
                          pieces.list[o].typ != 35 &&
                          pieces.list[o].typ != 36 &&
                          (pieces.list[o].typ != 39 || track.stage == 13) &&
                          (pieces.list[o].typ != 1 || track.stage != 16)
                        ) {
                          racers[c].wall = o;
                        }
                      }
                      if (
                        pieces.list[o].bnd[3] != 1 &&
                        normx < 0 &&
                        kx[k] > colx - xboundr &&
                        kx[k] < colx - xboundr + rad.bndmax &&
                        (racers[c].scx[k] >= -1.2 || bncbth)
                      ) {
                        for (var j = 0; j < 4; j++) {
                          if (k != j) {
                            if (kx[j] <= colx - xboundr) {
                              kx[j] -= kx[k] - (colx - xboundr);
                            }
                          }
                        }
                        kx[k] = colx - xboundr;
                        if (tick.fraction >= tick.scale) {
                          racers[c].crank[k]++;
                          if (racers[c].crank[k] > 2) {
                            sprks(
                              cn,
                              kx[k] + xboundr,
                              ky[k],
                              kz[k],
                              racers[c].scx[k],
                              racers[c].scy[k],
                              racers[c].scz[k],
                              2,
                            );
                            if (c == game.player) {
                              scrapeSound(
                                racers[c].scx[k],
                                racers[c].scy[k],
                                racers[c].scz[k],
                              );
                            }
                          }
                        }
                        var bmac =
                          Math.abs(cosDeg(racers[c].pxy)) +
                          Math.abs(cosDeg(racers[c].pzy));
                        bmac = bmac / 4;
                        if (bmac > 0.3) {
                          bmac = 0.3;
                        }
                        if (wastouch) {
                          bmac = 0;
                        }
                        bmac += carStats.bounce[cn] - 0.2;
                        if (bmac < 1.1) {
                          bmac = 1.1;
                        }
                        regn(
                          0,
                          k,
                          -Math.abs(racers[c].scx[k] * bmac * rad.dam),
                          c,
                        );
                        if (racers[c].scx[k] >= 0) {
                          racers[c].scx[k] -= Math.abs(racers[c].scx[k] * bmac);
                        }
                        racers[c].skid = 2;
                        spinlocate = true;
                        racers[c].uwall = true;
                        if (
                          pieces.list[o].typ != 35 &&
                          pieces.list[o].typ != 36 &&
                          (pieces.list[o].typ != 39 || track.stage == 13) &&
                          (pieces.list[o].typ != 1 || track.stage != 16)
                        ) {
                          racers[c].wall = o;
                        }
                      }
                    }
                  }
                }
                if (pieces.list[o].typ == 26) {
                  normy = Math.abs(normy);
                }
                if (normy > 0.4 && !cancelpln) {
                  var areaOrig = Math.abs(
                    (vertx[1] - vertx[0]) * (vertz[2] - vertz[0]) -
                      (vertx[2] - vertx[0]) * (vertz[1] - vertz[0]),
                  );
                  var area1 = Math.abs(
                    (vertx[0] - crx) * (vertz[1] - crz) -
                      (vertx[1] - crx) * (vertz[0] - crz),
                  );
                  var area2 = Math.abs(
                    (vertx[1] - crx) * (vertz[2] - crz) -
                      (vertx[2] - crx) * (vertz[1] - crz),
                  );
                  var area3 = Math.abs(
                    (vertx[2] - crx) * (vertz[0] - crz) -
                      (vertx[0] - crx) * (vertz[2] - crz),
                  );
                  if (area1 + area2 + area3 <= areaOrig + 10) {
                    var fct = 0;
                    if (vertz[0] - vertz[1] != 0) {
                      fct =
                        (kz[k] - (vertz[1] + rad.z)) / (vertz[0] - vertz[1]);
                    } else {
                      fct = 0;
                    }
                    var lx = vertx[1] + (vertx[0] - vertx[1]) * fct;
                    var ly = verty[1] + (verty[0] - verty[1]) * fct;
                    if (vertz[0] - vertz[2] != 0) {
                      fct =
                        (kz[k] - (vertz[2] + rad.z)) / (vertz[0] - vertz[2]);
                    } else {
                      fct = 0;
                    }
                    var tx = vertx[2] + (vertx[0] - vertx[2]) * fct;
                    var ty = verty[2] + (verty[0] - verty[2]) * fct;
                    if (tx - lx != 0) {
                      fct = (kx[k] - (lx + rad.x)) / (tx - lx);
                    } else {
                      fct = 0;
                    }
                    var coly = ly + rad.y + (ty - ly) * fct;
                    if (Math.abs(normy) == 1) {
                      if (ky[k] < coly - 0.05 && ky[k] > coly - 20) {
                        ntrt++;
                        racers[c].wtouch = true;
                        racers[c].gtouch = true;
                        if (!wastouch) {
                          if (racers[c].scy[k] != -0.7) {
                            var mag = racers[c].scy[k] / 33.33;
                            if (mag > 0.3) {
                              mag = 0.3;
                            }
                            if (tskd == 0) {
                              mag += 1.1;
                            } else {
                              mag += 1.2;
                            }
                            dustup(
                              tskd,
                              c,
                              k,
                              kx[k],
                              ky[k],
                              kz[k],
                              racers[c].scx[k],
                              racers[c].scz[k],
                              mag * carStats.simag[cn],
                              0,
                              racers[c].capsized && racers[c].mtouch,
                            );
                          }
                        }
                        ky[k] = coly;
                        if (racers[c].capsized) {
                          if (ontsprk && (tskd == 0 || tskd == 1)) {
                            sprkon[k] = 1;
                          } else {
                            sprkon[k] = 2;
                          }
                        }
                        var bmac =
                          Math.abs(sinDeg(racers[c].pxy)) +
                          Math.abs(sinDeg(racers[c].pzy));
                        bmac = bmac / 3;
                        if (bmac > 0.4) {
                          bmac = 0.4;
                        }
                        bmac += carStats.bounce[cn];
                        if (bmac < 1.1) {
                          bmac = 1.1;
                        }
                        regn(2, k, Math.abs(racers[c].scy[k] * bmac), c);
                        if (racers[c].scy[k] < 0) {
                          racers[c].scy[k] += Math.abs(racers[c].scy[k] * bmac);
                        }
                        onorm[Math.floor(k * 0.5)] = 1;
                      }
                    } else {
                      if (ty - ly != 0) {
                        fct = (ky[k] - (ly + rad.y)) / (ty - ly);
                      } else {
                        fct = 0;
                      }
                      var colx = lx + rad.x + (tx - lx) * fct;
                      fct = 0;
                      if (verty[0] - verty[1] != 0) {
                        fct =
                          (ky[k] - (verty[1] + rad.y)) / (verty[0] - verty[1]);
                      } else {
                        fct = 0;
                      }
                      lx = vertx[1] + (vertx[0] - vertx[1]) * fct;
                      var lz = vertz[1] + (vertz[0] - vertz[1]) * fct;
                      if (verty[0] - verty[2] != 0) {
                        fct =
                          (ky[k] - (verty[2] + rad.y)) / (verty[0] - verty[2]);
                      } else {
                        fct = 0;
                      }
                      tx = vertx[2] + (vertx[0] - vertx[2]) * fct;
                      var tz = vertz[2] + (vertz[0] - vertz[2]) * fct;
                      if (tx - lx != 0) {
                        fct = (kx[k] - (lx + rad.x)) / (tx - lx);
                      } else {
                        fct = 0;
                      }
                      var colz = lz + rad.z + (tz - lz) * fct;
                      if (ky[k] < coly && ky[k] > coly - 20) {
                        var bounceramp = false;
                        if (Math.abs(normz) > Math.abs(normx)) {
                          if (
                            (normz > 0 && racers[c].scz[k] < 0) ||
                            (normz < 0 && racers[c].scz[k] > 0)
                          ) {
                            bounceramp = true;
                          }
                        } else {
                          if (
                            (normx > 0 && racers[c].scx[k] < 0) ||
                            (normx < 0 && racers[c].scx[k] > 0)
                          ) {
                            bounceramp = true;
                          }
                        }
                        if (bounceramp) {
                          var bmac =
                            Math.abs(sinDeg(racers[c].pxy)) +
                            Math.abs(sinDeg(racers[c].pzy));
                          bmac = bmac / 3;
                          if (bmac > 0.4) {
                            bmac = 0.4;
                          }
                          bmac += carStats.bounce[cn];
                          if (bmac < 1.1) {
                            bmac = 1.1;
                          }
                          if (racers[c].scy[k] < 0) {
                            racers[c].scy[k] += Math.abs(
                              racers[c].scy[k] * bmac,
                            );
                          }
                          if (pieces.list[o].typ == 39) {
                            for (var ka = 0; ka < 4; ka++) {
                              if (Math.abs(normz) > Math.abs(normx)) {
                                if (normz > 0) {
                                  racers[c].scz[ka] += Math.abs(
                                    racers[c].scy[k] * bmac * 0.4,
                                  );
                                } else {
                                  racers[c].scz[ka] -= Math.abs(
                                    racers[c].scy[k] * bmac * 0.4,
                                  );
                                }
                              } else {
                                if (normx > 0) {
                                  racers[c].scx[ka] += Math.abs(
                                    racers[c].scy[k] * bmac * 0.4,
                                  );
                                } else {
                                  racers[c].scx[ka] -= Math.abs(
                                    racers[c].scy[k] * bmac * 0.4,
                                  );
                                }
                              }
                            }
                          }
                        }
                        var trzy =
                          Math.acos(Math.abs(normy)) / 0.017453292519943295;
                        var arct = 1 + (50 - Math.abs(trzy)) / 30;
                        if (arct < 1) {
                          arct = 1;
                        }
                        var difco = (coly - ky[k]) / (arct * tick.scale);
                        racers[c].scy[k] += difco;
                        ky[k] = coly;
                        if (difco > 0) {
                          difco *= 20;
                          difco = 100 - difco;
                          if (difco < 2) {
                            difco = 2;
                          }
                          if (Math.abs(normz) > Math.abs(normx)) {
                            if (Math.abs(colz - kz[k]) < 100) {
                              kz[k] += (colz - kz[k]) / difco;
                            }
                          } else {
                            if (Math.abs(colx - kx[k]) < 100) {
                              kx[k] += (colx - kx[k]) / difco;
                            }
                          }
                        }
                        if (tskd == 2) {
                          ntroff++;
                        } else {
                          ntron++;
                        }
                        racers[c].wtouch = true;
                        racers[c].gtouch = false;
                        if (racers[c].capsized) {
                          if (ontsprk && (tskd == 0 || tskd == 1)) {
                            sprkon[k] = 1;
                          } else {
                            sprkon[k] = 2;
                          }
                        }
                        if (!wastouch) {
                          if (tskd != 0) {
                            var mag = 1.4;
                            dustup(
                              tskd,
                              c,
                              i,
                              kx[i],
                              ky[i],
                              kz[i],
                              racers[c].scx[i],
                              racers[c].scz[i],
                              mag * carStats.simag[cn],
                              0,
                              racers[c].capsized && racers[c].mtouch,
                            );
                          }
                        }
                        onorm[Math.floor(k * 0.5)] = normy;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (ntroff == 4) {
        racers[c].mtouch = true;
      }
      if (ntrt == 4) {
        ntr = 4;
      }
    }
    if (ntron == 4) {
      racers[c].mtouch = true;
    }
    if (c == game.player) {
      for (var i = 0; i < 2; i++) {
        if (lonorm[i] != onorm[i]) {
          if (lonorm[i] > 0 && onorm[i] > 0) {
            if (Math.abs(lonorm[i] - onorm[i]) > 0.015) {
              bumpSound(i, Math.sqrt(avnx * avnx + avnz * avnz), tskd);
            }
          }
          lonorm[i] = onorm[i];
        }
      }
    }
    if (tick.fraction >= tick.scale) {
      var allsparks = 0;
      for (var k = 0; k < 4; k++) {
        if (sprkon[k] == 1) {
          allsparks++;
        }
      }
      if (allsparks != 4) {
        for (var k = 0; k < 4; k++) {
          if (sprkon[k] == 1) {
            sprks(
              cn,
              kx[k],
              ky[k],
              kz[k],
              racers[c].scx[k],
              racers[c].scy[k],
              racers[c].scz[k],
              1,
            );
          }
          if (c == game.player && sprkon[k]) {
            groundScrapeSound(
              sprkon[k],
              racers[c].scx[k],
              racers[c].scy[k],
              racers[c].scz[k],
            );
          }
        }
      } else {
        var k = Math.floor(random.fx() * 4);
        if (k == 4) {
          k = 0;
        }
        sprks(
          cn,
          (kx[k] + car[c].x) / 2,
          ky[k],
          (kz[k] + car[c].z) / 2,
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
          cn,
          (kx[k] + car[c].x) / 2,
          ky[k],
          (kz[k] + car[c].z) / 2,
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
    for (var k = 0; k < 4; k++) {
      if (kz[k] < track.limb + zboundr && kz[k] > track.limb + zboundr - 20) {
        for (var j = 0; j < 4; j++) {
          if (k != j) {
            if (kz[j] >= track.limb + zboundr) {
              kz[j] -= kz[k] - (track.limb + zboundr);
            }
          }
        }
        kz[k] = track.limb + zboundr;
        if (tick.fraction >= tick.scale && ky[k] < 20) {
          racers[c].crank[k]++;
          if (racers[c].crank[k] > 2) {
            sprks(
              cn,
              kx[k],
              ky[k],
              kz[k] - zboundr,
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
        var bmac =
          Math.abs(cosDeg(racers[c].pxy)) + Math.abs(cosDeg(racers[c].pzy));
        bmac = bmac / 4;
        if (bmac > 0.3) {
          bmac = 0.3;
        }
        if (wastouch) {
          bmac = 0;
        }
        bmac += carStats.bounce[cn] - 0.2;
        if (bmac < 1.1) {
          bmac = 1.1;
        }
        regn(1, k, Math.abs(racers[c].scz[k] * bmac), c);
        if (racers[c].scz[k] <= 0) {
          racers[c].scz[k] += Math.abs(racers[c].scz[k] * bmac);
        }
        racers[c].skid = 2;
        spinlocate = true;
        racers[c].wall = track.limbo;
      }
      if (kz[k] > track.limt - zboundr && kz[k] < track.limt - zboundr + 20) {
        for (var j = 0; j < 4; j++) {
          if (k != j) {
            if (kz[j] <= track.limt - zboundr) {
              kz[j] -= kz[k] - (track.limt - zboundr);
            }
          }
        }
        kz[k] = track.limt - zboundr;
        if (tick.fraction >= tick.scale && ky[k] < 20) {
          racers[c].crank[k]++;
          if (racers[c].crank[k] > 2) {
            sprks(
              cn,
              kx[k],
              ky[k],
              kz[k] + zboundr,
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
        var bmac =
          Math.abs(cosDeg(racers[c].pxy)) + Math.abs(cosDeg(racers[c].pzy));
        bmac = bmac / 4;
        if (bmac > 0.3) {
          bmac = 0.3;
        }
        if (wastouch) {
          bmac = 0;
        }
        bmac += carStats.bounce[cn] - 0.2;
        if (bmac < 1.1) {
          bmac = 1.1;
        }
        regn(1, k, -Math.abs(racers[c].scz[k] * bmac), c);
        if (racers[c].scz[k] >= 0) {
          racers[c].scz[k] -= Math.abs(racers[c].scz[k] * bmac);
        }
        racers[c].skid = 2;
        spinlocate = true;
        racers[c].wall = track.limto;
      }
      if (kx[k] < track.limr + xboundr && kx[k] > track.limr + xboundr - 20) {
        for (var j = 0; j < 4; j++) {
          if (k != j) {
            if (kx[j] >= track.limr + xboundr) {
              kx[j] -= kx[k] - (track.limr + xboundr);
            }
          }
        }
        kx[k] = track.limr + xboundr;
        if (tick.fraction >= tick.scale && ky[k] < 20) {
          racers[c].crank[k]++;
          if (racers[c].crank[k] > 2) {
            sprks(
              cn,
              kx[k] - xboundr,
              ky[k],
              kz[k],
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
        var bmac =
          Math.abs(cosDeg(racers[c].pxy)) + Math.abs(cosDeg(racers[c].pzy));
        bmac = bmac / 4;
        if (bmac > 0.3) {
          bmac = 0.3;
        }
        if (wastouch) {
          bmac = 0;
        }
        bmac += carStats.bounce[cn] - 0.2;
        if (bmac < 1.1) {
          bmac = 1.1;
        }
        regn(0, k, Math.abs(racers[c].scx[k] * bmac), c);
        if (racers[c].scx[k] <= 0) {
          racers[c].scx[k] += Math.abs(racers[c].scx[k] * bmac);
        }
        racers[c].skid = 2;
        spinlocate = true;
        racers[c].wall = track.limro;
      }
      if (kx[k] > track.liml - xboundr && kx[k] < track.liml - xboundr + 20) {
        for (var j = 0; j < 4; j++) {
          if (k != j) {
            if (kx[j] <= track.liml - xboundr) {
              kx[j] -= kx[k] - (track.liml - xboundr);
            }
          }
        }
        kx[k] = track.liml - xboundr;
        if (tick.fraction >= tick.scale && ky[k] < 20) {
          racers[c].crank[k]++;
          if (racers[c].crank[k] > 2) {
            sprks(
              cn,
              kx[k] + xboundr,
              ky[k],
              kz[k],
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
        var bmac =
          Math.abs(cosDeg(racers[c].pxy)) + Math.abs(cosDeg(racers[c].pzy));
        bmac = bmac / 4;
        if (bmac > 0.3) {
          bmac = 0.3;
        }
        if (wastouch) {
          bmac = 0;
        }
        bmac += carStats.bounce[cn] - 0.2;
        if (bmac < 1.1) {
          bmac = 1.1;
        }
        regn(0, k, -Math.abs(racers[c].scx[k] * bmac), c);
        if (racers[c].scx[k] >= 0) {
          racers[c].scx[k] -= Math.abs(racers[c].scx[k] * bmac);
        }
        racers[c].skid = 2;
        spinlocate = true;
        racers[c].wall = track.limlo;
      }
    }
    if (tick.fraction >= tick.scale) {
      for (var i = 0; i < 4; i++) {
        // The original also had `if (crank[c][i] == lcrank[c][i]) crank[c][i][k] = 0;` here,
        // a write onto a number that never had any effect (and throws in strict mode).
        racers[c].lcrank[i] = racers[c].crank[i];
      }
    }
    var nzy = 0,
      nzyr = 0,
      nxy = 0,
      nxyr = 0;
    if (racers[c].scy[2] != racers[c].scy[0]) {
      if (racers[c].scy[2] < racers[c].scy[0]) {
        mlt = -1;
      } else {
        mlt = 1;
      }
      arch =
        Math.sqrt(
          (kz[0] - kz[2]) * (kz[0] - kz[2]) +
            (ky[0] - ky[2]) * (ky[0] - ky[2]) +
            (kx[0] - kx[2]) * (kx[0] - kx[2]),
        ) /
        (Math.abs(car[c].keyz[0]) + Math.abs(car[c].keyz[2]));
      if (arch >= 0.9998) {
        nzy = mlt;
      } else {
        nzy = (Math.acos(arch) / 0.017453292519943295) * mlt;
      }
    }
    if (racers[c].scy[3] != racers[c].scy[1]) {
      if (racers[c].scy[3] < racers[c].scy[1]) {
        mlt = -1;
      } else {
        mlt = 1;
      }
      arch =
        Math.sqrt(
          (kz[1] - kz[3]) * (kz[1] - kz[3]) +
            (ky[1] - ky[3]) * (ky[1] - ky[3]) +
            (kx[1] - kx[3]) * (kx[1] - kx[3]),
        ) /
        (Math.abs(car[c].keyz[1]) + Math.abs(car[c].keyz[3]));
      if (arch >= 0.9998) {
        nzyr = mlt;
      } else {
        nzyr = (Math.acos(arch) / 0.017453292519943295) * mlt;
      }
    }
    if (racers[c].scy[1] != racers[c].scy[0]) {
      if (racers[c].scy[1] < racers[c].scy[0]) {
        mlt = -1;
      } else {
        mlt = 1;
      }
      arch =
        Math.sqrt(
          (kz[0] - kz[1]) * (kz[0] - kz[1]) +
            (ky[0] - ky[1]) * (ky[0] - ky[1]) +
            (kx[0] - kx[1]) * (kx[0] - kx[1]),
        ) /
        (Math.abs(car[c].keyx[0]) + Math.abs(car[c].keyx[1]));
      if (arch >= 0.9998) {
        nxy = mlt;
      } else {
        nxy = (Math.acos(arch) / 0.017453292519943295) * mlt;
      }
    }
    if (racers[c].scy[3] != racers[c].scy[2]) {
      if (racers[c].scy[3] < racers[c].scy[2]) {
        mlt = -1;
      } else {
        mlt = 1;
      }
      arch =
        Math.sqrt(
          (kz[2] - kz[3]) * (kz[2] - kz[3]) +
            (ky[2] - ky[3]) * (ky[2] - ky[3]) +
            (kx[2] - kx[3]) * (kx[2] - kx[3]),
        ) /
        (Math.abs(car[c].keyx[2]) + Math.abs(car[c].keyx[3]));
      if (arch >= 0.9998) {
        nxyr = mlt;
      } else {
        nxyr = (Math.acos(arch) / 0.017453292519943295) * mlt;
      }
    }
    if (spinlocate) {
      var dxz = Math.abs(car[c].xz + 45);
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
    if (Math.abs(nzyr) > Math.abs(nzy)) {
      nzy = nzyr;
    }
    if (Math.abs(nxyr) > Math.abs(nxy)) {
      nxy = nxyr;
    }
    if (!zyinv) {
      racers[c].pzy += nzy * tick.scale;
    } else {
      racers[c].pzy -= nzy * tick.scale;
    }
    if (!xyinv) {
      racers[c].pxy += nxy * tick.scale;
    } else {
      racers[c].pxy -= nxy * tick.scale;
    }
    if (ntr == 4) {
      var tat = 0;
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
    car[c].y =
      (ky[0] + ky[1] + ky[2] + ky[3]) / 4 -
      keyy * cosDeg(racers[c].pzy) * cosDeg(racers[c].pxy) +
      ytrim * tick.scale;
    if (zyinv) {
      mlt = -1;
    } else {
      mlt = 1;
    }
    car[c].x =
      (kx[0] -
        car[c].keyx[0] * cosDeg(car[c].xz) +
        mlt * car[c].keyz[0] * sinDeg(car[c].xz) +
        kx[1] -
        car[c].keyx[1] * cosDeg(car[c].xz) +
        mlt * car[c].keyz[1] * sinDeg(car[c].xz) +
        kx[2] -
        car[c].keyx[2] * cosDeg(car[c].xz) +
        mlt * car[c].keyz[2] * sinDeg(car[c].xz) +
        kx[3] -
        car[c].keyx[3] * cosDeg(car[c].xz) +
        mlt * car[c].keyz[3] * sinDeg(car[c].xz)) /
        4 +
      keyy * sinDeg(racers[c].pxy) * cosDeg(car[c].xz) -
      keyy * sinDeg(racers[c].pzy) * sinDeg(car[c].xz) +
      xtrim * tick.scale;
    car[c].z =
      (kz[0] -
        mlt * car[c].keyz[0] * cosDeg(car[c].xz) -
        car[c].keyx[0] * sinDeg(car[c].xz) +
        kz[1] -
        mlt * car[c].keyz[1] * cosDeg(car[c].xz) -
        car[c].keyx[1] * sinDeg(car[c].xz) +
        kz[2] -
        mlt * car[c].keyz[2] * cosDeg(car[c].xz) -
        car[c].keyx[2] * sinDeg(car[c].xz) +
        kz[3] -
        mlt * car[c].keyz[3] * cosDeg(car[c].xz) -
        car[c].keyx[3] * sinDeg(car[c].xz)) /
        4 +
      keyy * sinDeg(racers[c].pxy) * sinDeg(car[c].xz) -
      keyy * sinDeg(racers[c].pzy) * cosDeg(car[c].xz) +
      ztrim * tick.scale;
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
    if (racers[c].wtouch && !racers[c].capsized) {
      var mtilt =
        (racers[c].speed / carStats.swits[cn][2]) *
        14 *
        (carStats.bounce[cn] - 0.4);
      if (racers[c].u.left && racers[c].tilt < mtilt && racers[c].tilt >= 0) {
        racers[c].tilt += 0.4 * tick.scale;
      } else {
        if (
          racers[c].u.right &&
          racers[c].tilt > -mtilt &&
          racers[c].tilt <= 0
        ) {
          racers[c].tilt -= 0.4 * tick.scale;
        } else {
          if (Math.abs(racers[c].tilt) > 3 * (carStats.bounce[cn] - 0.4)) {
            if (racers[c].tilt > 0) {
              racers[c].tilt -= 3 * (carStats.bounce[cn] - 0.3);
            } else {
              racers[c].tilt += 3 * (carStats.bounce[cn] - 0.3);
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
    if (tick.fraction >= tick.scale) {
      if (racers[c].mtouch && tskd == 2) {
        car[c].zy +=
          ((random.sim() * 5 * racers[c].speed) / carStats.swits[cn][2] -
            (2.5 * racers[c].speed) / carStats.swits[cn][2]) *
          (carStats.bounce[cn] - 0.3);
        car[c].xy +=
          ((random.sim() * 5 * racers[c].speed) / carStats.swits[cn][2] -
            (2.5 * racers[c].speed) / carStats.swits[cn][2]) *
          (carStats.bounce[cn] - 0.3);
      }
      if (racers[c].wtouch && tskd == 1) {
        car[c].zy +=
          ((random.sim() * 3.34 * racers[c].speed) / carStats.swits[cn][2] -
            (1.67 * racers[c].speed) / carStats.swits[cn][2]) *
          (carStats.bounce[cn] - 0.3);
        car[c].xy +=
          ((random.sim() * 3.34 * racers[c].speed) / carStats.swits[cn][2] -
            (1.67 * racers[c].speed) / carStats.swits[cn][2]) *
          (carStats.bounce[cn] - 0.3);
      }
    }
    if (tick.fraction >= tick.scale) {
      if (racers[c].hitmag >= carStats.maxmag[cn]) {
        if (recording.repcar[c].destat == 700) {
          recording.repcar[c].destat = 430;
          if (racers[c].lastcolido != 0) {
            recording.repcar[c].destedbyzero = racers[c].lastcolido;
          }
        }
        if (racers[c].cntdest < 6) {
          if (racers[c].embos == 0) {
            carModels[car[c].typ].alpha = 1;
            racers[c].embodir = Math.floor(random.fx() * 3);
            if (racers[c].embodir == 3) {
              racers[c].embodir = 0;
            }
            racers[c].embomag = 1.2 + random.fx() * 0.2;
          }
          if (racers[c].embos == 1) {
            carModels[car[c].typ].alpha = 2;
          }
          racers[c].embos++;
          if (racers[c].embos == 2) {
            racers[c].embos = 0;
            racers[c].cntdest++;
          }
        } else {
          if (racers[c].cntdest == 6) {
            carModels[car[c].typ].alpha = 1;
            racers[c].embodir = 0;
            chipburn(c);
            racers[c].embos = 0;
            racers[c].cntdest = 7;
          }
          firexp(
            c,
            avnx,
            (racers[c].scy[0] +
              racers[c].scy[1] +
              racers[c].scy[2] +
              racers[c].scy[3]) /
              4,
            avnz,
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
    var pnt = 0,
      pyclos = 0;
    var ic = 0;
    if (racers[c].nofocus) {
      cov = 1;
    } else {
      cov = 7;
    }
    for (var i = 0; i < track.n; i++) {
      if (track.typ[i] > 0) {
        ic++;
        if (track.typ[i] == 1) {
          if (racers[c].clear == ic + racers[c].nlaps * track.nsp) {
            cov = 1;
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
            cov = 1;
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
          cov <
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
          ) * cov;
      }
    }
    if (racers[c].clear == ic + racers[c].nlaps * track.nsp) {
      racers[c].nlaps++;
    }
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
        ic = racers[c].pcleared + 1;
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
    if (racers[c].nofocus) {
      racers[c].nofocus = false;
    }
    racers[c].point = pnt;
    if (game.mode != 1) {
      if (!car[c].fcnt) {
        for (var i = 0; i < pieces.fixCount; i++) {
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
              recording.repcar[c].fixat[recording.repcar[c].nfix] = 430;
              recording.repcar[c].nfix++;
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
              recording.repcar[c].fixat[recording.repcar[c].nfix] = 430;
              recording.repcar[c].nfix++;
              if (c == game.player) {
                playSound(29, 1);
              }
            }
          }
        }
      } else {
        raceEvents.onelec = true;
        carModels[car[c].typ].alpha = 1;
        if (car[c].fcnt % 2 == 0) {
          if (random.fx() > 0.333) {
            if (random.fx() > random.fx()) {
              carModels[car[c].typ].alpha = 3;
            } else {
              carModels[car[c].typ].alpha = 2;
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
              raceEvents.cntwis = 0;
            }
          }
          if (car[c].fcnt == 5) {
            fixcar(c);
          }
          car[c].fcnt--;
        }
      }
    }
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
                  racers[c].powerup > recording.hpowerup &&
                  recording.htyp <= 1 &&
                  (racers[c].powerup > 60 ||
                    track.stage == 1 ||
                    track.stage == 2)
                ) {
                  recording.rpdcatch = 43;
                  recording.hpowerup = racers[c].powerup;
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
          var flmat = 7,
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
            var out = 0;
            for (var i = 0; i < 4; i++) {
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
                car[c].y += carStats.flipy[cn];
                racers[c].pxy += 180;
                car[c].xy += 180;
                racers[c].capcnt = 0;
              }
            }
          }
        }
        if (racers[c].trcnt == 0 && racers[c].speed != 0) {
          var pfact = 1;
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
                carStats.powerloss[cn];
            } else {
              racers[c].power = 0;
            }
          } else {
            racers[c].xtpower--;
          }
        }
      }
    }
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
    if (c == game.player && recording.rpdcatch != 0 && recording.htyp <= 1) {
      recording.rpdcatch--;
      if (recording.rpdcatch == 0) {
        catchnow(1);
        if (recording.htyp == 1) {
          recording.hat = 265 + random.fx() * 30;
        }
      }
    }
    var xmt = [1, 0, 0];
    var ymt = [0, 1, 0];
    var zmt = [0, 0, 1];
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
}
function colide(c, xc) {
  var pyclos;
  var kx = [],
    ky = [],
    kz = [];
  var xkx = [],
    xky = [],
    xkz = [];
  for (var i = 0; i < 4; i++) {
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
  if (
    distanceSquared(
      car[c].x,
      car[xc].x,
      car[c].y,
      car[xc].y,
      car[c].z,
      car[xc].z,
    ) <
    (carModels[car[c].typ].colrad * carModels[car[c].typ].colrad +
      carModels[car[xc].typ].colrad * carModels[car[xc].typ].colrad) *
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
    var crad =
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
    var arad = 70;
    for (var i = 0; i < 4; i++) {
      var gotcol = false;
      for (var j = 0; j < 4; j++) {
        if (
          distanceSquared(kx[i], xkx[j], ky[i], xky[j], kz[i], xkz[j]) <
          (crad + arad) *
            (carStats.comprad[car[xc].typ] + carStats.comprad[car[c].typ])
        ) {
          if (
            Math.abs(racers[c].scx[i] * carStats.moment[car[c].typ]) >
            Math.abs(racers[xc].scx[j] * carStats.moment[car[xc].typ])
          ) {
            var tm = racers[xc].scx[j] * carStats.revpush[car[c].typ];
            if (tm > 30) {
              tm = 30;
            }
            if (tm < -30) {
              tm = -30;
            }
            var vctm = racers[c].scx[i] * carStats.push[car[c].typ];
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
            var tm = racers[xc].scz[j] * carStats.revpush[car[c].typ];
            if (tm > 30) {
              tm = 30;
            }
            if (tm < -30) {
              tm = -30;
            }
            var vctm = racers[c].scz[i] * carStats.push[car[c].typ];
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
        var intrsct = false;
        var aro = Math.abs(
          (xkx[1] - xkx[0]) * (xkz[2] - xkz[0]) -
            (xkx[2] - xkx[0]) * (xkz[1] - xkz[0]),
        );
        var ar1 = Math.abs(
          (xkx[0] - kx[i]) * (xkz[1] - kz[i]) -
            (xkx[1] - kx[i]) * (xkz[0] - kz[i]),
        );
        var ar2 = Math.abs(
          (xkx[1] - kx[i]) * (xkz[2] - kz[i]) -
            (xkx[2] - kx[i]) * (xkz[1] - kz[i]),
        );
        var ar3 = Math.abs(
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
          var j = 0;
          var closj = distanceSquared(
            kx[i],
            xkx[0],
            ky[i],
            xky[0],
            kz[i],
            xkz[0],
          );
          for (var k = 1; k < 4; k++) {
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
            var tm = racers[xc].scx[j] * carStats.revpush[car[c].typ];
            if (tm > 30) {
              tm = 30;
            }
            if (tm < -30) {
              tm = -30;
            }
            var vctm = racers[c].scx[i] * carStats.push[car[c].typ];
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
            var tm = racers[xc].scz[j] * carStats.revpush[car[c].typ];
            if (tm > 30) {
              tm = 30;
            }
            if (tm < -30) {
              tm = -30;
            }
            var vctm = racers[c].scz[i] * carStats.push[car[c].typ];
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
export function regn(nr, k, mag, c) {
  if (game.phase == PHASE.race) {
    mag *= carStats.dammult[car[c].typ];
  }
  if (Math.abs(mag) > 10) {
    if (game.phase == PHASE.race) {
      recording.repcar[c].regat[recording.repcar[c].nreg] = 430;
      recording.repcar[c].regnr[recording.repcar[c].nreg] = nr;
      recording.repcar[c].regk[recording.repcar[c].nreg] = k;
      recording.repcar[c].regmag[recording.repcar[c].nreg] = mag;
      recording.repcar[c].regmtch[recording.repcar[c].nreg] = racers[c].mtouch;
      recording.repcar[c].nreg++;
    }
    if (mag > 10) {
      mag -= 10;
    }
    if (mag < -10) {
      mag += 10;
    }
    var zsing = 0,
      xsing = 0;
    var nr2stop = false;
    if (nr == 2) {
      nr2stop = true;
      var rzy = car[c].zy,
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
    var rad = carModels[car[c].typ];
    if (!nr2stop) {
      if (rad.iscar == 1) {
        rad.dvert = [];
        for (var i = 0; i < rad.ni; i++) {
          rad.dvert[i * 3] = -rad.vrt[rad.tri[i * 3] * 3];
          rad.dvert[i * 3 + 1] = rad.vrt[rad.tri[i * 3] * 3 + 1];
          rad.dvert[i * 3 + 2] = rad.vrt[rad.tri[i * 3] * 3 + 2];
        }
        rad.iscar = 2;
      }
      var pixelread = false;
      var framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        rad.texture[1],
        0,
      );
      var pixels = null;
      if (
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE
      ) {
        pixels = new Uint8Array(256 * 256 * 4);
        gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        pixelread = true;
      }
      var tsq = 0,
        nsq = 0;
      for (var i = 0; i < rad.ni; i++) {
        var tmag = 0;
        var modpix = 0;
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
        if (
          nr == 3 &&
          (Math.abs(
            rad.dvert[i * 3 + 1] -
              carStats.flipy[car[c].typ] -
              racers[c].squash,
          ) <
            carStats.msquash[c][car[c].typ] * 3 ||
            rad.dvert[i * 3 + 1] >
              carStats.flipy[car[c].typ] + racers[c].squash) &&
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
          var pxc = Math.round(rad.tex[rad.tri[i * 3 + 2] * 2] * 256);
          var pyc = Math.round((1 - rad.tex[rad.tri[i * 3 + 2] * 2 + 1]) * 256);
          var cmag =
            Math.abs(tmag) *
            11 *
            carStats.dammult[car[c].typ] *
            carStats.colrdammult[car[c].typ];
          var npt = Math.round(cmag + random.fx() * cmag);
          for (var p = 0; p < npt; p++) {
            var pxv = Math.round(6 * random.fx() - 3);
            var pyv = Math.round(6 * random.fx() - 3);
            if (pxv == 0 && pyv == 0) {
              var ein = 1;
              if (random.fx() > random.fx()) {
                ein = -1;
              }
              if (random.fx() > random.fx()) {
                pxv += ein;
              } else {
                pyv += ein;
              }
            }
            var px = pxc + pxv;
            var py = pyc + pyv;
            var rnp = Math.round(20 + random.fx() * 100);
            var glass = false;
            var ongrey = false;
            if (modpix == 2) {
              glass = true;
            }
            while (rnp > 0 || glass) {
              var pp = px * 4 + py * 256 * 4;
              if (
                pixels[pp] == pixels[pp + 1] &&
                pixels[pp + 1] == pixels[pp + 2]
              ) {
                pixels[pp] += Math.round(random.fx() * 10 - 5);
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
                  pixels[pp] == scene.glassColor[0] &&
                  pixels[pp + 1] == scene.glassColor[1] &&
                  pixels[pp + 2] == scene.glassColor[2]
                ) {
                  if (!glass) {
                    if (random.fx() > 0.95) {
                      glass = true;
                    }
                    rnp = 0;
                  }
                  if (modpix == 2) {
                    if (random.fx() < 0.5) {
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
                    var av = (Math.abs(pxv) + Math.abs(pyv)) / 2 + 1;
                    if (av < 2) {
                      av = 2;
                    }
                    pixels[pp] = (65 + pixels[pp] * av) / (1 + av);
                    pixels[pp + 1] = (57 + pixels[pp + 1] * av) / (1 + av);
                    pixels[pp + 2] = (55 + pixels[pp + 2] * av) / (1 + av);
                    car[c].ctxl[0] = px / 256;
                    car[c].ctxl[1] = py / 256;
                    if (random.fx() > 0.8) {
                      if (Math.abs(pxv) < Math.abs(pyv)) {
                        pxv += Math.round(random.fx() * 2 - 1);
                      } else {
                        pyv += Math.round(random.fx() * 2 - 1);
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
        }
      }
      if (nr == 3 && nsq > 0) {
        racers[c].squash += tsq / nsq;
      }
      if (pixelread) {
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
      }
      gl.deleteFramebuffer(framebuffer);
      rad.loaded = 0;
      gl.deleteBuffer(rad.vbuf);
      rad.vbuf = null;
      rad.vbuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, rad.vbuf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(rad.dvert),
        gl.STATIC_DRAW,
      );
      rad.loaded = 2;
    }
  }
}
export function fixcar(c) {
  var rad = carModels[car[c].typ];
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
  gl.deleteTexture(rad.texture[1]);
  rad.texture[1] = null;
  rad.texture[1] = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, rad.texture[1]);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    carTextures[car[c].typ],
  );
  gl.generateMipmap(gl.TEXTURE_2D);
  var framebuffer = gl.createFramebuffer();
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
    for (var p = 0; p < 256 * 256 * 4; p += 4) {
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
  }
  gl.deleteFramebuffer(framebuffer);
  rad.loaded = 2;
}
