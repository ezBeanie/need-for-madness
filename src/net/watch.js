// Watching a race of the room that goes on, from the lobby: the guest asks the host, which
// sends the race as of a frame all games ran alike, every player's keys from it on that
// the host knows, and who left it (see raceToWatch), in parts. The guest's game loads the
// stage and runs the race on from there with the players' keys as they come, those sent
// before it asked too (it overhears them), without a car of its own (see lockstep.js).

import { random, seededRandom } from "../core/random.js";
import { MAX_CARS, game, raceSetup } from "../core/state.js";
import { MESSAGE, decode, encode, isIndex, link } from "./link.js";
import {
  KEYS,
  lockstep,
  raceToWatch,
  startWatchingLockstep,
} from "./lockstep.js";
import { restoreRace } from "./raceState.js";
import { roomCars } from "./roomCars.js";
import { track } from "../race/track.js";

// the parts the race goes in (the relay takes 256 kB a message at most)
const PART_LENGTH = 64 * 1024;
const MOST_PARTS = 64;
// how many frames of keys overheard are kept, by player (30 s)
const HEARD_FRAMES = 900;

// The host: the race from a frame on, to the guest of id.
export const answerWatch = (id) => {
  if (!lockstep.active || lockstep.watching || game.carCount >= MAX_CARS) {
    return;
  }
  const text = encode({
    stage: track.stage,
    mode: raceSetup.mode,
    rules: raceSetup.rules,
    carTypes: game.carTypes.slice(0, game.carCount),
    players: lockstep.players,
    names: roomCars.names,
    skins: roomCars.skins,
    raceId: lockstep.raceId,
    ...raceToWatch(),
  });
  const parts = Math.ceil(text.length / PART_LENGTH);
  for (let part = 0; part < parts; part++) {
    link.send({
      type: MESSAGE.watched,
      to: id,
      part,
      parts,
      text: text.slice(part * PART_LENGTH, (part + 1) * PART_LENGTH),
    });
  }
};

// The keys and leavings of the room's race heard while not in it, by player id: raceId,
// keys (by id, by frame) and left (the frame, by id).
const heard = { raceId: null, keys: new Map(), left: new Map() };

export const overhear = (message) => {
  if (
    lockstep.active ||
    !Number.isInteger(message.raceId) ||
    !Number.isInteger(message.frame) ||
    (message.type != MESSAGE.keys && message.type != MESSAGE.left)
  ) {
    return;
  }
  if (message.raceId != heard.raceId) {
    Object.assign(heard, {
      raceId: message.raceId,
      keys: new Map(),
      left: new Map(),
    });
  }
  if (message.type == MESSAGE.left) {
    heard.left.set(message.from, message.frame);
    return;
  }
  const keys = heard.keys.get(message.from) ?? new Map();
  heard.keys.set(message.from, keys);
  keys.set(message.frame, message.keys);
  for (const frame of keys.keys()) {
    if (frame < message.frame - HEARD_FRAMES) {
      keys.delete(frame);
    }
  }
};

// the parts of the host's answer that came
let parts = [];

export const askToWatch = () => {
  parts = [];
  link.send({ type: MESSAGE.watch });
};

const isKeys = (keys) =>
  keys != null &&
  typeof keys == "object" &&
  KEYS.every((key) => typeof keys[key] == "boolean");

const isFrame = (frame) => Number.isInteger(frame) && frame >= 0;

// what the host's answer must be, besides a race's start (isStart, see guest.js)
const isWatched = ({ frame, players, keys, leftAt }) =>
  isFrame(frame) &&
  Array.isArray(keys) &&
  keys.every(
    (entry) =>
      Array.isArray(entry) &&
      isIndex(entry[0], players.length) &&
      Array.isArray(entry[1]) &&
      entry[1].every(
        (given) =>
          Array.isArray(given) && isFrame(given[0]) && isKeys(given[1]),
      ),
  ) &&
  Array.isArray(leftAt) &&
  leftAt.every(
    (entry) =>
      Array.isArray(entry) &&
      isIndex(entry[0], players.length) &&
      isFrame(entry[1]),
  );

// A part of the host's answer (checked: the host sent it); once all came, the race,
// checked by isStart, which the guest then watches (see guest.js). Returns it, or null.
export const receiveWatched = (message, isStart) => {
  if (
    message.to != link.id ||
    !Number.isInteger(message.parts) ||
    message.parts > MOST_PARTS ||
    !isIndex(message.part, message.parts) ||
    typeof message.text != "string"
  ) {
    return null;
  }
  parts[message.part] = message.text;
  if (parts.filter((part) => part !== undefined).length != message.parts) {
    return null;
  }
  let race = null;
  try {
    race = decode(parts.join(""));
  } catch {
    return null;
  } finally {
    parts = [];
  }
  if (!race || !isStart(race) || !isWatched(race)) {
    return null;
  }
  // the keys the host knew, and those overheard of the same race
  const keys = race.keys.map(([car, given]) => [car, new Map(given)]);
  if (heard.raceId == race.raceId) {
    for (const [car, given] of keys) {
      for (const [frame, pressed] of heard.keys.get(race.players[car]) ?? []) {
        if (frame >= race.frame && isKeys(pressed) && !given.has(frame)) {
          given.set(frame, pressed);
        }
      }
    }
  }
  const leftAt = new Map(race.leftAt);
  for (const [id, frame] of heard.left) {
    const car = race.players.indexOf(id);
    if (car >= 0 && heard.raceId == race.raceId && !leftAt.has(car)) {
      leftAt.set(car, frame);
    }
  }
  startWatchingLockstep(
    race.players,
    race.raceId,
    race.frame,
    keys.map(([car, given]) => [car, [...given].sort(([a], [b]) => a - b)]),
    [...leftAt],
    () => {
      random.sim = seededRandom(0);
      random.wreck = seededRandom(0);
      restoreRace(race.state);
    },
  );
  return race;
};
