// The screen stays on while the game shows: phones dim and lock it after a while without a
// touch, and a race is driven with few (with a keyboard or gamepad, none). Browsers grant
// the lock to a page that shows, some only after a touch or key, and let it go when the
// page hides; older ones (iOS before 16.4) have none.

let lock = null;

export const keepScreenOn = () => {
  if (lock || document.visibilityState != "visible" || !navigator.wakeLock) {
    return;
  }
  lock = navigator.wakeLock.request("screen").then(
    (sentinel) => {
      sentinel.addEventListener("release", () => {
        lock = null;
      });
      return sentinel;
    },
    () => {
      lock = null;
    },
  );
};
