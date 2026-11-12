import { expect, test } from "vitest";
import { loadGame } from "./harness/loadGame.js";
import { startRace } from "./harness/race.js";

const NONE = {
  up: false,
  down: false,
  left: false,
  right: false,
  handb: false,
};

test("a game further ahead of another's keys than that one of its own runs slower until they are even", async () => {
  const { ctx } = await loadGame({ seed: 1 });
  ctx.link.send = () => {};
  ctx.startLockstep(0, ["host0000", "guest001"], 0, null);
  expect(ctx.tickMs()).toBe(ctx.TICK_MS);
  ctx.lockstep.frame = 20;
  // the guest's keys of frame 12 came, it 0 frames ahead of the host's: the host is 4 ahead
  ctx.receiveKeys({ car: 1, frame: 12, keys: NONE, ahead: [0, 0] });
  expect(ctx.tickMs()).toBeGreaterThan(ctx.TICK_MS);
  // as far ahead of each other's keys as the keys take, however long: even
  ctx.receiveKeys({ car: 1, frame: 16, keys: NONE, ahead: [4, 0] });
  expect(ctx.tickMs()).toBe(ctx.TICK_MS);
  ctx.receiveKeys({ car: 1, frame: 19, keys: NONE, ahead: [1, 0] });
  expect(ctx.tickMs()).toBe(ctx.TICK_MS);
  // the game behind runs on as it is
  ctx.receiveKeys({ car: 1, frame: 21, keys: NONE, ahead: [6, 0] });
  expect(ctx.tickMs()).toBe(ctx.TICK_MS);
  ctx.stopLockstep();
  expect(ctx.tickMs()).toBe(ctx.TICK_MS);
});

test("every game says with its keys how far it is ahead of each other's", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  const sent = [];
  ctx.link.send = (message) => sent.push(message);
  ctx.startLockstep(1, ["host0000", "guest001", "guest002"], 0, null);
  ctx.receiveKeys({ car: 0, frame: 3, keys: NONE });
  ctx.lockstep.frame = 5;
  ctx.raceEvents.countdown = 0;
  ctx.pressFrameKeys(() => {});
  const keys = sent.find((message) => message.type == "keys");
  expect(keys.ahead).toEqual([2, 0, 5]);
  ctx.stopLockstep();
});
