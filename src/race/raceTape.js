// The whole race, tick by tick from its start: what the replay viewer plays and a replay
// file holds. Each tick it takes what recording's tape (the last ticks only, see
// recording.js) got: the cars' places and the events of that tick, which happen at the
// tick's number here. Its shape is the shape of that tape, so it plays the same way.

import { game } from "../core/state.js";
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
export { DUST, HIT, RECORDED_PER_TICK };

const newRaceCarTape = () => {
  const tape = newCarTape();
  for (const field of RECORDED_PER_TICK) {
    tape[field] = [];
  }
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
    for (const field of RECORDED_PER_TICK) {
      tape[field].length = length;
    }
    cutEvents(tape, HIT, "hitCount", length);
    cutEvents(tape, ["fixAt"], "fixCount", length);
    cutEvents(tape, DUST, "dustCount", length);
    if (tape.wastedAt >= length) {
      tape.wastedAt = NEVER_WASTED;
    }
  }
  cutEvents(raceTape.sparks, SPARK, "count", length);
  raceTape.checkpoint.length = length;
  raceTape.lastCheck.length = length;
  raceTape.length = length;
};
