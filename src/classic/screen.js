// The menus in the classic look, as the original game drew them: into its 800 x 450
// pixels, shown as large as the window allows with black around, unsmoothed. A screen
// with a 3D part (a car, a stage) draws what lies behind it and what lies over it on
// layers of their own; the classic 3D canvas goes between them once it is drawn.
import { pointer } from "../input/pointer.js";
import { canvas3D } from "../render/renderer.js";
import { rd, view } from "../ui/view.js";
import { hsbToRgb, rgbToHsb } from "./color.js";

export const WIDTH = 800;
export const HEIGHT = 450;

const layer = () => {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  return { canvas, g: canvas.getContext("2d") };
};
const behind = layer();
const over = layer();

// g: where the screen draws now; due: drawn this tick, not shown yet
export const screen = { g: behind.g, with3D: false, due: false };

// Starts a screen's picture for this tick: what it draws comes first, behind any 3D.
export const startScreen = () => {
  behind.g.clearRect(0, 0, WIDTH, HEIGHT);
  over.g.clearRect(0, 0, WIDTH, HEIGHT);
  screen.g = behind.g;
  screen.with3D = false;
  screen.due = true;
  readMouse();
};

// What the screen draws from now on lies over its 3D part.
export const over3D = () => {
  screen.g = over.g;
  screen.with3D = true;
};

const fit = () => {
  const scale = Math.min(view.width / WIDTH, view.height / HEIGHT);
  return {
    scale,
    x: (view.width - WIDTH * scale) / 2,
    y: (view.height - HEIGHT * scale) / 2,
  };
};

// Shows the screen drawn this tick, after the 3D canvas was drawn (in the same frame, while
// its picture is still there to copy).
export const presentScreen = () => {
  if (!screen.due) {
    return;
  }
  screen.due = false;
  const { scale, x, y } = fit();
  rd.fillStyle = "#000000";
  rd.fillRect(0, 0, view.width, view.height);
  rd.imageSmoothingEnabled = false;
  rd.drawImage(behind.canvas, x, y, WIDTH * scale, HEIGHT * scale);
  if (screen.with3D) {
    // the 3D canvas is 450 high and as wide as the window's shape; its middle is the
    // screen's, and the original drew within its frame (65..735 x 25..425)
    rd.save();
    rd.beginPath();
    rd.rect(x + 65 * scale, y + 25 * scale, 670 * scale, 400 * scale);
    rd.clip();
    rd.drawImage(
      canvas3D,
      x + (WIDTH / 2 - canvas3D.width / 2) * scale,
      y,
      canvas3D.width * scale,
      canvas3D.height * scale,
    );
    rd.restore();
    rd.drawImage(over.canvas, x, y, WIDTH * scale, HEIGHT * scale);
  }
  rd.imageSmoothingEnabled = true;
};

// --- the mouse, in the screen's pixels ---

// pressed: went down this tick; released: went up this tick; moved: since the last tick
export const mouse = {
  x: -1,
  y: -1,
  down: false,
  pressed: false,
  released: false,
  moved: false,
};

const readMouse = () => {
  const { scale, x, y } = fit();
  // (no mouse yet: far off the screen)
  const mx = ((pointer.x[0] ?? -1e4) - x) / scale;
  const my = ((pointer.y[0] ?? -1e4) - y) / scale;
  mouse.moved = mx != mouse.x || my != mouse.y;
  mouse.x = mx;
  mouse.y = my;
  mouse.pressed = pointer.down && !mouse.down;
  mouse.released = !pointer.down && mouse.down;
  mouse.down = pointer.down;
};

// The original's hit tests: overon a plain rectangle, over an image's with 5 pixels round.
export const overon = (x, y, w, h) =>
  mouse.x > x && mouse.x < x + w && mouse.y > y && mouse.y < y + h;

export const overImage = (image, x, y) =>
  image != null && overon(x - 5, y - 5, image.width + 10, image.height + 10);

// --- the original's pictures, made ready as it loaded them ---

const clamp = (v) => Math.min(255, Math.max(0, Math.trunc(v)));

// how the original made each picture ready (its loadimages)
const PROCESS = {
  plain: () => {},
  // loadBimage: every pixel in one hue and saturation, keeping its brightness
  // (mode 0 leaves the background, the first pixel, as it is)
  tinted: (px, mode) => {
    const hue = mode == 3 ? 0.13 : 0.12;
    const [r0, g0, b0] = [px[0], px[1], px[2]];
    for (let i = 0; i < px.length; i += 4) {
      if (mode != 0 || px[i] != r0 || px[i + 1] != g0 || px[i + 2] != b0) {
        const [, , brightness] = rgbToHsb(px[i], px[i + 1], px[i + 2]);
        [px[i], px[i + 1], px[i + 2]] = hsbToRgb(hue, 0.45, brightness);
        px[i + 3] = 255;
      }
    }
    // mode 2: the first two pixels' colours are see-through holes, a quarter and a half
    if (mode == 2) {
      const first = [px[0], px[1], px[2]];
      const second = [px[4], px[5], px[6]];
      for (let i = 0; i < px.length; i += 4) {
        const is = (c) =>
          px[i] == c[0] && px[i + 1] == c[1] && px[i + 2] == c[2];
        if (is(first)) {
          px[i + 3] = 0x40;
        } else if (is(second)) {
          px[i + 3] = 0x80;
        }
      }
    }
  },
  // bressed: a pressed button, everything but its background light yellow
  pressed: (px) => {
    const last = px.length - 4;
    const background = [px[last], px[last + 1], px[last + 2], px[last + 3]];
    for (let i = 0; i < px.length; i += 4) {
      if (
        px[i] != background[0] ||
        px[i + 1] != background[1] ||
        px[i + 2] != background[2] ||
        px[i + 3] != background[3]
      ) {
        [px[i], px[i + 1], px[i + 2], px[i + 3]] = [247, 255, 165, 255];
      }
    }
  },
  // dodgen: a flash of the picture, much brighter
  bright: (px) => {
    for (let i = 0; i < px.length; i += 4) {
      px[i] = clamp(px[i] * 4 + 90);
      px[i + 1] = clamp(px[i + 1] * 4 + 90);
      px[i + 2] = clamp(px[i + 2] * 4 + 90);
      px[i + 3] = 255;
    }
  },
  // loadude: the green screen behind a figure turns into a black shadow
  keyed: (px) => {
    for (let i = 0; i < px.length; i += 4) {
      const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
      if (g > r + 5 && g > b + 5) {
        px[i + 3] = clamp(
          255 - Math.trunc((g - Math.trunc((r + b) / 2)) * 1.5),
        );
        px[i] = 0;
        px[i + 1] = 0;
        px[i + 2] = 0;
      }
    }
  },
};

