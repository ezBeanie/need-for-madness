import { expect, test } from "vitest";
import { canvasCalls, glCalls } from "./harness/browserStubs.js";
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

test("with the original's menus the car select and the stage select show its models too", async () => {
  for (const open of [
    () => openCarSelect(),
    () => openStageSelect({ stage: 3, car: 5 }),
  ]) {
    const { ctx, step, key } = await open();
    key(76, true);
    key(76, false);
    key(85, true);
    key(85, false);
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

test("a hit dents the classic car model and fades its polygons, as the original did", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  const { readFileSync } = await import("node:fs");
  const rad = ctx.parseRad(
    readFileSync("public/data/classic/maxrevenge.rad", "utf8"),
  );
  ctx.tintModel(rad, () => 0.5);
  const before = JSON.stringify(rad.polys.map((p) => p.points));
  for (let i = 0; i < 6; i++) {
    ctx.dentClassic(rad, ctx.hitOn(0, ctx.HIT.alongX, 0, 300));
  }
  expect(JSON.stringify(rad.polys.map((p) => p.points))).not.toBe(before);
  const faded = rad.polys.filter((p) => p.bfase > 40);
  expect(faded.length).toBeGreaterThan(0);
  // brown: the original's hue for badly dented polygons
  expect(faded.every((p) => p.nocol || p.glass == 1 || p.hsb[0] < 0.08)).toBe(
    true,
  );
});

test("in the classic look a wrecked car burns and a car being fixed shows its bubble", async () => {
  const { ctx, step, key } = await startRace({ stage: 1, car: 5 });
  key(76, true);
  key(76, false);
  // how many vertices of the classic batch have a colour that test likes (r, g, b)
  const colored = (likes, frames = 1) => {
    let found = 0;
    glCalls.listener = (name, args) => {
      if (name === "bufferData" && args[1] instanceof Float32Array) {
        const words = new Uint32Array(
          args[1].buffer,
          args[1].byteOffset,
          args[1].length,
        );
        for (let i = 3; i < words.length; i += 4) {
          const w = words[i];
          if (likes(w & 255, (w >> 8) & 255, (w >> 16) & 255)) {
            found++;
          }
        }
      }
    };
    for (let i = 0; i < frames; i++) {
      step();
    }
    glCalls.listener = null;
    return found;
  };
  const bubble = (r, g, b) => r > 180 && g > 225 && b > 240;
  const flame = (r, g, b) =>
    r == 255 && g > 160 && g < 215 && b > 75 && b < 145;
  colored(() => false, 5);
  expect(colored(bubble)).toBe(0);
  ctx.car[0].fcnt = 20;
  expect(colored(bubble)).toBeGreaterThan(0);
  colored(() => false, 20);
  for (let i = 0; i < 8; i++) {
    ctx.regn(i % 2, i % 4, 300, 0);
  }
  expect(colored(flame)).toBe(0);
  ctx.racers[0].damage = 9999;
  // flames from the wreck's sixteenth tick on
  expect(colored(flame, 25)).toBeGreaterThan(0);
});

test("with the original's menus a race in the classic look shows its HUD", async () => {
  const { ctx, step, key } = await startRace({ stage: 1, car: 5 });
  for (let i = 0; i < 300 && ctx.raceEvents.countdown > 0; i++) {
    step();
  }
  const texts = () => {
    const drawn = [];
    canvasCalls.listener = (name, args, call) => {
      if (name === "fillText") {
        drawn.push(args[0]);
      }
      return call();
    };
    step();
    canvasCalls.listener = null;
    return drawn;
  };
  // the modern laps read 1/3, the original's 1 / 3
  const laps = `1 / ${ctx.track.nlaps}`;
  expect(texts()).toContain(`1/${ctx.track.nlaps}`);
  key(76, true);
  key(76, false);
  key(85, true);
  key(85, false);
  const classic = texts();
  expect(classic).toContain(laps);
  // its labels are pictures
  expect(classic).not.toContain("Lap");
});

test("with the original's menus the car select and the stage select are its screens", async () => {
  const texts = (step, ticks) => {
    const drawn = [];
    canvasCalls.listener = (name, args, call) => {
      if (name === "fillText") {
        drawn.push(args[0]);
      }
      return call();
    };
    for (let i = 0; i < ticks; i++) {
      step();
    }
    canvasCalls.listener = null;
    return drawn;
  };
  {
    const { ctx, step, key } = await openCarSelect();
    key(76, true);
    key(76, false);
    key(85, true);
    key(85, false);
    // the strengths show once the smoke has blown through
    const drawn = texts(step, 60);
    expect(drawn).toContain(ctx.carStats.names[ctx.game.carTypes[0]]);
    expect(drawn).toContain("Top Speed:");
  }
  {
    const { ctx, step, key } = await openStageSelect({ stage: 3, car: 5 });
    key(76, true);
    key(76, false);
    key(85, true);
    key(85, false);
    const drawn = texts(step, 5);
    expect(drawn).toContain("Stage 3  >");
    expect(drawn).toContain(`| ${ctx.track.name} |`);
  }
});

test("in the classic look the menus and the race HUD stay the game's own, the 3D world and the menus' models being the original's", async () => {
  const classicVertices = (ctx, step, ticks) => {
    let vertices = 0;
    glCalls.listener = (name, args) => {
      if (name === "drawArrays") {
        vertices = Math.max(vertices, args[2]);
      }
    };
    for (let i = 0; i < ticks; i++) {
      step();
    }
    glCalls.listener = null;
    return vertices;
  };
  for (const open of [
    () => openCarSelect(),
    () => openStageSelect({ stage: 3, car: 5 }),
  ]) {
    const { ctx, step, key } = await open();
    key(76, true);
    key(76, false);
    expect(ctx.look.current).toBe(ctx.LOOK.classic);
    // the original's car or stage over the game's own backdrop, in the window's pixels
    expect(classicVertices(ctx, step, 40)).toBeGreaterThan(100);
    expect(ctx.canvas3D.height).toBe(ctx.view.height);
  }
  const { ctx, step, key } = await startRace({ stage: 1, car: 5 });
  key(76, true);
  key(76, false);
  for (let i = 0; i < 300 && ctx.raceEvents.countdown > 0; i++) {
    step();
  }
  expect(classicVertices(ctx, step, 5)).toBeGreaterThan(1000);
  expect(ctx.canvas3D.height).toBe(450);
  const drawn = [];
  canvasCalls.listener = (name, args, call) => {
    if (name === "fillText") {
      drawn.push(args[0]);
    }
    return call();
  };
  step();
  canvasCalls.listener = null;
  expect(drawn).toContain(`1/${ctx.track.nlaps}`);
});

test("in the classic look the countdown shows the original's Insano", async () => {
  const insanoPictures = async (classic) => {
    const { ctx, step, key } = await startRace({ stage: 1, car: 5 });
    if (classic) {
      key(76, true);
      key(76, false);
    }
    const drawn = new Set();
    canvasCalls.listener = (name, args, call) => {
      if (name === "drawImage") {
        drawn.add(args[0]);
      }
      return call();
    };
    for (let i = 0; i < 300 && ctx.raceEvents.countdown > 0; i++) {
      step();
    }
    canvasCalls.listener = null;
    const pictures = [];
    if (ctx.images.insano.some((picture) => drawn.has(picture))) {
      pictures.push("modern");
    }
    if ([0, 1, 2].some((face) => drawn.has(ctx.classicInsanoPicture(face)))) {
      pictures.push("classic");
    }
    return pictures;
  };
  expect(await insanoPictures(false)).toEqual(["modern"]);
  expect(await insanoPictures(true)).toEqual(["classic"]);
});
