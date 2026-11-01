// Loading a stage: its loading screen, the stage file, and where the game goes afterwards.

import { makePile } from "../data/pile.js";
import { freeModel, newModel } from "../render/models.js";
import { buildPileModel } from "../render/piles.js";
import { game } from "../core/state.js";
import {
  isSpecialFix,
  parseStage,
  pathType,
  valueOf,
} from "../data/stageFormat.js";
import {
  LAST_STAGE,
  customStage,
  customText,
  isCustom,
  originalOf,
  stageFile,
} from "../data/stages.js";
import { setUpField } from "../race/field.js";
import { effects } from "../race/effects.js";
import { pieceModels, pieces, track } from "../race/track.js";
import {
  colorCheckpointText,
  createSparks,
  raceCarTextures,
  groundTexture,
  skyTexture,
} from "../render/generated.js";
import { setClassicSky, setWorld } from "../render/renderer.js";
import { scene } from "../render/scene.js";

export const STAGE_LOAD = {
  requested: -1,
  // the loading screen is up, the stage file not requested yet
  screenShown: 0,
  loading: 1,
  loaded: 2,
};

export const AFTER_LOAD = {
  stageSelect: 0,
  // another stage picked in the stage select: its picture stays behind the loading
  nextStage: 1,
  // the very first race starts right away
  race: 2,
  // a replay file opened: its stage, then the replay
  replay: 3,
  // the race of a host (see net/guest.js)
  guest: 4,
};

export const stageLoad = {
  progress: STAGE_LOAD.screenShown,
  after: AFTER_LOAD.stageSelect,
};

// piece types (see PIECE_FILES in assets.js) the stage file treats specially
const TSIDE = 39;
const WALL = 29;
const AIR_CHECKPOINT = 54;
// the original's net, where this game has its takeoffb, kept after its own pieces
const ORIGINAL_NET = 41;
const NET = 66;
// the walls around a stage are pieces this far apart
const WALL_SPACING = 480;

export function loadStage() {
  stageLoad.progress = STAGE_LOAD.loading;
  if (isCustom(track.stage)) {
    readStage(customText(track.stage));
    prepareStage();
    stageLoad.progress = STAGE_LOAD.loaded;
    return;
  }
  const request = new XMLHttpRequest();
  request.open("GET", stageFile(track.stage), true);
  request.onreadystatechange = () => {
    if (
      request.readyState === 4 &&
      (request.status === 200 || request.status == 0)
    ) {
      readStage(request.responseText);
      prepareStage();
      stageLoad.progress = STAGE_LOAD.loaded;
    }
  };
  request.send(null);
}

// what the stage file sets for the sky texture, read after the whole file
let skyColor = [];
let cloudColor = [];
let cloudType = 0;
// the bounds the next piece gets ("bnd" in the stage file)
let bounds = null;

// the pieces every stage has; the original's rock piles follow them, each its own
const SHARED_PIECES = pieceModels.length;

const readStage = (text) => {
  for (const pile of pieceModels.splice(SHARED_PIECES)) {
    freeModel(pile);
  }
  track.n = 0;
  track.nsp = 0;
  pieces.count = 0;
  pieces.fixCount = 0;
  track.addons = 0;
  scene.tint = [0, 0, 0];
  scene.colors = {
    snap: [0, 0, 0],
    sky: [170, 220, 255],
    ground: [205, 200, 200],
    fog: [255, 220, 220],
    clouds: [210, 210, 210],
    distance: 10700,
  };
  skyColor = [];
  cloudColor = [];
  cloudType = 0;
  scene.light[0] = 0;
  scene.light[1] = 1;
  scene.light[2] = 0;
  bounds = null;
  track.tips = [];
  customStage.level = 8;
  customStage.music = 1;
  const original = originalOf(track.stage) != 0;
  if (original) {
    scene.colors.original = { commands: [], pathObjects: 0, bounds: {} };
  }
  let objects = 0;
  for (const entry of parseStage(text)) {
    COMMANDS[entry.command]?.(entry, (field) => valueOf(entry, field));
    if (original) {
      if (ORIGINAL_LOOK.includes(entry.command)) {
        scene.colors.original.commands.push(entry);
      }
      if (entry.command.startsWith("max")) {
        scene.colors.original.bounds[entry.command] = entry.limit;
      }
      // the objects up to the last on the path (the original's notb): its ground's
      // patches are made from how many
      if (OBJECTS.includes(entry.command)) {
        objects++;
        if (
          ["chk", "fix"].includes(entry.command) ||
          (entry.command == "set" && pathType(entry) !== null)
        ) {
          scene.colors.original.pathObjects = objects;
        }
      }
    }
  }
  if (original) {
    // the stage select shows the original's stage up to its last object on the path, as
    // it did (this game's own files say how many pieces follow their last path point)
    track.addons = scene.colors.original.pathObjects - track.obi[track.n - 1];
  }
};

