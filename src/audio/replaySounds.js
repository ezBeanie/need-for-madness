// The sounds of a replay: the followed car's engine as it ran (from the race tape's speed,
// power and engine bits, see race/raceTape.js), its fixes and wasting, and the crashes,
// scrapes and skids of all cars as the race played them.

import { game } from "../core/state.js";
import { ENGINE_BITS, raceTape } from "../race/raceTape.js";
import { CAR_SOUND } from "../race/physics.js";
import { SKID } from "../race/racers.js";
import { camera } from "../render/camera.js";
import { isEngineLoaded, loadEngine, playSound, stopEngine } from "./audio.js";
import {
  crashSound,
  groundScrapeSound,
  scrapeSound,
  skidSound,
} from "./carSounds.js";
import { updateEngineSound } from "./engineSound.js";

// the race played on further than this a tick (jumped, or wound fast): no sounds of it
const MOST_FRAMES_HEARD = 4;
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
const crash = (mag, heardAs) =>
  crashSound(mag > 0 ? mag - 10 : mag + 10, 0, heardAs);

// The events of the frame, of car c: the followed car's as the player's own, the other
// cars' heard from where they are (see carSounds.js).
const eventsAt = (c, frame) => {
  const tape = raceTape.cars[c];
  const followed = c == camera.target;
  const heardAs = followed ? null : c;
  for (let i = 0; i < tape.hitCount; i++) {
    if (tape.hitAt[i] == frame && Math.abs(tape.hitMag[i]) > 10) {
      crash(tape.hitMag[i], heardAs);
    }
  }
  if (followed && tape.fixAt.includes(frame)) {
    playSound(SOUND.fixed, 1);
  }
  if (followed && tape.wastedAt == frame) {
    playSound(SOUND.wasted, 1);
  }
  if (followed && tape.wastedAt + WASTED_FLAMES_AFTER == frame) {
    playSound(SOUND.flames, 1);
  }
  // its scrapes and skids as the race played them (see carSoundTape in physics.js)
  for (let i = 0; i < tape.soundCount; i++) {
    if (tape.soundAt[i] == frame) {
      const [a, b, cc, d] = [
        tape.soundA[i],
        tape.soundB[i],
        tape.soundC[i],
        tape.soundD[i],
      ];
      if (tape.soundKind[i] == CAR_SOUND.scrape) {
        scrapeSound(b, cc, d, heardAs);
      } else if (tape.soundKind[i] == CAR_SOUND.groundScrape) {
        groundScrapeSound(a, b, cc, d, heardAs);
      } else {
        skidSound(a, b == 1, cc, heardAs);
      }
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
      for (let other = 0; other < raceTape.cars.length; other++) {
        eventsAt(other, frame);
      }
    }
  }
};

export const stopReplaySounds = () => {
  stopEngine();
  engineType = -1;
};
