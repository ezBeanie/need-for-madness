import { expect, test } from "vitest";
import { PHASE } from "../src/core/state.js";
import { loadGame } from "./harness/loadGame.js";

// (a race computed again after keys guessed wrong runs quietly, see lockstep.js)
test("a race run quietly, burning wreck and all, comes out as one run seen and heard", async () => {
  const { ctx, stepUntil } = await loadGame({ seed: 5 });
  stepUntil(() => ctx.game.phase === PHASE.mainMenu, 400, "main menu");
  ctx.startFingerprintRace();
  stepUntil(() => ctx.game.phase === PHASE.stageSelect, 400, "stage select");
  ctx.beginFingerprintRace();
  for (let i = 0; i < 150; i++) {
    ctx.runTick();
  }
  // a car wasted: it blinks, then burns (with the body the hits wasting it would have
  // given it)
  ctx.fixcar(3);
  ctx.racers[3].damage = 1e6;
  const start = structuredClone(ctx.saveRace());
  const run = () => {
    for (let i = 0; i < 150; i++) {
      ctx.runTick();
    }
    return ctx.encode(ctx.sharedRace());
  };
  const seenAndHeard = run();
  expect(ctx.racers[3].cntdest).toBeGreaterThan(7);
  ctx.restoreRace(start);
  ctx.physics.quiet = true;
  const quiet = run();
  ctx.physics.quiet = false;
  expect(
    ctx.differencesOf(ctx.decode(quiet), ctx.decode(seenAndHeard)),
  ).toEqual([]);
}, 30000);
