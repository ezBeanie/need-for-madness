import { describe, test } from "vitest";
import { recordCanvas, recordWebGL } from "../harness/canvasRecorder.js";
import { expectDrawingMatchesGolden } from "../harness/golden.js";
import { startRace } from "../harness/race.js";

// Loading makes textures, wheels and sparks itself, with random numbers, and uploads them
// before any race is recorded: everything it draws and uploads, up to the start of a race.
describe("loading matches the golden master", () => {
  test.each([1, 7, 16])("stage %i", async (stage) => {
    const canvas = recordCanvas();
    const webgl = recordWebGL({ everything: true });
    await startRace({ stage, car: 15 });
    const recording = { drawings: [canvas.take()], scenes: [webgl.take()] };
    canvas.stop();
    webgl.stop();
    expectDrawingMatchesGolden(
      `loading-stage-${String(stage).padStart(2, "0")}`,
      recording,
    );
  });
});
