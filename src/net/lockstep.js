// Racing together by sending each other only the keys: every game computes the whole race
// alike (see raceState.js and test/sharedRace.test.js), the cars of its people driven by
// their keys. The keys pressed in a tick of the race (a frame) drive INPUT_DELAY frames
// later, in every game alike. A game whose keys of a frame from another game are not there
// yet guesses them (the ones pressed last) and races on; guessed wrong, it goes back to that
// frame and computes the frames since again, quietly, with the right ones (rollback). A game
// too far ahead of another's keys waits for them. Every so many frames, the games compare
// fingerprints of their races: a race that went apart in one stays apart. A player who
// leaves the race (or whose game is gone) leaves its car to the AI from a frame on, in
// every game alike.

import { PHASE, game } from "../core/state.js";
import { nextFraction, tick } from "../core/tick.js";
import { raceEvents } from "../race/events.js";
import { physics } from "../race/physics.js";
import { cutRaceTapeTo, raceTape } from "../race/raceTape.js";
import { racers } from "../race/racers.js";
import {
  forgetCorrections,
  noteAfterRollback,
  noteBeforeRollback,
} from "../render/corrections.js";
import { keepRecording, restoreRecording } from "../race/recording.js";
import {
  MESSAGE,
  RACE_GOES_ON,
  decode,
  encode,
  isIndex,
  link,
} from "./link.js";
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

// a player silent this long (no keys, no pings) has left the race: its game is gone
const PLAYER_GONE_TICKS = 100;
// how often a game in a race says it is there, also while it pauses and sends no keys
const PING_EVERY_TICKS = 30;
// how long a player leaving the race is told
const LEFT_SHOWN_TICKS = 100;

// the phases a game stays in the race in: a guest's begins it while its stage loads
const IN_RACE = [...RACE_GOES_ON, PHASE.stageLoading];

// (the host drives car 0, the guests the cars after it, see net/host.js)
const playerName = (car) => (car == 0 ? "the host" : `player ${car + 1}`);

