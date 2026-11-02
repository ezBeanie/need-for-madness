import { expect, test } from "vitest";
import { glCalls } from "./harness/browserStubs.js";
import { startRace } from "./harness/race.js";

test("a race restored keeps the bodies of its cars not dented yet", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  step();
  ctx.restoreRace(ctx.saveRace());
  const uploads = [];
  glCalls.listener = (name, args) => {
    if (name === "bufferData" && args[1] instanceof Float32Array) {
      uploads.push(args[1].length);
    }
  };
  step();
  glCalls.listener = null;
  expect(uploads.length).toBeGreaterThan(0);
  expect(uploads).not.toContain(0);
});
