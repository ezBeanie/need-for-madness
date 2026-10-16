import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect } from "vitest";
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

// Compares a recording (see recordRace/recordFlow) frame by frame with its golden master
// and reports the first frame where the state differs.
export const expectMatchesGolden = (name, meta, recording) => {
  const golden = goldenOrWrite(name, {
    ...meta,
    frames: recording.frames,
    hashes: recording.hashes.join(" "),
    samples: recording.samples,
  });
  if (golden === null) {
    return;
  }
  const goldenHashes = golden.hashes.split(" ");
  const firstDiff = recording.hashes.findIndex(
    (hash, frame) => hash !== goldenHashes[frame],
  );
  if (firstDiff !== -1) {
    const sampleFrame = Math.floor(firstDiff / 100) * 100;
    expect.fail(
      `state diverges at frame ${firstDiff}.\n` +
        `now:    ${JSON.stringify(recording.states[firstDiff])}\n` +
        `golden sample at frame ${sampleFrame} (now there: ${JSON.stringify(recording.states[sampleFrame])}):\n` +
        `        ${JSON.stringify(golden.samples[sampleFrame])}`,
    );
  }
  expect(recording.frames).toBe(golden.frames);
};

// Compares what was drawn on the 2D canvases, frame by frame, with its golden master.
export const expectDrawingMatchesGolden = (name, recording) => {
  const golden = goldenOrWrite(`${name}-drawing`, {
    frames: recording.frames,
    hashes: recording.drawings.join(" "),
  });
  if (golden === null) {
    return;
  }
  const goldenHashes = golden.hashes.split(" ");
  const firstDiff = recording.drawings.findIndex(
    (hash, frame) => hash !== goldenHashes[frame],
  );
  if (firstDiff !== -1) {
    expect.fail(`the drawing differs from frame ${firstDiff} on`);
  }
  expect(recording.drawings.length).toBe(goldenHashes.length);
};
