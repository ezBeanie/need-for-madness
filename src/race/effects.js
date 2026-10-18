// The flying particles of a race: sparks, chips broken off cars, dust and explosions.
// Every list is used up to its count and keeps its entries for reuse.

import { cosDeg, distance, sinDeg } from "../core/math.js";
import { random } from "../core/random.js";
import { PHASE, game } from "../core/state.js";
import { tick } from "../core/tick.js";
import { carStats } from "../data/carStats.js";
import { camera, faceCamera } from "../render/camera.js";
import { newModel } from "../render/models.js";
import { gl } from "../render/renderer.js";
import { car, racers } from "./racers.js";
import { recording } from "./recording.js";

export const effects = {
  // stat: 0 gone, then its age in ticks up to 8
  sparks: [],
  sparkCount: 0,
  // models; loaded: 0 gone, then its age
  chips: [],
  chipCount: 0,
  // stg: 0 gone, then its age up to 10
  dustClouds: [],
  dustCount: 0,
  // indices of the clouds, farthest from the camera first, so the nearest are drawn last
  dustBackToFront: [],
  // ani: the animation frame, -1 gone
  explosions: [],
  explosionCount: 0,
  explosionsBackToFront: [],
};

// sparks from scraping the ground, or a wall (from higher up)
export const SPARKS = { ground: 1, wall: 2 };
// the ground the dust comes from (dust kinds 0-2 smoke, 3-5 sand, 6-8 the stage's ground)
export const DUST = { road: 0, ground: 1, sand: 2 };

const MAX_CHIPS_PER_CAR = 120;
const CHIP_TICKS = 100;
const SPARK_TICKS = 8;
const DUST_TICKS = 10;
const EXPLOSION_FRAMES = 6;
// how long a recorded effect stays in the replay (see recording.js)
const RECORDED_TICKS = 430;

// The first free entry of a list, or -1.
const freeSlot = (list, count, isFree) => {
  for (let i = 0; i < count; i++) {
    if (isFree(list[i])) {
      return i;
    }
  }
  return -1;
};

// Back to front by distance from the camera: an item counts one up for every other one
// farther away.
const sortBackToFront = (items, count, order) => {
  const ranks = [];
  const distances = [];
  for (let i = 0; i < count; i++) {
    ranks[i] = 0;
    distances[i] = distance(
      items[i].x,
      camera.x,
      items[i].y,
      camera.y,
      items[i].z,
      camera.z,
    );
  }
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      if (distances[i] < distances[j]) {
        ranks[i]++;
      } else {
        ranks[j]++;
      }
    }
    order[ranks[i]] = i;
  }
};

const buffer = (target, data) => {
  const made = gl.createBuffer();
  gl.bindBuffer(target, made);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return made;
};

// A random coordinate for each of the three corners of a chip, then all shifted by a
// random share of half their mean, as in the original.
const chipCorners = (size) => {
  const corners = [0];
  let sum = 0;
  for (let i = 1; i < 3; i++) {
    corners[i] = corners[0] + size * (10 - random.fx() * 20);
    sum += corners[i];
  }
  const mean = sum / 2;
  for (let i = 0; i < 3; i++) {
    corners[i] -= (mean / 2) * (1 - random.fx() * random.fx());
  }
  return corners;
};