// what the classic look takes from the original's stages as their files say it, in
// their order (see classic/medium.js)
const ORIGINAL_LOOK = [
  "snap",
  "sky",
  "ground",
  "polys",
  "fog",
  "texture",
  "clouds",
  "density",
  "fadefrom",
  "lightson",
  "mountains",
];
// the commands that make one of the original's objects
const OBJECTS = ["set", "chk", "fix", "pile"];

const COMMANDS = {
  name: (e) => {
    track.name = e.name ?? "";
  },
  nlaps: (e, v) => {
    track.nlaps = v("laps");
  },
  level: (e, v) => {
    customStage.level = Math.min(Math.max(v("level"), 1), LAST_STAGE);
  },
  music: (e, v) => {
    customStage.music = Math.min(Math.max(v("stage"), 1), LAST_STAGE);
  },
  addon: (e, v) => {
    track.addons = v("count");
  },
  snap: (e, v) => {
    scene.tint[0] = v("r") / 100;
    scene.tint[1] = v("g") / 100;
    scene.tint[2] = v("b") / 100;
    scene.colors.snap = [v("r"), v("g"), v("b")];
  },
  sky: (e, v) => {
    skyColor[0] = v("r");
    skyColor[1] = v("g");
    skyColor[2] = v("b");
    scene.colors.sky = [...skyColor];
  },
  fog: (e, v) => {
    scene.fog[0] = v("r");
    scene.fog[1] = v("g");
    scene.fog[2] = v("b");
    scene.colors.fog = scene.fog.slice(0, 3);
  },
  clouds: (e, v) => {
    cloudColor[0] = v("r");
    cloudColor[1] = v("g");
    cloudColor[2] = v("b");
    cloudType = v("type");
    if (originalOf(track.stage)) {
      // the original's 0 to 10 of cloudiness as one of this game's three skies
      cloudType = Math.min(2, Math.round(cloudType / 4));
    }
    scene.colors.clouds = [...cloudColor];
  },
  ground: (e, v) => {
    scene.colors.ground = [v("r"), v("g"), v("b")];
    groundTexture(
      v("texture"),
      v("r"),
      v("g"),
      v("b"),
      v("hue"),
      v("saturation"),
    );
  },
  // Insano's tips, for the stage the player has to win next
  tip: (e) => {
    if (track.stage >= 3 && game.unlocked == track.stage) {
      track.tips.push(
        (e.text ?? "").replace("[", "(").replace("]", ")").replace(";", ","),
      );
    }
  },
  // the light swings from above to the side
  lightswingX: (e, v) => {
    const angle = v("angle");
    scene.light[1] = Math.cos(angle * (Math.PI / 180));
    scene.light[0] = Math.cos((angle + 90) * (Math.PI / 180));
  },
  lightswingZ: (e, v) => {
    const angle = v("angle");
    scene.light[1] = Math.cos(angle * (Math.PI / 180));
    scene.light[2] = Math.cos((angle + 90) * (Math.PI / 180));
  },
  distfog: (e, v) => {
    scene.fogDistance = v("distance");
    scene.colors.distance = v("distance");
  },
  // the original's stages: how far its fog starts, as how far this game's ends
  fadefrom: (e, v) => {
    scene.fogDistance = Math.min(8000, v("distance")) / 0.8;
    scene.colors.distance = scene.fogDistance;
  },
  bnd: (e, v) => {
    bounds = [v("a"), v("b"), v("c"), v("d")];
  },
  set: (e, v) => {
    const piece = newPiece(v);
    if (bounds) {
      for (let k = 0; k < 4; k++) {
        piece.bnd[k] = bounds[k];
      }
      bounds = null;
    }
    const rotation = place(piece, v, 0);
    measure(piece, rotation);
    if (piece.typ == TSIDE) {
      piece.rot = rotation;
    }
    const path = pathType(e);
    if (path !== null) {
      addPathPoint(piece, 0, path);
    }
    pieces.count++;
  },
  // a checkpoint: a path point to pass, on the ground or in the air
  chk: (e, v) => {
    const piece = newPiece(v);
    const rotation = place(piece, v, 0.4);
    if (piece.typ == AIR_CHECKPOINT) {
      piece.y = -(v("y") / 10);
    }
    measure(piece, rotation);
    addPathPoint(piece, piece.y, rotation == 0 ? 1 : 2);
    track.pcs = track.n - 1;
    track.obn[track.nsp] = pieces.count;
    track.nsp++;
    piece.iscp = track.nsp;
    pieces.count++;
  },
  // a hoop that fixes the cars driving through it
  fix: (e, v) => {
    const piece = newPiece(v);
    piece.x = -(v("x") / 10);
    piece.z = v("z") / 10;
    piece.y = -(v("y") / 10) + 25;
    turn(piece, v("rotation"));
    track.special[pieces.fixCount] = isSpecialFix(e);
    pieces.fixes[pieces.fixCount] = pieces.count;
    pieces.fixCount++;
    pieces.count++;
  },
  // one of the original's rock piles, a mound to drive over
  pile: (e, v) => {
    const piece = newPiece(null);
    piece.typ = pieceModels.length;
    piece.pile = makePile(v("seed"), v("width"), v("height"));
    const model = newModel();
    pieceModels.push(model);
    buildPileModel(model, piece.pile, scene.colors.ground);
    piece.x = -(v("x") / 10);
    piece.y = 0;
    piece.z = v("z") / 10;
    measure(piece, 0);
    pieces.count++;
  },
  // the walls around the stage: right, left, top and bottom
  maxr: (e, v) => {
    const count = v("count");
    const limit = -(v("limit") / 10);
    track.limr = limit + 5;
    track.limro = pieces.count;
    const start = v("start") / 10;
    for (let c = 0; c < count; c++) {
      addWall(limit, c * WALL_SPACING + start, 0);
    }
  },
  maxl: (e, v) => {
    const count = v("count");
    const limit = -(v("limit") / 10);
    track.liml = limit - 5;
    track.limlo = pieces.count;
    const start = v("start") / 10;
    for (let c = 0; c < count; c++) {
      addWall(limit, c * WALL_SPACING + start, 180);
    }
  },
  maxt: (e, v) => {
    const count = v("count");
    const limit = v("limit") / 10;
    track.limt = limit - 5;
    track.limto = pieces.count;
    const start = -v("start") / 10;
    for (let c = 0; c < count; c++) {
      addWall(-(c * WALL_SPACING) + start, limit, 90);
    }
  },
  maxb: (e, v) => {
    const count = v("count");
    const limit = v("limit") / 10;
    track.limb = limit + 5;
    track.limbo = pieces.count;
    const start = -v("start") / 10;
    for (let c = 0; c < count; c++) {
      addWall(-(c * WALL_SPACING) + start, limit, -90);
    }
  },
};

