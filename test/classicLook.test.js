import { expect, test } from "vitest";
import { glCalls } from "./harness/browserStubs.js";
import { openCarSelect, openStageSelect, startRace } from "./harness/race.js";

test("L switches a race to the original game's look and back", async () => {
  const { ctx, step, key } = await startRace({ stage: 1, car: 5 });
  const pressL = () => {
    key(76, true);
    key(76, false);
  };
  // the vertices of the classic look's one draw call in a frame (it paints everything,
  // in order, as triangles), or 0
  const classicVertices = () => {
    let vertices = 0;
    glCalls.listener = (name, args) => {
      if (name === "drawArrays") {
        vertices = args[2];
      }
    };
    step();
    glCalls.listener = null;
    return vertices;
  };
  expect(classicVertices()).toBe(0);

  pressL();
  expect(ctx.look.current).toBe(ctx.LOOK.classic);
  // the original drew into 800 x 450 pixels
  expect(ctx.canvas3D.height).toBe(450);
  // the original's models arrive, then the sky, the ground and the stage's polygons
  for (let i = 0; i < 5; i++) {
    step();
  }
  expect(classicVertices()).toBeGreaterThan(1000);

  pressL();
  expect(ctx.look.current).toBe(ctx.LOOK.modern);
  expect(classicVertices()).toBe(0);
});

test("the car select and the stage select show the original game's models too", async () => {
  for (const open of [
    () => openCarSelect(),
    () => openStageSelect({ stage: 3, car: 5 }),
  ]) {
    const { ctx, step, key } = await open();
    key(76, true);
    key(76, false);
    expect(ctx.look.current).toBe(ctx.LOOK.classic);
    // menus are drawn again only when something moves: the biggest draw over a while
    let vertices = 0;
    glCalls.listener = (name, args) => {
      if (name === "drawArrays") {
        vertices = Math.max(vertices, args[2]);
      }
    };
    for (let i = 0; i < 40; i++) {
      step();
    }
    glCalls.listener = null;
    expect(vertices).toBeGreaterThan(100);
  }
});

test("the classic look draws sparks and dust the original's way", async () => {
  const { ctx, step, key } = await startRace({ stage: 1, car: 5 });
  key(76, true);
  key(76, false);
  for (let i = 0; i < 5; i++) {
    step();
  }
  const vertices = () => {
    let count = 0;
    glCalls.listener = (name, args) => {
      if (name === "drawArrays") {
        count = Math.max(count, args[2]);
      }
    };
    ctx.render();
    glCalls.listener = null;
    return count;
  };
  const before = vertices();
  // a spark and a dust cloud right in front of the camera
  const car = ctx.car[0];
  ctx.sprks(car.typ, car.x, car.y, car.z, 30, 0, 30, 0);
  ctx.dustup(0, 0, 0, car.x, car.y, car.z, 40, 40, 1, 0, false);
  expect(vertices()).toBeGreaterThan(before);
});
