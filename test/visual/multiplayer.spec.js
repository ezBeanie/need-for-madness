import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// the car the guest drives (see src/net/link.js)
const GUEST_CAR = 1;
// time for a message between the tabs
const DELIVERY_MS = 20;
// the most of the host's ticks the guest keeps in store (see src/net/tickStore.js)
const STORE_TICKS = 4;
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
const openTwoGames = async (context, hostUrl, guestUrl) => {
  const hostPage = await context.newPage();
  const guestPage = await context.newPage();
  const host = await openGame(hostPage, {
    storage: { carsel: HOST_TYPE, unlocked: "3" },
    url: hostUrl,
  });
  const guest = await openGame(guestPage, {
    storage: { carsel: GUEST_TYPE, unlocked: "3" },
    url: guestUrl,
  });
  await host.advanceUntil(PHASE.mainMenu);
  await guest.advanceUntil(PHASE.mainMenu);
  return { host, guest, hostPage, guestPage };
};

// The host goes from the main menu to a race, the guest along into it.
const hostStartsRace = async ({ host, guest, hostPage, guestPage }) => {
  await host.tap("Enter");
  await host.advanceUntil(PHASE.carSelect);
  await host.advance(40);
  await host.tap("Enter");
  await host.advanceUntil(PHASE.stageSelect);
  await host.advance(190);
  // the guest says it is there
  await guest.advance(30);
  await hostPage.waitForTimeout(DELIVERY_MS);
  await host.tap("Enter");
  await host.advanceUntil(PHASE.race);
  await guestPage.waitForTimeout(DELIVERY_MS);
  await guest.advanceUntil(PHASE.guestRace);
};

// Host and guest, each in a tab of its own, in a race the host started.
const raceTogether = async (context, room) => {
  const games = await openTwoGames(context, `/?host=${room}`, `/?join=${room}`);
  await hostStartsRace(games);
  return games;
};

