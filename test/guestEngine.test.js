import { expect, test } from "vitest";
import { PHASE } from "../src/core/state.js";
import { loadGame } from "./harness/loadGame.js";

// A guest goes from its menu into the host's race, through no stage select of its own,
// which loads the player's engine sound.
test("a guest's game loads the engine sound of the car it drives in the host's race", async () => {
  const { ctx, stepUntil } = await loadGame({ seed: 1 });
  stepUntil(() => ctx.game.phase === PHASE.mainMenu, 400, "main menu");
  const type = 9;
  expect(ctx.isEngineLoaded(type)).toBe(false);
  ctx.game.carTypes[1] = type;
  ctx.guest.car = 1;
  ctx.guest.start = { players: ["host0000", "guest001"] };
  ctx.showHostedRace();
  // (no stage loaded to race on: the menu again, while the sound loads)
  ctx.game.phase = PHASE.mainMenu;
  ctx.game.humans = [];
  stepUntil(() => ctx.isEngineLoaded(type), 100, "engine loaded");
});
