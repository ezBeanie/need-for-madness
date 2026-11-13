// The stage editor: the stage seen from above, pieces picked from a palette and placed,
// moved, turned and taken away with the mouse and keys, roads joining end to end. It sits
// over the game in a dialog of its own, so the game's keys stay away while it is open; the
// stage being edited is kept in the browser as it changes.

import { PHASE, game } from "../core/state.js";
import { onLanguage, t } from "../core/language.js";
import {
  FIRST_OWN_STAGE,
  LAST_STAGE,
  customStage,
  stageFile,
} from "../data/stages.js";
import { AFTER_LOAD, STAGE_LOAD, stageLoad } from "../loading/stageLoad.js";
import { track } from "../race/track.js";
import { classicMenus } from "../render/look.js";
import { fetchText } from "../render/models.js";
import { loadSetting, loadText, saveSetting } from "../core/storage.js";
import { menu } from "../screens/menuState.js";
import { loadShapes, shapes } from "./pieceShapes.js";
import {
  flightDrag,
  flightKey,
  flightPointer,
  flightTick,
  flightWheel,
  showFlight,
  showStageText,
} from "./editorFlight.js";
import { editorView } from "./editorView.js";
import { piecePreview } from "../render/piecePreview.js";
import { pageBox, pagePoint } from "../ui/view.js";
import {
  HEIGHTS,
  PATH_KINDS,
  PIECE_GROUPS,
  boxOf,
  copyLook,
  fromOriginal,
  orderPathByPlace,
  reversePath,
  isPathPoint,
  moveAfter,
  nameOf,
  newObject,
  objectAt,
  pieceName,
  placeInOrder,
  problemsOf,
  readEditedStage,
  setSetting,
  settingOf,
  snapToEnds,
  stepAlongPath,
  turned,
  wallsAround,
  writeEditedStage,
} from "./stageModel.js";

const element = (id) => document.getElementById(id);
const button = element("stageEditorButton");
const dialog = element("stageEditor");
const map = element("editorMap");
// (asked for once the editor first opens)
let draw2D = null;

// the player's stages (their texts, as a list), and which of them the editor last had
const STAGES = "myStages";
const OPEN = "myStageOpen";
// (before there was a list, the editor kept the one stage it edited)
const DRAFT = "stageEditorDraft";

const NEW_STAGE = `name(My Stage)
snap(20,0,-10)
sky(120,180,255)
fog(240,190,141)
clouds(255,255,255,2)
ground(189,175,145,2,-0.1,0.7)
distfog(10000)
nlaps(3)
set(47,0,0,0)p
`;

// how close (screen pixels) a piece's end comes to another's before they join
const SNAP_REACH = 24;
// without an end to join, pieces lie on a grid this fine (the stage file's units)
const GRID = 100;
const UNDO_STEPS = 100;

const editor = {
  stage: readEditedStage(NEW_STAGE),
  selected: -1,
  // the piece the palette picked, placed where clicked until Escape
  placing: null,
  // putting the path in order: each piece clicked follows the one clicked before
  ordering: null,
  // which of the player's stages (customStage.texts) is being edited
  current: 0,
  // the stage is being test driven: the editor comes back with the main menu
  testing: false,
  // the map's middle (the stage file's units) and its pixels per unit
  view: { x: 0, z: 0, scale: 0.02 },
  undo: [],
  redo: [],
};

// what the pointers are doing: dragging a piece, panning, or pinching with two fingers
const pointers = new Map();
let drag = null;

// --- the stage, its changes and undoing them ---

const saveStages = () => {
  saveSetting(STAGES, JSON.stringify(customStage.texts));
  saveSetting(OPEN, editor.current);
};

const save = () => {
  customStage.texts[editor.current] = writeEditedStage(editor.stage);
  saveStages();
};

// The player's stages from the browser, for the editor and the stage select.
const loadStages = () => {
  try {
    const texts = JSON.parse(loadText(STAGES) || "[]");
    customStage.texts = Array.isArray(texts)
      ? texts.filter((text) => typeof text == "string")
      : [];
  } catch {
    customStage.texts = [];
  }
  const draft = loadText(DRAFT);
  if (customStage.texts.length == 0 && draft) {
    customStage.texts = [draft];
  }
};

// Edits another of the player's stages, from scratch.
const edit = (index) => {
  editor.current = index;
  editor.stage = readEditedStage(customStage.texts[index]);
  editor.selected = -1;
  editor.undo = [];
  editor.redo = [];
  saveStages();
  fitView();
  changed();
};

// A stage added to the player's, and edited.
const addStage = (text) => {
  customStage.texts.push(text);
  edit(customStage.texts.length - 1);
  showStages();
};

// Keeps the stage as it is before a change, for undo.
const remember = () => {
  editor.undo.push(JSON.stringify(editor.stage));
  editor.undo.splice(0, editor.undo.length - UNDO_STEPS);
  editor.redo = [];
};

const changed = () => {
  save();
  showName();
  showState();
  showSelected();
  drawMap();
  showIn3D();
};

// The piece about to be placed, or the one selected, in 3D as it lies on the map.
const showPreview = () => {
  const object = editor.placing ?? selected();
  piecePreview.canvas = element("editorPiecePreview");
  piecePreview.piece = object?.piece ?? -1;
  piecePreview.rotation = object?.rotation ?? 0;
  element("editorPreview").hidden = !object;
};

// --- the 3D view ---

// What the 3D view shows: the stage as it is, the selected piece standing out (the game's
// units: the stage file's tenths, x the other way).
const showIn3D = () => {
  showStageText(writeEditedStage(editor.stage));
  const object = selected();
  editorView.marked =
    object && object.command != "fix"
      ? { typ: object.piece, x: -object.x / 10, z: object.z / 10 }
      : null;
};

const toggle3D = () => {
  const shown = !editorView.shown;
  if (shown) {
    // (the stage's own number: what it reads from its file depends on it)
    track.stage = FIRST_OWN_STAGE + editor.current;
    editor.placing = null;
    editor.ordering = null;
    showIn3D();
  }
  const start = selected() ?? editor.stage.objects.find(isPathPoint) ?? null;
  showFlight(shown, start);
  dialog.classList.toggle("three-d", shown);
  map.setAttribute(
    "aria-label",
    t(shown ? "The stage in 3D, flown over" : "The stage from above"),
  );
  showState();
  drawMap();
};

