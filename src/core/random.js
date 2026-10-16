// Separate sources, so tests can seed them and effects do not shift the simulation:
// sim drives the simulation (AI, physics, damage), fx what is seen and heard. One fx draw
// reaches the race, as in the original: how far an exploding wreck is stretched also
// sets how it bounces off walls. scratch paints the damage into car textures while
// drawing, as much per frame as there is time for.
/* eslint-disable no-restricted-properties */
export const random = {
  sim: Math.random,
  fx: Math.random,
  scratch: Math.random,
};
/* eslint-enable no-restricted-properties */
