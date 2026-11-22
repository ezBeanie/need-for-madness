import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { CHANGELOG, VERSION } from "../src/data/changelog.js";

const numbers = (version) => version.split(".").map(Number);

// (a version changing nothing a player sees has no entry: the steps may skip one)
const before = (a, b) => {
  const [major, minor, patch] = numbers(a);
  const [major0, minor0, patch0] = numbers(b);
  return major == major0 && (minor == minor0 ? patch < patch0 : minor < minor0);
};

test("the changelog's versions go down from the game's, the middle or last number stepping up", () => {
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  expect(VERSION).toBe(version);
  expect(
    CHANGELOG[0].version == VERSION || before(CHANGELOG[0].version, VERSION),
  ).toBe(true);
  for (let i = 1; i < CHANGELOG.length; i++) {
    expect(before(CHANGELOG[i].version, CHANGELOG[i - 1].version)).toBe(true);
  }
  for (const { date, changes } of CHANGELOG) {
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(changes.length).toBeGreaterThan(0);
  }
});
