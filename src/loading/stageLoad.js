// Loading a stage: its loading screen, the stage file, and where the game goes afterwards.

export const STAGE_LOAD = {
  requested: -1,
  // the loading screen is up, the stage file not requested yet
  screenShown: 0,
  loading: 1,
  loaded: 2,
};

export const AFTER_LOAD = {
  stageSelect: 0,
  // another stage picked in the stage select: its picture stays behind the loading
  nextStage: 1,
  // the very first race starts right away
  race: 2,
};

export const stageLoad = {
  progress: STAGE_LOAD.screenShown,
  after: AFTER_LOAD.stageSelect,
};
