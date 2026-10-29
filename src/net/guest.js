// The guest's side of a race with a host: the guest's game does not drive the race, it
// shows the ticks the host's game sends (as the replay viewer shows a race tape, see
// raceTape.js) and sends the keys of its car back (see host.js).

import {
  pauseMenuMusic,
  playStageMusic,
  stopStageMusic,
} from "../audio/audio.js";
import { stopReplaySounds } from "../audio/replaySounds.js";
import { PHASE, game } from "../core/state.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { AFTER_LOAD, STAGE_LOAD, stageLoad } from "../loading/stageLoad.js";
import { raceEvents } from "../race/events.js";
import { field } from "../race/field.js";
import { addTapeTick, raceTape } from "../race/raceTape.js";
import { racers } from "../race/racers.js";
import { followLive, viewer } from "../race/replayViewer.js";
import { track } from "../race/track.js";
import { CAMERA, camera } from "../render/camera.js";
import { menu } from "../screens/menuState.js";
import { MESSAGE, OUTCOME, ROLE, link, openLink } from "./link.js";

// how often a guest not in a race tells the host it is there
const JOIN_EVERY_TICKS = 30;
// the screens a race of the host's takes the guest away from
const WAITING_PHASES = [PHASE.mainMenu, PHASE.carSelect, PHASE.stageSelect];

export const guest = {
  // the race the host started, until its stage loads
  start: null,
  // ticks of the host's race not shown yet
  ticks: [],
  // what the guest's HUD shows, as the host sent it last
  hud: null,
  // the car the guest drives in the host's race
  car: 0,
  // the guest's own car type and car, given back after the race
  ownCarType: 0,
  ownPlayer: 0,
  joinTicks: 0,
};

const receive = (message) => {
  if (message.type == MESSAGE.start) {
    guest.start = message;
    guest.ticks = [];
  }
  if (message.type == MESSAGE.tick) {
    guest.ticks.push(message);
  }
};

export const startGuesting = () => {
  if (link.role == ROLE.guest) {
    openLink(receive);
  }
};

const loadHostedRace = (start) => {
  guest.ownCarType = game.carTypes[0];
  guest.ownPlayer = game.player;
  guest.hud = null;
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
  if (guest.joinTicks++ % JOIN_EVERY_TICKS == 0) {
    link.send({ type: MESSAGE.join });
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
  camera.mode = CAMERA.behind;
  camera.target = game.player;
  game.phase = PHASE.guestRace;
};

const showHud = (hud) => {
  const player = racers[game.player];
  hud.positions.forEach((position, c) => (track.pos[c] = position));
  track.wasted = hud.wasted;
  for (const field of [
    "nlaps",
    "damage",
    "power",
    "point",
    "missedCheckpoint",
  ]) {
    player[field] = hud[field];
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
  for (const message of guest.ticks) {
    raceEvents.countdown = message.countdown;
    message.tape.forEach(addTapeTick);
    guest.hud = message.hud;
  }
  guest.ticks = [];
  if (guest.hud) {
    showHud(guest.hud);
  }
  if (raceTape.length > 0) {
    followLive();
  }
  const { up, down, left, right, handb } = racers[game.player].u;
  link.send({ type: MESSAGE.keys, keys: { up, down, left, right, handb } });
  if (
    guest.hud &&
    guest.hud.outcome != OUTCOME.none &&
    confirm.state == CONFIRM.pressed
  ) {
    confirm.state = CONFIRM.used;
    leaveHostedRace();
  }
};
