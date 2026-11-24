// The graphics quality chosen in the options: how far the classic look keeps its details
// (outlines, far sides, rims, glass, shadows, whole objects: the original's distances
// times detail, made for the computers of 2005), and how many pixels the 3D picture has
// for each of the window's (resolution; the classic look's own few pixels stay as they are
// unless sharp). Medium is the original's; the tests race with it.

import { loadSetting, saveSetting } from "../core/storage.js";

export const QUALITY = { low: 0, medium: 1, high: 2, ultra: 3 };
export const QUALITY_NAMES = ["Low", "Medium", "High", "Ultra"];
const STORED = "graphics";

// (more pixels than the screen's own show nothing more)
const sharpest = () => Math.min(2, globalThis.devicePixelRatio || 1);

const PRESETS = [
  { detail: 1, resolution: () => 0.6 },
  { detail: 1, resolution: () => 1 },
  { detail: 2.5, resolution: () => 1 },
  { detail: 4, resolution: sharpest },
];

export const graphics = { quality: QUALITY.high, detail: 1, resolution: 1 };

export const chooseQuality = (quality, keep = true) => {
  graphics.quality = quality;
  graphics.detail = PRESETS[quality].detail;
  graphics.resolution = PRESETS[quality].resolution();
  if (keep) {
    saveSetting(STORED, quality);
  }
};

const stored = loadSetting(STORED);
chooseQuality(
  stored >= 0 && stored < PRESETS.length ? stored : QUALITY.high,
  false,
);
