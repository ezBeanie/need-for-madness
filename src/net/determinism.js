// Whether this browser races exactly as others do: racing together by sending each other
// only the keys (rollback netcode) needs every game to compute the same race from the same
// keys, to the last bit. Opened with ?determinism, the game races a fixed race (the AI in
// the other cars, the player's steered along the track), without waiting for the screen, and shows fingerprints of the cars' states
// to compare between browsers and devices.

import { stopStageMusic } from "../audio/audio.js";
import { atan } from "../core/exactMath.js";
import { random, seededRandom } from "../core/random.js";
import { COLLISIONS, PHASE, game } from "../core/state.js";
import { collisionChoice } from "../race/physics.js";
import { tick } from "../core/tick.js";
import { stunts } from "../input/controls.js";
import { AFTER_LOAD, STAGE_LOAD, stageLoad } from "../loading/stageLoad.js";
import { flashIntoRace } from "../race/countdown.js";
import { raceEvents } from "../race/events.js";
import { car, racers } from "../race/racers.js";
import { track } from "../race/track.js";
import { menu } from "../screens/menuState.js";

const SEED = 1;
const STAGE = 1;
const CAR_TYPE = 5;
const RACE_CARS = 7;
// fingerprints after these ticks of the race: where races part, if they do
export const FINGERPRINT_TICKS = [250, 500, 1000, 2000];

// FNV-1a over the bits of every number
const bytes = new DataView(new ArrayBuffer(8));
const mix = (hash, value) => {
  bytes.setFloat64(0, value === undefined ? -1 : Number(value));
  for (let i = 0; i < 8; i++) {
    hash = Math.imul(hash ^ bytes.getUint8(i), 16777619) >>> 0;
  }
  return hash;
};

const DEGREE = Math.PI / 180;

// Car c heads for the path point after next, as the tests' autopilot does.
const steerAlongTrack = (c) => {
  const target = (racers[c].point + 2) % track.n;
  const dx = track.x[target] - car[c].x;
  const dz = track.z[target] - car[c].z;
  let towards = 90 + (dx >= 0 ? 180 : 0) + atan(dz / dx) / DEGREE;
  let heading = car[c].xz;
  while (heading < 0) heading += 360;
  while (heading > 180) heading -= 360;
  while (towards < 0) towards += 360;
  while (towards > 180) towards -= 360;
  let off = heading - towards;
  if (Math.abs(off) >= 180) {
    off = -off;
  }
  Object.assign(racers[c].u, {
    up: true,
    down: false,
    left: off > 5,
    right: off < -5,
    handb: false,
  });
};

const CAR_FIELDS = ["x", "y", "z", "xz", "xy", "zy", "wxz", "wzy"];
const RACER_FIELDS = ["speed", "power", "damage", "clear", "point", "wasted"];

const mixRace = (hash) => {
  for (let c = 0; c < game.carCount; c++) {
    for (const field of CAR_FIELDS) {
      hash = mix(hash, car[c][field]);
    }
    for (const field of RACER_FIELDS) {
      hash = mix(hash, racers[c][field]);
    }
  }
  return hash;
};

// From the main menu: the stage of the fixed race loads, with its field drawn from the seed.
export const startFingerprintRace = () => {
  random.sim = seededRandom(SEED);
  game.carTypes[0] = CAR_TYPE;
  game.unlocked = 17;
  game.raceCars = RACE_CARS;
  track.stage = STAGE;
  stageLoad.after = AFTER_LOAD.stageSelect;
  stageLoad.progress = STAGE_LOAD.requested;
  menu.redraw = true;
  game.phase = PHASE.stageLoading;
};

// In the stage select it led to: the fixed race begins.
export const beginFingerprintRace = () => {
  // (again: the stage select may have drawn some, as many as it had ticks)
  random.sim = seededRandom(SEED);
  random.fx = seededRandom(SEED);
  random.wreck = seededRandom(SEED);
  // (where the original's ticks fall among this game's runs on from the game's start: it
  // is part of the race, see tick.js)
  tick.fraction = 0;
  game.mode = 0;
  flashIntoRace();
  // (nor the help of a game that has no car stored yet, off as racing together, see host.js)
  raceEvents.onautocorrect = 0;
  // (and stunts and crashes as the original's, whatever the player chose; not stored)
  stunts.byKey = false;
  collisionChoice.value = COLLISIONS.original;
};

// (the cars people drive steered, see isHuman)
export const fingerprintRaceTick = (runTick) => {
  for (const c of game.humans.length == 0 ? [game.player] : game.humans) {
    steerAlongTrack(c);
  }
  runTick();
};

// the fixed race from the stage select, run at once by runTick; returns the fingerprints
export const finishFingerprintRace = (runTick) => {
  beginFingerprintRace();
  const prints = [];
  let hash = 2166136261;
  for (let t = 1; t <= FINGERPRINT_TICKS.at(-1); t++) {
    fingerprintRaceTick(runTick);
    hash = mixRace(hash);
    if (FINGERPRINT_TICKS.includes(t)) {
      prints.push(hash.toString(16).padStart(8, "0"));
    }
  }
  return prints;
};

const until = (done) =>
  new Promise((resolve) => {
    const check = () => (done() ? resolve() : setTimeout(check, 100));
    check();
  });

const showStatus = (lines) => {
  let box = document.getElementById("determinism");
  if (!box) {
    box = document.createElement("div");
    box.id = "determinism";
    box.setAttribute("role", "status");
    box.style.cssText =
      "position: fixed; left: 16px; top: 16px; z-index: 10; padding: 12px 16px; " +
      "background: #000; color: #fff; font: 16px/1.5 monospace; white-space: pre";
    document.body.append(box);
  }
  box.textContent = lines.join("\n");
};

export const checkDeterminism = async (runTick) => {
  showStatus(["Determinism check: loading..."]);
  await until(() => game.phase == PHASE.mainMenu);
  const kept = {
    carType: game.carTypes[0],
    unlocked: game.unlocked,
    raceCars: game.raceCars,
    stage: track.stage,
    sim: random.sim,
    fx: random.fx,
    wreck: random.wreck,
  };
  startFingerprintRace();
  await until(() => game.phase == PHASE.stageSelect);
  showStatus(["Determinism check: racing..."]);
  // (a frame for the status to show)
  await new Promise((resolve) => setTimeout(resolve, 50));
  const started = performance.now();
  // (the field drawn from the seed: the first thing to differ, if the seeding does)
  const field = game.carTypes.slice(0, game.carCount).join(" ");
  const prints = finishFingerprintRace(runTick);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  // back to the main menu as it was
  stopStageMusic();
  game.carTypes[0] = kept.carType;
  game.unlocked = kept.unlocked;
  game.raceCars = kept.raceCars;
  track.stage = kept.stage;
  random.sim = kept.sim;
  random.fx = kept.fx;
  random.wreck = kept.wreck;
  menu.animation = 0;
  menu.continuesToCarSelect = false;
  game.phase = PHASE.mainMenu;
  showStatus([
    "Determinism check",
    `cars: ${field}`,
    ...FINGERPRINT_TICKS.map((t, i) => `tick ${t}: ${prints[i]}`),
    `(${seconds} s, ${navigator.userAgent.match(/(Chrome|Firefox|Safari|SamsungBrowser)\/[\d.]+/g)?.join(" ") ?? ""})`,
  ]);
};
