// Separate sources, so tests can seed them and effects do not shift the simulation:
// sim drives the simulation (AI, physics, damage), fx what is seen and heard. wreck is
// fx's but for the one draw of it that reaches the race, as in the original: how far an
// exploding wreck is stretched also sets how it bounces off walls. Racing together, the
// race keeps it apart, as it keeps sim (see net/raceState.js); fx is drawn by what is
// shown as much as the screen shows. scratch paints the damage into car textures while
// drawing, as much per frame as there is time for. sound picks the samples of the other
// cars' sounds (see audio/carSounds.js): heard or not, they never change the race.
/* eslint-disable no-restricted-properties */
export const random = {
  sim: Math.random,
  fx: Math.random,
  wreck: Math.random,
  scratch: Math.random,
  sound: Math.random,
};
/* eslint-enable no-restricted-properties */

// mulberry32, the same on every platform, its state kept in next.state: a race that is
// run again from a kept moment (see net/raceState.js) draws again what it drew then.
export const seededRandom = (seed) => {
  const next = () => {
    next.state = (next.state + 0x6d2b79f5) >>> 0;
    let t = next.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.state = seed >>> 0;
  return next;
};
