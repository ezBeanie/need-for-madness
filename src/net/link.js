// The link between the host's game and a guest's, opened with ?host=<room> and
// ?join=<room>: a WebSocket to the relay of the server the game came from (see
// server/relay.js), which passes the messages on to the other game in the room.

export const ROLE = { none: 0, host: 1, guest: 2 };

export const MESSAGE = {
  join: "join",
  keys: "keys",
  start: "start",
  tick: "tick",
  end: "end",
};

// the car the guest drives: the one beside the player's on the start grid
export const GUEST_CAR = 1;

// How the race ended for the guest, as the guest's HUD shows it.
export const OUTCOME = { none: 0, won: 1, wastedThem: 2, wasted: 3, lost: 4 };

// whether n is a whole number from 0 up to below `below`: what another game sends is checked
export const isIndex = (n, below) => Number.isInteger(n) && n >= 0 && n < below;

// how long a lost connection waits before it tries again
const RECONNECT_MS = 2000;

const params = new URLSearchParams(globalThis.location?.search);
const hostRoom = params.get("host");
const guestRoom = params.get("join");

export const link = {
  role: hostRoom ? ROLE.host : guestRoom ? ROLE.guest : ROLE.none,
  send: () => {},
};

// Opens the room of the URL; receive gets every message the other side sends.
export const openLink = (receive) => {
  if (link.role == ROLE.none) {
    return;
  }
  const scheme = location.protocol == "https:" ? "wss:" : "ws:";
  const room = encodeURIComponent(hostRoom ?? guestRoom);
  const connect = () => {
    const socket = new WebSocket(
      `${scheme}//${location.host}/net?room=${room}`,
    );
    socket.onopen = () => {
      link.send = (message) => socket.send(JSON.stringify(message));
    };
    socket.onmessage = (event) => {
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
    socket.onclose = () => {
      link.send = () => {};
      setTimeout(connect, RECONNECT_MS);
    };
  };
  connect();
};
