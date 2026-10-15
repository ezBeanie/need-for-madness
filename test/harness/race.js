import { createHash } from "node:crypto";
import { loadGame } from "./loadGame.js";

const KEY = { up: 38, down: 40, left: 37, right: 39, handb: 32 };
const NO_INPUT = {
  up: false,
  down: false,
  left: false,
  right: false,
  handb: false,
};
const DEG = 0.017453292519943295;

export const openCarSelect = ({ seed = 1, fxSeed } = {}) => {
  const game = loadGame({ seed, fxSeed });
  const { ctx, stepUntil, key } = game;
  stepUntil(() => ctx.fase === 1, 400, "main menu");
  key(13, true);
  stepUntil(() => ctx.fase === 2, 300, "car select");
  key(13, false);
  return game;
};

export const openStageSelect = ({
  stage,
  car,
  seed = 1,
  fxSeed,
  unlocked = 17,
}) => {
  const game = loadGame({ seed, fxSeed });
  const { ctx, stepUntil } = game;
  stepUntil(() => ctx.fase === 1, 400, "main menu");

  // Same state the car select screen leaves behind before "PLAY".
  ctx.sel[0] = car;
  ctx.unlocked = unlocked;
  ctx.cp.stage = stage;
  ctx.stageloadtyp = 0;
  ctx.stageload = 0;
  ctx.updateframe = true;
  ctx.fase = 3;
  stepUntil(() => ctx.fase === 4, 100, "stage select");
  return game;
};

export const startRace = ({ stage, car, seed = 1, fxSeed, unlocked = 17 }) => {
  const game = openStageSelect({ stage, car, seed, fxSeed, unlocked });
  const { ctx, stepUntil } = game;
  ctx.gamemode = 0;
  ctx.startflash();
  stepUntil(() => ctx.fase === 7, 10, "race");
  return game;
};

// Steers the player towards the path point the game itself tracks for car 0.
// Deliberately naive: crashes and wrecks are as interesting for the tests as clean laps.
export const autopilot = (ctx) => {
  const car = ctx.car[0];
  const cp = ctx.cp;
  const target = (ctx.point[0] + 2) % cp.n;
  const dx = cp.x[target] - car.x;
  const dz = cp.z[target] - car.z;
  let pan = 90 + (dx >= 0 ? 180 : 0) + Math.atan(dz / dx) / DEG;
  let heading = car.xz;
  while (heading < 0) heading += 360;
  while (heading > 180) heading -= 360;
  while (pan < 0) pan += 360;
  while (pan > 180) pan -= 360;
  let diff = heading - pan;
  if (Math.abs(diff) >= 180) {
    diff = -diff;
  }
  return { ...NO_INPUT, up: true, left: diff > 5, right: diff < -5 };
};

const round = (n) => (typeof n === "boolean" ? Number(n) : n);

export const raceState = (ctx) => ({
  fase: ctx.fase,
  starcnt: ctx.starcnt,
  wasted: ctx.cp.wasted,
  cars: Array.from({ length: ctx.ncars }, (_, i) => {
    const car = ctx.car[i];
    return [
      car.x,
      car.y,
      car.z,
      car.xz,
      car.xy,
      car.zy,
      car.wxz,
      car.wzy,
      ctx.speed[i],
      ctx.power[i],
      ctx.hitmag[i],
      ctx.dest[i],
      ctx.clear[i],
      ctx.pcleared[i],
      ctx.cp.pos[i],
      ctx.mtouch[i],
    ].map(round);
  }),
});

const hashState = (state) =>
  createHash("sha1").update(JSON.stringify(state)).digest("hex").slice(0, 10);

const SAMPLE_EVERY = 100;

// Runs a race and records a hash of the full race state for every frame, plus readable
// samples so a mismatch can be inspected.
export const recordRace = ({ stage, car, seed, fxSeed, frames, input }) => {
  const { ctx, step, key } = startRace({ stage, car, seed, fxSeed });
  const states = [];
  let held = { ...NO_INPUT };
  for (let frame = 0; frame < frames && ctx.fase === 7; frame++) {
    const wanted = input(ctx, frame);
    for (const name of Object.keys(KEY)) {
      if (wanted[name] !== held[name]) {
        key(KEY[name], wanted[name]);
      }
    }
    held = wanted;
    step();
    states.push(raceState(ctx));
  }
  return {
    frames: states.length,
    hashes: states.map(hashState),
    samples: Object.fromEntries(
      states
        .map((state, frame) => [frame, state])
        .filter(
          ([frame]) =>
            frame % SAMPLE_EVERY === 0 || frame === states.length - 1,
        ),
    ),
    states,
  };
};

export { NO_INPUT };
