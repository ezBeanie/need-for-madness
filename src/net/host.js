// The host's side of racing together: the room's players come to the host's game (see
// guest.js), which starts the race with them and sends its whole state to them, then every
// game computes it, each sending only its keys (see lockstep.js).

import { carStats } from "../data/carStats.js";
import { random, seededRandom } from "../core/random.js";
import {
  MAX_CARS,
  MODE,
  PHASE,
  RACE_KIND,
  RACE_MODE,
  game,
  isRaceMode,
  isRoomRules,
  raceSetup,
  roomRules,
} from "../core/state.js";
import { STAGE_COUNT } from "../data/stages.js";
import { AFTER_LOAD, STAGE_LOAD, stageLoad } from "../loading/stageLoad.js";
import { receiveChat, clearChat } from "./chat.js";
import { raceEvents } from "../race/events.js";
import { chooseRaceKind, setUpRaceTogether } from "../race/career.js";
import { field, setUpField } from "../race/field.js";
import { raceCarTextures } from "../render/generated.js";
import { track } from "../race/track.js";
import { inParts } from "./parts.js";
import { saveRace } from "./raceState.js";
import { receiveVoice } from "./voice.js";
import {
  cleanName,
  isTeamChosen,
  own,
  roomCars,
  setRoomCars,
  teamsOf,
} from "./roomCars.js";
import { isSkin } from "../render/skins.js";
import { lockstep, receiveRaceMessage, startLockstep } from "./lockstep.js";
import { answerWatch } from "./watch.js";
import {
  MESSAGE,
  MOST_PLAYERS,
  PLAYER_STATUS,
  ROLE,
  encode,
  isIndex,
  isPlayerStatus,
  link,
  openLink,
  statusOf,
  urlRoom,
} from "./link.js";

// a guest silent for this many ticks has gone (it says it is there every 30 ticks)
const GUEST_GONE_TICKS = 100;
// a guest that joined this many ticks ago is in the menus (it joins every 30 ticks there),
// not in a race of its own still
const GUEST_WAITING_TICKS = 60;

// guests: the players in the room but the host, in the order they came, each with its id,
// name, the car, skin and team it chose, whether it is ready to race, what it does (PLAYER_STATUS),
// and the ticks since it was last heard and since it last joined; bots: the cars (carType, skin, team) the computer drives in
// the room's races, as the host added them; stage: the stage the host chose in the lobby,
// mode: how its race is won (RACE_MODE), rules: the rest the host chose (roomRules);
// status and racing: what the host did and whether it raced together, as it last told
const host = {
  guests: [],
  bots: [],
  stage: 1,
  mode: RACE_MODE.normal,
  rules: roomRules(),
  status: PLAYER_STATUS.lobby,
  racing: false,
};

export const roomGuests = () => host.guests;
export const roomBots = () => host.bots;
export const roomStage = () => host.stage;
export const roomMode = () => host.mode;
export const roomRulesChosen = () => host.rules;

// the guests a race the host starts takes along
const waitingGuests = () =>
  host.guests.filter(({ joinedTicks }) => joinedTicks < GUEST_WAITING_TICKS);

// (the host's own car first: the room's players as every game lists them)
export const sendPlayers = () => {
  host.status = statusOf(game.phase);
  host.racing = lockstep.active;
  link.send({
    type: MESSAGE.players,
    players: [
      {
        id: link.id,
        name: own.name,
        carType: game.carTypes[0],
        skin: own.skin,
        team: own.team,
        ready: true,
        status: host.status,
      },
      ...host.guests,
    ].map(({ id, name, carType, skin, team, ready, status }) => ({
      id,
      name,
      carType,
      skin,
      team,
      ready,
      status,
    })),
    bots: host.bots,
    stage: host.stage,
    mode: host.mode,
    rules: host.rules,
    // (a guest may watch the race going on, see watch.js)
    racing: host.racing,
  });
};

// the stages a room races: the game's and the original's, which every game has
export const isRoomStage = (stage) =>
  isIndex(stage, STAGE_COUNT + 1) && stage >= 1;

