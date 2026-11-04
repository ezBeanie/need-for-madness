// The original game's scenery around a stage (its Medium): patches on the ground,
// clouds and mountain ranges, made when a stage loads and drawn behind everything else.
// Clouds and mountains are far away: they move with the camera at 1/20 and 1/30.
import { javaRandom } from "../core/javaRandom.js";
import { X, Y, Z, fillNear, placeOrig } from "./draw.js";
import { medium, xs, ys } from "./medium.js";

const scenery = { patches: [], clouds: [], mountains: [] };

// The ground's patches: octagons on a grid every 1200 over the stage, pushed off the
// roads (newpolys). roads: their middles and half sizes, in the original's units.
const newPatches = (minX, width, minZ, depth, seed, roads) => {
  const random = javaRandom(
    (seed + medium.cgrnd[0] + medium.cgrnd[1] + medium.cgrnd[2]) * 1671,
  );
  const rows = Math.trunc(width / 1200) + 9;
  const columns = Math.trunc(depth / 1200) + 9;
  const startX = minX - 4800;
  const startZ = minZ - 4800;
  const patches = [];
  for (let i = 0; i < rows * columns; i++) {
    const row = i % rows;
    const column = Math.trunc(i / rows);
    let x = startX + row * 1200 + Math.trunc(random() * 1000 - 500);
    let z = startZ + column * 1200 + Math.trunc(random() * 1000 - 500);
    for (const road of roads) {
      if (road.radx < road.radz && Math.abs(z - road.z) < road.radz) {
        while (Math.abs(x - road.x) < road.radx) {
          x += Math.trunc(random() * road.radx * 2 - road.radx);
        }
      }
      if (road.radz < road.radx && Math.abs(x - road.x) < road.radx) {
        while (Math.abs(z - road.z) < road.radz) {
          z += Math.trunc(random() * road.radz * 2 - road.radz);
        }
      }
    }
    patches.push({ x, z, row, column });
  }
  const r = () => 100 + random() * 760;
  for (const patch of patches) {
    const size = 0.3 + 1.6 * random();
    const px = [0, 0, 0, 0, 0, 0, 0, 0];
    const pz = [0, 0, 0, 0, 0, 0, 0, 0];
    pz[0] = Math.trunc(r() * size);
    px[1] = Math.trunc(r() * 0.7071 * size);
    pz[1] = px[1];
    px[2] = Math.trunc(r() * size);
    px[3] = Math.trunc(r() * 0.7071 * size);
    pz[3] = -px[3];
    pz[4] = -Math.trunc(r() * size);
    px[5] = -Math.trunc(r() * 0.7071 * size);
    pz[5] = px[5];
    px[6] = -Math.trunc(r() * size);
    px[7] = -Math.trunc(r() * 0.7071 * size);
    pz[7] = -px[7];
    const spread = [];
    let reach = 0;
    for (let l = 0; l < 8; l++) {
      const a = (l + 7) % 8;
      const b = (l + 1) % 8;
      px[l] = Math.trunc((Math.trunc((px[a] + px[b]) / 2) + px[l]) / 2);
      pz[l] = Math.trunc((Math.trunc((pz[a] + pz[b]) / 2) + pz[l]) / 2);
      spread[l] = 1.1 + random() * 0.8;
      reach = Math.max(
        reach,
        Math.trunc(
          Math.sqrt(
            Math.trunc(
              px[l] * px[l] * spread[l] * spread[l] +
                pz[l] * pz[l] * spread[l] * spread[l],
            ),
          ),
        ),
      );
    }
    let shade = Math.min(1, 0.97 + random() * 0.03);
    if (random() > random()) {
      shade = 1;
    }
    Object.assign(patch, { px, pz, spread, reach, shade });
  }
  return { rows, columns, startX, startZ, list: patches };
};

