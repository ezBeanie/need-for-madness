// The original's career: this game's own stages and the cars open one by one as stages are
// won. Off unless switched on in the options: every stage and car is then open, as though
// all stages were won, and the career's progress is kept for when it is switched on again.
import { game, raceSetup } from "../core/state.js";
import { loadSetting, saveSetting } from "../core/storage.js";
import { LAST_STAGE } from "../data/stages.js";

// progress: the stages opened in the career, whether it is on or not
export const career = { on: false, progress: 1 };

const openStages = () => {
  career.progress = Math.max(loadSetting("unlocked"), 1);
  game.unlocked = career.on ? career.progress : LAST_STAGE;
};

export const loadCareer = () => {
  career.on = loadSetting("career") == 1;
  openStages();
};

// A race of the career: the newest stage opened is the one to win.
export const setUpCareerRace = () => {
  raceSetup.newestStage = game.unlocked;
  raceSetup.openedStages = game.unlocked;
};

export const toggleCareer = () => {
  career.on = !career.on;
  saveSetting("career", career.on ? 1 : 0);
  openStages();
};
