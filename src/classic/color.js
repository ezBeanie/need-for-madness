// java.awt.Color's HSB conversions, as the original game's colours went through them.

export const rgbToHsb = (r, g, b) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = max / 255;
  const saturation = max != 0 ? (max - min) / max : 0;
  if (saturation == 0) {
    return [0, saturation, brightness];
  }
  const redc = (max - r) / (max - min);
  const greenc = (max - g) / (max - min);
  const bluec = (max - b) / (max - min);
  let hue;
  if (r == max) {
    hue = bluec - greenc;
  } else if (g == max) {
    hue = 2 + redc - bluec;
  } else {
    hue = 4 + greenc - redc;
  }
  hue /= 6;
  if (hue < 0) {
    hue += 1;
  }
  return [hue, saturation, brightness];
};

export const hsbToRgb = (hue, saturation, brightness) => {
  const v = Math.trunc(brightness * 255 + 0.5);
  if (saturation == 0) {
    return [v, v, v];
  }
  const h = (hue - Math.floor(hue)) * 6;
  const f = h - Math.floor(h);
  const p = Math.trunc(brightness * (1 - saturation) * 255 + 0.5);
  const q = Math.trunc(brightness * (1 - saturation * f) * 255 + 0.5);
  const t = Math.trunc(brightness * (1 - saturation * (1 - f)) * 255 + 0.5);
  switch (Math.floor(h)) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
};
