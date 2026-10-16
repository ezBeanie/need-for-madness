// What the menu screens share.
export const menu = {
  // draw the menu's 3D scene this frame (menus redraw it only when something changed)
  redraw: false,
  // ticks of a screen's opening animation (see raceEnd.js for that screen's values)
  animation: 0,
  // the main menu shows only its intro and continues to car select by itself (on the very
  // first start and after a race)
  continuesToCarSelect: true,
  // the main menu offers to reset the game (after the last stage was won)
  resetOffered: false,
};
