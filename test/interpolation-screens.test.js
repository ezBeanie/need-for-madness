import { describe, expect, test } from "vitest";
import { drawnMatrix, wheelSlip } from "./harness/drawing.js";
import { openCarSelect, openStageSelect } from "./harness/race.js";

const screens = {
  "car select": () => openCarSelect(),
  "stage select": () => openStageSelect({ stage: 3, car: 5 }),
};

// Counts the draw instances interpolation sees for the first time. On a screen without
// spawning particles, a new one in every tick means a matrix that gets recreated per tick.
const countNewInstances = (ctx) => {
  const states = new WeakMap();
  let created = 0;
  ctx.interpolation.states = {
    get: (mat) => states.get(mat),
    set: (mat, state) => {
      created++;
      return states.set(mat, state);
    },
  };
  return () => created;
};

describe("interpolated drawing in the menus", () => {
  test.each(Object.keys(screens))(
    "%s keeps every drawn instance from tick to tick",
    async (screen) => {
      const { ctx, step } = await screens[screen]();
      ctx.interpolation.alpha = 0.5;
      const created = countNewInstances(ctx);
      for (let i = 0; i < 30; i++) {
        step();
      }
      const afterWarmup = created();
      expect(afterWarmup).toBeGreaterThan(0);
      for (let i = 0; i < 100; i++) {
        step();
      }
      expect(created() - afterWarmup).toBe(0);
    },
  );

  test("wheels stay on the turning car in the car select", async () => {
    const { ctx, step } = await openCarSelect();
    const typ = ctx.game.carTypes[0];
    let worst = 0;
    for (let i = 0; i < 100; i++) {
      step();
      worst = Math.max(
        worst,
        wheelSlip(ctx, typ, ctx.carModels[typ], ctx.whl[typ]),
      );
    }
    expect(worst).toBeLessThan(0.05);
  });

  // bgst is a backdrop placed 106 units in front of the camera every tick. Drawn apart
  // from the camera, it slides out of view while the camera swoops onto the track.
  test("the stage select backdrop stays in front of the swooping camera", async () => {
    const { ctx, step } = await openStageSelect({ stage: 3, car: 5 });
    let worst = 0;
    for (let i = 0; i < 100; i++) {
      step();
      for (const alpha of [0.25, 0.5, 0.75]) {
        ctx.interpolation.alpha = alpha;
        ctx.placeCamera(
          ctx.camera.x,
          ctx.camera.y,
          ctx.camera.z,
          ctx.camera.matrix,
        );
        const drawn = drawnMatrix(ctx, ctx.stageBackdrop, ctx.stageBackdrop);
        worst = Math.max(
          worst,
          Math.abs(Math.hypot(drawn[12], drawn[13], drawn[14]) - 106),
        );
      }
      ctx.interpolation.alpha = 1;
    }
    expect(worst).toBeLessThan(1);
  });
});
