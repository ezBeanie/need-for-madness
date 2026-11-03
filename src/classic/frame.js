// The race in the classic look: the original game's own models drawn the original's way
// (see draw.js) onto a canvas of its own, 450 pixels high, where the modern look's 3D
// canvas is. The game logic, the camera and the HUD stay the same.
import { PHASE, game } from "../core/state.js";
import { carStats } from "../data/carStats.js";
import { raceEvents } from "../race/events.js";
import { car, racers } from "../race/racers.js";
import { pieceModels, pieces, track } from "../race/track.js";
import {
  drawCamera,
  drawMatrix,
  interpolation,
  placeModel,
} from "../render/interpolation.js";
import { fetchText } from "../render/models.js";
import { canvas3D } from "../render/renderer.js";
import { scene } from "../render/scene.js";
import { PIECE_FILES } from "../loading/assets.js";
import { bodyDamage } from "../race/physics.js";
import { recording } from "../race/recording.js";
import { flushBatch, setPixelSize, startBatch } from "./batch.js";
import { dentClassic, hitOn } from "./damage.js";
import { electrify, fixBubble, fixStep, startFixing } from "./fixing.js";
import { effectObjects } from "./effects.js";
import { CAR_FILES } from "./cars.js";
import { clearShadowSpots, drawObject, setView, tintModel } from "./draw.js";
import {
  drawSkyAndGround,
  medium,
  setOriginalLook,
  setStageLook,
} from "./medium.js";
import { drawScenery, newScenery } from "./scenery.js";
import { parseRad, pileRad } from "./rad.js";
import { placeSurfaces } from "./surfaces.js";

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
// the models of the stage's rock piles, by piece
const pileRads = new Map();

const radOf = (piece) => {
  const file = PIECE_FILES[piece.typ];
  return piece.pile
    ? pileRads.get(piece)
    : models.get(PIECE_STAND_INS[file] ?? file);
};

// a fixed sequence for the original's random rock colours, the same on every load
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

// the cars the original raced, counted among its objects before the stage's
const ORIGINAL_CARS = 7;

const tintForStage = (colors) => {
  if (colors.original) {
    setOriginalLook(colors.original.commands);
  } else {
    setStageLook({
      snap: colors.snap,
      sky: colors.sky,
      ground: colors.ground,
      fog: colors.fog,
      clouds: colors.clouds,
      // the modern look sees farther; the original's fog starts at most at 8000
      fadefrom: Math.min(8000, Math.round(colors.distance * 0.8)),
    });
  }
  const randomness = seeded(7);
  for (const rad of models.values()) {
    tintModel(rad, randomness);
  }
  // the rock piles in the stage's colours, as the original made them while loading it
  pileRads.clear();
  for (let i = 0; i < pieces.count; i++) {
    const piece = pieces.list[i];
    if (piece.pile) {
      const rad = pileRad(piece.pile, medium.cpol, medium.cgrnd);
      tintModel(rad, randomness);
      pileRads.set(piece, rad);
    }
  }
  // (their colours tinted by the stage's snap, set above)
  placeSurfaces(pieces.list.slice(0, pieces.count), radOf);
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
  const original = colors.original;
  newScenery({
    // the original's own stages: their bounds and seeds as it took them
    minX: original?.bounds.maxl ?? Math.min(...xBounds),
    maxX: original?.bounds.maxr ?? Math.max(...xBounds),
    minZ: original?.bounds.maxb ?? Math.min(...zBounds),
    maxZ: original?.bounds.maxt ?? Math.max(...zBounds),
    patchSeed: original ? ORIGINAL_CARS + original.pathObjects : pieces.count,
    mountainSeed: original ? medium.mountainSeed : pieces.count * 7 + 83898,
    roads,
    randomness: seeded(pieces.count * 31 + 7),
  });
  carModels.length = 0;
  tintedFor = colors;
};