// Clouds: three rings of twelve, the lower ones wider (newclouds).
const newClouds = (minX, maxX, minZ, maxZ, random) => {
  const x0 = Math.trunc(minX / 20) - 10000;
  const x1 = Math.trunc(maxX / 20) + 10000;
  const z0 = Math.trunc(minZ / 20) - 10000;
  const z1 = Math.trunc(maxZ / 20) + 10000;
  const count = Math.trunc(((x1 - x0) * (z1 - z0)) / 16666667);
  const RING = [
    [0.3826, 0.9238],
    [0.7071, 0.7071],
    [0.9238, 0.3826],
    [0.9238, -0.3826],
    [0.7071, -0.7071],
    [0.3826, -0.9238],
    [-0.3826, -0.9238],
    [-0.7071, -0.7071],
    [-0.9238, -0.3826],
    [-0.9238, 0.3826],
    [-0.7071, 0.7071],
    [-0.3826, 0.9238],
  ];
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const x = Math.trunc(x0 + (x1 - x0) * random());
    const z = Math.trunc(z0 + (z1 - z0) * random());
    const size = 0.25 + random() * 1.25;
    const ax = [[], [], []];
    const ay = [[], [], []];
    const az = [[], [], []];
    RING.forEach(([cx, cz], k) => {
      const radius = (200 + random() * 700) * size;
      ax[0][k] = Math.trunc(radius * Math.abs(cx)) * Math.sign(cx);
      az[0][k] = Math.trunc(radius * Math.abs(cz)) * Math.sign(cz);
      ay[0][k] = Math.trunc((25 - random() * 50) * size);
    });
    const smooth = (ring) => {
      for (let j = 0; j < 12; j++) {
        const a = (j + 11) % 12;
        const b = (j + 1) % 12;
        ring[j] = Math.trunc(
          (Math.trunc((ring[a] + ring[b]) / 2) + ring[j]) / 2,
        );
      }
    };
    smooth(ax[0]);
    smooth(ay[0]);
    smooth(az[0]);
    for (let k = 0; k < 12; k++) {
      const wider = 1.2 + 0.6 * random();
      ax[1][k] = Math.trunc(ax[0][k] * wider);
      az[1][k] = Math.trunc(az[0][k] * wider);
      ay[1][k] = Math.trunc(ay[0][k] - 100 * random());
      const widest = 1.1 + 0.3 * random();
      ax[2][k] = Math.trunc(ax[1][k] * widest);
      az[2][k] = Math.trunc(az[1][k] * widest);
      ay[2][k] = Math.trunc(ay[1][k] - 240 * random());
    }
    let reach = 0;
    for (let l = 0; l < 12; l++) {
      const a = (l + 11) % 12;
      const b = (l + 1) % 12;
      ay[1][l] = Math.trunc(
        (Math.trunc((ay[1][a] + ay[1][b]) / 2) + ay[1][l]) / 2,
      );
      ay[2][l] = Math.trunc(
        (Math.trunc((ay[2][a] + ay[2][b]) / 2) + ay[2][l]) / 2,
      );
      reach = Math.max(reach, Math.trunc(Math.hypot(ax[2][l], az[2][l])));
    }
    const colors = [[], []];
    for (let n = 0; n < 6; n++) {
      const top = random();
      const side = random();
      colors[0][n] = medium.clds.map((c) =>
        Math.min(255, Math.max(0, Math.trunc(c + (c * 1.05 - c) * top))),
      );
      colors[1][n] = medium.clds.map((c) =>
        Math.min(
          255,
          Math.max(0, Math.trunc(c * 1.05 + (c * 1.05 - c) * side)),
        ),
      );
    }
    clouds.push({ x, z, ax, ay, az, reach, colors });
  }
  return clouds;
};

