// The game logic runs in fixed ticks of 35 ms, what the original self-regulating loop
// settled at. Every tick advances the physics by scale = 0.7 original ticks, exactly as
// before. Things the original did once per original tick happen in the ticks where
// fraction has completed one: if (tick.fraction >= tick.scale).
export const tick = { scale: 0.7, fraction: 0 };

// The fraction of the next tick. (Where the original's ticks fall among this game's is part
// of a race: a guest driving its car ahead of the host does it at the host's.)
export const nextFraction = (fraction) =>
  (fraction >= tick.scale ? fraction - 1 : fraction) + tick.scale;
