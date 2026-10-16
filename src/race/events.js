// What just happened in the race, for the HUD and the stage animations. Fields keep their
// original names for now.
export const raceEvents = {
  // the checkpoint the player just passed (-1 none), and whether it was the last one
  oncheckpoint: -1,
  onlastcheck: false,
  onelec: false,
  cntwis: 0,
  onautocorrect: 0,
  holdcnt: 0,
  auscnt: 45,
  tcnt: 30,
  iclear: 0,
  switcnt: 0,
  // ticks until the race starts (the countdown), 0 while racing
  countdown: 0,
  // the player won the race
  winner: false,
  // the flashing of the checkpoint text
  checkpointFlash: 0,
};
