import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../golden/__golden__",
);

export const shouldUpdateGolden = () => process.env.UPDATE_GOLDEN === "1";

const goldenPath = (name) => join(GOLDEN_DIR, `${name}.json`);

export const readGolden = (name) => {
  const path = goldenPath(name);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
};

export const writeGolden = (name, data) => {
  mkdirSync(GOLDEN_DIR, { recursive: true });
  // Arrays of plain values on one line keep the files short and diffs readable.
  const json = JSON.stringify(data, null, 1).replace(
    /\[([^[\]{}]*)\]/g,
    (_, values) => `[${values.trim().replace(/\s*\n\s*/g, " ")}]`,
  );
  writeFileSync(goldenPath(name), `${json}\n`);
};

// Compares against the stored golden master, or (re)writes it when requested or missing.
// Returns the stored golden data, or null when it was just written.
export const goldenOrWrite = (name, data) => {
  const golden = readGolden(name);
  if (golden === null || shouldUpdateGolden()) {
    writeGolden(name, data);
    return null;
  }
  return golden;
};
