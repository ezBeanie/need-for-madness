// What the menu screens share.
export const menu = {
  // draw the menu's 3D scene this frame (menus redraw it only when something changed)
  redraw: false,
  // ticks of a screen's opening animation; on the race end screen 76 means an unlocked
  // car is presented
  animation: 0,
  // the picture of Insano next to tips and messages (0..5)
  insanoPicture: 0,
  // the main menu skips its intro
  skipIntro: true,
};

// The car presented turning in the middle of car select, the unlocked car and the main
// menu. It hovers up and down, drops in and flies out.
export const showcase = {
  height: 100,
  // 1 rising, 2 and up resting at the top, 0 sinking, -1 and down resting at the bottom
  bob: 0,
  dropSpeed: 0,
};
