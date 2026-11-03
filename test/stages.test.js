import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { makePile, pileColor } from "../src/data/pile.js";
import { parseStage } from "../src/data/stageFormat.js";
import {
  FIRST_OWN_STAGE,
  collections,
  customStage,
  LAST_STAGE,
  collectionOf,
  firstOfCollection,
  STAGE_COUNT,
  levelOf,
  stageAfter,
  stageBefore,
  musicOf,
  originalOf,
  stageFile,
  stageLabel,
} from "../src/data/stages.js";

test("after this game's stages come the original's of Need for Madness 1 and 2", () => {
  expect([1, 17, 18, 27, 28, 44].map(originalOf)).toEqual([
    0, 0, 1, 10, 11, 27,
  ]);
  expect([1, 18, 27, 28, 44].map(stageLabel)).toEqual([
    "Stage 1",
    "NFM1 Stage 1",
    "NFM1 Stage 10",
    "NFM2 Stage 1",
    "NFM2 Stage 17",
  ]);
  expect(stageFile(3)).toBe("data/stages/3.txt");
  expect(stageFile(28)).toBe("data/classic/stages/11.txt");
  expect(STAGE_COUNT).toBe(50);
});

test("NFM1's eleventh stage is the original's 27, after its tenth and before NFM2's first", () => {
  expect(originalOf(45)).toBe(27);
  expect(stageLabel(45)).toBe("NFM1 Stage 11");
  expect(stageFile(45)).toBe("data/classic/stages/27.txt");
  expect(collectionOf(45)).toBe(1);
  expect([27, 45, 44].map(stageAfter)).toEqual([45, 28, 46]);
  expect([28, 45, 18].map(stageBefore)).toEqual([45, 27, 17]);
  expect(musicOf(45)).toEqual({ file: "nfm1-stage11", classic: true });
  const loops = JSON.parse(
    readFileSync(
      new URL("../public/data/classic/music/loops.json", import.meta.url),
      "utf8",
    ),
  );
  expect(loops["nfm1-stage11"]).toBeDefined();
});

test("the stage select offers this game's stages, NFM1's, NFM2's and the multiplayer stages as collections", () => {
  expect(collections()).toHaveLength(4);
  expect([1, 17, 18, 27, 28, 44, 46, 50].map(collectionOf)).toEqual([
    0, 0, 1, 1, 2, 2, 3, 3,
  ]);
  expect([1, 2, 3].map(firstOfCollection)).toEqual([18, 28, 46]);
});

test("the player's own stages come after all others, in a collection of their own once there are some", () => {
  customStage.texts = ["name(A)", "name(B)"];
  expect(collections()).toEqual(["Modern", "NFM 1", "NFM 2", "NFM MP", "Own"]);
  expect(FIRST_OWN_STAGE).toBe(STAGE_COUNT + 2);
  expect([FIRST_OWN_STAGE, FIRST_OWN_STAGE + 1].map(collectionOf)).toEqual([
    4, 4,
  ]);
  expect(firstOfCollection(4)).toBe(FIRST_OWN_STAGE);
  expect(stageAfter(50)).toBe(FIRST_OWN_STAGE);
  expect(stageAfter(FIRST_OWN_STAGE)).toBe(FIRST_OWN_STAGE + 1);
  expect(stageAfter(FIRST_OWN_STAGE + 1)).toBe(0);
  expect(stageBefore(FIRST_OWN_STAGE)).toBe(50);
  expect(stageLabel(FIRST_OWN_STAGE + 1)).toBe("Own Stage 2");
  expect(originalOf(FIRST_OWN_STAGE)).toBe(0);
  customStage.texts = [];
  expect(stageAfter(50)).toBe(0);
});

test("the original's multiplayer stages 28 to 32 come last, with their own music", () => {
  expect([46, 50].map(originalOf)).toEqual([28, 32]);
  expect([46, 50].map(stageLabel)).toEqual([
    "Multiplayer Stage 1",
    "Multiplayer Stage 5",
  ]);
  expect(stageFile(50)).toBe("data/classic/stages/32.txt");
  expect([44, 46, 50].map(stageAfter)).toEqual([46, 47, 0]);
  expect(stageBefore(46)).toBe(44);
  expect([46, 50].map(musicOf)).toEqual([
    { file: "mp-stage1", classic: true },
    { file: "mp-stage5", classic: true },
  ]);
  const loops = JSON.parse(
    readFileSync(
      new URL("../public/data/classic/music/loops.json", import.meta.url),
      "utf8",
    ),
  );
  for (let i = 1; i <= 5; i++) {
    expect(loops[`mp-stage${i}`]).toBeDefined();
  }
});

test("the original's stages get opponents from easy to hard, and their own music", () => {
  expect([18, 27, 45, 28, 44].map(levelOf)).toEqual([1, 15, 16, 1, 16]);
  expect(levelOf(5)).toBe(5);
  expect([5, 18, 27, 28, 44].map(musicOf)).toEqual([
    { file: "stage5", classic: false },
    { file: "nfm1-stage1", classic: true },
    { file: "nfm1-stage10", classic: true },
    { file: "stage1", classic: true },
    { file: "stage17", classic: true },
  ]);
});

// the pieces this game has: the file counts from 10 (see PIECE_FILES; the original's net,
// its 51, comes after them)
const knownPiece = (piece) => piece >= 10 && piece <= 75;

