import { createHash } from "node:crypto";
import { canvasCalls, glCalls } from "./browserStubs.js";

// What a style property holds when a call draws: colours as they are, gradients by their
// geometry and colour stops.
const describe = (value) =>
  typeof value === "object" && value !== null
    ? (value.recorded ?? "object")
    : String(value);

const number = (n) => String(Math.round(n * 1e6) / 1e6);

const argument = (a) => {
  if (typeof a === "number") {
    return number(a);
  }
  if (typeof a === "object" && a !== null) {
    return a.src ?? describe(a);
  }
  return String(a);
};

const STYLE = [
  "fillStyle",
  "strokeStyle",
  "globalAlpha",
  "font",
  "letterSpacing",
  "textAlign",
  "textBaseline",
  "lineWidth",
];

const DRAWS = new Set([
  "fill",
  "stroke",
  "fillText",
  "strokeText",
  "fillRect",
  "drawImage",
]);

// Records every call on 2D canvases, so drawings can be compared frame by frame. take()
// hands over (and forgets) a hash of the calls since the last take; stop() ends it.
export const recordCanvas = () => {
  let calls = [];
  canvasCalls.listener = (name, args, call, state) => {
    const style = DRAWS.has(name)
      ? ` ${STYLE.map((s) => describe(state[s])).join("|")}`
      : "";
    calls.push(`${name}(${args.map(argument).join(",")})${style}`);
    const result = call();
    if (name === "createLinearGradient" || name === "createRadialGradient") {
      const stops = [];
      return {
        addColorStop: (offset, color) => {
          stops.push(`${number(offset)}:${color}`);
        },
        get recorded() {
          return `${name}(${args.map(argument).join(",")};${stops.join(",")})`;
        },
      };
    }
    return result;
  };
  return {
    take: () => {
      const hash = createHash("sha1")
        .update(calls.join("\n"))
        .digest("hex")
        .slice(0, 10);
      calls = [];
      return hash;
    },
    stop: () => {
      canvasCalls.listener = null;
    },
  };
};

// WebGL calls that place and pick what is drawn; the rest (buffers, uploads) is left out.
const GL_RECORDED = new Set([
  "bindTexture",
  "texImage2D",
  "drawElements",
  "drawArrays",
  "enable",
  "disable",
  "blendFunc",
  "depthFunc",
  "depthMask",
  "viewport",
  "clear",
  "clearColor",
  "useProgram",
]);

// Feeds a WebGL call into the hash: numbers and typed arrays (matrices) as their bytes,
// uniform locations by name, textures by what they show.
const hashGlCall = (hash, name, args) => {
  if (!name.startsWith("uniform") && !GL_RECORDED.has(name)) {
    return false;
  }
  hash.update(name);
  for (const a of args) {
    if (ArrayBuffer.isView(a)) {
      hash.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
    } else if (a !== null && typeof a === "object") {
      hash.update(String(a.uniform ?? a.label ?? a.src ?? "object"));
    } else {
      hash.update(String(a));
    }
    hash.update(",");
  }
  return true;
};

// Records the WebGL calls that decide what the 3D scene shows: every uniform (matrices,
// colours, fog), bound texture and draw call. take() and stop() as in recordCanvas.
export const recordWebGL = () => {
  let hash = createHash("sha1");
  let empty = true;
  glCalls.listener = (name, args) => {
    if (hashGlCall(hash, name, args)) {
      empty = false;
    }
  };
  return {
    take: () => {
      const digest = empty ? "-" : hash.digest("hex").slice(0, 10);
      hash = createHash("sha1");
      empty = true;
      return digest;
    },
    stop: () => {
      glCalls.listener = null;
    },
  };
};
