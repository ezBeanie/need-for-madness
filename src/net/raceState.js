// The whole state a race runs on from, to keep at a tick and restore: racing together by
// sending each other only the keys (rollback netcode), a game that learns keys late winds
// its race back to where they were pressed and runs it on again with them. What is only
// seen or heard (effects, sounds, highlights, the HUD) is left as it is.

import { random } from "../core/random.js";
import { game } from "../core/state.js";
import { tick } from "../core/tick.js";
import { ai } from "../race/ai.js";
import { raceEvents } from "../race/events.js";
import { physics } from "../race/physics.js";
import { racers } from "../race/racers.js";
import { track } from "../race/track.js";
import { copyCarState, restoreCarState } from "./carState.js";

// the standings on the track (see track.insih)
const STANDINGS = ["pos", "clear", "dested", "magperc"];

// (only seeded sources keep a state: racing together, both games seed theirs alike)
const randomState = (source) => source.state;
const restoreRandom = (source, state) => {
  if (state !== undefined) {
    source.state = state;
  }
};

export const saveRace = () => {
  const cars = [];
  for (let c = 0; c < game.carCount; c++) {
    // (the keys too: the AI presses them a tick before the physics drives with them; and
    // the body's dents, none before its first hit: which of its corners a hit reaches
    // sets how much damage it does, as in replayViewer.js)
    const body = racers[c].body;
    cars.push({
      ...copyCarState(c),
      keys: { ...racers[c].u },
      dents: body.dvert?.slice(),
      dented: body.iscar,
      driver: { ...ai[c] },
    });
  }
  return {
    cars,
    standings: STANDINGS.map((field) => track[field].slice()),
    wasted: track.wasted,
    haltall: track.haltall,
    events: { ...raceEvents },
    sim: randomState(random.sim),
    wreck: randomState(random.wreck),
    fraction: tick.fraction,
    flipWhenGrounded: physics.flipWhenGrounded,
  };
};

export const restoreRace = (state) => {
  state.cars.forEach((saved, c) => {
    restoreCarState(c, saved);
    Object.assign(racers[c].u, saved.keys);
    const body = racers[c].body;
    body.dvert = saved.dents?.slice();
    body.iscar = saved.dented;
    body.damagedVertices = true;
    Object.assign(ai[c], saved.driver);
  });
  STANDINGS.forEach((field, i) => (track[field] = state.standings[i].slice()));
  track.wasted = state.wasted;
  track.haltall = state.haltall;
  Object.assign(raceEvents, state.events);
  restoreRandom(random.sim, state.sim);
  restoreRandom(random.wreck, state.wreck);
  tick.fraction = state.fraction;
  physics.flipWhenGrounded = state.flipWhenGrounded;
};
