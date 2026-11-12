// The whole state a race runs on from, to keep at a tick and restore: racing together by
// sending each other only the keys (rollback netcode), a game that learns keys late winds
// its race back to where they were pressed and runs it on again with them. What is only
// seen or heard (effects, sounds, highlights, the HUD) is left as it is.

import {
  deathmatchState,
  isDeathmatch,
  isDeathmatchState,
  restoreDeathmatch,
} from "../race/deathmatch.js";
import { random } from "../core/random.js";
import { game } from "../core/state.js";
import { tick } from "../core/tick.js";
import { ai } from "../race/ai.js";
import { raceEvents } from "../race/events.js";
import { physics, undentedVertices } from "../race/physics.js";
import { racers } from "../race/racers.js";
import { track } from "../race/track.js";
import { copyCarState, isCarState, restoreCarState } from "./carState.js";

// the standings on the track (see track.insih)
const STANDINGS = ["pos", "clear", "dested", "magperc"];
// of the race's events, what the race itself goes by; the rest is the HUD's, each
// player's own, which a race wound back leaves as it is
const EVENTS = ["countdown", "onautocorrect"];

// (only seeded sources keep a state: racing together, both games seed theirs alike)
const randomState = (source) => source.state;
const restoreRandom = (source, state) => {
  if (state !== undefined) {
    source.state = state;
  }
};

// whether the body's copy of its vertices has no dent: one goes as null, a race's cars
// mostly have one (each repaired car does) and it is the most of the race
const isUndented = (body) => {
  const undented = (body.undented ??= undentedVertices(body));
  return (
    undented.length == body.dvert.length &&
    undented.every((v, i) => Object.is(v, body.dvert[i]))
  );
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
      dents: body.dvert && (isUndented(body) ? null : body.dvert.slice()),
      dented: body.iscar,
      driver: { ...ai[c] },
    });
  }
  return {
    cars,
    standings: STANDINGS.map((field) => track[field].slice()),
    wasted: track.wasted,
    haltall: track.haltall,
    events: Object.fromEntries(
      EVENTS.map((event) => [event, raceEvents[event]]),
    ),
    sim: randomState(random.sim),
    wreck: randomState(random.wreck),
    fraction: tick.fraction,
    flipWhenGrounded: physics.flipWhenGrounded,
    // (only racing for most kills: every other race's state as it always was)
    ...(isDeathmatch() ? { deathmatch: deathmatchState() } : {}),
  };
};

// The race as every game of a race together computes it alike: between frames, a game's
// own car has the keys its player holds, and the count of the wasted cars (all but the
// player's) is each player's own.
export const sharedRace = () => {
  const { cars, wasted, ...race } = saveRace();
  return { ...race, cars: cars.map(({ keys, ...car }) => car) };
};

export const restoreRace = (state) => {
  state.cars.forEach((saved, c) => {
    restoreCarState(c, saved);
    Object.assign(racers[c].u, saved.keys);
    const body = racers[c].body;
    body.dvert =
      saved.dents === null ? undentedVertices(body) : saved.dents?.slice();
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
  if (state.deathmatch) {
    restoreDeathmatch(state.deathmatch);
  }
};

// whether what another game sent can be the state of a race of so many cars
export const isRaceState = (state, cars) =>
  state != null &&
  Array.isArray(state.cars) &&
  state.cars.length == cars &&
  state.cars.every(
    (saved) =>
      isCarState(saved) &&
      typeof saved.keys == "object" &&
      typeof saved.driver == "object",
  ) &&
  Array.isArray(state.standings) &&
  state.standings.length == STANDINGS.length &&
  state.standings.every(Array.isArray) &&
  typeof state.events == "object" &&
  Number.isFinite(state.fraction) &&
  (state.deathmatch === undefined || isDeathmatchState(state.deathmatch));