// Mountain ranges far around the stage, their peaks smoothed (newmountains).
const newMountains = (minX, maxX, minZ, maxZ, seed) => {
  const random = javaRandom(seed);
  const count = Math.trunc(20 + 10 * random());
  const middleX = Math.trunc((minX + maxX) / 60);
  const middleZ = Math.trunc((minZ + maxZ) / 60);
  const span = Math.trunc(Math.max(maxX - minX, maxZ - minZ) / 60);
  // the ground where the original made them, before the camera moves it
  const ground = 250;
  const ranges = [];
  for (let i = 0; i < count; i++) {
    const away = Math.trunc(10000 + random() * 10000);
    const turn = Math.trunc(random() * 360);
    let wide;
    let high;
    let n;
    let green;
    if (random() > random()) {
      wide = 0.2 + random() * 0.35;
      high = 0.2 + random() * 0.35;
      n = Math.trunc(wide * (24 + 16 * random()));
      green = Math.trunc(85 + 10 * random());
    } else {
      wide = 0.3 + random() * 1.1;
      high = 0.2 + random() * 0.35;
      n = Math.trunc(wide * (12 + 8 * random()));
      green = Math.trunc(104 - 10 * random());
    }
    const x = [];
    const y = [];
    const z = [];
    const colors = [];
    for (let j = 0; j < n; j++) {
      x[j] = Math.trunc(
        (j * 500 + (random() * 800 - 400) - 250 * (n - 1)) * wide,
      );
      x[j + n] = Math.trunc(
        (j * 500 + (random() * 800 - 400) - 250 * (n - 1)) * wide,
      );
      x[n] = Math.trunc(x[0] - (100 + random() * 600) * wide);
      x[n * 2 - 1] = Math.trunc(x[n - 1] + (100 + random() * 600) * wide);
      if (j == 0 || j == n - 1) {
        y[j] = Math.trunc((-400 - 1200 * random()) * high + ground);
      }
      if (j == 1 || j == n - 2) {
        y[j] = Math.trunc((-1000 - 1450 * random()) * high + ground);
      }
      if (j > 1 && j < n - 2) {
        y[j] = Math.trunc((-1600 - 1700 * random()) * high + ground);
      }
      y[j + n] = ground - 70;
      z[j] = middleZ + span + away;
      z[j + n] = middleZ + span + away;
      const shade = 0.5 + random() * 0.5;
      colors[j] = [
        Math.min(
          255,
          Math.max(
            0,
            Math.trunc(170 * shade + 170 * shade * (medium.snap[0] / 100)),
          ),
        ),
        Math.min(
          255,
          Math.max(
            0,
            Math.trunc(green * shade + 85 * shade * (medium.snap[1] / 100)),
          ),
        ),
        0,
      ];
    }
    for (let k = 1; k < n - 1; k++) {
      y[k] = Math.trunc((Math.trunc((y[k - 1] + y[k + 1]) / 2) + y[k]) / 2);
    }
    // turned about the stage's middle
    const c = Math.cos((turn * Math.PI) / 180);
    const s = Math.sin((turn * Math.PI) / 180);
    for (let k = 0; k < n * 2; k++) {
      const dx = x[k] - middleX;
      const dz = z[k] - middleZ;
      x[k] = middleX + Math.trunc(dx * c - dz * s);
      z[k] = middleZ + Math.trunc(dx * s + dz * c);
    }
    ranges.push({ away, n, x, y, z, colors });
  }
  // the farthest drawn first
  return ranges.sort((a, b) => b.away - a.away);
};

// Makes the scenery for a stage: its bounds and roads in the original's units.
export const newScenery = ({
  minX,
  maxX,
  minZ,
  maxZ,
  patchSeed,
  mountainSeed,
  roads,
  randomness,
}) => {
  scenery.patches = newPatches(
    minX,
    maxX - minX,
    minZ,
    maxZ - minZ,
    patchSeed,
    roads,
  );
  scenery.clouds = newClouds(minX, maxX, minZ, maxZ, randomness);
  scenery.mountains = newMountains(minX, maxX, minZ, maxZ, mountainSeed);
};

const offScreen = (n) => {
  let up = 0;
  let down = 0;
  let left = 0;
  let right = 0;
  for (let i = 0; i < n; i++) {
    const sx = xs(X[i], Z[i]);
    const sy = ys(Y[i], Z[i]);
    const near = Z[i] < 10;
    if (sy < 0 || near) up++;
    if (sy > medium.h || near) down++;
    if (sx < 0 || near) left++;
    if (sx > medium.w || near) right++;
  }
  return up == n || down == n || left == n || right == n;
};

