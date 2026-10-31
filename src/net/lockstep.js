// Racing together by sending each other only the keys: every game computes the whole race
// alike (see raceState.js and test/sharedRace.test.js), the cars of its people driven by
// their keys. The keys pressed in a tick of the race (a frame) drive INPUT_DELAY frames
// later, in every game alike. A game whose keys of a frame from another game are not there
// yet guesses them (the ones pressed last) and races on; guessed wrong, it goes back to that
// frame and computes the frames since again, quietly, with the right ones (rollback). A game
// too far ahead of another's keys waits for them. Every so many frames, the games compare
// fingerprints of their races: a race that went apart in one stays apart.

import { nextFraction, tick } from "../core/tick.js";
import { raceEvents } from "../race/events.js";
import { physics } from "../race/physics.js";
import { cutRaceTapeTo, raceTape } from "../race/raceTape.js";
import { racers } from "../race/racers.js";
import { keepRecording, restoreRecording } from "../race/recording.js";
import { MESSAGE, ROLE, decode, encode, isIndex, link } from "./link.js";
import { restoreRace, saveRace, sharedRace } from "./raceState.js";

// 35 ms for the keys to reach the other game before they drive
export const INPUT_DELAY = 1;
// how many frames a game races on with the other's keys guessed (280 ms) before it waits
export const MAX_GUESSED = 8;
export const KEYS = ["up", "down", "left", "right", "handb"];
const NONE = Object.fromEntries(KEYS.map((key) => [key, false]));

// 1 s of the race between fingerprints
export const SYNC_EVERY = 30;
// how long a fingerprint waits for the others' (10 s): a game gone sends none
const PRINT_KEPT_FRAMES = 10 * SYNC_EVERY;
export const OUT_OF_SYNC = "Out of sync!";

// what a game waiting for the other one's keys says
export const WAITING = {
  [ROLE.host]: "Waiting for the guest...",
  [ROLE.guest]: "Waiting for the host...",
};

// own: the car of this game's player; ownKeys: its keys by frame; otherKeys: the other
// players' keys by car, by frame; lastOther: their last keys there, and their frame, by
// car; guessed: the others' keys guessed, by frame, by car, until they come; kept: the race
// as it was before each of those frames; atFirstFrame: what starts the race alike in all
// games; unsentPrints: the fingerprints of frames that ran on guessed keys, by frame, sent
// once the guesses were right; ownPrints: the fingerprints by frame, and otherPrints: the
// others', by frame, by car, until compared; apartAt: the first frame the fingerprints
// differed at (-1 none), apartWith: the car of the game whose differed, apartRace: this
// game's race then, otherApart: the parts of that game's that came, and differences: what
// differs in it (once all came)
export const lockstep = {
  active: false,
  frame: 0,
  own: 0,
  ownKeys: new Map(),
  otherKeys: new Map(),
  lastOther: new Map(),
  guessed: new Map(),
  kept: new Map(),
  atFirstFrame: null,
  unsentPrints: new Map(),
  ownPrints: new Map(),
  otherPrints: new Map(),
  apartAt: -1,
  apartWith: -1,
  apartRace: null,
  otherApart: [],
  differences: [],
};

// the own car's keys as the player holds them, while the car drives with the frame's
let held = NONE;

const keysOf = (keys) =>
  Object.fromEntries(KEYS.map((key) => [key, keys[key] === true]));

const sameKeys = (keys, others) =>
  KEYS.every((key) => keys[key] == others[key]);

// (the first frames drive with no keys: none were pressed INPUT_DELAY frames before)
const keysAt = (keys, frame) => (frame < INPUT_DELAY ? NONE : keys.get(frame));

// The race begins, own the player's car among the cars of all players.
export const startLockstep = (own, cars, atFirstFrame) => {
  const others = cars.filter((car) => car != own);
  Object.assign(lockstep, {
    active: true,
    frame: 0,
    own,
    ownKeys: new Map(),
    otherKeys: new Map(others.map((car) => [car, new Map()])),
    lastOther: new Map(
      others.map((car) => [car, { frame: INPUT_DELAY - 1, keys: NONE }]),
    ),
    guessed: new Map(),
    kept: new Map(),
    atFirstFrame,
    unsentPrints: new Map(),
    ownPrints: new Map(),
    otherPrints: new Map(),
    apartAt: -1,
    apartWith: -1,
    apartRace: null,
    otherApart: [],
    differences: [],
  });
};

export const stopLockstep = () => {
  lockstep.active = false;
};

