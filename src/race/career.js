// What the main menu started: the campaign, the original's career, where this game's own
// stages and the cars open one by one as stages are won, or one of the other kinds of race,
// where every stage and car is open (see raceSetup in core/state.js).
import {
  RACE_KIND,
  RACE_MODE,
  RACE_SIZES,
  STRENGTH,
  game,
  raceSetup,
} from "../core/state.js";
import { loadSetting, saveSetting } from "../core/storage.js";
import { LAST_STAGE, levelOf } from "../data/stages.js";
import { track } from "./track.js";

// progress: the stages opened in the campaign
export const career = { progress: 1 };

// the field size of the campaign, the original's
const CAMPAIGN_CARS = 7;

// the stage whose general driving (aiming, holding back, cutting corners) the opponents
// have, by strength
const AI_STAGE = {
  [STRENGTH.easy]: () => 1,
  [STRENGTH.normal]: (stage) => levelOf(stage),
  [STRENGTH.hard]: () => LAST_STAGE,
};

export const loadCareer = () => {
  career.progress = Math.max(loadSetting("unlocked"), 1);
  const strength = loadSetting("strength");
  raceSetup.strength = AI_STAGE[strength] ? strength : STRENGTH.normal;
  chooseRaceKind(RACE_KIND.campaign);
};

// The main menu's choice: the stages and cars the menus after it offer, and the field size.
export const chooseRaceKind = (kind) => {
  raceSetup.kind = kind;
  raceSetup.mode = RACE_MODE.normal;
  if (kind == RACE_KIND.campaign) {
    game.unlocked = career.progress;
    game.raceCars = CAMPAIGN_CARS;
  } else {
    game.unlocked = LAST_STAGE;
    const raceCars = loadSetting("racecars");
    game.raceCars = RACE_SIZES.includes(raceCars) ? raceCars : CAMPAIGN_CARS;
  }
};

export const nextStrength = () => {
  raceSetup.strength = (raceSetup.strength + 1) % Object.keys(STRENGTH).length;
  saveSetting("strength", raceSetup.strength);
};

// Each race, as its stage loads: in the campaign the newest stage opened is the one to win
// and the opponents drive as on the stage, in the other kinds they are as strong as chosen.
// (Racing together, see net/host.js, every game sets it up alike.)
export const setUpRace = () => {
  const campaign = raceSetup.kind == RACE_KIND.campaign;
  raceSetup.newestStage = campaign ? game.unlocked : 0;
  raceSetup.openedStages = campaign ? game.unlocked : LAST_STAGE;
  raceSetup.aiStage =
    campaign || raceSetup.kind == RACE_KIND.together
      ? track.stage
      : AI_STAGE[raceSetup.strength](track.stage);
};

// A race of a room's players, whichever kind the host started it from: as every game of
// it sets it up (see net/guest.js).
export const setUpRaceTogether = () => {
  raceSetup.newestStage = 0;
  raceSetup.openedStages = LAST_STAGE;
  raceSetup.aiStage = track.stage;
};
