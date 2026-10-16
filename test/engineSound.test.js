import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { racingAutopilot, startRace } from "./harness/race.js";

// The engine's pitch and volume, frame by frame, while driving with jumps, handbrake skids
// and braking: on the ground through the gears, slipping, and revving in the air.
test.each([1, 2, 5, 9])("the engine sound of stage %i", async (stage) => {
  const { ctx, step } = await startRace({ stage, car: stage + 3 });
  const { engine } = await import("../src/audio/audio.js");
  const drive = racingAutopilot();
  const sounds = [];
  for (let frame = 0; frame < 1500; frame++) {
    const input = drive(ctx);
    if (frame % 300 > 250) {
      input.handb = true;
    }
    if (frame % 400 > 350) {
      input.up = false;
      input.down = true;
    }
    Object.assign(ctx.racers[0].u, input);
    step();
    sounds.push(
      `${engine.source?.playbackRate?.value},${engine.volume?.gain?.value}`,
    );
  }
  expect(new Set(sounds).size).toBeGreaterThan(100);
  expect(
    createHash("sha1").update(sounds.join("\n")).digest("hex"),
  ).toMatchSnapshot();
});
