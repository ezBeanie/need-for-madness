// Racing together by sending each other only the keys: every game computes the whole race
// alike (see raceState.js and test/sharedRace.test.js), the cars of its people driven by
// their keys. The keys pressed in a tick of the race (a frame) drive INPUT_DELAY frames
// later, in every game alike. A game whose other keys of a frame are not there yet guesses
// them (the ones pressed last) and races on; guessed wrong, it goes back to that frame and
// computes the frames since again, quietly, with the right ones (rollback). A game too far
// ahead of the other's keys waits for them. Every so many frames, the games compare
// fingerprints of their races: a race that went apart in one stays apart.

import { raceEvents } from "../race/events.js";
import { physics } from "../race/physics.js";
import { cutRaceTapeTo, raceTape } from "../race/raceTape.js";
import { racers } from "../race/racers.js";
import { keepRecording, restoreRecording } from "../race/recording.js";
import { MESSAGE, ROLE, decode, encode, link } from "./link.js";
import { restoreRace, saveRace, sharedRace } from "./raceState.js";

// 35 ms for the keys to reach the other game before they drive
export const INPUT_DELAY = 1;
// how many frames a game races on with the other's keys guessed (280 ms) before it waits
export const MAX_GUESSED = 8;
export const KEYS = ["up", "down", "left", "right", "handb"];
const NONE = Object.fromEntries(KEYS.map((key) => [key, false]));

// 1 s of the race between fingerprints
export const SYNC_EVERY = 30;
export const OUT_OF_SYNC = "Out of sync!";

// what a game waiting for the other one's keys says
export const WAITING = {
  [ROLE.host]: "Waiting for the guest...",
  [ROLE.guest]: "Waiting for the host...",
};

