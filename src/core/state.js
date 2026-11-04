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
  // the stage editor, over the game (see editor/stageEditor.js)
  stageEditor: 19,
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

// The championship, or switch mode: one lap without fixing, and whenever its timer runs
// out the player drives another car of the field.
export const MODE = { championship: 0, switchCars: 1 };

// What the game is doing: the screen it shows, the race setup and the player's progress.
export const game = {
  phase: PHASE.loading,
  mode: MODE.championship,
  // stages the player can pick (1..17)
  unlocked: 1,
  // car type of every car in the race, the player's at index 0
  carTypes: Array(MAX_CARS).fill(0),
  carCount: 7,
  // how many cars a championship race has, chosen in the stage select
  raceCars: 7,
  // index of the car the player controls (another one in replays): the car this screen
  // follows, its HUD, camera and sounds
  player: 0,
  // the cars people drive in a multiplayer race; empty when only the player does
  humans: [],
};

// Whether people drive car c: then the AI leaves it alone and it races by the player's rules.
export const isHuman = (c) =>
  game.humans.length == 0 ? c == game.player : game.humans.includes(c);

// What the main menu starts (see race/career.js): the campaign with its progress, a race
// against opponents as strong as chosen, practice and time attack alone, or a race of a
// room's players (see net/host.js).
export const RACE_KIND = {
  campaign: 0,
  quickRace: 1,
  practice: 2,
  timeAttack: 3,
  together: 4,
};

// How a room's race is won (see net/host.js): as any race, finishing first or wasting the
// others; only racing, no car taking damage; or as the last car not wasted, the laps
// counting for nothing.
export const RACE_MODE = { normal: 0, onlyRacing: 1, lastSurvivor: 2 };
export const RACE_MODE_NAMES = ["Normal race", "Only racing", "Last survivor"];

// whether finishing the laps first wins the race
export const finishingWins = () => raceSetup.mode != RACE_MODE.lastSurvivor;
export const isRaceMode = (mode) =>
  Number.isInteger(mode) && mode >= 0 && mode < RACE_MODE_NAMES.length;

// how strong the opponents of a quick race are
export const STRENGTH = { easy: 0, normal: 1, hard: 2 };

// How the race is set up beyond its stage and its cars, by the menu it was started from
// (see race/career.js): the race reads this, never the career's progress itself.
export const raceSetup = {
  kind: RACE_KIND.campaign,
  // a room's race's mode, as its host chose it (normal in every other race)
  mode: RACE_MODE.normal,
  strength: STRENGTH.normal,
  // the stage whose general driving the opponents have (the stage's own in the campaign)
  aiStage: 1,
  // the stage raced to open the next one in the career, 0 for none: there Insano gives
  // tips, the first stages go easier on the player and the opponents are the original's
  // for a new stage
  newestStage: 0,
  // the opponents drive only the cars these stages opened
  openedStages: 17,
};

// Whether the player races stage, its newest one: the first stages go easier on the player
// there. (Racing together, the games' players have got as far as they each have, so none
// is helped, alike in every game.)
export const onNewestStage = (stage) =>
  game.humans.length == 0 && raceSetup.newestStage == stage;

// The car the computer drivers race against, wait for and chase: the player's, and in a
// race people drive together the first of theirs (the host's), so that every game of it
// computes the same race.
export const aiRival = () =>
  game.humans.length == 0 ? game.player : game.humans[0];
