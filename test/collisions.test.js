import { afterEach, expect, test, vi } from "vitest";
import { audioCalls } from "./harness/browserStubs.js";
import { startRace } from "./harness/race.js";

let reset = null;
afterEach(() => reset?.());

test("a crash only the race run again quietly had is heard once it caught up, unless heard just before", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  // (the sounds loaded)
  for (let i = 0; i < 3; i++) {
    step();
  }
  // (long after any crash heard in the tests before)
  const now = vi.spyOn(performance, "now").mockReturnValue(1e12);
  reset = () => {
    now.mockRestore();
    ctx.physics.quiet = false;
    ctx.lateCrashes.clear();
  };
  ctx.raceEvents.countdown = 0;
  const heardAfter = (crash) => {
    // (the crash sounds' waits over)
    for (let i = 0; i < 10; i++) {
      ctx.coolDownCarSounds();
    }
    const before = audioCalls.started;
    crash();
    return audioCalls.started - before;
  };
  // (a hard hit on the player's own car, heard as it is)
  const hit = () => ctx.regn(ctx.HIT.alongZ, 1, 300, ctx.game.player);
  const quietly = () => {
    ctx.physics.quiet = true;
    hit();
    ctx.physics.quiet = false;
  };
  expect(heardAfter(quietly)).toBe(0);
  expect(ctx.lateCrashes.size).toBe(1);
  expect(heardAfter(ctx.hearLateCrashes)).toBeGreaterThan(0);
  expect(ctx.lateCrashes.size).toBe(0);
  // heard in its first run a moment before: not again
  quietly();
  expect(heardAfter(ctx.hearLateCrashes)).toBe(0);
});