// players: the ids of the players' games by car (see link.js); raceId: what tells this
// race's messages from those of a race before; own: the car of this game's player;
// ownKeys: its keys by frame; otherKeys: the other players' keys by car, by frame;
// lastOther: their last keys there, and their frame, by car; guessed: the others' keys
// guessed, by frame, by car, until they come; kept: the race as it was before each of
// those frames; atFirstFrame: what starts the race alike in all games; unsentPrints: the
// fingerprints of frames that ran on guessed keys, by frame, sent once the guesses were
// right; ownPrints: the fingerprints by frame, and otherPrints: the others', by frame, by
// car, until compared; apartAt: the first frame the fingerprints differed at (-1 none),
// apartWith: the car of the game whose differed, apartRace: this game's race then,
// otherApart: the parts of that game's that came, and differences: what differs in it
// (once all came); leftAt: the frame each player who left the race left it at, by car;
// goBackTo: the first frame that ran with a car whose player had left it (the race goes
// back to it); quietTicks: the ticks since each player was heard, by car; notice: what
// the HUD tells of a player leaving, and for how many ticks more
export const lockstep = {
  active: false,
  players: [],
  raceId: 0,
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
  leftAt: new Map(),
  goBackTo: Infinity,
  quietTicks: new Map(),
  pingTicks: 0,
  notice: { text: null, ticks: 0 },
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
export const startLockstep = (own, players, raceId, atFirstFrame) => {
  const others = players.map((_, car) => car).filter((car) => car != own);
  Object.assign(lockstep, {
    active: true,
    players,
    raceId,
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
    leftAt: new Map(),
    goBackTo: Infinity,
    quietTicks: new Map(others.map((car) => [car, 0])),
    pingTicks: 0,
  });
};

// (each message tells the race it is of)
const send = (message) => link.send({ ...message, raceId: lockstep.raceId });

// whether the player of a car is in the race at a frame
const inRace = (car, frame) =>
  car == lockstep.own || !(lockstep.leftAt.get(car) <= frame);

export const stopLockstep = () => {
  lockstep.active = false;
  forgetCorrections();
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

// The player of a car leaves the race from a frame on (checked: another game sent it): the
// AI drives the car from then on, and frames that ran with the player go again.
export const receiveLeft = ({ car, frame }) => {
  if (
    !lockstep.otherKeys.has(car) ||
    lockstep.leftAt.has(car) ||
    !Number.isInteger(frame) ||
    frame < 0
  ) {
    return;
  }
  lockstep.leftAt.set(car, frame);
  lockstep.quietTicks.delete(car);
  lockstep.goBackTo = Math.min(lockstep.goBackTo, frame);
  const name = playerName(car);
  lockstep.notice = {
    text: `${name[0].toUpperCase()}${name.slice(1)} left the race`,
    ticks: LEFT_SHOWN_TICKS,
  };
};

const RECEIVE = {
  [MESSAGE.keys]: (message) => receiveKeys(message),
  [MESSAGE.sync]: (message) => receivePrint(message),
  [MESSAGE.apart]: (message) => receiveApart(message),
  [MESSAGE.left]: (message) => receiveLeft(message),
};

// A message of another game of the race (checked: another game sent it), the car its
// player drives the one it tells of.
export const receiveRaceMessage = (message) => {
  const car = lockstep.players.indexOf(message.from);
  if (
    !lockstep.active ||
    message.raceId !== lockstep.raceId ||
    car < 0 ||
    car == lockstep.own
  ) {
    return;
  }
  if (lockstep.quietTicks.has(car)) {
    lockstep.quietTicks.set(car, 0);
  }
  RECEIVE[message.type]?.({ ...message, car });
};

// Every tick of a race together: the game says it is there now and then, a player silent
// too long has left the race (from the frame after its last keys, in every game alike, as
// every game got them), and the player leaving the race tells the others.
export const lockstepTick = () => {
  if (lockstep.notice.ticks > 0) {
    lockstep.notice.ticks--;
  }
  if (!lockstep.active) {
    return;
  }
  if (lockstep.pingTicks++ % PING_EVERY_TICKS == 0) {
    send({ type: MESSAGE.ping, ping: performance.now() });
  }
  for (const [car, ticks] of lockstep.quietTicks) {
    lockstep.quietTicks.set(car, ticks + 1);
    if (ticks + 1 >= PLAYER_GONE_TICKS) {
      receiveLeft({ car, frame: lockstep.lastOther.get(car).frame + 1 });
    }
  }
  if (!IN_RACE.includes(game.phase)) {
    leaveLockstep();
  }
};

// The player leaves the race: the others' AI drives its car from the frame after the last
// keys it sent.
export const leaveLockstep = () => {
  send({ type: MESSAGE.left, frame: lockstep.frame + INPUT_DELAY });
  stopLockstep();
  game.humans = [];
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
        send({
          type: MESSAGE.apart,
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

// the car of a player whose keys the race waits for, if any
const waitedFor = () =>
  [...lockstep.lastOther].find(
    ([car, last]) =>
      inRace(car, lockstep.frame) &&
      keysAt(lockstep.otherKeys.get(car), lockstep.frame) === undefined &&
      lockstep.frame - last.frame > MAX_GUESSED,
  )?.[0];

export const lockstepWaits = () => lockstep.active && waitedFor() !== undefined;

// what a game waiting for another one's keys says
export const waitingNotice = () => `Waiting for ${playerName(waitedFor())}...`;

// what a game whose player left the race says, a while
export const leftNotice = () =>
  lockstep.notice.ticks > 0 ? lockstep.notice.text : null;

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
  game.humans = lockstep.players
    .map((_, car) => car)
    .filter((car) => inRace(car, frame));
  const others = [...lockstep.otherKeys].filter(([car]) => inRace(car, frame));
  const guess = new Map();
  for (const [car, keys] of others) {
    if (keysAt(keys, frame) === undefined) {
      guess.set(car, lockstep.lastOther.get(car).keys);
    }
  }
  if (guess.size > 0 && raceEvents.countdown == 0) {
    lockstep.kept.set(frame, keepRace());
    lockstep.guessed.set(frame, guess);
  }
  Object.assign(racers[lockstep.own].u, keysAt(lockstep.ownKeys, frame));
  for (const [car, keys] of others) {
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
      send({
        type: MESSAGE.sync,
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
// come further than another's.) So too where a car ran with a player who had left the
// race.
const checkGuesses = (runFrameAgain) => {
  let wrongAt = Infinity;
  for (const [frame, guess] of lockstep.guessed) {
    for (const [car, keys] of guess) {
      if (!inRace(car, frame)) {
        guess.delete(car);
        continue;
      }
      const given = lockstep.otherKeys.get(car).get(frame);
      if (given !== undefined && !sameKeys(given, keys)) {
        wrongAt = frame;
        break;
      }
      if (given !== undefined) {
        guess.delete(car);
      }
    }
    if (wrongAt < Infinity) {
      break;
    }
    if (guess.size == 0) {
      lockstep.guessed.delete(frame);
    }
  }
  // (a car runs with its player only on guessed keys: those it left the race at are kept)
  const left = [...lockstep.kept.keys()].find(
    (frame) => frame >= lockstep.goBackTo,
  );
  lockstep.goBackTo = Infinity;
  wrongAt = Math.min(wrongAt, left ?? Infinity);
  if (wrongAt == Infinity) {
    return;
  }
  const now = lockstep.frame;
  noteBeforeRollback();
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
  noteAfterRollback();
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
  send({
    type: MESSAGE.keys,
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
