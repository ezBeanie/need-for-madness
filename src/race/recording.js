import { resumeStageMusic } from "../audio/audio.js";
import { rotateAxes } from "../core/math.js";
import { random } from "../core/random.js";
import { PHASE, game } from "../core/state.js";
import { tick } from "../core/tick.js";
import { CAMERA, camera } from "../render/camera.js";
import { resetPursuit } from "./ai.js";
import { burn, chipburn, dustup, firexp, sprks } from "./effects.js";
import { raceEvents } from "./events.js";
import { fixcar, regn } from "./physics.js";
import { car, racers } from "./racers.js";
import { track } from "./track.js";

// What is recorded of a race for the instant replay, the highlight replay and winding
// back time: the last ticks of every car, the sparks, and which highlight to show.
// Fields keep their original names for now.
// The highlight shown after a race (recording.highlight); a close finish is 4 plus the
// player's position.
export const HIGHLIGHT = {
  none: 0,
  stunt: 1,
  wasted: 2,
  wastedThemAll: 3,
  closeWin: 4,
  closeLoss: 5,
};

export const recording = {
  repcar: null,
  hrepcar: null,
  repsprks: null,
  hrepsprks: null,
  reponcheckpoint: [],
  reponlastcheck: [],
  hreponcheckpoint: [],
  hreponlastcheck: [],
  // the ticks recorded so far (up to 430)
  recordedTicks: 0,
  // the replayed tick (0..429)
  frame: 0,
  highlight: HIGHLIGHT.none,
  // the replayed tick the highlight peaks at
  highlightAt: 0,
  // the car the highlight shows, and the one it turns to (caught or beaten)
  otherCar: 0,
  highlightCar: 0,
  hpowerup: 0,
  rpdcatch: 0,
  catchfin: 0,
  // the highlight replay holds still on a frame
  onpausefr: false,
  // how long the highlight holds still at its peak (its flashes follow it), and how long
  // it has so far
  holdTicks: 0,
  held: 0,
};

