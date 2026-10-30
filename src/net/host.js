// The host's side of a race with a guest: the host's game drives the whole race, the guest's
// car with the keys the guest sends, and sends every tick of it to the guest (see guest.js).

import { carStats } from "../data/carStats.js";
import { PHASE, game } from "../core/state.js";
import { raceEvents } from "../race/events.js";
import { field, setUpField } from "../race/field.js";
import { raceCarTextures } from "../render/generated.js";
import { raceTape, tapeTick } from "../race/raceTape.js";
import { car, racers } from "../race/racers.js";
import { track } from "../race/track.js";
import { tick } from "../core/tick.js";
import { copyCarState } from "./carState.js";
import {
  GUEST_CAR,
  GUEST_HUD_FIELDS,
  MESSAGE,
  OUTCOME,
  ROLE,
  isIndex,
  link,
  openLink,
  urlRoom,
} from "./link.js";

const GUEST_KEYS = ["up", "down", "left", "right", "handb"];
// the most of the guest's inputs waiting to be driven: more (after the host stalled) would
// only delay the guest's car on the host
const MOST_INPUTS_WAITING = 3;
// a guest silent for this many ticks has gone (it sends every tick in a race, and every
// 30 outside one)
const GUEST_GONE_TICKS = 100;
// the phases a race with a guest goes on in; any other one ends it
const RACE_GOES_ON = [
  PHASE.race,
  PHASE.paused,
  PHASE.replay,
  PHASE.replayRewind,
];

// sent: how many ticks of the race tape the guest has; quietTicks: since the guest's
// last message
// pong: the guest's last ping, sent back with the next tick
// inputs: the guest's keys of each of its ticks, numbered, not driven yet; driven: the
// number of the last one driven, which the guest's prediction drives on from (see guest.js)
const host = {
  racing: false,
  sent: 0,
  quietTicks: GUEST_GONE_TICKS,
  pong: null,
  inputs: [],
  driven: -1,
};
const guestKeys = Object.fromEntries(GUEST_KEYS.map((key) => [key, false]));

export const guestThere = () => host.quietTicks < GUEST_GONE_TICKS;

const receive = (message) => {
  host.quietTicks = 0;
  if (message.type == MESSAGE.left && host.racing) {
    // the AI drives the guest's car on
    host.racing = false;
    game.humans = [];
  }
  if (
    message.type == MESSAGE.join &&
    isIndex(message.carType, carStats.names.length)
  ) {
    field.guestCarType = message.carType;
    link.send({ type: MESSAGE.here });
  }
  if (
    message.type == MESSAGE.keys &&
    message.keys &&
    Number.isInteger(message.input) &&
    message.input > (host.inputs.at(-1)?.input ?? host.driven)
  ) {
    host.inputs.push({
      input: message.input,
      keys: Object.fromEntries(
        GUEST_KEYS.map((key) => [key, message.keys[key] === true]),
      ),
    });
    if (Number.isFinite(message.ping)) {
      host.pong = message.ping;
    }
  }
};

// Every tick: a guest gone is forgotten (its car driven by the AI), and a race the host
// left ends for the guest too.
export const hostTick = () => {
  if (link.role != ROLE.host) {
    return;
  }
  host.quietTicks++;
  if (!guestThere()) {
    field.guestCarType = null;
  }
  if (host.racing && !guestThere()) {
    // the guest's connection is lost: the AI drives its car on
    host.racing = false;
    game.humans = [];
  }
  if (host.racing && !RACE_GOES_ON.includes(game.phase)) {
    link.send({ type: MESSAGE.end });
    host.racing = false;
    game.humans = [];
  }
};

// Opens a room for a guest to join.
export const hostRoom = (room) => {
  host.quietTicks = GUEST_GONE_TICKS;
  field.guestCarType = null;
  openLink(ROLE.host, room, receive);
};

export const startHosting = () => {
  if (urlRoom.host) {
    hostRoom(urlRoom.host);
  }
};

// A race begins: a guest who joined drives the car beside the player's.
export const startHostedRace = () => {
  host.racing = guestThere() && game.carCount > GUEST_CAR;
  if (host.racing && game.carTypes[GUEST_CAR] != field.guestCarType) {
    // (the guest joined after the field was chosen)
    setUpField();
    raceCarTextures();
  }
  game.humans = host.racing ? [game.player, GUEST_CAR] : [];
  host.sent = 0;
  host.inputs = [];
  host.driven = -1;
  Object.assign(
    guestKeys,
    Object.fromEntries(GUEST_KEYS.map((k) => [k, false])),
  );
  if (host.racing) {
    link.send({
      type: MESSAGE.start,
      stage: track.stage,
      carTypes: game.carTypes.slice(0, game.carCount),
      car: GUEST_CAR,
    });
  }
};

// Before the cars drive: the guest's car drives with the guest's next input, one each
// tick as the guest's own ticks pressed them (or on with the last, while none came).
export const applyGuestKeys = () => {
  if (!host.racing) {
    return;
  }
  host.inputs.splice(0, Math.max(0, host.inputs.length - MOST_INPUTS_WAITING));
  const next = host.inputs.shift();
  if (next) {
    Object.assign(guestKeys, next.keys);
    host.driven = next.input;
  }
  Object.assign(racers[GUEST_CAR].u, guestKeys);
};

const guestOutcome = () => {
  const others = racers
    .slice(0, game.carCount)
    .filter((_, c) => c != GUEST_CAR);
  if (others.every((racer) => racer.wasted)) {
    return { outcome: OUTCOME.wastedThem };
  }
  if (racers[GUEST_CAR].wasted) {
    return { outcome: OUTCOME.wasted };
  }
  for (let c = 0; c < game.carCount; c++) {
    if (track.clear[c] == track.nlaps * track.nsp && track.pos[c] == 0) {
      return c == GUEST_CAR
        ? { outcome: OUTCOME.won }
        : { outcome: OUTCOME.lost, winner: carStats.names[game.carTypes[c]] };
    }
  }
  return { outcome: OUTCOME.none };
};

// After a tick of the race (or of its countdown): that tick to the guest, with what the
// guest's HUD shows.
export const sendHostTick = () => {
  if (!host.racing) {
    return;
  }
  const guest = racers[GUEST_CAR];
  const tape = [];
  for (; host.sent < raceTape.length; host.sent++) {
    tape.push(tapeTick(host.sent));
  }
  link.send({
    type: MESSAGE.tick,
    countdown: raceEvents.countdown,
    pong: host.pong,
    // the guest's car as driven up to that input, for the guest's prediction
    own: { input: host.driven, state: copyCarState(GUEST_CAR) },
    tape,
    hud: {
      positions: track.pos.slice(0, game.carCount),
      wasted: racers
        .slice(0, game.carCount)
        .filter((racer, c) => c != GUEST_CAR && racer.wasted).length,
      ...Object.fromEntries(GUEST_HUD_FIELDS.map((key) => [key, guest[key]])),
      fcnt: car[GUEST_CAR].fcnt,
      // the guest's stunt landed this tick (as the host's HUD praises the player's)
      stunted: guest.countingStunt == 10 && tick.fraction >= tick.scale,
      // the cars wasted, and who hit them last: whether the guest wasted them
      dested: track.dested.slice(0, game.carCount),
      lastHitBy: racers.slice(0, game.carCount).map((r) => r.lastHitBy ?? -1),
      ...guestOutcome(),
    },
  });
  host.pong = null;
};
