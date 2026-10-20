// The race in the classic look: the original game's own models drawn the original's way
// (see draw.js) onto a canvas of its own, 450 pixels high, where the modern look's 3D
// canvas is. The game logic, the camera and the HUD stay the same.
import { game } from "../core/state.js";
import { CAR } from "../data/carStats.js";
import { raceEvents } from "../race/events.js";
import { car } from "../race/racers.js";
import { pieces } from "../race/track.js";
import { drawCamera, drawMatrix, placeModel } from "../render/interpolation.js";
import { fetchText } from "../render/models.js";
import { canvas3D } from "../render/renderer.js";
import { scene } from "../render/scene.js";
import { PIECE_FILES } from "../loading/assets.js";
import { view } from "../ui/view.js";
import { drawObject, setView, tintModel } from "./draw.js";
import { drawSkyAndGround, medium, setStageLook } from "./medium.js";
import { parseRad } from "./rad.js";

// the original's model of each car type; the three cars the original never had stand in
// as the closest of its own until they get classic models of their own
const CAR_FILES = {
  [CAR.tornadoShark]: "2000tornados",
  [CAR.formula7]: "formula7",
  [CAR.wowCaninaro]: "canyenaro",
  [CAR.laVitaCrab]: "lescrab",
  [CAR.nimi]: "nimi",
  [CAR.maxRevenge]: "maxrevenge",
  [CAR.leadOxide]: "leadoxide",
  [CAR.tragdor]: "drifter",
  [CAR.koolKat]: "koolkat",
  [CAR.iceCream]: "nimi",
  [CAR.drifterX]: "drifter",
  [CAR.shadowRider]: "audir8",
  [CAR.swordOfJustice]: "policecops",
  [CAR.highRider]: "mustang",
  [CAR.elKing]: "king",
  [CAR.mightyEight]: "audir8",
  [CAR.masheen]: "masheen",
  [CAR.radicalOne]: "radicalone",
  [CAR.drMonstaa]: "drmonster",
};
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

const tintForStage = () => {
  const colors = scene.colors;
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
  carModels.length = 0;
  tintedFor = colors;
};

let canvas = null;
let g = null;

const classicCanvas = () => {
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.style.cssText = canvas3D.style.cssText;
    canvas.style.imageRendering = "pixelated";
    canvas3D.after(canvas);
    g = canvas.getContext("2d");
  }
  const width = Math.round(450 * view.aspect);
  if (canvas.width != width || canvas.height != 450) {
    canvas.width = width;
    canvas.height = 450;
  }
  canvas.style.width = canvas3D.style.width;
  canvas.style.height = canvas3D.style.height;
  medium.w = width;
  medium.cx = width / 2;
  return g;
};

// Shows the classic canvas over the 3D one, or hides it.
export const showClassic = (shown) => {
  if (canvas) {
    canvas.style.visibility = shown ? "visible" : "hidden";
  }
};

// how far each object was last frame: the original draws the farthest first by that
const lastDist = new WeakMap();

// The matrix the modern look would draw the instance with (its moves smoothed between
// ticks, the camera's position taken off).
const matrixOf = (instance) => {
  placeModel(instance);
  return Float32Array.from(drawMatrix);
};

export const drawClassicRace = () => {
  if (!loading) {
    loadModels();
  }
  const g = classicCanvas();
  if (tintedFor !== scene.colors) {
    tintForStage();
  }
  setView(drawCamera.projection);
  // the camera, in the original's units: its height decides the ground's bands
  medium.y = Math.min(0, 250 - drawCamera.y * 10 - medium.cy);
  medium.zy =
    (Math.asin(Math.max(-1, Math.min(1, -drawCamera.projection[7]))) * 180) /
    Math.PI;
  medium.flicker = !medium.flicker;
  medium.lastCheck = raceEvents.onlastcheck;
  g.lineWidth = 1;
  drawSkyAndGround(g);
  const objects = [];
  for (let i = 0; i < pieces.count; i++) {
    const piece = pieces.list[i];
    const file = PIECE_FILES[piece.typ];
    const rad = models.get(PIECE_STAND_INS[file] ?? file);
    if (rad) {
      objects.push({
        key: piece,
        rad,
        place: () => matrixOf(piece),
        nextCheckpoint:
          piece.iscp != 0 && raceEvents.oncheckpoint + 1 == piece.iscp,
      });
    }
  }
  for (let c = 0; c < game.carCount; c++) {
    const file = CAR_FILES[car[c].typ];
    if (carModels[c]?.file != file && models.has(file)) {
      carModels[c] = { file, rad: structuredClone(models.get(file)) };
    }
    if (carModels[c]) {
      objects.push({
        key: car[c],
        rad: carModels[c].rad,
        place: () => matrixOf(car[c]),
        car: car[c],
      });
    }
  }
  const unseen = objects.filter((o) => !lastDist.get(o.key));
  const seen = objects
    .filter((o) => lastDist.get(o.key))
    .sort((a, b) => lastDist.get(b.key) - lastDist.get(a.key));
  for (const object of [...unseen, ...seen]) {
    lastDist.set(
      object.key,
      drawObject(g, object.rad, object.place(), {
        wxz: object.car?.wxz ?? 0,
        wzy: object.car?.wzy ?? 0,
        nextCheckpoint: object.nextCheckpoint,
        // the ground, relative to the camera
        groundY: -drawCamera.y,
      }),
    );
  }
};