// The 3D view, the camera behind the selected piece.
const seeIn3D = () => {
  if (editorView.shown) {
    showFlight(true, selected());
  } else {
    toggle3D();
  }
};

// Every tick while the editor is open.
export const stageEditorTick = () => flightTick();

const undoOrRedo = (from, to) => {
  if (from.length == 0) {
    return;
  }
  to.push(JSON.stringify(editor.stage));
  editor.stage = JSON.parse(from.pop());
  editor.selected = -1;
  changed();
};

const nameEntry = () =>
  editor.stage.settings.find((entry) => entry.command == "name");

const showName = () => {
  const name = nameEntry()?.name ?? "";
  if (element("editorName").value != name) {
    element("editorName").value = name;
  }
};

const selected = () => editor.stage.objects[editor.selected];

const rotateSelected = (degrees) => {
  if (editor.placing) {
    editor.placing.rotation = turned(editor.placing.rotation, degrees);
    showPreview();
    drawMap();
    return;
  }
  if (!selected()) {
    return;
  }
  remember();
  selected().rotation = turned(selected().rotation, degrees);
  changed();
};

const deleteSelected = () => {
  if (!selected()) {
    return;
  }
  remember();
  editor.stage.objects.splice(editor.selected, 1);
  editor.selected = -1;
  changed();
};

// Selects the object (-1 none), the map moved to it if it is out of sight.
const select = (index) => {
  editor.selected = index;
  const object = selected();
  if (object) {
    const at = toScreen(object.x, object.z);
    if (at.x < 0 || at.y < 0 || at.x > map.width || at.y > map.height) {
      editor.view.x = object.x;
      editor.view.z = object.z;
    }
  }
  showState();
  showSelected();
  drawMap();
};

const moveSelected = (dx, dz) => {
  if (!selected()) {
    return;
  }
  remember();
  selected().x += dx;
  selected().z += dz;
  changed();
};

// Another of the selected piece to place, turned as it is.
const placeAnother = () => {
  const object = selected();
  if (object?.piece === undefined) {
    return;
  }
  startPlacing(object.piece);
  editor.placing.rotation = object.rotation ?? 0;
};

// --- the map ---

const toScreen = (x, z) => ({
  x: map.width / 2 + (x - editor.view.x) * editor.view.scale,
  y: map.height / 2 - (z - editor.view.z) * editor.view.scale,
});

const toStage = (sx, sy) => ({
  x: editor.view.x + (sx - map.width / 2) / editor.view.scale,
  z: editor.view.z - (sy - map.height / 2) / editor.view.scale,
});

// the pointer on the map, in the canvas's pixels
const pointerOnMap = (event) => {
  const box = pageBox(map);
  const { x, y } = pagePoint(event.clientX, event.clientY);
  return {
    x: ((x - box.left) * map.width) / box.width,
    y: ((y - box.top) * map.height) / box.height,
  };
};

const COLORS = {
  set: ["#4b5563", "#6b7280", "#9ca3af", "#d1d5db"],
  chk: ["#0e7490", "#06b6d4", "#67e8f9", "#cffafe"],
  fix: ["#a16207", "#eab308", "#fde047", "#fef9c3"],
  scenery: ["#166534", "#22c55e", "#86efac", "#dcfce7"],
};
const SCENERY = PIECE_GROUPS.find(
  (group) => group.name == "Scenery",
).pieces.map(([piece]) => piece);

const colorsOf = (object) =>
  SCENERY.includes(object.piece)
    ? COLORS.scenery
    : (COLORS[object.command] ?? COLORS.set);

const drawObject = (object, alpha = 1) => {
  const k = editor.view.scale;
  if (object.command == "pile") {
    const at = toScreen(object.x, object.z);
    draw2D.fillStyle = "#8b6b4a";
    draw2D.beginPath();
    draw2D.arc(at.x, at.y, object.width * k, 0, 2 * Math.PI);
    draw2D.fill();
    return;
  }
  const shape = shapes.get(object.piece);
  if (!shape) {
    return;
  }
  // the model's points (as its file has them) on screen, see onMap
  const angle = ((object.rotation ?? 0) * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const at = toScreen(object.x, object.z);
  draw2D.setTransform(
    10 * k * c,
    -10 * k * s,
    -10 * k * s,
    -10 * k * c,
    at.x,
    at.y,
  );
  draw2D.globalAlpha = alpha;
  const colors = colorsOf(object);
  for (let h = 0; h < HEIGHTS; h++) {
    draw2D.fillStyle = colors[h];
    draw2D.fill(shape.heights[h]);
  }
  draw2D.setTransform(1, 0, 0, 1, 0, 0);
  draw2D.globalAlpha = 1;
};

const drawGrid = () => {
  // a line every wall piece's length, as the walls go
  const step = 4800;
  const from = toStage(0, map.height);
  const to = toStage(map.width, 0);
  draw2D.strokeStyle = "rgba(255, 255, 255, 0.07)";
  draw2D.lineWidth = 1;
  draw2D.beginPath();
  for (let x = Math.ceil(from.x / step) * step; x <= to.x; x += step) {
    const sx = toScreen(x, 0).x;
    draw2D.moveTo(sx, 0);
    draw2D.lineTo(sx, map.height);
  }
  for (let z = Math.ceil(from.z / step) * step; z <= to.z; z += step) {
    const sy = toScreen(0, z).y;
    draw2D.moveTo(0, sy);
    draw2D.lineTo(map.width, sy);
  }
  draw2D.stroke();
};

const drawWalls = () => {
  const walls = Object.fromEntries(
    wallsAround(editor.stage.objects).map((wall) => [wall.command, wall]),
  );
  if (!walls.maxl) {
    return;
  }
  const corner = toScreen(walls.maxl.limit, walls.maxt.limit);
  const other = toScreen(walls.maxr.limit, walls.maxb.limit);
  draw2D.strokeStyle = "rgba(255, 120, 90, 0.8)";
  draw2D.lineWidth = 3;
  draw2D.setLineDash([12, 8]);
  draw2D.strokeRect(corner.x, corner.y, other.x - corner.x, other.y - corner.y);
  draw2D.setLineDash([]);
};

// The path through its points in file order, the way the cars go round.
const drawPath = () => {
  const points = editor.stage.objects
    .filter(isPathPoint)
    .map((object) => toScreen(object.x, object.z));
  if (points.length < 2) {
    return;
  }
  draw2D.strokeStyle = "rgba(1, 234, 255, 0.9)";
  draw2D.fillStyle = "rgba(1, 234, 255, 0.9)";
  draw2D.lineWidth = 2;
  draw2D.beginPath();
  points.forEach((p, i) =>
    i ? draw2D.lineTo(p.x, p.y) : draw2D.moveTo(p.x, p.y),
  );
  draw2D.closePath();
  draw2D.stroke();
  // an arrow halfway along each stretch
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    const angle = Math.atan2(q.y - p.y, q.x - p.x);
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    draw2D.beginPath();
    draw2D.moveTo(mx + 8 * Math.cos(angle), my + 8 * Math.sin(angle));
    draw2D.lineTo(
      mx + 6 * Math.cos(angle + 2.5),
      my + 6 * Math.sin(angle + 2.5),
    );
    draw2D.lineTo(
      mx + 6 * Math.cos(angle - 2.5),
      my + 6 * Math.sin(angle - 2.5),
    );
    draw2D.fill();
  });
  // the start
  draw2D.fillStyle = "#ffffff";
  draw2D.fillRect(points[0].x - 5, points[0].y - 5, 10, 10);
};

