// What is recorded of a race: the last ticks of every car (where it was, its hits, fixes,
// dust and its wasting), the sparks and the checkpoint texts. They play back as the
// instant replay, wind back as rewinding time, and a copy kept when something worth
// showing happened plays as the highlight after the race.

import { resumeStageMusic } from "../audio/audio.js";
import { rotateAxes } from "../core/math.js";
import { random } from "../core/random.js";
import { PHASE, game } from "../core/state.js";
import { tick } from "../core/tick.js";
import { CAMERA, camera } from "../render/camera.js";
import { BLEND } from "../render/renderer.js";
import { resetPursuit } from "./ai.js";
import { burn, chipburn, dustup, firexp, sprks } from "./effects.js";
import { raceEvents } from "./events.js";
import { fixcar, regn } from "./physics.js";
import { MISSED, car, racers } from "./racers.js";
import { track } from "./track.js";

// how many ticks a tape holds; events are recorded at TAPE_TICKS and count down with
// every tick, so their time is the frame of the tape they happened at (below 0: before it)
export const TAPE_TICKS = 430;
const LAST_FRAME = TAPE_TICKS - 1;
// a car's wastedAt until it is wasted
const NOT_WASTED = 700;
// a wasting becomes the highlight once it is this far into the tape, so the highlight
// shows what led to it and the burning after
const WASTING_CAUGHT_AT = 328;

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

export const newCarTape = () => ({
  // every tick: where the car was, the mean speed of its wheels, its standing
  x: [],
  y: [],
  z: [],
  xy: [],
  xz: [],
  zy: [],
  wzy: [],
  wxz: [],
  speedX: [],
  speedY: [],
  speedZ: [],
  cameraHeading: [],
  damage: [],
  clear: [],
  clearedPathPoint: [],
  nlaps: [],
  // the hits that dented it (see regn)
  hitCount: 0,
  hitAt: [],
  hitSide: [],
  hitPoint: [],
  hitMag: [],
  hitMtouch: [],
  fixCount: 0,
  fixAt: [],
  wastedAt: NOT_WASTED,
  // when the player's hit wasted it: ticks since that hit (see racers' lastcolido)
  playerHitTicks: 0,
  // the dust it raised (see dustup)
  dustCount: 0,
  dustAt: [],
  dustGround: [],
  dustWheel: [],
  dustX: [],
  dustY: [],
  dustZ: [],
  dustSpeedX: [],
  dustSpeedZ: [],
  dustSize: [],
  dustTilt: [],
  dustCapsized: [],
});

// the sparks (see sprks)
const newSparkTape = () => ({
  count: 0,
  at: [],
  carType: [],
  x: [],
  y: [],
  z: [],
  sx: [],
  sy: [],
  sz: [],
  kind: [],
});

export const recording = {
  // the race's last ticks, and the copy the highlight replay plays
  tape: { cars: [], sparks: null, checkpoint: [], lastCheck: [] },
  highlightTape: { cars: [], sparks: null, checkpoint: [], lastCheck: [] },
  // the ticks recorded so far (up to TAPE_TICKS)
  recordedTicks: 0,
  // the frame of the tape played
  frame: 0,
  // the frame the race went on from after time was wound back
  resumedFrom: 0,
  highlight: HIGHLIGHT.none,
  // the frame of the tape the highlight peaks at
  highlightAt: 0,
  // the car the highlight shows, and the one it turns to (caught or beaten)
  otherCar: 0,
  highlightCar: 0,
  // the biggest power-up of a stunt kept as highlight so far
  bestPowerUp: 0,
  // ticks until a stunt, or a close finish, is kept as the highlight
  stuntCatchTicks: 0,
  finishCatchTicks: 0,
  // the highlight replay holds still on a frame
  frozen: false,
  // how long the highlight holds still at its peak (its flashes follow it), and how long
  // it has so far
  holdTicks: 0,
  held: 0,
};

