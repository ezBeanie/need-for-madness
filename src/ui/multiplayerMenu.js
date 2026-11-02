// The multiplayer dialog: hosting a race (a room with a code and a link for the guests) or
// joining one with the host's code, the room's players with their cars, and its bots, which
// the host adds and chooses the cars of. A button beside the options' gear opens it, in the
// menus a race of the host's can take a guest away from.

import { PHASE, game } from "../core/state.js";
import { carStats } from "../data/carStats.js";
import {
  addBot,
  canAddBot,
  chooseBotCar,
  hostRoom,
  removeBot,
  roomBots,
  roomGuests,
} from "../net/host.js";
import { guest, hostThere, joinRoom } from "../net/guest.js";
import { ROLE, ROOM_NAME, leaveRoom, link } from "../net/link.js";
import { classicMenus } from "../render/look.js";

const button = document.getElementById("multiplayerButton");
const dialog = document.getElementById("multiplayer");
const element = (id) => document.getElementById(id);

const SHOWN_IN = [PHASE.mainMenu, PHASE.carSelect, PHASE.stageSelect];

// (no letters and digits that look alike, for codes read out or typed on a phone)
const CODE_LETTERS = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 5;

export const ROOM_ENDED = "The host left the room.";
export const ROOM_FULL = "The room is full: eight race in it already.";

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

const botName = (i) => `Bot ${i + 1}`;

// (each a car to choose, so a list rebuilt only when bots come or go: one chosen in keeps
// its focus)
const hostBotItem = (carType, i) => {
  const item = document.createElement("li");
  const label = document.createElement("label");
  label.htmlFor = `multiplayerBot${i}`;
  label.textContent = botName(i);
  const row = document.createElement("div");
  row.className = "bot";
  const select = document.createElement("select");
  select.id = `multiplayerBot${i}`;
  select.append(
    ...carStats.names.map((name, type) => new Option(name, String(type))),
  );
  select.value = String(carType);
  select.addEventListener("change", () =>
    chooseBotCar(i, Number(select.value)),
  );
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Remove";
  remove.setAttribute("aria-label", `Remove ${botName(i)}`);
  remove.addEventListener("click", () => {
    removeBot(i);
    showBots();
    element("multiplayerAddBot").focus();
  });
  row.append(select, remove);
  item.append(label, row);
  return item;
};

const guestBotItem = (carType, i) => {
  const item = document.createElement("li");
  item.textContent = `${botName(i)}: ${carStats.names[carType]}`;
  return item;
};

const showBots = () => {
  const isHost = link.role == ROLE.host;
  const bots = isHost ? roomBots() : guest.bots;
  element("multiplayerBots").hidden = !isHost && bots.length == 0;
  element("multiplayerAddBot").hidden = !isHost;
  element("multiplayerAddBot").disabled = isHost && !canAddBot();
  const list = element("multiplayerBotList");
  const shape = isHost ? `host ${bots.length}` : `guest ${bots.join(" ")}`;
  if (list.dataset.shape != shape) {
    list.dataset.shape = shape;
    list.replaceChildren(...bots.map(isHost ? hostBotItem : guestBotItem));
  }
};

// What the dialog and its button show: the choice, or the room the game is in.
const showRoom = () => {
  const inRoom = link.role != ROLE.none;
  const label = inRoom ? `Room ${link.room}` : "Multiplayer";
  // (the main menu's button says it too)
  const menuButton = element("menuMultiplayer");
  if (menuButton.textContent != label) {
    menuButton.textContent = label;
  }
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
  showBots();
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

export const openMultiplayer = () => {
  showRoom();
  dialog.showModal?.();
};

export const installMultiplayerMenu = () => {
  button.addEventListener("click", openMultiplayer);
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
  element("multiplayerAddBot").addEventListener("click", () => {
    addBot();
    showBots();
    const selects = element("multiplayerBotList").querySelectorAll("select");
    selects[selects.length - 1]?.focus();
  });
  element("multiplayerClose").addEventListener("click", () => dialog.close?.());
};

// Every tick: the button only where it belongs (the main menu has Multiplayer of its own),
// and the dialog up to date. A room the host left, or one full, opens it, to say so.
export const placeMultiplayerButton = () => {
  const away = !SHOWN_IN.includes(game.phase);
  const hidden = away || (game.phase == PHASE.mainMenu && !classicMenus());
  if (button.hidden != hidden) {
    button.hidden = hidden;
  }
  if (away) {
    dialog.close?.();
    return;
  }
  showRoom();
  if (guest.roomEnded || link.full) {
    showNotice(guest.roomEnded ? ROOM_ENDED : ROOM_FULL);
    guest.roomEnded = false;
    link.full = false;
    if (!dialog.open) {
      dialog.showModal?.();
    }
  }
};