// Every point's place on the path, beside it.
const drawPathNumbers = () => {
  draw2D.font = "bold 11px verd, Verdana, sans-serif";
  draw2D.textAlign = "left";
  draw2D.textBaseline = "bottom";
  draw2D.lineWidth = 3;
  draw2D.strokeStyle = "#0b1a10";
  draw2D.fillStyle = "rgb(1, 234, 255)";
  editor.stage.objects.filter(isPathPoint).forEach((object, i) => {
    const at = toScreen(object.x, object.z);
    draw2D.strokeText(String(i + 1), at.x + 8, at.y - 6);
    draw2D.fillText(String(i + 1), at.x + 8, at.y - 6);
  });
};

const drawCheckpointNumbers = () => {
  let number = 0;
  draw2D.font = "bold 13px verd, Verdana, sans-serif";
  draw2D.textAlign = "center";
  draw2D.textBaseline = "middle";
  for (const object of editor.stage.objects) {
    if (object.command != "chk") {
      continue;
    }
    number++;
    const at = toScreen(object.x, object.z);
    draw2D.fillStyle = "#003040";
    draw2D.beginPath();
    draw2D.arc(at.x, at.y, 10, 0, 2 * Math.PI);
    draw2D.fill();
    draw2D.fillStyle = "#ffffff";
    draw2D.fillText(String(number), at.x, at.y + 1);
  }
};

// The cars line up at the middle of the map, driving up: three rows of their fronts.
const drawStartGrid = () => {
  const k = editor.view.scale;
  draw2D.fillStyle = "rgba(255, 255, 255, 0.85)";
  for (let i = 0; i < 7; i++) {
    const at = toScreen([0, -350, 350][i % 3], -Math.ceil(i / 3) * 700 + 400);
    const size = Math.max(3, 150 * k);
    draw2D.beginPath();
    draw2D.moveTo(at.x, at.y - size);
    draw2D.lineTo(at.x + size * 0.7, at.y + size);
    draw2D.lineTo(at.x - size * 0.7, at.y + size);
    draw2D.fill();
  }
};

const outline = (object, color) => {
  const box = boxOf(object);
  const corner = toScreen(box.left, box.top);
  const other = toScreen(box.right, box.bottom);
  draw2D.strokeStyle = color;
  draw2D.lineWidth = 2;
  draw2D.strokeRect(
    corner.x - 2,
    corner.y - 2,
    other.x - corner.x + 4,
    other.y - corner.y + 4,
  );
};

export const drawMap = () => {
  if (!dialog.open) {
    return;
  }
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(map.clientWidth * ratio);
  const height = Math.round(map.clientHeight * ratio);
  if (map.width != width || map.height != height) {
    map.width = width;
    map.height = height;
  }
  draw2D.setTransform(1, 0, 0, 1, 0, 0);
  // (the 3D view shows through)
  if (editorView.shown) {
    draw2D.clearRect(0, 0, map.width, map.height);
    return;
  }
  draw2D.fillStyle = "#1c2a1f";
  draw2D.fillRect(0, 0, map.width, map.height);
  drawGrid();
  drawWalls();
  editor.stage.objects.forEach((object) => drawObject(object));
  drawStartGrid();
  drawPath();
  drawPathNumbers();
  drawCheckpointNumbers();
  if (selected()) {
    outline(selected(), "#ffe14a");
  }
  if (editor.placing?.at) {
    drawObject(editor.placing.at, 0.6);
  }
};

// The view that shows the whole stage.
const fitView = () => {
  const boxes = editor.stage.objects.map(boxOf);
  if (boxes.length == 0) {
    editor.view = { x: 0, z: 0, scale: 0.02 };
    return;
  }
  const left = Math.min(...boxes.map((b) => b.left));
  const right = Math.max(...boxes.map((b) => b.right));
  const bottom = Math.min(...boxes.map((b) => b.bottom));
  const top = Math.max(...boxes.map((b) => b.top));
  const ratio = window.devicePixelRatio || 1;
  const width = map.clientWidth * ratio;
  const height = map.clientHeight * ratio;
  editor.view = {
    x: (left + right) / 2,
    z: (bottom + top) / 2,
    scale: Math.min(
      0.03,
      (0.8 * width) / Math.max(right - left, 1),
      (0.8 * height) / Math.max(top - bottom, 1),
    ),
  };
};