// Keeps the tape as the highlight of the given kind; before the tape is full there is
// nothing worth keeping yet.
export function catchHighlight(kind) {
  if (recording.recordedTicks < TAPE_TICKS) {
    recording.bestPowerUp = 0;
    return;
  }
  const live = recording.tape;
  const kept = recording.highlightTape;
  for (let c = 0; c < game.carCount; c++) {
    copyCarTape(live.cars[c], kept.cars[c]);
  }
  const sparks = live.sparks;
  kept.sparks.count = sparks.count;
  for (let i = 0; i < sparks.count; i++) {
    kept.sparks.at[i] = sparks.at[i];
    kept.sparks.carType[i] = sparks.carType[i];
    kept.sparks.x[i] = sparks.x[i];
    kept.sparks.y[i] = sparks.y[i];
    kept.sparks.z[i] = sparks.z[i];
    kept.sparks.sx[i] = sparks.sx[i];
    kept.sparks.sy[i] = sparks.sy[i];
    kept.sparks.sz[i] = sparks.sz[i];
    kept.sparks.kind[i] = sparks.kind[i];
  }
  for (let i = 0; i < TAPE_TICKS; i++) {
    kept.checkpoint[i] = live.checkpoint[i];
    kept.lastCheck[i] = live.lastCheck[i];
  }
  recording.highlight = kind;
  recording.highlightCar = game.player;
}

// what the highlight replay plays of a car's ticks
const KEPT_PER_TICK = [
  "x",
  "y",
  "z",
  "xy",
  "xz",
  "zy",
  "wzy",
  "wxz",
  "speedX",
  "speedY",
  "speedZ",
];
export const HIT = ["hitAt", "hitMtouch", "hitSide", "hitPoint", "hitMag"];
export const DUST = [
  "dustAt",
  "dustGround",
  "dustWheel",
  "dustX",
  "dustY",
  "dustZ",
  "dustSpeedX",
  "dustSpeedZ",
  "dustSize",
  "dustTilt",
  "dustCapsized",
];

const copyCarTape = (from, to) => {
  for (const field of KEPT_PER_TICK) {
    for (let i = 0; i < TAPE_TICKS; i++) {
      to[field][i] = from[field][i];
    }
  }
  to.hitCount = from.hitCount;
  to.fixCount = from.fixCount;
  to.dustCount = from.dustCount;
  to.wastedAt = from.wastedAt;
  for (const field of HIT) {
    for (let i = 0; i < to.hitCount; i++) {
      to[field][i] = from[field][i];
    }
  }
  for (let i = 0; i < to.fixCount; i++) {
    to.fixAt[i] = from.fixAt[i];
  }
  for (const field of DUST) {
    for (let i = 0; i < to.dustCount; i++) {
      to[field][i] = from[field][i];
    }
  }
};

// the per tick fields of a live tape
export const RECORDED_PER_TICK = [
  ...KEPT_PER_TICK,
  "cameraHeading",
  "damage",
  "clear",
  "clearedPathPoint",
  "nlaps",
];

const emptyCarTape = (fields) => {
  const tape = newCarTape();
  for (const field of fields) {
    tape[field] = Array(TAPE_TICKS).fill(0);
  }
  return tape;
};

// Empty tapes for a new race; the highlight's checkpoint texts stay until a highlight
// is kept again.
export function resetRecording() {
  recording.tape.cars = [];
  recording.highlightTape.cars = [];
  for (let c = 0; c < game.carCount; c++) {
    recording.tape.cars[c] = emptyCarTape(RECORDED_PER_TICK);
    recording.highlightTape.cars[c] = emptyCarTape(KEPT_PER_TICK);
  }
  recording.tape.sparks = newSparkTape();
  recording.highlightTape.sparks = newSparkTape();
  for (let i = 0; i < TAPE_TICKS; i++) {
    recording.tape.checkpoint[i] = 0;
    recording.tape.lastCheck[i] = 0;
  }
  recording.recordedTicks = 0;
  recording.highlight = HIGHLIGHT.none;
  recording.bestPowerUp = 0;
  recording.highlightAt = 0;
  recording.otherCar = 0;
  recording.highlightCar = 0;
  recording.finishCatchTicks = 0;
}

