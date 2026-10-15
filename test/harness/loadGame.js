import { parse } from "acorn";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createBrowserGlobals, createTaskQueue } from "./browserStubs.js";

export const PROJECT_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const FRAME_MS = 35;

// Browser globals the game scripts reference as free identifiers.
const BROWSER_NAMES = [
  "window",
  "self",
  "document",
  "navigator",
  "screen",
  "Image",
  "Audio",
  "AudioContext",
  "XMLHttpRequest",
  "requestAnimationFrame",
  "setTimeout",
];

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

const readSource = (file) => readFileSync(join(PROJECT_ROOT, file), "utf8");

// The game's input handlers, saveInfo/getInfo etc. live in the inline <script> of index.html.
const inlineScriptOfIndexHtml = () => {
  const match = readSource("index.html").match(/<script>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("inline <script> not found in index.html");
  }
  return match[1];
};

const topLevelNames = (source) => {
  const vars = new Set();
  const functions = new Set();
  for (const node of parse(source, { ecmaVersion: "latest" }).body) {
    if (node.type === "VariableDeclaration") {
      node.declarations.forEach((d) => vars.add(d.id.name));
    }
    if (node.type === "FunctionDeclaration") {
      functions.add(node.id.name);
    }
  }
  return { vars, functions };
};

// Globals inside a vm context are very slow (property interceptors), and needmad.js is
// almost only globals. So all scripts run inside one function scope instead, and the
// returned object exposes every top-level var/function via getters and setters.
const compileGame = () => {
  const glMatrix = readSource("gl-matrix-min.js");
  const game = [readSource("needmad.js"), inlineScriptOfIndexHtml()].join(
    "\n;\n",
  );
  const { vars, functions } = topLevelNames(game);
  const accessors = [
    ...[...vars].map(
      (n) => `get ${n}() { return ${n}; }, set ${n}(v) { ${n} = v; }`,
    ),
    ...[...functions]
      .filter((n) => !vars.has(n))
      .map((n) => `get ${n}() { return ${n}; }`),
  ];
  const source = `(function (__browser, Math) {
var { ${BROWSER_NAMES.join(", ")} } = __browser;
${glMatrix}
;var mat4 = self.mat4;
${game}
return { ${accessors.join(",\n")} };
})`;
  return vm.runInThisContext(source, { filename: "needmad-harness-bundle.js" });
};

let compiled;

const forbiddenRandom = () => {
  throw new Error("use simrandom() or fxrandom() instead of Math.random()");
};

// seed drives the simulation, fxSeed only visual and sound effects.
export const loadGame = ({ seed = 1, fxSeed = seed + 1000 } = {}) => {
  compiled ??= compileGame();
  const queue = createTaskQueue();
  const rafCallbacks = [];
  const browser = createBrowserGlobals({
    root: PROJECT_ROOT,
    queue,
    rafCallbacks,
  });
  browser.window = browser;
  browser.self = browser;
  // needmad.js starts with `var fxrandom = Math.random` and already uses it at load time.
  const fxrandom = seededRandom(fxSeed);
  const math = Object.create(Math, {
    random: { value: fxrandom, writable: true },
  });
  const ctx = compiled(browser, math);
  math.random = forbiddenRandom;
  ctx.simrandom = seededRandom(seed);
  ctx.fxrandom = fxrandom;

  let frame = 0;
  const step = () => {
    ctx.gameloop();
    queue.flush();
    for (const render of rafCallbacks.splice(0)) {
      render(frame * FRAME_MS);
    }
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