const zoom = (factor, sx, sy) => {
  const before = toStage(sx, sy);
  editor.view.scale = Math.min(
    0.5,
    Math.max(0.002, editor.view.scale * factor),
  );
  const after = toStage(sx, sy);
  editor.view.x += before.x - after.x;
  editor.view.z += before.z - after.z;
  drawMap();
};

const pan = (dx, dy) => {
  editor.view.x -= dx / editor.view.scale;
  editor.view.z += dy / editor.view.scale;
  drawMap();
};

// Where the object goes near the point: joined to another's end if one is close,
// otherwise on the grid. Returns what it joined (see snapToEnds) or null.
const placeNear = (object, x, z, others) => {
  object.x = x;
  object.z = z;
  const joined = snapToEnds(object, others, SNAP_REACH / editor.view.scale);
  if (joined) {
    object.x = Math.round(joined.x);
    object.z = Math.round(joined.z);
  } else {
    object.x = Math.round(x / GRID) * GRID;
    object.z = Math.round(z / GRID) * GRID;
  }
  return joined;
};

// --- what the pointer does ---

const onPointerDown = (event) => {
  map.focus();
  map.setPointerCapture(event.pointerId);
  if (editorView.shown) {
    flightPointer(event, true);
    return;
  }
  const at = pointerOnMap(event);
  pointers.set(event.pointerId, at);
  if (pointers.size == 2) {
    drag = { pinch: true };
    return;
  }
  // the right button stops placing
  if (event.button == 2) {
    stopPlacing();
    return;
  }
  const stageAt = toStage(at.x, at.y);
  if (editor.placing && event.button == 0) {
    const object = editor.placing.at;
    if (object) {
      remember();
      editor.selected = placeInOrder(
        editor.stage.objects,
        { ...object },
        editor.placing.joined,
      );
      changed();
    }
    return;
  }
  const index = objectAt(editor.stage.objects, stageAt.x, stageAt.z);
  if (editor.ordering && index >= 0) {
    orderNext(index);
    return;
  }
  editor.selected = index;
  showSelected();
  if (index >= 0 && event.button == 0) {
    const object = editor.stage.objects[index];
    drag = {
      piece: index,
      from: JSON.stringify(editor.stage),
      dx: object.x - stageAt.x,
      dz: object.z - stageAt.z,
      moved: false,
    };
  } else {
    drag = { pan: true, x: at.x, y: at.y };
  }
  showState();
  drawMap();
};

const onPointerMove = (event) => {
  if (editorView.shown) {
    flightDrag(event);
    return;
  }
  const at = pointerOnMap(event);
  const before = pointers.get(event.pointerId);
  if (before) {
    pointers.set(event.pointerId, at);
  }
  if (drag?.pinch && pointers.size == 2 && before) {
    const [a, b] = [...pointers.values()];
    const other = a === at ? b : a;
    const was = Math.hypot(before.x - other.x, before.y - other.y);
    const now = Math.hypot(at.x - other.x, at.y - other.y);
    pan((at.x - before.x) / 2, (at.y - before.y) / 2);
    if (was > 0) {
      zoom(now / was, (at.x + other.x) / 2, (at.y + other.y) / 2);
    }
    return;
  }
  const stageAt = toStage(at.x, at.y);
  if (editor.placing) {
    const object = newObject(
      editor.placing.piece,
      0,
      0,
      editor.placing.rotation,
    );
    editor.placing.joined = placeNear(
      object,
      stageAt.x,
      stageAt.z,
      editor.stage.objects,
    );
    editor.placing.at = object;
    drawMap();
    return;
  }
  if (drag?.pan) {
    pan(at.x - drag.x, at.y - drag.y);
    drag.x = at.x;
    drag.y = at.y;
    return;
  }
  if (drag?.piece >= 0) {
    const object = editor.stage.objects[drag.piece];
    const others = editor.stage.objects.filter((o) => o !== object);
    placeNear(object, stageAt.x + drag.dx, stageAt.z + drag.dz, others);
    drag.moved = true;
    drawMap();
  }
};

const onPointerUp = (event) => {
  if (editorView.shown) {
    flightPointer(event, false);
    return;
  }
  pointers.delete(event.pointerId);
  if (drag?.piece >= 0 && drag.moved) {
    editor.undo.push(drag.from);
    editor.redo = [];
    changed();
  }
  if (pointers.size == 0) {
    drag = null;
  }
};

const onWheel = (event) => {
  event.preventDefault();
  if (editorView.shown) {
    flightWheel(event);
    return;
  }
  const at = pointerOnMap(event);
  zoom(Math.exp(-event.deltaY * 0.002), at.x, at.y);
};

// --- the palette ---

const startPlacing = (piece) => {
  // (pieces are placed on the map)
  if (editorView.shown) {
    toggle3D();
  }
  editor.placing = { piece, rotation: 0, at: null, joined: null };
  editor.ordering = null;
  editor.selected = -1;
  showState();
  showSelected();
  map.focus();
};

const stopPlacing = () => {
  editor.placing = null;
  showState();
  drawMap();
};

// a piece's picture in the palette, its shape fitted in
const drawIcon = (canvas, piece) => {
  const shape = shapes.get(piece);
  if (!shape) {
    return;
  }
  const context = canvas.getContext("2d");
  const { left, right, back, front } = shape.extent;
  const size = canvas.width;
  const k = (0.85 * size) / Math.max(right - left, front - back, 1);
  context.clearRect(0, 0, size, size);
  context.setTransform(
    k,
    0,
    0,
    -k,
    size / 2 - (k * (left + right)) / 2,
    size / 2 + (k * (back + front)) / 2,
  );
  const colors = colorsOf(newObject(piece, 0, 0, 0));
  for (let h = 0; h < HEIGHTS; h++) {
    context.fillStyle = colors[h];
    context.fill(shape.heights[h]);
  }
};

const icons = new Map();

// (a piece's name may be a word the editor uses otherwise: "Turn")
const pieceText = (name) => t(`${name}|piece`);

