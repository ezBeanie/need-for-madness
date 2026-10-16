// Mouse and touch on the 2D canvas: where the pointers are (several when touching with
// several fingers) and whether one is down.
export const pointer = { x: [], y: [], count: 0, down: false };

const positions = (canvas, touches) => {
  const rect = canvas.getBoundingClientRect();
  pointer.count = 0;
  for (const touch of touches) {
    pointer.x[pointer.count] = touch.clientX - rect.left;
    pointer.y[pointer.count] = touch.clientY - rect.top;
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
    },
    false,
  );
  const releaseMouse = () => {
    pointer.down = false;
    onRelease();
  };
  canvas.addEventListener("mouseup", releaseMouse, false);
  canvas.addEventListener("mouseout", releaseMouse, false);
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
    },
    false,
  );
  canvas.addEventListener(
    "touchend",
    (event) => {
      event.preventDefault();
      positions(canvas, event.touches);
      if (!keepPressedWhileTouching() || pointer.count == 0) {
        pointer.down = false;
        onRelease();
      }
    },
    false,
  );
};
