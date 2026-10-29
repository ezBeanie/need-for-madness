// The host's side of a race with a guest: the host's game drives the whole race, the guest's
// car with the keys the guest sends, and sends every tick of it to the guest (see guest.js).

import { carStats } from "../data/carStats.js";
import { PHASE, game } from "../core/state.js";
import { raceEvents } from "../race/events.js";
import { field, setUpField } from "../race/field.js";
import { raceCarTextures } from "../render/generated.js";
import { raceTape, tapeTick } from "../race/raceTape.js";
import { racers } from "../race/racers.js";
import { track } from "../race/track.js";
import {
  GUEST_CAR,
  MESSAGE,
  OUTCOME,
  ROLE,
  isIndex,
  link,
  openLink,
} from "./link.js";

const GUEST_KEYS = ["up", "down", "left", "right", "handb"];
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
const host = { racing: false, sent: 0, quietTicks: GUEST_GONE_TICKS };
const guestKeys = Object.fromEntries(GUEST_KEYS.map((key) => [key, false]));

const guestThere = () => host.quietTicks < GUEST_GONE_TICKS;

const receive = (message) => {
  host.quietTicks = 0;
  if (
    message.type == MESSAGE.join &&
    isIndex(message.carType, carStats.names.length)
  ) {
    field.guestCarType = message.carType;
  }
  if (message.type == MESSAGE.keys && message.keys) {
    for (const key of GUEST_KEYS) {
      guestKeys[key] = message.keys[key] === true;
    }
  }
};

// Every tick: a guest gone is forgotten, and a race the host left ends for the guest too.
export const hostTick = () => {
  if (link.role != ROLE.host) {
    return;
  }
  host.quietTicks++;
  if (!guestThere()) {
    field.guestCarType = null;
  }
  if (host.racing && !RACE_GOES_ON.includes(game.phase)) {
    link.send({ type: MESSAGE.end });
    host.racing = false;
    game.humans = [];
  }
};

export const startHosting = () => {
  if (link.role == ROLE.host) {
    openLink(receive);
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
  if (host.racing) {
    link.send({
      type: MESSAGE.start,
      stage: track.stage,
      carTypes: game.carTypes.slice(0, game.carCount),
      car: GUEST_CAR,
    });
  }
};

// Before the cars drive: the guest's car gets the keys the guest pressed last.
export const applyGuestKeys = () => {
  if (host.racing) {
    Object.assign(racers[GUEST_CAR].u, guestKeys);
  }
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
    tape,
    hud: {
      positions: track.pos.slice(0, game.carCount),
      wasted: racers
        .slice(0, game.carCount)
        .filter((racer, c) => c != GUEST_CAR && racer.wasted).length,
      nlaps: guest.nlaps,
      damage: guest.damage,
      power: guest.power,
      point: guest.point,
      missedCheckpoint: guest.missedCheckpoint,
      ...guestOutcome(),
    },
  });
};
