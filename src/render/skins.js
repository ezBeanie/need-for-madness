// The paints a car can have in a room's races besides its own (the lobby chooses one per
// player and bot): its coloured parts take the paint's hue, saturation and brightness
// scaled, so their shading stays; grey, black and white parts (tyres, grilles, glass) stay
// as they are.

import { hsbToRgb, rgbToHsb } from "../classic/color.js";

// name, hue, saturation times, brightness plus and times. A skin is its index, kept in
// storage and sent to the room: new paints only ever go at the end.
const PAINTS = [
  ["Standard"],
  ["Red", 0, 1, 0, 1],
  ["Orange", 0.07, 1, 0, 1],
  ["Yellow", 0.15, 1, 0, 1],
  ["Green", 0.33, 1, 0, 1],
  ["Blue", 0.6, 1, 0, 1],
  ["Purple", 0.78, 1, 0, 1],
  ["Black", 0, 0, 0, 0.3],
  ["White", 0, 0, 0.6, 0.4],
  ["Pink", 0.92, 0.75, 0.15, 0.85],
  ["Lime", 0.25, 1, 0.1, 0.9],
  ["Cyan", 0.5, 1, 0, 1],
  ["Grey", 0, 0, 0.3, 0.4],
  ["Maroon", 0.96, 1, 0.1, 0.5],
  ["Teal", 0.48, 1, 0.1, 0.6],
  ["Dark green", 0.36, 1, 0.1, 0.45],
  ["Navy", 0.65, 1, 0.1, 0.55],
  ["Sky blue", 0.55, 0.45, 0.35, 0.65],
];
export const SKINS = PAINTS.map(([name]) => name);
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
  const [, hue, timesSaturation, plus, timesBrightness] = PAINTS[skin];
  return hsbToRgb(
    hue,
    saturation * timesSaturation,
    plus + brightness * timesBrightness,
  );
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