const originals = new Map();
const ready = new Map();

const load = (file) => {
  originals.set(file, null);
  const image = new Image();
  image.onload = () => originals.set(file, image);
  image.src = `data/classic/images/${file}`;
};

// The picture in the file, made ready the given way (see PROCESS), once it has loaded.
export const picture = (file, process = "plain", mode = 0) => {
  const key = `${file}:${process}:${mode}`;
  if (ready.has(key)) {
    return ready.get(key);
  }
  if (!originals.has(file)) {
    load(file);
  }
  const image = originals.get(file);
  if (!image) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const g = canvas.getContext("2d");
  g.drawImage(image, 0, 0);
  if (process != "plain") {
    const data = g.getImageData(0, 0, image.width, image.height);
    PROCESS[process](data.data, mode);
    g.putImageData(data, 0, 0);
  }
  ready.set(key, canvas);
  return canvas;
};

// Draws a picture at (x, y) if it has loaded, with an alpha.
export const draw = (image, x, y, alpha = 1) => {
  if (image) {
    screen.g.globalAlpha = alpha;
    screen.g.drawImage(image, x, y);
    screen.g.globalAlpha = 1;
  }
};

// --- the original's drawing ---

export const rgb = ([r, g, b]) => `rgb(${r},${g},${b})`;

export const font = (size) => {
  screen.g.font = `bold ${size}px Arial`;
  screen.g.textBaseline = "alphabetic";
  screen.g.textAlign = "left";
};

export const text = (s, x, y, color) => {
  screen.g.fillStyle = rgb(color);
  screen.g.fillText(s, x, y);
};

// drawcs: a line centred on the screen, its baseline at y, in the current font
export const centred = (y, s, color) => {
  text(s, Math.trunc(400 - screen.g.measureText(s).width / 2), y, color);
};

export const fill = (x, y, w, h, color) => {
  screen.g.fillStyle = rgb(color);
  screen.g.fillRect(x, y, w, h);
};

// Java's fill/drawRoundRect: arcs of arcW x arcH at the corners
const roundRect = (x, y, w, h, arcW, arcH) => {
  const rx = Math.min(arcW / 2, w / 2);
  const ry = Math.min(arcH / 2, h / 2);
  const g = screen.g;
  g.beginPath();
  g.ellipse(x + rx, y + ry, rx, ry, 0, Math.PI, 1.5 * Math.PI);
  g.ellipse(x + w - rx, y + ry, rx, ry, 0, 1.5 * Math.PI, 2 * Math.PI);
  g.ellipse(x + w - rx, y + h - ry, rx, ry, 0, 0, 0.5 * Math.PI);
  g.ellipse(x + rx, y + h - ry, rx, ry, 0, 0.5 * Math.PI, Math.PI);
  g.closePath();
};

export const fillRoundRect = (x, y, w, h, arcW, arcH, color) => {
  roundRect(x, y, w, h, arcW, arcH);
  screen.g.fillStyle = rgb(color);
  screen.g.fill();
};

// (Java strokes one pixel down and right of the outline's coordinates)
export const drawRoundRect = (x, y, w, h, arcW, arcH, color) => {
  roundRect(x + 0.5, y + 0.5, w, h, arcW, arcH);
  screen.g.strokeStyle = rgb(color);
  screen.g.lineWidth = 1;
  screen.g.stroke();
};

// The black around the original's 670 x 400.
export const drawFrame = () => {
  fill(0, 0, 65, 450, [0, 0, 0]);
  fill(735, 0, 65, 450, [0, 0, 0]);
  fill(65, 0, 670, 25, [0, 0, 0]);
  fill(65, 425, 670, 25, [0, 0, 0]);
};

// drawcarb: a rounded button with a text, light while the mouse is over it; clicked when
// the mouse is let go on it.
export const textButton = (s, x, y) => {
  font(13);
  const w = Math.trunc(screen.g.measureText(s).width);
  const hovered =
    mouse.x > x && mouse.x < x + w + 14 && mouse.y > y && mouse.y < y + 28;
  const p = hovered ? "p" : "";
  const left = picture(`${p}bcl.gif`);
  const middle = picture(`${p}bc.gif`);
  const right = picture(`${p}bcr.gif`);
  draw(left, x, y);
  if (middle) {
    screen.g.drawImage(middle, x + 4, y, w + 6, 28);
  }
  draw(right, x + w + 10, y);
  text(s, x + 7, y + 19, [0, 0, 0]);
  return hovered && mouse.released;
};
