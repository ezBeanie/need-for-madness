// The field of a race: the opponents for the stage and their places on the start grid.

import { LAST_STAGE, levelOf, originalOf } from "../data/stages.js";
import { random } from "../core/random.js";
import { MAX_CARS, RACE_SIZES, game } from "../core/state.js";
import { saveSetting } from "../core/storage.js";
import { CAR, carStats } from "../data/carStats.js";
import { raceCarTextures } from "../render/generated.js";
import { resetHud } from "../ui/hud.js";
import { inishcontrol } from "./ai.js";
import { inishmad } from "./physics.js";
import { car } from "./racers.js";
import { resetRaceTape } from "./raceTape.js";
import { resetRecording } from "./recording.js";
import { track } from "./track.js";

const CAR_TYPES = 19;
// the original's field; beyond it there are not enough car types to have no twins
const ORIGINAL_FIELD = 7;

// The start grid: one car in the middle, then two side by side, and so on backwards.
const gridX = Array.from({ length: MAX_CARS }, (_, i) => [0, -35, 35][i % 3]);
const gridZ = Array.from(
  { length: MAX_CARS },
  (_, i) => -76 + 38 * (Math.floor(i / 3) * 2 + (i % 3 == 0 ? 0 : 1)),
);

// a replay's cars (see screens/replays.js): the field it was raced in, not new opponents
export const field = { replayCars: null };

// Chooses the opponents and puts all cars on the start grid.
export function setUpField() {
  track.insih();
  if (field.replayCars) {
    game.carCount = field.replayCars.length;
    field.replayCars.forEach((type, c) => (game.carTypes[c] = type));
  } else {
    chooseOpponents(track.stage);
  }
  resetHud();
  placeOnGrid();
  inishcontrol();
  inishmad();
  resetRecording();
  resetRaceTape();
}

// The field size the cars were chosen for: it can change in the stage select after the
// stage loaded with its cars.
let fieldSize = 0;

export function applyFieldSize() {
  if (fieldSize != game.raceCars) {
    setUpField();
    raceCarTextures();
  }
}

export function nextRaceSize() {
  game.raceCars =
    RACE_SIZES[(RACE_SIZES.indexOf(game.raceCars) + 1) % RACE_SIZES.length];
  saveSetting("racecars", game.raceCars);
}

const placeOnGrid = () => {
  for (let i = 0; i < game.carCount; i++) {
    const body = car[i];
    const type = game.carTypes[i];
    body.typ = type;
    body.x = gridX[i] + 4 * random.sim() - 2;
    body.z = gridZ[i];
    body.grat = carStats.wly[type][1] + 1.5 * carStats.wlh[type][1];
    body.y = body.grat;
    body.xy = 0;
    body.xz = 0;
    body.zy = 0;
    body.wzy = 0;
    body.wxz = 0;
    // the wheels' places: front left, front right, rear left, rear right
    body.keyx[0] = -carStats.wlx[type][0];
    body.keyz[0] = carStats.wlz[type][0];
    body.keyx[1] = carStats.wlx[type][0];
    body.keyz[1] = carStats.wlz[type][0];
    body.keyx[2] = -carStats.wlx[type][1];
    body.keyz[2] = carStats.wlz[type][1];
    body.keyx[3] = carStats.wlx[type][1];
    body.keyz[3] = carStats.wlz[type][1];
    body.mat = mat4.create();
    body.ctxl[0] = random.fx();
    body.ctxl[1] = random.fx();
    body.fcnt = 0;
  }
};

// The car the stage unlocks (on odd stages: the next stage) races as the last car, unless
// the player drives it.
const stageBoss = (stage) => Math.floor(10 + (stage + 1) / 2);

const coinFlip = () => random.sim() > random.sim();

// While a stage is the next to win, some cars may not race on it (or only by chance).
const NEW_STAGE_RULES = {
  6: (type) => ![2, 4, 6, 9].includes(type),
  8: (type) => !([4, 6, 9].includes(type) && coinFlip()),
  9: (type) => !([4, 3, 0, 2].includes(type) && coinFlip()),
  10: (type) => !([2, 6, 9, 14].includes(type) && coinFlip()),
  11: (type) => ![0, 1, 2, 3, 4, 14].includes(type),
  12: (type) => type > 4,
  13: (type) => {
    let allowed = type > 4;
    if ((type == CAR.elKing || type == CAR.masheen) && coinFlip()) {
      allowed = false;
    }
    return allowed;
  },
  14: (type) => ![0, 2, 3, 4, 6, 9, 14, 16].includes(type),
  15: (type) => {
    let allowed = type >= 5;
    if (type < 11 && random.sim() > 0.1) {
      allowed = false;
    }
    return allowed;
  },
  16: (type) => type >= 11,
};

