// The sounds of cars scraping, bumping, crashing and skidding. Each kind waits a few
// ticks before it plays again (see coolDownCarSounds).
//
// The player's own (and crashes into the player) sound as in the original. The other
// cars are heard too while audio.otherCars is on: from where they are, quieter the
// farther, each waiting on its own, and picking samples with random numbers of their own
// (random.sound), so hearing them never changes the race.

import { random } from "../core/random.js";
import { car } from "../race/racers.js";
import { heardFrom } from "../render/camera.js";
import { audio, playSound } from "./audio.js";

// how far another car is heard: fully up to NEAR, fading out at FAR
const NEAR = 100;
const FAR = 1500;

const newVoice = (pick, c) => ({
  pick,
  // the other car heard, or null: the player's own
  car: c,
  // ticks until a kind plays again
  groundScrapeWait: 0,
  scrapeWait: 0,
  bumpWait: [0, 0],
  crashWait: [0, 0, 0, 0],
  skidWait: 0,
  // the samples played last, not to play twice in a row
  lastCrash: [-1, -1, -1],
  lastSkids: [0, 1],
  lastDirtSkids: [0, 1],
  bumpHigh: false,
});

const own = newVoice(() => random.fx(), null);
const others = [];

// The voice of car c (null: the player's own) and where it is heard from; null when
// another car is too far away, or the others are not heard.
const voiceOf = (c) => {
  if (c === null) {
    return { voice: own, place: null };
  }
  if (!audio.otherCars) {
    return null;
  }
  const { distance, side } = heardFrom(car[c].x, car[c].z);
  if (distance >= FAR) {
    return null;
  }
  const near = Math.min(1, (FAR - distance) / (FAR - NEAR));
  others[c] ??= newVoice(() => random.sound(), c);
  return { voice: others[c], place: { volume: near * near, pan: side } };
};

// one of n samples, not the one played last
const pickOther = (voice, n, last) => {
  let k = Math.floor(voice.pick() * n);
  while (k == last) {
    k = Math.floor(voice.pick() * n);
  }
  return k;
};

// c: the other car heard (see voiceOf), null for the player's own sounds
export function groundScrapeSound(typ, sx, sy, sz, c = null) {
  const heard = voiceOf(c);
  if (!heard || heard.voice.groundScrapeWait != 0) {
    return;
  }
  const { voice, place } = heard;
  const smag = Math.sqrt(sx * sx + sy * sy + sz * sz);
  if (smag > 5) {
    const rate = Math.min(1, 0.5 + ((smag - 5) / 20) * 0.5);
    const kind = typ == 2 ? 2 : 0;
    if (voice.pick() > voice.pick()) {
      playSound(23 + kind, rate, place);
    } else {
      playSound(24 + kind, rate, place);
    }
    voice.groundScrapeWait = 5;
  }
}

export function scrapeSound(sx, sy, sz, c = null) {
  const heard = voiceOf(c);
  if (!heard || heard.voice.scrapeWait != 0) {
    return;
  }
  const { voice, place } = heard;
  if (Math.sqrt(sx * sx + sy * sy + sz * sz) > 5) {
    // (the original never remembered the last one: any may come again)
    playSound(pickOther(voice, 3, -1) + 20, 1, place);
    voice.scrapeWait = 5;
  }
}

// (only the player's: the axles bumping on the ground)
export function bumpSound(bi, bmag, typ) {
  const voice = own;
  if (voice.bumpWait[bi] == 0 && bmag > 10) {
    let rate = Math.min(0.3, ((bmag - 10) / 20) * 0.3);
    rate += typ == 2 ? 0.2 : 0.4;
    rate += 0.2 * voice.pick();
    playSound(voice.bumpHigh ? 18 : 19, rate);
    voice.bumpHigh = !voice.bumpHigh;
    voice.bumpWait[bi] = 4;
  }
}

// a crash of strength cmag; sign: 0 from the side, -1 or 1 from below (upside down or not)
export function crashSound(cmag, sign, c = null) {
  const heard = voiceOf(c);
  if (!heard) {
    return;
  }
  const { voice, place } = heard;
  const mag = Math.abs(cmag);
  if (sign == 0) {
    // low, middle and high crashes, each with three samples
    const levels = [
      [2.5, 10, 14],
      [10, 17, 11],
      [17, Infinity, 8],
    ];
    levels.forEach(([from, to, first], level) => {
      const reached = level == 0 ? mag > from : mag >= from;
      if (voice.crashWait[level] == 0 && reached && mag < to) {
        const k = pickOther(voice, 3, voice.lastCrash[level]);
        playSound(k + first, 1, place);
        voice.lastCrash[level] = k;
        voice.crashWait[level] = 3;
      }
    });
  }
  if (voice.crashWait[3] == 0) {
    if (sign == -1) {
      if (mag >= 2.5 && mag < 10) {
        playSound(15, 1, place);
      }
      if (mag >= 10 && mag < 17) {
        playSound(12, 1, place);
      }
      if (mag >= 17) {
        playSound(10, 1, place);
      }
      voice.crashWait[3] = 3;
    }
    if (sign == 1) {
      playSound(17, 1, place);
      voice.crashWait[3] = 4;
    }
  }
}

// one of four samples, none of the last two
const pickNew = (voice, last) => {
  let k = Math.floor(voice.pick() * 4);
  while (k == last[0] || k == last[1]) {
    k = Math.floor(voice.pick() * 4);
  }
  last[1] = last[0];
  last[0] = k;
  return k;
};

export function skidSound(typ, ontsk, gmag, c = null) {
  const heard = voiceOf(c);
  if (!heard || heard.voice.skidWait != 0) {
    return;
  }
  const { voice, place } = heard;
  if (gmag > 10) {
    const rate = Math.max(0.8, Math.min(1.2, (gmag - 10) * 0.0363 + 0.8));
    if (ontsk && typ == 1 && voice.pick() > voice.pick()) {
      typ = 0;
    }
    if (typ == 0) {
      playSound(pickNew(voice, voice.lastSkids), rate, place);
    } else {
      playSound(pickNew(voice, voice.lastDirtSkids) + 4, rate, place);
    }
    voice.skidWait = Math.max(5, Math.floor(voice.pick() * 20));
  }
}

const coolDown = (voice) => {
  const down = (n) => (n != 0 ? n - 1 : 0);
  voice.skidWait = down(voice.skidWait);
  voice.crashWait = voice.crashWait.map(down);
  voice.bumpWait = voice.bumpWait.map(down);
  voice.scrapeWait = down(voice.scrapeWait);
  voice.groundScrapeWait = down(voice.groundScrapeWait);
};

// Once per tick, from the engine sound.
export function coolDownCarSounds() {
  coolDown(own);
  others.forEach(coolDown);
}
