// The race in the classic look: the original game's own models drawn the original's way
// (see draw.js) onto a canvas of its own, 450 pixels high, where the modern look's 3D
// canvas is. The game logic, the camera and the HUD stay the same.
import { game } from "../core/state.js";
import { carStats } from "../data/carStats.js";
import { raceEvents } from "../race/events.js";
import { car } from "../race/racers.js";
import { pieceModels, pieces, track } from "../race/track.js";
import { drawCamera, drawMatrix, placeModel } from "../render/interpolation.js";
import { fetchText } from "../render/models.js";
import { canvas3D } from "../render/renderer.js";
import { scene } from "../render/scene.js";
import { PIECE_FILES } from "../loading/assets.js";
import { flushBatch, startBatch } from "./batch.js";
import { CAR_FILES } from "./cars.js";
import { drawObject, setView, tintModel } from "./draw.js";
import { drawSkyAndGround, medium, setStageLook } from "./medium.js";
import { drawScenery, newScenery } from "./scenery.js";
import { parseRad } from "./rad.js";

// pieces the original has under another name
const PIECE_STAND_INS = { takeoffb: "takeoff" };

// the parsed models by file name
const models = new Map();
// each car's own copy of its model: the order its polygons are drawn in is its own
const carModels = [];
let loading = false;

const loadModels = () => {
  loading = true;
  const files = new Set([
    ...Object.values(CAR_FILES),
    ...PIECE_FILES.map((file) => PIECE_STAND_INS[file] ?? file),
  ]);
  for (const file of files) {
    fetchText(`data/classic/${file}.rad`, (text) => {
      models.set(file, parseRad(text));
      carModels.length = 0;
      tintedFor = null;
    });
  }
};

// the stage the models are tinted for
let tintedFor = null;

// a fixed sequence for the original's random rock colours, the same on every load
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

const tintForStage = (colors) => {
  setStageLook({
    snap: colors.snap,
    sky: colors.sky,
    ground: colors.ground,
    fog: colors.fog,
    clouds: colors.clouds,
    // the modern look sees farther; the original's fog starts at most at 8000
    fadefrom: Math.min(8000, Math.round(colors.distance * 0.8)),
  });
  const randomness = seeded(7);
  for (const rad of models.values()) {
    tintModel(rad, randomness);
  }
  // the stage's bounds and roads, in the original's units
  const xBounds = [-10 * track.liml, -10 * track.limr];
  const zBounds = [10 * track.limb, 10 * track.limt];
  const roads = [];
  for (let i = 0; i < pieces.count; i++) {
    const piece = pieces.list[i];
    if (pieceModels[piece.typ].skid != -1) {
      roads.push({
        x: -10 * piece.x,
        z: 10 * piece.z,
        radx: 10 * piece.bx,
        radz: 10 * piece.bz,
      });
    }
  }
  newScenery({
    minX: Math.min(...xBounds),
    maxX: Math.max(...xBounds),
    minZ: Math.min(...zBounds),
    maxZ: Math.max(...zBounds),
    seed: pieces.count,
    roads,
    randomness: seeded(pieces.count * 31 + 7),
  });
  carModels.length = 0;
  tintedFor = colors;
};

// The classic look draws on the 3D canvas, made 450 pixels high (see fitCanvas3D).
const fitScreen = () => {
  medium.w = canvas3D.width;
  medium.h = canvas3D.height;
  medium.cx = medium.w / 2;
  medium.cy = medium.h / 2;
};

// how far each object was last frame: the original draws the farthest first by that
const lastDist = new WeakMap();

// The matrix the modern look would draw the instance with (its moves smoothed between
// ticks, the camera's position taken off).
const matrixOf = (instance) => {
  placeModel(instance);
  return Float32Array.from(drawMatrix);
};

// before any stage: the original's own colours
const NO_STAGE = {
  snap: [0, 0, 0],
  sky: [170, 220, 255],
  ground: [205, 200, 200],
  fog: [255, 220, 220],
  clouds: [210, 210, 210],
  distance: 3750,
};

