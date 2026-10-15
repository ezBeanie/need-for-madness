import { expect, test } from "vitest";
import { loadGame } from "./harness/loadGame.js";

// While loading (fase 0) every logic tick advances reqload by one, up to 9.
const ticksAfter = (frameTimes) => {
  const { ctx } = loadGame();
  frameTimes.forEach((now) => ctx.mainloop(now));
  return ctx.reqload;
};

test("a 120 Hz display still gets one logic tick every 35 ms", () => {
  const frames = Array.from({ length: 30 }, (_, i) => i * (1000 / 120));
  // the first frame ticks immediately, then 241.7 ms / 35 ms = 6 more
  expect(ticksAfter(frames)).toBe(7);
});

test("a slow display catches up with several ticks per frame", () => {
  expect(ticksAfter([0, 100])).toBe(1 + 2);
});

test("a long stall only catches up 250 ms", () => {
  expect(ticksAfter([0, 10_000])).toBe(1 + 7);
});