// Records a tick of the race: every per tick field moves one back and the tick goes to
// the end, events count down; until shortly after the race is over.
export function recordTick() {
  if (raceEvents.raceOverTicks >= 100) {
    return;
  }
  for (let c = 0; c < game.carCount; c++) {
    const tape = recording.tape.cars[c];
    for (const field of RECORDED_PER_TICK) {
      const ticks = tape[field];
      for (let i = 0; i < LAST_FRAME; i++) {
        ticks[i] = ticks[i + 1];
      }
    }
    const racer = racers[c];
    tape.x[LAST_FRAME] = car[c].x;
    tape.y[LAST_FRAME] = car[c].y;
    tape.z[LAST_FRAME] = car[c].z;
    tape.xy[LAST_FRAME] = car[c].xy;
    tape.xz[LAST_FRAME] = car[c].xz;
    tape.zy[LAST_FRAME] = car[c].zy;
    tape.wzy[LAST_FRAME] = car[c].wzy;
    tape.wxz[LAST_FRAME] = car[c].wxz;
    tape.speedX[LAST_FRAME] =
      (racer.wheelSpeedX[0] +
        racer.wheelSpeedX[1] +
        racer.wheelSpeedX[2] +
        racer.wheelSpeedX[3]) /
      4;
    tape.speedY[LAST_FRAME] =
      (racer.wheelSpeedY[0] +
        racer.wheelSpeedY[1] +
        racer.wheelSpeedY[2] +
        racer.wheelSpeedY[3]) /
      4;
    tape.speedZ[LAST_FRAME] =
      (racer.wheelSpeedZ[0] +
        racer.wheelSpeedZ[1] +
        racer.wheelSpeedZ[2] +
        racer.wheelSpeedZ[3]) /
      4;
    tape.cameraHeading[LAST_FRAME] = racer.cameraHeading;
    tape.damage[LAST_FRAME] = racer.damage;
    tape.clear[LAST_FRAME] = racer.clear;
    tape.clearedPathPoint[LAST_FRAME] = racer.clearedPathPoint;
    tape.nlaps[LAST_FRAME] = racer.nlaps;
    for (let i = 0; i < tape.hitCount; i++) {
      tape.hitAt[i]--;
    }
    for (let i = 0; i < tape.fixCount; i++) {
      tape.fixAt[i]--;
    }
    for (let i = 0; i < tape.dustCount; i++) {
      tape.dustAt[i]--;
    }
    if (tape.wastedAt != NOT_WASTED) {
      tape.wastedAt--;
      if (tape.wastedAt == WASTING_CAUGHT_AT) {
        catchWasting(c, tape);
      }
    }
  }
  const sparks = recording.tape.sparks;
  for (let i = 0; i < sparks.count; i++) {
    sparks.at[i]--;
  }
  const tape = recording.tape;
  for (let i = 0; i < LAST_FRAME; i++) {
    tape.checkpoint[i] = tape.checkpoint[i + 1];
    tape.lastCheck[i] = tape.lastCheck[i + 1];
  }
  tape.checkpoint[LAST_FRAME] = raceEvents.oncheckpoint;
  tape.lastCheck[LAST_FRAME] = raceEvents.onlastcheck;
  if (recording.recordedTicks < TAPE_TICKS) {
    recording.recordedTicks++;
  }
}

// The player wasted, or the player's hit wasting another car.
const catchWasting = (c, tape) => {
  if (c == game.player) {
    catchHighlight(HIGHLIGHT.wasted);
    if (recording.highlight == HIGHLIGHT.wasted) {
      recording.highlightAt = WASTING_CAUGHT_AT - 1;
    }
  } else if (tape.playerHitTicks) {
    catchHighlight(HIGHLIGHT.wastedThemAll);
    if (recording.highlight == HIGHLIGHT.wastedThemAll) {
      recording.highlightAt = Math.floor((160 + tape.playerHitTicks) * 1.42);
      recording.otherCar = c;
    }
  }
};

const applyHit = (c, tape, i) => {
  racers[c].grounded = tape.hitMtouch[i];
  regn(tape.hitSide[i], tape.hitPoint[i], tape.hitMag[i], c);
};

