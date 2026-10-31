import { afterEach, expect, test, vi } from "vitest";
import { canvasCalls } from "./harness/browserStubs.js";
import { startRace } from "./harness/race.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

// the round marks drawn in a frame: a car each on the minimap
const marksDrawn = (step) => {
  let marks = 0;
  canvasCalls.listener = (name, args, call) => {
    if (name === "arc") {
      marks++;
    }
    return call();
  };
  step();
  canvasCalls.listener = null;
  return marks;
};

test("G shows the minimap with every car on it, and hides it again", async () => {
  const stored = new Map();
  vi.stubGlobal("Storage", class {});
  vi.stubGlobal("localStorage", {
    getItem: (name) => stored.get(name) ?? null,
    setItem: (name, value) => stored.set(name, String(value)),
  });
  const { ctx, step, key } = await startRace({ stage: 3, car: 5 });
  for (let i = 0; i < 300 && ctx.raceEvents.countdown > 0; i++) {
    step();
  }
  const without = marksDrawn(step);
  key(71, true);
  key(71, false);
  expect(ctx.minimap.shown).toBe(true);
  expect(stored.get("minimap")).toBe("1");
  // the player's car is drawn twice, white over black
  expect(marksDrawn(step) - without).toBe(ctx.game.carCount + 1);
  key(71, true);
  key(71, false);
  expect(marksDrawn(step)).toBe(without);
});
