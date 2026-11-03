// Racing together, a player whose car is wasted may watch the race go on (the HUD's Watch
// Race): the camera follows one of the cars still racing, the next or the one before as
// the player steers (or with the HUD's arrows), flying over as the replay viewer's does
// (see replayViewer.js); V switches the camera, the free one too. The menu leaves.

import { game } from "../core/state.js";
import { CAMERA, camera } from "../render/camera.js";
import { racers } from "./racers.js";
import { followCar } from "./replayViewer.js";
import { track } from "./track.js";

// watching: the player chose to watch; the steering held last tick: a car further each
// time it is pressed
export const spectate = { watching: false };
const held = { left: false, right: false };

// whether the player could watch the race go on
export const spectating = () =>
  game.humans.length > 0 && racers[game.player].wasted && !track.haltall;

const stillRacing = (c) => c != game.player && !racers[c].wasted;

// step 1: the next car still racing, -1: the one before
export const watchNext = (step) => {
  for (let k = 1; k < game.carCount; k++) {
    const c = (camera.target + step * k + game.carCount * k) % game.carCount;
    if (stillRacing(c)) {
      followCar(c);
      return;
    }
  }
};

export const startWatching = () => {
  spectate.watching = true;
  watchNext(1);
};

// whether the camera shows another car than the wreck
export const watchingOthers = () => spectating() && spectate.watching;

// Every tick: steering picks a car, and a car wasted since is left for another.
export const spectateTick = () => {
  if (!spectating()) {
    if (spectate.watching && camera.mode == CAMERA.free) {
      camera.mode = CAMERA.behind;
    }
    spectate.watching = false;
    return;
  }
  if (!spectate.watching) {
    return;
  }
  // (the free camera flies with A and D, which steer too)
  const { left, right } = racers[game.player].u;
  const free = camera.mode == CAMERA.free;
  if (left && !held.left && !free) {
    watchNext(-1);
  }
  if (right && !held.right && !free) {
    watchNext(1);
  }
  held.left = left;
  held.right = right;
  if (!stillRacing(camera.target)) {
    watchNext(1);
  }
};
