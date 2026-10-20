// The original Java game's models (.rad files, data/classic): polygons of a single
// colour, as its ContO, Wheels and Plane classes read them. Coordinates stay in the
// original's units and axes (ten times ours, x and y the other way round).

// what a model with nothing set looks like (ContO's defaults)
const newRad = () => ({
  polys: [],
  maxR: 0,
  disp: 0,
  disline: 14,
  shadow: false,
  noline: false,
  decor: false,
  grounded: 1,
  grat: 0,
  keyx: [0, 0, 0, 0],
  keyz: [0, 0, 0, 0],
});

// value n of a line like name(a,b,c), cut to a whole number as the original does
const valueOf = (line, name, n) =>
  Math.trunc(parseFloat(line.slice(name.length + 1).split(/[,)]/)[n]));

// A polygon: corners (x, y, z), colour, and how it is drawn. glass 1 takes the sky's
// colour, 2 the ground's; light 1 shines at night, 2 is a back light; solo polygons
// have no outline; road polygons get a faint one up close.
const newPoly = (points, color, flags) => ({
  points,
  color: [...color],
  glass: 0,
  gr: 0,
  fs: 0,
  light: 0,
  solo: false,
  road: false,
  disline: 7,
  // the turn pivots of wheel polygons (wx only on steering wheels)
  wx: 0,
  wy: 0,
  wz: 0,
  master: 0,
  ...flags,
});

export const parseRad = (text) => {
  const rad = newRad();
  let inPoly = false;
  let points = [];
  let color = [0, 0, 0];
  let glass = 0;
  let gr = 0;
  let fs = 0;
  let light = 0;
  let solo = false;
  let stoneSolo = false;
  let road = false;
  let div = 1;
  let iwid = 1;
  const scale = [1, 1, 1];
  const wheels = newWheels();
  let wheelCount = 0;
  let gwgr = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (rad.polys.length < 210) {
      if (line.startsWith("<p>")) {
        inPoly = true;
        points = [];
        gr = 0;
        fs = 0;
        light = 0;
        if (!stoneSolo) {
          solo = false;
        }
      }
      if (inPoly) {
        if (line.startsWith("gr(")) {
          gr = valueOf(line, "gr", 0);
        }
        if (line.startsWith("fs(")) {
          fs = valueOf(line, "fs", 0);
        }
        if (line.startsWith("c(")) {
          glass = 0;
          color = [0, 1, 2].map((n) => valueOf(line, "c", n));
        }
        if (line.startsWith("glass")) {
          glass = 1;
        }
        if (line.startsWith("gshadow")) {
          glass = 2;
        }
        if (line.startsWith("light")) {
          light = 1;
        }
        if (line.startsWith("lightB")) {
          light = 2;
        }
        if (line.startsWith("noOutline")) {
          solo = true;
        }
        if (line.startsWith("p(")) {
          const x = Math.trunc(valueOf(line, "p", 0) * div * iwid * scale[0]);
          const y = Math.trunc(valueOf(line, "p", 1) * div * scale[1]);
          const z = Math.trunc(valueOf(line, "p", 2) * div * scale[2]);
          rad.maxR = Math.max(rad.maxR, Math.trunc(Math.hypot(x, y, z)));
          points.push([x, y, z]);
        }
      }
      if (line.startsWith("</p>")) {
        rad.polys.push(
          newPoly(points, color, {
            glass,
            gr,
            fs,
            light,
            solo,
            road,
            disline: rad.disline,
          }),
        );
        inPoly = false;
      }
    }
    if (line.startsWith("rims(")) {
      setRims(wheels, ...[0, 1, 2, 3, 4].map((n) => valueOf(line, "rims", n)));
    }
    if (line.startsWith("w(") && wheelCount < 4) {
      const w = (n) => valueOf(line, "w", n);
      rad.keyx[wheelCount] = Math.trunc(w(0) * div * scale[0]);
      rad.keyz[wheelCount] = Math.trunc(w(2) * div * scale[2]);
      makeWheel(
        wheels,
        rad.polys,
        Math.trunc(w(0) * div * iwid * scale[0]),
        Math.trunc(w(1) * div * scale[1]),
        Math.trunc(w(2) * div * scale[2]),
        w(3),
        Math.trunc(w(4) * div * iwid),
        Math.trunc(w(5) * div),
        gwgr,
      );
      wheelCount++;
    }
    if (line.startsWith("disp(")) {
      rad.disp = valueOf(line, "disp", 0);
    }
    if (line.startsWith("disline(")) {
      rad.disline = valueOf(line, "disline", 0) * 2;
    }
    if (line.startsWith("shadow")) {
      rad.shadow = true;
    }
    if (line.startsWith("stonecold")) {
      rad.noline = true;
    }
    if (line.startsWith("newstone")) {
      rad.noline = true;
      solo = true;
      stoneSolo = true;
    }
    if (line.startsWith("decorative")) {
      rad.decor = true;
    }
    if (line.startsWith("road")) {
      road = true;
    }
    if (line.startsWith("notroad")) {
      road = false;
    }
    if (line.startsWith("grounded(")) {
      rad.grounded = valueOf(line, "grounded", 0) / 100;
    }
    if (line.startsWith("div(")) {
      div = valueOf(line, "div", 0) / 10;
    }
    if (line.startsWith("idiv(")) {
      div = valueOf(line, "idiv", 0) / 100;
    }
    if (line.startsWith("iwid(")) {
      iwid = valueOf(line, "iwid", 0) / 100;
    }
    ["ScaleX(", "ScaleY(", "ScaleZ("].forEach((name, axis) => {
      if (line.startsWith(name)) {
        scale[axis] = valueOf(line, name.slice(0, -1), 0) / 100;
      }
    });
    if (line.startsWith("gwgr(")) {
      gwgr = valueOf(line, "gwgr", 0);
    }
  }
  rad.grat = wheels.ground;
  return rad;
};