test("a guest in another tab drives a car in the host's race", async ({
  context,
}) => {
  const { host, guest, hostPage, guestPage } = await raceTogether(
    context,
    "test",
  );
  const both = [
    { game: host, page: hostPage },
    { game: guest, page: guestPage },
  ];

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
  // (the guest plays the host's ticks from a small store, see src/net/guest.js)
  await guest.advance(STORE_TICKS + 3);
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

test("the AI drives on the car of a guest whose connection is lost", async ({
  context,
}) => {
  const { host, hostPage, guestPage } = await raceTogether(context, "lost");
  const start = await hostPage.evaluate(
    (c) => window.gameState.car[c].z,
    GUEST_CAR,
  );
  await guestPage.close();
  // past the countdown, and the ticks a silent guest is waited for
  await host.advance(400);
  const onHost = await hostPage.evaluate(
    (c) => ({
      humans: window.gameState.game.humans,
      z: window.gameState.car[c].z,
    }),
    GUEST_CAR,
  );
  expect(onHost.humans).toEqual([]);
  expect(Math.abs(onHost.z - start)).toBeGreaterThan(500);
});

test("the multiplayer dialog opens a room, and a guest joins it with its code", async ({
  context,
}) => {
  const games = await openTwoGames(context, "/", "/");
  const { host, guest, hostPage, guestPage } = games;
  const both = [
    { game: host, page: hostPage },
    { game: guest, page: guestPage },
  ];
  await advanceBoth(...both, 2);

  await hostPage.getByRole("button", { name: "Multiplayer" }).click();
  await hostPage.getByRole("button", { name: "Host a race" }).click();
  const room = await hostPage.locator("#multiplayerRoomName").textContent();
  expect(room).toMatch(/^[a-z0-9]{5}$/);
  await expect(hostPage.getByLabel("Link for your guest")).toHaveValue(
    new RegExp(`\\?join=${room}$`),
  );

  await guestPage.getByRole("button", { name: "Multiplayer" }).click();
  const code = guestPage.getByLabel("Code of the host's room");
  // a code the relay would turn away is not sent
  await code.fill("no room");
  await guestPage.getByRole("button", { name: "Join the race" }).click();
  await expect(guestPage.getByRole("alert")).toBeVisible();
  await expect(code).toHaveAttribute("aria-invalid", "true");
  await code.fill(room.toUpperCase());
  await guestPage.getByRole("button", { name: "Join the race" }).click();
  await expect(guestPage.locator("#multiplayerRoomName")).toHaveText(room);

  // each one sees the other is there
  await guestPage.waitForTimeout(DELIVERY_MS);
  await advanceBoth(...both, 35);
  await expect(hostPage.getByRole("status")).toContainText(
    "Your guest is here",
  );
  await expect(guestPage.getByRole("status")).toContainText("The host is here");
  await hostPage.getByRole("button", { name: "Close" }).click();
  await guestPage.getByRole("button", { name: "Close" }).click();
  await expect(
    hostPage.getByRole("button", { name: `Room ${room}` }),
  ).toBeVisible();
  await hostStartsRace(games);
  expect((await guestState(guestPage)).phase).toBe(PHASE.guestRace);
});

test("leaving the room ends the link", async ({ page }) => {
  const game = await openGame(page);
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await page.getByRole("button", { name: "Multiplayer" }).click();
  await page.getByRole("button", { name: "Host a race" }).click();
  await expect(page.locator("#multiplayerRoom")).toBeVisible();
  await page.getByRole("button", { name: "Leave the room" }).click();
  await expect(page.getByRole("button", { name: "Host a race" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await game.advance();
  await expect(page.getByRole("button", { name: "Multiplayer" })).toBeVisible();
});

test("the guest's keys go to the host at once, not only with its next tick", async ({
  context,
}) => {
  await context.addInitScript(() => {
    window.sentMessages = [];
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      window.sentMessages.push(JSON.parse(data));
      return send.call(this, data);
    };
  });
  const { guestPage } = await raceTogether(context, "keys");
  await guestPage.evaluate(() => (window.sentMessages = []));
  // (no tick of the guest's in between)
  await guestPage.keyboard.down("ArrowUp");
  const sent = await guestPage.evaluate(() => window.sentMessages);
  expect(sent).toContainEqual(
    expect.objectContaining({
      type: "keys",
      keys: expect.objectContaining({ up: true }),
    }),
  );
});

// Every text a page draws on its canvas, to see what its HUD shows.
const recordDrawnTexts = (context) =>
  context.addInitScript(() => {
    window.drawnTexts = new Set();
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
      window.drawnTexts.add(String(text));
      return fillText.call(this, text, ...rest);
    };
  });

const drawnTexts = async (page) => {
  const texts = await page.evaluate(() => [...window.drawnTexts]);
  await page.evaluate(() => window.drawnTexts.clear());
  return texts;
};

test("the guest's HUD tells of its stunts and of the car it wasted, the host's of a car wasted", async ({
  context,
}) => {
  await recordDrawnTexts(context);
  const { host, guest, hostPage, guestPage } = await raceTogether(
    context,
    "events",
  );
  const both = [
    { game: host, page: hostPage },
    { game: guest, page: guestPage },
  ];
  // past the countdown
  while (
    await hostPage.evaluate(() => window.gameState.raceEvents.countdown != 0)
  ) {
    await advanceBoth(...both, 10);
  }
  await advanceBoth(...both, 10);
  await drawnTexts(hostPage);
  await drawnTexts(guestPage);

  // the guest's car lands a stunt, and wastes the car beside it (wasted with no dent,
  // that car gets the body the hits wasting it would have given it)
  for (const page of [hostPage, guestPage]) {
    await page.evaluate((c) => window.gameState.fixcar(c + 1), GUEST_CAR);
  }
  await hostPage.evaluate((c) => {
    const { racers } = window.gameState;
    // a forward looping, landed
    racers[c].countingStunt = 9;
    racers[c].flipped = 360;
    racers[c].stuntPower = 30;
    racers[c + 1].lastcolido = 70;
    racers[c + 1].lastHitBy = c;
    racers[c + 1].damage = 1e6;
  }, GUEST_CAR);
  await advanceBoth(...both, 20);
  await guestPage.waitForTimeout(DELIVERY_MS);
  await guest.advance(STORE_TICKS + 3);

  const onGuest = await drawnTexts(guestPage);
  const onHost = await drawnTexts(hostPage);
  // (with a full power bar, the praise is "POWER TO THE MAX")
  expect(onGuest.some((text) => /^POWER (UP|TO THE MAX)/.test(text))).toBe(
    true,
  );
  expect(onGuest.some((text) => /Forward loop/.test(text))).toBe(true);
  expect(onGuest.some((text) => /^You wasted .+!$/.test(text))).toBe(true);
  // the host did not waste it
  expect(onHost.some((text) => /^You wasted /.test(text))).toBe(false);
  expect(onHost.some((text) => / has been wasted!$/.test(text))).toBe(true);
});