const buildPalette = () => {
  const palette = element("editorPalette");
  if (palette.childElementCount > 0) {
    return;
  }
  for (const group of PIECE_GROUPS) {
    const heading = document.createElement("h3");
    heading.textContent = t(`${group.name}|piece`);
    const list = document.createElement("ul");
    for (const [piece, name] of group.pieces) {
      const item = document.createElement("li");
      const pick = document.createElement("button");
      pick.type = "button";
      pick.dataset.piece = piece;
      const icon = document.createElement("canvas");
      icon.width = 48;
      icon.height = 48;
      icon.setAttribute("aria-hidden", "true");
      icons.set(piece, icon);
      const label = document.createElement("span");
      label.textContent = pieceText(name);
      pick.append(icon, label);
      pick.addEventListener("click", () => startPlacing(piece));
      item.append(pick);
      list.append(item);
    }
    palette.append(heading, list);
  }
};

const showState = () => {
  for (const pick of element("editorPalette").querySelectorAll("button")) {
    pick.setAttribute(
      "aria-pressed",
      String(editor.placing?.piece == pick.dataset.piece),
    );
  }
  element("editorOrder").setAttribute(
    "aria-pressed",
    String(!!editor.ordering),
  );
  element("editor3D").setAttribute("aria-pressed", String(editorView.shown));
  showPreview();
  showPath();
  element("editorRotate").disabled = !selected() && !editor.placing;
  element("editorDelete").disabled = !selected();
  element("editorTestDrive").disabled = problemsOf(editor.stage).length > 0;
  element("editorUndo").disabled = editor.undo.length == 0;
  element("editorRedo").disabled = editor.redo.length == 0;
  const pieces = editor.stage.objects.length;
  const text = editorView.shown
    ? t(
        "3D view: W A S D to fly, Q and E down and up, Shift faster, drag to look round, scroll forward and back. V for the map.",
      )
    : editor.ordering
      ? t(
          "Ordering the path: click the pieces in the order the cars drive them, the start first. Escape to stop.",
        )
      : editor.placing
        ? t("Placing {piece}: click to place, R to turn, Escape to stop.", {
            piece: pieceText(pieceName(editor.placing.piece)),
          })
        : selected()
          ? t(
              "{piece} selected: drag or arrow keys to move, R to turn, D for another, Del to take away, , and . along the path.",
              { piece: pieceText(pieceName(selected().piece ?? 0)) },
            )
          : t(
              pieces == 1
                ? "1 piece. Pick a piece on the left, drag the map to look around, scroll to zoom. ? for the keys and how the path works."
                : "{pieces} pieces. Pick a piece on the left, drag the map to look around, scroll to zoom. ? for the keys and how the path works.",
              { pieces },
            );
  const status = element("editorStatus");
  if (status.textContent != text) {
    status.textContent = text;
  }
  showProblems();
};

// --- the path's order ---

const startOrdering = () => {
  editor.placing = null;
  editor.ordering = editor.ordering ? null : { last: -1 };
  showState();
  drawMap();
};

const stopOrdering = () => {
  editor.ordering = null;
  showState();
};

// The piece clicked follows the one clicked before (the first goes to the front).
const orderNext = (index) => {
  if (!isPathPoint(editor.stage.objects[index])) {
    return;
  }
  remember();
  editor.selected = moveAfter(
    editor.stage.objects,
    index,
    editor.ordering.last,
  );
  editor.ordering.last = editor.selected;
  changed();
};

const step = (steps) => {
  remember();
  editor.selected = stepAlongPath(editor.stage.objects, editor.selected, steps);
  changed();
};

const onPathSelected = () => selected() && isPathPoint(selected());

// The point before or after the selected one on the path, round the lap.
const selectAlongPath = (steps) => {
  const onPath = editor.stage.objects
    .map((object, i) => (isPathPoint(object) ? i : -1))
    .filter((i) => i >= 0);
  if (onPath.length == 0) {
    return;
  }
  const k = onPath.indexOf(editor.selected);
  select(onPath[k < 0 ? 0 : (k + steps + onPath.length) % onPath.length]);
};

// The selected piece's next kind of path point.
const nextPathKind = () => {
  const object = selected();
  if (object?.command != "set") {
    return;
  }
  const kinds = PATH_KINDS.map(([suffix]) => suffix);
  const kind = kinds[(kinds.indexOf(object.suffix ?? "") + 1) % kinds.length];
  remember();
  if (kind) {
    object.suffix = kind;
  } else {
    delete object.suffix;
  }
  changed();
};

// the list's button to focus once it is shown anew (the point moved keeps it)
let pathFocus = null;

// The path's points as a list: each selects its piece, and moves a step earlier or later.
const showPath = () => {
  const list = element("editorPath");
  const points = editor.stage.objects
    .map((object, index) => ({ object, index }))
    .filter(({ object }) => isPathPoint(object));
  list.replaceChildren(
    ...points.map(({ object, index }, k) => {
      const item = field("li");
      const kind = PATH_KINDS.find(([suffix]) => suffix == object.suffix)?.[1];
      const name = `${k + 1}. ${pieceText(pieceName(object.piece ?? 0))}`;
      const pick = field("button", {
        type: "button",
        // (the first is the start, whatever piece it is)
        textContent:
          k == 0 && !/start/i.test(name) ? t("{name} (start)", { name }) : name,
        title: kind ? t(kind) : "",
      });
      pick.dataset.focus = `pick ${index}`;
      pick.setAttribute("aria-current", String(index == editor.selected));
      pick.addEventListener("click", () => select(index));
      const move = (steps, text, label) => {
        const button = field("button", {
          type: "button",
          className: "step",
          textContent: text,
          disabled: k + steps < 0 || k + steps >= points.length,
        });
        button.setAttribute("aria-label", `${t(label)} ${name}`);
        button.dataset.focus = `${label} ${index}`;
        button.addEventListener("click", () => {
          pathFocus = `${label} ${points[k + steps].index}`;
          editor.selected = index;
          step(steps);
        });
        return button;
      };
      item.append(
        pick,
        move(-1, "\u2191", "Earlier:"),
        move(1, "\u2193", "Later:"),
      );
      return item;
    }),
  );
  if (pathFocus) {
    const button = list.querySelector(`[data-focus="${pathFocus}"]`);
    pathFocus = null;
    // (at the path's end it goes the other way)
    (button?.disabled
      ? (button.nextElementSibling ?? button.previousElementSibling)
      : button
    )?.focus();
  }
};

