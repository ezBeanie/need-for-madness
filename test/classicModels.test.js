import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseRad } from "../src/classic/rad.js";
import { CAR_FILES } from "../src/classic/cars.js";
import { CAR } from "../src/data/carStats.js";

test("every car has a classic model with four wheels of the original's kind", () => {
  for (const type of Object.values(CAR)) {
    const file = CAR_FILES[type];
    const rad = parseRad(
      readFileSync(`public/data/classic/${file}.rad`, "utf8"),
    );
    // each wheel: a tyre's side, six rim spokes and twelve tread pieces
    expect(rad.polys.filter((p) => p.master == 1)).toHaveLength(4);
    expect(rad.polys.length).toBeGreaterThan(76 + 50);
    expect(rad.grat).toBeGreaterThan(0);
  }
  // the three the original never had have models of their own
  const own = [CAR.tragdor, CAR.iceCream, CAR.shadowRider].map(
    (t) => CAR_FILES[t],
  );
  expect(new Set(own).size).toBe(3);
});