// own and other: the cars of this game's player and of the other's; ownKeys and
// otherKeys: their keys by frame; lastOther: the other's last keys there, and their frame;
// guessed: the other's keys guessed by frame, until they come; kept: the race as it was
// before each of those frames; atFirstFrame: what starts the race alike in both games;
// unsentPrints: the fingerprints of frames that ran on guessed keys, by frame, sent once
// the guesses were right; ownPrints and otherPrints: the fingerprints by frame, until
// compared; apartAt: the first frame the fingerprints differed at (-1 none), apartRace:
// this game's race then, and differences: what differs in the other's (once it came)
export const lockstep = {
  active: false,
  frame: 0,
  own: 0,
  other: 0,
  ownKeys: new Map(),
  otherKeys: new Map(),
  lastOther: { frame: INPUT_DELAY - 1, keys: NONE },
  guessed: new Map(),
  kept: new Map(),
  atFirstFrame: null,
  unsentPrints: new Map(),
  ownPrints: new Map(),
  otherPrints: new Map(),
  apartAt: -1,
  apartRace: null,
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

export const startLockstep = (own, other, atFirstFrame) =>
  Object.assign(lockstep, {
    active: true,
    frame: 0,
    own,
    other,
    ownKeys: new Map(),
    otherKeys: new Map(),
    lastOther: { frame: INPUT_DELAY - 1, keys: NONE },
    guessed: new Map(),
    kept: new Map(),
    atFirstFrame,
    unsentPrints: new Map(),
    ownPrints: new Map(),
    otherPrints: new Map(),
    apartAt: -1,
    apartRace: null,
    differences: [],
  });

export const stopLockstep = () => {
  lockstep.active = false;
};

// The other game's keys of a frame (checked: another game sent them).
export const receiveKeys = ({ frame, keys }) => {
  if (
    Number.isInteger(frame) &&
    frame > lockstep.lastOther.frame &&
    keys &&
    typeof keys == "object"
  ) {
    lockstep.lastOther = { frame, keys: keysOf(keys) };
    lockstep.otherKeys.set(frame, lockstep.lastOther.keys);
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

// Both fingerprints of a frame there: whether the races went apart.
const compare = (frame) => {
  const own = lockstep.ownPrints.get(frame);
  const other = lockstep.otherPrints.get(frame);
  if (own === undefined || other === undefined) {
    return;
  }
  lockstep.ownPrints.delete(frame);
  lockstep.otherPrints.delete(frame);
  if (own.print != other && lockstep.apartAt < 0) {
    lockstep.apartAt = frame;
    lockstep.apartRace = own.race;
    link.send({ type: MESSAGE.apart, frame, race: own.race });
    console.warn(`The races went apart at frame ${frame}`);
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

// The other game's race at the frame the races went apart (checked: another game sent
// it): what differs is told, to find what computes apart.
export const receiveApart = ({ frame, race }) => {
  if (frame === lockstep.apartAt && typeof race == "string") {
    lockstep.differences = differencesOf(
      decode(lockstep.apartRace),
      decode(race),
    );
    console.warn(
      `At frame ${frame}, the races differ in:\n${lockstep.differences.join("\n")}`,
    );
  }
};

// The other game's fingerprint of a frame (checked: another game sent it).
export const receivePrint = ({ frame, print }) => {
  if (Number.isInteger(frame) && Number.isInteger(print)) {
    lockstep.otherPrints.set(frame, print);
    compare(frame);
  }
};

export const outOfSync = () => lockstep.active && lockstep.apartAt >= 0;

export const lockstepWaits = () =>
  lockstep.active &&
  keysAt(lockstep.otherKeys, lockstep.frame) === undefined &&
  lockstep.frame - lockstep.lastOther.frame > MAX_GUESSED;

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

// The cars drive with the frame's keys, the other's guessed if they are not there yet,
// the race kept to go back to. (In the countdown, the cars stand whatever the keys.)
const driveWithKeys = (frame) => {
  let otherKeys = keysAt(lockstep.otherKeys, frame);
  if (otherKeys === undefined) {
    otherKeys = lockstep.lastOther.keys;
    if (raceEvents.countdown == 0) {
      lockstep.kept.set(frame, keepRace());
      lockstep.guessed.set(frame, otherKeys);
    }
  }
  Object.assign(racers[lockstep.own].u, keysAt(lockstep.ownKeys, frame));
  Object.assign(racers[lockstep.other].u, otherKeys);
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
  for (const map of [lockstep.ownKeys, lockstep.otherKeys, lockstep.kept]) {
    for (const frame of map.keys()) {
      if (frame < settled) {
        map.delete(frame);
      }
    }
  }
  for (const [frame, own] of lockstep.unsentPrints) {
    if (frame < settled) {
      lockstep.unsentPrints.delete(frame);
      lockstep.ownPrints.set(frame, own);
      link.send({ type: MESSAGE.sync, frame, print: own.print });
      compare(frame);
    }
  }
};

// The other's keys came for frames that ran on guessed ones: guessed wrong, the race goes
// back to the first such frame and runs again quietly up to this one (runFrameAgain: a
// frame of it, without what is seen and heard of it).
const checkGuesses = (runFrameAgain) => {
  let wrongAt = -1;
  for (const [frame, guess] of lockstep.guessed) {
    const keys = lockstep.otherKeys.get(frame);
    if (keys === undefined) {
      break;
    }
    if (!sameKeys(keys, guess)) {
      wrongAt = frame;
      break;
    }
    lockstep.guessed.delete(frame);
  }
  if (wrongAt < 0) {
    return;
  }
  const now = lockstep.frame;
  restoreKept(lockstep.kept.get(wrongAt));
  lockstep.guessed.clear();
  lockstep.kept.clear();
  physics.quiet = true;
  for (let frame = wrongAt; frame < now; frame++) {
    driveWithKeys(frame);
    runFrameAgain();
    takePrint(frame);
  }
  physics.quiet = false;
};

// Before the cars drive: the keys the player holds go to the other game for INPUT_DELAY
// frames on, the race goes back to where it guessed the other's keys wrong, and both cars
// drive with the frame's keys.
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
  link.send({ type: MESSAGE.keys, frame: frame + INPUT_DELAY, keys: held });
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