// Wheels: drawn from 19 polygons each, a tyre's side, six rim spokes and twelve tread
// pieces, as the original's Wheels class makes them.
const newWheels = () => ({
  ground: 0,
  rimColor: [120, 120, 120],
  size: 2,
  depth: 3,
});

const setRims = (wheels, r, g, b, size, depth) => {
  wheels.rimColor = [r, g, b];
  wheels.size = Math.max(size / 10, 0);
  wheels.depth = depth / 10;
  if (wheels.depth / wheels.size > 41) {
    wheels.depth = wheels.size * 41;
  }
  if (wheels.depth / wheels.size < -25) {
    wheels.depth = -(wheels.size * 25);
  }
};

// the tyre's outline, twelve corners as (y, z) offsets in tenths of the wheel's height
const TYRE = [
  [-9.1923, 9.1923],
  [-12.557, 3.3646],
  [-12.557, -3.3646],
  [-9.1923, -9.1923],
  [-3.3646, -12.557],
  [3.3646, -12.557],
  [9.1923, -9.1923],
  [12.557, -3.3646],
  [12.557, 3.3646],
  [9.1923, 9.1923],
  [3.3646, 12.557],
  [-3.3646, 12.557],
];
// the rim's six corners as (y, z) offsets in its size, closing the circle
const RIM = [
  [0, 10],
  [8.66, 5],
  [8.66, -5],
  [0, -10],
  [-8.66, -5],
  [-8.66, 5],
  [0, 10],
];
// the tread pieces: two tyre corners each, and which way they face
const TREAD = [
  [1, 2, -1],
  [3, 2, 1],
  [3, 4, 1],
  [4, 5, -1],
  [6, 5, 1],
  [6, 7, 1],
  [7, 8, -1],
  [9, 8, 1],
  [9, 10, 1],
  [10, 11, -1],
  [0, 11, 1],
  [0, 1, 1],
];

const makeWheel = (wheels, polys, x, y, z, rotates, width, height, gwgr) => {
  const wide = width / 10;
  const high = height / 10;
  // front wheels (rotates 11) steer about a pivot on their outer side
  const wx = rotates == 11 ? Math.trunc(x + 4 * wide) : 0;
  wheels.ground = Math.trunc(y + 13 * high);
  const outside = x < 0 ? 1 : -1;
  const pivot = { wx, wy: y, wz: z, disline: 7 };
  const inner = Math.trunc(x - 4 * wide);
  const tyre = TYRE.map(([dy, dz]) => [
    Math.trunc(y + dy * high),
    Math.trunc(z + dz * high),
  ]);
  const rim = RIM.map(([dy, dz]) => [
    dy == 0 ? y : Math.trunc(y + dy * wheels.size),
    Math.trunc(z + dz * wheels.size),
  ]);
  const side = [...tyre, ...rim, tyre[11]].map(([py, pz]) => [inner, py, pz]);
  polys.push(newPoly(side, [45, 45, 45], { gr: gwgr, master: 1, ...pivot }));
  const hub = [Math.trunc(x - wheels.depth * wide), y, z];
  let spokeGr = Math.trunc(gwgr - (wheels.depth / wheels.size) * 4);
  if (spokeGr < -16) {
    spokeGr = -16;
  }
  for (let i = 0; i < 6; i++) {
    polys.push(
      newPoly(
        [[inner, ...rim[i]], [inner, ...rim[i + 1]], hub],
        wheels.rimColor,
        {
          gr: spokeGr,
          master: wheels.depth / wheels.size < 7 ? 2 : 0,
          ...pivot,
        },
      ),
    );
  }
  const outer = Math.trunc(x + 4 * wide);
  for (const [a, b, facing] of TREAD) {
    polys.push(
      newPoly(
        [
          [inner, ...tyre[a]],
          [inner, ...tyre[b]],
          [outer, ...tyre[b]],
          [outer, ...tyre[a]],
        ],
        [45, 45, 45],
        { gr: gwgr, fs: facing * outside, solo: true, ...pivot },
      ),
    );
  }
};
