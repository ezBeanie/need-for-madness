import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// the car the guest drives (see src/net/host.js)
const GUEST_CAR = 1;
// time for a message between the tabs
const DELIVERY_MS = 20;

// Two tabs of one browser: the host's game races, the guest's shows that race and drives a
// car in it.
test("a guest in another tab drives a car in the host's race", async ({
  context,
}) => {
  const storage = { carsel: "5", unlocked: "3" };
  const hostPage = await context.newPage();
  const guestPage = await context.newPage();
  const host = await openGame(hostPage, { storage, url: "/?host=test" });
  const guest = await openGame(guestPage, { storage, url: "/?join=test" });
  await host.advanceUntil(PHASE.mainMenu);
  await guest.advanceUntil(PHASE.mainMenu);
  // the guest says it is there
  await guest.advance();
  await hostPage.waitForTimeout(DELIVERY_MS);

  await host.tap("Enter");
  await host.advanceUntil(PHASE.carSelect);
  await host.advance(40);
  await host.tap("Enter");
  await host.advanceUntil(PHASE.stageSelect);
  await host.advance(190);
  await host.tap("Enter");
  await host.advanceUntil(PHASE.race);
  await guestPage.waitForTimeout(DELIVERY_MS);
  await guest.advanceUntil(PHASE.guestRace);

  const start = await hostPage.evaluate(
    (c) => window.gameState.car[c].z,
    GUEST_CAR,
  );
  await guestPage.keyboard.down("ArrowUp");
  for (let tick = 0; tick < 300; tick++) {
    await guest.advance();
    await hostPage.waitForTimeout(1);
    await host.advance();
    await guestPage.waitForTimeout(1);
  }
  await guestPage.waitForTimeout(DELIVERY_MS);
  await guest.advance();
  await guestPage.screenshot({ path: "test-results/multiplayer-guest.png" });
  await hostPage.screenshot({ path: "test-results/multiplayer-host.png" });

  const onHost = await hostPage.evaluate((c) => {
    const { car, raceTape } = window.gameState;
    return { z: car[c].z, frames: raceTape.length, zs: raceTape.cars[c].z };
  }, GUEST_CAR);
  const onGuest = await guestPage.evaluate((c) => {
    const { camera, car, game, viewer } = window.gameState;
    return {
      z: car[c].z,
      frame: viewer.frame,
      phase: game.phase,
      player: game.player,
      followed: camera.target,
    };
  }, GUEST_CAR);

  // the guest's car drove off the grid, on the guest's keys
  expect(onHost.frames).toBeGreaterThan(50);
  expect(Math.abs(onHost.z - start)).toBeGreaterThan(500);
  // the guest shows the host's race where the host's game drove it
  expect(onGuest.phase).toBe(PHASE.guestRace);
  expect(onGuest.player).toBe(GUEST_CAR);
  expect(onGuest.followed).toBe(GUEST_CAR);
  expect(onGuest.frame).toBe(onHost.frames - 1);
  expect(onGuest.z).toBe(onHost.zs[onGuest.frame]);
});
