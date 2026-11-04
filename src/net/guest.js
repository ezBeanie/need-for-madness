// A guest's side of racing together: the host's race starts in the guest's game from the
// whole state the host sends, then every game computes it, each sending only its keys (see
// lockstep.js and host.js). The guest drives its car in it as the player.

import {
  isEngineLoaded,
  loadEngine,
  pauseMenuMusic,
  playStageMusic,
} from "../audio/audio.js";
import { random, seededRandom } from "../core/random.js";
import {
  MAX_CARS,
  MODE,
  PHASE,
  RACE_KIND,
  game,
  isRaceMode,
  raceSetup,
} from "../core/state.js";
import { carStats } from "../data/carStats.js";
import { STAGE_COUNT } from "../data/stages.js";
import { AFTER_LOAD, STAGE_LOAD, stageLoad } from "../loading/stageLoad.js";
import { circleTheField } from "../race/countdown.js";
import { field } from "../race/field.js";
import { track } from "../race/track.js";
import { menu } from "../screens/menuState.js";
import {
  MESSAGE,
  MOST_PLAYERS,
  isPlayerId,
  ROLE,
  closeLink,
  isIndex,
  link,
  openLink,
  urlRoom,
} from "./link.js";
import { lockstep, receiveRaceMessage, startLockstep } from "./lockstep.js";
import { isRaceState, restoreRace } from "./raceState.js";
import { clearChat, receiveChat } from "./chat.js";
import { receiveVoice } from "./voice.js";
import { MOST_NAME_CHARACTERS, own, setRoomCars } from "./roomCars.js";
import { isSkin } from "../render/skins.js";
import { camera } from "../render/camera.js";
import { spectate } from "../race/spectate.js";
import { askToWatch, overhear, receiveWatched } from "./watch.js";

// how often a guest not in a race tells the host it is there (and which car it chose)
const JOIN_EVERY_TICKS = 30;
// the screens a race of the host's takes the guest away from
const WAITING_PHASES = [PHASE.mainMenu, PHASE.carSelect, PHASE.stageSelect];
// a host not answering this long to joins is not in the room
const HOST_GONE_TICKS = 100;

export const guest = {
  // the race the host started, until its stage loads
  start: null,
  // the time to the host and back, in ms (null until measured)
  ping: null,
  // the room's players as the host last told, each with its id, name, car, skin and
  // whether it is ready, the host's first, its bots' cars and skins and the stage it chose
  players: [],
  bots: [],
  stage: null,
  mode: 0,
  // whether this guest's player is ready to race
  ready: false,
  hostId: null,
  // the car the guest drives in the host's race
  car: 0,
  // the guest's own car type, car and stage, given back after the race
  ownCarType: 0,
  ownPlayer: 0,
  ownStage: 0,
  ownBack: true,
  joinTicks: 0,
  // ticks since the host last answered
  hostAnsweredTicks: HOST_GONE_TICKS,
  // whether the host left the room, which ends with it
  hostLeft: false,
  // whether the room ended so, until the multiplayer dialog says so
  roomEnded: false,
  // whether the host races now (a guest may watch), and whether this guest asked to
  racing: false,
  watchAsked: false,
};

const isPlayers = (players) =>
  Array.isArray(players) &&
  players.length <= MOST_PLAYERS &&
  players.every(
    (player) =>
      isPlayerId(player?.id) &&
      isName(player.name) &&
      isIndex(player.carType, carStats.names.length) &&
      isSkin(player.skin) &&
      typeof player.ready == "boolean",
  );

// (shown only as text, see ui/multiplayerMenu.js)
const isName = (name) =>
  typeof name == "string" && name.length <= MOST_NAME_CHARACTERS;

const isBots = (bots) =>
  Array.isArray(bots) &&
  bots.length < MAX_CARS &&
  bots.every(
    (bot) => isIndex(bot?.carType, carStats.names.length) && isSkin(bot.skin),
  );

const isStart = ({
  stage,
  mode,
  carTypes,
  players,
  names,
  skins,
  raceId,
  state,
}) =>
  isIndex(stage, STAGE_COUNT + 1) &&
  isRaceMode(mode) &&
  Array.isArray(carTypes) &&
  carTypes.length <= MAX_CARS &&
  carTypes.every((type) => isIndex(type, carStats.names.length)) &&
  Array.isArray(players) &&
  players.length <= carTypes.length &&
  Number.isInteger(raceId) &&
  players.every(isPlayerId) &&
  Array.isArray(names) &&
  names.length == carTypes.length &&
  names.every((name) => name === null || isName(name)) &&
  Array.isArray(skins) &&
  skins.length == carTypes.length &&
  skins.every(isSkin) &&
  isRaceState(state, carTypes.length);

