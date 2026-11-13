// The multiplayer screen: hosting a race (a room with a code and a link for the guests) or
// joining one with the host's code, then the room's lobby: its players, each on a card with
// its car turning (see render/carPreviews.js) and whether it is ready or what it does out of
// the lobby (in a race, watching the highlight, ...), its bots, which the
// host adds and chooses the cars of, the stage the host chooses, each player's car, and a
// chat. The host starts the race once everyone is ready, and the lobby comes back after
// it. The main menu opens it (the classic one with a button beside its Options).

import {
  MATCH_MINUTES,
  PHASE,
  RACE_KIND,
  RACE_MODE,
  RACE_MODE_NAMES,
  COLLISION_NAMES,
  RESPAWN_SECONDS,
  STRENGTH_NAMES,
  game,
  raceSetup,
} from "../core/state.js";
import { carStats } from "../data/carStats.js";
import { saveSetting } from "../core/storage.js";
import { sharedStageGroups, stageLabel } from "../data/stages.js";
import { chat, sendChat } from "../net/chat.js";
import {
  addBot,
  canAddBot,
  chooseBotCar,
  chooseBotSkin,
  chooseRoomMode,
  chooseRoomRule,
  chooseRoomStage,
  everyoneReady,
  hostRoom,
  removeBot,
  roomBots,
  roomGuests,
  roomMode,
  roomRulesChosen,
  roomStage,
  sendPlayers,
  startRoomRace,
} from "../net/host.js";
import {
  guest,
  hostThere,
  joinRoom,
  setReady,
  watchRoomRace,
  tellHost,
} from "../net/guest.js";
import { menu } from "../screens/menuState.js";
import {
  PLAYER_STATUS,
  ROLE,
  ROOM_NAME,
  leaveRoom,
  link,
  statusOf,
} from "../net/link.js";
import { linkedDirectly } from "../net/direct.js";
import { classicMenus } from "../render/look.js";
import { SKINS } from "../render/skins.js";
import { botNames, own, setOwnSkin } from "../net/roomCars.js";
import { isTalking, talk, voice } from "../net/voice.js";
import {
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  previews,
  turnCarPreviews,
} from "../render/carPreviews.js";

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
    if (!everyoneReady()) {
      return "Waiting for everyone to be ready...";
    }
    // (those still in the race, its highlight or results race the next one)
    return roomGuests().every(({ status }) => status == PLAYER_STATUS.lobby)
      ? "Everyone is ready: start a race when you like."
      : "Everyone in the lobby is ready: start a race when you like. The others can join the next one.";
  }
  if (!hostThere()) {
    return "Waiting for the host...";
  }
  if (guest.racing) {
    return "A race is going on: watch it, or wait for the next one.";
  }
  return guest.ready
    ? "You are ready. The race starts when the host starts it."
    : "Choose your car, then say you are ready.";
};

// The room's players, the host first, each with its car (the own one as chosen now).
const players = () =>
  link.role == ROLE.host
    ? [
        {
          id: link.id,
          name: own.name,
          carType: game.carTypes[0],
          skin: own.skin,
          ready: true,
          you: true,
        },
        ...roomGuests(),
      ]
    : guest.players.map((player) => ({
        ...player,
        you: player.id == link.id,
      }));

// (the own one as chosen now, the others' as the host last told)
const playerName = (i, you, name) =>
  `${(you ? own.name : name) || `Player ${i + 1}`}${[i == 0 && " (host)", you && " (you)"].filter(Boolean).join("")}`;

// (a picture only: the card says the car's name and paint)
const carPreview = (carType, skin) => {
  const canvas = document.createElement("canvas");
  canvas.className = "car-preview";
  canvas.width = PREVIEW_WIDTH;
  canvas.height = PREVIEW_HEIGHT;
  canvas.dataset.car = String(carType);
  canvas.dataset.skin = String(skin);
  canvas.setAttribute("aria-hidden", "true");
  return canvas;
};

const textOf = (className, text) => {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
};

// (the card's lines read as one: "Player 1 (host): Radical One, Ready")
const unseen = (text) => textOf("visually-hidden", text);

// (a car in a paint of its own says so: "Radical One in red")
const carText = (carType, skin) =>
  skin
    ? `${carStats.names[carType]} in ${SKINS[skin].toLowerCase()}`
    : carStats.names[carType];

// (by PLAYER_STATUS, but in the lobby, where the card says whether the player is ready)
const STATUS_TEXT = [
  null,
  "In a race",
  "Watching the highlight",
  "Watching the replay",
  "At the results",
  "Away",
];

// whether the player is ready, or what it does out of the lobby
const stateText = (ready, status) => {
  if (status != PLAYER_STATUS.lobby) {
    return textOf("away", STATUS_TEXT[status]);
  }
  return textOf(ready ? "ready" : "waiting", ready ? "Ready" : "Not ready");
};

