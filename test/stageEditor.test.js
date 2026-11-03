import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseModel } from "../src/data/modelFormat.js";
import {
  boxOf,
  copyLook,
  endsOf,
  extents,
  isPathPoint,
  moveAfter,
  newObject,
  onMap,
  orderPathByPlace,
  placeInOrder,
  problemsOf,
  readEditedStage,
  reversePath,
  setSetting,
  settingOf,
  shapeOf,
  snapToEnds,
  stepAlongPath,
  turned,
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
  expect(snapToEnds(road, [start], 1000)).toEqual({
    x: 0,
    z: 5600,
    other: start,
    atFront: true,
  });
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

test("a piece joined to another's front follows it on the path, one joined to its back comes before it", () => {
  const start = newObject(47, 0, 0, 0);
  const ahead = newObject(10, 0, 11200, 0);
  const objects = [start, ahead];
  // a road between the two, joined to the start's front
  const between = newObject(10, 30, 5650, 0);
  placeInOrder(objects, between, snapToEnds(between, [start], 100));
  expect(objects).toEqual([start, between, ahead]);
  // a road behind the start, joined to its back
  const behind = newObject(10, 0, -5600, 0);
  placeInOrder(objects, behind, snapToEnds(behind, [start], 100));
  expect(objects[0]).toBe(behind);
  // a checkpoint right after the road it stands on, a tree last
  const checkpoint = newObject(40, 0, 5600, 0);
  expect(placeInOrder(objects, checkpoint, null)).toBe(3);
  const tree = newObject(65, 9000, 0, 0);
  expect(placeInOrder(objects, tree, null)).toBe(5);
});

test("the path's order changes a step at a time or by moving a piece after another", () => {
  const [a, b, tree, c] = [
    newObject(47, 0, 0, 0),
    newObject(10, 0, 5600, 0),
    newObject(65, 900, 0, 0),
    newObject(10, 0, 11200, 0),
  ];
  const objects = [a, b, tree, c];
  // a step along the path passes over what is not on it
  expect(stepAlongPath(objects, 1, 1)).toBe(3);
  expect(objects).toEqual([a, c, tree, b]);
  expect(stepAlongPath(objects, 0, -1)).toBe(0);
  expect(moveAfter(objects, 3, -1)).toBe(0);
  expect(objects).toEqual([b, a, c, tree]);
  expect(moveAfter(objects, 0, 2)).toBe(2);
  expect(objects).toEqual([a, c, b, tree]);
});

test("the path turns round from the start, or is ordered by where its points lie, the rest staying put", () => {
  // a square lap: start, then the corners in a muddled order, a tree among them
  const start = newObject(47, 0, 0, 0);
  const north = newObject(10, 0, 10000, 0);
  const corner = newObject(14, 10000, 10000, 0);
  const east = newObject(10, 10000, 0, 0);
  const tree = newObject(65, 5000, 5000, 0);
  const objects = [start, east, tree, north, corner];
  orderPathByPlace(objects);
  expect(objects).toEqual([start, east, tree, corner, north]);
  reversePath(objects);
  expect(objects).toEqual([start, north, tree, corner, east]);
  // (no path, nothing to do)
  const scenery = [tree];
  reversePath(scenery);
  orderPathByPlace(scenery);
  expect(scenery).toEqual([tree]);
});

test("a fix hoop is no point of the path, the drivers head for it by where it is", () => {
  const [start, hoop, road] = [
    newObject(47, 0, 0, 0),
    newObject(41, 0, 2800, 0),
    newObject(10, 0, 5600, 0),
  ];
  expect([start, hoop, road].map(isPathPoint)).toEqual([true, false, true]);
  const objects = [start, hoop, road];
  expect(stepAlongPath(objects, 0, 1)).toBe(2);
});

test("the editor names what keeps a stage from racing", () => {
  const texts = (objects) => problemsOf({ objects }).map((p) => p.text);
  expect(texts([])).toEqual([
    "No road under the start grid in the middle of the map.",
    "A lap needs at least one checkpoint.",
    "The path needs at least three points to go round.",
  ]);
  const loop = [
    newObject(10, 0, 0, 0),
    newObject(10, 0, 5600, 0),
    newObject(40, 0, 5600, 0),
  ];
  expect(texts(loop)).toEqual(["The path should begin on a start piece."]);
  // the stages of the game have none
  for (const stage of [1, 3, 10]) {
    expect(
      texts(readEditedStage(read(`data/stages/${stage}.txt`)).objects),
    ).toEqual([]);
  }
});

test("turning a piece keeps its rotation as the stage files have it, sideways only as 90 or -90", () => {
  expect([0, 90, 180, -90].map((r) => turned(r, 90))).toEqual([
    90, 180, -90, 0,
  ]);
  expect([0, -90, 180, 90].map((r) => turned(r, -90))).toEqual([
    -90, 180, 90, 0,
  ]);
  expect(turned(undefined, 90)).toBe(90);
  // the original's few other angles turn on from where they are
  expect(turned(30, 90)).toBe(120);
  expect(turned(150, 90)).toBe(-120);
});

test("a stage's settings change field by field, and its look comes from another stage", () => {
  const stage = readEditedStage(read("data/stages/1.txt"));
  setSetting(stage, "nlaps", { laps: 5 });
  setSetting(stage, "level", { level: 12 });
  setSetting(stage, "ground", { r: 10, g: 20, b: 30 });
  expect(settingOf(stage, "nlaps").laps).toBe(5);
  expect(settingOf(stage, "level").level).toBe(12);
  // (the ground's texture stays)
  expect(settingOf(stage, "ground")).toMatchObject({
    r: 10,
    g: 20,
    b: 30,
    texture: 2,
  });
  copyLook(stage, read("data/stages/17.txt"));
  const sky17 = settingOf(readEditedStage(read("data/stages/17.txt")), "sky");
  expect(settingOf(stage, "sky")).toEqual(sky17);
  expect(settingOf(stage, "ground").r).toBe(201);
  // the name, laps and level stay the stage's own
  expect(settingOf(stage, "name").name).toBe("Introductory Stage");
  expect(settingOf(stage, "nlaps").laps).toBe(5);
  expect(settingOf(stage, "level").level).toBe(12);
  // stage 1 swings its light nowhere, stage 17 neither: none left over
  expect(stage.settings.filter((e) => e.command == "sky")).toHaveLength(1);
});
