// The shadows of cars: flat under the car, with the silhouette of how the car lies.

import { carStats } from "../data/carStats.js";

// the shadow textures (model.ont of a shadow)
export const SILHOUETTE = { upright: 0, onItsSide: 1, onItsEnd: 2 };

// Lays the shadow under the body of a car of the given type; its height is up to the caller.
export const layShadow = (shadow, body, type) => {
  const m = body.mat;
  const s = shadow.mat;
  // m[1], m[5], m[9]: how far the car's width, height and length point upwards
  const lengthUpright = Math.abs(m[9]) > Math.abs(m[1]);
  const tippedOver = Math.abs(m[5]) < (lengthUpright ? 0.4 : 0.5);
  if (tippedOver && lengthUpright) {
    shadow.x = body.x;
    shadow.z = body.z;
    shadow.ont = SILHOUETTE.onItsEnd;
    s[0] = m[0];
    s[2] = m[2];
    s[4] = m[8];
    s[6] = m[10];
    s[8] = -m[4];
    s[10] = -m[6];
  } else {
    shadow.x = body.x - carStats.shadadj[type] * m[8];
    shadow.z = body.z - carStats.shadadj[type] * m[10];
    s[0] = m[8];
    s[2] = m[10];
    if (tippedOver) {
      shadow.ont = SILHOUETTE.onItsSide;
      s[4] = m[0];
      s[6] = m[2];
      s[8] = -m[4];
      s[10] = -m[6];
    } else {
      shadow.ont = SILHOUETTE.upright;
      s[4] = m[4];
      s[6] = m[6];
      s[8] = m[0];
      s[10] = m[2];
    }
  }
  s[1] = 0;
  s[5] = 1;
  s[9] = 0;
};
