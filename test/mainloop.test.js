import { expect, test } from "vitest";
import { loadGame } from "./harness/loadGame.js";

// While loading every logic tick advances loading.step by one, up to 9.
const ticksAfter = async (frameTimes) => {
  const { ctx } = await loadGame();
  const { loading } = await import("../src/loading/progress.js");
  frameTimes.forEach((now) => ctx.runFrame(now));
  return loading.step;
};

test("a 120 Hz display still gets one logic tick every 35 ms", async () => {
  const frames = Array.from({ length: 30 }, (_, i) => i * (1000 / 120));
  // the first frame ticks immediately, then 241.7 ms / 35 ms = 6 more
  expect(await ticksAfter(frames)).toBe(7);
});

test("a slow display catches up with several ticks per frame", async () => {
  expect(await ticksAfter([0, 100])).toBe(1 + 2);
});

test("a long stall only catches up 250 ms", async () => {
  expect(await ticksAfter([0, 10_000])).toBe(1 + 7);
});
