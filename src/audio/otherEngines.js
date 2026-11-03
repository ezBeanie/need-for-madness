// The other cars' engines while the other cars are heard (audio.otherCars): each from where
// its car is, quieter the farther; in the modern look its pitch rising with its speed, in
// the classic look the original's loop for its gear. The player's own is engineSound.js's.

import { PHASE, game } from "../core/state.js";
import { carStats } from "../data/carStats.js";
import { car, racers } from "../race/racers.js";
import { heardFrom } from "../render/camera.js";
import { LOOK, look } from "../render/look.js";
import { classicEngineFileOf } from "../classic/sounds.js";
import {
  audio,
  placeSound,
  startPlacedClassicLoop,
  startPlacedEngine,
} from "./audio.js";

// how far an engine is heard: fully up to NEAR, fading out at FAR
const NEAR = 100;
const FAR = 2000;
// as loud as the player's engine, near, at full speed
const LOUDEST = 1;

// by car: the engine playing, if any, and its loop (the classic look's file, or the
// modern look's engine)
const engines = [];
const MODERN = "modern";

const stop = (c) => {
  engines[c]?.source.stop();
  engines[c]?.panner.disconnect();
  engines[c] = null;
};

// Every tick.
export const otherEnginesTick = () => {
  const heard = game.phase == PHASE.race && audio.otherCars && !audio.muteSound;
  const classic = look.current == LOOK.classic;
  for (let c = 0; c < Math.max(engines.length, game.carCount); c++) {
    const type = game.carTypes[c];
    const place = c < game.carCount && heardFrom(car[c].x, car[c].z);
    if (
      !heard ||
      !place ||
      c == game.player ||
      racers[c].wasted ||
      place.distance >= FAR
    ) {
      stop(c);
      continue;
    }
    const loop = classic ? classicEngineFileOf(racers[c], type) : MODERN;
    if (engines[c] && engines[c].loop != loop) {
      stop(c);
    }
    engines[c] ??= classic
      ? startPlacedClassicLoop(loop)
      : startPlacedEngine(type);
    const engine = engines[c];
    if (!engine) {
      continue;
    }
    engine.loop = loop;
    const speed = Math.min(
      1,
      Math.abs(racers[c].speed) / carStats.swits[type][2],
    );
    const near = Math.min(1, (FAR - place.distance) / (FAR - NEAR));
    if (classic) {
      engine.volume.gain.value = LOUDEST * near;
    } else {
      engine.volume.gain.value = LOUDEST * near * (0.5 + 0.5 * speed);
      engine.source.playbackRate.value =
        1 + 1.2 * speed * carStats.engrev[type];
    }
    placeSound(engine.panner, place.side, place.front);
  }
};