// The latest fix (searching from the last one) that `matches`, as its time; 0 when there
// is none (or it was at 0).
const lastFix = (tape, matches) => {
  for (let i = tape.fixCount - 1; i >= 0; i--) {
    if (matches(tape.fixAt[i])) {
      return tape.fixAt[i];
    }
  }
  return 0;
};

// Dents the car again with the hits that `matches`, except those its last fix repaired.
const reapplyHits = (c, tape, fixedAt, matches) => {
  for (let i = 0; i < tape.hitCount; i++) {
    if (matches(tape.hitAt[i]) && !(fixedAt && tape.hitAt[i] < fixedAt)) {
      applyHit(c, tape, i);
    }
  }
};

// The cars as at the start of the tape: whole, with the hits before it since their last
// fix before it; wasted ones handled by onWasted.
const resetCarsToTapeStart = (tape, onWasted) => {
  for (let c = 0; c < game.carCount; c++) {
    const racer = racers[c];
    racer.destnow = false;
    racer.cntdest = 0;
    racer.embos = 0;
    racer.embodir = 0;
    racer.squash = 0;
    racer.nbsq = 0;
    car[c].fcnt = 0;
    fixcar(c);
    racer.body.alpha = BLEND.alpha;
    const carTape = tape.cars[c];
    if (carTape.wastedAt < 0) {
      onWasted(c);
    }
    const fixedAt = lastFix(carTape, (at) => at < 0);
    reapplyHits(c, carTape, fixedAt, (at) => at < 0);
  }
};

// The wreck burns from the start of the replay on.
const burningFromTheStart = (c) => {
  racers[c].destnow = true;
  racers[c].cntdest = 7;
};

export function startReplay() {
  game.phase = PHASE.replayRewind;
  recording.frame = 0;
  camera.mode = CAMERA.orbit;
  camera.target = game.player;
  resetCarsToTapeStart(recording.tape, burningFromTheStart);
  game.phase = PHASE.replay;
}

export function replayTick() {
  playTape(recording.tape, false);
  if (recording.frame == LAST_FRAME) {
    game.phase = PHASE.paused;
    camera.mode = CAMERA.behind;
    camera.target = game.player;
    recording.frame = 0;
  } else {
    recording.frame++;
  }
}

// Leaves the instant replay for the race as it was: wastings, fixes and hits still to
// come in the replay happen at once, and the cars go back to where they are.
export function skipReplay() {
  game.phase = PHASE.replayRewind;
  for (let c = 0; c < game.carCount; c++) {
    const tape = recording.tape.cars[c];
    if (tape.wastedAt != NOT_WASTED && tape.wastedAt >= recording.frame) {
      racers[c].embos = 0;
      racers[c].cntdest = 7;
    }
    const fixedAt = lastFix(tape, (at) => at >= recording.frame);
    if (fixedAt) {
      racers[c].squash = 0;
      racers[c].nbsq = 0;
      car[c].fcnt = 0;
      fixcar(c);
    }
    reapplyHits(c, tape, fixedAt, (at) => at >= recording.frame);
    poseFromTape(c, tape, LAST_FRAME);
  }
  camera.mode = CAMERA.behind;
  camera.target = game.player;
  game.phase = PHASE.paused;
}

export function startHighlight() {
  game.phase = PHASE.replayRewind;
  recording.frame = 0;
  resetCarsToTapeStart(recording.highlightTape, burningFromTheStart);
  recording.held = 0;
  recording.holdTicks = 0;
  if (recording.highlight == HIGHLIGHT.stunt) {
    recording.holdTicks = random.fx() > random.fx() ? 98 : 43;
  }
  if (recording.highlight == HIGHLIGHT.wasted) {
    recording.holdTicks = 95;
    camera.orbitAngle += 90;
  }
  game.phase = PHASE.highlights;
}

export function highlightTick() {
  playTape(recording.highlightTape, recording.frozen);
}

