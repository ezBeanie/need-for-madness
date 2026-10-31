import { expect, test } from "vitest";
import { PHASE } from "../src/core/state.js";
import { loadGame } from "./harness/loadGame.js";

const HUMANS = [0, 1];
const TICKS = 6000;

// The fixed race (see net/determinism.js) with two people driving, in the game of the one
// driving `player`: the state of the race after each tick (see sharedRace); the dents
// after the last.
const raceAs = async (player) => {
  const { ctx, stepUntil } = await loadGame({ seed: 5 });
  stepUntil(() => ctx.game.phase === PHASE.mainMenu, 400, "main menu");
  ctx.startFingerprintRace();
  stepUntil(() => ctx.game.phase === PHASE.stageSelect, 400, "stage select");
  ctx.beginFingerprintRace();
  // (the two white frames it flashes in with, which set it up)
  ctx.runTick();
  ctx.runTick();
  ctx.game.humans = HUMANS;
  ctx.game.player = player;
  // (as the host starts it, see host.js)
  ctx.raceEvents.onautocorrect = 0;
  const states = [];
  // whether a missed checkpoint's warning counted on, for a car of either (coming back to
  // the checkpoint jumps ahead without counting)
  let warned = false;
  for (let t = 0; t < TICKS; t++) {
    ctx.fingerprintRaceTick(ctx.runTick);
    warned ||= HUMANS.some(
      (c) =>
        ctx.racers[c].missedCheckpoint > ctx.MISSED.started &&
        ctx.racers[c].missedCheckpoint < ctx.MISSED.comingBack,
    );
    const { cars, ...race } = ctx.sharedRace();
    states.push(
      JSON.stringify({ ...race, cars: cars.map(({ dents, ...car }) => car) }),
    );
  }
  expect(ctx.game.player).toBe(player);
  return {
    states,
    dents: JSON.stringify(ctx.saveRace().cars.map(({ dents }) => dents)),
    over: ctx.track.haltall,
    warned,
  };
};

test("a race two people drive together computes alike in the game of each", async () => {
  const host = await raceAs(HUMANS[0]);
  const guest = await raceAs(HUMANS[1]);
  const parted = host.states.findIndex((state, t) => state != guest.states[t]);
  expect(parted, `parted at tick ${parted}`).toBe(-1);
  expect(guest.dents).toEqual(host.dents);
  expect(host.over).toBe(true);
  expect(host.warned).toBe(true);
}, 60000);
