// The stage the stage editor edits, as the stage file's entries (see data/stageFormat.js):
// its settings (name, laps, colours, ...) and its objects (pieces, checkpoints, fix hoops,
// rock piles) in file order, which is the order of the path. The walls around it and how
// many objects follow the path are worked out when it is written.
// Positions are the stage file's: x to the right, z up on the editor's map, ten to one of
// the models' units (and x the other way round, see loading/stageLoad.js).

import { parseStage, pathType, writeStage } from "../data/stageFormat.js";

// the pieces by their number in the stage file (10 more than in PIECE_FILES)
export const PIECE_GROUPS = [
  {
    name: "Road",
    pieces: [
      [47, "Start"],
      [10, "Road"],
      [14, "Turn"],
      [18, "Night road"],
      [19, "Night turn"],
      [11, "Fence road"],
      [12, "Twister"],
      [13, "Twister 2"],
      [22, "Road blend"],
      [23, "Road end"],
    ],
  },
  {
    name: "Offroad",
    pieces: [
      [48, "Start"],
      [15, "Offroad"],
      [17, "Turn"],
      [16, "Bumpy"],
      [20, "Road to offroad"],
      [21, "Night to offroad"],
      [24, "End"],
      [43, "Side"],
      [44, "Bumpy side"],
      [25, "Halfpipe ground"],
    ],
  },
  {
    name: "Ramps",
    pieces: [
      [26, "Ramp"],
      [27, "Curved ramp"],
      [32, "Small ramp"],
      [28, "Double ramp"],
      [29, "Hill"],
      [30, "Slide"],
      [31, "Takeoff"],
      [51, "Takeoff 2"],
      [45, "Uprise"],
      [46, "Rise road"],
      [52, "Speed ramp"],
      [33, "Offroad bump"],
      [34, "Offroad ramp"],
      [35, "Small offroad ramp"],
      [53, "Offroad hill"],
      [55, "Uphill"],
      [36, "Halfpipe"],
      [56, "Loop 1"],
      [57, "Loop 2"],
      [58, "Loop 3"],
      [59, "Loop 4"],
      [60, "Loop 5"],
      [61, "Loop 6"],
    ],
  },
  {
    name: "Checkpoints",
    pieces: [
      [40, "Checkpoint"],
      [42, "Offroad checkpoint"],
      [64, "Air checkpoint"],
      [41, "Fix hoop"],
    ],
  },
  {
    name: "Obstacles",
    pieces: [
      [37, "Spikes"],
      [38, "Rail"],
      [49, "Side wall"],
      [54, "Slider"],
      [62, "Rocks"],
      [63, "Rocks 2"],
      [76, "Net"],
    ],
  },
  {
    name: "Scenery",
    pieces: [
      [65, "Tree 1"],
      [66, "Tree 2"],
      [67, "Tree 3"],
      [68, "Tree 4"],
      [69, "Tree 5"],
      [70, "Tree 6"],
      [71, "Tree 7"],
      [72, "Tree 8"],
      [73, "Cactus 1"],
      [74, "Cactus 2"],
      [75, "Cactus 3"],
    ],
  },
];

export const pieceName = (piece) => {
  for (const group of PIECE_GROUPS) {
    const found = group.pieces.find(([number]) => number == piece);
    if (found) {
      return found[1];
    }
  }
  return `Piece ${piece}`;
};

const CHECKPOINTS = [40, 42, 64];
const FIX_HOOP = 41;
const TURNS = [14, 17, 19];
const RAMPS = [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 51, 52, 53, 55, 56];
const HALFPIPE = 36;
// what the cars drive along, joined end to end: everything but the checkpoints, the
// obstacles and the scenery
const JOINED = [
  ...PIECE_GROUPS[0].pieces,
  ...PIECE_GROUPS[1].pieces,
  ...PIECE_GROUPS[2].pieces,
].map(([number]) => number);

const OBJECTS = ["set", "chk", "fix", "pile"];
const WALLS = ["maxr", "maxl", "maxt", "maxb"];
// worked out when written
const DERIVED = [...WALLS, "addon", "bnd"];

