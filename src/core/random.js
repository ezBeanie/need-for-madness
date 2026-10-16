// Separate sources: effects may consume randomness at any rate without changing the race.
// sim drives the simulation (AI, physics, damage), fx only what is seen and heard.
// eslint-disable-next-line no-restricted-properties
export const random = { sim: Math.random, fx: Math.random };
