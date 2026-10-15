import { readFloat, readInt } from "./values.js";

// The stage format: one command per line, `command(arg,arg,...)suffix`, read in order.
// Order matters: object numbers follow the line order and bnd() applies to the next set().

const int = "int";
const float = "float";
const text = "text";

// Field names and how the game reads them (parseInt or parseFloat), per command.
const COMMANDS = {
  name: [["name", text]],
  tip: [["text", text]],
  nlaps: [["laps", int]],
  addon: [["count", int]],
  distfog: [["distance", int]],
  lightswingX: [["angle", int]],
  lightswingZ: [["angle", int]],
  snap: [
    ["r", int],
    ["g", int],
    ["b", int],
  ],
  sky: [
    ["r", int],
    ["g", int],
    ["b", int],
  ],
  fog: [
    ["r", int],
    ["g", int],
    ["b", int],
  ],
  clouds: [
    ["r", int],
    ["g", int],
    ["b", int],
    ["type", int],
  ],
  ground: [
    ["r", int],
    ["g", int],
    ["b", int],
    ["texture", int],
    ["hue", float],
    ["saturation", float],
  ],
  bnd: [
    ["a", int],
    ["b", int],
    ["c", int],
    ["d", int],
  ],
  set: [
    ["piece", int],
    ["x", float],
    ["z", float],
    ["rotation", float],
  ],
  // y only for air checkpoints
  chk: [
    ["piece", int],
    ["x", float],
    ["z", float],
    ["rotation", float],
    ["y", float],
  ],
  fix: [
    ["piece", int],
    ["x", float],
    ["z", float],
    ["y", float],
    ["rotation", float],
  ],
  maxr: [
    ["count", int],
    ["limit", float],
    ["start", float],
  ],
  maxl: [
    ["count", int],
    ["limit", float],
    ["start", float],
  ],
  maxt: [
    ["count", int],
    ["limit", float],
    ["start", float],
  ],
  maxb: [
    ["count", int],
    ["limit", float],
    ["start", float],
  ],
};

const readField = (raw, type) => {
  if (type === text) {
    return raw;
  }
  return type === int ? readInt(raw) : readFloat(raw);
};

const parseLine = (rawLine) => {
  const line = rawLine.trim();
  const match = line.match(/^([A-Za-z]+)\(/);
  const fields = match && COMMANDS[match[1]];
  if (!fields) {
    return null;
  }
  const body = line.slice(match[0].length);
  const close = body.indexOf(")");
  // Some original stages miss the closing parenthesis; the game reads to the end of line.
  const args = (close === -1 ? body : body.slice(0, close)).split(",");
  const after = close === -1 ? "" : body.slice(close + 1);
  const entry = { command: match[1] };
  fields.forEach(([field, type], i) => {
    if (i < args.length) {
      entry[field] = readField(args[i], type);
    }
  });
  const suffix = after.split("//")[0].trim();
  if (suffix !== "") {
    entry.suffix = suffix;
  }
  return entry;
};

// Returns the stage as the ordered list of its commands, e.g.
// { command: "set", piece: 47, x: 0, z: 0, rotation: 0, suffix: "p" }.
export const parseStage = (source) =>
  source
    .split("\n")
    .map(parseLine)
    .filter((entry) => entry !== null);

const writeEntry = (entry) => {
  const args = COMMANDS[entry.command]
    .filter(([field]) => field in entry)
    .map(([field]) => entry[field]);
  return `${entry.command}(${args.join(",")})${entry.suffix ?? ""}`;
};

export const writeStage = (entries) =>
  `${entries.map(writeEntry).join("\n")}\n`;

// Reads a field like the game does: a missing number counts as -1.
export const valueOf = (entry, field) => entry[field] ?? -1;

// Path points steer the AI and the position ranking; the suffix gives their kind,
// null for a piece that is no path point.
export const pathType = (entry) => {
  const suffix = entry.suffix ?? "";
  if (!suffix.startsWith("p")) {
    return null;
  }
  let type = 0;
  for (const [prefix, kind] of [
    ["pt", -1],
    ["pr", -2],
    ["po", -3],
    ["ph", -4],
  ]) {
    if (suffix.startsWith(prefix)) {
      type = kind;
    }
  }
  return type;
};

export const isSpecialFix = (entry) => (entry.suffix ?? "").startsWith("s");
