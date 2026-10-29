// The guest's side of a race with a host: the guest's game does not drive the race, it
// shows the ticks the host's game sends (as the replay viewer shows a race tape, see
// raceTape.js) and sends the keys of its car back (see host.js).

import {
  pauseMenuMusic,
  playStageMusic,
  stopStageMusic,
} from "../audio/audio.js";
import { stopReplaySounds } from "../audio/replaySounds.js";
import { MAX_CARS, PHASE, game } from "../core/state.js";
import { carStats } from "../data/carStats.js";
import { STAGE_COUNT } from "../data/stages.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { AFTER_LOAD, STAGE_LOAD, stageLoad } from "../loading/stageLoad.js";
import { COUNTDOWN, circleTheField, dropBehindCar } from "../race/countdown.js";
import { raceEvents } from "../race/events.js";
import { field } from "../race/field.js";
import { addTapeTick, raceTape } from "../race/raceTape.js";
import { car, racers } from "../race/racers.js";
import { followLive, viewer } from "../race/replayViewer.js";
import { track } from "../race/track.js";
import { menu } from "../screens/menuState.js";
import { praiseStunt } from "../ui/hud.js";
import {
  GUEST_HUD_FIELDS,
  MESSAGE,
  OUTCOME,
  ROLE,
  isIndex,
  link,
  openLink,
  urlRoom,
} from "./link.js";
import { ticksToShow } from "./tickStore.js";

// how often a guest not in a race tells the host it is there
const JOIN_EVERY_TICKS = 30;
// the screens a race of the host's takes the guest away from
const WAITING_PHASES = [PHASE.mainMenu, PHASE.carSelect, PHASE.stageSelect];
// a host silent this long in a race has paused it, or gone
const HOST_QUIET_TICKS = 15;
// a host not answering this long to joins is not in the room
const HOST_GONE_TICKS = 100;
// how often the guest measures the time to the host and back
const PING_EVERY_TICKS = 30;

export const NOTICE = {
  waiting: "Waiting for the host...",
  hostLeft: "The host left the race",
};

export const guest = {
  // the race the host started, until its stage loads
  start: null,
  // ticks of the host's race not shown yet, and whether they are shown (see tickStore.js)
  ticks: [],
  playing: false,
  // the time to the host and back, in ms (null until measured)
  ping: null,
  pingTicks: 0,
  // what the guest's HUD shows, as the host sent it last
  hud: null,
  // the car the guest drives in the host's race
  car: 0,
  // the guest's own car type and car, given back after the race
  ownCarType: 0,
  ownPlayer: 0,
  joinTicks: 0,
  // ticks since the host last answered
  hostAnsweredTicks: HOST_GONE_TICKS,
  // ticks since the host's last message, and whether the host left the race
  quietTicks: 0,
  ended: false,
  // what the guest's HUD tells about the host, if anything
  notice: null,
};

const isStart = ({ stage, carTypes, car }) =>
  isIndex(stage, STAGE_COUNT + 1) &&
  Array.isArray(carTypes) &&
  carTypes.length <= MAX_CARS &&
  carTypes.every((type) => isIndex(type, carStats.names.length)) &&
  isIndex(car, carTypes.length);

