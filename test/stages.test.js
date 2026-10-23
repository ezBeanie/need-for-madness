import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseStage } from "../src/data/stageFormat.js";
import {
  LAST_STAGE,
  STAGE_COUNT,
  levelOf,
  musicOf,
  originalOf,
  stageFile,
  stageLabel,
} from "../src/data/stages.js";

test("after this game's stages come the original's of Need for Madness 1 and 2", () => {
  expect([1, 17, 18, 27, 28, 44].map(originalOf)).toEqual([
    0, 0, 1, 10, 11, 27,
  ]);
  expect([1, 18, 27, 28, 44].map(stageLabel)).toEqual([
    "Stage 1",
    "NFM1 Stage 1",
    "NFM1 Stage 10",
    "NFM2 Stage 1",
    "NFM2 Stage 17",
  ]);
  expect(stageFile(3)).toBe("data/stages/3.txt");
  expect(stageFile(28)).toBe("data/classic/stages/11.txt");
  expect(STAGE_COUNT).toBe(44);
});

test("the original's stages get opponents from easy to hard, and their own music", () => {
  expect([18, 27, 28, 44].map(levelOf)).toEqual([1, 16, 1, 16]);
  expect(levelOf(5)).toBe(5);
  expect([5, 18, 27, 28, 44].map(musicOf)).toEqual([
    { file: "stage5", classic: false },
    { file: "nfm1-stage1", classic: true },
    { file: "nfm1-stage10", classic: true },
    { file: "stage1", classic: true },
    { file: "stage17", classic: true },
  ]);
});

// the pieces this game has: the file counts from 10 (see PIECE_FILES); the original's
// net (51) this game does not have
const knownPiece = (piece) => piece >= 10 && piece <= 75 && piece != 51;

test("every original stage names only pieces this game has", () => {
  for (let stage = LAST_STAGE + 1; stage <= STAGE_COUNT; stage++) {
    const source = readFileSync(
      new URL(`../public/${stageFile(stage)}`, import.meta.url),
      "utf8",
    );
    const entries = parseStage(source);
    const pieces = entries
      .filter(({ command }) => ["set", "chk", "fix"].includes(command))
      .map(({ piece }) => piece);
    expect(
      pieces.filter((piece) => !knownPiece(piece)),
      stageLabel(stage),
    ).toEqual([]);
    expect(entries.some(({ command }) => command == "nlaps")).toBe(true);
  }
});
