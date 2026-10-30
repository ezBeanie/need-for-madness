// Racing together by sending each other only the keys: every game computes the whole race
// alike (see raceState.js and test/sharedRace.test.js), the cars of its people driven by
// their keys. The keys pressed in a tick of the race (a frame) drive INPUT_DELAY frames
// later, in every game alike, so they have that long to reach the other one; a game
// missing the other's keys of a frame waits for them.

import { racers } from "../race/racers.js";
import { MESSAGE, ROLE, link } from "./link.js";

// 105 ms for the keys to reach the other game
export const INPUT_DELAY = 3;
export const KEYS = ["up", "down", "left", "right", "handb"];
const NONE = Object.fromEntries(KEYS.map((key) => [key, false]));

// what a game waiting for the other one's keys says
export const WAITING = {
  [ROLE.host]: "Waiting for the guest...",
  [ROLE.guest]: "Waiting for the host...",
};

// own and other: the cars of this game's player and of the other's; ownKeys and
// otherKeys: their keys by frame; atFirstFrame: what starts the race alike in both games
export const lockstep = {
  active: false,
  frame: 0,
  own: 0,
  other: 0,
  ownKeys: new Map(),
  otherKeys: new Map(),
  atFirstFrame: null,
};

// the own car's keys as the player holds them, while the car drives with the frame's
let held = NONE;

const keysOf = (keys) =>
  Object.fromEntries(KEYS.map((key) => [key, keys[key] === true]));

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
    atFirstFrame,
  });

export const stopLockstep = () => {
  lockstep.active = false;
};

// The other game's keys of a frame (checked: another game sent them).
export const receiveKeys = ({ frame, keys }) => {
  if (
    Number.isInteger(frame) &&
    frame >= lockstep.frame &&
    keys &&
    typeof keys == "object"
  ) {
    lockstep.otherKeys.set(frame, keysOf(keys));
  }
};

export const lockstepWaits = () =>
  lockstep.active && keysAt(lockstep.otherKeys, lockstep.frame) === undefined;

// Before the cars drive: the keys the player holds go to the other game for INPUT_DELAY
// frames on, and both cars drive with the frame's.
export const pressFrameKeys = () => {
  if (!lockstep.active) {
    return;
  }
  const { own, other, frame } = lockstep;
  held = keysOf(racers[own].u);
  if (frame == 0) {
    lockstep.atFirstFrame?.();
  }
  lockstep.ownKeys.set(frame + INPUT_DELAY, held);
  link.send({ type: MESSAGE.keys, frame: frame + INPUT_DELAY, keys: held });
  Object.assign(racers[own].u, keysAt(lockstep.ownKeys, frame));
  Object.assign(racers[other].u, keysAt(lockstep.otherKeys, frame));
};

// After the race has used them: the own car's keys are the player's again, for the HUD's
// touch controls and the keyboard to press, and the next frame comes.
export const releaseFrameKeys = () => {
  if (!lockstep.active) {
    return;
  }
  Object.assign(racers[lockstep.own].u, held);
  lockstep.ownKeys.delete(lockstep.frame);
  lockstep.otherKeys.delete(lockstep.frame);
  lockstep.frame++;
};
