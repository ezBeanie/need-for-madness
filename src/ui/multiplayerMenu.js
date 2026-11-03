// The multiplayer dialog: hosting a race (a room with a code and a link for the guests) or
// joining one with the host's code, then the room's lobby: its players with their cars and
// whether they are ready, its bots, which the host adds and chooses the cars of, the stage
// the host chooses, each player's car, and a chat. The host starts the race once everyone
// is ready, and the lobby comes back after it. The main menu opens it, and a button beside
// the options' gear in the menus a race of the host's can take a guest away from.

import { PHASE, game } from "../core/state.js";
import { carStats } from "../data/carStats.js";
import { saveSetting } from "../core/storage.js";
import { sharedStageGroups, stageLabel } from "../data/stages.js";
import { chat, sendChat } from "../net/chat.js";
import {
  addBot,
  canAddBot,
  chooseBotCar,
  chooseRoomStage,
  everyoneReady,
  hostRoom,
  removeBot,
  roomBots,
  roomGuests,
  roomStage,
  sendPlayers,
  startRoomRace,
} from "../net/host.js";
import {
  guest,
  hostThere,
  joinRoom,
  setReady,
  tellHost,
} from "../net/guest.js";
import { menu } from "../screens/menuState.js";
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
    if (roomGuests().length == 0) {
      return "Waiting for others to join. You can also start a race with bots now.";
    }
    return everyoneReady()
      ? "Everyone is ready: start a race when you like."
      : "Waiting for everyone to be ready...";
  }
  if (!hostThere()) {
    return "Waiting for the host...";
  }
  return guest.ready
    ? "You are ready. The race starts when the host starts it."
    : "Choose your car, then say you are ready.";
};

// The room's players, the host first, each with its car (the own one as chosen now).
const players = () =>
  link.role == ROLE.host
    ? [
        { id: link.id, carType: game.carTypes[0], ready: true, you: true },
        ...roomGuests(),
      ]
    : guest.players.map((player) => ({
        ...player,
        you: player.id == link.id,
      }));

const playerName = (i, you) =>
  `Player ${i + 1}${[i == 0 && " (host)", you && " (you)"].filter(Boolean).join("")}`;

const playerItem = ({ carType, ready, you }, i) => {
  const item = document.createElement("li");
  const who = document.createElement("span");
  who.textContent = `${playerName(i, you)}: ${carStats.names[carType]}`;
  const state = document.createElement("span");
  state.className = ready ? "ready" : "waiting";
  state.textContent = ready ? "Ready" : "Not ready";
  item.append(who, state);
  return item;
};

const showPlayers = () => {
  const all = players();
  const shape = JSON.stringify(
    all.map(({ carType, ready, you }) => [carType, ready, you]),
  );
  const list = element("multiplayerPlayers");
  // (changed only when it changes, so screen readers announce each change once)
  if (list.dataset.shape != shape) {
    list.dataset.shape = shape;
    list.replaceChildren(...all.map(playerItem));
  }
};

// The stages to race: the host chooses among them, the guests see the one chosen.
const showStage = () => {
  const isHost = link.role == ROLE.host;
  const stage = isHost ? roomStage() : guest.stage;
  element("lobbyStageChoice").hidden = !isHost;
  const select = element("lobbyStage");
  if (isHost && select.value != String(stage)) {
    select.value = String(stage);
  }
  const name = element("lobbyStageName");
  name.hidden = isHost;
  const text = stage ? `Stage: ${stageLabel(stage)}` : "Stage: not chosen yet";
  if (!isHost && name.textContent != text) {
    name.textContent = text;
  }
};

const showChoices = () => {
  const isHost = link.role == ROLE.host;
  const car = element("lobbyCar");
  if (document.activeElement != car && car.value != String(game.carTypes[0])) {
    car.value = String(game.carTypes[0]);
  }
  const ready = element("lobbyReady");
  ready.hidden = isHost;
  ready.setAttribute("aria-pressed", guest.ready ? "true" : "false");
  const readyText = guest.ready ? "Ready!" : "Ready";
  if (ready.textContent != readyText) {
    ready.textContent = readyText;
  }
  const start = element("lobbyStart");
  start.hidden = !isHost;
  start.disabled = isHost && !everyoneReady();
};

