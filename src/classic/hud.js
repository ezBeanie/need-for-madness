// The race's HUD in the classic look, as the original game drew it (its xtGraphics.stat):
// its own pictures for the labels, places and countdown, tinted for the stage, the
// numbers in bold Arial, and its damage and power bars. On the 2D canvas, in the
// original's 800 x 450, scaled to the window: the left side kept left, the right side
// kept right, the middle in the middle.
import { rd, view } from "../ui/view.js";
import { medium } from "./medium.js";
import { picture as plainPicture } from "./screen.js";

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
  "youwon",
  "youlost",
  "yourwasted",
  "youwastedem",
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

// The red of the see-through background of the pictures that have one, as the original
// read it: their palette's colour there (the browser reads see-through pixels as black).
const SEE_THROUGH_RED = {
  8: 192,
  "0c": 255,
  "1c": 255,
  "2c": 255,
  "3c": 255,
  youwon: 215,
  youlost: 215,
  yourwasted: 215,
  youwastedem: 215,
};

// The original's loadsnap: coloured pixels take the stage's tint; grey ones (the
// lettering's edges on its background) turn into black, as opaque as they are darker
// than the background (its last pixel).
const tint = (image, name) => {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const g = canvas.getContext("2d");
  g.drawImage(image, 0, 0);
  const data = g.getImageData(0, 0, image.width, image.height);
  const px = data.data;
  const last = px.length - 4;
  const background = SEE_THROUGH_RED[name] ?? px[last];
  for (let i = 0; i < px.length; i += 4) {
    const [r, gr, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
    if (r != gr && gr != b) {
      px[i] = clamp(r + r * (medium.snap[0] / 100));
      px[i + 1] = clamp(gr + gr * (medium.snap[1] / 100));
      px[i + 2] = clamp(b + b * (medium.snap[2] / 100));
      px[i + 3] = 255;
    } else {
      // (a see-through pixel has the background's colour: it stays see-through)
      px[i + 3] = a == 0 ? 0 : clamp(((background - r) / background) * 255);
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
    tinted.set(name, tint(originals.get(name), name));
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
    drawFurtherPlace(place);
  }
};

// The original's places end at 8th (it raced 8 cars). Further ones are put together from
// its own pictures: their digits (the 9 is its 6 upside down) and the "th" of its 4th, on
// its grey; the 0 it never had is drawn in their style (b blue, # black).
const DIGIT_WIDTH = 15;
const DIGIT_STEP = 12;
const ZERO = [
  "        #bbb#",
  "      #bb##bb",
  "     bb#  #bb",
  "    bb#    bb",
  "    bb    #b#",
  "   #b#    bb",
  "   bb     bb",
  "  #bb    #b#",
  "  bb     bb",
  " #bb    #bb",
  " bb#   #bb",
  " #bb##bb#",
  "  #bbb#",
];

const drawZero = (g) => {
  ZERO.forEach((row, y) => {
    [...row].forEach((pixel, x) => {
      if (pixel != " ") {
        g.fillStyle = pixel == "b" ? "rgb(0,80,159)" : "rgb(0,0,0)";
        g.fillRect(x, y + 1, 1, 1);
      }
    });
  });
};

const composePlace = (place) => {
  const digits = `${place}`.split("").map(Number);
  const canvas = document.createElement("canvas");
  canvas.width = DIGIT_STEP * (digits.length - 1) + DIGIT_WIDTH + 18;
  canvas.height = 17;
  const g = canvas.getContext("2d");
  g.fillStyle = "rgb(192,192,192)";
  g.fillRect(0, 0, canvas.width, canvas.height);
  // the pictures' grey keeps what lies under it where they overlap
  g.globalCompositeOperation = "darken";
  digits.forEach((digit, i) => {
    const glyph = document.createElement("canvas");
    glyph.width = DIGIT_WIDTH;
    glyph.height = 17;
    const gg = glyph.getContext("2d");
    gg.fillStyle = "rgb(192,192,192)";
    gg.fillRect(0, 0, DIGIT_WIDTH, 17);
    if (digit == 0) {
      drawZero(gg);
    } else {
      if (digit == 9) {
        gg.translate(DIGIT_WIDTH, 15);
        gg.rotate(Math.PI);
      }
      const source = originals.get(digit == 9 ? "6" : `${digit}`);
      gg.drawImage(source, 0, 0, DIGIT_WIDTH, 17, 0, 0, DIGIT_WIDTH, 17);
      gg.setTransform(1, 0, 0, 1, 0, 0);
    }
    g.drawImage(glyph, DIGIT_STEP * i, 0);
  });
  g.drawImage(
    originals.get("4"),
    15,
    0,
    18,
    17,
    DIGIT_STEP * (digits.length - 1) + DIGIT_WIDTH,
    0,
    18,
    17,
  );
  return canvas;
};

const drawFurtherPlace = (place) => {
  const key = `place${place}`;
  // (loads the pictures and lets go of those tinted for another stage)
  picture("1");
  if (
    !tinted.has(key) &&
    ["1", "2", "4", "6", "8"].every((n) => originals.has(n))
  ) {
    tinted.set(key, tint(composePlace(place)));
  }
  const image = tinted.get(key);
  if (image) {
    rd.drawImage(
      image,
      fromLeft(110),
      28 * scale(),
      image.width * scale(),
      image.height * scale(),
    );
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

// The race's end: "You Won!", "You Lost!", "You're Wasted!" or "You Wasted'em!".
export const drawClassicOutcome = (name) => {
  const image = picture(name);
  if (image) {
    draw(name, view.width / 2 - (image.width * scale()) / 2, 70);
  }
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

// flickers once a tick
let flicker = false;

// The instant replay: "Replay >>" flickering at the top (the original's replyn).
export const drawClassicReplayLabel = () => {
  bold(13);
  rd.textAlign = "center";
  rd.fillStyle = flicker ? snapped([0, 0, 0]) : snapped([0, 128, 255]);
  rd.fillText(
    flicker ? "Replay  > " : "Replay  >>",
    view.width / 2,
    30 * scale(),
  );
  flicker = !flicker;
};

// The highlight after a race (the original's levelhigh): its "Game Highlight" picture,
// what it shows, flickering light blue while it starts, and how to go on.
export const drawClassicHighlight = (caption, starting) => {
  const title = plainPicture("gameh.gif");
  if (title) {
    rd.drawImage(
      title,
      fromMiddle(301),
      20 * scale(),
      title.width * scale(),
      title.height * scale(),
    );
  }
  bold(13);
  rd.textAlign = "center";
  rd.fillStyle = snapped(starting && flicker ? [106, 176, 255] : [16, 48, 96]);
  rd.fillText(caption, view.width / 2, 60 * scale());
  rd.fillStyle = snapped([0, 0, 0]);
  rd.fillText("Press  [ Enter ]  to continue", view.width / 2, 380 * scale());
  flicker = !flicker;
};

// The original's Coach Insano for one of the modern Insano's faces: his mouth moves with
// them (0 at rest). Null until the picture has loaded.
export const classicInsanoPicture = (face) =>
  plainPicture(`d${(face % 3) + 1}.png`);

// Coach Insano beside a message (this game's switching cars and reversing time, which
// the original never had): faint, as on the original's instruction pages, his mouth
// moving with the face given (0 at rest).
export const drawClassicInsano = (face) => {
  const insano = classicInsanoPicture(face);
  if (insano) {
    rd.globalAlpha = 0.6;
    rd.drawImage(
      insano,
      fromMiddle(190),
      10 * scale(),
      insano.width * scale(),
      insano.height * scale(),
    );
    rd.globalAlpha = 1;
  }
};