export const chooseRoomStage = (stage) => {
  if (isRoomStage(stage)) {
    host.stage = stage;
    sendPlayers();
  }
};

export const chooseRoomMode = (mode) => {
  if (isRaceMode(mode)) {
    host.mode = mode;
    sendPlayers();
  }
};

// One rule changed, e.g. { minutes: 5 }.
export const chooseRoomRule = (rule) => {
  const rules = { ...host.rules, ...rule };
  if (isRoomRules(rules)) {
    host.rules = rules;
    sendPlayers();
  }
};

// The host starts once the guests in the lobby are all ready.
export const everyoneReady = () => waitingGuests().every(({ ready }) => ready);

// a race's cars at most: the players' and the bots'
export const canAddBot = () =>
  1 + host.guests.length + host.bots.length < MAX_CARS;

// A bot joins the room, in the first car no one drives yet.
export const addBot = () => {
  if (!canAddBot()) {
    return;
  }
  const taken = [
    game.carTypes[0],
    ...host.guests.map(({ carType }) => carType),
    ...host.bots.map(({ carType }) => carType),
  ];
  const free = carStats.names.findIndex((_, type) => !taken.includes(type));
  host.bots = [
    ...host.bots,
    { carType: Math.max(free, 0), skin: 0, team: null },
  ];
  sendPlayers();
};

export const removeBot = (i) => {
  host.bots = host.bots.filter((_, j) => j != i);
  sendPlayers();
};

export const chooseBotCar = (i, carType) => {
  if (isIndex(carType, carStats.names.length)) {
    host.bots = host.bots.map((bot, j) => (j == i ? { ...bot, carType } : bot));
    sendPlayers();
  }
};

export const chooseBotSkin = (i, skin) => {
  if (isSkin(skin)) {
    host.bots = host.bots.map((bot, j) => (j == i ? { ...bot, skin } : bot));
    sendPlayers();
  }
};

export const chooseBotTeam = (i, team) => {
  if (isTeamChosen(team)) {
    host.bots = host.bots.map((bot, j) => (j == i ? { ...bot, team } : bot));
    sendPlayers();
  }
};

const receive = (message) => {
  receiveRaceMessage(message);
  receiveChat(message);
  receiveVoice(message);
  let guest = host.guests.find(({ id }) => id == message.from);
  if (
    message.type == MESSAGE.join &&
    isIndex(message.carType, carStats.names.length)
  ) {
    if (!guest && host.guests.length < MOST_PLAYERS - 1) {
      guest = { id: message.from };
      host.guests.push(guest);
    }
    if (guest) {
      guest.carType = message.carType;
      guest.name = cleanName(message.name);
      guest.skin = isSkin(message.skin) ? message.skin : 0;
      guest.team = isTeamChosen(message.team) ? message.team : null;
      guest.ready = message.ready === true;
      guest.status = PLAYER_STATUS.lobby;
      guest.joinedTicks = 0;
      // (the answer that tells the guest the host is there)
      sendPlayers();
    }
  }
  if (!guest) {
    return;
  }
  guest.quietTicks = 0;
  if (message.type == MESSAGE.bye) {
    host.guests = host.guests.filter((other) => other != guest);
  }
  if (
    message.type == MESSAGE.status &&
    isPlayerStatus(message.status) &&
    message.status != guest.status
  ) {
    guest.status = message.status;
    sendPlayers();
  }
  if (message.type == MESSAGE.watch) {
    answerWatch(guest.id);
  }
  if (message.type == MESSAGE.ping && Number.isFinite(message.ping)) {
    link.send({ type: MESSAGE.pong, to: guest.id, ping: message.ping });
  }
};

