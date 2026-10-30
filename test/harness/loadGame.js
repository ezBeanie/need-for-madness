import { vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createBrowserGlobals, createTaskQueue } from "./browserStubs.js";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
// What the browser fetches lives in public/, like the Vite dev server serves it.
const PUBLIC_ROOT = join(PROJECT_ROOT, "public");

const FRAME_MS = 35;

// a key's place on the keyboard (a browser event's code) by its key code
const NAMED_KEYS = {
  13: "Enter",
  27: "Escape",
  32: "Space",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
};
const codeOf = (keyCode) =>
  NAMED_KEYS[keyCode] ?? `Key${String.fromCharCode(keyCode)}`;

// mulberry32: tiny, fast and identical on every platform.
export const seededRandom = (seed) => {
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

const installBrowser = (queue, userAgent) => {
  for (const [name, value] of Object.entries(
    createBrowserGlobals({ root: PUBLIC_ROOT, queue, glNames, userAgent }),
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
// stubs. seed drives the simulation, fxSeed only visual and sound effects; a phone's
// userAgent makes it a phone (touch controls).
export const loadGame = async ({
  seed = 1,
  fxSeed = seed + 1000,
  userAgent,
} = {}) => {
  if (!globalThis.mat4) {
    installGlMatrix();
  }
  const queue = createTaskQueue();
  installBrowser(queue, userAgent);

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
  // (one source, as the game's two are: the golden masters recorded them as one)
  ctx.random.wreck = fxrandom;
  ctx.random.scratch = seededRandom(fxSeed + 500);
  ctx.random.sound = seededRandom(fxSeed + 700);
  // the drawing helpers of the game's own module instance, for the drawing tests
  const { drawMatrix, placeModel } = await import(
    "../../src/render/interpolation.js"
  );
  Object.assign(ctx, { drawMatrix, placeModel });
  // everything the game's modules export, from the game's own module instances, for the
  // names game.js does not import itself
  for (const file of sourceFiles(join(PROJECT_ROOT, "src")).sort()) {
    const exports = await import(/* @vite-ignore */ file);
    for (const [name, value] of Object.entries(exports)) {
      if (!(name in ctx)) {
        ctx[name] = value;
      }
    }
  }

  let frame = 0;
  const step = () => {
    ctx.runTick();
    queue.flush();
    ctx.render();
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
  const key = (keyCode, down) =>
    ctx.handleKey({ keyCode, code: codeOf(keyCode) }, down, ctx.onKey);

  return { ctx, step, stepUntil, key };
};
