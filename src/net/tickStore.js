// The host's ticks arrive unevenly, a few at once or none for a while. The guest shows one
// each tick from a store, so its race runs on evenly. Each tick in store delays what the
// guest sees by a tick, so the store is as small as the connection allows: it starts at
// one tick, waits for one more each time it runs dry, and plays off a tick it turned out
// not to need after a calm while.

export const STORE_LEAST_TICKS = 1;
const STORE_MOST_TICKS = 4;
// about 7 s
export const CALM_TICKS = 200;
// a store this far over what it needs (after the host stalled) is played off quickly
const STORE_BURST_TICKS = 3;

export const emptyStore = (store) =>
  Object.assign(store, {
    ticks: [],
    playing: false,
    need: STORE_LEAST_TICKS,
    calmTicks: 0,
    // the fewest ticks in store this calm while
    fewest: Infinity,
  });

// Takes the ticks to show this tick out of the store.
export const ticksToShow = (store) => {
  if (store.ticks.length == 0 && store.playing) {
    store.playing = false;
    store.need = Math.min(store.need + 1, STORE_MOST_TICKS);
    store.calmTicks = 0;
    store.fewest = Infinity;
  }
  if (!store.playing && store.ticks.length >= store.need) {
    store.playing = true;
  }
  if (!store.playing) {
    return [];
  }
  store.fewest = Math.min(store.fewest, store.ticks.length);
  let count = store.ticks.length > store.need + STORE_BURST_TICKS ? 2 : 1;
  if (++store.calmTicks >= CALM_TICKS) {
    // (always a tick to spare: one less in store will do)
    if (store.fewest >= 2) {
      count = 2;
      store.need = Math.max(store.need - 1, STORE_LEAST_TICKS);
    }
    store.calmTicks = 0;
    store.fewest = Infinity;
  }
  return store.ticks.splice(0, count);
};
