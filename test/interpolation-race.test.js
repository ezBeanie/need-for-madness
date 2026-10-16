import { describe, expect, test } from "vitest";
import { drawnMatrix, wheelSlip } from "./harness/drawing.js";
import { NO_INPUT, autopilot, startRace } from "./harness/race.js";
import { PHASE } from "../src/core/state.js";

// Fast driving, stunts, flips back onto the wheels, crashes and dust on stage 1;
// opponents wrecking each other (explosions) on stage 5.
const fullThrottle = {
  stage: 1,
  car: 5,
  input: () => ({ ...NO_INPUT, up: true }),
  frames: 2500,
};
const wrecks = { stage: 5, car: 15, input: autopilot, frames: 3000 };

const raceFrames = async ({ stage, car, input, frames }, onFrame) => {
  const { ctx, step } = await startRace({ stage, car });
  for (
    let frame = 0;
    frame < frames && ctx.game.phase === PHASE.race;
    frame++
  ) {
    Object.assign(ctx.racers[0].u, input(ctx));
    step();
    onFrame(ctx, frame);
  }
};

describe("interpolated drawing in a real race", () => {
  test("wheels stay on their car between ticks, also when it spins or flips", async () => {
    let checked = 0;
    let worst = 0;
    await raceFrames(fullThrottle, (ctx) => {
      for (let c = 0; c < ctx.game.carCount; c++) {
        worst = Math.max(worst, wheelSlip(ctx, ctx.car[c].typ, ctx.car[c]));
        checked++;
      }
      ctx.interpolation.alpha = 1;
    });
    expect(checked).toBeGreaterThan(10_000);
    expect(worst).toBeLessThan(0.05);
  });

  // A shadow is interpolated on its own, it is no rigid part of the car. Between two ticks
  // it has to stay under the car body, not jump ahead to the next tick.
  test("shadows stay under their car between ticks", async () => {
    const offset = (ctx, c, alpha) => {
      ctx.interpolation.alpha = alpha;
      const typ = ctx.car[c].typ;
      const body = drawnMatrix(ctx, ctx.carobj[typ], ctx.car[c]);
      const shadow = drawnMatrix(ctx, ctx.shad[typ], ctx.shad[typ]);
      return [shadow[12] - body[12], shadow[14] - body[14]];
    };
    let checked = 0;
    let off = 0;
    await raceFrames(fullThrottle, (ctx) => {
      for (let c = 0; c < ctx.game.carCount; c++) {
        const atTick = offset(ctx, c, 1);
        const between = offset(ctx, c, 0.5);
        if (Math.hypot(between[0] - atTick[0], between[1] - atTick[1]) > 0.5) {
          off++;
        }
        checked++;
      }
      ctx.interpolation.alpha = 1;
    });
    expect(checked).toBeGreaterThan(10_000);
    // a shadow switching to another side of a tilted car is drawn without transition
    expect(off / checked).toBeLessThan(0.01);
  });

  test("drawn instances keep their matrix object from tick to tick", async () => {
    const kept = { persistent: 0, dust: 0, explosions: 0 };
    const total = { persistent: 0, dust: 0, explosions: 0 };
    let before = null;
    await raceFrames(wrecks, (ctx) => {
      const now = {
        persistent: [ctx.skydom.mat, ctx.ground.mat].concat(
          ctx.car
            .slice(0, ctx.game.carCount)
            .flatMap((car) => [car.mat, ...ctx.whl[car.typ].map((w) => w.mat)]),
        ),
        dust: ctx.effects.dust.map((d) => (d.stg != 0 ? d.mat : null)),
        explosions: ctx.effects.exp.map((e) => (e.ani != -1 ? e.mat : null)),
      };
      if (before) {
        for (const kind of Object.keys(now)) {
          now[kind].forEach((mat, i) => {
            if (mat && before[kind][i]) {
              total[kind]++;
              kept[kind] += mat === before[kind][i] ? 1 : 0;
            }
          });
        }
      }
      before = now;
    });
    expect(kept.persistent).toBe(total.persistent);
    // Pooled particles legitimately get a new matrix when a slot is respawned.
    expect(total.dust).toBeGreaterThan(100);
    expect(kept.dust / total.dust).toBeGreaterThan(0.9);
    expect(total.explosions).toBeGreaterThan(10);
    expect(kept.explosions / total.explosions).toBeGreaterThan(0.9);
  });
});
