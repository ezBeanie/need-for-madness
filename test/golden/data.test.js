import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { goldenOrWrite } from "../harness/golden.js";
import { startRace } from "../harness/race.js";

const STAGE_COUNT = 17;
const CAR_COUNT = 19;

const hash = (...arrays) =>
  createHash("sha1")
    .update(JSON.stringify(arrays.map((a) => Array.from(a))))
    .digest("hex")
    .slice(0, 12);

const expectGolden = (name, data) => {
  // Round-trip through JSON like the stored file, which turns -0 into 0.
  const json = JSON.parse(JSON.stringify(data));
  const golden = goldenOrWrite(name, json);
  if (golden !== null) {
    expect(json).toEqual(golden);
  }
};

describe("parsed stage data matches the golden master", () => {
  test.each(Array.from({ length: STAGE_COUNT }, (_, i) => i + 1))(
    "stage %i",
    async (stage) => {
      const { ctx } = await startRace({ stage, car: 5 });
      const cp = ctx.track;
      const range = (n) => Array.from({ length: n }, (_, i) => i);
      expectGolden(`stage-${String(stage).padStart(2, "0")}`, {
        name: cp.name,
        nlaps: cp.nlaps,
        checkpoints: cp.nsp,
        fixPoints: ctx.pieces.fixCount,
        pieces: range(ctx.pieces.count).map((i) => {
          const o = ctx.pieces.list[i];
          return [
            o.typ,
            o.x,
            o.y,
            o.z,
            o.bx,
            o.by,
            o.bz,
            o.iscp,
            +o.mat[0].toFixed(6),
            +o.mat[2].toFixed(6),
          ];
        }),
        path: range(cp.n).map((i) => [
          cp.x[i],
          cp.y[i],
          cp.z[i],
          cp.typ[i],
          cp.obi[i],
        ]),
      });
    },
  );
});

describe("car data matches the golden master", () => {
  test("stats, wheels and models of all cars", async () => {
    const { ctx } = await startRace({ stage: 1, car: 5 });
    const stats = Object.fromEntries(
      Object.entries(ctx.carStats).filter(([, v]) => Array.isArray(v)),
    );
    const cars = Array.from({ length: CAR_COUNT }, (_, i) => {
      const model = ctx.carModels[i];
      return {
        name: ctx.carStats.names[i],
        wheels: { x: ctx.wlx[i], y: ctx.wly[i], z: ctx.wlz[i], h: ctx.wlh[i] },
        model: {
          bounds: [model.bx, model.by, model.bz],
          colrad: model.colrad,
          vertices: model.vrt.length / 3,
          triangles: model.tri.length / 3,
          hash: hash(model.vrt, model.tri, model.tex),
        },
      };
    });
    expectGolden("cars", { stats, cars });
  });
});