const fill = (indices, r, g, b) => fillNear(indices, indices.length, r, g, b);

const toward = (c, i) => Math.trunc((c * 7 + medium.cfade[i]) / 8);

const fogBands = (color, av) => {
  const { fogd, cfade, fade } = medium;
  let [r, g, b] = color;
  for (let i = 0; i < 16; i++) {
    if (av > fade[i]) {
      r = Math.trunc((r * fogd + cfade[0]) / (fogd + 1));
      g = Math.trunc((g * fogd + cfade[1]) / (fogd + 1));
      b = Math.trunc((b * fogd + cfade[2]) / (fogd + 1));
    }
  }
  return [r, g, b];
};

const EIGHT = [0, 1, 2, 3, 4, 5, 6, 7];
const TWELVE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// The eye in the original's units: x, y, z.
const drawPatches = (eye) => {
  const { rows, columns, startX, startZ, list } = scenery.patches;
  const fromRow = Math.max(
    0,
    Math.trunc((eye.x - medium.cx - startX) / 1200) - 12,
  );
  const toRow = Math.max(fromRow, Math.min(rows, fromRow + 25));
  const fromColumn = Math.max(
    0,
    Math.trunc((eye.z - medium.cz - startZ) / 1200) - 12,
  );
  const toColumn = Math.max(fromColumn, Math.min(columns, fromColumn + 25));
  const seen = [];
  const ground = 250 - eye.y;
  for (let row = fromRow; row < toRow; row++) {
    for (let column = fromColumn; column < toColumn; column++) {
      const patch = list[row + column * rows];
      placeOrig(0, patch.x - eye.x, ground, patch.z - eye.z);
      const depth = Z[0];
      if (
        !(
          xs(X[0] + patch.reach, depth) > 0 &&
          xs(X[0] - patch.reach, depth) < medium.w &&
          depth > -patch.reach &&
          depth < medium.fade[2]
        )
      ) {
        continue;
      }
      seen.push({ patch, depth });
      for (let k = 0; k < 8; k++) {
        placeOrig(
          k,
          patch.px[k] * patch.spread[k] + patch.x - eye.x,
          ground,
          patch.pz[k] * patch.spread[k] + patch.z - eye.z,
        );
      }
      if (!offScreen(8)) {
        let color = medium.cpol.map((c, i) =>
          Math.trunc((c * patch.shade + medium.cgrnd[i]) / 2),
        );
        if (depth - patch.reach > medium.fade[0]) {
          color = color.map(toward);
        }
        if (depth - patch.reach > medium.fade[1]) {
          color = color.map(toward);
        }
        fill(EIGHT, ...color);
      }
    }
  }
  // their middles, a shade darker, over all the rims
  for (const { patch, depth } of seen) {
    for (let k = 0; k < 8; k++) {
      placeOrig(
        k,
        patch.px[k] + patch.x - eye.x,
        ground,
        patch.pz[k] + patch.z - eye.z,
      );
    }
    if (!offScreen(8)) {
      let color = medium.cpol.map((c) => Math.trunc(c * patch.shade));
      if (depth - patch.reach > medium.fade[0]) {
        color = color.map(toward);
      }
      if (depth - patch.reach > medium.fade[1]) {
        color = color.map(toward);
      }
      fill(EIGHT, ...color);
    }
  }
};

// how far the middle of the corners placed is
const middleDistance = (indices) => {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const i of indices) {
    x += X[i];
    y += Y[i];
    z += Z[i];
  }
  const n = indices.length;
  return Math.sqrt(
    (medium.cy - y / n) ** 2 + (medium.cx - x / n) ** 2 + (z / n) ** 2,
  );
};

