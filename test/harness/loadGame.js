import { vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { actionFor } from "../../src/input/keyboard.js";
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

const sourceFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(join(dir, entry.name))
      : entry.name.endsWith(".js")
        ? [join(dir, entry.name)]
        : [],
  );

// every gl.* name the game uses, for the WebGL stub
const glNames = [
  ...new Set(
    sourceFiles(join(PROJECT_ROOT, "src")).flatMap((file) =>
      (readFileSync(file, "utf8").match(/\bgl\.\w+/g) ?? []).map((use) =>
        use.slice(3),
      ),
    ),
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

// Every call loads fresh instances of the game and all its modules, with its own browser
// stubs. seed drives the simulation, fxSeed only visual and sound effects.
export const loadGame = async ({ seed = 1, fxSeed = seed + 1000 } = {}) => {
  if (!globalThis.mat4) {
    installGlMatrix();
  }
  const queue = createTaskQueue();
  installBrowser(queue);

  // The game reads Math.random once when loading (both random sources start as it, and
  // the car select smoke is placed right away); it never calls it afterwards.
  const fxrandom = seededRandom(fxSeed);
  const mathRandom = Math.random;
  Math.random = fxrandom;
  let ctx;
  try {
    vi.resetModules();
    ({ __state: ctx } = await import("../../src/game.js"));
  } finally {
    Math.random = mathRandom;
  }
  ctx.random.sim = seededRandom(seed);
  ctx.random.fx = fxrandom;
  ctx.random.scratch = seededRandom(fxSeed + 500);
  // the drawing helpers of the game's own module instance, for the drawing tests
  const { drawMatrix, placeModel } = await import(
    "../../src/render/interpolation.js"
  );
  Object.assign(ctx, { drawMatrix, placeModel });

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
      `"${what}" not reached within ${maxFrames} frames (phase=${ctx.game.phase})`,
    );
  };

  // like a key event in the browser: through the game's key bindings
  const key = (keyCode, down) => {
    const action = actionFor(keyCode);
    if (action) {
      ctx.onKey(action, down);
    }
  };

  return { ctx, step, stepUntil, key };
};
