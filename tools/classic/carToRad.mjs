// Translates a car the original Java game never had into its model format (.rad), for the
// classic look: our model's triangles, each in the average colour of its texture, merged
// where they lie in one plane in about one colour, and the original's wheels where ours
// are. Runs in Chromium (it decodes the PNG textures) against the dev server.
// usage: node tools/classic/carToRad.mjs http://localhost:5173 7:tragdor 9:icecream ...
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const [baseURL, ...cars] = process.argv.slice(2);

// in the page: the car's polygons in the original's units and axes, and its wheels
const translate = async ({ index }) => {
  const { parseModel } = await import("/src/data/modelFormat.js");
  const { carStats } = await import("/src/data/carStats.js");
  const model = parseModel(
    await (await fetch(`/data/3D/car${index}.r3d`)).text(),
  );
  const scaleOf = (command) => {
    const directive = model.directives.find((d) => d.command == command);
    return directive ? parseFloat(directive.value) : 1;
  };
  const scale = scaleOf("scale");
  const scaleX = scaleOf("Xscale");
  const image = new Image();
  image.src = `/data/3D/textures/car${index}.png`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  const sample = (u, v) => {
    // the modern look reads the texture at (u, 1 - v), its rows from the top
    const x = Math.min(
      image.width - 1,
      Math.max(0, Math.floor(u * image.width)),
    );
    const y = Math.min(
      image.height - 1,
      Math.max(0, Math.floor((1 - v) * image.height)),
    );
    const at = (y * image.width + x) * 4;
    return [pixels[at], pixels[at + 1], pixels[at + 2]];
  };
  // a vertex as the modern look draws it (mirrored in x), in the original's units and
  // axes: ten times ours, x and y the other way round
  const corner = (i) => [
    10 * model.vertices[i * 3] * scale * scaleX,
    -10 * model.vertices[i * 3 + 1] * scale,
    10 * model.vertices[i * 3 + 2] * scale,
  ];
  const sub = (a, b) => a.map((v, k) => v - b[k]);
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const unit = (v) => {
    const l = Math.hypot(...v) || 1;
    return v.map((x) => x / l);
  };
  const t = model.triangles;
  let polygons = [];
  for (let f = 0; f < t.length / 9; f++) {
    const loop = [t[f * 9], t[f * 9 + 3], t[f * 9 + 6]];
    const uvs = [t[f * 9 + 2], t[f * 9 + 5], t[f * 9 + 8]].map((k) => [
      model.texcoords[k * 2],
      model.texcoords[k * 2 + 1],
    ]);
    // the texture's colour over the triangle: samples spread across it, averaged
    const weights = [
      [1, 1, 1],
      [4, 1, 1],
      [1, 4, 1],
      [1, 1, 4],
      [2, 2, 1],
      [2, 1, 2],
      [1, 2, 2],
    ];
    const color = [0, 0, 0];
    for (const w of weights) {
      const sum = w[0] + w[1] + w[2];
      const u = (uvs[0][0] * w[0] + uvs[1][0] * w[1] + uvs[2][0] * w[2]) / sum;
      const v = (uvs[0][1] * w[0] + uvs[1][1] * w[1] + uvs[2][1] * w[2]) / sum;
      sample(u, v).forEach((c, k) => (color[k] += c / weights.length));
    }
    const [a, b, c] = loop.map(corner);
    const normal = cross(sub(b, a), sub(c, a));
    const area = Math.hypot(...normal) / 2;
    if (area < 1e-6) {
      continue;
    }
    polygons.push({ loop, color, area, normal: unit(normal) });
  }
  // merge neighbours in one plane and about one colour while the polygon stays convex
  const convex = (loop, normal) => {
    let sign = 0;
    for (let i = 0; i < loop.length; i++) {
      const a = corner(loop[i]);
      const b = corner(loop[(i + 1) % loop.length]);
      const c = corner(loop[(i + 2) % loop.length]);
      const turn = cross(sub(b, a), sub(c, b));
      const d = turn[0] * normal[0] + turn[1] * normal[1] + turn[2] * normal[2];
      if (Math.abs(d) > 1e-6) {
        if (sign != 0 && Math.sign(d) != sign) {
          return false;
        }
        sign = Math.sign(d);
      }
    }
    return true;
  };
  const joined = (p, q) => {
    for (let i = 0; i < p.loop.length; i++) {
      const a = p.loop[i];
      const b = p.loop[(i + 1) % p.loop.length];
      const j = q.loop.findIndex(
        (v, k) => v == b && q.loop[(k + 1) % q.loop.length] == a,
      );
      if (j >= 0) {
        // p up to a, then q from after b round to before a
        const rest = [];
        for (let k = 2; k < q.loop.length; k++) {
          rest.push(q.loop[(j + k) % q.loop.length]);
        }
        return [...p.loop.slice(0, i + 1), ...rest, ...p.loop.slice(i + 1)];
      }
    }
    return null;
  };
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < polygons.length && !merged; i++) {
      for (let j = i + 1; j < polygons.length && !merged; j++) {
        const p = polygons[i];
        const q = polygons[j];
        const flat =
          p.normal[0] * q.normal[0] +
            p.normal[1] * q.normal[1] +
            p.normal[2] * q.normal[2] >
          0.995;
        const close =
          Math.abs(p.color[0] - q.color[0]) +
            Math.abs(p.color[1] - q.color[1]) +
            Math.abs(p.color[2] - q.color[2]) <
          60;
        if (!flat || !close) {
          continue;
        }
        const loop = joined(p, q);
        if (loop && loop.length <= 16 && convex(loop, p.normal)) {
          const area = p.area + q.area;
          polygons[i] = {
            loop,
            area,
            normal: p.normal,
            color: p.color.map(
              (c, k) => (c * p.area + q.color[k] * q.area) / area,
            ),
          };
          polygons.splice(j, 1);
          merged = true;
        }
      }
    }
  }
  const wheels = carStats.wheels?.[index] ?? null;
  return {
    polygons: polygons.map((p) => ({
      color: p.color.map(Math.round),
      points: p.loop.map((v) => corner(v).map(Math.round)),
    })),
    wheels: {
      x: carStats.wlx[index],
      y: carStats.wly[index],
      z: carStats.wlz[index],
      h: carStats.wlh[index],
      raw: wheels,
    },
  };
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(baseURL);
await page.waitForTimeout(1500);
for (const car of cars) {
  const [index, name] = car.split(":");
  const { polygons, wheels } = await page.evaluate(translate, {
    index: Number(index),
  });
  // the original's wheels where ours are: x from the middle, y down from the car's
  // middle to the axle, z along; heights and widths as the original's cars have them
  const wheel = (axle, side) => {
    const height = Math.round(11.95 * wheels.h[axle]);
    const width = Math.round(1.2 * height);
    return `w(${side * Math.round(10 * wheels.x[axle])},${Math.round(10 * wheels.y[axle])},${Math.round(10 * wheels.z[axle])},${axle == 0 ? 11 : 0},${-side * width},${height})`;
  };
  const lines = [
    `// ${name}: made from the modern model car${index}.r3d for the classic look`,
    "// by tools/classic/carToRad.mjs, as the original game never had this car",
    "shadow()",
    "",
    ...polygons.flatMap(({ color, points }) => [
      "<p>",
      `c(${color.join(",")})`,
      ...points.map((p) => `p(${p.join(",")})`),
      "</p>",
      "",
    ]),
    "rims(140,140,140,20,4)",
    "gwgr(30)",
    wheel(0, -1),
    wheel(0, 1),
    wheel(1, -1),
    wheel(1, 1),
    "",
  ];
  writeFileSync(`public/data/classic/${name}.rad`, lines.join("\n"));
  console.log(`${name}: ${polygons.length} polygons`);
}
await browser.close();
