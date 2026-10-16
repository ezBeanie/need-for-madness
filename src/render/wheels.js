// The wheels of a car body: where they sit and which way they face.

import { carStats } from "../data/carStats.js";
import { resetMatrix } from "./interpolation.js";

// wheel 0 front left, 1 front right, 2 rear left, 3 rear right
export const isLeftWheel = (index) => index % 2 == 0;

// Puts the wheel at its place on the body of a car of the given type, turned with the body
// and then sideways (turned further by steering, in degrees).
export const placeWheel = (wheel, body, type, index, steering = 0) => {
  const axle = index < 2 ? 0 : 1;
  const across = (isLeftWheel(index) ? -1 : 1) * carStats.wlx[type][axle];
  const down = carStats.wly[type][axle];
  const along = carStats.wlz[type][axle];
  const m = body.mat;
  wheel.x = body.x + across * m[0] - down * m[4] + along * m[8];
  wheel.y = body.y + across * m[1] - down * m[5] + along * m[9];
  wheel.z = body.z + across * m[2] - down * m[6] + along * m[10];
  wheel.mat = resetMatrix(wheel.mat);
  for (let k = 0; k < 12; k++) {
    wheel.mat[k] = m[k];
  }
  const facing = isLeftWheel(index) ? 90 : -90;
  mat4.rotate(
    wheel.mat,
    wheel.mat,
    (facing - steering) * (Math.PI / 180),
    [0, 1, 0],
  );
};