// Another player's keys of a frame (checked: another game sent them).
export const receiveKeys = ({ car, frame, keys }) => {
  const last = lockstep.lastOther.get(car);
  if (
    last &&
    Number.isInteger(frame) &&
    frame > last.frame &&
    keys &&
    typeof keys == "object"
  ) {
    const given = { frame, keys: keysOf(keys) };
    lockstep.lastOther.set(car, given);
    lockstep.otherKeys.get(car).set(frame, given.keys);
  }
};

// FNV-1a over the race's every bit (encode keeps -0, NaN and the infinities apart)
const fingerprint = (text) => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
};

// a race of 20 dented cars is about 500 kB, the relay takes 256 kB a message at most
const APART_PART_LENGTH = 64 * 1024;
const MOST_APART_PARTS = 64;

// The own fingerprint of a frame and others' there: whether the races went apart.
const compare = (frame) => {
  const own = lockstep.ownPrints.get(frame);
  const others = lockstep.otherPrints.get(frame);
  if (own === undefined || others === undefined) {
    return;
  }
  lockstep.otherPrints.delete(frame);
  for (const [car, print] of others) {
    if (print != own.print && lockstep.apartAt < 0) {
      lockstep.apartAt = frame;
      lockstep.apartWith = car;
      lockstep.apartRace = own.race;
      const parts = Math.ceil(own.race.length / APART_PART_LENGTH);
      for (let part = 0; part < parts; part++) {
        const start = part * APART_PART_LENGTH;
        const race = own.race.slice(start, start + APART_PART_LENGTH);
        link.send({
          type: MESSAGE.apart,
          car: lockstep.own,
          frame,
          part,
          parts,
          race,
        });
      }
      console.warn(`The races went apart at frame ${frame}`);
    }
  }
};

const MOST_DIFFERENCES = 20;

// The paths of the values that differ between two races, with both values.
export const differencesOf = (own, other, path = "", found = []) => {
  if (found.length >= MOST_DIFFERENCES) {
    return found;
  }
  if (own && other && typeof own == "object" && typeof other == "object") {
    const keys = new Set([...Object.keys(own), ...Object.keys(other)]);
    for (const key of keys) {
      differencesOf(own[key], other[key], path ? `${path}.${key}` : key, found);
    }
  } else if (!Object.is(own, other)) {
    found.push(`${path}: ${own} here, ${other} there`);
  }
  return found;
};

// A part of another game's race at the frame the races went apart (checked: another game
// sent it): once all came, what differs is told, to find what computes apart. (Only the
// game's whose fingerprint differed first, so that the parts of two do not mix.)
export const receiveApart = ({ car, frame, part, parts, race }) => {
  const { otherApart } = lockstep;
  if (
    frame !== lockstep.apartAt ||
    car !== lockstep.apartWith ||
    !Number.isInteger(parts) ||
    parts > MOST_APART_PARTS ||
    !isIndex(part, parts) ||
    typeof race != "string"
  ) {
    return;
  }
  otherApart[part] = race;
  if (otherApart.filter((given) => given !== undefined).length == parts) {
    lockstep.differences = differencesOf(
      decode(lockstep.apartRace),
      decode(otherApart.join("")),
    );
    console.warn(
      `At frame ${frame}, the races differ in:\n${lockstep.differences.join("\n")}`,
    );
  }
};

// Another game's fingerprint of a frame (checked: another game sent it).
export const receivePrint = ({ car, frame, print }) => {
  if (
    lockstep.otherKeys.has(car) &&
    Number.isInteger(frame) &&
    Number.isInteger(print)
  ) {
    const prints = lockstep.otherPrints.get(frame) ?? new Map();
    lockstep.otherPrints.set(frame, prints.set(car, print));
    compare(frame);
  }
};

export const outOfSync = () => lockstep.active && lockstep.apartAt >= 0;

export const lockstepWaits = () =>
  lockstep.active &&
  [...lockstep.lastOther].some(
    ([car, last]) =>
      keysAt(lockstep.otherKeys.get(car), lockstep.frame) === undefined &&
      lockstep.frame - last.frame > MAX_GUESSED,
  );

// (a deep copy: the race runs on from the one it was kept from)
const keepRace = () => ({
  race: structuredClone(saveRace()),
  recording: keepRecording(),
  tapeLength: raceTape.length,
});

const restoreKept = ({ race, recording, tapeLength }) => {
  restoreRace(race);
  restoreRecording(recording);
  cutRaceTapeTo(tapeLength);
};