export function catchnow(hty) {
  if (recording.recordedTicks >= 430) {
    for (var c = 0; c < game.carCount; c++) {
      for (var i = 0; i < 430; i++) {
        recording.hrepcar[c].x[i] = recording.repcar[c].x[i];
        recording.hrepcar[c].y[i] = recording.repcar[c].y[i];
        recording.hrepcar[c].z[i] = recording.repcar[c].z[i];
        recording.hrepcar[c].xy[i] = recording.repcar[c].xy[i];
        recording.hrepcar[c].xz[i] = recording.repcar[c].xz[i];
        recording.hrepcar[c].zy[i] = recording.repcar[c].zy[i];
        recording.hrepcar[c].wzy[i] = recording.repcar[c].wzy[i];
        recording.hrepcar[c].wxz[i] = recording.repcar[c].wxz[i];
        recording.hrepcar[c].avnx[i] = recording.repcar[c].avnx[i];
        recording.hrepcar[c].avny[i] = recording.repcar[c].avny[i];
        recording.hrepcar[c].avnz[i] = recording.repcar[c].avnz[i];
        recording.hrepcar[c].nreg = recording.repcar[c].nreg;
        recording.hrepcar[c].nfix = recording.repcar[c].nfix;
        recording.hrepcar[c].ndst = recording.repcar[c].ndst;
        recording.hrepcar[c].destat = recording.repcar[c].destat;
      }
      for (var i = 0; i < recording.hrepcar[c].nreg; i++) {
        recording.hrepcar[c].regat[i] = recording.repcar[c].regat[i];
        recording.hrepcar[c].regmtch[i] = recording.repcar[c].regmtch[i];
        recording.hrepcar[c].regnr[i] = recording.repcar[c].regnr[i];
        recording.hrepcar[c].regk[i] = recording.repcar[c].regk[i];
        recording.hrepcar[c].regmag[i] = recording.repcar[c].regmag[i];
      }
      for (var i = 0; i < recording.hrepcar[c].nfix; i++) {
        recording.hrepcar[c].fixat[i] = recording.repcar[c].fixat[i];
      }
      for (var i = 0; i < recording.hrepcar[c].ndst; i++) {
        recording.hrepcar[c].dstat[i] = recording.repcar[c].dstat[i];
        recording.hrepcar[c].tskd[i] = recording.repcar[c].tskd[i];
        recording.hrepcar[c].mst[i] = recording.repcar[c].mst[i];
        recording.hrepcar[c].dx[i] = recording.repcar[c].dx[i];
        recording.hrepcar[c].dy[i] = recording.repcar[c].dy[i];
        recording.hrepcar[c].dz[i] = recording.repcar[c].dz[i];
        recording.hrepcar[c].sx[i] = recording.repcar[c].sx[i];
        recording.hrepcar[c].sz[i] = recording.repcar[c].sz[i];
        recording.hrepcar[c].smag[i] = recording.repcar[c].smag[i];
        recording.hrepcar[c].tlt[i] = recording.repcar[c].tlt[i];
        recording.hrepcar[c].capsz[i] = recording.repcar[c].capsz[i];
      }
    }
    recording.hrepsprks.n = recording.repsprks.n;
    for (var i = 0; i < recording.hrepsprks.n; i++) {
      recording.hrepsprks.sprkat[i] = recording.repsprks.sprkat[i];
      recording.hrepsprks.cn[i] = recording.repsprks.cn[i];
      recording.hrepsprks.x[i] = recording.repsprks.x[i];
      recording.hrepsprks.y[i] = recording.repsprks.y[i];
      recording.hrepsprks.z[i] = recording.repsprks.z[i];
      recording.hrepsprks.sx[i] = recording.repsprks.sx[i];
      recording.hrepsprks.sy[i] = recording.repsprks.sy[i];
      recording.hrepsprks.sz[i] = recording.repsprks.sz[i];
      recording.hrepsprks.cap[i] = recording.repsprks.cap[i];
    }
    for (var i = 0; i < 430; i++) {
      recording.hreponcheckpoint[i] = recording.reponcheckpoint[i];
      recording.hreponlastcheck[i] = recording.reponlastcheck[i];
    }
    recording.highlight = hty;
    recording.highlightCar = game.player;
  } else {
    recording.hpowerup = 0;
  }
}