// A triangular chip breaks off car c at (x, y, z) on its body, flying off and spinning.
export function chipaway(c, x, y, z, size) {
  if (!(racers[c].carnchp < MAX_CHIPS_PER_CAR && !recording.frozen)) {
    return;
  }
  let slot = freeSlot(
    effects.chips,
    effects.chipCount,
    (chip) => chip.loaded == 0,
  );
  if (slot == -1) {
    slot = effects.chipCount;
    effects.chipCount++;
    racers[c].carnchp++;
  }
  if (size > 0.4) {
    size = 0.3;
  }
  if (size < -0.4) {
    size = -0.3;
  }
  const chip = newModel();
  effects.chips[slot] = chip;
  const m = car[c].mat;
  // where on the car, turned with it
  chip.rx = x * m[0] + y * m[4] + z * m[8];
  chip.ry = x * m[1] + y * m[5] + z * m[9];
  chip.rz = x * m[2] + y * m[6] + z * m[10];
  chip.cn = c;
  chip.vx = size * (30 - random.fx() * 60);
  chip.vy = size * (30 - random.fx() * 60);
  chip.vz = size * (30 - random.fx() * 60);
  // spins about up to two axes (0 x, 1 y, 2 z; 3 and 4 none)
  chip.rtn1 = Math.floor(random.fx() * 5);
  if (chip.rtn1 < 3) {
    chip.rtn1mag = random.fx() * 60;
  }
  chip.rtn2 = Math.floor(random.fx() * 5);
  if (chip.rtn2 < 3) {
    chip.rtn2mag = random.fx() * 60;
  }
  const ox = chipCorners(size);
  const oy = chipCorners(size);
  const oz = chipCorners(size);
  const crossX =
    (oy[1] - oy[0]) * (oz[2] - oz[0]) - (oz[1] - oz[0]) * (oy[2] - oy[0]);
  const crossY =
    (oz[1] - oz[0]) * (ox[2] - ox[0]) - (ox[1] - ox[0]) * (oz[2] - oz[0]);
  const crossZ =
    (ox[1] - ox[0]) * (oy[2] - oy[0]) - (oy[1] - oy[0]) * (ox[2] - ox[0]);
  const length = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
  const vertices = [];
  const normals = [];
  const texture = [];
  for (let i = 0; i < 3; i++) {
    vertices.push(ox[i], oy[i], oz[i]);
    normals.push(crossX / length, crossY / length, crossZ / length);
    // the whole chip shows one spot of the car's paint
    texture.push(car[c].ctxl[0], car[c].ctxl[1]);
  }
  chip.ni = 3;
  chip.nt = 1;
  const shade = random.fx();
  if (shade > 0.334) {
    chip.ownshade = true;
  }
  if (shade > 0.667) {
    chip.ownlight = true;
  }
  chip.vbuf = buffer(gl.ARRAY_BUFFER, new Float32Array(vertices));
  chip.nbuf = buffer(gl.ARRAY_BUFFER, new Float32Array(normals));
  chip.tbuf = buffer(gl.ARRAY_BUFFER, new Float32Array(texture));
  chip.ibuf = buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2]));
  chip.mat = mat4.create();
  chip.texture = racers[c].body.texture[1];
  chip.loaded = 1;
}

// Chips fly off their car, fall and spin, until they reach the ground or get old.
export function chipsfly() {
  let anyFlying = false;
  for (let i = 0; i < effects.chipCount; i++) {
    const chip = effects.chips[i];
    if (!chip.loaded) {
      continue;
    }
    chip.x = car[chip.cn].x + chip.rx;
    chip.y = car[chip.cn].y + chip.ry;
    chip.z = car[chip.cn].z + chip.rz;
    chip.rx += chip.vx * tick.scale;
    chip.ry += chip.vy * tick.scale;
    chip.rz += chip.vz * tick.scale;
    chip.vy -= 0.7 * tick.scale;
    for (const [axis, degrees] of [
      [chip.rtn1, chip.rtn1mag],
      [chip.rtn2, chip.rtn2mag],
    ]) {
      if (axis < 3) {
        const around = [0, 0, 0];
        around[axis] = 1;
        mat4.rotate(chip.mat, chip.mat, degrees * (Math.PI / 180), around);
      }
    }
    if (tick.fraction >= tick.scale) {
      chip.loaded++;
      if (chip.loaded == CHIP_TICKS) {
        chip.loaded = 0;
      }
    }
    if (chip.y < 0) {
      chip.loaded = 0;
    }
    if (chip.loaded == 0) {
      gl.deleteBuffer(chip.vbuf);
      chip.vbuf = null;
      gl.deleteBuffer(chip.tbuf);
      chip.tbuf = null;
      gl.deleteBuffer(chip.ibuf);
      chip.ibuf = null;
      chip.texture = null;
    } else {
      anyFlying = true;
    }
  }
  if (!anyFlying) {
    effects.chipCount = 0;
    for (const racer of racers) {
      racer.carnchp = 0;
    }
  }
}