// Starts a frame: the models (loaded on the first), the stage's colours, the camera.
const startFrame = () => {
  if (!loading) {
    loadModels();
  }
  fitScreen();
  startBatch();
  if (tintedFor !== (scene.colors ?? NO_STAGE)) {
    tintForStage(scene.colors ?? NO_STAGE);
  }
  setView(drawCamera.projection);
  // the camera, in the original's units: its height decides the ground's bands
  medium.y = Math.min(0, 250 - drawCamera.y * 10 - medium.cy);
  medium.zy =
    (Math.asin(Math.max(-1, Math.min(1, -drawCamera.projection[7]))) * 180) /
    Math.PI;
  medium.flicker = !medium.flicker;
  medium.frame++;
  medium.lastCheck = raceEvents.onlastcheck;
};

// The stage's first count pieces; nextCheckpoint picks the checkpoints that flash.
const pieceObjects = (count, nextCheckpoint) => {
  const objects = [];
  for (let i = 0; i < count; i++) {
    const piece = pieces.list[i];
    const file = PIECE_FILES[piece.typ];
    const rad = models.get(PIECE_STAND_INS[file] ?? file);
    if (rad) {
      objects.push({
        key: piece,
        rad,
        place: () => matrixOf(piece),
        nextCheckpoint: piece.iscp != 0 && nextCheckpoint(piece),
      });
    }
  }
  return objects;
};

// Car c's own copy of its model (the order its polygons are drawn in is its own).
const carObject = (c, instance, type) => {
  const file = CAR_FILES[type];
  if (carModels[c]?.file != file && models.has(file)) {
    carModels[c] = { file, rad: structuredClone(models.get(file)) };
  }
  return (
    carModels[c] && {
      key: instance,
      rad: carModels[c].rad,
      place: () => matrixOf(instance),
      car: instance,
      // how far below the car its wheels touch the ground, as our physics has it
      ground: carStats.wly[type][1] + 1.5 * carStats.wlh[type][1],
    }
  );
};

// The objects, those not seen last frame first, then the farthest first.
const drawInOrder = (objects) => {
  const unseen = objects.filter((o) => !lastDist.get(o.key));
  const seen = objects
    .filter((o) => lastDist.get(o.key))
    .sort((a, b) => lastDist.get(b.key) - lastDist.get(a.key));
  for (const object of [...unseen, ...seen]) {
    const matrix = object.place();
    lastDist.set(
      object.key,
      drawObject(object.rad, matrix, {
        wxz: object.car?.wxz ?? 0,
        wzy: object.car?.wzy ?? 0,
        nextCheckpoint: object.nextCheckpoint,
        ground: object.ground ?? null,
        // the ground, relative to the camera
        // (matrix[13]: where the car is drawn, between ticks, relative to the camera)
        groundY: object.shadowBelow
          ? matrix[13] - object.ground
          : -drawCamera.y,
      }),
    );
  }
  flushBatch(medium.w, medium.h);
};

export const drawClassicRace = () => {
  startFrame();
  drawSkyAndGround();
  drawScenery({
    x: -10 * drawCamera.x,
    y: 250 - 10 * drawCamera.y,
    z: 10 * drawCamera.z,
  });
  const objects = pieceObjects(
    pieces.count,
    (piece) => raceEvents.oncheckpoint + 1 == piece.iscp,
  );
  for (let c = 0; c < game.carCount; c++) {
    const object = carObject(c, car[c], car[c].typ);
    if (object) {
      objects.push(object);
    }
  }
  drawInOrder(objects);
};

// The stage select's turning preview of the stage, every checkpoint flashing.
export const drawClassicStage = (count) => {
  startFrame();
  medium.trk = 2;
  drawInOrder(pieceObjects(count, () => true));
  medium.trk = 0;
};

// A car shown on its own (the car select, a car unlocked), over the modern backdrop.
export const drawClassicCar = (instance, type) => {
  startFrame();
  const object = carObject(game.carCount, instance, type);
  if (object) {
    // shown in the air: its shadow right below its wheels
    object.shadowBelow = true;
  }
  drawInOrder(object ? [object] : []);
};
