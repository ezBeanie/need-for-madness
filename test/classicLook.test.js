import { expect, test } from "vitest";
import { glCalls } from "./harness/browserStubs.js";
import { startRace } from "./harness/race.js";

test("L switches to the classic look, outlined faces in fewer pixels, and back", async () => {
  const { ctx, step, key } = await startRace({ stage: 1, car: 5 });
  const drawModes = () => {
    const modes = [];
    glCalls.listener = (name, args) => {
      if (name === "drawElements") {
        modes.push(args[0]);
      }
    };
    step();
    glCalls.listener = null;
    return modes;
  };
  const pressL = () => {
    key(76, true);
    key(76, false);
  };
  expect(drawModes()).not.toContain(ctx.gl.LINES);

  pressL();
  expect(ctx.look.current).toBe(ctx.LOOK.classic);
  // the original drew into 800 x 450 pixels
  expect(ctx.canvas3D.height).toBe(450);
  const classic = drawModes();
  expect(classic).toContain(ctx.gl.LINES);
  expect(classic).toContain(ctx.gl.TRIANGLES);

  pressL();
  expect(ctx.look.current).toBe(ctx.LOOK.modern);
  expect(ctx.canvas3D.height).toBe(ctx.view.height);
  expect(drawModes()).not.toContain(ctx.gl.LINES);
});