const changePath = (change) => {
  remember();
  const object = selected();
  change(editor.stage.objects);
  editor.selected = editor.stage.objects.indexOf(object);
  changed();
};

const makeStart = () => {
  remember();
  editor.selected = moveAfter(editor.stage.objects, editor.selected, -1);
  changed();
};

// --- the selected piece and the stage's problems ---

const field = (tag, properties) =>
  Object.assign(document.createElement(tag), properties);

// A labelled field for the selected piece, changing it as it changes.
const labelled = (text, control) => {
  const label = field("label", { textContent: text, htmlFor: control.id });
  return [label, control];
};

const heightOf = (object) => -(object.y ?? 0);
// the slider's top (the original's stages go to 6000)
const MOST_HEIGHT = 8000;

const showSelected = () => {
  const panel = element("editorSelected");
  const focused = document.activeElement?.id;
  panel.replaceChildren();
  const object = selected();
  if (!object) {
    panel.append(field("p", { textContent: t("Nothing selected.") }));
    return;
  }
  panel.append(
    field("p", {
      className: "piece",
      textContent: pieceText(pieceName(object.piece ?? 0)),
    }),
  );
  if (object.command == "set") {
    const kind = field("select", { id: "editorPathKind" });
    for (const [suffix, text] of PATH_KINDS) {
      kind.append(field("option", { value: suffix, textContent: t(text) }));
    }
    kind.value = PATH_KINDS.some(([suffix]) => suffix == (object.suffix ?? ""))
      ? (object.suffix ?? "")
      : "p";
    kind.addEventListener("change", () => {
      remember();
      object.suffix = kind.value || undefined;
      if (!object.suffix) {
        delete object.suffix;
      }
      changed();
    });
    panel.append(...labelled(t("Path"), kind));
  }
  if (object.piece == 64 || object.command == "fix") {
    // (the slider for a feel of it, the number for an exact height)
    const height = field("input", {
      id: "editorHeight",
      type: "number",
      step: 100,
      value: heightOf(object),
    });
    const slider = field("input", {
      id: "editorHeightSlider",
      type: "range",
      min: 0,
      max: MOST_HEIGHT,
      step: 100,
      value: heightOf(object),
    });
    slider.setAttribute("aria-label", t("Height"));
    // (a drag is one change to undo; the panel stays as it is while it lasts)
    let dragging = false;
    slider.addEventListener("input", () => {
      if (!dragging) {
        remember();
        dragging = true;
      }
      object.y = -Number(slider.value);
      height.value = slider.value;
      save();
      drawMap();
      showIn3D();
    });
    slider.addEventListener("change", () => {
      dragging = false;
      changed();
    });
    height.addEventListener("change", () => {
      const value = Math.round(Number(height.value));
      if (Number.isFinite(value)) {
        remember();
        object.y = -value;
        changed();
      }
    });
    panel.append(...labelled(t("Height"), height), slider);
  }
  if (object.command == "fix") {
    const off = field("input", {
      id: "editorFixOff",
      type: "checkbox",
      checked: (object.suffix ?? "").startsWith("s"),
    });
    off.addEventListener("change", () => {
      remember();
      if (off.checked) {
        object.suffix = "s";
      } else {
        delete object.suffix;
      }
      changed();
    });
    const label = field("label", {
      className: "check",
      htmlFor: "editorFixOff",
      textContent: t("Off the path (the AI leaves the path for it)"),
    });
    panel.append(field("div", { className: "row" }));
    panel.lastChild.append(off, label);
  }
  if (isPathPoint(object)) {
    const onPath = editor.stage.objects.filter(isPathPoint);
    const place = onPath.indexOf(object);
    panel.append(
      field("p", {
        textContent:
          place == 0
            ? t("The start of the path, of {points} points.", {
                points: onPath.length,
              })
            : t("Point {point} of {points} on the path.", {
                point: place + 1,
                points: onPath.length,
              }),
      }),
    );
    const buttons = field("div", { className: "row" });
    const earlier = field("button", {
      type: "button",
      id: "editorEarlier",
      textContent: t("Earlier"),
    });
    const later = field("button", {
      type: "button",
      id: "editorLater",
      textContent: t("Later"),
    });
    const start = field("button", {
      type: "button",
      id: "editorMakeStart",
      textContent: t("Make start"),
    });
    earlier.disabled = place == 0;
    later.disabled = place == onPath.length - 1;
    start.disabled = place == 0;
    earlier.addEventListener("click", () => step(-1));
    later.addEventListener("click", () => step(1));
    start.addEventListener("click", makeStart);
    buttons.append(earlier, later, start);
    panel.append(buttons);
  }
  const see = field("button", {
    type: "button",
    id: "editorSeeIn3D",
    textContent: t("See in 3D"),
  });
  see.addEventListener("click", seeIn3D);
  panel.append(field("div", { className: "row" }));
  panel.lastChild.append(see);
  if (focused && element(focused)) {
    element(focused).focus();
  }
};

const showProblems = () => {
  const list = element("editorProblems");
  list.replaceChildren();
  const problems = problemsOf(editor.stage);
  if (problems.length == 0) {
    list.append(
      field("li", { className: "ready", textContent: t("Ready to race.") }),
    );
    return;
  }
  for (const problem of problems) {
    const item = field("li");
    if (problem.index >= 0) {
      const go = field("button", {
        type: "button",
        textContent: t(problem.text),
      });
      go.addEventListener("click", () => select(problem.index));
      item.append(go);
    } else {
      item.textContent = t(problem.text);
    }
    list.append(item);
  }
};

// --- the stage's settings ---

const settings = element("editorSettings");

const hex = (entry) =>
  "#" +
  [entry?.r ?? 0, entry?.g ?? 0, entry?.b ?? 0]
    .map((c) => Math.min(255, Math.max(0, c)).toString(16).padStart(2, "0"))
    .join("");

