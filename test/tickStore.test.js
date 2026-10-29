import { expect, test } from "vitest";
import { STORE_TICKS, ticksToShow } from "../src/net/tickStore.js";

// The ticks the guest shows in each of its ticks, the host's arriving as `arrivals` says
// (how many come in before each of the guest's ticks).
const shown = (arrivals) => {
  const store = { ticks: [], playing: false };
  let next = 0;
  return arrivals.map((count) => {
    for (let i = 0; i < count; i++) {
      store.ticks.push(next++);
    }
    return ticksToShow(store);
  });
};

test("the race starts once a few of the host's ticks are in store", () => {
  expect(shown([1, 1, 1, 1, 1])).toEqual([[], [], [0], [1], [2]]);
  expect(STORE_TICKS).toBe(3);
});

test("ticks arriving in bursts are shown one each tick", () => {
  // two at once, then none: the guest's race runs on evenly
  expect(shown([3, 0, 2, 0, 2, 0, 2, 0])).toEqual([
    [0],
    [1],
    [2],
    [3],
    [4],
    [5],
    [6],
    [7],
  ]);
});

test("a store run dry fills up again before the race goes on", () => {
  expect(shown([3, 0, 0, 0, 1, 1, 1, 1])).toEqual([
    [0],
    [1],
    [2],
    [],
    [],
    [],
    [3],
    [4],
  ]);
});

test("a store grown too big is played off two at a time", () => {
  expect(shown([10, 0, 0, 0])).toEqual([[0, 1], [2, 3], [4], [5]]);
});
