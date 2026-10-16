// The screens and modes the game switches between (game.phase). The numbers are the
// original ones; 6, 14 and 17 are gone.
export const PHASE = {
  loading: 0,
  mainMenu: 1,
  carSelect: 2,
  stageLoading: 3,
  stageSelect: 4,
  instructions: 5,
  race: 7,
  replay: 8,
  // one tick while a replay winds back to its start
  replayRewind: 9,
  // the highlight replay shown after a race
  highlights: 10,
  paused: 11,
  raceEnd: 12,
  resetQuestion: 13,
  startFlash: 15,
  // the screen between stages in switch mode
  switchScreen: 16,
  // the player winding back time during a race
  timeRewind: 18,
};

// the phases that show the race (live, replayed or rewinding)
export const RACE_PHASES = [
  PHASE.race,
  PHASE.replay,
  PHASE.replayRewind,
  PHASE.highlights,
  PHASE.switchScreen,
  PHASE.timeRewind,
];

// The most cars a race can have; the championship races with 7.
export const MAX_CARS = 20;
// the field sizes the stage select offers, 7 as in the original
export const RACE_SIZES = [7, 10, 15, 20];

// What the game is doing: the screen it shows, the race setup and the player's progress.
export const game = {
  phase: PHASE.loading,
  // 0 the regular championship, 1 "switch" mode (stage after stage without menus)
  mode: 0,
  // stages the player can pick (1..17)
  unlocked: 1,
  // car type of every car in the race, the player's at index 0
  carTypes: Array(MAX_CARS).fill(0),
  carCount: 7,
  // how many cars a championship race has, chosen in the stage select
  raceCars: 7,
  // index of the car the player controls (another one in replays)
  player: 0,
};
