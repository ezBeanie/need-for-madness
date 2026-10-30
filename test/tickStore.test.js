import { expect, test } from "vitest";
import { CALM_TICKS, emptyStore, ticksToShow } from "../src/net/tickStore.js";

// The ticks the guest shows in each of its ticks, the host's arriving as `arrivals` says
// (how many come in before each of the guest's ticks).
const shown = (arrivals, store = emptyStore({})) => {
  let next = 0;
  return arrivals.map((count) => {
    for (let i = 0; i < count; i++) {
      store.ticks.push(next++);
    }
    return ticksToShow(store);
  });
};

test("on a steady connection each tick shows as soon as it arrives", () => {
  expect(shown([1, 1, 1, 1])).toEqual([[0], [1], [2], [3]]);
});

test("a store run dry waits for one tick more before the race goes on", () => {
  const store = emptyStore({});
  expect(shown([1, 0, 1, 1, 1, 1], store)).toEqual([
    [0],
    [],
    [],
    [1],
    [2],
    [3],
  ]);
  expect(store.need).toBe(2);
  // (the tick it waited for stays in store, against the next late one)
  expect(store.ticks).toEqual([4]);
});

test("ticks arriving in bursts are shown one each tick", () => {
  const store = emptyStore({});
  store.need = 2;
  expect(shown([2, 0, 2, 0, 2, 0], store)).toEqual([
    [0],
    [1],
    [2],
    [3],
    [4],
    [5],
  ]);
});

test("a tick in store that was never needed is played off after a calm while", () => {
  const store = emptyStore({});
  store.need = 2;
  const arrivals = [3, ...Array(CALM_TICKS + 1).fill(1)];
  const counts = shown(arrivals, store).map((ticks) => ticks.length);
  expect(counts.slice(0, CALM_TICKS - 1).every((n) => n == 1)).toBe(true);
  expect(counts[CALM_TICKS - 1]).toBe(2);
  expect(counts.slice(CALM_TICKS).every((n) => n == 1)).toBe(true);
  expect(store.need).toBe(1);
});

test("a store grown far too big is played off two at a time", () => {
  expect(shown([10, 0, 0, 0, 0, 0])).toEqual([
    [0, 1],
    [2, 3],
    [4, 5],
    [6],
    [7],
    [8],
  ]);
});
