import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  isSpecialFix,
  parseStage,
  pathType,
  valueOf,
  writeStage,
} from "../src/data/stageFormat.js";

const stageSource = (stage) =>
  readFileSync(
    new URL(`../public/data/stages/${stage}.txt`, import.meta.url),
    "utf8",
  );

describe("stage format", () => {
  test("reads commands with typed, named fields and their suffix", () => {
    expect(
      parseStage("name(Introductory Stage)\nset(47,0,5600.5,180)pr\n"),
    ).toEqual([
      { command: "name", name: "Introductory Stage" },
      {
        command: "set",
        piece: 47,
        x: 0,
        z: 5600.5,
        rotation: 180,
        suffix: "pr",
      },
    ]);
  });

  test("reads integer fields like the game: parseInt, -1 when missing", () => {
    const [sky] = parseStage("sky(120.7,,abc)");
    expect(sky).toEqual({ command: "sky", r: 120, g: -1, b: -1 });
  });

  test("ignores comments, blank lines and unknown lines", () => {
    expect(
      parseStage("// a stage\n\nfog(240,190,141) //221,190,141\nfoo(1)\r\n"),
    ).toEqual([{ command: "fog", r: 240, g: 190, b: 141 }]);
  });

  test("reads a line without closing parenthesis to its end", () => {
    expect(parseStage("set(22,0,21280,0")).toEqual([
      { command: "set", piece: 22, x: 0, z: 21280, rotation: 0 },
    ]);
  });

  test("tells path points, their kind and special fix points apart", () => {
    const [plain, p, pr, pt, po, pl, fix, special] = parseStage(
      [
        "set(10,0,0,0)",
        "set(10,0,0,0)p",
        "set(10,0,0,0)pr",
        "set(10,0,0,0)pt",
        "set(10,0,0,0)po",
        "set(10,0,0,0)pl",
        "fix(41,0,0,0,0)",
        "fix(41,0,0,0,0)s",
      ].join("\n"),
    );
    expect([plain, p, pr, pt, po, pl].map(pathType)).toEqual([
      null,
      0,
      -2,
      -1,
      -3,
      0,
    ]);
    expect([fix, special].map(isSpecialFix)).toEqual([false, true]);
  });

  test("a missing optional field counts as -1", () => {
    const [checkpoint] = parseStage("chk(40,0,29000,0)");
    expect(valueOf(checkpoint, "y")).toBe(-1);
  });

  test.each(Array.from({ length: 17 }, (_, i) => i + 1))(
    "stage %i survives writing and reading again",
    (stage) => {
      const entries = parseStage(stageSource(stage));
      expect(entries.length).toBeGreaterThan(50);
      expect(parseStage(writeStage(entries))).toEqual(entries);
    },
  );
});