// The entry a new piece of the type gets: a checkpoint and a fix hoop their own commands,
// and the path point the original's stages mostly make of such a piece.
export const newObject = (piece, x, z, rotation) => {
  if (CHECKPOINTS.includes(piece)) {
    return { command: "chk", piece, x, z, rotation };
  }
  if (piece == FIX_HOOP) {
    return { command: "fix", piece, x, z, y: -1200, rotation };
  }
  const object = { command: "set", piece, x, z, rotation };
  if (TURNS.includes(piece)) {
    object.suffix = "pt";
  } else if (RAMPS.includes(piece)) {
    object.suffix = "pr";
  } else if (piece == HALFPIPE) {
    object.suffix = "ph";
  } else if (JOINED.includes(piece)) {
    object.suffix = "p";
  }
  return object;
};

export const readEditedStage = (text) => {
  const stage = { settings: [], objects: [] };
  let bounds = null;
  for (const entry of parseStage(text)) {
    if (entry.command == "bnd") {
      bounds = entry;
    } else if (OBJECTS.includes(entry.command)) {
      // (bounds belong to the next piece set)
      if (bounds && entry.command == "set") {
        entry.bounds = [bounds.a, bounds.b, bounds.c, bounds.d];
        bounds = null;
      }
      stage.objects.push(entry);
    } else if (!DERIVED.includes(entry.command)) {
      stage.settings.push(entry);
    }
  }
  return stage;
};

// how far the walls stand off the outermost objects, and how long a wall piece is
const WALL_MARGIN = 2000;
const WALL_LENGTH = 4800;

// The walls around the objects, whole wall pieces long on every side.
export const wallsAround = (objects) => {
  let left = Infinity;
  let right = -Infinity;
  let bottom = Infinity;
  let top = -Infinity;
  for (const object of objects) {
    const box = boxOf(object);
    left = Math.min(left, box.left);
    right = Math.max(right, box.right);
    bottom = Math.min(bottom, box.bottom);
    top = Math.max(top, box.top);
  }
  if (left == Infinity) {
    return [];
  }
  left = Math.round(left - WALL_MARGIN);
  bottom = Math.round(bottom - WALL_MARGIN);
  const across = Math.ceil((right + WALL_MARGIN - left) / WALL_LENGTH);
  const along = Math.ceil((top + WALL_MARGIN - bottom) / WALL_LENGTH);
  right = left + across * WALL_LENGTH;
  top = bottom + along * WALL_LENGTH;
  const fromLeft = left + WALL_LENGTH / 2;
  const fromBottom = bottom + WALL_LENGTH / 2;
  return [
    { command: "maxl", count: along, limit: left, start: fromBottom },
    { command: "maxb", count: across, limit: bottom, start: fromLeft },
    { command: "maxr", count: along, limit: right, start: fromBottom },
    { command: "maxt", count: across, limit: top, start: fromLeft },
  ];
};

export const isPathObject = (object) =>
  ["chk", "fix"].includes(object.command) ||
  (object.command == "set" && pathType(object) !== null);

export const writeEditedStage = (stage) => {
  const objects = stage.objects.flatMap(({ bounds, ...object }) =>
    bounds
      ? [
          {
            command: "bnd",
            a: bounds[0],
            b: bounds[1],
            c: bounds[2],
            d: bounds[3],
          },
          object,
        ]
      : [object],
  );
  // the stage select shows the stage up to its last path object and this many after it
  const lastOnPath = stage.objects.findLastIndex(isPathObject);
  const addons = stage.objects.length - 1 - lastOnPath;
  return writeStage([
    ...stage.settings,
    { command: "addon", count: addons },
    ...objects,
    ...wallsAround(stage.objects),
  ]);
};

// --- where the pieces lie ---

// The extents of every piece's model (as its file has them: x right, z forward), filled in by
// the editor once the models are read (see editor/pieceShapes.js).
export const extents = new Map();

// how many heights the shapes are drawn in, from the ground up
export const HEIGHTS = 4;
// the height (models' units) of the highest band's start
const HIGH = 120;

