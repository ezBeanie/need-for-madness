// The original Java game's models (.rad files, data/classic): polygons of a single
// colour, as its ContO, Wheels and Plane classes read them. Coordinates stay in the
// original's units and axes (ten times ours, x and y the other way round).
import { pileColor } from "../data/pile.js";

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
  // the surfaces of a piece (its <track> boxes) the cars' shadows lie on, see surfaces.js
  tracks: [],
});

// value n of a line like name(a,b,c), cut to a whole number as the original does
const valueOf = (line, name, n) =>
  Math.trunc(parseFloat(line.slice(name.length + 1).split(/[,)]/)[n]));

// A polygon: corners (x, y, z), colour, and how it is drawn. glass 1 takes the sky's
// colour, 2 the ground's, 3 its own untinted; light 1 shines at night, 2 is a back light; solo polygons
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

// One of the original's rock piles (see data/pile.js), in the stage's colours: its faces
// as they are (glass 3), road it fades into, seen from close only (disline 4).
export const pileRad = ({ faces, maxR }, polys, ground) => {
  const colors = faces.map((face) => pileColor(face.shade, polys, ground));
  return {
    ...newRad(),
    polys: faces.map((face, k) =>
      newPoly(face.points, colors[k], {
        glass: 3,
        gr: -8,
        road: true,
        disline: 4,
      }),
    ),
    maxR,
    disp: Math.trunc(maxR / 17),
    disline: 4,
    noline: true,
    decor: true,
    grounded: 115,
    tracks: pileTracks(faces, colors),
  };
};

const idiv = (a, b) => Math.trunc(a / b);
const slopeOf = (rise, run) =>
  Math.min(40, Math.trunc((Math.atan(rise / run) * 180) / Math.PI));

// The surfaces of a rock pile as the original made them (ContO's pile): a box sloping
// down each side, across the middle of its foot and top corners, and a flat one on top,
// in their faces' colours (the stage's already). The original's top box was twice as
// wide as the top (its half sizes: the whole width between the sides' boxes); this one
// fits it.
const pileTracks = (faces, colors) => {
  const foot = faces.slice(0, 4).flatMap((face) => face.points.slice(0, 2));
  const top = faces[4].points;
  const sides = [0, 1, 2, 3].map((k) => {
    const middle = k * 2 + 1;
    const first = foot[k * 2];
    const last = foot[(k * 2 + 2) % 8];
    const [x, , z] = foot[middle];
    const [tx, ty, tz] = top[middle];
    const track = { c: colors[k], tinted: true, xy: 0, zy: 0 };
    track.ty = idiv(ty, 2);
    track.rady = Math.abs(track.ty);
    // the sides towards z and away from it slope along z, the other two along x
    if (k % 2 == 0) {
      track.tz = idiv(z + tz, 2);
      track.radz = Math.abs(track.tz - z);
      track.tx = idiv(first[0] + last[0], 2);
      track.radx = Math.abs(track.tx - first[0]);
      track.zy = (k == 0 ? 1 : -1) * slopeOf(track.rady, track.radz);
    } else {
      track.tx = idiv(x + tx, 2);
      track.radx = Math.abs(track.tx - x);
      track.tz = idiv(first[2] + last[2], 2);
      track.radz = Math.abs(track.tz - first[2]);
      track.xy = (k == 1 ? 1 : -1) * slopeOf(track.rady, track.radx);
    }
    track.rady += 10;
    return track;
  });
  // the top: between the sides' boxes, at the height of its corners
  const [towardsZ, towardsX, awayZ, awayX] = sides;
  const right = towardsX.tx - towardsX.radx;
  const left = awayX.tx + awayX.radx;
  const front = towardsZ.tz - towardsZ.radz;
  const back = awayZ.tz + awayZ.radz;
  return [
    ...sides,
    {
      c: colors[4],
      tinted: true,
      xy: 0,
      zy: 0,
      tx: idiv(right + left, 2),
      ty: idiv(
        top.reduce((sum, [, y]) => sum + y, 0),
        8,
      ),
      tz: idiv(front + back, 2),
      radx: Math.abs(idiv(right - left, 2)),
      rady: 200,
      radz: Math.abs(idiv(front - back, 2)),
    },
  ];
};

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
  let track = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    // (the original read at most 210 polygons; none of its own models has more, the
    // ones made for cars it never had do)
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
    if (line.startsWith("<track>")) {
      track = {
        c: [0, 0, 0],
        xy: 0,
        zy: 0,
        radx: 0,
        rady: 0,
        radz: 0,
        tx: 0,
        ty: 0,
        tz: 0,
      };
    }
    if (track) {
      if (line.startsWith("c(")) {
        track.c = [0, 1, 2].map((n) => valueOf(line, "c", n));
      }
      for (const name of ["xy", "zy"]) {
        if (line.startsWith(`${name}(`)) {
          track[name] = valueOf(line, name, 0);
        }
      }
      // (sized as the model's points are)
      for (const name of ["radx", "rady", "radz", "tx", "ty", "tz"]) {
        if (line.startsWith(`${name}(`)) {
          track[name] = Math.trunc(valueOf(line, name, 0) * div);
        }
      }
      if (line.startsWith("</track>")) {
        rad.tracks.push(track);
        track = null;
      }
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
