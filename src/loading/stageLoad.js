// Loading a stage: its loading screen, the stage file, and where the game goes afterwards.

import { game } from "../core/state.js";
import {
  isSpecialFix,
  parseStage,
  pathType,
  valueOf,
} from "../data/stageFormat.js";
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
import { setWorld } from "../render/renderer.js";
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
};

export const stageLoad = {
  progress: STAGE_LOAD.screenShown,
  after: AFTER_LOAD.stageSelect,
};

// piece types (see PIECE_FILES in assets.js) the stage file treats specially
const TSIDE = 39;
const WALL = 29;
const AIR_CHECKPOINT = 54;
// the walls around a stage are pieces this far apart
const WALL_SPACING = 480;

export function loadStage() {
  stageLoad.progress = STAGE_LOAD.loading;
  const request = new XMLHttpRequest();
  request.open("GET", "data/stages/" + track.stage + ".txt", true);
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

const readStage = (text) => {
  track.n = 0;
  track.nsp = 0;
  pieces.count = 0;
  pieces.fixCount = 0;
  track.addons = 0;
  scene.tint = [0, 0, 0];
  skyColor = [];
  cloudColor = [];
  cloudType = 0;
  scene.light[0] = 0;
  scene.light[1] = 1;
  scene.light[2] = 0;
  bounds = null;
  track.tips = [];
  for (const entry of parseStage(text)) {
    COMMANDS[entry.command]?.(entry, (field) => valueOf(entry, field));
  }
};

const COMMANDS = {
  name: (e) => {
    track.name = e.name ?? "";
  },
  nlaps: (e, v) => {
    track.nlaps = v("laps");
  },
  addon: (e, v) => {
    track.addons = v("count");
  },
  snap: (e, v) => {
    scene.tint[0] = v("r") / 100;
    scene.tint[1] = v("g") / 100;
    scene.tint[2] = v("b") / 100;
  },
  sky: (e, v) => {
    skyColor[0] = v("r");
    skyColor[1] = v("g");
    skyColor[2] = v("b");
  },
  fog: (e, v) => {
    scene.fog[0] = v("r");
    scene.fog[1] = v("g");
    scene.fog[2] = v("b");
  },
  clouds: (e, v) => {
    cloudColor[0] = v("r");
    cloudColor[1] = v("g");
    cloudColor[2] = v("b");
    cloudType = v("type");
  },
  ground: (e, v) => {
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
  for (let i = 0; i < 3; i++) {
    scene.glassColor[i] = Math.round((skyColor[i] * 2 + 70) / 3);
  }
  raceCarTextures();
  createSparks();
  colorCheckpointText();
  effects.chipCount = 0;
  effects.sparkCount = 0;
  effects.dustCount = 0;
  effects.explosionCount = 0;
  if (stageLoad.after != AFTER_LOAD.race) {
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
