import { expect, test } from "vitest";
import { startRace } from "./harness/race.js";

// The original's y points down, its z forward (our model's +z, see placeCorner).
test("in the classic look a wheel rolling forward turns its top forward", async () => {
  await startRace({ stage: 1, car: 5 });
  const { spun, turnWheels } = await import("../src/classic/draw.js");
  // (driving forward our spin goes down, see rollWheels in physics.js)
  turnWheels(0, -10);
  const [down, forward] = spun(-1, 0);
  expect(down).toBeLessThan(0);
  expect(forward).toBeGreaterThan(0);
});

// A tyre's tread pieces count as turned away from the camera (and are left out far away,
// without their outline nearer) exactly when they are, whichever wheel and wherever seen.
test("in the classic look a wheel's tread pieces turn away from the camera only when they do", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  const draw = await import("../src/classic/draw.js");
  // a camera at the middle looking along -z, as the race's (see setView)
  const camera = new Float64Array(16);
  camera[0] = 1;
  camera[5] = 1;
  camera[10] = 1;
  camera[11] = -1;
  draw.setView(camera);
  draw.turnWheels(0, 0);
  const wrong = [];
  for (const x of [-50, 50]) {
    const rad = ctx.parseRad(
      `rims(140,140,140,18,10)\nw(${x},15,40,11,25,25)\n`,
    );
    const treads = rad.polys.filter((poly) => poly.solo);
    expect(treads).toHaveLength(12);
    // the wheel before the camera, above, below, beside it (not seen along its tread,
    // where the original's test of three corners may go either way)
    for (const [cx, cy, cz] of [
      [0, -40, -150],
      [0, 40, -150],
      [60, 0, -150],
      [-60, 0, -150],
      [30, -60, -120],
      [-30, 60, -120],
    ]) {
      const place = new Float64Array(16);
      place[0] = 1;
      place[5] = 1;
      place[10] = 1;
      place[12] = cx;
      place[13] = cy;
      place[14] = cz;
      treads.forEach((poly, k) => {
        poly.points.forEach(([px, py, pz], i) =>
          draw.placeCorner(i, px, py, pz, place),
        );
        draw.distanceOf(poly, poly.points.length);
        // its outward side and middle in our axes (the original's x and y turned back)
        const [, ay, az] = poly.points[0];
        const [, by, bz] = poly.points[1];
        const out = [0, -(ay + by - 2 * poly.wy), az + bz - 2 * poly.wz];
        const middle = [
          cx - (poly.points[0][0] + poly.points[2][0]) / 20,
          cy - (ay + by) / 20,
          cz + (az + bz) / 20,
        ];
        const towards = -(out[1] * middle[1] + out[2] * middle[2]) > 0;
        if (draw.turnedAway() == towards) {
          wrong.push(`wheel x ${x}, seen from ${[cx, cy, cz]}: piece ${k}`);
        }
      });
    }
  }
  expect(wrong).toEqual([]);
});
