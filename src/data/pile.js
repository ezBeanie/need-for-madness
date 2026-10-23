// A pile of rocks of the original Java game's stages (its ContO made from pile(seed, width,
// height, x, z)): a mound of four sloping sides round a flat top, its shape from
// java.util.Random. In the original's units and axes: y is down, the ground at 0.
import { javaRandom } from "../core/javaRandom.js";

const f = Math.fround;
const clamp = (v, low, high) => Math.min(high, Math.max(low, v));

// Returns { faces: [{ points: [[x, y, z], ...], shade }], maxR }: the four sides, then the
// top. A face's colour is the stage's (polys + ground) / shade.
export const makePile = (seed, width, height) => {
  const random = javaRandom(seed);
  const wide = f(f(clamp(width, 2, 6)) / f(1.5));
  const high = f(
    f(f(clamp(height, 2, 6)) / f(1.5)) * f(1 + f(f(wide - 2) * f(0.1786))),
  );
  // the foot: eight corners round the middle, a 45° apart
  const x = new Array(8);
  const z = new Array(8);
  const reach = () => f(50 + 100 * random());
  const diagonal = (r) => Math.trunc(f(f(r * wide) * f(0.7071)));
  let r = reach();
  x[0] = -diagonal(r);
  z[0] = diagonal(r);
  r = reach();
  x[1] = 0;
  z[1] = Math.trunc(f(r * wide));
  r = reach();
  x[2] = Math.trunc(f(r * wide) * 0.7071);
  z[2] = Math.trunc(f(r * wide) * 0.7071);
  x[3] = Math.trunc(f(reach() * wide));
  z[3] = 0;
  r = reach();
  x[4] = Math.trunc(f(r * wide) * 0.7071);
  z[4] = -Math.trunc(f(r * wide) * 0.7071);
  r = reach();
  x[5] = 0;
  z[5] = -Math.trunc(f(r * wide));
  r = reach();
  x[6] = -Math.trunc(f(r * wide) * 0.7071);
  z[6] = -Math.trunc(f(r * wide) * 0.7071);
  x[7] = -Math.trunc(f(reach() * wide));
  z[7] = 0;
  // the top: eight corners nearer the middle, raised
  const tx = new Array(8);
  const tz = new Array(8);
  const ty = new Array(8);
  for (let i = 0; i < 8; i++) {
    tx[i] = Math.trunc(x[i] * (0.2 + 0.4 * random()));
    tz[i] = Math.trunc(z[i] * (0.2 + 0.4 * random()));
    ty[i] = -Math.trunc((10 + 15 * random()) * high);
  }
  // smoothed, each corner towards the middle of its neighbours (in place, as it did)
  const smooth = (a, j, before, after) => {
    a[j] = Math.trunc((Math.trunc((a[before] + a[after]) / 2) + a[j]) / 2);
  };
  let maxR = 0;
  for (let j = 0; j < 8; j++) {
    const before = (j + 7) % 8;
    const after = (j + 1) % 8;
    for (const a of [x, z, tx, tz, ty]) {
      smooth(a, j, before, after);
    }
    maxR = Math.max(
      maxR,
      Math.trunc(Math.sqrt(x[j] * x[j] + z[j] * z[j])),
      Math.trunc(Math.sqrt(tx[j] * tx[j] + ty[j] * ty[j] + tz[j] * tz[j])),
    );
  }
  // how much darker each side is: different enough from the last one
  let flat = f(f(f(wide / high) - f(0.33)) / f(33.4));
  if (flat < 0.005) {
    flat = 0;
  }
  if (flat > 0.057) {
    flat = f(0.057);
  }
  const faces = [];
  let lastDark = f(-1);
  for (let k = 0; k < 4; k++) {
    const a = k * 2;
    const b = (a + 2) % 8;
    const points = [
      [x[a], 0, z[a]],
      [x[a + 1], 0, z[a + 1]],
      [x[b], 0, z[b]],
      [tx[b], ty[b], tz[b]],
      [tx[a + 1], ty[a + 1], tz[a + 1]],
      [tx[a], ty[a], tz[a]],
    ];
    let dark;
    do {
      dark = f((0.17 - flat) * random());
    } while (Math.abs(f(lastDark - dark)) < 0.03 - f(flat * f(0.176)));
    lastDark = dark;
    faces.push({ points, shade: f(f(f(2.2) + dark) - flat) });
  }
  const topDark = f(0.02 * random());
  faces.push({
    points: tx.map((tX, i) => [tX, ty[i], tz[i]]),
    shade: f(f(2.15) + topDark),
  });
  return { faces, maxR };
};

// A face's colour from the stage's polys and ground colours, as the original made it.
export const pileColor = (shade, polys, ground) =>
  polys.map((p, i) => Math.trunc(f((p + ground[i]) / shade)));
