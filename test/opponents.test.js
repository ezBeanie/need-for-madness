import { expect, test } from "vitest";
import { seededRandom } from "./harness/loadGame.js";
import { startRace } from "./harness/race.js";

// Who races on each stage and where the cars start: some stages pick their opponents
// differently while they are the next to win, and fields grow up to 20 cars.
test("the opponents and the start grid of every stage", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  const fields = [];
  for (let stage = 1; stage <= 17; stage++) {
    for (const unlocked of [stage, 17]) {
      for (const raceCars of [7, 20]) {
        for (let seed = 1; seed <= 4; seed++) {
          ctx.random.sim = seededRandom(seed);
          ctx.track.stage = stage;
          ctx.game.unlocked = unlocked;
          ctx.game.raceCars = raceCars;
          ctx.game.carTypes[0] = (stage + seed) % 11;
          ctx.setupcars();
          const cars = ctx.game.carTypes.slice(0, ctx.game.carCount);
          const xs = cars.map((_, c) => ctx.car[c].x.toFixed(6));
          fields.push(
            `${stage} ${unlocked} ${raceCars} ${seed}: ${cars.join(",")} | ${xs.join(",")} | ${ctx.random.sim()}`,
          );
        }
      }
    }
  }
  expect(fields).toMatchSnapshot();
});