const receive = (message) => {
  guest.quietTicks = 0;
  guest.hostAnsweredTicks = 0;
  if (message.type == MESSAGE.end) {
    guest.ended = true;
  }
  if (message.type == MESSAGE.start && isStart(message)) {
    guest.start = message;
    guest.ticks = [];
  }
  if (
    message.type == MESSAGE.tick &&
    Array.isArray(message.tape) &&
    message.hud &&
    Array.isArray(message.hud.positions)
  ) {
    guest.ticks.push(message);
    if (Number.isFinite(message.pong)) {
      guest.ping = Math.round(performance.now() - message.pong);
    }
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
  guest.ownCarType = game.carTypes[0];
  guest.ownPlayer = game.player;
  guest.hud = null;
  guest.ended = false;
  guest.playing = false;
  guest.ping = null;
  track.stage = start.stage;
  field.replayCars = start.carTypes;
  guest.car = start.car;
  pauseMenuMusic();
  stageLoad.after = AFTER_LOAD.guest;
  stageLoad.progress = STAGE_LOAD.requested;
  game.phase = PHASE.stageLoading;
};

// Every tick, outside the race: tells the host the guest is there, and goes to the race
// the host starts.
export const guestWaitingTick = () => {
  if (link.role != ROLE.guest || !WAITING_PHASES.includes(game.phase)) {
    return;
  }
  guest.hostAnsweredTicks++;
  if (guest.joinTicks++ % JOIN_EVERY_TICKS == 0) {
    link.send({ type: MESSAGE.join, carType: game.carTypes[0] });
  }
  if (guest.start) {
    loadHostedRace(guest.start);
    guest.start = null;
  }
};

// Its stage loaded: the host's race shows.
export const showHostedRace = () => {
  field.replayCars = null;
  // (loading the stage made car 0 the player's again)
  game.player = guest.car;
  viewer.race = null;
  viewer.frame = 0;
  playStageMusic(track.stage);
  if (raceEvents.countdown > COUNTDOWN.behindTheCar) {
    circleTheField();
  } else {
    dropBehindCar(game.player);
  }
  game.phase = PHASE.guestRace;
};

const showHud = (hud) => {
  const player = racers[game.player];
  hud.positions.forEach((position, c) => (track.pos[c] = position));
  track.wasted = hud.wasted;
  for (const field of GUEST_HUD_FIELDS) {
    player[field] = hud[field];
  }
  car[game.player].fcnt = hud.fcnt;
  if (Array.isArray(hud.dested) && Array.isArray(hud.lastHitBy)) {
    hud.dested.forEach((dested, c) => (track.dested[c] = dested));
    hud.lastHitBy.forEach((by, c) => (racers[c].lastHitBy = by));
  }
};

const leaveHostedRace = () => {
  stopStageMusic();
  stopReplaySounds();
  game.carTypes[0] = guest.ownCarType;
  game.player = guest.ownPlayer;
  menu.animation = 0;
  menu.continuesToCarSelect = false;
  game.phase = PHASE.mainMenu;
};

// A tick of the guest's race: what the host sent shows, the keys go to the host.
export const guestRaceTick = () => {
  const countdown = raceEvents.countdown;
  for (const message of ticksToShow(guest)) {
    raceEvents.countdown = message.countdown;
    message.tape.forEach(addTapeTick);
    guest.hud = message.hud;
    // (each of the host's ticks, so a stunt is praised as it was landed, even in a tick
    // that shows two of them)
    showHud(message.hud);
    if (message.hud.stunted === true) {
      praiseStunt();
    }
  }
  if (
    countdown > COUNTDOWN.behindTheCar &&
    raceEvents.countdown <= COUNTDOWN.behindTheCar
  ) {
    dropBehindCar(game.player);
  }
  guest.quietTicks++;
  const raceOver = guest.hud != null && guest.hud.outcome != OUTCOME.none;
  guest.notice =
    guest.ended && !raceOver
      ? NOTICE.hostLeft
      : !guest.ended && guest.quietTicks > HOST_QUIET_TICKS
        ? NOTICE.waiting
        : null;
  if (raceTape.length > 0) {
    followLive();
  }
  const { up, down, left, right, handb } = racers[game.player].u;
  link.send({
    type: MESSAGE.keys,
    keys: { up, down, left, right, handb },
    // (the host sends it back with its next tick)
    ping:
      guest.pingTicks++ % PING_EVERY_TICKS == 0 ? performance.now() : undefined,
  });
  if ((raceOver || guest.ended) && confirm.state == CONFIRM.pressed) {
    confirm.state = CONFIRM.used;
    leaveHostedRace();
  }
};
