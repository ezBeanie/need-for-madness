import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { makePile, pileColor } from "../src/data/pile.js";
import { parseStage } from "../src/data/stageFormat.js";
import {
  COLLECTIONS,
  LAST_STAGE,
  collectionOf,
  firstOfCollection,
  STAGE_COUNT,
  levelOf,
  stageAfter,
  stageBefore,
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
  expect(STAGE_COUNT).toBe(45);
});

test("NFM1's eleventh stage is the original's 27, after its tenth and before NFM2's first", () => {
  expect(originalOf(45)).toBe(27);
  expect(stageLabel(45)).toBe("NFM1 Stage 11");
  expect(stageFile(45)).toBe("data/classic/stages/27.txt");
  expect(collectionOf(45)).toBe(1);
  expect([27, 45, 44].map(stageAfter)).toEqual([45, 28, 0]);
  expect([28, 45, 18].map(stageBefore)).toEqual([45, 27, 17]);
  expect(musicOf(45)).toEqual({ file: "nfm1-stage11", classic: true });
  const loops = JSON.parse(
    readFileSync(
      new URL("../public/data/classic/music/loops.json", import.meta.url),
      "utf8",
    ),
  );
  expect(loops["nfm1-stage11"]).toBeDefined();
});

test("the stage select offers this game's stages, NFM1's and NFM2's as collections", () => {
  expect(COLLECTIONS).toHaveLength(3);
  expect([1, 17, 18, 27, 28, 44].map(collectionOf)).toEqual([0, 0, 1, 1, 2, 2]);
  expect([1, 2].map(firstOfCollection)).toEqual([18, 28]);
});

test("the original's stages get opponents from easy to hard, and their own music", () => {
  expect([18, 27, 45, 28, 44].map(levelOf)).toEqual([1, 15, 16, 1, 16]);
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

// what the original's ContO made of pile(1081,4,6,...) with its Medium's own colours
const originalPile = JSON.parse(
  readFileSync(
    new URL("./fixtures/pile-1081-4-6.json", import.meta.url),
    "utf8",
  ),
);

test("a rock pile has the original's shape and colours", () => {
  const pile = makePile(1081, 4, 6);
  expect(pile.faces.map(({ points }) => points)).toEqual(originalPile.faces);
  expect(pile.maxR).toBe(originalPile.maxR);
  expect(
    pile.faces.map(({ shade }) =>
      pileColor(shade, originalPile.cpol, originalPile.cgrnd),
    ),
  ).toEqual(originalPile.colors);
});

test("the stage select opens again on the original's stage last played, not on this game's last open", async () => {
  const { openCarSelect } = await import("./harness/race.js");
  const { PHASE } = await import("../src/core/state.js");
  const { ctx, key, step, stepUntil } = await openCarSelect();
  ctx.game.unlocked = 17;
  ctx.track.stage = 30;
  for (let i = 0; i < 60; i++) {
    step();
  }
  key(13, true);
  step();
  key(13, false);
  stepUntil(() => ctx.game.phase === PHASE.stageSelect, 300, "stage select");
  expect(ctx.track.stage).toBe(30);
});
