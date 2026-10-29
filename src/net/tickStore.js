// The host's ticks arrive unevenly over the internet, a few at once or none for a while.
// The guest shows one each tick from a store of a few, so its race runs on evenly; a store
// run dry fills up again first, one grown too big is played off two at a time.

export const STORE_TICKS = 3;
const STORE_MOST_TICKS = STORE_TICKS + 3;

// store: { ticks, playing }. Takes the ticks to show this tick out of the store.
export const ticksToShow = (store) => {
  if (store.ticks.length == 0) {
    store.playing = false;
  }
  if (!store.playing && store.ticks.length >= STORE_TICKS) {
    store.playing = true;
  }
  if (!store.playing) {
    return [];
  }
  return store.ticks.splice(0, store.ticks.length > STORE_MOST_TICKS ? 2 : 1);
};
