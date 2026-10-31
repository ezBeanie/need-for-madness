import { expect, test } from "vitest";
import { loadGame } from "./harness/loadGame.js";

test("a race gone apart goes to the other game in parts the relay takes, and what differs is told", async () => {
  const { ctx } = await loadGame({ seed: 1 });
  const sent = [];
  ctx.link.send = (message) => sent.push(message);
  ctx.startLockstep(0, ["host0000", "guest001"], 0, null);
  // as big as a race of many dented cars
  const dents = Array.from({ length: 40000 }, (_, i) => i / 7);
  const race = (laps) => ctx.encode({ dents, laps });
  ctx.lockstep.ownPrints.set(30, { print: 1, race: race(2) });
  ctx.receivePrint({ car: 1, frame: 30, print: 2 });
  const parts = sent.filter((message) => message.type == "apart");
  expect(parts.length).toBeGreaterThan(1);
  for (const part of parts) {
    expect(ctx.encode(part).length).toBeLessThan(256 * 1024);
  }
  // the other game's race, the same but for its laps
  ctx.lockstep.apartRace = race(3);
  parts.reverse().forEach((part) => ctx.receiveApart({ ...part, car: 1 }));
  expect(ctx.lockstep.differences).toEqual(["laps: 3 here, 2 there"]);
});