const playerItem = (
  { id, name, carType, skin, ready, status, you, near },
  i,
) => {
  const item = document.createElement("li");
  item.classList?.toggle("you", Boolean(you));
  item.dataset.id = id;
  item.append(
    carPreview(carType, skin),
    textOf("who", playerName(i, you, name)),
    unseen(": "),
    textOf("car", carText(carType, skin)),
    unseen(", "),
    stateText(ready, you ? statusOf(game.phase) : status),
  );
  // (linked directly: the races with this one go without the relay)
  if (near) {
    item.append(unseen(", "), textOf("near", "Same network"));
  }
  return item;
};

const showPlayers = () => {
  const all = players().map((player) => ({
    ...player,
    near: linkedDirectly(player.id),
  }));
  const shape = JSON.stringify(
    all.map(({ name, carType, skin, ready, status, you, near }) => [
      you ? own.name : name,
      carType,
      skin,
      ready,
      you ? statusOf(game.phase) : status,
      you,
      near,
    ]),
  );
  const list = element("multiplayerPlayers");
  // (changed only when it changes, so screen readers announce each change once)
  if (list.dataset.shape != shape) {
    list.dataset.shape = shape;
    list.replaceChildren(...all.map(playerItem));
  }
  // (who talks shows only to the eye: a voice is heard anyway)
  for (const item of list.children) {
    const who = item.querySelector(".who");
    const talking =
      item.dataset.id == link.id ? voice.talking : isTalking(item.dataset.id);
    who?.classList.toggle("talking", talking);
  }
};

// A select set to value (left alone when it is).
const setSelect = (id, value) => {
  const select = element(id);
  if (select.value != String(value)) {
    select.value = String(value);
  }
};

// The race's stage, mode and rules: the host chooses them, the guests see them listed.
const showRace = () => {
  const isHost = link.role == ROLE.host;
  const stage = isHost ? roomStage() : guest.stage;
  const mode = isHost ? roomMode() : guest.mode;
  const rules = isHost ? roomRulesChosen() : guest.rules;
  const mostKills = mode == RACE_MODE.mostKills;
  element("lobbySettings").hidden = !isHost;
  element("lobbyRules").hidden = isHost;
  if (isHost) {
    setSelect("lobbyStage", stage);
    setSelect("lobbyMode", mode);
    setSelect("lobbyStrength", rules.strength);
    setSelect("lobbyCollisions", rules.collisions);
    setSelect("lobbyMinutes", rules.minutes);
    setSelect("lobbyRespawn", rules.respawnSeconds);
    element("lobbyMinutesChoice").hidden = !mostKills;
    element("lobbyRespawnChoice").hidden = !mostKills;
    return;
  }
  const shown = [
    ["Stage", stage ? stageLabel(stage) : "not chosen yet"],
    ["Mode", RACE_MODE_NAMES[mode]],
    ["Bot strength", STRENGTH_NAMES[rules.strength]],
    ["Collisions", COLLISION_NAMES[rules.collisions]],
  ];
  if (mostKills) {
    shown.push(
      ["Time", minutesText(rules.minutes)],
      ["Back after", secondsText(rules.respawnSeconds)],
    );
  }
  // (changed only when it changes, for screen readers)
  const list = element("lobbyRules");
  const shape = JSON.stringify(shown);
  if (list.dataset.shape != shape) {
    list.dataset.shape = shape;
    list.replaceChildren(
      ...shown.flatMap(([term, value]) => {
        const dt = document.createElement("dt");
        dt.textContent = term;
        const dd = document.createElement("dd");
        dd.textContent = value;
        return [dt, dd];
      }),
    );
  }
};

const minutesText = (minutes) => `${minutes} min`;
const secondsText = (seconds) => `${seconds} s`;