function newrepcar() {
  return {
    x: [],
    y: [],
    z: [],
    xy: [],
    xz: [],
    zy: [],
    wzy: [],
    wxz: [],
    avnx: [],
    avny: [],
    avnz: [],
    cxz: [],
    hitmag: [],
    clear: [],
    pcleared: [],
    nlaps: [],
    nreg: 0,
    regat: [],
    regnr: [],
    regk: [],
    regmag: [],
    regmtch: [],
    nfix: 0,
    fixat: [],
    destat: 700,
    destedbyzero: 0,
    ndst: 0,
    dstat: [],
    tskd: [],
    mst: [],
    dx: [],
    dy: [],
    dz: [],
    sx: [],
    sz: [],
    smag: [],
    tlt: [],
    capsz: [],
  };
}
function newrepsprks() {
  return {
    n: 0,
    sprkat: [],
    cn: [],
    x: [],
    y: [],
    z: [],
    sx: [],
    sy: [],
    sz: [],
    cap: [],
  };
}
export function inishrecord() {
  if (recording.repcar != null) {
    recording.repcar = null;
  }
  if (recording.hrepcar != null) {
    recording.hrepcar = null;
  }
  recording.repcar = [];
  recording.hrepcar = [];
  for (var c = 0; c < game.carCount; c++) {
    recording.repcar[c] = newrepcar();
    for (var i = 0; i < 430; i++) {
      recording.repcar[c].x[i] = 0;
      recording.repcar[c].y[i] = 0;
      recording.repcar[c].z[i] = 0;
      recording.repcar[c].xy[i] = 0;
      recording.repcar[c].xz[i] = 0;
      recording.repcar[c].zy[i] = 0;
      recording.repcar[c].wzy[i] = 0;
      recording.repcar[c].wxz[i] = 0;
      recording.repcar[c].avnx[i] = 0;
      recording.repcar[c].avny[i] = 0;
      recording.repcar[c].avnz[i] = 0;
      recording.repcar[c].cxz[i] = 0;
      recording.repcar[c].hitmag[i] = 0;
      recording.repcar[c].clear[i] = 0;
      recording.repcar[c].pcleared[i] = 0;
      recording.repcar[c].nlaps[i] = 0;
    }
    recording.hrepcar[c] = newrepcar();
    for (var i = 0; i < 430; i++) {
      recording.hrepcar[c].x[i] = 0;
      recording.hrepcar[c].y[i] = 0;
      recording.hrepcar[c].z[i] = 0;
      recording.hrepcar[c].xy[i] = 0;
      recording.hrepcar[c].xz[i] = 0;
      recording.hrepcar[c].zy[i] = 0;
      recording.hrepcar[c].wzy[i] = 0;
      recording.hrepcar[c].wxz[i] = 0;
      recording.hrepcar[c].avnx[i] = 0;
      recording.hrepcar[c].avny[i] = 0;
      recording.hrepcar[c].avnz[i] = 0;
    }
  }
  if (recording.repsprks != null) {
    recording.repsprks = null;
  }
  if (recording.hrepsprks != null) {
    recording.hrepsprks = null;
  }
  recording.repsprks = newrepsprks();
  recording.hrepsprks = newrepsprks();
  for (var i = 0; i < 430; i++) {
    recording.reponcheckpoint[i] = 0;
    recording.reponlastcheck[i] = 0;
  }
  recording.recordedTicks = 0;
  recording.highlight = HIGHLIGHT.none;
  recording.hpowerup = 0;
  recording.highlightAt = 0;
  recording.otherCar = 0;
  recording.highlightCar = 0;
  recording.catchfin = 0;
}
export function record() {
  if (raceEvents.raceOverTicks < 100) {
    for (var c = 0; c < game.carCount; c++) {
      for (var i = 0; i < 429; i++) {
        recording.repcar[c].x[i] = recording.repcar[c].x[i + 1];
        recording.repcar[c].y[i] = recording.repcar[c].y[i + 1];
        recording.repcar[c].z[i] = recording.repcar[c].z[i + 1];
        recording.repcar[c].xy[i] = recording.repcar[c].xy[i + 1];
        recording.repcar[c].xz[i] = recording.repcar[c].xz[i + 1];
        recording.repcar[c].zy[i] = recording.repcar[c].zy[i + 1];
        recording.repcar[c].wzy[i] = recording.repcar[c].wzy[i + 1];
        recording.repcar[c].wxz[i] = recording.repcar[c].wxz[i + 1];
        recording.repcar[c].avnx[i] = recording.repcar[c].avnx[i + 1];
        recording.repcar[c].avny[i] = recording.repcar[c].avny[i + 1];
        recording.repcar[c].avnz[i] = recording.repcar[c].avnz[i + 1];
        recording.repcar[c].cxz[i] = recording.repcar[c].cxz[i + 1];
        recording.repcar[c].hitmag[i] = recording.repcar[c].hitmag[i + 1];
        recording.repcar[c].clear[i] = recording.repcar[c].clear[i + 1];
        recording.repcar[c].pcleared[i] = recording.repcar[c].pcleared[i + 1];
        recording.repcar[c].nlaps[i] = recording.repcar[c].nlaps[i + 1];
      }
      recording.repcar[c].x[429] = car[c].x;
      recording.repcar[c].y[429] = car[c].y;
      recording.repcar[c].z[429] = car[c].z;
      recording.repcar[c].xy[429] = car[c].xy;
      recording.repcar[c].xz[429] = car[c].xz;
      recording.repcar[c].zy[429] = car[c].zy;
      recording.repcar[c].wzy[429] = car[c].wzy;
      recording.repcar[c].wxz[429] = car[c].wxz;
      recording.repcar[c].avnx[429] =
        (racers[c].scx[0] +
          racers[c].scx[1] +
          racers[c].scx[2] +
          racers[c].scx[3]) /
        4;
      recording.repcar[c].avny[429] =
        (racers[c].scy[0] +
          racers[c].scy[1] +
          racers[c].scy[2] +
          racers[c].scy[3]) /
        4;
      recording.repcar[c].avnz[429] =
        (racers[c].scz[0] +
          racers[c].scz[1] +
          racers[c].scz[2] +
          racers[c].scz[3]) /
        4;
      recording.repcar[c].cxz[429] = racers[c].cxz;
      recording.repcar[c].hitmag[429] = racers[c].hitmag;
      recording.repcar[c].clear[429] = racers[c].clear;
      recording.repcar[c].pcleared[429] = racers[c].pcleared;
      recording.repcar[c].nlaps[429] = racers[c].nlaps;
      for (var i = 0; i < recording.repcar[c].nreg; i++) {
        recording.repcar[c].regat[i]--;
      }
      for (var i = 0; i < recording.repcar[c].nfix; i++) {
        recording.repcar[c].fixat[i]--;
      }
      for (var i = 0; i < recording.repcar[c].ndst; i++) {
        recording.repcar[c].dstat[i]--;
      }
      if (recording.repcar[c].destat != 700) {
        recording.repcar[c].destat--;
        if (recording.repcar[c].destat == 328) {
          if (c == game.player) {
            catchnow(2);
            if (recording.highlight == HIGHLIGHT.wasted) {
              recording.highlightAt = 327;
            }
          } else {
            if (recording.repcar[c].destedbyzero) {
              catchnow(3);
              if (recording.highlight == HIGHLIGHT.wastedThemAll) {
                recording.highlightAt = Math.floor(
                  (160 + recording.repcar[c].destedbyzero) * 1.42,
                );
                recording.otherCar = c;
              }
            }
          }
        }
      }
    }
    for (var i = 0; i < recording.repsprks.n; i++) {
      recording.repsprks.sprkat[i]--;
    }
    for (var i = 0; i < 430; i++) {
      recording.reponcheckpoint[i] = recording.reponcheckpoint[i + 1];
      recording.reponlastcheck[i] = recording.reponlastcheck[i + 1];
    }
    recording.reponcheckpoint[429] = raceEvents.oncheckpoint;
    recording.reponlastcheck[429] = raceEvents.onlastcheck;
    if (recording.recordedTicks < 430) {
      recording.recordedTicks++;
    }
  }
}
export function rewindreplay() {
  game.phase = PHASE.replayRewind;
  recording.frame = 0;
  camera.mode = CAMERA.orbit;
  camera.target = game.player;
  for (var c = 0; c < game.carCount; c++) {
    racers[c].destnow = false;
    racers[c].cntdest = 0;
    racers[c].embos = 0;
    racers[c].embodir = 0;
    racers[c].squash = 0;
    racers[c].nbsq = 0;
    car[c].fcnt = 0;
    fixcar(c);
    racers[c].body.alpha = 1;
    if (recording.repcar[c].destat < 0) {
      racers[c].destnow = true;
      racers[c].cntdest = 7;
    }
    var foundnegfix = 0;
    for (var i = recording.repcar[c].nfix - 1; i >= 0; i--) {
      if (recording.repcar[c].fixat[i] < 0 && foundnegfix == 0) {
        foundnegfix = recording.repcar[c].fixat[i];
        break;
      }
    }
    for (var i = 0; i < recording.repcar[c].nreg; i++) {
      if (recording.repcar[c].regat[i] < 0) {
        var frget = false;
        if (foundnegfix) {
          if (recording.repcar[c].regat[i] < foundnegfix) {
            frget = true;
          }
        }
        if (!frget) {
          racers[c].mtouch = recording.repcar[c].regmtch[i];
          regn(
            recording.repcar[c].regnr[i],
            recording.repcar[c].regk[i],
            recording.repcar[c].regmag[i],
            c,
          );
        }
      }
    }
  }
  game.phase = PHASE.replay;
}
export function replay() {
  for (var c = 0; c < game.carCount; c++) {
    if (recording.repcar[c].destat == recording.frame) {
      racers[c].destnow = true;
    }
    if (racers[c].destnow) {
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
          recording.repcar[c].avnx[recording.frame],
          recording.repcar[c].avny[recording.frame],
          recording.repcar[c].avnz[recording.frame],
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
    }
    if (!car[c].fcnt) {
      for (var i = 0; i < recording.repcar[c].nfix; i++) {
        if (recording.repcar[c].fixat[i] == recording.frame) {
          car[c].fcnt = 20;
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
        }
        if (car[c].fcnt == 5) {
          fixcar(c);
        }
        car[c].fcnt--;
      }
    }
    for (var i = 0; i < recording.repcar[c].nreg; i++) {
      if (recording.repcar[c].regat[i] == recording.frame) {
        racers[c].mtouch = recording.repcar[c].regmtch[i];
        regn(
          recording.repcar[c].regnr[i],
          recording.repcar[c].regk[i],
          recording.repcar[c].regmag[i],
          c,
        );
      }
    }
    for (var i = 0; i < recording.repcar[c].ndst; i++) {
      if (recording.repcar[c].dstat[i] == recording.frame) {
        dustup(
          recording.repcar[c].tskd[i],
          c,
          recording.repcar[c].mst[i],
          recording.repcar[c].dx[i],
          recording.repcar[c].dy[i],
          recording.repcar[c].dz[i],
          recording.repcar[c].sx[i],
          recording.repcar[c].sz[i],
          recording.repcar[c].smag[i],
          recording.repcar[c].tlt[i],
          recording.repcar[c].capsz[i],
        );
      }
    }
    car[c].x = recording.repcar[c].x[recording.frame];
    car[c].y = recording.repcar[c].y[recording.frame];
    car[c].z = recording.repcar[c].z[recording.frame];
    car[c].xy = recording.repcar[c].xy[recording.frame];
    car[c].xz = recording.repcar[c].xz[recording.frame];
    car[c].zy = recording.repcar[c].zy[recording.frame];
    car[c].wzy = recording.repcar[c].wzy[recording.frame];
    car[c].wxz = recording.repcar[c].wxz[recording.frame];
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
  for (var i = 0; i < recording.repsprks.n; i++) {
    if (recording.repsprks.sprkat[i] == recording.frame) {
      sprks(
        recording.repsprks.cn[i],
        recording.repsprks.x[i],
        recording.repsprks.y[i],
        recording.repsprks.z[i],
        recording.repsprks.sx[i],
        recording.repsprks.sy[i],
        recording.repsprks.sz[i],
        recording.repsprks.cap[i],
      );
    }
  }
  raceEvents.oncheckpoint = recording.reponcheckpoint[recording.frame];
  raceEvents.onlastcheck = recording.reponlastcheck[recording.frame];
  if (recording.frame == 429) {
    game.phase = PHASE.paused;
    camera.mode = CAMERA.behind;
    camera.target = game.player;
    recording.frame = 0;
  } else {
    recording.frame++;
  }
}
export function fastforwardexit() {
  game.phase = PHASE.replayRewind;
  for (var c = 0; c < game.carCount; c++) {
    if (
      recording.repcar[c].destat != 700 &&
      recording.repcar[c].destat >= recording.frame
    ) {
      racers[c].embos = 0;
      racers[c].cntdest = 7;
    }
    var foundnegfix = 0;
    for (var i = recording.repcar[c].nfix - 1; i >= 0; i--) {
      if (recording.repcar[c].fixat[i] >= recording.frame && foundnegfix == 0) {
        foundnegfix = recording.repcar[c].fixat[i];
        break;
      }
    }
    if (foundnegfix) {
      racers[c].squash = 0;
      racers[c].nbsq = 0;
      car[c].fcnt = 0;
      fixcar(c);
    }
    for (var i = 0; i < recording.repcar[c].nreg; i++) {
      if (recording.repcar[c].regat[i] >= recording.frame) {
        var frget = false;
        if (foundnegfix) {
          if (recording.repcar[c].regat[i] < foundnegfix) {
            frget = true;
          }
        }
        if (!frget) {
          racers[c].mtouch = recording.repcar[c].regmtch[i];
          regn(
            recording.repcar[c].regnr[i],
            recording.repcar[c].regk[i],
            recording.repcar[c].regmag[i],
            c,
          );
        }
      }
    }
    car[c].x = recording.repcar[c].x[429];
    car[c].y = recording.repcar[c].y[429];
    car[c].z = recording.repcar[c].z[429];
    car[c].xy = recording.repcar[c].xy[429];
    car[c].xz = recording.repcar[c].xz[429];
    car[c].zy = recording.repcar[c].zy[429];
    car[c].wzy = recording.repcar[c].wzy[429];
    car[c].wxz = recording.repcar[c].wxz[429];
  }
  camera.mode = CAMERA.behind;
  camera.target = game.player;
  game.phase = PHASE.paused;
}
export function hrewindhreplay() {
  game.phase = PHASE.replayRewind;
  recording.frame = 0;
  for (var c = 0; c < game.carCount; c++) {
    racers[c].destnow = false;
    racers[c].cntdest = 0;
    racers[c].embos = 0;
    racers[c].embodir = 0;
    racers[c].squash = 0;
    racers[c].nbsq = 0;
    car[c].fcnt = 0;
    fixcar(c);
    racers[c].body.alpha = 1;
    if (recording.hrepcar[c].destat < 0) {
      racers[c].destnow = true;
      racers[c].cntdest = 7;
    }
    var foundnegfix = 0;
    for (var i = recording.hrepcar[c].nfix - 1; i >= 0; i--) {
      if (recording.hrepcar[c].fixat[i] < 0 && foundnegfix == 0) {
        foundnegfix = recording.hrepcar[c].fixat[i];
        break;
      }
    }
    for (var i = 0; i < recording.hrepcar[c].nreg; i++) {
      if (recording.hrepcar[c].regat[i] < 0) {
        var frget = false;
        if (foundnegfix) {
          if (recording.hrepcar[c].regat[i] < foundnegfix) {
            frget = true;
          }
        }
        if (!frget) {
          racers[c].mtouch = recording.hrepcar[c].regmtch[i];
          regn(
            recording.hrepcar[c].regnr[i],
            recording.hrepcar[c].regk[i],
            recording.hrepcar[c].regmag[i],
            c,
          );
        }
      }
    }
  }
  recording.held = 0;
  recording.holdTicks = 0;
  if (recording.highlight == HIGHLIGHT.stunt) {
    if (random.fx() > random.fx()) {
      recording.holdTicks = 98;
    } else {
      recording.holdTicks = 43;
    }
  }
  if (recording.highlight == HIGHLIGHT.wasted) {
    recording.holdTicks = 95;
    camera.orbitAngle += 90;
  }
  game.phase = PHASE.highlights;
}
export function hreplay() {
  for (var c = 0; c < game.carCount; c++) {
    if (recording.hrepcar[c].destat == recording.frame) {
      racers[c].destnow = true;
    }
    if (racers[c].destnow) {
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
          if (!recording.onpausefr) {
            racers[c].cntdest++;
          }
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
          recording.hrepcar[c].avnx[recording.frame],
          recording.hrepcar[c].avny[recording.frame],
          recording.hrepcar[c].avnz[recording.frame],
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
    }
    if (!car[c].fcnt) {
      for (var i = 0; i < recording.hrepcar[c].nfix; i++) {
        if (recording.hrepcar[c].fixat[i] == recording.frame) {
          car[c].fcnt = 20;
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
        }
        if (car[c].fcnt == 5) {
          fixcar(c);
        }
        car[c].fcnt--;
      }
    }
    if (!recording.onpausefr) {
      for (var i = 0; i < recording.hrepcar[c].nreg; i++) {
        if (recording.hrepcar[c].regat[i] == recording.frame) {
          racers[c].mtouch = recording.hrepcar[c].regmtch[i];
          regn(
            recording.hrepcar[c].regnr[i],
            recording.hrepcar[c].regk[i],
            recording.hrepcar[c].regmag[i],
            c,
          );
        }
      }
    }
    for (var i = 0; i < recording.hrepcar[c].ndst; i++) {
      if (recording.hrepcar[c].dstat[i] == recording.frame) {
        dustup(
          recording.hrepcar[c].tskd[i],
          c,
          recording.hrepcar[c].mst[i],
          recording.hrepcar[c].dx[i],
          recording.hrepcar[c].dy[i],
          recording.hrepcar[c].dz[i],
          recording.hrepcar[c].sx[i],
          recording.hrepcar[c].sz[i],
          recording.hrepcar[c].smag[i],
          recording.hrepcar[c].tlt[i],
          recording.hrepcar[c].capsz[i],
        );
      }
    }
    car[c].x = recording.hrepcar[c].x[recording.frame];
    car[c].y = recording.hrepcar[c].y[recording.frame];
    car[c].z = recording.hrepcar[c].z[recording.frame];
    car[c].xy = recording.hrepcar[c].xy[recording.frame];
    car[c].xz = recording.hrepcar[c].xz[recording.frame];
    car[c].zy = recording.hrepcar[c].zy[recording.frame];
    car[c].wzy = recording.hrepcar[c].wzy[recording.frame];
    car[c].wxz = recording.hrepcar[c].wxz[recording.frame];
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
  for (var i = 0; i < recording.hrepsprks.n; i++) {
    if (recording.hrepsprks.sprkat[i] == recording.frame) {
      sprks(
        recording.hrepsprks.cn[i],
        recording.hrepsprks.x[i],
        recording.hrepsprks.y[i],
        recording.hrepsprks.z[i],
        recording.hrepsprks.sx[i],
        recording.hrepsprks.sy[i],
        recording.hrepsprks.sz[i],
        recording.hrepsprks.cap[i],
      );
    }
  }
  raceEvents.oncheckpoint = recording.hreponcheckpoint[recording.frame];
  raceEvents.onlastcheck = recording.hreponlastcheck[recording.frame];
}
export function preprevtime() {
  recording.frame = 429;
  camera.mode = CAMERA.behind;
  camera.target = game.player;
  game.phase = PHASE.replayRewind;
  for (var c = 0; c < game.carCount; c++) {
    racers[c].destnow = false;
    racers[c].cntdest = 0;
    racers[c].embos = 0;
    racers[c].embodir = 0;
    racers[c].squash = 0;
    racers[c].nbsq = 0;
    car[c].fcnt = 0;
    fixcar(c);
    racers[c].body.alpha = 1;
    if (recording.repcar[c].destat < 0) {
      for (var i = 0; i < 16; i++) {
        burn(c);
      }
    }
    var foundnegfix = 0;
    for (var i = recording.repcar[c].nfix - 1; i >= 0; i--) {
      if (recording.repcar[c].fixat[i] < 0 && foundnegfix == 0) {
        foundnegfix = recording.repcar[c].fixat[i];
        break;
      }
    }
    for (var i = 0; i < recording.repcar[c].nreg; i++) {
      if (recording.repcar[c].regat[i] < 0) {
        var frget = false;
        if (foundnegfix) {
          if (recording.repcar[c].regat[i] < foundnegfix) {
            frget = true;
          }
        }
        if (!frget) {
          racers[c].mtouch = recording.repcar[c].regmtch[i];
          regn(
            recording.repcar[c].regnr[i],
            recording.repcar[c].regk[i],
            recording.repcar[c].regmag[i],
            c,
          );
        }
      }
    }
  }
  resumeStageMusic();
  raceEvents.screenTicks = 0;
  game.phase = PHASE.timeRewind;
}
export function revtime() {
  for (var c = 0; c < game.carCount; c++) {
    if (recording.frame > recording.repcar[c].destat) {
      firexp(
        c,
        recording.repcar[c].avnx[recording.frame],
        recording.repcar[c].avny[recording.frame],
        recording.repcar[c].avnz[recording.frame],
      );
    }
    if (!car[c].fcnt) {
      for (var i = 0; i < recording.repcar[c].nfix; i++) {
        if (
          recording.frame == recording.repcar[c].fixat[i] + 28 ||
          recording.frame == recording.repcar[c].fixat[i] + 27
        ) {
          car[c].fcnt = 20;
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
      if (
        Math.abs(recording.frame - (429 - recording.recordedTicks)) > 100 &&
        car[c].fcnt != 2
      ) {
        if (tick.fraction >= tick.scale) {
          car[c].fcnt -= 2;
        }
      } else {
        if (tick.fraction >= tick.scale) {
          car[c].fcnt--;
        }
      }
      if (car[c].fcnt < 0) {
        car[c].fcnt = 0;
      }
    }
    car[c].x = recording.repcar[c].x[recording.frame];
    car[c].y = recording.repcar[c].y[recording.frame];
    car[c].z = recording.repcar[c].z[recording.frame];
    car[c].xy = recording.repcar[c].xy[recording.frame];
    car[c].xz = recording.repcar[c].xz[recording.frame];
    car[c].zy = recording.repcar[c].zy[recording.frame];
    car[c].wzy = recording.repcar[c].wzy[recording.frame];
    car[c].wxz = recording.repcar[c].wxz[recording.frame];
    racers[c].pxy = car[c].xy;
    racers[c].pzy = car[c].zy;
    for (var k = 0; k < 4; k++) {
      racers[c].scx[k] = recording.repcar[c].avnx[recording.frame];
      racers[c].scy[k] = recording.repcar[c].avny[recording.frame];
      racers[c].scz[k] = recording.repcar[c].avnz[recording.frame];
    }
    racers[c].hitmag = recording.repcar[c].hitmag[recording.frame];
    racers[c].clear = recording.repcar[c].clear[recording.frame];
    racers[c].pcleared = recording.repcar[c].pcleared[recording.frame];
    racers[c].nlaps = recording.repcar[c].nlaps[recording.frame];
    racers[c].cxz = recording.repcar[c].cxz[recording.frame];
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
  }
  raceEvents.oncheckpoint = recording.reponcheckpoint[recording.frame];
  raceEvents.onlastcheck = recording.reponlastcheck[recording.frame];
  if (Math.abs(recording.frame - (429 - recording.recordedTicks)) > 100) {
    recording.frame -= 2;
  } else {
    recording.frame--;
  }
  if (recording.frame <= 429 - recording.recordedTicks) {
    for (var c = 0; c < game.carCount; c++) {
      resetPursuit(c);
      racers[c].focus = -1;
      racers[c].missedcp = 0;
      racers[c].nofocus = false;
      racers[c].body.alpha = 1;
      if (recording.repcar[c].destat > 0) {
        racers[c].dest = false;
        recording.repcar[c].destat = 700;
      }
    }
    raceEvents.playerWreckTicks = 0;
    raceEvents.checkpointsAnnounced = racers[game.player].clear;
    raceEvents.messageTicks = 30;
    raceEvents.stuntTicks = 45;
    track.haltall = false;
    game.phase = PHASE.race;
    recording.recordedTicks = 0;
    recording.frame = 0;
  }
}
