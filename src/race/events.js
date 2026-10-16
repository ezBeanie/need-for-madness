// What just happened in the race, for the HUD and the stage animations.
export const raceEvents = {
  // the checkpoint the player just passed (-1 none), and whether it was the last one
  oncheckpoint: -1,
  onlastcheck: false,
  onelec: false,
  // ticks since the player's car began to blow up (up to 16, then "You're Wasted!")
  playerWreckTicks: 0,
  onautocorrect: 0,
  // ticks since the race was over (won, lost or wasted)
  raceOverTicks: 0,
  // ticks the stunt praise has been shown, from below 45 up to 45 (none shown)
  stuntTicks: 45,
  // ticks the message has been shown, from below 30 up to 30 (none shown)
  messageTicks: 30,
  // the checkpoints the HUD has announced
  checkpointsAnnounced: 0,
  switcnt: 0,
  // ticks until the race starts (the countdown), 0 while racing
  countdown: 0,
  // the player won the race
  winner: false,
  // the flashing of the checkpoint text
  checkpointFlash: 0,
};