test("every original stage names only pieces this game has", () => {
  for (let stage = LAST_STAGE + 1; stage <= STAGE_COUNT; stage++) {
    const source = readFileSync(
      new URL(`../public/${stageFile(stage)}`, import.meta.url),
      "utf8",
    );
    const entries = parseStage(source);
    const pieces = entries
      .filter(({ command }) => ["set", "chk", "fix"].includes(command))
      .map(({ piece }) => piece);
    expect(
      pieces.filter((piece) => !knownPiece(piece)),
      stageLabel(stage),
    ).toEqual([]);
    expect(entries.some(({ command }) => command == "nlaps")).toBe(true);
  }
});

// what the original's ContO made of pile(1081,4,6,...) with its Medium's own colours
const originalPile = JSON.parse(
  readFileSync(
    new URL("./fixtures/pile-1081-4-6.json", import.meta.url),
    "utf8",
  ),
);

test("a rock pile has the original's shape and colours", () => {
  const pile = makePile(1081, 4, 6);
  expect(pile.faces.map(({ points }) => points)).toEqual(originalPile.faces);
  expect(pile.maxR).toBe(originalPile.maxR);
  expect(
    pile.faces.map(({ shade }) =>
      pileColor(shade, originalPile.cpol, originalPile.cgrnd),
    ),
  ).toEqual(originalPile.colors);
});

// (the campaign, which races this game's stages only, opens on its newest)
for (const [kind, stage] of [
  ["quickRace", 30],
  ["campaign", 4],
]) {
  test(`after the original's stage 30, the stage select of a ${kind} opens on stage ${stage}`, async () => {
    const { openCarSelect } = await import("./harness/race.js");
    const { PHASE } = await import("../src/core/state.js");
    const { ctx, key, step, stepUntil } = await openCarSelect();
    ctx.career.progress = 4;
    ctx.chooseRaceKind(ctx.RACE_KIND[kind]);
    ctx.track.stage = 30;
    for (let i = 0; i < 60; i++) {
      step();
    }
    key(13, true);
    step();
    key(13, false);
    stepUntil(() => ctx.game.phase === PHASE.stageSelect, 300, "stage select");
    expect(ctx.track.stage).toBe(stage);
  });
}

test("this game's stages play their own music in the classic look too", async () => {
  const { startRace } = await import("./harness/race.js");
  const { ctx, key, step } = await startRace({ stage: 1, car: 5 });
  key(76, true);
  key(76, false);
  step();
  expect(ctx.look.current).toBe(ctx.LOOK.classic);
  // (the tracks load as the sounds do, to play on Web Audio)
  const loaded = [];
  const Request = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = class extends Request {
    open(method, url) {
      super.open(method, url);
      loaded.push(url);
    }
  };
  try {
    ctx.playStageMusic(2);
  } finally {
    globalThis.XMLHttpRequest = Request;
  }
  expect(loaded).toEqual(["data/music/stage2.mp3"]);
});

test("the multiplayer stages load and race, the original's net as a piece of its own", async () => {
  const { startRace } = await import("./harness/race.js");
  for (const stage of [46, 47, 48, 49, 50]) {
    const { ctx, step } = await startRace({ stage, car: 5 });
    for (let i = 0; i < 30; i++) {
      step();
    }
    const types = ctx.pieces.list.slice(0, ctx.pieces.count).map((p) => p.typ);
    // the net stands in the original's 29, 30 and 32, nowhere this game's takeoffb
    expect(types.filter((typ) => typ == 66).length, stageLabel(stage)).toBe(
      { 46: 0, 47: 1, 48: 1, 49: 0, 50: 4 }[stage],
    );
    expect(types.includes(41), stageLabel(stage)).toBe(false);
  }
  const { pieceModels } = await import("../src/race/track.js");
  expect(pieceModels[66].ni).toBeGreaterThan(0);
  expect(pieceModels[66].intershad).toBe(true);
});

test("the menus' music stops a stage's still playing, as after a race left together", async () => {
  const { startRace } = await import("./harness/race.js");
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  ctx.unlockAudio(false);
  // the stage's track, loaded, played and, once the menus start theirs, stopped
  const playing = new Set();
  const { createBufferSource } = globalThis.AudioContext.prototype;
  globalThis.AudioContext.prototype.createBufferSource = function () {
    const source = createBufferSource.call(this);
    source.start = () => playing.add(source);
    source.stop = () => playing.delete(source);
    return source;
  };
  try {
    const before = new Set(playing);
    ctx.playStageMusic(2);
    for (let i = 0; i < 5; i++) {
      step();
      // (the track starts once its loop is known, a promise later)
      await Promise.resolve();
    }
    // (the sounds start too; a track sets where it loops)
    const stage = [...playing].filter(
      (source) => !before.has(source) && "loopEnd" in source,
    );
    expect(stage.length).toBe(1);
    ctx.playMenuMusic();
    for (let i = 0; i < 5; i++) {
      step();
    }
    for (const source of stage) {
      expect(playing.has(source)).toBe(false);
    }
  } finally {
    globalThis.AudioContext.prototype.createBufferSource = createBufferSource;
  }
});

test("the engine stops in the menus, also after a race left together without the pause", async () => {
  const { startRace } = await import("./harness/race.js");
  const { ctx, key, step } = await startRace({ stage: 1, car: 5 });
  ctx.unlockAudio(true);
  // (as the stage select loads it)
  ctx.loadEngine(ctx.game.carTypes[0]);
  key(38, true);
  for (let i = 0; i < 400 && !ctx.engine.started; i++) {
    step();
  }
  expect(ctx.engine.started).toBe(true);
  key(38, false);
  // (as Leave Race goes: straight to the main menu)
  ctx.game.phase = ctx.PHASE.mainMenu;
  step();
  expect(ctx.engine.started).toBe(false);
});