// A frame of a tape: the cars where they were, with their wasting, fixes, hits, dust and
// sparks happening again. A frozen frame lets neither the burning nor the hits move on.
const playTape = (tape, frozen) => {
  const frame = recording.frame;
  for (let c = 0; c < game.carCount; c++) {
    const carTape = tape.cars[c];
    if (carTape.wastedAt == frame) {
      racers[c].destnow = true;
    }
    if (racers[c].destnow) {
      burnWreck(c, carTape, frozen);
    }
    if (!car[c].fcnt) {
      for (let i = 0; i < carTape.fixCount; i++) {
        if (carTape.fixAt[i] == frame) {
          car[c].fcnt = 20;
        }
      }
    } else {
      flickerWhileFixing(c);
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
    if (!frozen) {
      for (let i = 0; i < carTape.hitCount; i++) {
        if (carTape.hitAt[i] == frame) {
          applyHit(c, carTape, i);
        }
      }
    }
    for (let i = 0; i < carTape.dustCount; i++) {
      if (carTape.dustAt[i] == frame) {
        dustup(
          carTape.dustGround[i],
          c,
          carTape.dustWheel[i],
          carTape.dustX[i],
          carTape.dustY[i],
          carTape.dustZ[i],
          carTape.dustSpeedX[i],
          carTape.dustSpeedZ[i],
          carTape.dustSize[i],
          carTape.dustTilt[i],
          carTape.dustCapsized[i],
        );
      }
    }
    poseFromTape(c, carTape, frame);
    turnCarAfterItsAngles(c);
    // a wreck about to burst is stretched along one axis
    const racer = racers[c];
    if (racer.embodir) {
      car[c].mat[racer.embodir * 4] *= racer.embomag;
      car[c].mat[racer.embodir * 4 + 1] *= racer.embomag;
      car[c].mat[racer.embodir * 4 + 2] *= racer.embomag;
    }
  }
  const sparks = tape.sparks;
  for (let i = 0; i < sparks.count; i++) {
    if (sparks.at[i] == frame) {
      sprks(
        sparks.carType[i],
        sparks.x[i],
        sparks.y[i],
        sparks.z[i],
        sparks.sx[i],
        sparks.sy[i],
        sparks.sz[i],
        sparks.kind[i],
      );
    }
  }
  raceEvents.oncheckpoint = tape.checkpoint[frame];
  raceEvents.onlastcheck = tape.lastCheck[frame];
};

// A wasted car blinks and stretches six times, bursts into chips, then burns (darkening
// its texture 17 times) with fire flying off along its speed on the tape.
const burnWreck = (c, carTape, frozen) => {
  const racer = racers[c];
  if (racer.cntdest < 6) {
    if (racer.embos == 0) {
      racer.body.alpha = BLEND.alpha;
      racer.embodir = Math.floor(random.fx() * 3);
      if (racer.embodir == 3) {
        racer.embodir = 0;
      }
      racer.embomag = 1.2 + random.fx() * 0.2;
    }
    if (racer.embos == 1) {
      racer.body.alpha = BLEND.glow;
    }
    racer.embos++;
    if (racer.embos == 2) {
      racer.embos = 0;
      if (!frozen) {
        racer.cntdest++;
      }
    }
    return;
  }
  if (racer.cntdest == 6) {
    racer.body.alpha = BLEND.alpha;
    racer.embodir = 0;
    chipburn(c);
    racer.embos = 0;
    racer.cntdest = 7;
  }
  const frame = recording.frame;
  firexp(
    c,
    carTape.speedX[frame],
    carTape.speedY[frame],
    carTape.speedZ[frame],
  );
  if (racer.cntdest < 24) {
    racer.embos++;
    if (racer.embos == 5) {
      burn(c);
      racer.embos = 0;
      racer.cntdest++;
    }
  }
};

// A car being fixed crackles with electricity and flashes now and then.
const flickerWhileFixing = (c) => {
  raceEvents.onelec = true;
  racers[c].body.alpha = BLEND.alpha;
  if (car[c].fcnt % 2 == 0 && random.fx() > 0.333) {
    racers[c].body.alpha =
      random.fx() > random.fx() ? BLEND.brightGlow : BLEND.glow;
  }
};

const poseFromTape = (c, carTape, frame) => {
  car[c].x = carTape.x[frame];
  car[c].y = carTape.y[frame];
  car[c].z = carTape.z[frame];
  car[c].xy = carTape.xy[frame];
  car[c].xz = carTape.xz[frame];
  car[c].zy = carTape.zy[frame];
  car[c].wzy = carTape.wzy[frame];
  car[c].wxz = carTape.wxz[frame];
};

const turnCarAfterItsAngles = (c) => {
  const across = [1, 0, 0];
  const up = [0, 1, 0];
  const along = [0, 0, 1];
  rotateAxes(across, up, car[c].xy);
  rotateAxes(up, along, car[c].zy);
  rotateAxes(across, along, car[c].xz);
  const m = car[c].mat;
  m[0] = across[0];
  m[1] = up[0];
  m[2] = along[0];
  m[4] = across[1];
  m[5] = up[1];
  m[6] = along[1];
  m[8] = across[2];
  m[9] = up[2];
  m[10] = along[2];
};

// Rewinding time plays the tape backwards from its end, twice as fast while far from its
// start, and the race goes on from where it stops.
export function startTimeRewind() {
  recording.frame = LAST_FRAME;
  camera.mode = CAMERA.behind;
  camera.target = game.player;
  game.phase = PHASE.replayRewind;
  resetCarsToTapeStart(recording.tape, (c) => {
    // burnt as at the end of the tape
    for (let i = 0; i < 16; i++) {
      burn(c);
    }
  });
  resumeStageMusic();
  raceEvents.screenTicks = 0;
  game.phase = PHASE.timeRewind;
}

export function timeRewindTick() {
  const start = LAST_FRAME - recording.recordedTicks;
  const fast = Math.abs(recording.frame - start) > 100;
  const frame = recording.frame;
  for (let c = 0; c < game.carCount; c++) {
    const carTape = recording.tape.cars[c];
    if (frame > carTape.wastedAt) {
      firexp(
        c,
        carTape.speedX[frame],
        carTape.speedY[frame],
        carTape.speedZ[frame],
      );
    }
    if (!car[c].fcnt) {
      // backwards, the flicker shows where a fix ended
      for (let i = 0; i < carTape.fixCount; i++) {
        if (frame == carTape.fixAt[i] + 28 || frame == carTape.fixAt[i] + 27) {
          car[c].fcnt = 20;
        }
      }
    } else {
      flickerWhileFixing(c);
      if (fast && car[c].fcnt != 2) {
        if (tick.fraction >= tick.scale) {
          car[c].fcnt -= 2;
        }
      } else if (tick.fraction >= tick.scale) {
        car[c].fcnt--;
      }
      if (car[c].fcnt < 0) {
        car[c].fcnt = 0;
      }
    }
    poseFromTape(c, carTape, frame);
    const racer = racers[c];
    racer.roll = car[c].xy;
    racer.pitch = car[c].zy;
    for (let k = 0; k < 4; k++) {
      racer.wheelSpeedX[k] = carTape.speedX[frame];
      racer.wheelSpeedY[k] = carTape.speedY[frame];
      racer.wheelSpeedZ[k] = carTape.speedZ[frame];
    }
    racer.damage = carTape.damage[frame];
    racer.clear = carTape.clear[frame];
    racer.clearedPathPoint = carTape.clearedPathPoint[frame];
    racer.nlaps = carTape.nlaps[frame];
    racer.cameraHeading = carTape.cameraHeading[frame];
    turnCarAfterItsAngles(c);
  }
  raceEvents.oncheckpoint = recording.tape.checkpoint[frame];
  raceEvents.onlastcheck = recording.tape.lastCheck[frame];
  recording.frame -= fast ? 2 : 1;
  if (recording.frame <= start) {
    recording.resumedFrom = frame;
    backToTheRace();
  }
}

// The race goes on from the start of the tape: cars wasted on it are whole again.
const backToTheRace = () => {
  for (let c = 0; c < game.carCount; c++) {
    resetPursuit(c);
    racers[c].focus = -1;
    racers[c].missedCheckpoint = MISSED.none;
    racers[c].nofocus = false;
    racers[c].body.alpha = BLEND.alpha;
    if (recording.tape.cars[c].wastedAt > 0) {
      racers[c].wasted = false;
      recording.tape.cars[c].wastedAt = NOT_WASTED;
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
};
