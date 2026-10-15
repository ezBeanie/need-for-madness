import { describe, expect, test } from "vitest";
import { NO_INPUT, autopilot, startRace } from "./harness/race.js";

// Fast driving, stunts, flips back onto the wheels, crashes and dust on stage 1;
// opponents wrecking each other (explosions) on stage 5.
const fullThrottle = {
  stage: 1,
  car: 5,
  input: () => ({ ...NO_INPUT, up: true }),
  frames: 2500,
};
const wrecks = { stage: 5, car: 15, input: autopilot, frames: 3000 };

const raceFrames = ({ stage, car, input, frames }, onFrame) => {
  const { ctx, step } = startRace({ stage, car });
  for (let frame = 0; frame < frames && ctx.fase === 7; frame++) {
    Object.assign(ctx.u[0], input(ctx));
    step();
    onFrame(ctx, frame);
  }
};

// The model matrix rad is drawn with for instance inst, handed over like render() does.
const drawnMatrix = (ctx, rad, inst) => {
  rad.x = inst.x;
  rad.y = inst.y;
  rad.z = inst.z;
  rad.mat = inst.mat;
  ctx.placemodel(rad);
  return ctx.mat4.clone(ctx.drawmat);
};

// Where the wheels are drawn, seen from the drawn car body.
const wheelsOnBody = (ctx, c, alpha) => {
  const { mat4 } = ctx;
  const typ = ctx.car[c].typ;
  ctx.tickalpha = alpha;
  ctx.whl[typ].forEach((wheel) => ctx.lerpattach(wheel.mat, ctx.car[c]));
  const body = mat4.invert(
    mat4.create(),
    drawnMatrix(ctx, ctx.carobj[typ], ctx.car[c]),
  );
  return ctx.whl[typ].map((wheel, w) => {
    const drawn = drawnMatrix(ctx, ctx.tired[typ][w >> 1], wheel);
    const onBody = mat4.multiply(mat4.create(), body, drawn);
    return [onBody[12], onBody[13], onBody[14]];
  });
};

describe("interpolated drawing in a real race", () => {
  test("wheels stay on their car between ticks, also when it spins or flips", () => {
    let checked = 0;
    let worst = 0;
    raceFrames(fullThrottle, (ctx) => {
      for (let c = 0; c < ctx.ncars; c++) {
        const atTick = wheelsOnBody(ctx, c, 1);
        for (const alpha of [0.25, 0.5, 0.75]) {
          wheelsOnBody(ctx, c, alpha).forEach((pos, w) => {
            const off = Math.hypot(...pos.map((v, i) => v - atTick[w][i]));
            worst = Math.max(worst, off);
          });
        }
        checked++;
      }
      ctx.tickalpha = 1;
    });
    expect(checked).toBeGreaterThan(10_000);
    expect(worst).toBeLessThan(0.05);
  });

  test("drawn instances keep their matrix object from tick to tick", () => {
    const kept = { persistent: 0, dust: 0, explosions: 0 };
    const total = { persistent: 0, dust: 0, explosions: 0 };
    let before = null;
    raceFrames(wrecks, (ctx) => {
      const now = {
        persistent: [ctx.skydom.mat, ctx.ground.mat].concat(
          ctx.car
            .slice(0, ctx.ncars)
            .flatMap((car) => [car.mat, ...ctx.whl[car.typ].map((w) => w.mat)]),
        ),
        dust: ctx.dust.map((d) => (d.stg != 0 ? d.mat : null)),
        explosions: ctx.exp.map((e) => (e.ani != -1 ? e.mat : null)),
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
