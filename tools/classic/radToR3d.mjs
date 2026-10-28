// Translates a piece only the original Java game had (its .rad, data/classic) into this
// game's model format (.r3d, data/3D) for the modern look and the physics: its polygons as
// fans of triangles in our units and axes, each corner coloured by a palette texture of the
// model's colours (three pixels square each, so the texture is never mipmapped and blurred).
// usage: node tools/classic/radToR3d.mjs thenet
import { readFileSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";
import { parseRad } from "../../src/classic/rad.js";

const name = process.argv[2];
const root = new URL("../../public/data/", import.meta.url);
const rad = parseRad(
  readFileSync(new URL(`classic/${name}.rad`, root), "utf8"),
);

const colors = [...new Set(rad.polys.map((poly) => poly.color.join()))];
const BLOCK = 3;
const width = colors.length * BLOCK;

const vertices = [];
const normals = [];
const triangles = [];
for (const poly of rad.polys) {
  // the original's x and y point the other way; ours are ten times smaller, and the model
  // format turns x round again (see flipX in models.js)
  const corners = poly.points.map(([x, y, z]) => [x / 10, -y / 10, z / 10]);
  const first = vertices.length / 3;
  vertices.push(...corners.flat());
  const [a, b, c] = corners;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const length = Math.hypot(...n) || 1;
  const normal = normals.length / 3;
  normals.push(...n.map((value) => value / length));
  const uv = colors.indexOf(poly.color.join());
  for (let i = 1; i < corners.length - 1; i++) {
    for (const corner of [0, i, i + 1]) {
      triangles.push(first + corner, normal, uv);
    }
  }
}
// the middle of each colour's block
const texcoords = colors.flatMap((color, i) => [
  ((i + 0.5) * BLOCK) / width,
  0.5,
]);

const list = (values) => values.map((value) => +value.toFixed(6)).join(",");
writeFileSync(
  new URL(`3D/${name}.r3d`, root),
  "# Radical Play - 3D Object Format\n" +
    `# made from data/classic/${name}.rad by tools/classic/radToR3d.mjs\n\n` +
    `texture(${name}.png)\nintershad()\nownShade()\n\n` +
    `v(${list(vertices)})v\n\nn(${list(normals)})n\n\n` +
    `t(${list(texcoords)})t\n\np(${triangles.join(",")})p\n`,
);

// the palette as a PNG, its rows of RGBA pixels each after a filter byte of 0
const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, check]);
};
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(BLOCK, 4);
header[8] = 8;
header[9] = 6;
const row = colors.flatMap((color) => {
  const rgba = [...color.split(",").map(Number), 255];
  return Array.from({ length: BLOCK }, () => rgba).flat();
});
const pixels = Buffer.from(
  Array.from({ length: BLOCK }, () => [0, ...row]).flat(),
);
writeFileSync(
  new URL(`3D/textures/${name}.png`, root),
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
console.log(
  `${name}: ${rad.polys.length} polygons, ${triangles.length / 9} triangles, ${colors.length} colours`,
);
