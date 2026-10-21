// The race's HUD in the classic look, as the original game drew it (its xtGraphics.stat):
// its own pictures for the labels, places and countdown, tinted for the stage, the
// numbers in bold Arial, and its damage and power bars. On the 2D canvas, in the
// original's 800 x 450, scaled to the window: the left side kept left, the right side
// kept right, the middle in the middle.
import { rd, view } from "../ui/view.js";
import { medium } from "./medium.js";

const FILES = [
  "damage",
  "power",
  "lap",
  "wasted",
  "position",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "0c",
  "1c",
  "2c",
  "3c",
];

const originals = new Map();
let loading = false;

const loadImages = () => {
  loading = true;
  for (const name of FILES) {
    const image = new Image();
    image.onload = () => {
      originals.set(name, image);
      tinted.clear();
    };
    image.src = `data/classic/images/${name}.gif`;
  }
};

// the pictures tinted for the stage's snap, by name
const tinted = new Map();
let tintedFor = "";

const clamp = (v) => Math.min(255, Math.max(0, Math.trunc(v)));

// The original's loadsnap: coloured pixels take the stage's tint; grey ones (the
// lettering's edges on its background) turn into black, as opaque as they are dark.
const tint = (image) => {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const g = canvas.getContext("2d");
  g.drawImage(image, 0, 0);
  const data = g.getImageData(0, 0, image.width, image.height);
  const px = data.data;
  const last = px.length - 4;
  // (on a black background, like the countdown's, the grey all goes see-through)
  const background = px[last];
  for (let i = 0; i < px.length; i += 4) {
    const [r, gr, b] = [px[i], px[i + 1], px[i + 2]];
    if (r != gr && gr != b) {
      px[i] = clamp(r + r * (medium.snap[0] / 100));
      px[i + 1] = clamp(gr + gr * (medium.snap[1] / 100));
      px[i + 2] = clamp(b + b * (medium.snap[2] / 100));
      px[i + 3] = 255;
    } else {
      px[i + 3] = background ? clamp(((background - r) / background) * 255) : 0;
      px[i] = 0;
      px[i + 1] = 0;
      px[i + 2] = 0;
    }
  }
  g.putImageData(data, 0, 0);
  return canvas;
};

const picture = (name) => {
  if (!loading) {
    loadImages();
  }
  const key = medium.snap.join(",");
  if (key != tintedFor) {
    tinted.clear();
    tintedFor = key;
  }
  if (!tinted.has(name) && originals.has(name)) {
    tinted.set(name, tint(originals.get(name)));
  }
  return tinted.get(name);
};

// the original's pixels on the window
const scale = () => view.height / 450;
const fromLeft = (x) => x * scale();
// (the right side leaves room for our menu and sound buttons)
const fromRight = (x) => view.width - 80 * view.scale - (800 - x) * scale();
const fromMiddle = (x) => view.width / 2 + (x - 400) * scale();

const draw = (name, x, y) => {
  const image = picture(name);
  if (image) {
    rd.drawImage(
      image,
      x,
      y * scale(),
      image.width * scale(),
      image.height * scale(),
    );
  }
};

const bold = (size) => {
  rd.letterSpacing = "0px";
  rd.font = `bold ${Math.round(size * scale())}px Arial`;
  rd.textBaseline = "alphabetic";
};

const snapped = ([r, g, b]) =>
  `rgb(${clamp(r + r * (medium.snap[0] / 100))},${clamp(g + g * (medium.snap[1] / 100))},${clamp(b + b * (medium.snap[2] / 100))})`;

// Lap, wasted cars and the place, top left.
export const drawClassicStanding = (lap, laps, wasted, rivals, place) => {
  draw("lap", fromLeft(19), 7);
  bold(11);
  rd.textAlign = "left";
  rd.fillStyle = "rgb(0,0,100)";
  rd.fillText(`${lap} / ${laps}`, fromLeft(51), 18 * scale());
  draw("wasted", fromLeft(92), 7);
  rd.fillText(`${wasted} / ${rivals}`, fromLeft(150), 18 * scale());
  draw("position", fromLeft(42), 27);
  if (place <= 8) {
    draw(`${place}`, fromLeft(110), 28);
  } else {
    // the original's pictures end at 8th: further places in its colours
    bold(13);
    rd.fillStyle = snapped([0, 0, 100]);
    rd.fillText(`${place}th`, fromLeft(112), 42 * scale());
  }
};

// The damage bar turns from yellow to red, the power bar from blue to light blue.
let damageBlinks = 0;
let damageBlink = false;
export const drawClassicMeters = (damage, power, powerFlash, tick) => {
  draw("damage", fromRight(600), 7);
  draw("power", fromRight(600), 27);
  const s = scale();
  const bar = (x, y, width, color) => {
    rd.fillStyle = snapped(color);
    rd.fillRect(fromRight(x), y * s, width * s, 9 * s);
  };
  const filled = Math.trunc(98 * Math.min(1, damage));
  let green = 244;
  if (filled > 33) {
    green = Math.trunc(244 - 233 * ((filled - 33) / 65));
  }
  if (filled > 70) {
    if (damageBlinks < 10) {
      if (damageBlink) {
        green = 170;
      }
      damageBlink = !damageBlink;
    }
    if (tick) {
      damageBlinks++;
    }
    if (damageBlinks > 167 - filled * 1.5) {
      damageBlinks = 0;
    }
  }
  bar(662, 11, filled, [244, green, 11]);
  let color = [power == 98 ? 64 : 128, Math.trunc(190 + power * 0.37), 244];
  if (powerFlash) {
    color = [128, 244, 244];
  }
  bar(662, 31, power, color);
};

// 3, 2, 1 and go, in the middle.
export const drawClassicCountdown = (number) => {
  draw(`${number}c`, fromMiddle(number != 0 ? 385 : 363), 50);
};

// The original's centred messages: bold Arial in the given colour, tinted for the stage.
export const drawClassicMessage = (y, text, r, g, b) => {
  bold(13);
  rd.textAlign = "center";
  rd.fillStyle = snapped([r, g, b]);
  rd.fillText(text, view.width / 2, y * view.scaleY);
};