function chooseOpponents(stage) {
  game.carCount = game.raceCars;
  fieldSize = game.raceCars;
  for (let i = 1; i < game.carCount; i++) {
    game.carTypes[i] = -1;
  }
  let randomUpTo = game.carCount;
  const boss = stageBoss(stage);
  // (the original's stages unlock no car)
  if (!originalOf(stage) && game.carTypes[0] != boss && stage != LAST_STAGE) {
    game.carTypes[game.carCount - 1] = boss;
    randomUpTo = game.carCount - 1;
  }
  for (let i = 1; i < randomUpTo; i++) {
    pickOpponent(i, stage);
  }
  if (game.unlocked == stage) {
    if (stage == 6) {
      makeSureOfOnStage6(randomUpTo);
    }
    if (stage == 12) {
      makeSureOf(14);
    }
    if (stage == 16) {
      makeSureOf(16);
      lineUpStage16();
    }
  }
}

// Random types, weaker cars dropping out more often on later stages, no cars the player
// has not unlocked yet, and no twins (in the original's field, or until 50 tries failed).
const pickOpponent = (i, stage) => {
  const newStage = game.unlocked == stage;
  const level = levelOf(stage);
  let tries = 0;
  let ok = false;
  while (!ok) {
    tries++;
    let type = Math.floor(random.sim() * (28 + 10 * (level / 17)));
    if (type >= CAR_TYPES) {
      type -= CAR_TYPES;
    }
    game.carTypes[i] = type;
    ok = true;
    if (i < ORIGINAL_FIELD || tries < 50) {
      for (let j = 0; j < game.carCount; j++) {
        if (i != j && type == game.carTypes[j]) {
          ok = false;
        }
      }
    }
    if ((stage != 15 && stage != 16) || !newStage) {
      let dropOut = ((18 - type) / 18) * (level / 16);
      dropOut = Math.min(dropOut, stage == LAST_STAGE ? 0.5 : 0.8);
      if (dropOut > random.sim()) {
        ok = false;
      }
    }
    if ((type - 10) * 2 > game.unlocked) {
      ok = false;
    }
    const rule = newStage ? NEW_STAGE_RULES[stage] : undefined;
    if (rule && !rule(type)) {
      ok = false;
    }
  }
};

// Stage 6 needs car 11: it replaces the lowest type of the random opponents.
const makeSureOfOnStage6 = (randomUpTo) => {
  if (game.carTypes.slice(0, game.carCount).includes(11)) {
    return;
  }
  let lowest = 18;
  let slot = 1;
  for (let i = 1; i < randomUpTo; i++) {
    if (game.carTypes[i] < lowest) {
      lowest = game.carTypes[i];
      slot = i;
    }
  }
  game.carTypes[slot] = 11;
};

// The car races, in one of the slots 1 to 5.
const makeSureOf = (type) => {
  if (game.carTypes.slice(0, game.carCount).includes(type)) {
    return;
  }
  let slot = Math.floor(1 + 5 * random.sim());
  if (slot == 6) {
    slot = 5;
  }
  game.carTypes[slot] = type;
};

// On stage 16 cars 16 and 14 start in front (slots 1 and 2, in random order), car 15
// behind them (slot 4 or 5).
const lineUpStage16 = () => {
  const moveTo = (type, slot, from, to) => {
    for (let i = from; i < to; i++) {
      if (game.carTypes[i] == type) {
        game.carTypes[i] = game.carTypes[slot];
        game.carTypes[slot] = type;
      }
    }
  };
  const first = coinFlip() ? 2 : 1;
  moveTo(16, first, 3, 6);
  moveTo(14, first == 1 ? 2 : 1, 3, 6);
  moveTo(15, coinFlip() ? 5 : 4, 1, 4);
};
