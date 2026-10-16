// What the game is doing: the screen it shows, the race setup and the player's progress.
export const game = {
  // 0 loading, 1 main menu, 2 car select, 3 loading a stage, 4 stage select,
  // 5 instructions, 7 racing, 8/9/10 replays, 11 paused, 12 race end, 13 reset question,
  // 15 start flash, 16 switching to the next stage, 18 rewinding
  phase: 0,
  // 0 the regular championship, 1 "switch" mode (stage after stage without menus)
  mode: 0,
  // stages the player can pick (1..17)
  unlocked: 1,
  // car type of every car in the race, the player's at index 0
  carTypes: [0, 0, 0, 0, 0, 0, 0],
  carCount: 7,
  // index of the car the player controls (another one in replays)
  player: 0,
};
