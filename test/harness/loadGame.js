import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createBrowserGlobals, createTaskQueue } from "./browserStubs.js";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
// What the browser fetches lives in public/, like the Vite dev server serves it.
const PUBLIC_ROOT = join(PROJECT_ROOT, "public");

const FRAME_MS = 35;

// mulberry32: tiny, fast and identical on every platform.
const seededRandom = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// gl-matrix is a classic script in index.html that defines mat4, quat, vec3 on self.
const installGlMatrix = () => {
  globalThis.self = globalThis;
  vm.runInThisContext(
    readFileSync(join(PUBLIC_ROOT, "gl-matrix-min.js"), "utf8"),
  );
};

const glNames = [
  ...new Set(
    readFileSync(join(PROJECT_ROOT, "src/game.js"), "utf8")
      .match(/\bgl\.\w+/g)
      .map((use) => use.slice(3)),
  ),
];

const installBrowser = (queue) => {
  for (const [name, value] of Object.entries(
    createBrowserGlobals({ root: PUBLIC_ROOT, queue, glNames }),
  )) {
    Object.defineProperty(globalThis, name, {
      value,
      writable: true,
      configurable: true,
    });
  }
  globalThis.window = globalThis;
};

let instances = 0;

// Every call imports a fresh instance of the game module (the query makes it a new module),
// with its own browser stubs. seed drives the simulation, fxSeed only visual and sound effects.
export const loadGame = async ({ seed = 1, fxSeed = seed + 1000 } = {}) => {
  if (!globalThis.mat4) {
    installGlMatrix();
  }
  const queue = createTaskQueue();
  installBrowser(queue);

  // The game reads Math.random once when loading (simrandom and fxrandom start as it,
  // and the car select smoke is placed right away); it never calls it afterwards.
  const fxrandom = seededRandom(fxSeed);
  const random = Math.random;
  Math.random = fxrandom;
  let ctx;
  try {
    const gameModule = `../../src/game.js?instance=${++instances}`;
    ({ __state: ctx } = await import(/* @vite-ignore */ gameModule));
  } finally {
    Math.random = random;
  }
  ctx.simrandom = seededRandom(seed);
  ctx.fxrandom = fxrandom;

  let frame = 0;
  const step = () => {
    ctx.gameloop();
    queue.flush();
    ctx.render(frame * FRAME_MS);
    queue.flush();
    frame++;
  };

  const stepUntil = (done, maxFrames, what) => {
    for (let i = 0; i < maxFrames; i++) {
      if (done()) {
        return;
      }
      step();
    }
    throw new Error(
      `"${what}" not reached within ${maxFrames} frames (fase=${ctx.fase})`,
    );
  };

  const key = (keyCode, down) => {
    const event = { keyCode, preventDefault: () => {} };
    if (down) {
      ctx.Keydown(event);
    } else {
      ctx.Keyup(event);
    }
  };

  return { ctx, step, stepUntil, key };
};