// The cars drive with the frame's keys, others' guessed if they are not there yet, the
// race kept to go back to. (In the countdown, the cars stand whatever the keys.)
const driveWithKeys = (frame) => {
  const guess = new Map();
  for (const [car, keys] of lockstep.otherKeys) {
    if (keysAt(keys, frame) === undefined) {
      guess.set(car, lockstep.lastOther.get(car).keys);
    }
  }
  if (guess.size > 0 && raceEvents.countdown == 0) {
    lockstep.kept.set(frame, keepRace());
    lockstep.guessed.set(frame, guess);
  }
  Object.assign(racers[lockstep.own].u, keysAt(lockstep.ownKeys, frame));
  for (const [car, keys] of lockstep.otherKeys) {
    Object.assign(racers[car].u, guess.get(car) ?? keysAt(keys, frame));
  }
};

// (the guessed frames come in order)
const firstGuessed = () => lockstep.guessed.keys().next().value ?? Infinity;

const takePrint = (frame) => {
  if (frame % SYNC_EVERY == 0) {
    const race = encode(sharedRace());
    lockstep.unsentPrints.set(frame, { print: fingerprint(race), race });
  }
};

// What came before the first frame on guessed keys stays as it is: its keys and kept
// races are let go, and its fingerprints sent.
const settle = () => {
  const settled = Math.min(firstGuessed(), lockstep.frame);
  for (const map of [
    lockstep.ownKeys,
    lockstep.kept,
    ...lockstep.otherKeys.values(),
  ]) {
    for (const frame of map.keys()) {
      if (frame < settled) {
        map.delete(frame);
      }
    }
  }
  for (const map of [lockstep.ownPrints, lockstep.otherPrints]) {
    for (const frame of map.keys()) {
      if (frame < settled - PRINT_KEPT_FRAMES) {
        map.delete(frame);
      }
    }
  }
  for (const [frame, own] of lockstep.unsentPrints) {
    if (frame < settled) {
      lockstep.unsentPrints.delete(frame);
      lockstep.ownPrints.set(frame, own);
      link.send({
        type: MESSAGE.sync,
        car: lockstep.own,
        frame,
        print: own.print,
      });
      compare(frame);
    }
  }
};

// Others' keys came for frames that ran on guessed ones: guessed wrong, the race goes back
// to the first such frame and runs again quietly up to this one (runFrameAgain: a frame of
// it, without what is seen and heard of it). (A player's keys come in order, but one's may
// come further than another's.)
const checkGuesses = (runFrameAgain) => {
  let wrongAt = -1;
  for (const [frame, guess] of lockstep.guessed) {
    for (const [car, keys] of guess) {
      const given = lockstep.otherKeys.get(car).get(frame);
      if (given !== undefined && !sameKeys(given, keys)) {
        wrongAt = frame;
        break;
      }
      if (given !== undefined) {
        guess.delete(car);
      }
    }
    if (wrongAt >= 0) {
      break;
    }
    if (guess.size == 0) {
      lockstep.guessed.delete(frame);
    }
  }
  if (wrongAt < 0) {
    return;
  }
  const now = lockstep.frame;
  restoreKept(lockstep.kept.get(wrongAt));
  for (const map of [lockstep.guessed, lockstep.kept]) {
    for (const frame of map.keys()) {
      if (frame >= wrongAt) {
        map.delete(frame);
      }
    }
  }
  physics.quiet = true;
  for (let frame = wrongAt; frame < now; frame++) {
    driveWithKeys(frame);
    runFrameAgain();
    // (as a frame run first: its fingerprint taken before the next one's fraction)
    takePrint(frame);
    tick.fraction = nextFraction(tick.fraction);
  }
  physics.quiet = false;
};

// Before the cars drive: the keys the player holds go to the other games for INPUT_DELAY
// frames on, the race goes back to where it guessed others' keys wrong, and the players'
// cars drive with the frame's keys.
export const pressFrameKeys = (runFrameAgain) => {
  if (!lockstep.active) {
    return;
  }
  const { own, frame } = lockstep;
  held = keysOf(racers[own].u);
  if (frame == 0) {
    lockstep.atFirstFrame?.();
  }
  lockstep.ownKeys.set(frame + INPUT_DELAY, held);
  link.send({
    type: MESSAGE.keys,
    car: own,
    frame: frame + INPUT_DELAY,
    keys: held,
  });
  checkGuesses(runFrameAgain);
  settle();
  driveWithKeys(frame);
};

// After the race has used them (and its fingerprint taken now and then): the own car's
// keys are the player's again, for the HUD's touch controls and the keyboard to press,
// and the next frame comes.
export const releaseFrameKeys = () => {
  if (!lockstep.active) {
    return;
  }
  takePrint(lockstep.frame);
  Object.assign(racers[lockstep.own].u, held);
  lockstep.frame++;
  settle();
};