// Sparks fly from where a car of type `type` scrapes (x, y, z) at the speed (sx, sy, sz):
// backwards along it, faster the slower the car scrapes.
export function sprks(type, x, y, z, sx, sy, sz, kind) {
  const speed = Math.sqrt(sx * sx + sy * sy + sz * sz);
  if (!(speed > 5 && !recording.frozen)) {
    return;
  }
  if (game.phase == PHASE.race) {
    recordSparks(type, x, y, z, sx, sy, sz, kind);
  }
  let count = 1;
  if (kind == SPARKS.wall && random.fx() > random.fx()) {
    count = 2;
  }
  for (let n = 0; n < count; n++) {
    let slot = freeSlot(
      effects.sparks,
      effects.sparkCount,
      (spark) => spark.stat == 0,
    );
    if (slot == -1) {
      slot = effects.sparkCount;
      effects.sparkCount++;
    }
    const spark = { typ: 0, stat: 0, x: 0, y: 0, z: 0, sp: 0, mat: null };
    effects.sparks[slot] = spark;
    spark.typ = Math.floor(random.fx() * 6);
    if (spark.typ == 6) {
      spark.typ = 0;
    }
    spark.x = x + (random.fx() * 3 - 1.5);
    if (kind == SPARKS.wall) {
      spark.y = y + carStats.wlh[type][0] * 2.4 + (random.fx() * 3 - 1.5);
    } else {
      spark.y = y + random.fx() * 2;
    }
    spark.z = z + (random.fx() * 3 - 1.5);
    if (kind == SPARKS.wall) {
      sy -= random.fx() * 1;
    } else {
      sx += random.fx() * 1 - 0.5;
      sz += random.fx() * 1 - 0.5;
    }
    spark.sp = 32 - random.fx() * 2 - speed;
    spark.sp *= 0.4;
    // pointing backwards along the speed
    spark.mat = mat4.create();
    const vx = -(sx / speed);
    const vy = -(sy / speed);
    const vz = -(sz / speed);
    spark.mat[8] = vx;
    spark.mat[9] = vy;
    spark.mat[10] = vz;
    spark.mat[0] = vz;
    spark.mat[1] = 0;
    spark.mat[2] = vx;
    spark.mat[4] = -vx;
    spark.mat[5] = Math.sqrt(1 - vy * vy);
    spark.mat[6] = -vz;
    spark.stat = 1;
  }
}

export function sprksfly() {
  let anyFlying = false;
  for (let i = 0; i < effects.sparkCount; i++) {
    const spark = effects.sparks[i];
    if (spark.stat == 0) {
      continue;
    }
    spark.x += spark.mat[8] * spark.sp * tick.scale;
    spark.y += spark.mat[9] * spark.sp * tick.scale;
    spark.z += spark.mat[10] * spark.sp * tick.scale;
    spark.stat++;
    if (spark.stat == SPARK_TICKS) {
      spark.stat = 0;
    } else {
      anyFlying = true;
    }
  }
  if (!anyFlying) {
    effects.sparkCount = 0;
  }
}

