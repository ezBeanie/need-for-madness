import { afterEach, expect, test, vi } from "vitest";
import { loadGame } from "./harness/loadGame.js";
import { startRace } from "./harness/race.js";
import { PHASE } from "../src/core/state.js";
import { LAST_STAGE } from "../src/data/stages.js";

const storeSettings = (settings) => {
  const stored = new Map(Object.entries(settings));
  vi.stubGlobal("Storage", class {});
  vi.stubGlobal("localStorage", {
    getItem: (name) => stored.get(name) ?? null,
    setItem: (name, value) => stored.set(name, String(value)),
  });
  return stored;
};

const openMainMenu = async () => {
  const game = await loadGame({ seed: 1 });
  game.stepUntil(
    () => game.ctx.game.phase === PHASE.mainMenu,
    400,
    "main menu",
  );
  return game;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test("the campaign opens the stages won, and starts at the newest", async () => {
  storeSettings({ unlocked: "4" });
  const { ctx } = await openMainMenu();
  expect(ctx.raceSetup.kind).toBe(ctx.RACE_KIND.campaign);
  expect(ctx.game.unlocked).toBe(4);
  expect(ctx.track.stage).toBe(4);
  expect(ctx.game.raceCars).toBe(7);
});

test("the other kinds open every stage and car, and the campaign keeps its progress", async () => {
  storeSettings({ unlocked: "4", racecars: "15" });
  const { ctx } = await openMainMenu();
  for (const kind of ["quickRace", "practice", "timeAttack"]) {
    ctx.chooseRaceKind(ctx.RACE_KIND[kind]);
    expect(ctx.game.unlocked).toBe(LAST_STAGE);
  }
  expect(ctx.game.raceCars).toBe(15);
  ctx.chooseRaceKind(ctx.RACE_KIND.campaign);
  expect(ctx.game.unlocked).toBe(4);
  // (the original's field)
  expect(ctx.game.raceCars).toBe(7);
});

test("the campaign races its newest stage with its help, a quick race none and the opponents as strong as chosen", async () => {
  const stored = storeSettings({ unlocked: "4" });
  const { ctx } = await openMainMenu();
  ctx.track.stage = 4;
  ctx.setUpRace();
  expect(ctx.raceSetup).toMatchObject({
    newestStage: 4,
    openedStages: 4,
    aiStage: 4,
  });
  ctx.chooseRaceKind(ctx.RACE_KIND.quickRace);
  const aiStages = [];
  for (let i = 0; i < 3; i++) {
    ctx.nextStrength();
    ctx.setUpRace();
    aiStages.push(ctx.raceSetup.aiStage);
  }
  // (from normal: hard, easy and normal again)
  expect(aiStages).toEqual([LAST_STAGE, 1, 4]);
  expect(stored.get("strength")).toBe("1");
  expect(ctx.raceSetup).toMatchObject({
    newestStage: 0,
    openedStages: LAST_STAGE,
  });
});

test("B sets the opponents' strength in a quick race's stage select only", async () => {
  storeSettings({});
  const { ctx } = await openMainMenu();
  ctx.game.phase = PHASE.stageSelect;
  ctx.onKey("aiStrength", false);
  expect(ctx.raceSetup.strength).toBe(1);
  ctx.chooseRaceKind(ctx.RACE_KIND.quickRace);
  ctx.onKey("aiStrength", false);
  expect(ctx.raceSetup.strength).toBe(2);
});
