// The link between the games of a room, the host's and its guests', opened from the
// multiplayer dialog (see ui/multiplayerMenu.js) or with ?host=<room> and ?join=<room>: a
// WebSocket to the relay of the server the game came from (see server/relay.js), which
// passes each message on to the other games in the room. Every message says which game sent
// it, by an id made up for the room.

import { PHASE } from "../core/state.js";

export const ROLE = { none: 0, host: 1, guest: 2 };

export const MESSAGE = {
  // a guest is in the room (and drives the car it says)
  join: "join",
  // the host's answer to a join: the room's players and its bots
  players: "players",
  // the race the host starts, its whole state as of its first frame (see raceState.js)
  start: "start",
  // a game's keys of a frame (see lockstep.js)
  keys: "keys",
  // a fingerprint of a game's race at a frame, to tell whether the races went apart
  sync: "sync",
  // a game's race at the frame the fingerprints first differed at, to tell what differs
  apart: "apart",
  // a player left the race, from a frame on
  left: "left",
  // a player left the room (the host's ends it)
  bye: "bye",
  // a game's ping in a race, which the host answers at once: the time to the host and back
  ping: "ping",
  pong: "pong",
  // a line of the lobby's chat (see chat.js)
  chat: "chat",
  // the voice chat's setting up between two games (see voice.js)
  voice: "voice",
  // a guest asks the host to watch the race going on, and the host's answer: the race
  // from a frame on, in parts (see watch.js)
  watch: "watch",
  watched: "watched",
};

// the most games in a room, as the relay takes them
export const MOST_PLAYERS = 8;

// whether id is that of a game (see openLink)
export const isPlayerId = (id) =>
  typeof id == "string" && /^[a-z0-9]{8}$/.test(id);

// the phases a race together goes on in; any other one leaves it
export const RACE_GOES_ON = [
  PHASE.race,
  PHASE.paused,
  PHASE.replay,
  PHASE.replayRewind,
];

// whether n is a whole number from 0 up to below `below`: what another game sends is checked
export const isIndex = (n, below) => Number.isInteger(n) && n >= 0 && n < below;

// the room names the relay takes
export const ROOM_NAME = /^[a-z0-9-]{1,32}$/i;

// what the relay closes the link to a full room with (see server/relay.js)
const ROOM_FULL = 4001;

// how long a lost connection waits before it tries again
const RECONNECT_MS = 2000;

const params = new URLSearchParams(globalThis.location?.search);
// the room of the URL, if any
export const urlRoom = { host: params.get("host"), join: params.get("join") };

// JSON knows no -0, NaN or infinities, and no undefined in lists: they would come as 0 or
// null, but a race's state has them, and both games must have it to the bit (see
// raceState.js). They go as {"$": name}.
const SPECIAL = {
  "-0": -0,
  NaN: NaN,
  Infinity: Infinity,
  "-Infinity": -Infinity,
  undefined: undefined,
};
const nameOf = (value, inList) =>
  Object.is(value, -0)
    ? "-0"
    : (value === undefined && inList) ||
        (typeof value == "number" && !Number.isFinite(value))
      ? String(value)
      : null;

// (an undefined field is left out, as JSON leaves it: as one never set)
export const encode = (message) =>
  JSON.stringify(message, function (key, value) {
    const name = nameOf(value, Array.isArray(this));
    return name == null ? value : { $: name };
  });

export const decode = (text) =>
  JSON.parse(text, (key, value) =>
    value != null &&
    typeof value == "object" &&
    Object.keys(value).length == 1 &&
    typeof value.$ == "string" &&
    Object.hasOwn(SPECIAL, value.$)
      ? SPECIAL[value.$]
      : value,
  );

export const link = {
  role: ROLE.none,
  room: null,
  // this game's id in the room
  id: null,
  // whether the relay is reached
  open: false,
  // whether the last room was full, until the multiplayer dialog says so
  full: false,
  send: () => {},
};

let socket = null;

// (random, so that no game is told by anything of its player's)
const newPlayerId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) =>
    (n % 36).toString(36),
  ).join("");

// Opens the room as host or guest; receive gets every message the other games send.
export const openLink = (role, room, receive) => {
  closeLink();
  link.role = role;
  link.room = room;
  link.id = newPlayerId();
  const scheme = location.protocol == "https:" ? "wss:" : "ws:";
  const connect = () => {
    const own = new WebSocket(
      `${scheme}//${location.host}/net?room=${encodeURIComponent(room)}`,
    );
    socket = own;
    own.onopen = () => {
      link.open = true;
      link.send = (message) => own.send(encode({ ...message, from: link.id }));
    };
    own.onmessage = (event) => {
      // (whatever another game sends is checked before it is used)
      let message;
      try {
        message = decode(event.data);
      } catch {
        return;
      }
      if (message && typeof message == "object" && isPlayerId(message.from)) {
        receive(message);
      }
    };
    own.onclose = (event) => {
      // (a link closed on purpose, or replaced by another, stays closed)
      if (socket != own) {
        return;
      }
      if (event.code == ROOM_FULL) {
        closeLink();
        link.full = true;
        return;
      }
      link.open = false;
      link.send = () => {};
      setTimeout(() => socket == own && connect(), RECONNECT_MS);
    };
  };
  connect();
};

export const closeLink = () => {
  const old = socket;
  socket = null;
  old?.close();
  link.role = ROLE.none;
  link.room = null;
  link.id = null;
  link.open = false;
  link.send = () => {};
};

// Leaves the room, telling the others.
export const leaveRoom = () => {
  link.send({ type: MESSAGE.bye });
  closeLink();
};
