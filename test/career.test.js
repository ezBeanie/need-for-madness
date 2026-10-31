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

test("without the career every stage and car is open, starting at the first stage", async () => {
  storeSettings({ unlocked: "4" });
  const { ctx } = await openMainMenu();
  expect(ctx.career.on).toBe(false);
  expect(ctx.game.unlocked).toBe(LAST_STAGE);
  expect(ctx.track.stage).toBe(1);
});

test("the career opens the stages won", async () => {
  storeSettings({ unlocked: "4", career: "1" });
  const { ctx } = await openMainMenu();
  expect(ctx.career.on).toBe(true);
  expect(ctx.game.unlocked).toBe(4);
  expect(ctx.track.stage).toBe(4);
});

test("switching the career in the main menu keeps its progress", async () => {
  const stored = storeSettings({ unlocked: "4" });
  const { ctx } = await openMainMenu();
  ctx.onKey("toggleCareer", false);
  expect(ctx.game.unlocked).toBe(4);
  expect(stored.get("career")).toBe("1");
  ctx.onKey("toggleCareer", false);
  expect(ctx.game.unlocked).toBe(LAST_STAGE);
  expect(stored.get("career")).toBe("0");
  expect(stored.get("unlocked")).toBe("4");
});

test("the career is not switched in a race, as the AI races by it", async () => {
  storeSettings({ unlocked: "4" });
  const { ctx } = await startRace({ stage: 3, car: 5 });
  ctx.onKey("toggleCareer", false);
  expect(ctx.career.on).toBe(false);
  expect(ctx.game.unlocked).toBe(LAST_STAGE);
});
