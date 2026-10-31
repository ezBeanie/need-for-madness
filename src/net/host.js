// The host's side of a race with a guest: the host starts the race and sends its whole
// state to the guest, then both games compute it, each sending only its keys (see
// lockstep.js and guest.js).

import { carStats } from "../data/carStats.js";
import { random, seededRandom } from "../core/random.js";
import { MODE, game } from "../core/state.js";
import { raceEvents } from "../race/events.js";
import { field, setUpField } from "../race/field.js";
import { raceCarTextures } from "../render/generated.js";
import { track } from "../race/track.js";
import { saveRace } from "./raceState.js";
import {
  receiveKeys,
  receiveApart,
  receivePrint,
  startLockstep,
  stopLockstep,
} from "./lockstep.js";
import {
  GUEST_CAR,
  MESSAGE,
  RACE_GOES_ON,
  ROLE,
  isIndex,
  link,
  openLink,
  urlRoom,
} from "./link.js";

// a guest silent for this many ticks has gone (it sends every tick in a race, and every
// 30 outside one)
const GUEST_GONE_TICKS = 100;

// quietTicks: since the guest's last message
const host = { racing: false, quietTicks: GUEST_GONE_TICKS };

export const guestThere = () => host.quietTicks < GUEST_GONE_TICKS;

// The guest's car is the AI's from now on.
const raceOnWithoutGuest = () => {
  host.racing = false;
  game.humans = [];
  stopLockstep();
};

const receive = (message) => {
  host.quietTicks = 0;
  if (message.type == MESSAGE.left && host.racing) {
    raceOnWithoutGuest();
  }
  if (
    message.type == MESSAGE.join &&
    isIndex(message.carType, carStats.names.length)
  ) {
    field.guestCarType = message.carType;
    link.send({ type: MESSAGE.here });
  }
  if (message.type == MESSAGE.keys && host.racing) {
    receiveKeys(message);
  }
  if (message.type == MESSAGE.sync && host.racing) {
    receivePrint(message);
  }
  if (message.type == MESSAGE.apart && host.racing) {
    receiveApart(message);
  }
  if (message.type == MESSAGE.ping && Number.isFinite(message.ping)) {
    link.send({ type: MESSAGE.pong, ping: message.ping });
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
    raceOnWithoutGuest();
  }
  if (host.racing && !RACE_GOES_ON.includes(game.phase)) {
    link.send({ type: MESSAGE.end });
    raceOnWithoutGuest();
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

// A race begins: a guest who joined drives the car beside the player's, and gets the
// race's whole state with its first frame. Its random numbers come from sources whose
// state goes along, and the help for new players, which only the host's car would get,
// is off.
export const startHostedRace = () => {
  host.racing =
    guestThere() && game.carCount > GUEST_CAR && game.mode == MODE.championship;
  if (!host.racing) {
    game.humans = [];
    return;
  }
  if (game.carTypes[GUEST_CAR] != field.guestCarType) {
    // (the guest joined after the field was chosen)
    setUpField();
    raceCarTextures();
  }
  game.humans = [game.player, GUEST_CAR];
  random.sim = seededRandom(random.fx() * 2 ** 32);
  random.wreck = seededRandom(random.fx() * 2 ** 32);
  raceEvents.onautocorrect = 0;
  startLockstep(game.player, GUEST_CAR, () =>
    link.send({
      type: MESSAGE.start,
      stage: track.stage,
      carTypes: game.carTypes.slice(0, game.carCount),
      car: GUEST_CAR,
      state: saveRace(),
    }),
  );
};
