import { expect, test } from "vitest";
import { loadGame } from "./harness/loadGame.js";

test("a voice is full near its car, gone far from it, and clearly quieter halfway", async () => {
  await loadGame();
  const { voiceLoudness } = await import("../src/net/voice.js");
  expect(voiceLoudness(0)).toBe(1);
  expect(voiceLoudness(300)).toBe(1);
  expect(voiceLoudness(4000)).toBe(0);
  expect(voiceLoudness(9000)).toBe(0);
  // (halfway at most a quarter: 12 dB down, which the ear hears as clearly quieter)
  expect(voiceLoudness(2150)).toBeLessThanOrEqual(0.25);
  for (let distance = 300; distance < 4000; distance += 100) {
    expect(voiceLoudness(distance + 100)).toBeLessThan(voiceLoudness(distance));
  }
});