// The classic look draws on the 3D canvas, made 450 pixels high (see fitCanvas3D), or
// what else is bound w x h.
const fitScreen = (w = canvas3D.width, h = canvas3D.height) => {
  medium.w = w;
  medium.h = h;
  medium.cx = medium.w / 2;
  medium.cy = medium.h / 2;
  setPixelSize(medium.h / 450);
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

// Starts a frame: the models (loaded on the first), the colours, the camera.
const startFrame = (colors = scene.colors ?? NO_STAGE, w, h) => {
  if (!loading) {
    loadModels();
  }
  fitScreen(w, h);
  startBatch();
  if (tintedFor !== colors) {
    tintForStage(colors);
  }
  setView(drawCamera.projection);
  // the camera, in the original's units: its height decides the ground's bands
  medium.y = Math.min(0, 250 - drawCamera.y * 10 - medium.cy);
  medium.zy =
    (Math.asin(Math.max(-1, Math.min(1, -drawCamera.projection[7]))) * 180) /
    Math.PI;
  medium.flicker = !medium.flicker;
  medium.frame++;
  medium.tick = interpolation.tick;
  medium.frozen = recording.frozen;
  medium.lastCheck = raceEvents.onlastcheck;
  clearShadowSpots();
};

// The stage's first count pieces; nextCheckpoint picks the checkpoints that flash.
const pieceObjects = (count, nextCheckpoint) => {
  const objects = [];
  const hoops = new Set(pieces.fixes.slice(0, pieces.fixCount));
  for (let i = 0; i < count; i++) {
    const piece = pieces.list[i];
    const rad = radOf(piece);
    if (rad) {
      objects.push({
        key: piece,
        rad,
        place: () => matrixOf(piece),
        sorting: sortingOf(piece),
        nextCheckpoint: piece.iscp != 0 && nextCheckpoint(piece),
        // electricity arcs across the fix hoops
        beforePolygons: hoops.has(i)
          ? (matrix) => electrify(hoopStates(piece), matrix, i)
          : null,
      });
    }
  }
  return objects;
};

// how each piece's polygons were ordered last frame: pieces of a type share one model
const sortings = new WeakMap();
const sortingOf = (piece) => {
  if (!sortings.has(piece)) {
    sortings.set(piece, {});
  }
  return sortings.get(piece);
};

// each fix hoop's electricity
const hoopState = new WeakMap();
const hoopStates = (piece) => {
  if (!hoopState.has(piece)) {
    hoopState.set(piece, {});
  }
  return hoopState.get(piece);
};

// A replay keeps the damage the race ended with: there the car is wrecked once the tape
// wastes it.
const isWrecked = (c, type) =>
  game.phase == PHASE.replay || game.phase == PHASE.highlights
    ? racers[c].destnow
    : racers[c].damage >= carStats.maxmag[type];

// A race car's model goes up in flames when the car is wrecked (the original's
// distruct: all but its wheels), and turns blue in a bubble while it is fixed.
const wreckAndFix = (c, rad, type) => {
  const wrecked = isWrecked(c, type);
  // a replay goes back to before the car was wrecked: a fresh model, dented as it was
  if (rad.wrecked && !wrecked) {
    carModels[c] = undefined;
    return null;
  }
  if (!rad.wrecked && wrecked) {
    rad.wrecked = true;
    for (const poly of rad.polys) {
      if (poly.wz == 0 || poly.gr == -17 || poly.gr == -16) {
        poly.embos = 1;
      }
    }
  }
  if (car[c].fcnt >= 5) {
    const step = fixStep(car[c].fcnt);
    startFixing(rad, step);
    return (matrix) => fixBubble(rad, matrix, step, c);
  }
  return null;
};

// The modern look stretches a wreck about to burst along one axis (racer.embodir); the
// original only swelled its polygons (see wreck in draw.js). That axis scaled back to
// the others' length, between ticks too.
export const unstretched = (c, matrix) => {
  const axis = c < game.carCount ? racers[c].embodir : 0;
  if (axis) {
    const length = (k) =>
      Math.hypot(matrix[k * 4], matrix[k * 4 + 1], matrix[k * 4 + 2]);
    const by = length((axis + 1) % 3) / length(axis);
    for (let i = 0; i < 3; i++) {
      matrix[axis * 4 + i] *= by;
    }
  }
  return matrix;
};

// Car c's own copy of its model (the order its polygons are drawn in is its own).
const carObject = (c, instance, type) => {
  const file = CAR_FILES[type];
  if (carModels[c]?.file != file && models.has(file)) {
    const rad = structuredClone(models.get(file));
    for (const hit of c < game.carCount ? (hits[c] ?? []) : []) {
      dentClassic(rad, hit);
    }
    carModels[c] = { file, rad };
  }
  const rad = carModels[c]?.rad;
  return (
    rad && {
      key: instance,
      rad,
      place: () => unstretched(c, matrixOf(instance)),
      car: instance,
      beforePolygons: c < game.carCount ? wreckAndFix(c, rad, type) : null,
      // how far below the car its wheels touch the ground, as our physics has it
      ground: carStats.wly[type][1] + 1.5 * carStats.wlh[type][1],
    }
  );
};

// The objects, those not seen last frame first, then the farthest first; effects know
// how far they are now and draw themselves.
const drawInOrder = (objects) => {
  const distOf = (o) => o.dist ?? lastDist.get(o.key);
  const unseen = objects.filter((o) => !distOf(o));
  const seen = objects
    .filter((o) => distOf(o))
    .sort((a, b) => distOf(b) - distOf(a));
  for (const object of [...unseen, ...seen]) {
    if (object.draw) {
      object.draw();
      continue;
    }
    const matrix = object.place();
    lastDist.set(
      object.key,
      drawObject(object.rad, matrix, {
        wxz: object.car?.wxz ?? 0,
        wzy: object.car?.wzy ?? 0,
        sorting: object.sorting,
        nextCheckpoint: object.nextCheckpoint,
        angles: object.car,
        beforePolygons: object.beforePolygons,
        ground: object.ground ?? null,
        shadowCamera: object.onStage ? drawCamera : null,
        // the ground, relative to the camera
        // (matrix[13]: where the car is drawn, between ticks, relative to the camera)
        groundY: object.shadowBelow
          ? matrix[13] - object.ground
          : (object.groundAt ?? 0) - drawCamera.y,
      }),
    );
  }
  flushBatch(medium.w, medium.h, medium.depth);
};

// the cars' classic models follow the physics' dents; a repaired car gets a fresh copy
// The hits since each car was last fixed: a car's model made later (the look switched
// mid-race) is dented with them all.
const hits = [];
bodyDamage.dent = (c, hitSide, k, mag) => {
  const hit = hitOn(c, hitSide, k, mag);
  (hits[c] ??= []).push(hit);
  if (carModels[c]) {
    dentClassic(carModels[c].rad, hit);
  }
};
bodyDamage.repair = (c) => {
  hits[c] = [];
  carModels[c] = undefined;
};

// one of car c's colours (of its body, not its wheels), for its chips
const chipColors = seeded(3);
const colorOfCar = (c) => {
  const body = carModels[c]?.rad.polys.filter((p) => !p.master && !p.wz) ?? [];
  const poly = body[Math.floor(chipColors() * body.length)];
  return poly?.c ?? [128, 128, 128];
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
      object.onStage = true;
      objects.push(object);
    }
  }
  objects.push(...effectObjects(colorOfCar));
  drawInOrder(objects);
};