const showChoices = () => {
  const isHost = link.role == ROLE.host;
  const car = element("lobbyCar");
  if (document.activeElement != car && car.value != String(game.carTypes[0])) {
    car.value = String(game.carTypes[0]);
  }
  const skin = element("lobbySkin");
  if (document.activeElement != skin && skin.value != String(own.skin)) {
    skin.value = String(own.skin);
  }
  const talkButton = element("lobbyTalk");
  talkButton.hidden = !voice.on || voice.byVoice;
  talkButton.setAttribute("aria-pressed", voice.talking ? "true" : "false");
  let hint =
    "Voice chat is off. Switch it on in the options to talk with the others.";
  if (voice.on) {
    hint = voice.byVoice
      ? "The others hear you whenever you speak."
      : "Hold to talk, or tap to talk until you tap again. In a race hold P.";
  }
  const talkHint = element("lobbyTalkHint");
  if (talkHint.textContent != hint) {
    talkHint.textContent = hint;
  }
  const ready = element("lobbyReady");
  ready.hidden = isHost;
  ready.setAttribute("aria-pressed", guest.ready ? "true" : "false");
  const readyText = guest.ready ? "Ready!" : "Ready";
  if (ready.textContent != readyText) {
    ready.textContent = readyText;
  }
  const watch = element("lobbyWatch");
  watch.hidden = isHost || !guest.racing;
  watch.disabled = guest.watchAsked;
  const watchText = guest.watchAsked ? "Asking the host..." : "Watch the race";
  if (watch.textContent != watchText) {
    watch.textContent = watchText;
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
  // (more new ones than kept, during a race: the kept ones)
  const fresh = chat.lines.slice(
    Math.max(0, chat.lines.length - (chat.count - chatShown)),
  );
  if (fresh.length == 0) {
    return;
  }
  const all = players();
  for (const { from, text } of fresh) {
    const index = all.findIndex(({ id }) => id == from);
    const item = document.createElement("li");
    const who = document.createElement("span");
    who.className = "from";
    who.textContent =
      index < 0
        ? "Someone"
        : playerName(index, all[index].you, all[index].name);
    item.append(who, `: ${text}`);
    log.append(item);
  }
  while (log.children.length > chat.lines.length) {
    log.firstElementChild.remove();
  }
  chatShown = chat.count;
  log.scrollTop = log.scrollHeight;
};

// (each a car to choose, so a list rebuilt only when bots come or go: one chosen in keeps
// its focus)
const skinChoice = (id, label, skin, choose) => {
  const choice = document.createElement("label");
  choice.htmlFor = id;
  choice.className = "visually-hidden";
  choice.textContent = label;
  const select = document.createElement("select");
  select.id = id;
  select.append(...SKINS.map((name, k) => new Option(name, String(k))));
  select.value = String(skin);
  select.addEventListener("change", () => choose(Number(select.value)));
  return [choice, select];
};

// (its name, from its car, is told by nameHostBots)
const hostBotItem = ({ carType, skin }, i) => {
  const item = document.createElement("li");
  const preview = carPreview(carType, skin);
  const label = document.createElement("label");
  label.htmlFor = `multiplayerBot${i}`;
  const select = document.createElement("select");
  select.id = `multiplayerBot${i}`;
  select.append(
    ...carStats.names.map((name, type) => new Option(name, String(type))),
  );
  select.value = String(carType);
  select.addEventListener("change", () => {
    chooseBotCar(i, Number(select.value));
    preview.dataset.car = select.value;
    showBots();
  });
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => {
    removeBot(i);
    showBots();
    element("multiplayerAddBot").focus();
  });
  const paint = skinChoice(`multiplayerBotSkin${i}`, "", skin, (chosen) => {
    chooseBotSkin(i, chosen);
    preview.dataset.skin = String(chosen);
  });
  item.append(preview, label, select, ...paint, remove);
  return item;
};

const guestBotItem = (name, { carType, skin }) => {
  const item = document.createElement("li");
  item.append(
    carPreview(carType, skin),
    textOf("who", name),
    unseen(": "),
    textOf("car", carText(carType, skin)),
  );
  return item;
};

// (a car chosen renames its bot, and others in the same car, in place: the list kept, the
// choice keeps its focus)
const nameHostBots = (list, names) => {
  [...list.children].forEach((item, i) => {
    const [label, skinLabel] = item.querySelectorAll("label");
    if (label.textContent != names[i]) {
      label.textContent = names[i];
      skinLabel.textContent = `Paint of ${names[i]}`;
      item
        .querySelector("button")
        .setAttribute("aria-label", `Remove ${names[i]}`);
    }
  });
};

const showBots = () => {
  const isHost = link.role == ROLE.host;
  const bots = isHost ? roomBots() : guest.bots;
  element("multiplayerBots").hidden = !isHost && bots.length == 0;
  element("multiplayerAddBot").hidden = !isHost;
  element("multiplayerAddBot").disabled = isHost && !canAddBot();
  const list = element("multiplayerBotList");
  const shape = isHost
    ? `host ${bots.length}`
    : `guest ${JSON.stringify(bots)}`;
  const names = botNames(bots.map(({ carType }) => carType));
  if (list.dataset.shape != shape) {
    list.dataset.shape = shape;
    list.replaceChildren(
      ...bots.map((bot, i) =>
        isHost ? hostBotItem(bot, i) : guestBotItem(names[i], bot),
      ),
    );
  }
  if (isHost) {
    nameHostBots(list, names);
  }
};