const rgb = (value) => ({
  r: parseInt(value.slice(1, 3), 16),
  g: parseInt(value.slice(3, 5), 16),
  b: parseInt(value.slice(5, 7), 16),
});

// the settings' fields: which setting, and how the field reads and writes it
const SETTING_FIELDS = [
  [
    "settingLaps",
    "nlaps",
    (e) => e?.laps ?? 3,
    (v) => ({ laps: whole(v, 1, 15) }),
  ],
  [
    "settingLevel",
    "level",
    (e) => e?.level ?? 8,
    (v) => ({ level: Number(v) }),
  ],
  [
    "settingMusic",
    "music",
    (e) => e?.stage ?? 1,
    (v) => ({ stage: Number(v) }),
  ],
  ["settingSky", "sky", hex, rgb],
  ["settingFog", "fog", hex, rgb],
  ["settingGround", "ground", hex, rgb],
  ["settingCloudColor", "clouds", hex, rgb],
  [
    "settingClouds",
    "clouds",
    (e) => e?.type ?? 2,
    (v) => ({ type: Number(v) }),
  ],
  [
    "settingDistance",
    "distfog",
    (e) => e?.distance ?? 10000,
    (v) => ({ distance: whole(v, 4000, 20000) }),
  ],
];

const whole = (value, low, high) =>
  Math.min(high, Math.max(low, Math.round(Number(value) || low)));

const showSettings = () => {
  for (const [id, command, read] of SETTING_FIELDS) {
    element(id).value = String(read(settingOf(editor.stage, command)));
  }
};

const fillStageChoices = () => {
  for (const id of [
    "settingLevel",
    "settingMusic",
    "settingLookFrom",
    "stagesFrom",
  ]) {
    const select = element(id);
    if (select.childElementCount > 0) {
      continue;
    }
    for (let stage = 1; stage <= LAST_STAGE; stage++) {
      select.append(
        field("option", { value: stage, textContent: `Stage ${stage}` }),
      );
    }
  }
};

const openSettings = () => {
  fillStageChoices();
  showSettings();
  settings.showModal?.();
};

const copyLookOf = (stage) =>
  fetchText(stageFile(stage), (text) => {
    remember();
    copyLook(editor.stage, text);
    changed();
    showSettings();
  });

// --- opening and closing ---

// Opens the editor on the stage it last had, or back from a test drive as it was.
export const openStageEditor = () => {
  const back = editor.testing;
  editor.testing = false;
  if (!back) {
    if (customStage.texts.length == 0) {
      customStage.texts.push(NEW_STAGE);
    }
    const last = loadSetting(OPEN);
    editor.current = last >= 0 && last < customStage.texts.length ? last : 0;
    editor.stage = readEditedStage(customStage.texts[editor.current]);
    editor.selected = -1;
    editor.undo = [];
    editor.redo = [];
  }
  editor.placing = null;
  editor.ordering = null;
  game.phase = PHASE.stageEditor;
  draw2D ??= map.getContext("2d");
  buildPalette();
  dialog.showModal?.();
  if (!back) {
    fitView();
  }
  showName();
  showState();
  showSelected();
  drawMap();
  track.stage = FIRST_OWN_STAGE + editor.current;
  showIn3D();
  loadShapes((piece) => {
    const icon = icons.get(piece);
    if (icon) {
      drawIcon(icon, piece);
    }
    drawMap();
  });
};

const close = () => {
  save();
  dialog.close?.();
};

// The stage raced as it is: the stage select shows it turning, PLAY races it.
const testDrive = () => {
  save();
  track.stage = FIRST_OWN_STAGE + editor.current;
  editor.testing = true;
  dialog.close?.();
  stageLoad.after = AFTER_LOAD.stageSelect;
  stageLoad.progress = STAGE_LOAD.requested;
  game.phase = PHASE.stageLoading;
  menu.redraw = true;
};

// --- the player's stages ---

const stagesDialog = element("editorStages");
const helpDialog = element("editorHelp");

const showStages = () => {
  const list = element("editorStageList");
  list.replaceChildren();
  customStage.texts.forEach((text, index) => {
    const item = field("li");
    const name = field("span", {
      className: "name",
      textContent:
        nameOf(text) + (index == editor.current ? t(" (editing)") : ""),
    });
    const row = field("div", { className: "row" });
    const actions = [
      ["Edit", () => edit(index), index == editor.current],
      ["Copy", () => addStage(text)],
      ["Delete", () => deleteStage(index)],
    ];
    for (const [label, act, disabled] of actions) {
      const go = field("button", { type: "button", textContent: t(label) });
      go.setAttribute("aria-label", `${t(label)} ${nameOf(text)}`);
      go.disabled = !!disabled;
      go.addEventListener("click", act);
      row.append(go);
    }
    item.append(name, row);
    list.append(item);
  });
};

const deleteStage = (index) => {
  if (
    !window.confirm(
      t('Delete "{stage}"?', { stage: nameOf(customStage.texts[index]) }),
    )
  ) {
    return;
  }
  customStage.texts.splice(index, 1);
  if (customStage.texts.length == 0) {
    customStage.texts.push(NEW_STAGE);
  }
  edit(Math.min(editor.current, customStage.texts.length - 1));
  showStages();
};

const openStages = () => {
  fillStageChoices();
  showStages();
  stagesDialog.showModal?.();
};

const importStage = (file) => {
  file
    .text()
    .then((text) =>
      addStage(writeEditedStage(readEditedStage(fromOriginal(text)))),
    );
};

const exportStage = () => {
  save();
  const name = nameOf(customStage.texts[editor.current]);
  const link = field("a", {
    href: URL.createObjectURL(
      new Blob([customStage.texts[editor.current]], { type: "text/plain" }),
    ),
    download: `${name.replace(/[^\w -]+/g, "").trim() || "stage"}.txt`,
  });
  link.click();
  URL.revokeObjectURL(link.href);
};

const ARROWS = {
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  arrowup: [0, 1],
  arrowdown: [0, -1],
};