// Every tick: guests gone are forgotten, and the field is chosen with the cars of those
// there.
export const hostTick = () => {
  for (const guest of host.guests) {
    guest.quietTicks++;
    guest.joinedTicks++;
  }
  host.guests = host.guests.filter(
    ({ quietTicks }) => quietTicks < GUEST_GONE_TICKS,
  );
  // (the guests list what the host does, and may watch its race while it goes on)
  if (
    link.role == ROLE.host &&
    (host.status != statusOf(game.phase) || host.racing != lockstep.active)
  ) {
    sendPlayers();
  }
  // (without guests, the host races as alone, with the opponents of the stage, unless it
  // starts the room's race from the lobby with bots)
  const guests = link.role == ROLE.host ? waitingGuests() : [];
  const bots =
    guests.length > 0 || raceSetup.kind == RACE_KIND.together ? host.bots : [];
  field.roomCarTypes =
    guests.length + bots.length > 0
      ? [...guests, ...bots].map(({ carType }) => carType)
      : null;
};

// Opens a room for guests to join.
export const hostRoom = (room) => {
  host.guests = [];
  host.bots = [];
  host.stage = isRoomStage(track.stage) ? track.stage : 1;
  clearChat();
  openLink(ROLE.host, room, receive);
};

// The lobby's Start: the room's race on the stage chosen, the guests along (see
// startHostedRace), straight from its loading.
export const startRoomRace = () => {
  chooseRaceKind(RACE_KIND.together);
  raceSetup.mode = host.mode;
  raceSetup.rules = host.rules;
  track.stage = host.stage;
  game.mode = MODE.championship;
  stageLoad.after = AFTER_LOAD.room;
  stageLoad.progress = STAGE_LOAD.requested;
  game.phase = PHASE.stageLoading;
};

export const startHosting = () => {
  if (urlRoom.host) {
    hostRoom(urlRoom.host);
  }
};

// A race begins: the guests drive the cars after the host's, in the order they came, and
// get the race's whole state with its first frame. Its random numbers come from sources
// whose state goes along, and the help for new players, which only the host's car would
// get, is off.
export const startHostedRace = () => {
  const guests = waitingGuests();
  // (who drives which car, in which paint and for which team: the host, the guests, then
  // the bots)
  const names = [own.name, ...guests.map(({ name }) => name)];
  const cars = [own, ...guests, ...host.bots];
  setRoomCars(
    [...names, ...host.bots.map(() => null)],
    cars.map(({ skin }) => skin),
    teamsOf(
      cars.map(({ team }) => team),
      raceSetup.rules.teams,
    ),
  );
  // (the cars' textures were made as the stage loaded, before their paint was known)
  const paint = () => roomCars.skins.some(Boolean) && raceCarTextures();
  if (
    link.role != ROLE.host ||
    guests.length == 0 ||
    game.mode != MODE.championship ||
    game.carCount == 1
  ) {
    game.humans = [];
    if (raceSetup.kind == RACE_KIND.together) {
      paint();
    }
    return;
  }
  const others = [...guests, ...host.bots].map(({ carType }) => carType);
  if (
    game.carCount != 1 + others.length ||
    others.some((carType, i) => game.carTypes[i + 1] != carType)
  ) {
    // (a guest came, or one or a bot got another car, after the field was chosen)
    setUpField();
    raceCarTextures();
  }
  setUpRaceTogether();
  // (ready again for the next race)
  for (const guest of guests) {
    guest.ready = false;
  }
  // (the players by car: the host's is the player's car, 0)
  const players = [link.id, ...guests.map(({ id }) => id)];
  game.humans = players.map((_, car) => car);
  paint();
  random.sim = seededRandom(random.fx() * 2 ** 32);
  random.wreck = seededRandom(random.fx() * 2 ** 32);
  raceEvents.onautocorrect = 0;
  // (that tells this race's messages from those of a race before, see lockstep.js)
  const raceId = Math.floor(random.fx() * 2 ** 32);
  startLockstep(game.player, players, raceId, () => {
    const start = encode({
      stage: track.stage,
      mode: raceSetup.mode,
      rules: raceSetup.rules,
      carTypes: game.carTypes.slice(0, game.carCount),
      players,
      names: roomCars.names,
      skins: roomCars.skins,
      teams: roomCars.teams,
      raceId,
      state: saveRace(),
    });
    for (const part of inParts(start)) {
      link.send({ type: MESSAGE.start, raceId, ...part });
    }
  });
};
