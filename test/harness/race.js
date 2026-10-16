import { createHash } from "node:crypto";
import { PHASE } from "../../src/core/state.js";
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

export const openCarSelect = async ({ seed = 1, fxSeed } = {}) => {
  const game = await loadGame({ seed, fxSeed });
  const { ctx, stepUntil, key } = game;
  stepUntil(() => ctx.game.phase === PHASE.mainMenu, 400, "main menu");
  key(13, true);
  stepUntil(() => ctx.game.phase === PHASE.carSelect, 300, "car select");
  key(13, false);
  return game;
};

export const openStageSelect = async ({
  stage,
  car,
  seed = 1,
  fxSeed,
  unlocked = 17,
}) => {
  const game = await loadGame({ seed, fxSeed });
  const { ctx, stepUntil } = game;
  stepUntil(() => ctx.game.phase === PHASE.mainMenu, 400, "main menu");

  // Same state the car select screen leaves behind before "PLAY".
  ctx.game.carTypes[0] = car;
  ctx.game.unlocked = unlocked;
  ctx.cp.stage = stage;
  ctx.stageloadtyp = 0;
  ctx.stageload = 0;
  ctx.updateframe = true;
  ctx.game.phase = PHASE.stageLoading;
  stepUntil(() => ctx.game.phase === PHASE.stageSelect, 100, "stage select");
  return game;
};

export const startRace = async ({
  stage,
  car,
  seed = 1,
  fxSeed,
  unlocked = 17,
}) => {
  const game = await openStageSelect({ stage, car, seed, fxSeed, unlocked });
  const { ctx, stepUntil } = game;
  ctx.game.mode = 0;
  ctx.startflash();
  stepUntil(() => ctx.game.phase === PHASE.race, 10, "race");
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
  fase: ctx.game.phase,
  starcnt: ctx.starcnt,
  wasted: ctx.cp.wasted,
  cars: Array.from({ length: ctx.game.carCount }, (_, i) => {
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

const normalizeAngle = (angle) => {
  let a = angle;
  while (a < -180) a += 360;
  while (a > 180) a -= 360;
  return a;
};

// Drives car 0 along the stage's path points in order and eases off the gas in sharp
// turns. Good enough to win the first stages, so race ends and replays get covered.
export const racingAutopilot = () => {
  let next = 0;
  return (ctx) => {
    const car = ctx.car[0];
    const cp = ctx.cp;
    for (
      let skipped = 0;
      skipped < 3 && Math.hypot(cp.x[next] - car.x, cp.z[next] - car.z) < 350;
      skipped++
    ) {
      next = (next + 1) % cp.n;
    }
    const dx = cp.x[next] - car.x;
    const dz = cp.z[next] - car.z;
    const pan = 90 + (dx >= 0 ? 180 : 0) + Math.atan(dz / dx) / DEG;
    const diff = normalizeAngle(normalizeAngle(car.xz) - normalizeAngle(pan));
    return {
      ...NO_INPUT,
      up: Math.abs(diff) < 50 || ctx.speed[0] < 12,
      left: diff > 4,
      right: diff < -4,
    };
  };
};

const hashState = (state) =>
  createHash("sha1").update(JSON.stringify(state)).digest("hex").slice(0, 10);

const SAMPLE_EVERY = 100;

// Runs a race and records a hash of the full race state for every frame, plus readable
// samples so a mismatch can be inspected.
export const recordRace = async ({
  stage,
  car,
  seed,
  fxSeed,
  frames,
  input,
}) => {
  const { ctx, step, key } = await startRace({ stage, car, seed, fxSeed });
  const states = [];
  let held = { ...NO_INPUT };
  for (
    let frame = 0;
    frame < frames && ctx.game.phase === PHASE.race;
    frame++
  ) {
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
  return summarize(states);
};

// The race state plus where the game flow is: menus, results, unlocked stages.
const flowState = (ctx) => ({
  ...raceState(ctx),
  stage: ctx.cp.stage,
  unlocked: ctx.game.unlocked,
  winner: ctx.winner,
  holdcnt: ctx.holdcnt,
});

// Records a whole game flow, e.g. finishing a race and clicking through the menus.
// script(ctx, frame, game) runs before every frame and may press keys or call game
// functions.
export const recordFlow = async ({ stage, car, seed, frames, script }) => {
  const game = await startRace({ stage, car, seed });
  const states = [];
  for (let frame = 0; frame < frames; frame++) {
    script(game.ctx, frame, game);
    game.step();
    states.push(flowState(game.ctx));
  }
  return summarize(states);
};

const summarize = (states) => ({
  frames: states.length,
  hashes: states.map(hashState),
  samples: Object.fromEntries(
    states
      .map((state, frame) => [frame, state])
      .filter(
        ([frame]) => frame % SAMPLE_EVERY === 0 || frame === states.length - 1,
      ),
  ),
  states,
});

export { NO_INPUT };
