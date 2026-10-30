import { cos, sin } from "./exactMath.js";

// Angles in the game are in degrees. Distance helpers take their coordinates
// pairwise per axis: (x1, x2, z1, z2), not point by point.

export const sinDeg = (angle) => sin((angle * Math.PI) / 180);

export const cosDeg = (angle) => cos((angle * Math.PI) / 180);

export const distanceSquaredXZ = (x1, x2, z1, z2) =>
  (x1 - x2) * (x1 - x2) + (z1 - z2) * (z1 - z2);

export const distanceXZ = (x1, x2, z1, z2) =>
  Math.sqrt(distanceSquaredXZ(x1, x2, z1, z2));

export const distanceSquared = (x1, x2, y1, y2, z1, z2) =>
  (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2) + (z1 - z2) * (z1 - z2);

export const distance = (x1, x2, y1, y2, z1, z2) =>
  Math.sqrt(distanceSquared(x1, x2, y1, y2, z1, z2));

// Rotates the first count points (xs[i], ys[i]) in place around (cx, cy).
export const rotatePoints = (xs, ys, cx, cy, angle, count) => {
  if (angle == 0) {
    return;
  }
  for (let i = 0; i < count; i++) {
    const x = xs[i];
    xs[i] = cx + ((xs[i] - cx) * cosDeg(angle) - (ys[i] - cy) * sinDeg(angle));
    ys[i] = cy + ((x - cx) * sinDeg(angle) + (ys[i] - cy) * cosDeg(angle));
  }
};

// Rotates the three axis components (xs[i], ys[i]) of a basis in place around the origin.
// Not rotatePoints around (0, 0): that would turn -0 into 0.
export const rotateAxes = (xs, ys, angle) => {
  if (angle == 0) {
    return;
  }
  for (let i = 0; i < 3; i++) {
    const x = xs[i];
    xs[i] = xs[i] * cosDeg(angle) - ys[i] * sinDeg(angle);
    ys[i] = x * sinDeg(angle) + ys[i] * cosDeg(angle);
  }
};
