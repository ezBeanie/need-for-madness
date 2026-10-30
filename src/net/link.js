// The link between the host's game and a guest's, opened from the multiplayer dialog (see
// ui/multiplayerMenu.js) or with ?host=<room> and ?join=<room>: a WebSocket to the relay of
// the server the game came from (see server/relay.js), which passes the messages on to the
// other game in the room.

export const ROLE = { none: 0, host: 1, guest: 2 };

export const MESSAGE = {
  join: "join",
  // the host's answer to a join: it is there
  here: "here",
  keys: "keys",
  start: "start",
  tick: "tick",
  end: "end",
  // the guest left the race for the menus
  left: "left",
  // the host's answer to a ping, at once: the time to the host and back
  pong: "pong",
};

// the car the guest drives: the one beside the player's on the start grid
export const GUEST_CAR = 1;

// What the host sends of the guest's car each tick besides the race tape, for the guest's
// HUD: its meters, checkpoints and stunts (see ui/hud.js).
export const GUEST_HUD_FIELDS = [
  "nlaps",
  "damage",
  "power",
  "point",
  "missedCheckpoint",
  "clear",
  "capcnt",
  "grounded",
  "stunt",
  "stuntPower",
  "surfed",
  "flipped",
  "flippedFarBack",
  "flippedFarForward",
  "rolled",
  "rolledFar",
  "spun",
];

// How the race ended for the guest, as the guest's HUD shows it.
export const OUTCOME = { none: 0, won: 1, wastedThem: 2, wasted: 3, lost: 4 };

// whether n is a whole number from 0 up to below `below`: what another game sends is checked
export const isIndex = (n, below) => Number.isInteger(n) && n >= 0 && n < below;

// the room names the relay takes
export const ROOM_NAME = /^[a-z0-9-]{1,32}$/i;

// how long a lost connection waits before it tries again
const RECONNECT_MS = 2000;

const params = new URLSearchParams(globalThis.location?.search);
// the room of the URL, if any
export const urlRoom = { host: params.get("host"), join: params.get("join") };

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
      link.send = (message) => own.send(JSON.stringify(message));
    };
    own.onmessage = (event) => {
      // (whatever another game sends is checked before it is used)
      let message;
      try {
        message = JSON.parse(event.data);
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
