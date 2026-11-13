import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { CHANGELOG, VERSION } from "../src/data/changelog.js";

const numbers = (version) => version.split(".").map(Number);

test("the changelog's versions go down from the game's, each a step of the middle or last number", () => {
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  expect(VERSION).toBe(version);
  for (let i = 1; i < CHANGELOG.length; i++) {
    const [major, minor, patch] = numbers(CHANGELOG[i - 1].version);
    const [major0, minor0, patch0] = numbers(CHANGELOG[i].version);
    expect(major).toBe(major0);
    expect(
      (minor == minor0 + 1 && patch == 0) ||
        (minor == minor0 && patch == patch0 + 1),
    ).toBe(true);
  }
  for (const { date, changes } of CHANGELOG) {
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(changes.length).toBeGreaterThan(0);
  }
});
