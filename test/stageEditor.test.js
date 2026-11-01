import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseModel } from "../src/data/modelFormat.js";
import {
  boxOf,
  endsOf,
  extents,
  newObject,
  onMap,
  readEditedStage,
  shapeOf,
  snapToEnds,
  writeEditedStage,
} from "../src/editor/stageModel.js";
import { startRace } from "./harness/race.js";

const read = (path) =>
  readFileSync(new URL(`../public/${path}`, import.meta.url), "utf8");

const PIECE_FILES = read("../src/loading/assets.js")
  .split("PIECE_FILES = [")[1]
  .split("];")[0]
  .match(/"[a-z0-9]+"/g)
  .map((name) => name.slice(1, -1));

const models = new Map();
PIECE_FILES.forEach((file, i) => {
  const parsed = parseModel(read(`data/3D/${file}.r3d`));
  models.set(i + 10, parsed);
  extents.set(i + 10, shapeOf(parsed).extent);
});

test("the editor's map puts every point of a piece where the game puts it", async () => {
  const { ctx } = await startRace({ stage: 3, car: 5 });
  const { objects } = readEditedStage(read("data/stages/3.txt"));
  let compared = 0;
  objects.forEach((object, i) => {
    const piece = ctx.pieces.list[i];
    // (rock piles are no models; the fix hoops spin in the race)
    if (object.command == "pile" || object.command == "fix") {
      return;
    }
    expect(piece.typ + 10).toBe(object.piece);
    const v = models.get(object.piece).vertices;
    for (let k = 0; k < v.length; k += 3 * 7) {
      // the game: the model built mirrored, turned, then moved, and the file mirrored again
      const x = -v[k];
      const z = v[k + 2];
      const m = piece.mat;
      const worldX = piece.x + m[0] * x + m[8] * z;
      const worldZ = piece.z + m[2] * x + m[10] * z;
      const point = onMap(object, v[k], v[k + 2]);
      expect(point.x).toBeCloseTo(-worldX * 10, 3);
      expect(point.z).toBeCloseTo(worldZ * 10, 3);
      compared++;
    }
  });
  expect(compared).toBeGreaterThan(500);
});

test("a stage written by the editor is the stage it read, walls around it worked out anew", async () => {
  const text = read("data/stages/3.txt");
  const written = writeEditedStage(readEditedStage(text));
  const { parseStage } = await import("../src/data/stageFormat.js");
  const objects = (source) =>
    parseStage(source).filter((e) =>
      ["set", "chk", "fix", "pile", "bnd"].includes(e.command),
    );
  expect(objects(written)).toEqual(objects(text));
  const settings = (source) =>
    parseStage(source).filter((e) =>
      ["name", "nlaps", "sky", "fog", "ground", "clouds", "tip"].includes(
        e.command,
      ),
    );
  expect(settings(written)).toEqual(settings(text));
  // the walls stand around every object
  const walls = Object.fromEntries(
    parseStage(written)
      .filter((e) => e.command.startsWith("max"))
      .map((e) => [e.command, e]),
  );
  for (const object of readEditedStage(text).objects) {
    const box = boxOf(object);
    expect(box.left).toBeGreaterThan(walls.maxl.limit);
    expect(box.right).toBeLessThan(walls.maxr.limit);
    expect(box.bottom).toBeGreaterThan(walls.maxb.limit);
    expect(box.top).toBeLessThan(walls.maxt.limit);
  }
  // whole wall pieces, meeting at the corners
  expect(walls.maxr.limit - walls.maxl.limit).toBe(walls.maxt.count * 4800);
  expect(walls.maxt.limit - walls.maxb.limit).toBe(walls.maxr.count * 4800);
  expect(walls.maxr.start).toBe(walls.maxb.limit + 2400);
});

test("a piece dropped near another's end joins it end to end, facing it", () => {
  const start = newObject(47, 0, 0, 0);
  // a road a little off the start's front end
  const road = newObject(10, 230, 5900, 0);
  expect(snapToEnds(road, [start], 1000)).toEqual({ x: 0, z: 5600 });
  // too far
  expect(snapToEnds(road, [start], 100)).toBe(null);
  // a turn joins at its back, and the next road at the turn's side
  const turn = newObject(14, 0, 4500, 0);
  const joined = snapToEnds(turn, [start], 1000);
  expect(joined.x).toBeCloseTo(0);
  expect(joined.z).toBeCloseTo(2800 + 1750);
  Object.assign(turn, joined);
  const side = endsOf(turn)[1];
  const across = newObject(10, side.x + 3000, side.z + 200, 90);
  const next = snapToEnds(across, [start, turn], 1000);
  const ends = endsOf({ ...across, ...next });
  expect(
    ends.some((end) => Math.hypot(end.x - side.x, end.z - side.z) < 1e-6),
  ).toBe(true);
});

test("a new piece gets the command and the path point the original's stages mostly give it", () => {
  expect(newObject(10, 0, 0, 0).suffix).toBe("p");
  expect(newObject(14, 0, 0, 0).suffix).toBe("pt");
  expect(newObject(26, 0, 0, 0).suffix).toBe("pr");
  expect(newObject(36, 0, 0, 0).suffix).toBe("ph");
  expect(newObject(65, 0, 0, 0).suffix).toBeUndefined();
  expect(newObject(40, 0, 0, 0).command).toBe("chk");
  expect(newObject(41, 0, 0, 0)).toMatchObject({ command: "fix", y: -1200 });
});