// The next piece of the stage, of the type the entry names (the file counts from 10).
const newPiece = (v) => {
  const piece = {
    typ: 0,
    x: 0,
    z: 0,
    mat: null,
    bnd: [0, 0, 0, 0],
    iscp: 0,
  };
  pieces.list[pieces.count] = piece;
  piece.mat = mat4.create();
  if (v) {
    piece.typ = v("piece") - 10;
    if (piece.typ == ORIGINAL_NET && originalOf(track.stage)) {
      piece.typ = NET;
    }
  }
  return piece;
};

const turn = (piece, degrees) => {
  mat4.rotate(piece.mat, piece.mat, degrees * (Math.PI / 180), [0, 1, 0]);
};

// Puts the piece where the entry says, at height y, turned; returns the turn.
const place = (piece, v, y) => {
  piece.x = -(v("x") / 10);
  piece.y = y;
  piece.z = v("z") / 10;
  const rotation = v("rotation");
  turn(piece, rotation);
  return rotation;
};

// The piece's collision box, its sides swapped when it is turned sideways.
const measure = (piece, rotation) => {
  const model = pieceModels[piece.typ];
  const sideways = Math.abs(rotation) == 90;
  piece.bx = sideways ? model.bz : model.bx;
  piece.bz = sideways ? model.bx : model.bz;
  piece.bx += 15;
  piece.bz += 15;
  piece.by = model.by;
};

const addPathPoint = (piece, y, type) => {
  track.x[track.n] = piece.x;
  track.z[track.n] = piece.z;
  track.y[track.n] = y;
  track.typ[track.n] = type;
  track.obi[track.n] = pieces.count;
  track.n++;
};

const addWall = (x, z, degrees) => {
  const piece = newPiece(null);
  piece.typ = WALL;
  piece.x = x;
  piece.y = 0;
  piece.z = z;
  if (degrees != 0) {
    turn(piece, degrees);
  }
  pieces.count++;
};

// After the file: the cars, the sky, the textures the stage tints, and the light.
const prepareStage = () => {
  setUpField();
  skyTexture(skyColor, scene.fog, cloudColor, cloudType);
  setClassicSky(skyColor);
  for (let i = 0; i < 3; i++) {
    scene.glassColor[i] = Math.round((skyColor[i] * 2 + 70) / 3);
  }
  raceCarTextures();
  createSparks();
  colorCheckpointText();
  effects.chipCount = 0;
  effects.chipsTakenBelow = 0;
  effects.sparkCount = 0;
  effects.dustCount = 0;
  effects.explosionCount = 0;
  if (
    stageLoad.after != AFTER_LOAD.race &&
    stageLoad.after != AFTER_LOAD.replay &&
    stageLoad.after != AFTER_LOAD.guest
  ) {
    // the stage select tints the stage the other way round, three times as strong
    const oppositeTint = [
      -(scene.tint[0] * 3),
      -(scene.tint[1] * 3),
      -(scene.tint[2] * 3),
    ];
    setWorld(oppositeTint, scene.fog, 0, 1, 0, 10700);
  } else {
    setWorld(
      scene.tint,
      scene.fog,
      scene.light[0],
      scene.light[1],
      scene.light[2],
      scene.fogDistance,
    );
  }
};
