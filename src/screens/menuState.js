// What the menu screens share.
export const menu = {
  // draw the menu's 3D scene this frame (menus redraw it only when something changed)
  redraw: false,
  // ticks of a screen's opening animation (see raceEnd.js for that screen's values)
  animation: 0,
  // the main menu skips its intro
  skipIntro: true,
  // the main menu offers to reset the game (after the last stage was won)
  resetOffered: false,
};

export const SHOWCASE = { hovering: 0, droppingIn: 1, flyingOut: 2 };

// The car presented turning in the middle of car select, the unlocked car and the main
// menu. It hovers up and down, drops in and flies out (motion, see SHOWCASE).
export const showcase = {
  height: 100,
  // 1 rising, 2 and up resting at the top, 0 sinking, -1 and down resting at the bottom
  bob: 0,
  dropSpeed: 0,
  motion: SHOWCASE.droppingIn,
};
