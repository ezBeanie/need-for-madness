// A text too long for one message goes in parts: the relay, and a direct link, take 256 kB
// a message at most, and a race of dented cars can be more.

import { isIndex } from "./link.js";

const PART_LENGTH = 64 * 1024;
const MOST_PARTS = 64;

// The text's parts, each to go in a message of its own.
export const inParts = (text) => {
  const parts = Math.ceil(text.length / PART_LENGTH);
  return Array.from({ length: parts }, (_, part) => ({
    part,
    parts,
    text: text.slice(part * PART_LENGTH, (part + 1) * PART_LENGTH),
  }));
};

// A part that came, kept with the others in `kept` (a list): the whole text once all came,
// else null. (Checked: another game sent it.)
export const joinPart = (kept, { part, parts, text }) => {
  if (
    !Number.isInteger(parts) ||
    parts > MOST_PARTS ||
    !isIndex(part, parts) ||
    typeof text != "string"
  ) {
    return null;
  }
  kept[part] = text;
  if (kept.filter((given) => given !== undefined).length != parts) {
    return null;
  }
  const whole = kept.join("");
  kept.length = 0;
  return whole;
};
