// The link between the host's game and a guest's. For now a BroadcastChannel: two tabs (or
// windows) of one browser race each other, opened with ?host=<room> and ?join=<room>.

export const ROLE = { none: 0, host: 1, guest: 2 };

export const MESSAGE = {
  join: "join",
  keys: "keys",
  start: "start",
  tick: "tick",
};

// How the race ended for the guest, as the guest's HUD shows it.
export const OUTCOME = { none: 0, won: 1, wastedThem: 2, wasted: 3, lost: 4 };

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
  const channel = new BroadcastChannel(`nfm-${hostRoom ?? guestRoom}`);
  channel.onmessage = (event) => receive(event.data);
  link.send = (message) => channel.postMessage(message);
};
