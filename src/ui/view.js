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

// Held upright, a phone shows the game turned a quarter, as iOS lets no page keep itself
// sideways (an unfolded foldable's almost square screen plays upright, seeing more above
// and below): the page lies along the screen's height, and what pointers say turns back.
const UPRIGHT_PHONE = "(max-aspect-ratio: 4/5) and (pointer: coarse)";
export const turned = { on: false };

export const turnIfUpright = () => {
  const on = window.matchMedia?.(UPRIGHT_PHONE).matches ?? false;
  if (on != turned.on) {
    turned.on = on;
    document.documentElement.classList.toggle("turned", on);
  }
};

// A point on the screen, as pointer events give it, on the page as it is laid out.
export const pagePoint = (clientX, clientY) =>
  turned.on
    ? { x: clientY, y: window.innerWidth - clientX }
    : { x: clientX, y: clientY };

// An element's box on the page as it is laid out (the browser gives the screen's).
export const pageBox = (element) => {
  const box = element.getBoundingClientRect();
  if (!turned.on) {
    return box;
  }
  return {
    left: box.top,
    top: window.innerWidth - box.right,
    width: box.height,
    height: box.width,
  };
};
