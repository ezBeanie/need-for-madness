import { createHash } from "node:crypto";
import { canvasCalls } from "./browserStubs.js";

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
