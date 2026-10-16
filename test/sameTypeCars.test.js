import { expect, test } from "vitest";
import { recordDraws } from "./harness/drawing.js";
import { NO_INPUT, startRace } from "./harness/race.js";

const nearest = (point, candidates) =>
  candidates.reduce(
    (best, candidate, i) => {
      const d = Math.hypot(...point.map((v, k) => v - candidate[k]));
      return d < best.distance ? { index: i, distance: d } : best;
    },
    { index: -1, distance: Infinity },
  ).index;

// With more cars than car types, several cars share a type and with it the type's models.
// Each car still needs its own wheels and shadow, drawn where that car is.
test("cars of the same type are drawn with their own wheels and shadow", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  const typ = ctx.car[1].typ;
  ctx.car[2].typ = typ;
  for (let frame = 0; frame < 40; frame++) {
    Object.assign(ctx.racers[0].u, { ...NO_INPUT, up: true });
    step();
  }
  const draws = recordDraws(ctx);
  step();

  const drawnAt = (...models) =>
    draws
      .filter((d) => models.some((model) => d.elements === model.ibuf))
      .map((d) => d.at);
  const bodies = drawnAt(ctx.carModels[typ]);
  expect(bodies).toHaveLength(2);
  const perBody = (positions) =>
    positions.reduce(
      (count, position) => {
        count[nearest(position, bodies)]++;
        return count;
      },
      [0, 0],
    );
  expect(perBody(drawnAt(...ctx.tired[typ]))).toEqual([4, 4]);
  expect(perBody(drawnAt(ctx.carShadows[typ]))).toEqual([1, 1]);
});
