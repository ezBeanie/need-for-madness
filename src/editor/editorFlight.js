// The stage editor's 3D view: the stage being edited, built as a race would have it, seen
// from a free camera flying over it (W A S D, Q and E down and up, Shift faster, the mouse
// dragged to look, its wheel forward and back), as the replay viewer's free camera flies.

import { showStage } from "../loading/stageLoad.js";
import { moveFreeCamera } from "../race/replayViewer.js";
import { camera, startProjection, turnView } from "../render/camera.js";
import { menu } from "../screens/menuState.js";
import { canvas2D, pagePoint, rd } from "../ui/view.js";
import { editorView } from "./editorView.js";

// how far the camera moves and turns a tick (Shift: faster), and per pixel dragged
const MOVE = 18;
const FAST = 4;
const TURN = 2.5;
const DRAG_TURN = 0.25;
// a wheel's notch moves this far
const WHEEL_MOVE = 0.6;
// where the camera starts: behind the start and above it, looking down a little
const START_BACK = 250;
const START_UP = 140;
const START_PITCH = 18;

// the keys held (by their place on the keyboard), the pointer dragged, the wheel turned,
// whether the stage changed since it was built, and whether it ever was (the pieces'
// pictures want its light)
const flight = {
  held: new Set(),
  dragFrom: null,
  wheel: 0,
  stale: true,
  text: "",
  built: false,
};

const FLIGHT_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyQ",
  "KeyE",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
]);

// The stage the view shows, as the stage file's text: built anew on the next tick.
export const showStageText = (text) => {
  if (text != flight.text) {
    flight.text = text;
    flight.stale = true;
  }
};

// The view comes up with the camera behind the start (x, z: the stage file's, its rotation
// in degrees), or goes.
export const showFlight = (shown, start = null) => {
  editorView.shown = shown;
  flight.held.clear();
  flight.dragFrom = null;
  if (!shown || !start) {
    return;
  }
  // (the stage file's x runs the other way; it counts tenths)
  const x = -start.x / 10;
  const z = start.z / 10;
  camera.yaw = 180 - (start.rotation ?? 0);
  camera.pitch = START_PITCH;
  const heading = (camera.yaw * Math.PI) / 180;
  camera.x = x - START_BACK * Math.sin(heading);
  camera.z = z + START_BACK * Math.cos(heading);
  // (a hoop high up is looked at from as high)
  camera.y = -(start.y ?? 0) / 10 + START_UP;
};

// A key pressed or let go while the view is up; whether the flight took it.
export const flightKey = (event, pressed) => {
  if (!editorView.shown || !FLIGHT_KEYS.has(event.code)) {
    return false;
  }
  if (pressed) {
    flight.held.add(event.code);
  } else {
    flight.held.delete(event.code);
  }
  return true;
};

export const flightPointer = (event, down) => {
  if (!down) {
    flight.dragFrom = null;
    return;
  }
  flight.dragFrom = pagePoint(event.clientX, event.clientY);
};

// The pointer moved on the view: dragged, the camera looks round.
export const flightDrag = (event) => {
  if (!flight.dragFrom) {
    return;
  }
  const { x, y } = pagePoint(event.clientX, event.clientY);
  const yaw = (x - flight.dragFrom.x) * DRAG_TURN;
  const pitch = (y - flight.dragFrom.y) * DRAG_TURN;
  flight.dragFrom = { x, y };
  moveFreeCamera(0, 0, 0, yaw, pitch);
};

export const flightWheel = (event) => {
  flight.wheel -= event.deltaY * WHEEL_MOVE;
};

// Every tick of the editor: the stage built if it changed, the camera flown.
export const flightTick = () => {
  if (flight.stale && (editorView.shown || !flight.built)) {
    showStage(flight.text);
    flight.stale = false;
    flight.built = true;
    // (the menus' pictures on the canvas over the 3D one)
    rd.clearRect(0, 0, canvas2D.width, canvas2D.height);
  }
  if (!editorView.shown) {
    return;
  }
  const held = (...codes) =>
    codes.some((code) => flight.held.has(code)) ? 1 : 0;
  const step = MOVE * (held("ShiftLeft", "ShiftRight") ? FAST : 1);
  startProjection();
  moveFreeCamera(
    (held("KeyW", "ArrowUp") - held("KeyS", "ArrowDown")) * step + flight.wheel,
    (held("KeyD") - held("KeyA")) * step,
    (held("KeyE") - held("KeyQ")) * step,
    (held("ArrowRight") - held("ArrowLeft")) * TURN,
    0,
  );
  flight.wheel = 0;
  turnView();
  menu.redraw = true;
};
