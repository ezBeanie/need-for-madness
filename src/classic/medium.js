import { fillRect } from "./batch.js";

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
  // 0 in races; 1 for the stage select's preview: sepia, no fog, nothing out of its frame
  trk: 0,
  // the shadows' colour in the menus (the original's car select), null: the ground's
  menuShadow: null,
  // counts the frames drawn, and the logic tick they show
  frame: 0,
  tick: 0,
  // an object's nearer polygons cover its farther ones, whatever their order (look.depth)
  depth: false,
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
  // (as the original starts a stage; its own stages may change these)
  medium.fogd = 7;
  medium.lightson = false;
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

// --- the original's own stages: their look exactly as its Medium set it ---

// n tinted by the snap, in the original's float maths: (int)(n + n * (snap / 100f))
export const snapOf = (n, i) => {
  const by = Math.fround(medium.snap[i] / 100);
  return clamp255(Math.trunc(Math.fround(n + Math.fround(n * by))));
};
// ... or n plus its tint: n + (int)(n * (snap / 100f))
const plusSnap = (n, i) => {
  const by = Math.fround(medium.snap[i] / 100);
  return clamp255(n + Math.trunc(Math.fround(n * by)));
};

const cloudsOfSky = () => {
  medium.clds = medium.osky.map((s, i) =>
    plusSnap(
      Math.trunc((s * medium.cldd[3] + medium.cldd[i]) / (medium.cldd[3] + 1)),
      i,
    ),
  );
};

const roadsideOfGround = () => {
  medium.crgrnd = medium.cpol.map((p, i) =>
    Math.trunc((p * 0.99 + medium.cgrnd[i]) / 2),
  );
};

const clampTo = (v, low, high) => Math.min(high, Math.max(low, v));

// The original's Medium setters, by the stage file's commands (see data/stageFormat.js).
const ORIGINAL_SETTERS = {
  snap: ({ r, g, b }) => {
    medium.snap = [r, g, b];
  },
  sky: ({ r, g, b }) => {
    medium.osky = [r, g, b];
    cloudsOfSky();
    medium.csky = medium.osky.map(snapOf);
  },
  clouds: ({ r, g, b, type, height }) => {
    medium.cldd = [r, g, b, clampTo(type, 0, 10), clampTo(height, -1500, -500)];
    cloudsOfSky();
  },
  ground: ({ r, g, b }) => {
    medium.ogrnd = [r, g, b];
    const [, , , mix] = medium.texture;
    medium.cpol = medium.ogrnd.map((o, i) =>
      plusSnap(Math.trunc((o * mix + medium.texture[i]) / (1 + mix)), i),
    );
    medium.cgrnd = medium.ogrnd.map(snapOf);
    roadsideOfGround();
  },
  texture: ({ r, g, b, mix }) => {
    const m = clampTo(mix, 20, 60);
    medium.texture = [r, g, b, m];
    medium.cpol = [r, g, b].map((c, i) =>
      snapOf(Math.trunc((medium.ogrnd[i] * m + c) / (1 + m)), i),
    );
    roadsideOfGround();
  },
  polys: ({ r, g, b }) => {
    medium.cpol = [r, g, b].map(snapOf);
    roadsideOfGround();
  },
  fog: ({ r, g, b }) => {
    medium.cfade = [r, g, b].map(snapOf);
  },
  density: ({ density }) => {
    medium.fogd = clampTo((density + 1) * 2 - 1, 1, 30);
  },
  fadefrom: ({ distance }) => fadeFrom(distance),
  lightson: () => {
    medium.lightson = true;
  },
  mountains: ({ seed }) => {
    medium.mountainSeed = seed;
  },
};

// One of the original's stages: from the Medium it starts with, its file's commands in
// their order (one setter reads what an earlier one set).
export const setOriginalLook = (commands) => {
  Object.assign(medium, {
    snap: [0, 0, 0],
    osky: [170, 220, 255],
    ogrnd: [205, 200, 200],
    texture: [0, 0, 0, 50],
    cldd: [210, 210, 210, 1, -1000],
    fogd: 7,
    lightson: false,
  });
  for (const entry of commands) {
    ORIGINAL_SETTERS[entry.command](entry);
  }
};

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

const band = (color, top, bottom) => {
  fillRect(0, top, medium.w, bottom - top, ...color);
};

// The sky and the ground: bands from the horizon outwards, each further band a step
// closer to the fog's colour (the original's Medium.d).
export const drawSkyAndGround = () => {
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
      band(ground, top, below);
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
      band(sky, above, bottom);
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
      band(hazeColor, top, haze);
    }
    haze = top;
  }
};
