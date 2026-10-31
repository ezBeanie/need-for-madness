// The host's side of racing together: the room's players come to the host's game (see
// guest.js), which starts the race with them and sends its whole state to them, then every
// game computes it, each sending only its keys (see lockstep.js).

import { carStats } from "../data/carStats.js";
import { random, seededRandom } from "../core/random.js";
import { MODE, game } from "../core/state.js";
import { raceEvents } from "../race/events.js";
import { field, setUpField } from "../race/field.js";
import { raceCarTextures } from "../render/generated.js";
import { track } from "../race/track.js";
import { saveRace } from "./raceState.js";
import { receiveRaceMessage, startLockstep } from "./lockstep.js";
import {
  MESSAGE,
  MOST_PLAYERS,
  ROLE,
  isIndex,
  link,
  openLink,
  urlRoom,
} from "./link.js";

// a guest silent for this many ticks has gone (it says it is there every 30 ticks)
const GUEST_GONE_TICKS = 100;
// a guest that joined this many ticks ago is in the menus (it joins every 30 ticks there),
// not in a race of its own still
const GUEST_WAITING_TICKS = 60;

// guests: the players in the room but the host, in the order they came, each with its id,
// the car it chose, and the ticks since it was last heard and since it last joined
const host = { guests: [] };

export const roomGuests = () => host.guests;

// the guests a race the host starts takes along
const waitingGuests = () =>
  host.guests.filter(({ joinedTicks }) => joinedTicks < GUEST_WAITING_TICKS);

// (the host's own car first: the room's players as every game lists them)
const sendPlayers = () =>
  link.send({
    type: MESSAGE.players,
    players: [{ id: link.id, carType: game.carTypes[0] }, ...host.guests].map(
      ({ id, carType }) => ({ id, carType }),
    ),
  });

const receive = (message) => {
  receiveRaceMessage(message);
  let guest = host.guests.find(({ id }) => id == message.from);
  if (
    message.type == MESSAGE.join &&
    isIndex(message.carType, carStats.names.length)
  ) {
    if (!guest && host.guests.length < MOST_PLAYERS - 1) {
      guest = { id: message.from };
      host.guests.push(guest);
    }
    if (guest) {
      guest.carType = message.carType;
      guest.joinedTicks = 0;
      // (the answer that tells the guest the host is there)
      sendPlayers();
    }
  }
  if (!guest) {
    return;
  }
  guest.quietTicks = 0;
  if (message.type == MESSAGE.bye) {
    host.guests = host.guests.filter((other) => other != guest);
  }
  if (message.type == MESSAGE.ping && Number.isFinite(message.ping)) {
    link.send({ type: MESSAGE.pong, to: guest.id, ping: message.ping });
  }
};

// Every tick: guests gone are forgotten, and the field is chosen with the cars of those
// there.
export const hostTick = () => {
  for (const guest of host.guests) {
    guest.quietTicks++;
    guest.joinedTicks++;
  }
  host.guests = host.guests.filter(
    ({ quietTicks }) => quietTicks < GUEST_GONE_TICKS,
  );
  field.guestCarTypes =
    link.role == ROLE.host ? waitingGuests().map(({ carType }) => carType) : [];
};

// Opens a room for guests to join.
export const hostRoom = (room) => {
  host.guests = [];
  openLink(ROLE.host, room, receive);
};

export const startHosting = () => {
  if (urlRoom.host) {
    hostRoom(urlRoom.host);
  }
};

// A race begins: the guests drive the cars after the host's, in the order they came, and
// get the race's whole state with its first frame. Its random numbers come from sources
// whose state goes along, and the help for new players, which only the host's car would
// get, is off.
export const startHostedRace = () => {
  const guests = waitingGuests();
  if (
    link.role != ROLE.host ||
    guests.length == 0 ||
    game.mode != MODE.championship
  ) {
    game.humans = [];
    return;
  }
  if (
    game.carCount <= guests.length ||
    guests.some(({ carType }, i) => game.carTypes[i + 1] != carType)
  ) {
    // (a guest came, or chose another car, after the field was chosen)
    setUpField();
    raceCarTextures();
  }
  // (the players by car: the host's is the player's car, 0)
  const players = [link.id, ...guests.map(({ id }) => id)];
  game.humans = players.map((_, car) => car);
  random.sim = seededRandom(random.fx() * 2 ** 32);
  random.wreck = seededRandom(random.fx() * 2 ** 32);
  raceEvents.onautocorrect = 0;
  // (that tells this race's messages from those of a race before, see lockstep.js)
  const raceId = Math.floor(random.fx() * 2 ** 32);
  startLockstep(game.player, players, raceId, () =>
    link.send({
      type: MESSAGE.start,
      stage: track.stage,
      carTypes: game.carTypes.slice(0, game.carCount),
      players,
      raceId,
      state: saveRace(),
    }),
  );
};
