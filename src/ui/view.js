// The 2D canvas (menus, HUD) on top of the 3D one. The game lays everything out for
// 1280x720 and scales it to the window.
export const canvas2D = document.querySelector("#canvas2D");
export const rd = canvas2D.getContext("2d");

export const view = {
  width: 1280,
  height: 720,
  aspect: 1280 / 720,
  // window size relative to the 1280x720 layout, and the average of both
  scaleX: 1,
  scaleY: 1,
  scale: 1,
  // how much wider than 16:9 the window is, in layout pixels
  widescreenShift: 0,
};