const drawClouds = (eye) => {
  const far = (v, centre) => Math.trunc((v - centre) / 20) + centre;
  const ex = far(eye.x, medium.cx);
  const ey = far(eye.y, medium.cy);
  const ez = far(eye.z, medium.cz);
  for (const cloud of scenery.clouds) {
    placeOrig(0, cloud.x - ex, medium.cldd[4] - ey, cloud.z - ez);
    const left = xs(X[0] + cloud.reach, Z[0]);
    const right = xs(X[0] - cloud.reach, Z[0]);
    if (
      !(
        left > 0 &&
        right < medium.w &&
        Z[0] > -cloud.reach &&
        left - right > 20
      )
    ) {
      continue;
    }
    const place = (ring, k, i) =>
      placeOrig(
        i,
        cloud.ax[ring][k] + cloud.x - ex,
        cloud.ay[ring][k] + medium.cldd[4] - ey,
        cloud.az[ring][k] + cloud.z - ez,
      );
    // the sides: the lower, wider rings first, then the top
    for (const [lower, upper, colors] of [
      [2, 1, cloud.colors[1]],
      [1, 0, cloud.colors[0]],
    ]) {
      for (let l = 0; l < 12; l += 2) {
        place(upper, l, 0);
        place(upper, (l + 1) % 12, 1);
        place(upper, (l + 2) % 12, 2);
        place(lower, (l + 2) % 12, 3);
        place(lower, (l + 1) % 12, 4);
        place(lower, l, 5);
        const six = [0, 1, 2, 3, 4, 5];
        if (!offScreen(6)) {
          const av = middleDistance(six);
          if (av < medium.fade[7]) {
            fill(six, ...fogBands(colors[l / 2], av));
          }
        }
      }
    }
    for (let k = 0; k < 12; k++) {
      place(0, k, k);
    }
    if (!offScreen(12)) {
      const av = middleDistance(TWELVE);
      if (av < medium.fade[7]) {
        fill(TWELVE, ...fogBands(medium.clds, av));
      }
    }
  }
};

const drawMountains = (eye) => {
  const far = (v, centre) => Math.trunc((v - centre) / 30) + centre;
  const ex = far(eye.x, medium.cx);
  const ey = far(eye.y, medium.cy);
  const ez = far(eye.z, medium.cz);
  for (const range of scenery.mountains) {
    const n = range.n;
    for (let j = 0; j < n * 2; j++) {
      placeOrig(j, range.x[j] - ex, range.y[j] - ey, range.z[j] - ez);
    }
    if (!(xs(X[n - 1], Z[n - 1]) > 0 && xs(X[0], Z[0]) < medium.w)) {
      continue;
    }
    const q = Math.trunc(n / 4);
    const away = Math.hypot(
      range.x[q] - (ex - medium.cx),
      range.z[q] - (ez - medium.cz),
    );
    let haze =
      away / 2500 +
      (8000 - medium.fade[0]) / 1000 -
      2 -
      (Math.abs(medium.y) - 250) / 5000;
    if (!(haze > 0 && haze < 10)) {
      continue;
    }
    haze = Math.max(haze, 3.5);
    for (let k = 0; k < n - 1; k++) {
      const quad = [k, k + 1, k + n + 1, k + n];
      if (offScreen4(quad)) {
        continue;
      }
      const color = [0, 1, 2].map((i) =>
        Math.trunc(
          (range.colors[k][i] +
            medium.cgrnd[i] +
            medium.csky[i] * haze +
            medium.cfade[i] * haze) /
            (2 + haze * 2),
        ),
      );
      fill(quad, ...color);
    }
  }
};

const offScreen4 = (indices) => {
  let up = 0;
  let down = 0;
  let left = 0;
  let right = 0;
  for (const i of indices) {
    const sx = xs(X[i], Z[i]);
    const sy = ys(Y[i], Z[i]);
    const near = Z[i] < 10;
    if (sy < 0 || near) up++;
    if (sy > medium.h || near) down++;
    if (sx < 0 || near) left++;
    if (sx > medium.w || near) right++;
  }
  const n = indices.length;
  return up == n || down == n || left == n || right == n;
};

// Drawn after the sky's and ground's bands, before the stage (as Medium.d does).
export const drawScenery = (eye) => {
  drawMountains(eye);
  drawClouds(eye);
  drawPatches(eye);
};