// (the comma and the full stop by where they are, Shift turning them into other
// characters on other keyboards)
const PATH_STEPS = { Comma: -1, Period: 1 };

const onKey = (event) => {
  if (event.target.closest?.("input, select, .menu-dialog")) {
    return;
  }
  if (flightKey(event, true)) {
    event.preventDefault();
    return;
  }
  const key = event.key.toLowerCase();
  const control = event.ctrlKey || event.metaKey;
  const arrow = ARROWS[key];
  const pathStep = PATH_STEPS[event.code];
  if (control) {
    if (key == "z") {
      event.shiftKey
        ? undoOrRedo(editor.redo, editor.undo)
        : undoOrRedo(editor.undo, editor.redo);
    } else if (key == "y") {
      undoOrRedo(editor.redo, editor.undo);
    } else {
      return;
    }
  } else if (key == "r") {
    rotateSelected(event.shiftKey ? -90 : 90);
  } else if (key == "delete" || key == "backspace") {
    deleteSelected();
  } else if (key == "+" || key == "=") {
    zoom(1.25, map.width / 2, map.height / 2);
  } else if (key == "-") {
    zoom(0.8, map.width / 2, map.height / 2);
  } else if (arrow && selected() && !editor.placing) {
    const distance = event.shiftKey ? 10 * GRID : GRID;
    moveSelected(arrow[0] * distance, arrow[1] * distance);
  } else if (arrow) {
    pan(-arrow[0] * 60, arrow[1] * 60);
  } else if (pathStep && event.shiftKey) {
    if (onPathSelected()) {
      step(pathStep);
    }
  } else if (pathStep) {
    selectAlongPath(pathStep);
  } else if (key == "s") {
    if (onPathSelected()) {
      makeStart();
    }
  } else if (key == "p") {
    nextPathKind();
  } else if (key == "d") {
    placeAnother();
  } else if (key == "o") {
    startOrdering();
  } else if (key == "v") {
    toggle3D();
  } else if (key == "f") {
    fitView();
    drawMap();
  } else if (key == "t") {
    if (!element("editorTestDrive").disabled) {
      testDrive();
    }
  } else if (key == "?") {
    helpDialog.showModal?.();
  } else {
    return;
  }
  event.preventDefault();
};

export const installStageEditor = () => {
  button.addEventListener("click", openStageEditor);
  // (the pieces named anew when the editor opens next)
  onLanguage(() => {
    element("editorPalette").replaceChildren();
    icons.clear();
  });
  element("editorClose").addEventListener("click", close);
  loadStages();
  element("editorStagesButton").addEventListener("click", openStages);
  element("stagesNew").addEventListener("click", () => addStage(NEW_STAGE));
  element("stagesCopyGame").addEventListener("click", () =>
    fetchText(stageFile(Number(element("stagesFrom").value)), addStage),
  );
  element("stagesImport").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) {
      importStage(file);
    }
    event.target.value = "";
  });
  element("stagesExport").addEventListener("click", exportStage);
  element("editorUndo").addEventListener("click", () =>
    undoOrRedo(editor.undo, editor.redo),
  );
  element("editorRedo").addEventListener("click", () =>
    undoOrRedo(editor.redo, editor.undo),
  );
  element("editorRotate").addEventListener("click", () => rotateSelected(90));
  element("editorDelete").addEventListener("click", deleteSelected);
  element("editorName").addEventListener("input", (event) => {
    remember();
    const entry = nameEntry();
    if (entry) {
      entry.name = event.target.value;
    } else {
      editor.stage.settings.unshift({
        command: "name",
        name: event.target.value,
      });
    }
    save();
  });
  element("editorOrder").addEventListener("click", startOrdering);
  element("editorSettingsButton").addEventListener("click", openSettings);
  for (const [id, command, , write] of SETTING_FIELDS) {
    element(id).addEventListener("change", (event) => {
      remember();
      setSetting(editor.stage, command, write(event.target.value));
      changed();
      showSettings();
    });
  }
  element("settingCopyLook").addEventListener("click", () =>
    copyLookOf(Number(element("settingLookFrom").value)),
  );
  element("editorHelpButton").addEventListener("click", () =>
    helpDialog.showModal?.(),
  );
  // Escape stops placing or ordering first, then lets go of the selected piece, and
  // closes the editor only then
  dialog.addEventListener("cancel", (event) => {
    if (editor.placing) {
      event.preventDefault();
      stopPlacing();
    } else if (editor.ordering) {
      event.preventDefault();
      stopOrdering();
    } else if (selected()) {
      event.preventDefault();
      select(-1);
    }
  });
  element("editorTestDrive").addEventListener("click", testDrive);
  dialog.addEventListener("close", () => {
    save();
    if (!editor.testing) {
      game.phase = PHASE.mainMenu;
      menu.redraw = true;
    }
  });
  dialog.addEventListener("keydown", onKey);
  dialog.addEventListener("keyup", (event) => flightKey(event, false));
  element("editor3D").addEventListener("click", toggle3D);
  element("editorReverse").addEventListener("click", () =>
    changePath(reversePath),
  );
  element("editorOrderByPlace").addEventListener("click", () =>
    changePath(orderPathByPlace),
  );
  map.addEventListener("pointerdown", onPointerDown);
  map.addEventListener("pointermove", onPointerMove);
  map.addEventListener("pointerup", onPointerUp);
  map.addEventListener("pointercancel", onPointerUp);
  map.addEventListener("pointerleave", () => {
    if (editor.placing) {
      editor.placing.at = null;
      drawMap();
    }
  });
  map.addEventListener("wheel", onWheel, { passive: false });
  map.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("resize", drawMap);
};

// Every tick: the button in the original's main menu only, and the editor back once a test drive
// has come back to the main menu (a race ended or quit).
export const placeStageEditorButton = () => {
  if (editor.testing && game.phase == PHASE.mainMenu) {
    menu.continuesToCarSelect = false;
    openStageEditor();
  }
  // (the main menu has a Stage Editor of its own, the original's has not)
  const hidden = game.phase != PHASE.mainMenu || !classicMenus();
  if (button.hidden != hidden) {
    button.hidden = hidden;
  }
};