// The chat's lines, each said by whom; only the new ones are added, for screen readers.
let chatShown = 0;
const showChat = () => {
  const log = element("lobbyChat");
  if (chat.count < chatShown) {
    log.replaceChildren();
    chatShown = 0;
  }
  const fresh = chat.lines.slice(chat.lines.length - (chat.count - chatShown));
  if (fresh.length == 0) {
    return;
  }
  const all = players();
  for (const { from, text } of fresh) {
    const index = all.findIndex(({ id }) => id == from);
    const item = document.createElement("li");
    const who = document.createElement("span");
    who.className = "from";
    who.textContent = index < 0 ? "Someone" : playerName(index, all[index].you);
    item.append(who, `: ${text}`);
    log.append(item);
  }
  while (log.children.length > chat.lines.length) {
    log.firstElementChild.remove();
  }
  chatShown = chat.count;
  log.scrollTop = log.scrollHeight;
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
  dialog.classList?.toggle("in-room", inRoom);
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
  showStage();
  showChoices();
  showChat();
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
  fillChoices();
  showRoom();
  dialog.showModal?.();
};

// (filled when first shown)
let filled = false;
const fillChoices = () => {
  if (filled) {
    return;
  }
  filled = true;
  element("lobbyCar").append(
    ...carStats.names.map((name, type) => new Option(name, String(type))),
  );
  element("lobbyStage").append(
    ...sharedStageGroups().map(({ label, stages }) => {
      const group = document.createElement("optgroup");
      group.label = label;
      group.append(
        ...stages.map((stage) => new Option(stageLabel(stage), String(stage))),
      );
      return group;
    }),
  );
};

export const installMultiplayerMenu = () => {
  button.addEventListener("click", openMultiplayer);
  element("lobbyCar").addEventListener("change", (event) => {
    game.carTypes[0] = Number(event.target.value);
    saveSetting("carsel", game.carTypes[0]);
    if (link.role == ROLE.host) {
      sendPlayers();
    }
    tellHost();
  });
  element("lobbyStage").addEventListener("change", (event) =>
    chooseRoomStage(Number(event.target.value)),
  );
  element("lobbyReady").addEventListener("click", () => {
    setReady(!guest.ready);
    showRoom();
  });
  element("lobbyStart").addEventListener("click", () => {
    if (everyoneReady()) {
      dialog.close?.();
      startRoomRace();
    }
  });
  element("lobbyChatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = element("lobbyChatText");
    sendChat(text.value);
    text.value = "";
    showChat();
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
  element("multiplayerAddBot").addEventListener("click", () => {
    addBot();
    showBots();
    const selects = element("multiplayerBotList").querySelectorAll("select");
    selects[selects.length - 1]?.focus();
  });
  element("multiplayerClose").addEventListener("click", () => dialog.close?.());
};

// whether the game left the menus while in a room: the lobby comes back after the race
let raced = false;

// Every tick: the button only where it belongs (the main menu has Multiplayer of its own),
// and the dialog up to date. A room the host left, or one full, opens it, to say so, and
// so does the main menu after a race of the room.
export const placeMultiplayerButton = () => {
  const away = !SHOWN_IN.includes(game.phase);
  const hidden = away || (game.phase == PHASE.mainMenu && !classicMenus());
  if (button.hidden != hidden) {
    button.hidden = hidden;
  }
  if (away) {
    raced ||= link.role != ROLE.none && game.phase == PHASE.race;
    dialog.close?.();
    return;
  }
  if (raced && game.phase == PHASE.mainMenu) {
    raced = false;
    if (link.role != ROLE.none) {
      menu.continuesToCarSelect = false;
      openMultiplayer();
    }
  }
  showRoom();
  if (guest.roomEnded || link.full) {
    showNotice(guest.roomEnded ? ROOM_ENDED : ROOM_FULL);
    guest.roomEnded = false;
    link.full = false;
    if (!dialog.open) {
      openMultiplayer();
    }
  }
};
