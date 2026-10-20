// The original Java game's Medium: the camera, the stage's colours, its fog in bands and
// its sky and ground, in the original's screen of 450 pixels high and its units.

// what the original starts a stage with
export const medium = {
  focus: 400,
  // the screen and its middle
  w: 800,
  h: 450,
  cx: 400,
  cy: 225,
  cz: 50,
  // the camera: where it turns about less (cx, cy, cz), and its heading and pitch
  x: 0,
  y: 0,
  z: 0,
  xz: 0,
  zy: 0,
  ground: 250,
  skyline: -300,
  fade: [],
  fogd: 7,
  snap: [0, 0, 0],
  osky: [170, 220, 255],
  csky: [170, 220, 255],
  ogrnd: [205, 200, 200],
  cgrnd: [205, 200, 200],
  texture: [0, 0, 0, 50],
  cpol: [215, 210, 210],
  crgrnd: [205, 200, 200],
  cfade: [255, 220, 220],
  cldd: [210, 210, 210, 1, -1000],
  clds: [210, 210, 210],
  lightson: false,
  // shown at most this far (the original's detail setting "adv")
  adv: 500,
};

const clamp255 = (v) => Math.min(255, Math.max(0, v));
const snapped = (v, i) => clamp255(Math.trunc(v + v * (medium.snap[i] / 100)));

// The fog bands start at distance n/2 * 2, each n/2 further (fadfrom).
export const fadeFrom = (n) => {
  const from = Math.min(n, 8000);
  medium.fade = Array.from(
    { length: 16 },
    (_, i) => Math.trunc(from / 2) * (i + 2),
  );
};

// A stage's look, as its file sets it in the original's order: snap first, it tints the
// rest.
export const setStageLook = ({ snap, sky, ground, fog, clouds, fadefrom }) => {
  medium.snap = [...snap];
  medium.osky = [...sky];
  medium.csky = sky.map(snapped);
  medium.ogrnd = [...ground];
  medium.cpol = ground.map((g, i) =>
    snapped(
      Math.trunc(
        (g * medium.texture[3] + medium.texture[i]) / (1 + medium.texture[3]),
      ),
      i,
    ),
  );
  medium.cgrnd = ground.map(snapped);
  medium.crgrnd = medium.cpol.map((p, i) =>
    Math.trunc((p * 0.99 + medium.cgrnd[i]) / 2),
  );
  medium.cfade = fog.map(snapped);
  medium.cldd = [...clouds, medium.cldd[3], medium.cldd[4]];
  medium.clds = medium.osky.map((s, i) =>
    snapped(
      Math.trunc((s * medium.cldd[3] + medium.cldd[i]) / (medium.cldd[3] + 1)),
      i,
    ),
  );
  fadeFrom(fadefrom);
};
fadeFrom(3000);

export const sinDeg = (angle) => Math.sin(angle * (Math.PI / 180));
export const cosDeg = (angle) => Math.cos(angle * (Math.PI / 180));

export const xs = (x, z) => {
  const depth = Math.max(z, medium.cz);
  return ((depth - medium.focus) * (medium.cx - x)) / depth + x;
};

export const ys = (y, z) => {
  const depth = Math.max(z, 10);
  return ((depth - medium.focus) * (medium.cy - y)) / depth + y;
};

const band = (g, color, top, bottom) => {
  g.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  g.fillRect(0, top, medium.w, bottom - top);
};

// The sky and the ground: bands from the horizon outwards, each further band a step
// closer to the fog's colour (the original's Medium.d).
export const drawSkyAndGround = (g) => {
  const { cy, cz, h, zy, fade, cfade } = medium;
  medium.ground = 250 - medium.y;
  const pitch = (y, z) => ({
    y: cy + ((y - cy) * cosDeg(zy) - (z - cz) * sinDeg(zy)),
    z: cz + ((y - cy) * sinDeg(zy) + (z - cz) * cosDeg(zy)),
  });
  const clampY = (y) => Math.min(h, Math.max(0, y));
  let ground = [...medium.cgrnd];
  let road = [...medium.crgrnd];
  let below = h;
  for (let i = 0; i < 16; i++) {
    const p = pitch(medium.ground, fade[i]);
    const top = clampY(ys(p.y, p.z));
    if (i > 0) {
      road = road.map((c, k) => Math.trunc((c * 7 + cfade[k]) / 8));
      ground =
        i < 3
          ? ground.map((c, k) => Math.trunc((c * 7 + cfade[k]) / 8))
          : [...road];
    }
    if (top < h && below > 0) {
      band(g, ground, top, below);
    }
    below = top;
  }
  let sky = [...medium.csky];
  const horizon = pitch(medium.skyline - 700, 7000);
  let haze = ys(horizon.y, horizon.z);
  let hazeColor = [...sky];
  let above = 0;
  for (let j = 0; j < 16; j++) {
    const p = pitch(medium.skyline, fade[j]);
    const bottom = clampY(ys(p.y, p.z));
    if (j > 0) {
      sky = sky.map((c, k) => Math.trunc((c * 7 + cfade[k]) / 8));
    }
    if (above < haze) {
      hazeColor = [...sky];
    }
    if (bottom > 0 && above < h) {
      band(g, sky, above, bottom);
    }
    above = bottom;
  }
  // between the sky's last band and the ground's: their colours mixed, the more the
  // higher the camera
  if (above < h && below > 0) {
    const high = Math.min(
      1,
      Math.max(0, (Math.abs(medium.y) - 250) / (fade[0] * 2)),
    );
    band(
      g,
      sky.map((c, k) =>
        Math.trunc((c * (1 - high) + road[k] * (1 + high)) / 2),
      ),
      above,
      below,
    );
  }
  // the haze above the horizon, in the colour the sky has there
  for (let k = 1; k < 20; k++) {
    let top = 0;
    if (k != 19) {
      const p = pitch(medium.skyline - 700 - k * 70, 7000);
      top = clampY(ys(p.y, p.z));
    }
    // (the decompiled source reads "*= (int)0.991", which would turn it black)
    hazeColor = hazeColor.map((c, i) =>
      Math.trunc(c * (i == 2 ? 0.998 : 0.991)),
    );
    if (haze > 0 && top < h) {
      band(g, hazeColor, top, haze);
    }
    haze = top;
  }
};
