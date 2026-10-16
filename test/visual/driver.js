// Drives the real game in the browser deterministically: seeded randomness and frames
// that only advance when the test says so, each exactly one logic tick long.

const TICK_MS = 35;

// Runs in the page before the game: everything that makes a run repeatable.
const prepareBrowser = ({ seed, storage }) => {
  // mulberry32, as in the Node harness
  window.seededRandom = (start) => {
    let a = start >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  Math.random = window.seededRandom(seed);
  // Sounds decode asynchronously and sound code draws effect randomness depending on what
  // is decoded already. Without Web Audio the game simply plays silently.
  delete window.AudioContext;
  delete window.webkitAudioContext;
  for (const [key, value] of Object.entries(storage)) {
    localStorage.setItem(key, value);
  }
  const callbacks = [];
  let now = 0;
  window.requestAnimationFrame = (callback) => callbacks.push(callback);
  window.advanceFrames = (count, ms) => {
    for (let i = 0; i < count; i++) {
      now += ms;
      callbacks.splice(0).forEach((callback) => callback(now));
    }
  };
};

export const openGame = async (page, { storage = {} } = {}) => {
  await page.addInitScript(prepareBrowser, { seed: 1, storage });
  await page.goto("/");
  await page.waitForFunction(() => window.advanceFrames !== undefined);
  // the dev server serves the game with the test plugin that exports its state
  await page.evaluate(async () => {
    window.gameState = (await import("/src/game.js")).__state;
    await Promise.all([
      document.fonts.load("20px junk"),
      document.fonts.load("20px verd"),
    ]);
  });
  const game = {
    phase: () => page.evaluate(() => window.gameState.game.phase),
    advance: (frames = 1, ms = TICK_MS) =>
      page.evaluate(([n, step]) => window.advanceFrames(n, step), [frames, ms]),
    // Advances frame by frame (giving loading requests time) until the game is in phase.
    advanceUntil: async (phase, maxFrames = 2000) => {
      for (let i = 0; i < maxFrames; i++) {
        if ((await game.phase()) === phase) {
          return;
        }
        await game.advance();
        await page.waitForTimeout(5);
      }
      throw new Error(
        `phase ${phase} not reached, still in ${await game.phase()}`,
      );
    },
    // How many ticks loading takes depends on the network. Once everything is loaded, this
    // resets what carries over from those ticks: the random sources (now separate for
    // simulation and effects) and tick.fraction, which decides in which ticks per-tick events happen.
    settle: async () => {
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => {
        window.gameState.random.sim = window.seededRandom(1);
        window.gameState.random.fx = window.seededRandom(1001);
        window.gameState.random.scratch = window.seededRandom(1501);
        window.gameState.tick.fraction = 0;
      });
    },
    tap: async (key) => {
      await page.keyboard.down(key);
      await game.advance();
      await page.keyboard.up(key);
    },
  };
  return game;
};
