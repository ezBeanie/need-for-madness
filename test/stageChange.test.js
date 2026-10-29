import { expect, test } from "vitest";
import { autopilot, startRace } from "./harness/race.js";
import { PHASE } from "../src/core/state.js";

// NFM1 Stage 1 (the original's stage 1) has rock piles: pieces with models of their own,
// gone when the next stage loads.
const WITH_PILES = 18;

test("an opponent's wall of the stage before is forgotten when the next race starts", async () => {
  const { ctx, step, stepUntil } = await startRace({
    stage: WITH_PILES,
    car: 5,
  });
  // the last pile, past where the next stage's pieces end
  const pile = ctx.pieces.list.findLastIndex(
    (piece, i) => i < ctx.pieces.count && piece.pile,
  );
  expect(pile).toBeGreaterThan(0);
  // an opponent last hit a pile
  ctx.racers[1].wall = pile;
  // the next stage, smaller, loads
  ctx.track.stage = 1;
  ctx.stageLoad.progress = ctx.STAGE_LOAD.requested;
  ctx.menu.redraw = true;
  ctx.game.phase = PHASE.stageLoading;
  stepUntil(() => ctx.game.phase === PHASE.stageSelect, 200, "stage select");
  ctx.flashIntoRace();
  stepUntil(() => ctx.game.phase === PHASE.race, 10, "race");
  expect(pile).toBeGreaterThanOrEqual(ctx.pieces.count);
  expect(ctx.racers[1].wall).toBe(-1);
  for (let i = 0; i < 400 && ctx.game.phase === PHASE.race; i++) {
    Object.assign(ctx.racers[0].u, autopilot(ctx));
    step();
  }
  expect(ctx.game.phase).toBe(PHASE.race);
});
