// The paints a car can have in a room's races besides its own (the lobby chooses one per
// player and bot): its coloured parts take the paint's hue, or turn black or white; grey,
// black and white parts (tyres, grilles, glass) stay as they are.

import { hsbToRgb, rgbToHsb } from "../classic/color.js";

export const SKINS = [
  "Standard",
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Black",
  "White",
];
// the hue of each paint, null for black and white
const HUES = [null, 0, 0.07, 0.15, 0.33, 0.6, 0.78, null, null];
const BLACK = 7;
const WHITE = 8;
// parts less saturated than this keep their colour
const GREY = 0.25;

export const isSkin = (skin) =>
  Number.isInteger(skin) && skin >= 0 && skin < SKINS.length;

// A colour of the car painted with skin.
export const paint = (r, g, b, skin) => {
  const [, saturation, brightness] = rgbToHsb(r, g, b);
  if (skin == 0 || saturation < GREY) {
    return [r, g, b];
  }
  if (skin == BLACK) {
    return hsbToRgb(0, 0, brightness * 0.3);
  }
  if (skin == WHITE) {
    return hsbToRgb(0, 0, 0.6 + brightness * 0.4);
  }
  return hsbToRgb(HUES[skin], saturation, brightness);
};

// Paints the pixels (RGBA) of a car's texture in place, but where keep(pixels, p) says.
export const paintPixels = (pixels, skin, keep) => {
  for (let p = 0; p < pixels.length; p += 4) {
    if (!keep(pixels, p)) {
      const [r, g, b] = paint(pixels[p], pixels[p + 1], pixels[p + 2], skin);
      pixels[p] = r;
      pixels[p + 1] = g;
      pixels[p + 2] = b;
    }
  }
  return pixels;
};
