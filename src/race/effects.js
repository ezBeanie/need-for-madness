// The flying particles of a race: sparks, chips broken off cars, dust and explosions.

import { cosDeg, distance, sinDeg } from "../core/math.js";
import { random } from "../core/random.js";
import { PHASE, game } from "../core/state.js";
import { tick } from "../core/tick.js";
import { carStats } from "../data/carStats.js";
import { camera } from "../render/camera.js";
import { resetMatrix } from "../render/interpolation.js";
import { newModel } from "../render/models.js";
import { gl } from "../render/renderer.js";
import { car, racers } from "./racers.js";
import { recording } from "./recording.js";

// Each list is used up to its count; the lists keep their entries for reuse.
// Fields keep their original names for now.
export const effects = {
  sprk: [],
  nspr: 0,
  chip: [],
  nchp: 0,
  dust: [],
  ndst: 0,
  dwer: [],
  exp: [],
  nexp: 0,
  ewer: [],
};

export function chipaway(c, x, y, z, ctmag) {
  if (racers[c].carnchp < 120 && !recording.onpausefr) {
    var ui = -1;
    for (var i = 0; i < effects.nchp; i++) {
      if (effects.chip[i].loaded == 0) {
        ui = i;
        break;
      }
    }
    if (ui == -1) {
      ui = effects.nchp;
      effects.nchp++;
      racers[c].carnchp++;
    }
    if (ctmag > 0.4) {
      ctmag = 0.3;
    }
    if (ctmag < -0.4) {
      ctmag = -0.3;
    }
    effects.chip[ui] = newModel();
    effects.chip[i].rx =
      x * car[c].mat[0] + y * car[c].mat[4] + z * car[c].mat[8];
    effects.chip[i].ry =
      x * car[c].mat[1] + y * car[c].mat[5] + z * car[c].mat[9];
    effects.chip[i].rz =
      x * car[c].mat[2] + y * car[c].mat[6] + z * car[c].mat[10];
    effects.chip[i].cn = c;
    effects.chip[ui].vx = ctmag * (30 - random.fx() * 60);
    effects.chip[ui].vy = ctmag * (30 - random.fx() * 60);
    effects.chip[ui].vz = ctmag * (30 - random.fx() * 60);
    effects.chip[ui].rtn1 = Math.floor(random.fx() * 5);
    if (effects.chip[ui].rtn1 < 3) {
      effects.chip[ui].rtn1mag = random.fx() * 60;
    }
    effects.chip[ui].rtn2 = Math.floor(random.fx() * 5);
    if (effects.chip[ui].rtn2 < 3) {
      effects.chip[ui].rtn2mag = random.fx() * 60;
    }
    var ox = [];
    ox[0] = 0;
    var avox = 0;
    for (var i = 1; i < 3; i++) {
      ox[i] = ox[0] + ctmag * (10 - random.fx() * 20);
      avox += ox[i];
    }
    avox = avox / 2;
    for (var i = 0; i < 3; i++) {
      ox[i] -= (avox / 2) * (1 - random.fx() * random.fx());
    }
    var oy = [];
    oy[0] = 0;
    var avoy = 0;
    for (var i = 1; i < 3; i++) {
      oy[i] = oy[0] + ctmag * (10 - random.fx() * 20);
      avoy += oy[i];
    }
    avoy = avoy / 2;
    for (var i = 0; i < 3; i++) {
      oy[i] -= (avoy / 2) * (1 - random.fx() * random.fx());
    }
    var oz = [];
    oz[0] = 0;
    var avoz = 0;
    for (var i = 1; i < 3; i++) {
      oz[i] = oz[0] + ctmag * (10 - random.fx() * 20);
      avoz += oz[i];
    }
    avoz = avoz / 2;
    for (var i = 0; i < 3; i++) {
      oz[i] -= (avoz / 2) * (1 - random.fx() * random.fx());
    }
    var rmx =
      (oy[1] - oy[0]) * (oz[2] - oz[0]) - (oz[1] - oz[0]) * (oy[2] - oy[0]);
    var rmy =
      (oz[1] - oz[0]) * (ox[2] - ox[0]) - (ox[1] - ox[0]) * (oz[2] - oz[0]);
    var rmz =
      (ox[1] - ox[0]) * (oy[2] - oy[0]) - (oy[1] - oy[0]) * (ox[2] - ox[0]);
    var normx = rmx / Math.sqrt(rmx * rmx + rmy * rmy + rmz * rmz);
    var normy = rmy / Math.sqrt(rmx * rmx + rmy * rmy + rmz * rmz);
    var normz = rmz / Math.sqrt(rmx * rmx + rmy * rmy + rmz * rmz);
    var indice = [];
    var vert = [];
    var norm = [];
    var texu = [];
    for (var i = 0; i < 3; i++) {
      indice[i] = i;
      vert[i * 3] = ox[i];
      vert[i * 3 + 1] = oy[i];
      vert[i * 3 + 2] = oz[i];
      norm[i * 3] = normx;
      norm[i * 3 + 1] = normy;
      norm[i * 3 + 2] = normz;
      texu[i * 2] = car[c].ctxl[0];
      texu[i * 2 + 1] = car[c].ctxl[1];
    }
    effects.chip[ui].ni = 3;
    effects.chip[ui].nt = 1;
    var roni = random.fx();
    if (roni > 0.334) {
      effects.chip[ui].ownshade = true;
    }
    if (roni > 0.667) {
      effects.chip[ui].ownlight = true;
    }
    effects.chip[ui].vbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, effects.chip[ui].vbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
    effects.chip[ui].nbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, effects.chip[ui].nbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(norm), gl.STATIC_DRAW);
    effects.chip[ui].tbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, effects.chip[ui].tbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texu), gl.STATIC_DRAW);
    effects.chip[ui].ibuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, effects.chip[ui].ibuf);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indice),
      gl.STATIC_DRAW,
    );
    effects.chip[ui].mat = mat4.create();
    effects.chip[ui].texture = racers[c].body.texture[1];
    effects.chip[ui].loaded = 1;
  }
}
export function chipsfly() {
  var nfly = false;
  for (var i = 0; i < effects.nchp; i++) {
    if (effects.chip[i].loaded) {
      effects.chip[i].x = car[effects.chip[i].cn].x + effects.chip[i].rx;
      effects.chip[i].y = car[effects.chip[i].cn].y + effects.chip[i].ry;
      effects.chip[i].z = car[effects.chip[i].cn].z + effects.chip[i].rz;
      effects.chip[i].rx += effects.chip[i].vx * tick.scale;
      effects.chip[i].ry += effects.chip[i].vy * tick.scale;
      effects.chip[i].rz += effects.chip[i].vz * tick.scale;
      effects.chip[i].vy -= 0.7 * tick.scale;
      if (effects.chip[i].rtn1 < 3) {
        var a1rot = [0, 0, 0];
        a1rot[effects.chip[i].rtn1] = 1;
        mat4.rotate(
          effects.chip[i].mat,
          effects.chip[i].mat,
          effects.chip[i].rtn1mag * (Math.PI / 180),
          a1rot,
        );
      }
      if (effects.chip[i].rtn2 < 3) {
        var a2rot = [0, 0, 0];
        a2rot[effects.chip[i].rtn2] = 1;
        mat4.rotate(
          effects.chip[i].mat,
          effects.chip[i].mat,
          effects.chip[i].rtn2mag * (Math.PI / 180),
          a2rot,
        );
      }
      if (tick.fraction >= tick.scale) {
        effects.chip[i].loaded++;
        if (effects.chip[i].loaded == 100) {
          effects.chip[i].loaded = 0;
        }
      }
      if (effects.chip[i].y < 0) {
        effects.chip[i].loaded = 0;
      }
      if (effects.chip[i].loaded == 0) {
        gl.deleteBuffer(effects.chip[i].vbuf);
        effects.chip[i].vbuf = null;
        gl.deleteBuffer(effects.chip[i].tbuf);
        effects.chip[i].tbuf = null;
        gl.deleteBuffer(effects.chip[i].ibuf);
        effects.chip[i].ibuf = null;
        effects.chip[i].texture = null;
      } else {
        nfly = true;
      }
    }
  }
  if (!nfly) {
    effects.nchp = 0;
    for (const racer of racers) {
      racer.carnchp = 0;
    }
  }
}
function newsprk() {
  return { typ: 0, stat: 0, x: 0, y: 0, z: 0, sp: 0, mat: null };
}
export function sprks(cn, x, y, z, sx, sy, sz, cap) {
  var vdist = Math.sqrt(sx * sx + sy * sy + sz * sz);
  if (vdist > 5 && !recording.onpausefr) {
    if (game.phase == PHASE.race) {
      recordsprks(cn, x, y, z, sx, sy, sz, cap);
    }
    var oli = 1;
    if (cap == 2) {
      if (random.fx() > random.fx()) {
        oli = 2;
      }
    }
    for (var ka = 0; ka < oli; ka++) {
      var ui = -1;
      for (var i = 0; i < effects.nspr; i++) {
        if (effects.sprk[i].stat == 0) {
          ui = i;
          break;
        }
      }
      if (ui == -1) {
        ui = effects.nspr;
        effects.nspr++;
      }
      effects.sprk[ui] = newsprk();
      effects.sprk[ui].typ = Math.floor(random.fx() * 6);
      if (effects.sprk[ui].typ == 6) {
        effects.sprk[ui].typ = 0;
      }
      effects.sprk[ui].x = x + (random.fx() * 3 - 1.5);
      if (cap == 2) {
        effects.sprk[ui].y =
          y + carStats.wlh[cn][0] * 2.4 + (random.fx() * 3 - 1.5);
      } else {
        effects.sprk[ui].y = y + random.fx() * 2;
      }
      effects.sprk[ui].z = z + (random.fx() * 3 - 1.5);
      if (cap == 2) {
        sy -= random.fx() * 1;
      } else {
        sx += random.fx() * 1 - 0.5;
        sz += random.fx() * 1 - 0.5;
      }
      effects.sprk[ui].sp = 32 - random.fx() * 2 - vdist;
      effects.sprk[ui].sp *= 0.4;
      effects.sprk[ui].mat = mat4.create();
      var vx = -(sx / vdist);
      var vy = -(sy / vdist);
      var vz = -(sz / vdist);
      effects.sprk[ui].mat[8] = vx;
      effects.sprk[ui].mat[9] = vy;
      effects.sprk[ui].mat[10] = vz;
      effects.sprk[ui].mat[0] = vz;
      effects.sprk[ui].mat[1] = 0;
      effects.sprk[ui].mat[2] = vx;
      effects.sprk[ui].mat[4] = -vx;
      effects.sprk[ui].mat[5] = Math.sqrt(1 - vy * vy);
      effects.sprk[ui].mat[6] = -vz;
      effects.sprk[ui].stat = 1;
    }
  }
}
export function sprksfly() {
  var nfly = false;
  for (var i = 0; i < effects.nspr; i++) {
    if (effects.sprk[i].stat != 0) {
      effects.sprk[i].x +=
        effects.sprk[i].mat[8] * effects.sprk[i].sp * tick.scale;
      effects.sprk[i].y +=
        effects.sprk[i].mat[9] * effects.sprk[i].sp * tick.scale;
      effects.sprk[i].z +=
        effects.sprk[i].mat[10] * effects.sprk[i].sp * tick.scale;
      effects.sprk[i].stat++;
      if (effects.sprk[i].stat == 8) {
        effects.sprk[i].stat = 0;
      } else {
        nfly = true;
      }
    }
  }
  if (!nfly) {
    effects.nspr = 0;
  }
}
function newdust() {
  return {
    stg: 0,
    x: 0,
    dy: 0,
    y: 0,
    z: 0,
    sx: 0,
    sz: 0,
    rot: 0,
    mag: 0,
    mat: null,
    tx: 0,
    ta: 0,
  };
}
export function dustup(tskd, c, mst, x, y, z, sx, sz, smag, tlt, capsz) {
  var tilted = false;
  if (tlt > 5 && (mst == 0 || mst == 2)) {
    tilted = true;
  }
  if (tlt < -5 && (mst == 1 || mst == 3)) {
    tilted = true;
  }
  var bk = (Math.sqrt(sx * sx + sz * sz) - 4) / 16;
  if (bk > 1) {
    bk = 1;
  }
  if (bk > 0.2 && !tilted && !recording.onpausefr) {
    if (game.phase == PHASE.race) {
      recordust(tskd, c, mst, x, y, z, sx, sz, smag, tlt, capsz);
    }
    var ui = -1;
    for (var i = 0; i < effects.ndst; i++) {
      if (effects.dust[i].stg == 0) {
        ui = i;
        break;
      }
    }
    if (ui == -1) {
      ui = effects.ndst;
      effects.ndst++;
    }
    effects.dust[ui] = newdust();
    if (!capsz) {
      var fk = random.fx();
      effects.dust[ui].x = (x + car[c].x * fk) / (1 + fk);
      effects.dust[ui].z = (z + car[c].z * fk) / (1 + fk);
      effects.dust[ui].dy = (y + car[c].y * fk) / (1 + fk);
    } else {
      effects.dust[ui].x = (x + (car[c].x + sx)) / 2;
      effects.dust[ui].z = (z + (car[c].z + sz)) / 2;
      effects.dust[ui].dy = y;
    }
    if (effects.dust[ui].y < 0) {
      effects.dust[ui].y = 0;
    }
    effects.dust[ui].mag = 0.2 + smag * bk * 0.8;
    var ron = Math.floor(4 * random.fx());
    if (ron == 4) {
      ron = 0;
    }
    effects.dust[ui].rot = 90 * ron - 90;
    var sk = 0.1 + random.fx();
    if (sk > 1) {
      sk = 1;
    }
    effects.dust[ui].sx = sx * sk;
    effects.dust[ui].sz = sz * sk;
    effects.dust[ui].stg = 1;
    effects.dust[ui].tx = Math.floor(random.fx() * 3);
    if (effects.dust[ui].tx == 3) {
      effects.dust[ui].tx = 0;
    }
    if (tskd == 2) {
      effects.dust[ui].tx += 3;
    }
    if (tskd == 1) {
      effects.dust[ui].tx += 6;
    }
    effects.dust[ui].ta = 0;
    effects.dust[ui].mat = mat4.create();
    effects.dwer[ui] = ui;
  }
}
export function dustfly() {
  var nfly = false;
  for (var i = 0; i < effects.ndst; i++) {
    if (effects.dust[i].stg != 0) {
      if (!recording.onpausefr) {
        effects.dust[i].x += effects.dust[i].sx / (effects.dust[i].stg + 1);
        effects.dust[i].z += effects.dust[i].sz / (effects.dust[i].stg + 1);
        effects.dust[i].y = effects.dust[i].dy + 3 * effects.dust[i].mag;
      }
      var fct =
        1 /
        Math.sqrt(
          effects.dust[i].sx * effects.dust[i].sx +
            effects.dust[i].sz * effects.dust[i].sz,
        );
      var vfx = effects.dust[i].sx * fct * effects.dust[i].sx * fct;
      var vfz = effects.dust[i].sz * fct * effects.dust[i].sz * fct;
      var mlt = 1;
      if (vfx > vfz) {
        mlt = 1 + (1 - Math.abs(cosDeg(camera.yaw) * cosDeg(camera.yaw) - vfx));
      } else {
        mlt = 1 + (1 - Math.abs(sinDeg(camera.yaw) * sinDeg(camera.yaw) - vfz));
      }
      effects.dust[i].mat = resetMatrix(effects.dust[i].mat);
      mat4.rotate(
        effects.dust[i].mat,
        effects.dust[i].mat,
        camera.yaw * (Math.PI / 180),
        [0, -1, 0],
      );
      mat4.rotate(
        effects.dust[i].mat,
        effects.dust[i].mat,
        camera.pitch * (Math.PI / 180),
        [-1, 0, 0],
      );
      mat4.rotate(
        effects.dust[i].mat,
        effects.dust[i].mat,
        effects.dust[i].rot * (Math.PI / 180),
        [0, 0, 1],
      );
      var kmt = 0;
      if (Math.abs(effects.dust[i].rot) == 90) {
        kmt = 1;
      }
      for (var k = 0; k < 3; k++) {
        var mt = 1;
        if (k == kmt) {
          mt = mlt;
        }
        effects.dust[i].mat[k * 4] *= effects.dust[i].mag * mt;
        effects.dust[i].mat[k * 4 + 1] *= effects.dust[i].mag * mt;
        effects.dust[i].mat[k * 4 + 2] *= effects.dust[i].mag * mt;
      }
      if (!recording.onpausefr) {
        effects.dust[i].mag += 0.05 + random.fx() * 0.05;
        if (effects.dust[i].stg >= 2) {
          effects.dust[i].ta += 0.45;
          if (effects.dust[i].ta > 4) {
            effects.dust[i].ta = 4;
          }
        }
        if (effects.dust[i].stg == 10) {
          effects.dust[i].stg = 0;
        } else {
          effects.dust[i].stg++;
          nfly = true;
        }
      } else {
        nfly = true;
      }
    }
  }
  if (nfly) {
    var wer = [];
    var dustd = [];
    for (var i = 0; i < effects.ndst; i++) {
      wer[i] = 0;
      dustd[i] = distance(
        effects.dust[i].x,
        camera.x,
        effects.dust[i].y,
        camera.y,
        effects.dust[i].z,
        camera.z,
      );
    }
    for (var i = 0; i < effects.ndst; i++) {
      for (var j = i + 1; j < effects.ndst; j++) {
        if (dustd[i] < dustd[j]) {
          wer[i]++;
        } else {
          wer[j]++;
        }
      }
      effects.dwer[wer[i]] = i;
    }
  } else {
    effects.ndst = 0;
  }
}
function newexp() {
  return {
    x: 0,
    y: 0,
    z: 0,
    rot: 0,
    vy: 0,
    vsx: 0,
    vsy: 0,
    vsz: 0,
    typ: 0,
    ani: -1,
    size: 0,
    mat: null,
    first: false,
  };
}
export function firexp(c, vsx, vsy, vsz) {
  var ui = -1;
  for (var i = 0; i < effects.nexp; i++) {
    if (effects.exp[i].ani == -1) {
      ui = i;
      break;
    }
  }
  if (ui == -1) {
    ui = effects.nexp;
    effects.nexp++;
  }
  var rad = racers[c].body;
  var ir = Math.floor(rad.ni * random.fx());
  if (ir == rad.ni) {
    ir = 0;
  }
  effects.exp[ui] = newexp();
  effects.exp[ui].x =
    car[c].x +
    rad.dvert[ir * 3] * car[c].mat[0] +
    rad.dvert[ir * 3 + 1] * car[c].mat[4] +
    rad.dvert[ir * 3 + 2] * car[c].mat[8];
  effects.exp[ui].y =
    car[c].y +
    rad.dvert[ir * 3] * car[c].mat[1] +
    rad.dvert[ir * 3 + 1] * car[c].mat[5] +
    rad.dvert[ir * 3 + 2] * car[c].mat[9];
  effects.exp[ui].z =
    car[c].z +
    rad.dvert[ir * 3] * car[c].mat[2] +
    rad.dvert[ir * 3 + 1] * car[c].mat[6] +
    rad.dvert[ir * 3 + 2] * car[c].mat[10];
  effects.exp[ui].vsx = vsx;
  effects.exp[ui].vsy = vsy;
  effects.exp[ui].vsz = vsz;
  effects.exp[ui].vy = 0.4 + random.fx() * 0.2;
  effects.exp[ui].size = 0.6 + random.fx() * 0.6;
  effects.exp[ui].rot = 360 * random.fx();
  effects.exp[ui].typ = Math.floor(random.fx() * 3);
  if (effects.exp[ui].typ == 3) {
    effects.exp[ui].typ = 0;
  }
  effects.exp[ui].ani = 0;
  effects.exp[ui].mat = mat4.create();
  effects.exp[ui].first = false;
  effects.ewer[ui] = ui;
}
export function expburn() {
  var nfly = false;
  for (var i = 0; i < effects.nexp; i++) {
    if (effects.exp[i].ani != -1) {
      effects.exp[i].mat = resetMatrix(effects.exp[i].mat);
      mat4.rotate(
        effects.exp[i].mat,
        effects.exp[i].mat,
        camera.yaw * (Math.PI / 180),
        [0, -1, 0],
      );
      mat4.rotate(
        effects.exp[i].mat,
        effects.exp[i].mat,
        camera.pitch * (Math.PI / 180),
        [-1, 0, 0],
      );
      mat4.rotate(
        effects.exp[i].mat,
        effects.exp[i].mat,
        effects.exp[i].rot * (Math.PI / 180),
        [0, 0, 1],
      );
      for (var k = 0; k < 3; k++) {
        effects.exp[i].mat[k * 4] *= effects.exp[i].size;
        effects.exp[i].mat[k * 4 + 1] *= effects.exp[i].size;
        effects.exp[i].mat[k * 4 + 2] *= effects.exp[i].size;
      }
      effects.exp[i].y += effects.exp[i].vy;
      if (effects.exp[i].first) {
        effects.exp[i].x += effects.exp[i].vsx * tick.scale;
        effects.exp[i].vsx *= 0.95;
        effects.exp[i].y += effects.exp[i].vsy * tick.scale;
        effects.exp[i].vsy *= 0.95;
        effects.exp[i].z += effects.exp[i].vsz * tick.scale;
        effects.exp[i].vsz *= 0.95;
        effects.exp[i].size += effects.exp[i].size * 0.05 * tick.scale;
        effects.exp[i].ani += 0.85 * tick.scale;
      } else {
        effects.exp[i].first = true;
      }
      if (effects.exp[i].ani >= 6) {
        effects.exp[i].ani = -1;
      } else {
        nfly = true;
      }
    }
  }
  if (nfly) {
    var wer = [];
    var expd = [];
    for (var i = 0; i < effects.nexp; i++) {
      wer[i] = 0;
      expd[i] = distance(
        effects.exp[i].x,
        camera.x,
        effects.exp[i].y,
        camera.y,
        effects.exp[i].z,
        camera.z,
      );
    }
    for (var i = 0; i < effects.nexp; i++) {
      for (var j = i + 1; j < effects.nexp; j++) {
        if (expd[i] < expd[j]) {
          wer[i]++;
        } else {
          wer[j]++;
        }
      }
      effects.ewer[wer[i]] = i;
    }
  } else {
    effects.nexp = 0;
  }
}
export function burn(c) {
  var rad = racers[c].body;
  var pixels = rad.damagePixels;
  if (pixels != null) {
    for (var p = racers[c].bshft; p < 256 * 256 * 4; p += 12) {
      pixels[p] = 14 + pixels[p] * 0.6667;
      pixels[p + 1] = 4 + pixels[p + 1] * 0.6667;
      pixels[p + 2] = pixels[p + 2] * 0.6667;
    }
    rad.damagedPixels = true;
  }
  racers[c].bshft += 4;
  if (racers[c].bshft == 12) {
    racers[c].bshft = 0;
  }
}
export function chipburn(c) {
  var rad = racers[c].body;
  for (var i = 0; i < rad.ni; i++) {
    if (random.fx() > random.fx() && random.fx() > random.fx()) {
      car[c].ctxl[0] = random.fx();
      car[c].ctxl[1] = random.fx();
      chipaway(
        c,
        rad.dvert[i * 3],
        rad.dvert[i * 3 + 1],
        rad.dvert[i * 3 + 2],
        0.1 + random.fx() * 0.2,
      );
    }
  }
}
function recordust(tskd, c, mst, x, y, z, sx, sz, smag, tlt, capsz) {
  var ui = -1;
  for (var i = 0; i < recording.repcar[c].ndst; i++) {
    if (recording.repcar[c].dstat[i] < 0) {
      ui = i;
      break;
    }
  }
  if (ui == -1) {
    ui = recording.repcar[c].ndst;
    recording.repcar[c].ndst++;
  }
  recording.repcar[c].dstat[ui] = 430;
  recording.repcar[c].tskd[ui] = tskd;
  recording.repcar[c].mst[ui] = mst;
  recording.repcar[c].dx[ui] = x;
  recording.repcar[c].dy[ui] = y;
  recording.repcar[c].dz[ui] = z;
  recording.repcar[c].sx[ui] = sx;
  recording.repcar[c].sz[ui] = sz;
  recording.repcar[c].smag[ui] = smag;
  recording.repcar[c].tlt[ui] = tlt;
  recording.repcar[c].capsz[ui] = capsz;
}
function recordsprks(cn, x, y, z, sx, sy, sz, cap) {
  var ui = -1;
  for (var i = 0; i < recording.repsprks.n; i++) {
    if (recording.repsprks.sprkat[i] < 0) {
      ui = i;
      break;
    }
  }
  if (ui == -1) {
    ui = recording.repsprks.n;
    recording.repsprks.n++;
  }
  recording.repsprks.sprkat[ui] = 430;
  recording.repsprks.cn[ui] = cn;
  recording.repsprks.x[ui] = x;
  recording.repsprks.y[ui] = y;
  recording.repsprks.z[ui] = z;
  recording.repsprks.sx[ui] = sx;
  recording.repsprks.sy[ui] = sy;
  recording.repsprks.sz[ui] = sz;
  recording.repsprks.cap[ui] = cap;
}
