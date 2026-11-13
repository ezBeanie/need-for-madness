import { pageBox, pagePoint } from "../ui/view.js";

// Mouse and touch on the 2D canvas: where the pointers are (several when touching with
// several fingers) and whether one is down.
export const pointer = { x: [], y: [], count: 0, down: false };

// Touches and clicks that hardly moved, each where it let go and how long it was down,
// until a screen takes them: one finger's tap while others drive (the pointers above keep
// only the fingers still down).
const taps = [];
const TAP_MOVE = 20;
const KEPT_TAPS = 5;
// a tap older than this when taken is not for the screen taking it
const STALE_MS = 500;
// finger (or "mouse") -> where and when it went down
const downs = new Map();

export const takeTaps = () => {
  const now = performance.now();
  return taps.splice(0).filter(({ at }) => now - at < STALE_MS);
};

// where a pointer is on the canvas, in its pixels
const onCanvas = (canvas, { clientX, clientY }) => {
  const rect = pageBox(canvas);
  const { x, y } = pagePoint(clientX, clientY);
  return { x: x - rect.left, y: y - rect.top };
};

const goDown = (canvas, id, event, time) => {
  downs.set(id, { ...onCanvas(canvas, event), time });
};

const letGo = (canvas, id, event, time) => {
  const down = downs.get(id);
  downs.delete(id);
  const { x, y } = onCanvas(canvas, event);
  if (down && Math.hypot(x - down.x, y - down.y) < TAP_MOVE) {
    taps.push({ x, y, ms: time - down.time, at: time });
    taps.splice(0, taps.length - KEPT_TAPS);
  }
};

const positions = (canvas, touches) => {
  pointer.count = 0;
  for (const touch of touches) {
    const { x, y } = onCanvas(canvas, touch);
    pointer.x[pointer.count] = x;
    pointer.y[pointer.count] = y;
    pointer.count++;
  }
};

// onRelease runs within the release event itself: browsers only allow starting audio there.
// While driving (keepPressedWhileTouching), lifting one finger keeps the others pressing.
export const installPointer = (
  canvas,
  { onRelease, keepPressedWhileTouching },
) => {
  const moveMouse = (event) => positions(canvas, [event]);
  canvas.addEventListener("mousemove", moveMouse, false);
  canvas.addEventListener(
    "mousedown",
    (event) => {
      moveMouse(event);
      pointer.down = true;
      goDown(canvas, "mouse", event, event.timeStamp);
    },
    false,
  );
  const releaseMouse = () => {
    pointer.down = false;
    onRelease();
  };
  canvas.addEventListener(
    "mouseup",
    (event) => {
      letGo(canvas, "mouse", event, event.timeStamp);
      releaseMouse();
    },
    false,
  );
  canvas.addEventListener(
    "mouseout",
    () => {
      downs.delete("mouse");
      releaseMouse();
    },
    false,
  );
  canvas.addEventListener(
    "touchmove",
    (event) => {
      event.preventDefault();
      positions(canvas, event.touches);
    },
    false,
  );
  canvas.addEventListener(
    "touchstart",
    (event) => {
      event.preventDefault();
      positions(canvas, event.touches);
      if (pointer.count > 0) {
        pointer.down = true;
      }
      for (const touch of event.changedTouches) {
        goDown(canvas, touch.identifier, touch, event.timeStamp);
      }
    },
    false,
  );
  canvas.addEventListener(
    "touchend",
    (event) => {
      event.preventDefault();
      positions(canvas, event.touches);
      for (const touch of event.changedTouches) {
        letGo(canvas, touch.identifier, touch, event.timeStamp);
      }
      if (!keepPressedWhileTouching() || pointer.count == 0) {
        pointer.down = false;
        onRelease();
      }
    },
    false,
  );
};
