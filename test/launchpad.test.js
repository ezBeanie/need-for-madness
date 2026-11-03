import { expect, test } from "vitest";
import { startRace } from "./harness/race.js";

// None of this game's own stages has the launchpad, the original's multiplayer stages do:
// its model is there to be hit (see meetPiece in physics.js).
test("the launchpads of the original's first multiplayer stage are solid", async () => {
  const { ctx } = await startRace({ stage: 46, car: 5 });
  const launchpads = ctx.pieces.list
    .slice(0, ctx.pieces.count)
    .filter((piece) => piece.typ == ctx.PIECE.launchpad);
  expect(launchpads.length).toBe(2);
  const model = ctx.pieceModels[ctx.PIECE.launchpad];
  expect(model.ni).toBeGreaterThan(0);
  expect(model.intershad || model.interact).toBe(true);
  for (const piece of launchpads) {
    expect(piece.by).toBeGreaterThan(0);
  }
});