// A model's extent and its triangles from above ([x, z] corners), sorted into heights.
export const shapeOf = (parsed) => {
  const { vertices, triangles } = parsed;
  const extent = {
    left: Infinity,
    right: -Infinity,
    back: Infinity,
    front: -Infinity,
  };
  for (let i = 0; i < vertices.length; i += 3) {
    extent.left = Math.min(extent.left, vertices[i]);
    extent.right = Math.max(extent.right, vertices[i]);
    extent.back = Math.min(extent.back, vertices[i + 2]);
    extent.front = Math.max(extent.front, vertices[i + 2]);
  }
  const heights = Array.from({ length: HEIGHTS }, () => []);
  // (the triangles: vertex, normal and texture indices each)
  for (let i = 0; i < triangles.length; i += 9) {
    const corners = [triangles[i], triangles[i + 3], triangles[i + 6]];
    const height = corners.reduce((sum, v) => sum + vertices[v * 3 + 1], 0) / 3;
    const band = Math.min(
      HEIGHTS - 1,
      Math.max(0, Math.floor((height / HIGH) * (HEIGHTS - 1) + 0.5)),
    );
    heights[band].push(
      corners.flatMap((v) => [vertices[v * 3], vertices[v * 3 + 2]]),
    );
  }
  return { extent, heights };
};

// A rotation turned further, as the stage files have them: -90 to 180 (the game takes
// only 90 and -90 for sideways, see measure() in loading/stageLoad.js).
export const turned = (rotation, degrees) => {
  const turn = ((((rotation ?? 0) + degrees) % 360) + 360) % 360;
  return turn > 180 ? turn - 360 : turn;
};

const turnOf = (rotation) => (rotation * Math.PI) / 180;

// A point of the object's model (as its file has it) on the map (the stage file's units):
// the game turns the model about its middle and mirrors x twice (building it, and from
// the stage file), which on the map is a turn the other way round.
export const onMap = (object, x, z) => {
  const angle = turnOf(object.rotation ?? 0);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: object.x + 10 * (c * x - s * z),
    z: object.z + 10 * (s * x + c * z),
  };
};

// The object's box on the map, around its model turned.
export const boxOf = (object) => {
  const extent =
    object.command == "pile"
      ? {
          left: -object.width,
          right: object.width,
          back: -object.width,
          front: object.width,
        }
      : (extents.get(object.piece) ?? {
          left: -50,
          right: 50,
          back: -50,
          front: 50,
        });
  const corners = [
    [extent.left, extent.back],
    [extent.right, extent.back],
    [extent.left, extent.front],
    [extent.right, extent.front],
  ].map(([x, z]) =>
    object.command == "pile"
      ? { x: object.x + x, z: object.z + z }
      : onMap(object, x, z),
  );
  return {
    left: Math.min(...corners.map((p) => p.x)),
    right: Math.max(...corners.map((p) => p.x)),
    bottom: Math.min(...corners.map((p) => p.z)),
    top: Math.max(...corners.map((p) => p.z)),
  };
};

// The object last in the file (drawn on top) whose box holds the point, or -1.
export const objectAt = (objects, x, z) => {
  for (let i = objects.length - 1; i >= 0; i--) {
    const box = boxOf(objects[i]);
    if (x >= box.left && x <= box.right && z >= box.bottom && z <= box.top) {
      return i;
    }
  }
  return -1;
};

// The ends a piece joins others at, on the map: where and which way out. Straight pieces
// join at their back and front, the turns at their back and their side.
export const endsOf = (object) => {
  const extent = extents.get(object.piece);
  if (object.command != "set" || !extent || !JOINED.includes(object.piece)) {
    return [];
  }
  const ends = [
    [0, extent.back, 0, -1],
    TURNS.includes(object.piece)
      ? [extent.right, 0, 1, 0]
      : [0, extent.front, 0, 1],
  ];
  return ends.map(([x, z, outX, outZ]) => {
    const at = onMap(object, x, z);
    const tip = onMap(object, x + outX, z + outZ);
    return {
      x: at.x,
      z: at.z,
      outX: (tip.x - at.x) / 10,
      outZ: (tip.z - at.z) / 10,
    };
  });
};

