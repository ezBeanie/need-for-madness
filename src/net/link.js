// The link between the games of a room, the host's and its guests', opened from the
// multiplayer dialog (see ui/multiplayerMenu.js) or with ?host=<room> and ?join=<room>: a
// WebSocket to the relay of the server the game came from (see server/relay.js), which
// passes each message on to the other games in the room, and beside it the direct links of
// games in the same network (see direct.js). Every message says which game sent it, by an id
// made up for the room, and its number from that game.

import { PHASE } from "../core/state.js";
import {
  closeDirect,
  directLinks,
  openDirect,
  receiveDirect,
  sendDirectly,
} from "./direct.js";

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
  // the setting up of a direct link between a guest and the host (see direct.js)
  direct: "direct",
  // what a guest out of the lobby does (PLAYER_STATUS), for the host to list
  status: "status",
};

// the most games in a room, as the relay takes them
export const MOST_PLAYERS = 8;

// whether id is that of a game (see openLink)
export const isPlayerId = (id) =>
  typeof id == "string" && /^[a-z0-9]{8}$/.test(id);

// the phases a race together goes on in; any other one leaves it. The replay after the
// race leaves it too: its game sends no keys while it plays, and the others' would wait for
// them, the race over and its Continue not shown.
export const RACE_GOES_ON = [PHASE.race, PHASE.paused];

// What a player of the room does, as the lobby lists it: in the lobby (the menus), in a race,
// watching the highlight or the replay after it, at the race's results, or elsewhere (the
// stage editor, the instructions).
export const PLAYER_STATUS = {
  lobby: 0,
  racing: 1,
  highlight: 2,
  replay: 3,
  results: 4,
  away: 5,
};

const STATUS_BY_PHASE = new Map([
  [PHASE.mainMenu, PLAYER_STATUS.lobby],
  [PHASE.carSelect, PLAYER_STATUS.lobby],
  [PHASE.stageSelect, PLAYER_STATUS.lobby],
  [PHASE.stageLoading, PLAYER_STATUS.racing],
  [PHASE.startFlash, PLAYER_STATUS.racing],
  [PHASE.race, PLAYER_STATUS.racing],
  [PHASE.paused, PLAYER_STATUS.racing],
  [PHASE.switchScreen, PLAYER_STATUS.racing],
  [PHASE.timeRewind, PLAYER_STATUS.racing],
  [PHASE.replayRewind, PLAYER_STATUS.racing],
  [PHASE.highlights, PLAYER_STATUS.highlight],
  [PHASE.replay, PLAYER_STATUS.replay],
  [PHASE.raceEnd, PLAYER_STATUS.results],
]);

export const statusOf = (phase) =>
  STATUS_BY_PHASE.get(phase) ?? PLAYER_STATUS.away;

export const isPlayerStatus = (status) =>
  isIndex(status, Object.keys(PLAYER_STATUS).length);

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
  // whether the relay or a game linked directly is reached
  open: false,
  // whether the last room was full, until the multiplayer dialog says so
  full: false,
  send: () => {},
};

let socket = null;
let relayOpen = false;
let receiver = () => {};
// the number of this game's next message
let sent = 0;
// from -> the numbers of its messages heard (the latest MOST_HEARD at least): a message
// comes twice when it comes directly too
const heard = new Map();
const MOST_HEARD = 1024;

// (random, so that no game is told by anything of its player's)
const newPlayerId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) =>
    (n % 36).toString(36),
  ).join("");

export const linkChanged = () => {
  link.open = link.role != ROLE.none && (relayOpen || directLinks() > 0);
};

// Whether a message is heard the first time (one without a number always is).
export const firstHeard = ({ from, seq }) => {
  if (!Number.isInteger(seq)) {
    return true;
  }
  let seqs = heard.get(from);
  if (!seqs) {
    seqs = new Set();
    heard.set(from, seqs);
  }
  if (seqs.has(seq)) {
    return false;
  }
  seqs.add(seq);
  if (seqs.size > 2 * MOST_HEARD) {
    for (const old of seqs) {
      seqs.delete(old);
      if (seqs.size <= MOST_HEARD) {
        break;
      }
    }
  }
  return true;
};

// A message of another game, over the relay or directly from the game `by`: the host
// passes it on to the guests linked with it (but the one it came from).
// (whatever another game sends is checked before it is used)
const hear = (text, by = null) => {
  let message;
  try {
    message = decode(text);
  } catch {
    return;
  }
  if (
    !message ||
    typeof message != "object" ||
    !isPlayerId(message.from) ||
    message.from == link.id ||
    !firstHeard(message)
  ) {
    return;
  }
  if (link.role == ROLE.host) {
    sendDirectly(text, by ?? message.from);
  }
  receiveDirect(message);
  receiver(message);
};

// A host lists its room for everyone to join, or (null) no longer (see server/relay.js):
// a message to the relay alone. Returns whether it went.
export const sendListing = (listing) => {
  if (!relayOpen) {
    return false;
  }
  socket.send(JSON.stringify({ relay: "listing", listing }));
  return true;
};

// Opens the room as host or guest; receive gets every message the other games send.
export const openLink = (role, room, receive) => {
  closeLink();
  link.role = role;
  link.room = room;
  link.id = newPlayerId();
  receiver = receive;
  sent = 0;
  heard.clear();
  openDirect(hear);
  link.send = (message) => {
    const text = encode({ ...message, from: link.id, seq: sent++ });
    if (relayOpen) {
      socket.send(text);
    }
    sendDirectly(text);
  };
  const scheme = location.protocol == "https:" ? "wss:" : "ws:";
  const connect = () => {
    const own = new WebSocket(
      `${scheme}//${location.host}/net?room=${encodeURIComponent(room)}`,
    );
    socket = own;
    own.onopen = () => {
      relayOpen = true;
      linkChanged();
    };
    own.onmessage = (event) => hear(event.data);
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
      relayOpen = false;
      linkChanged();
      setTimeout(() => socket == own && connect(), RECONNECT_MS);
    };
  };
  connect();
};

export const closeLink = () => {
  const old = socket;
  socket = null;
  relayOpen = false;
  old?.close();
  closeDirect();
  receiver = () => {};
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
