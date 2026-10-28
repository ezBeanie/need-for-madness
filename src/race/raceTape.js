// The whole race, tick by tick from its start: what the replay viewer plays and a replay
// file holds. Each tick it takes what recording's tape (the last ticks only, see
// recording.js) got: the cars' places and the events of that tick, which happen at the
// tick's number here. Its shape is the shape of that tape, so it plays the same way.

import { game } from "../core/state.js";
import { carSoundTape } from "./physics.js";
import { SKID, racers } from "./racers.js";
import {
  DUST,
  HIT,
  RECORDED_PER_TICK,
  TAPE_TICKS,
  newCarTape,
  recording,
} from "./recording.js";

// a car's wastedAt until it is wasted
export const NEVER_WASTED = Infinity;

// the frame recording's tape writes the tick to
const NEWEST = TAPE_TICKS - 1;

export const SPARK = ["at", "carType", "x", "y", "z", "sx", "sy", "sz", "kind"];
export { DUST, HIT };

// What the engine sound needs of a car every tick (see audio/replaySounds.js): its speed,
// power and these, as bits of one number.
export const ENGINE_BITS = {
  up: 1,
  down: 2,
  handbrake: 4,
  grounded: 8,
  wheelsTouch: 16,
  capsized: 32,
  slipping: 64,
  sliding: 128,
};
const SOUND_PER_TICK = ["speed", "power", "engine"];

// a car's scrapes, ground scrapes and skids as the race heard them (see carSoundTape in
// physics.js): when, which (CAR_SOUND) and its four values
export const SOUND = [
  "soundAt",
  "soundKind",
  "soundA",
  "soundB",
  "soundC",
  "soundD",
];

// every per tick field of the race tape
export const PER_TICK = [...RECORDED_PER_TICK, ...SOUND_PER_TICK];

// wheels pushed unevenly: the engine sound's slipping
const uneven = (push) =>
  Math.abs(push[0] - (push[1] + push[0] + push[2] + push[3]) / 4) > 0.1;

const engineBits = (racer) =>
  (racer.u.up ? ENGINE_BITS.up : 0) |
  (racer.u.down ? ENGINE_BITS.down : 0) |
  (racer.u.handb ? ENGINE_BITS.handbrake : 0) |
  (racer.grounded ? ENGINE_BITS.grounded : 0) |
  (racer.wheelsTouch ? ENGINE_BITS.wheelsTouch : 0) |
  (racer.capsized ? ENGINE_BITS.capsized : 0) |
  (uneven(racer.wheelSpeedZ) || uneven(racer.wheelSpeedX)
    ? ENGINE_BITS.slipping
    : 0) |
  (racer.skid == SKID.sliding ? ENGINE_BITS.sliding : 0);

const newRaceCarTape = () => {
  const tape = newCarTape();
  for (const field of PER_TICK) {
    tape[field] = [];
  }
  for (const field of SOUND) {
    tape[field] = [];
  }
  tape.soundCount = 0;
  tape.wastedAt = NEVER_WASTED;
  return tape;
};

const newSparks = () => {
  const sparks = { count: 0 };
  for (const field of SPARK) {
    sparks[field] = [];
  }
  return sparks;
};

export const raceTape = {
  // the ticks recorded
  length: 0,
  cars: [],
  sparks: newSparks(),
  checkpoint: [],
  lastCheck: [],
};

export const resetRaceTape = (carCount = game.carCount) => {
  raceTape.length = 0;
  raceTape.cars = Array.from({ length: carCount }, newRaceCarTape);
  raceTape.sparks = newSparks();
  raceTape.checkpoint = [];
  raceTape.lastCheck = [];
};

// Copies entry i of the fields from one tape's arrays to the end of another's, at tick at.
const addEvent = (from, i, to, fields, count, at) => {
  const k = to[count];
  for (const field of fields) {
    to[field][k] = from[field][i];
  }
  to[fields[0]][k] = at;
  to[count]++;
};

// a car's sound in the tick being raced: it is the tick recordRaceTick records next
carSoundTape.record = (c, kind, a, b, cc, d) => {
  const tape = raceTape.cars[c];
  const k = tape.soundCount++;
  [raceTape.length, kind, a, b, cc, d].forEach(
    (value, i) => (tape[SOUND[i]][k] = value),
  );
};

// After recording's tick: that tick and its events.
export const recordRaceTick = () => {
  const at = raceTape.length;
  const live = recording.tape;
  for (let c = 0; c < raceTape.cars.length; c++) {
    const from = live.cars[c];
    const to = raceTape.cars[c];
    for (const field of RECORDED_PER_TICK) {
      to[field][at] = from[field][NEWEST];
    }
    const racer = racers[c];
    to.speed[at] = racer.speed;
    to.power[at] = racer.power;
    to.engine[at] = engineBits(racer);
    for (let i = 0; i < from.hitCount; i++) {
      if (from.hitAt[i] == NEWEST) {
        addEvent(from, i, to, HIT, "hitCount", at);
      }
    }
    for (let i = 0; i < from.fixCount; i++) {
      if (from.fixAt[i] == NEWEST) {
        addEvent(from, i, to, ["fixAt"], "fixCount", at);
      }
    }
    for (let i = 0; i < from.dustCount; i++) {
      if (from.dustAt[i] == NEWEST) {
        addEvent(from, i, to, DUST, "dustCount", at);
      }
    }
    if (from.wastedAt == NEWEST) {
      to.wastedAt = at;
    }
  }
  const sparks = live.sparks;
  for (let i = 0; i < sparks.count; i++) {
    if (sparks.at[i] == NEWEST) {
      addEvent(sparks, i, raceTape.sparks, SPARK, "count", at);
    }
  }
  raceTape.checkpoint[at] = live.checkpoint[NEWEST];
  raceTape.lastCheck[at] = live.lastCheck[NEWEST];
  raceTape.length++;
};

// Keeps only events before tick length.
const cutEvents = (tape, fields, count, length) => {
  let kept = 0;
  for (let i = 0; i < tape[count]; i++) {
    if (tape[fields[0]][i] < length) {
      for (const field of fields) {
        tape[field][kept] = tape[field][i];
      }
      kept++;
    }
  }
  tape[count] = kept;
  for (const field of fields) {
    tape[field].length = kept;
  }
};

// Time wound back: the race goes on from frame of recording's tape, what came after it
// never happened.
export const cutRaceTape = (frame) => {
  const length = raceTape.length - NEWEST + frame;
  if (length < 0 || length >= raceTape.length) {
    return;
  }
  for (const tape of raceTape.cars) {
    for (const field of PER_TICK) {
      tape[field].length = length;
    }
    cutEvents(tape, HIT, "hitCount", length);
    cutEvents(tape, ["fixAt"], "fixCount", length);
    cutEvents(tape, DUST, "dustCount", length);
    cutEvents(tape, SOUND, "soundCount", length);
    if (tape.wastedAt >= length) {
      tape.wastedAt = NEVER_WASTED;
    }
  }
  cutEvents(raceTape.sparks, SPARK, "count", length);
  raceTape.checkpoint.length = length;
  raceTape.lastCheck.length = length;
  raceTape.length = length;
};
