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
import { MAX_CARS, MODE, PHASE, game } from "../core/state.js";
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
  // the room's players as the host last told, each with its id and car, the host's first
  players: [],
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
};

const isPlayers = (players) =>
  Array.isArray(players) &&
  players.length <= MOST_PLAYERS &&
  players.every(
    (player) =>
      isPlayerId(player?.id) && isIndex(player.carType, carStats.names.length),
  );

const isStart = ({ stage, carTypes, players, raceId, state }) =>
  isIndex(stage, STAGE_COUNT + 1) &&
  Array.isArray(carTypes) &&
  carTypes.length <= MAX_CARS &&
  carTypes.every((type) => isIndex(type, carStats.names.length)) &&
  Array.isArray(players) &&
  players.length <= carTypes.length &&
  Number.isInteger(raceId) &&
  players.every(isPlayerId) &&
  isRaceState(state, carTypes.length);

const receive = (message) => {
  receiveRaceMessage(message);
  if (message.type == MESSAGE.players && isPlayers(message.players)) {
    guest.hostId = message.from;
    guest.players = message.players;
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
      random.sim = seededRandom(0);
      random.wreck = seededRandom(0);
      restoreRace(state);
    });
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

// Joins the room of a host.
export const joinRoom = (room) => {
  Object.assign(guest, {
    start: null,
    players: [],
    hostId: null,
    joinTicks: 0,
    hostAnsweredTicks: HOST_GONE_TICKS,
    hostLeft: false,
    roomEnded: false,
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
  track.stage = start.stage;
  field.replayCars = start.carTypes;
  // (as the host's: it starts no other)
  game.mode = MODE.championship;
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
    link.send({ type: MESSAGE.join, carType: game.carTypes[0] });
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
  // (loading the stage made car 0 the player's again)
  game.player = guest.car;
  game.humans = players.map((_, car) => car);
  // (the stage select loads it, which a guest does not go through)
  if (!isEngineLoaded(game.carTypes[game.player])) {
    loadEngine(game.carTypes[game.player]);
  }
  playStageMusic(track.stage);
  circleTheField();
  menu.redraw = false;
  game.phase = PHASE.race;
};
