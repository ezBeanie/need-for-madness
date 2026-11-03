// Racing together, a player whose car is wasted watches the race go on: the camera follows
// one of the cars still racing, the next or the one before as the player steers (or with
// the HUD's buttons), flying over as the replay viewer's does (see replayViewer.js).

import { game } from "../core/state.js";
import { camera } from "../render/camera.js";
import { racers } from "./racers.js";
import { followCar } from "./replayViewer.js";
import { track } from "./track.js";

// the wreck shows this long before the camera leaves it
const WRECK_TICKS = 40;

// ticks since the player's car was wasted; the steering held last tick: a car further
// each time it is pressed
export const spectate = { ticks: 0 };
const held = { left: false, right: false };

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

// whether the camera shows another car than the wreck
export const watchingOthers = () =>
  spectating() && spectate.ticks > WRECK_TICKS;

// Every tick: steering picks a car, and a car wasted since is left for another.
export const spectateTick = () => {
  if (!spectating()) {
    spectate.ticks = 0;
    return;
  }
  if (++spectate.ticks <= WRECK_TICKS) {
    return;
  }
  const { left, right } = racers[game.player].u;
  if (left && !held.left) {
    watchNext(-1);
  }
  if (right && !held.right) {
    watchNext(1);
  }
  held.left = left;
  held.right = right;
  if (!stillRacing(camera.target)) {
    watchNext(1);
  }
};
