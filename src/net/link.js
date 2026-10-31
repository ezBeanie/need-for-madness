// The link between the host's game and a guest's, opened from the multiplayer dialog (see
// ui/multiplayerMenu.js) or with ?host=<room> and ?join=<room>: a WebSocket to the relay of
// the server the game came from (see server/relay.js), which passes the messages on to the
// other game in the room.

import { PHASE } from "../core/state.js";

export const ROLE = { none: 0, host: 1, guest: 2 };

export const MESSAGE = {
  join: "join",
  // the host's answer to a join: it is there
  here: "here",
  // the race the host starts, its whole state as of its first frame (see raceState.js)
  start: "start",
  // a game's keys of a frame (see lockstep.js)
  keys: "keys",
  // a fingerprint of a game's race at a frame, to tell whether the races went apart
  sync: "sync",
  // a game's race at the frame the fingerprints first differed at, to tell what differs
  apart: "apart",
  // the host left the race
  end: "end",
  // the guest left the race
  left: "left",
  // the guest's ping, which the host answers at once: the time to the host and back
  ping: "ping",
  pong: "pong",
};

// the car the guest drives: the one beside the player's on the start grid
export const GUEST_CAR = 1;

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
  // whether the relay is reached
  open: false,
  send: () => {},
};

let socket = null;

// Opens the room as host or guest; receive gets every message the other side sends.
export const openLink = (role, room, receive) => {
  closeLink();
  link.role = role;
  link.room = room;
  const scheme = location.protocol == "https:" ? "wss:" : "ws:";
  const connect = () => {
    const own = new WebSocket(
      `${scheme}//${location.host}/net?room=${encodeURIComponent(room)}`,
    );
    socket = own;
    own.onopen = () => {
      link.open = true;
      link.send = (message) => own.send(encode(message));
    };
    own.onmessage = (event) => {
      // (whatever another game sends is checked before it is used)
      let message;
      try {
        message = decode(event.data);
      } catch {
        return;
      }
      if (message && typeof message == "object") {
        receive(message);
      }
    };
    own.onclose = () => {
      // (a link closed on purpose, or replaced by another, stays closed)
      if (socket != own) {
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
  link.open = false;
  link.send = () => {};
};