const receive = (message) => {
  receiveRaceMessage(message);
  overhear(message);
  receiveChat(message);
  receiveVoice(message);
  if (
    message.type == MESSAGE.players &&
    isPlayers(message.players) &&
    isBots(message.bots) &&
    isIndex(message.stage, STAGE_COUNT + 1) &&
    isRaceMode(message.mode)
  ) {
    guest.hostId = message.from;
    guest.players = message.players;
    guest.bots = message.bots;
    guest.stage = message.stage;
    guest.mode = message.mode;
    guest.racing = message.racing === true;
  }
  if (message.from != guest.hostId) {
    return;
  }
  guest.hostAnsweredTicks = 0;
  if (message.type == MESSAGE.bye) {
    guest.hostLeft = true;
  }
  if (
    message.type == MESSAGE.start &&
    !lockstep.active &&
    isStart(message) &&
    message.players.includes(link.id)
  ) {
    guest.start = message;
    guest.car = message.players.indexOf(link.id);
    // (the others' keys come on while the stage loads)
    const { state } = message;
    startLockstep(guest.car, message.players, message.raceId, () => {
      raceSetup.mode = message.mode;
      random.sim = seededRandom(0);
      random.wreck = seededRandom(0);
      restoreRace(state);
    });
  }
  if (message.type == MESSAGE.watched && guest.watchAsked && !lockstep.active) {
    const race = receiveWatched(message, isStart);
    if (race) {
      guest.watchAsked = false;
      guest.start = race;
      guest.car = -1;
    }
  }
  if (
    message.type == MESSAGE.pong &&
    message.to == link.id &&
    Number.isFinite(message.ping)
  ) {
    guest.ping = Math.round(performance.now() - message.ping);
  }
};

export const hostThere = () => guest.hostAnsweredTicks < HOST_GONE_TICKS;

const sendJoin = () =>
  link.send({
    type: MESSAGE.join,
    name: own.name,
    carType: game.carTypes[0],
    skin: own.skin,
    ready: guest.ready,
  });

// The lobby's car or readiness changed: the host hears of it at once.
export const tellHost = () => {
  if (link.role == ROLE.guest) {
    sendJoin();
  }
};

// The lobby's Watch Race: the race going on, from the host (see watch.js).
export const watchRoomRace = () => {
  if (link.role == ROLE.guest && guest.racing && !lockstep.active) {
    guest.watchAsked = true;
    askToWatch();
  }
};

export const setReady = (ready) => {
  guest.ready = ready;
  tellHost();
};

// Joins the room of a host.
export const joinRoom = (room) => {
  clearChat();
  Object.assign(guest, {
    start: null,
    players: [],
    bots: [],
    stage: null,
    ready: false,
    hostId: null,
    joinTicks: 0,
    hostAnsweredTicks: HOST_GONE_TICKS,
    hostLeft: false,
    roomEnded: false,
    racing: false,
    watchAsked: false,
  });
  openLink(ROLE.guest, room, receive);
};

export const startGuesting = () => {
  if (urlRoom.join) {
    joinRoom(urlRoom.join);
  }
};

const loadHostedRace = (start) => {
  if (guest.ownBack) {
    guest.ownCarType = game.carTypes[0];
    guest.ownPlayer = game.player;
    guest.ownStage = track.stage;
    guest.ownBack = false;
  }
  guest.ping = null;
  // (ready again for the next race)
  guest.ready = false;
  track.stage = start.stage;
  field.replayCars = start.carTypes;
  setRoomCars(start.names, start.skins);
  // (as the host's: it starts no other)
  game.mode = MODE.championship;
  raceSetup.kind = RACE_KIND.together;
  raceSetup.mode = start.mode;
  pauseMenuMusic();
  stageLoad.after = AFTER_LOAD.guest;
  stageLoad.progress = STAGE_LOAD.requested;
  game.phase = PHASE.stageLoading;
};

// Every tick, outside the race: tells the host the guest is there, goes to the race the
// host starts, and is back to its own car after one. A host that left, or was there and
// is gone, ends the room.
export const guestWaitingTick = () => {
  if (link.role != ROLE.guest || !WAITING_PHASES.includes(game.phase)) {
    return;
  }
  if (!guest.ownBack) {
    game.carTypes[0] = guest.ownCarType;
    game.player = guest.ownPlayer;
    track.stage = guest.ownStage;
    guest.ownBack = true;
  }
  guest.hostAnsweredTicks++;
  if (guest.hostLeft || (guest.hostId != null && !hostThere())) {
    closeLink();
    guest.roomEnded = true;
    return;
  }
  if (guest.joinTicks++ % JOIN_EVERY_TICKS == 0) {
    sendJoin();
  }
  // (a race left while its stage loaded, see game.js, is not loaded again)
  if (guest.start && !lockstep.active) {
    guest.start = null;
  }
  if (guest.start) {
    loadHostedRace(guest.start);
  }
};

// Its stage loaded: the host's race begins, its first frame as the host's was (see
// startHostedRace). The countdown is the host's too.
export const showHostedRace = () => {
  const { players } = guest.start;
  guest.start = null;
  field.replayCars = null;
  game.humans = players.map((_, car) => car);
  // watching, the player's car is one the race has not: its keys drive none of it, and
  // the camera follows the cars racing (see race/spectate.js)
  if (lockstep.watching) {
    game.player = game.carCount;
    camera.target = 0;
    spectate.watching = true;
    playStageMusic(track.stage);
    menu.redraw = false;
    game.phase = PHASE.race;
    return;
  }
  // (loading the stage made car 0 the player's again)
  game.player = guest.car;
  // (the stage select loads it, which a guest does not go through)
  if (!isEngineLoaded(game.carTypes[game.player])) {
    loadEngine(game.carTypes[game.player]);
  }
  playStageMusic(track.stage);
  circleTheField();
  menu.redraw = false;
  game.phase = PHASE.race;
};
