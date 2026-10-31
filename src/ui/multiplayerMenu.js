// The multiplayer dialog: hosting a race (a room with a code and a link for the guests) or
// joining one with the host's code, and the room's players with their cars. A button beside
// the options' gear opens it, in the menus a race of the host's can take a guest away from.

import { PHASE, game } from "../core/state.js";
import { carStats } from "../data/carStats.js";
import { hostRoom, roomGuests } from "../net/host.js";
import { guest, hostThere, joinRoom } from "../net/guest.js";
import { ROLE, ROOM_NAME, leaveRoom, link } from "../net/link.js";

const button = document.getElementById("multiplayerButton");
const dialog = document.getElementById("multiplayer");
const element = (id) => document.getElementById(id);

const SHOWN_IN = [PHASE.mainMenu, PHASE.carSelect, PHASE.stageSelect];

// (no letters and digits that look alike, for codes read out or typed on a phone)
const CODE_LETTERS = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 5;

export const ROOM_ENDED = "The host left the room.";

const newRoomCode = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(CODE_LENGTH)),
    (n) => CODE_LETTERS[n % CODE_LETTERS.length],
  ).join("");

const joinLink = (room) =>
  `${location.origin}${location.pathname}?join=${encodeURIComponent(room)}`;

const status = () => {
  if (!link.open) {
    return "Connecting...";
  }
  if (link.role == ROLE.host) {
    return roomGuests().length > 0
      ? "Close this and start a race: the others drive the cars beside yours."
      : "Waiting for others to join...";
  }
  return hostThere()
    ? "Choose your car. The race starts when the host starts it."
    : "Waiting for the host...";
};

// The room's players, the host first, each with its car (the own one as chosen now).
const players = () =>
  link.role == ROLE.host
    ? [{ carType: game.carTypes[0], you: true }, ...roomGuests()]
    : guest.players.map((player) => ({
        ...player,
        you: player.id == link.id,
      }));

const playerLine = ({ carType, you }, i) => {
  const roles = [i == 0 && " (host)", you && " (you)"].filter(Boolean).join("");
  return `Player ${i + 1}${roles}: ${carStats.names[carType]}`;
};

const showPlayers = () => {
  const lines = players().map(playerLine);
  const list = element("multiplayerPlayers");
  // (changed only when it changes, so screen readers announce each change once)
  if (list.dataset.lines != lines.join("\n")) {
    list.dataset.lines = lines.join("\n");
    list.replaceChildren(
      ...lines.map((line) => {
        const item = document.createElement("li");
        item.textContent = line;
        return item;
      }),
    );
  }
};

// What the dialog and its button show: the choice, or the room the game is in.
const showRoom = () => {
  const inRoom = link.role != ROLE.none;
  const label = inRoom ? `Room ${link.room}` : "Multiplayer";
  if (button.textContent != label) {
    button.textContent = label;
  }
  element("multiplayerChoose").hidden = inRoom;
  element("multiplayerRoom").hidden = !inRoom;
  if (!inRoom) {
    return;
  }
  element("multiplayerRoomName").textContent = link.room;
  element("multiplayerShare").hidden = link.role != ROLE.host;
  element("multiplayerLink").value = joinLink(link.room);
  const text = status();
  const line = element("multiplayerStatus");
  if (line.textContent != text) {
    line.textContent = text;
  }
  showPlayers();
};

const showNotice = (text) => {
  const notice = element("multiplayerNotice");
  notice.textContent = text;
  notice.hidden = !text;
};

const showCodeError = (text) => {
  const error = element("multiplayerCodeError");
  error.textContent = text;
  error.hidden = !text;
  element("multiplayerCode").setAttribute(
    "aria-invalid",
    text ? "true" : "false",
  );
};

export const installMultiplayerMenu = () => {
  button.addEventListener("click", () => {
    showRoom();
    dialog.showModal?.();
  });
  element("multiplayerHost").addEventListener("click", () => {
    showNotice("");
    hostRoom(newRoomCode());
    showRoom();
  });
  element("multiplayerJoinForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const room = element("multiplayerCode").value.trim().toLowerCase();
    if (!ROOM_NAME.test(room)) {
      showCodeError(
        "Enter the code the host sees: letters, digits and dashes.",
      );
      return;
    }
    showCodeError("");
    showNotice("");
    joinRoom(room);
    showRoom();
  });
  const copy = element("multiplayerCopy");
  // (the clipboard only in secure pages; elsewhere the link is selected by hand)
  copy.hidden = !navigator.clipboard;
  copy.addEventListener("click", () =>
    navigator.clipboard.writeText(element("multiplayerLink").value).then(() => {
      copy.textContent = "Copied";
    }),
  );
  element("multiplayerLeave").addEventListener("click", () => {
    leaveRoom();
    copy.textContent = "Copy";
    showRoom();
  });
  element("multiplayerClose").addEventListener("click", () => dialog.close?.());
};

// Every tick: the button only where it belongs, and the dialog up to date. A room the
// host left opens it, to say so.
export const placeMultiplayerButton = () => {
  const hidden = !SHOWN_IN.includes(game.phase);
  if (button.hidden != hidden) {
    button.hidden = hidden;
    if (hidden) {
      dialog.close?.();
    }
  }
  if (hidden) {
    return;
  }
  showRoom();
  if (guest.roomEnded) {
    guest.roomEnded = false;
    showNotice(ROOM_ENDED);
    if (!dialog.open) {
      dialog.showModal?.();
    }
  }
};