// What the screen and its button show: the choice, or the room the game is in.
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
  element("multiplayerRoomLine").hidden = !inRoom;
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
  showRace();
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
  element("lobbySkin").append(
    ...SKINS.map((name, skin) => new Option(name, String(skin))),
  );
  element("lobbyMode").append(
    ...RACE_MODE_NAMES.map((name, mode) => new Option(name, String(mode))),
  );
  element("lobbyStrength").append(
    ...STRENGTH_NAMES.map(
      (name, strength) => new Option(name, String(strength)),
    ),
  );
  element("lobbyCollisions").append(
    ...COLLISION_NAMES.map(
      (name, collisions) => new Option(name, String(collisions)),
    ),
  );
  element("lobbyMinutes").append(
    ...MATCH_MINUTES.map(
      (minutes) => new Option(minutesText(minutes), String(minutes)),
    ),
  );
  element("lobbyRespawn").append(
    ...RESPAWN_SECONDS.map(
      (seconds) => new Option(secondsText(seconds), String(seconds)),
    ),
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
  element("lobbySkin").addEventListener("change", (event) => {
    setOwnSkin(Number(event.target.value));
    if (link.role == ROLE.host) {
      sendPlayers();
    }
    tellHost();
  });
  // Talk: held, the player talks while it is down; tapped, until tapped again (screen
  // readers and Enter tap it). The mouse, a finger and the space bar hold it.
  const talkButton = element("lobbyTalk");
  const HOLD_MS = 300;
  let pressedAt = null;
  const press = () => {
    if (pressedAt === null && !voice.talking) {
      pressedAt = performance.now();
      talk(true);
    }
  };
  const release = () => {
    if (pressedAt === null) {
      talk(false);
      return;
    }
    // (a tap keeps talking)
    if (performance.now() - pressedAt >= HOLD_MS) {
      talk(false);
    }
    pressedAt = null;
  };
  talkButton.addEventListener("pointerdown", press);
  talkButton.addEventListener("pointerup", release);
  talkButton.addEventListener("pointercancel", release);
  talkButton.addEventListener("pointerleave", () => {
    if (pressedAt !== null) {
      pressedAt = null;
      talk(false);
    }
  });
  talkButton.addEventListener("keydown", (event) => {
    if (event.key == " ") {
      event.preventDefault();
      if (!event.repeat) {
        press();
      }
    }
  });
  talkButton.addEventListener("keyup", (event) => {
    if (event.key == " ") {
      // (no click after it: the key did its work)
      event.preventDefault();
      release();
    }
  });
  // (Enter, and a screen reader's activation, click without a pointer)
  talkButton.addEventListener("click", (event) => {
    if (event.detail == 0 && pressedAt === null) {
      talk(!voice.talking);
    }
  });
  talkButton.addEventListener("blur", () => {
    pressedAt = null;
    talk(false);
  });
  element("lobbyStage").addEventListener("change", (event) =>
    chooseRoomStage(Number(event.target.value)),
  );
  // (most kills' own rules show at once)
  element("lobbyMode").addEventListener("change", (event) => {
    chooseRoomMode(Number(event.target.value));
    showRoom();
  });
  element("lobbyStrength").addEventListener("change", (event) =>
    chooseRoomRule({ strength: Number(event.target.value) }),
  );
  element("lobbyCollisions").addEventListener("change", (event) =>
    chooseRoomRule({ collisions: Number(event.target.value) }),
  );
  element("lobbyMinutes").addEventListener("change", (event) =>
    chooseRoomRule({ minutes: Number(event.target.value) }),
  );
  element("lobbyRespawn").addEventListener("change", (event) =>
    chooseRoomRule({ respawnSeconds: Number(event.target.value) }),
  );
  element("lobbyReady").addEventListener("click", () => {
    setReady(!guest.ready);
    showRoom();
  });
  element("lobbyWatch").addEventListener("click", () => {
    watchRoomRace();
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

// Every tick: the button only where it belongs, and the screen up to date. A room the host
// left, or one full, opens it, to say so, and so does the main menu after a race of the
// room.
export const placeMultiplayerButton = () => {
  const away = !SHOWN_IN.includes(game.phase);
  // (only the classic main menu needs it: the modern one has Multiplayer of its own)
  const hidden = game.phase != PHASE.mainMenu || !classicMenus();
  if (button.hidden != hidden) {
    button.hidden = hidden;
  }
  if (away) {
    raced ||=
      game.phase == PHASE.race &&
      (game.humans.length > 0 || raceSetup.kind == RACE_KIND.together);
    dialog.close?.();
    // (a race lights its stage: the cards need the car select's light again after it)
    previews.root = null;
    previews.lit = false;
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
  previews.root = dialog.open && link.role != ROLE.none ? dialog : null;
  turnCarPreviews();
  if (guest.roomEnded || link.full) {
    showNotice(guest.roomEnded ? ROOM_ENDED : ROOM_FULL);
    guest.roomEnded = false;
    link.full = false;
    if (!dialog.open) {
      openMultiplayer();
    }
  }
};