// Where the object goes to join another's end within reach: one of its ends on that
// end, facing it. Returns the object's new x and z, the other object and whether it was
// the other's front (or a turn's side) it joined, or null.
export const snapToEnds = (object, others, reach) => {
  let best = null;
  let bestDistance = reach;
  for (const end of endsOf(object)) {
    for (const other of others) {
      for (const [atFront, otherEnd] of endsOf(other).entries()) {
        // facing each other
        if (end.outX * otherEnd.outX + end.outZ * otherEnd.outZ > -0.99) {
          continue;
        }
        const distance = Math.hypot(otherEnd.x - end.x, otherEnd.z - end.z);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = {
            x: object.x + otherEnd.x - end.x,
            z: object.z + otherEnd.z - end.z,
            other,
            atFront: atFront == 1,
          };
        }
      }
    }
  }
  return best;
};

// --- the path ---

// The kinds of path point a piece can be (its suffix in the stage file) and what the
// cars of the AI make of them.
export const PATH_KINDS = [
  ["", "Not on the path"],
  ["p", "Path point"],
  ["pt", "Corner the AI may cut"],
  ["pr", "Ramp the AI drives straight at"],
  ["po", "Path point the AI may leave out"],
  ["ph", "Halfpipe the AI drives back over"],
];

const atStart = (object) => [47, 48].includes(object.piece);

// Where a new object goes in the file, and so on the path: a piece joined to another's
// front right after it, to its back right before it; a checkpoint right after the piece
// it stands on; anything else after everything.
export const placeInOrder = (objects, object, joined) => {
  let index = objects.length;
  if (joined && isPathObject(object)) {
    const other = objects.indexOf(joined.other);
    index = joined.atFront ? other + 1 : other;
  } else if (object.command == "chk") {
    const under = objects.findLastIndex(
      (o) => o.command == "set" && isPathObject(o) && isUnder(o, object),
    );
    if (under >= 0) {
      index = under + 1;
    }
  }
  objects.splice(index, 0, object);
  return index;
};

const isUnder = (piece, object) => {
  const box = boxOf(piece);
  return (
    object.x >= box.left &&
    object.x <= box.right &&
    object.z >= box.bottom &&
    object.z <= box.top
  );
};

// Moves the object to right after another in the file (to the front for -1); returns
// where it is now.
export const moveAfter = (objects, index, after) => {
  const [object] = objects.splice(index, 1);
  const target = after < 0 ? 0 : after < index ? after + 1 : after;
  objects.splice(target, 0, object);
  return target;
};

// Moves a path object a step earlier (-1) or later (1) along the path; returns where it
// is now.
export const stepAlongPath = (objects, index, step) => {
  const onPath = objects
    .map((object, i) => (isPathObject(object) ? i : -1))
    .filter((i) => i >= 0);
  const k = onPath.indexOf(index);
  const other = onPath[k + step];
  if (k < 0 || other === undefined) {
    return index;
  }
  [objects[index], objects[other]] = [objects[other], objects[index]];
  return other;
};

// What keeps the stage from racing well, each with the object it is about (or -1).
export const problemsOf = ({ objects }) => {
  const problems = [];
  const path = objects
    .map((object, index) => ({ object, index }))
    .filter(({ object }) => isPathObject(object) && object.command != "fix");
  // (the cars line up at the middle of the map, driving up)
  if (
    objectAt(
      objects.filter((o) => o.command == "set"),
      0,
      0,
    ) < 0
  ) {
    problems.push({
      text: "No road under the start grid in the middle of the map.",
      index: -1,
    });
  }
  if (path.length > 0 && !atStart(path[0].object)) {
    problems.push({
      text: "The path should begin on a start piece.",
      index: path[0].index,
    });
  }
  if (!objects.some((object) => object.command == "chk")) {
    problems.push({
      text: "A lap needs at least one checkpoint.",
      index: -1,
    });
  }
  if (path.length < 3) {
    problems.push({
      text: "The path needs at least three points to go round.",
      index: -1,
    });
  }
  return problems;
};
