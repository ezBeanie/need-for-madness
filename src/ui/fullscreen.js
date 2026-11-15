// Fullscreen, the browser's bars hidden. A phone's browser goes fullscreen at a touch, as
// games on the web do, unless the player turned that off in the options, whose switch any
// window has. Browsers allow it only right after a touch, click or key, and iPhones not for
// a page at all (the installed game starts fullscreen there: see the manifest).
import { loadSetting, saveSetting } from "../core/storage.js";

export const fullscreen = { onTouch: loadSetting("fullscreenOnTouch") != 0 };

export const canFullscreen = () =>
  Boolean(document.fullscreenEnabled ?? document.webkitFullscreenEnabled);

export const isFullscreen = () =>
  Boolean(document.fullscreenElement ?? document.webkitFullscreenElement);

// (older Safaris know only the webkit names, which return nothing to wait for)
const enter = () => {
  const root = document.documentElement;
  const request = root.requestFullscreen ?? root.webkitRequestFullscreen;
  request?.call(root, { navigationUI: "hide" })?.catch(() => {});
};

const leave = () => {
  const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
  exit?.call(document)?.catch(() => {});
};

// The options' switch: fullscreen now or not, and so at the touches after.
export const toggleFullscreen = () => {
  fullscreen.onTouch = !isFullscreen();
  saveSetting("fullscreenOnTouch", fullscreen.onTouch ? 1 : 0);
  if (fullscreen.onTouch) {
    enter();
  } else {
    leave();
  }
};

// A touch (not a mouse's click): fullscreen, unless the player turned it off.
export const fullscreenOnTouch = () => {
  if (
    fullscreen.onTouch &&
    canFullscreen() &&
    !isFullscreen() &&
    globalThis.matchMedia?.("(pointer: coarse)").matches
  ) {
    enter();
  }
};
