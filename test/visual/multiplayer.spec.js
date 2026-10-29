import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// the car the guest drives (see src/net/link.js)
const GUEST_CAR = 1;
// time for a message between the tabs
const DELIVERY_MS = 20;
// the car types host and guest chose
const HOST_TYPE = "5";
const GUEST_TYPE = "9";

// Ticks of both games, each tick's messages delivered before the other one's tick.
const advanceBoth = async (host, guest, ticks) => {
  for (let tick = 0; tick < ticks; tick++) {
    await guest.game.advance();
    await host.page.waitForTimeout(1);
    await host.game.advance();
    await guest.page.waitForTimeout(1);
  }
};

const guestState = (page) =>
  page.evaluate(() => {
    const { game, guest } = window.gameState;
    return {
      phase: game.phase,
      notice: guest.notice,
      carType: game.carTypes[0],
    };
  });

// Two tabs, linked by the relay of the dev server: the host's game races, the guest's shows
// that race and drives a car in it.
test("a guest in another tab drives a car in the host's race", async ({
  context,
}) => {
  const hostPage = await context.newPage();
  const guestPage = await context.newPage();
  const host = await openGame(hostPage, {
    storage: { carsel: HOST_TYPE, unlocked: "3" },
    url: "/?host=test",
  });
  const guest = await openGame(guestPage, {
    storage: { carsel: GUEST_TYPE, unlocked: "3" },
    url: "/?join=test",
  });
  const both = [
    { game: host, page: hostPage },
    { game: guest, page: guestPage },
  ];
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
  // (a guest silent for a while has gone: it says again that it is there)
  await guest.advance(30);
  await hostPage.waitForTimeout(DELIVERY_MS);
  await host.tap("Enter");
  await host.advanceUntil(PHASE.race);
  await guestPage.waitForTimeout(DELIVERY_MS);
  await guest.advanceUntil(PHASE.guestRace);

  const start = await hostPage.evaluate(
    (c) => window.gameState.car[c].z,
    GUEST_CAR,
  );
  // the guest drives the car it chose
  expect(
    await hostPage.evaluate(
      (c) => window.gameState.game.carTypes[c],
      GUEST_CAR,
    ),
  ).toBe(Number(GUEST_TYPE));
  await guestPage.keyboard.down("ArrowUp");
  await advanceBoth(...both, 300);
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

  // the host pauses: the guest waits for it
  await host.tap("Escape");
  await host.advanceUntil(PHASE.paused);
  await advanceBoth(...both, 20);
  expect((await guestState(guestPage)).notice).toBe("Waiting for the host...");

  // the host leaves the race: the guest is told, and goes back to its menu with its own car
  await hostPage.evaluate(() => {
    const { game, PHASE } = window.gameState;
    game.phase = PHASE.mainMenu;
  });
  await advanceBoth(...both, 3);
  expect((await guestState(guestPage)).notice).toBe("The host left the race");
  await guestPage.keyboard.up("ArrowUp");
  await guest.tap("Enter");
  await guest.advance();
  expect(await guestState(guestPage)).toMatchObject({
    phase: PHASE.mainMenu,
    carType: Number(GUEST_TYPE),
  });
});
