// The multiplayer dialog: hosting a race (a room with a code and a link for the guest) or
// joining one with the host's code. A button beside the options' gear opens it, in the
// menus a race of the host's can take the guest away from.

import { PHASE, game } from "../core/state.js";
import { guestThere, hostRoom } from "../net/host.js";
import { hostThere, joinRoom } from "../net/guest.js";
import { ROLE, ROOM_NAME, closeLink, link } from "../net/link.js";

const button = document.getElementById("multiplayerButton");
const dialog = document.getElementById("multiplayer");
const element = (id) => document.getElementById(id);

const SHOWN_IN = [PHASE.mainMenu, PHASE.carSelect, PHASE.stageSelect];

// (no letters and digits that look alike, for codes read out or typed on a phone)
const CODE_LETTERS = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 5;

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
    return guestThere()
      ? "Your guest is here. Close this and start a race: they drive the car beside yours."
      : "Waiting for a guest to join...";
  }
  return hostThere()
    ? "The host is here. The race starts when the host starts it."
    : "Waiting for the host...";
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
  // (set only when it changes, so screen readers announce each change once)
  if (line.textContent != text) {
    line.textContent = text;
  }
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
    closeLink();
    copy.textContent = "Copy";
    showRoom();
  });
  element("multiplayerClose").addEventListener("click", () => dialog.close?.());
};

// Every tick: the button only where it belongs, and the dialog up to date.
export const placeMultiplayerButton = () => {
  const hidden = !SHOWN_IN.includes(game.phase);
  if (button.hidden != hidden) {
    button.hidden = hidden;
    if (hidden) {
      dialog.close?.();
    }
  }
  if (!hidden) {
    showRoom();
  }
};
