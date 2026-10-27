// The sounds of a replay, of the car it follows: its engine as it ran (from the race
// tape's speed, power and engine bits, see race/raceTape.js), and its crashes, scrapes,
// skids, fixes and wasting as the race played them.

import { game } from "../core/state.js";
import { ENGINE_BITS, raceTape } from "../race/raceTape.js";
import { SKID } from "../race/racers.js";
import { camera } from "../render/camera.js";
import { isEngineLoaded, loadEngine, playSound, stopEngine } from "./audio.js";
import { crashSound, scrapeSound, skidSound } from "./carSounds.js";
import { updateEngineSound } from "./engineSound.js";

// the race played on further than this a tick (jumped, or wound fast): no sounds of it
const MOST_FRAMES_HEARD = 4;
// how near the car sparks fly that it scrapes
const SCRAPE_REACH = 60;
// the ticks after its wasting the burst of flames is heard (as the race's HUD has them)
const WASTED_FLAMES_AFTER = 16;
// sounds as the race played them (see audio.js)
const SOUND = { fixed: 29, flames: 30, wasted: 31 };

// the car type the engine plays
let engineType = -1;

// The car as the engine sound reads it, at the frame of its tape. Its wheels slip as
// recorded: pushed unevenly, or not.
const carAt = (tape, frame) => {
  const bits = tape.engine[frame];
  const has = (bit) => (bits & bit) != 0;
  return {
    speed: tape.speed[frame],
    power: tape.power[frame],
    grounded: has(ENGINE_BITS.grounded),
    wheelsTouch: has(ENGINE_BITS.wheelsTouch),
    capsized: has(ENGINE_BITS.capsized),
    skid: has(ENGINE_BITS.sliding) ? SKID.sliding : -1,
    u: {
      up: has(ENGINE_BITS.up),
      down: has(ENGINE_BITS.down),
      handb: has(ENGINE_BITS.handbrake),
    },
    wheelSpeedX: [0, 0, 0, 0],
    wheelSpeedZ: has(ENGINE_BITS.slipping) ? [1, 0, 0, 0] : [0, 0, 0, 0],
  };
};

// a hit's crash, as the race's regn made it: what is over 10 of its strength
const crash = (mag) => crashSound(mag > 0 ? mag - 10 : mag + 10, 0);

// The events of the frame, of car c.
const eventsAt = (c, frame) => {
  const tape = raceTape.cars[c];
  for (let i = 0; i < tape.hitCount; i++) {
    if (tape.hitAt[i] == frame && Math.abs(tape.hitMag[i]) > 10) {
      crash(tape.hitMag[i]);
    }
  }
  if (tape.fixAt.includes(frame)) {
    playSound(SOUND.fixed, 1);
  }
  if (tape.wastedAt == frame) {
    playSound(SOUND.wasted, 1);
  }
  if (tape.wastedAt + WASTED_FLAMES_AFTER == frame) {
    playSound(SOUND.flames, 1);
  }
  for (let i = 0; i < tape.dustCount; i++) {
    if (tape.dustAt[i] == frame && !tape.dustCapsized[i]) {
      skidSound(
        tape.dustGround[i],
        false,
        Math.hypot(tape.dustSpeedX[i], tape.dustSpeedZ[i]),
      );
    }
  }
  const sparks = raceTape.sparks;
  for (let i = 0; i < sparks.count; i++) {
    if (
      sparks.at[i] == frame &&
      sparks.carType[i] == game.carTypes[c] &&
      Math.hypot(sparks.x[i] - tape.x[frame], sparks.z[i] - tape.z[frame]) <
        SCRAPE_REACH
    ) {
      scrapeSound(sparks.sx[i], sparks.sy[i], sparks.sz[i]);
    }
  }
};

// A tick of the replay that went from frame `from` to `to`; playing: it plays on.
export const replaySoundsTick = (from, to, playing) => {
  const c = camera.target;
  const type = game.carTypes[c];
  if (!playing || !raceTape.cars[c].engine) {
    stopEngine();
    return;
  }
  if (type != engineType) {
    stopEngine();
    engineType = type;
  }
  if (!isEngineLoaded(type)) {
    loadEngine(type);
  }
  updateEngineSound(carAt(raceTape.cars[c], to), type, false);
  if (to > from && to - from <= MOST_FRAMES_HEARD) {
    for (let frame = from + 1; frame <= to; frame++) {
      eventsAt(c, frame);
    }
  }
};

export const stopReplaySounds = () => {
  stopEngine();
  engineType = -1;
};