// The stage select's turning preview of the stage, every checkpoint flashing, in the
// original's sepia (trk 1) over its pictures.
export const drawClassicStage = (count) => {
  startFrame();
  medium.trk = 1;
  drawInOrder(pieceObjects(count, () => true));
  medium.trk = 0;
};

// How far below its middle the original's model of the car type touches the ground (its
// grat, the original's units), 0 while it loads.
export const classicGroundOf = (type) => models.get(CAR_FILES[type])?.grat ?? 0;

// A car shown on its own (the car select, a car unlocked): its shadow right below its
// wheels, or on a floor at groundAt (our y), in the classic menus (menuFloor) in the
// original's menu shadow colour.
export const drawClassicCar = (
  instance,
  type,
  groundAt = null,
  menuFloor = groundAt !== null,
) => {
  // in the menus, as before any stage: no stage's colours on the car
  startFrame(NO_STAGE);
  const object = carObject(game.carCount, instance, type);
  if (object) {
    object.shadowBelow = groundAt === null;
    object.groundAt = groundAt;
  }
  medium.menuShadow = menuFloor ? [87, 85, 57] : null;
  drawInOrder(object ? [object] : []);
  medium.menuShadow = null;
};

// A car on a card of the lobby (see render/carPreviews.js), w x h into what is bound: each
// type its own copy of the model, after the cars of a race and the car select's.
export const drawClassicPreview = (instance, type, w, h) => {
  startFrame(NO_STAGE, w, h);
  const object = carObject(game.carCount + 1 + type, instance, type);
  if (object) {
    object.shadowBelow = true;
  }
  drawInOrder(object ? [object] : []);
};
