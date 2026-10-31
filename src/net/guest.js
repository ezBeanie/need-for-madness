// The guest's side of a race with a host: the host's race starts in the guest's game from
// the whole state the host sends, then both games compute it, each sending only its keys
// (see lockstep.js and host.js). The guest drives its car in it as the player.

import { pauseMenuMusic, playStageMusic } from "../audio/audio.js";
import { random, seededRandom } from "../core/random.js";
import { MAX_CARS, PHASE, game } from "../core/state.js";
import { carStats } from "../data/carStats.js";
import { STAGE_COUNT } from "../data/stages.js";
import { AFTER_LOAD, STAGE_LOAD, stageLoad } from "../loading/stageLoad.js";
import { circleTheField } from "../race/countdown.js";
import { field } from "../race/field.js";
import { track } from "../race/track.js";
import { menu } from "../screens/menuState.js";
import {
  MESSAGE,
  RACE_GOES_ON,
  ROLE,
  isIndex,
  link,
  openLink,
  urlRoom,
} from "./link.js";
import {
  lockstep,
  receiveKeys,
  receiveApart,
  receivePrint,
  startLockstep,
  stopLockstep,
} from "./lockstep.js";
import { isRaceState, restoreRace } from "./raceState.js";

// how often a guest not in a race tells the host it is there, and one in a race (its keys
// stop while it pauses)
const JOIN_EVERY_TICKS = 30;
const PING_EVERY_TICKS = 30;
// the screens a race of the host's takes the guest away from
const WAITING_PHASES = [PHASE.mainMenu, PHASE.carSelect, PHASE.stageSelect];
// a host not answering this long to joins is not in the room
const HOST_GONE_TICKS = 100;
// how long the guest is told the host left
const HOST_LEFT_SHOWN_TICKS = 100;

export const NOTICE = { hostLeft: "The host left the race" };

export const guest = {
  // the race the host started, until its stage loads
  start: null,
  // the time to the host and back, in ms (null until measured)
  ping: null,
  pingTicks: 0,
  // the car the guest drives in the host's race
  car: 0,
  racing: false,
  // the guest's own car type, car and stage, given back after the race
  ownCarType: 0,
  ownPlayer: 0,
  ownStage: 0,
  ownBack: true,
  joinTicks: 0,
  // ticks since the host last answered
  hostAnsweredTicks: HOST_GONE_TICKS,
  // ticks the guest has been told the host left
  hostLeftTicks: 0,
};

const isStart = ({ stage, carTypes, car, state }) =>
  isIndex(stage, STAGE_COUNT + 1) &&
  Array.isArray(carTypes) &&
  carTypes.length <= MAX_CARS &&
  carTypes.every((type) => isIndex(type, carStats.names.length)) &&
  isIndex(car, carTypes.length) &&
  isRaceState(state, carTypes.length);

// The host's car is the AI's from now on, and the race goes on.
const raceOnWithoutHost = () => {
  guest.racing = false;
  game.humans = [];
  stopLockstep();
};

const receive = (message) => {
  guest.hostAnsweredTicks = 0;
  if (message.type == MESSAGE.end && guest.racing) {
    raceOnWithoutHost();
    guest.hostLeftTicks = HOST_LEFT_SHOWN_TICKS;
  }
  if (message.type == MESSAGE.start && isStart(message)) {
    guest.start = message;
    // (the host's keys come on while the stage loads)
    const { state } = message;
    startLockstep(message.car, [0, message.car], () => {
      random.sim = seededRandom(0);
      random.wreck = seededRandom(0);
      restoreRace(state);
    });
  }
  if (message.type == MESSAGE.keys && lockstep.active) {
    receiveKeys(message);
  }
  if (message.type == MESSAGE.sync && lockstep.active) {
    receivePrint(message);
  }
  if (message.type == MESSAGE.apart && lockstep.active) {
    receiveApart(message);
  }
  if (message.type == MESSAGE.pong && Number.isFinite(message.ping)) {
    guest.ping = Math.round(performance.now() - message.ping);
  }
};

export const hostThere = () => guest.hostAnsweredTicks < HOST_GONE_TICKS;

// Joins the room of a host.
export const joinRoom = (room) => {
  guest.hostAnsweredTicks = HOST_GONE_TICKS;
  guest.joinTicks = 0;
  guest.start = null;
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
  guest.hostLeftTicks = 0;
  track.stage = start.stage;
  field.replayCars = start.carTypes;
  guest.car = start.car;
  pauseMenuMusic();
  stageLoad.after = AFTER_LOAD.guest;
  stageLoad.progress = STAGE_LOAD.requested;
  game.phase = PHASE.stageLoading;
};

// Every tick, outside the race: tells the host the guest is there, goes to the race the
// host starts, and is back to its own car after one.
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
  guest.start = null;
  field.replayCars = null;
  // (loading the stage made car 0 the player's again)
  game.player = guest.car;
  game.humans = [0, guest.car];
  guest.racing = true;
  playStageMusic(track.stage);
  circleTheField();
  menu.redraw = false;
  game.phase = PHASE.race;
};

// Every tick of a race with the host: the guest says it is there (and measures the time to
// the host and back), and leaving the race tells the host.
export const guestTick = () => {
  if (guest.hostLeftTicks > 0) {
    guest.hostLeftTicks--;
  }
  if (link.role != ROLE.guest || !guest.racing) {
    return;
  }
  if (guest.pingTicks++ % PING_EVERY_TICKS == 0) {
    link.send({ type: MESSAGE.ping, ping: performance.now() });
  }
  if (!RACE_GOES_ON.includes(game.phase)) {
    link.send({ type: MESSAGE.left });
    raceOnWithoutHost();
  }
};

export const guestNotice = () =>
  guest.hostLeftTicks > 0 ? NOTICE.hostLeft : null;
