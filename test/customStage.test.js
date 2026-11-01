import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { startRace } from "./harness/race.js";

const stageText = (stage) =>
  readFileSync(
    new URL(`../public/data/stages/${stage}.txt`, import.meta.url),
    "utf8",
  );

// what the stage file made: the path, the pieces and the colours
const loaded = (ctx) => ({
  path: [ctx.track.x, ctx.track.z, ctx.track.typ, ctx.track.obi].map((a) =>
    a.slice(0, ctx.track.n),
  ),
  checkpoints: ctx.track.nsp,
  laps: ctx.track.nlaps,
  walls: [ctx.track.limr, ctx.track.liml, ctx.track.limt, ctx.track.limb],
  pieces: ctx.pieces.list
    .slice(0, ctx.pieces.count)
    .map(({ typ, x, y, z, bx, bz }) => ({ typ, x, y, z, bx, bz })),
  colors: ctx.scene.colors,
});

// a race on the stage's text as one of the player's own, the text set before it loads
const customRace = async (text) => {
  const { loadGame } = await import("./harness/loadGame.js");
  const game = await loadGame({ seed: 1 });
  const { ctx, stepUntil } = game;
  stepUntil(() => ctx.game.phase === ctx.PHASE.mainMenu, 400, "main menu");
  ctx.customStage.visiting = text;
  ctx.game.carTypes[0] = 5;
  ctx.game.unlocked = 17;
  ctx.game.raceCars = 7;
  ctx.track.stage = ctx.VISITING_STAGE;
  ctx.menu.redraw = true;
  ctx.game.phase = ctx.PHASE.stageLoading;
  stepUntil(
    () => ctx.game.phase === ctx.PHASE.stageSelect,
    100,
    "stage select",
  );
  ctx.game.mode = 0;
  ctx.flashIntoRace();
  stepUntil(() => ctx.game.phase === ctx.PHASE.race, 10, "race");
  return game;
};

test("a stage of the player's own loads from its text as the same stage from its file", async () => {
  const fromFile = await startRace({ stage: 3, car: 5 });
  const own = await customRace(stageText(3));
  expect(own.ctx.track.stage).toBe(own.ctx.VISITING_STAGE);
  expect(own.ctx.track.name).toBe(fromFile.ctx.track.name);
  expect(loaded(own.ctx)).toEqual(loaded(fromFile.ctx));
});

test("a stage of the player's own says how hard its opponents are and its music, and unlocks no car", async () => {
  const text = `${stageText(3)}\nlevel(12)\nmusic(5)\n`;
  const { ctx, step } = await customRace(text);
  expect(ctx.customStage.level).toBe(12);
  expect(ctx.levelOf(ctx.VISITING_STAGE)).toBe(12);
  expect(ctx.musicOf(ctx.VISITING_STAGE)).toEqual({
    file: "stage5",
    classic: false,
  });
  expect(ctx.stageLabel(ctx.VISITING_STAGE)).toBe("Custom Stage");
  // no boss of the stage in the field: every opponent one of the 19 cars
  const types = ctx.game.carTypes.slice(1, ctx.game.carCount);
  expect(types.every((type) => type >= 0 && type < 19)).toBe(true);
  // the opponents race it
  for (let i = 0; i < 600; i++) {
    step();
  }
  const cleared = ctx.track.clear.slice(1, ctx.game.carCount);
  expect(Math.max(...cleared)).toBeGreaterThan(0);
});

test("without a level and music a stage of the player's own is of middle hardness with the first stage's music", async () => {
  const { ctx } = await customRace(stageText(3));
  expect(ctx.levelOf(ctx.VISITING_STAGE)).toBe(8);
  expect(ctx.musicOf(ctx.VISITING_STAGE).file).toBe("stage1");
});

test("a stage file of the original game races as the player's own as it does as the original's", async () => {
  const { fromOriginal } = await import("../src/editor/stageModel.js");
  // the multiplayer stage with the net (the original's 29, this game's 47)
  const original = readFileSync(
    new URL("../public/data/classic/stages/29.txt", import.meta.url),
    "utf8",
  );
  const asOriginal = await startRace({ stage: 47, car: 5 });
  const asOwn = await customRace(fromOriginal(original));
  expect(loaded(asOwn.ctx).pieces).toEqual(loaded(asOriginal.ctx).pieces);
  expect(loaded(asOwn.ctx).path).toEqual(loaded(asOriginal.ctx).path);
  // a file of this game's own stays as it is
  expect(fromOriginal(stageText(3))).toBe(stageText(3));
});
