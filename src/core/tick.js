// The game logic runs in fixed ticks of 35 ms, what the original self-regulating loop
// settled at. Every tick advances the physics by scale = 0.7 original ticks, exactly as
// before. Things the original did once per original tick happen in the ticks where
// fraction has completed one: if (tick.fraction >= tick.scale).
export const tick = { scale: 0.7, fraction: 0 };