// Dust whirls up where wheel `wheel` of car c skids at (x, y, z) at the speed (sx, sz),
// the faster the bigger, from the ground `ground` (see DUST). A wheel lifted by the car's
// tilt raises none.
export function dustup(
  ground,
  c,
  wheel,
  x,
  y,
  z,
  sx,
  sz,
  size,
  tilt,
  capsized,
) {
  const leftWheel = wheel == 0 || wheel == 2;
  const lifted = (tilt > 5 && leftWheel) || (tilt < -5 && !leftWheel);
  let strength = (Math.sqrt(sx * sx + sz * sz) - 4) / 16;
  if (strength > 1) {
    strength = 1;
  }
  if (!(strength > 0.2 && !lifted && !recording.frozen)) {
    return;
  }
  if (game.phase == PHASE.race) {
    recordDust(ground, c, wheel, x, y, z, sx, sz, size, tilt, capsized);
  }
  let slot = freeSlot(
    effects.dustClouds,
    effects.dustCount,
    (cloud) => cloud.stg == 0,
  );
  if (slot == -1) {
    slot = effects.dustCount;
    effects.dustCount++;
  }
  const cloud = {
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
  effects.dustClouds[slot] = cloud;
  if (!capsized) {
    // somewhere between the wheel and the car's middle
    const towardsCar = random.fx();
    cloud.x = (x + car[c].x * towardsCar) / (1 + towardsCar);
    cloud.z = (z + car[c].z * towardsCar) / (1 + towardsCar);
    cloud.dy = (y + car[c].y * towardsCar) / (1 + towardsCar);
  } else {
    cloud.x = (x + (car[c].x + sx)) / 2;
    cloud.z = (z + (car[c].z + sz)) / 2;
    cloud.dy = y;
  }
  cloud.mag = 0.2 + size * strength * 0.8;
  let quarter = Math.floor(4 * random.fx());
  if (quarter == 4) {
    quarter = 0;
  }
  cloud.rot = 90 * quarter - 90;
  const drift = Math.min(0.1 + random.fx(), 1);
  cloud.sx = sx * drift;
  cloud.sz = sz * drift;
  cloud.stg = 1;
  cloud.tx = Math.floor(random.fx() * 3);
  if (cloud.tx == 3) {
    cloud.tx = 0;
  }
  if (ground == DUST.sand) {
    cloud.tx += 3;
  }
  if (ground == DUST.ground) {
    cloud.tx += 6;
  }
  cloud.ta = 0;
  cloud.mat = mat4.create();
  effects.dustBackToFront[slot] = slot;
}

// Dust drifts, grows and fades; it faces the camera, stretched along its drift.
export function dustfly() {
  let anyFlying = false;
  for (let i = 0; i < effects.dustCount; i++) {
    const cloud = effects.dustClouds[i];
    if (cloud.stg == 0) {
      continue;
    }
    if (!recording.frozen) {
      cloud.x += cloud.sx / (cloud.stg + 1);
      cloud.z += cloud.sz / (cloud.stg + 1);
      cloud.y = cloud.dy + 3 * cloud.mag;
    }
    const unit = 1 / Math.sqrt(cloud.sx * cloud.sx + cloud.sz * cloud.sz);
    const alongX = cloud.sx * unit * cloud.sx * unit;
    const alongZ = cloud.sz * unit * cloud.sz * unit;
    let stretch = 1;
    if (alongX > alongZ) {
      stretch =
        1 + (1 - Math.abs(cosDeg(camera.yaw) * cosDeg(camera.yaw) - alongX));
    } else {
      stretch =
        1 + (1 - Math.abs(sinDeg(camera.yaw) * sinDeg(camera.yaw) - alongZ));
    }
    faceCamera(cloud);
    mat4.rotate(cloud.mat, cloud.mat, cloud.rot * (Math.PI / 180), [0, 0, 1]);
    const stretched = Math.abs(cloud.rot) == 90 ? 1 : 0;
    for (let k = 0; k < 3; k++) {
      const scale = k == stretched ? stretch : 1;
      cloud.mat[k * 4] *= cloud.mag * scale;
      cloud.mat[k * 4 + 1] *= cloud.mag * scale;
      cloud.mat[k * 4 + 2] *= cloud.mag * scale;
    }
    if (recording.frozen) {
      anyFlying = true;
      continue;
    }
    cloud.mag += 0.05 + random.fx() * 0.05;
    if (cloud.stg >= 2) {
      cloud.ta = Math.min(cloud.ta + 0.45, 4);
    }
    if (cloud.stg == DUST_TICKS) {
      cloud.stg = 0;
    } else {
      cloud.stg++;
      anyFlying = true;
    }
  }
  if (anyFlying) {
    sortBackToFront(
      effects.dustClouds,
      effects.dustCount,
      effects.dustBackToFront,
    );
  } else {
    effects.dustCount = 0;
  }
}

// A burst of fire at a random vertex of car c's body, drifting with (vsx, vsy, vsz).
export function firexp(c, vsx, vsy, vsz) {
  let slot = freeSlot(
    effects.explosions,
    effects.explosionCount,
    (explosion) => explosion.ani == -1,
  );
  if (slot == -1) {
    slot = effects.explosionCount;
    effects.explosionCount++;
  }
  const body = racers[c].body;
  let vertex = Math.floor(body.ni * random.fx());
  if (vertex == body.ni) {
    vertex = 0;
  }
  const v = body.dvert;
  const m = car[c].mat;
  // at the vertex, turned with the car (summed in the original's order)
  const at = (position, k) =>
    position +
    v[vertex * 3] * m[k] +
    v[vertex * 3 + 1] * m[k + 4] +
    v[vertex * 3 + 2] * m[k + 8];
  const explosion = {
    x: at(car[c].x, 0),
    y: at(car[c].y, 1),
    z: at(car[c].z, 2),
    rot: 0,
    vy: 0,
    vsx,
    vsy,
    vsz,
    typ: 0,
    ani: -1,
    size: 0,
    mat: null,
    first: false,
  };
  effects.explosions[slot] = explosion;
  explosion.vy = 0.4 + random.fx() * 0.2;
  explosion.size = 0.6 + random.fx() * 0.6;
  explosion.rot = 360 * random.fx();
  explosion.typ = Math.floor(random.fx() * 3);
  if (explosion.typ == 3) {
    explosion.typ = 0;
  }
  explosion.ani = 0;
  explosion.mat = mat4.create();
  effects.explosionsBackToFront[slot] = slot;
}

// Explosions rise, grow and drift (from their second tick on) through their frames.
export function expburn() {
  let anyBurning = false;
  for (let i = 0; i < effects.explosionCount; i++) {
    const explosion = effects.explosions[i];
    if (explosion.ani == -1) {
      continue;
    }
    faceCamera(explosion);
    mat4.rotate(
      explosion.mat,
      explosion.mat,
      explosion.rot * (Math.PI / 180),
      [0, 0, 1],
    );
    for (let k = 0; k < 3; k++) {
      explosion.mat[k * 4] *= explosion.size;
      explosion.mat[k * 4 + 1] *= explosion.size;
      explosion.mat[k * 4 + 2] *= explosion.size;
    }
    explosion.y += explosion.vy;
    if (explosion.first) {
      explosion.x += explosion.vsx * tick.scale;
      explosion.vsx *= 0.95;
      explosion.y += explosion.vsy * tick.scale;
      explosion.vsy *= 0.95;
      explosion.z += explosion.vsz * tick.scale;
      explosion.vsz *= 0.95;
      explosion.size += explosion.size * 0.05 * tick.scale;
      explosion.ani += 0.85 * tick.scale;
    } else {
      explosion.first = true;
    }
    if (explosion.ani >= EXPLOSION_FRAMES) {
      explosion.ani = -1;
    } else {
      anyBurning = true;
    }
  }
  if (anyBurning) {
    sortBackToFront(
      effects.explosions,
      effects.explosionCount,
      effects.explosionsBackToFront,
    );
  } else {
    effects.explosionCount = 0;
  }
}

// A wasted car burns: every tick a third of its texture's pixels darken to a reddish
// black, in turns (bshft).
export function burn(c) {
  const body = racers[c].body;
  const pixels = body.damagePixels;
  if (pixels != null) {
    for (let p = racers[c].bshft; p < 256 * 256 * 4; p += 12) {
      pixels[p] = 14 + pixels[p] * 0.6667;
      pixels[p + 1] = 4 + pixels[p + 1] * 0.6667;
      pixels[p + 2] = pixels[p + 2] * 0.6667;
    }
    body.damagedPixels = true;
  }
  racers[c].bshft += 4;
  if (racers[c].bshft == 12) {
    racers[c].bshft = 0;
  }
}

// A wasted car sheds chips from about a quarter of its vertices.
export function chipburn(c) {
  const body = racers[c].body;
  for (let i = 0; i < body.ni; i++) {
    if (random.fx() > random.fx() && random.fx() > random.fx()) {
      car[c].ctxl[0] = random.fx();
      car[c].ctxl[1] = random.fx();
      chipaway(
        c,
        body.dvert[i * 3],
        body.dvert[i * 3 + 1],
        body.dvert[i * 3 + 2],
        0.1 + random.fx() * 0.2,
      );
    }
  }
}

// The replays keep the dust of each car and the sparks (see recording.js).
const recordDust = (
  ground,
  c,
  wheel,
  x,
  y,
  z,
  sx,
  sz,
  size,
  tilt,
  capsized,
) => {
  const tape = recording.tape.cars[c];
  let slot = -1;
  for (let i = 0; i < tape.dustCount; i++) {
    if (tape.dustAt[i] < 0) {
      slot = i;
      break;
    }
  }
  if (slot == -1) {
    slot = tape.dustCount;
    tape.dustCount++;
  }
  tape.dustAt[slot] = RECORDED_TICKS;
  tape.dustGround[slot] = ground;
  tape.dustWheel[slot] = wheel;
  tape.dustX[slot] = x;
  tape.dustY[slot] = y;
  tape.dustZ[slot] = z;
  tape.dustSpeedX[slot] = sx;
  tape.dustSpeedZ[slot] = sz;
  tape.dustSize[slot] = size;
  tape.dustTilt[slot] = tilt;
  tape.dustCapsized[slot] = capsized;
};

const recordSparks = (type, x, y, z, sx, sy, sz, kind) => {
  const tape = recording.tape.sparks;
  let slot = -1;
  for (let i = 0; i < tape.count; i++) {
    if (tape.at[i] < 0) {
      slot = i;
      break;
    }
  }
  if (slot == -1) {
    slot = tape.count;
    tape.count++;
  }
  tape.at[slot] = RECORDED_TICKS;
  tape.carType[slot] = type;
  tape.x[slot] = x;
  tape.y[slot] = y;
  tape.z[slot] = z;
  tape.sx[slot] = sx;
  tape.sy[slot] = sy;
  tape.sz[slot] = sz;
  tape.kind[slot] = kind;
};
