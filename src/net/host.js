// The host's side of a race with a guest: the host's game drives the whole race, the guest's
// car with the keys the guest sends, and sends every tick of it to the guest (see guest.js).

import { carStats } from "../data/carStats.js";
import { game } from "../core/state.js";
import { raceEvents } from "../race/events.js";
import { raceTape, tapeTick } from "../race/raceTape.js";
import { racers } from "../race/racers.js";
import { track } from "../race/track.js";
import { MESSAGE, OUTCOME, ROLE, link, openLink } from "./link.js";

// the car the guest drives: the one beside the player's on the start grid
const GUEST_CAR = 1;
const GUEST_KEYS = ["up", "down", "left", "right", "handb"];

// sent: how many ticks of the race tape the guest has
const host = { guestJoined: false, racing: false, sent: 0 };
const guestKeys = Object.fromEntries(GUEST_KEYS.map((key) => [key, false]));

const receive = (message) => {
  if (message.type == MESSAGE.join) {
    host.guestJoined = true;
  }
  if (message.type == MESSAGE.keys) {
    Object.assign(guestKeys, message.keys);
  }
};

export const startHosting = () => {
  if (link.role == ROLE.host) {
    openLink(receive);
  }
};

// A race begins: a guest who joined drives the car beside the player's.
export const startHostedRace = () => {
  host.racing = host.guestJoined && game.carCount > GUEST_CAR;
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
