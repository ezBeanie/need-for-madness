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

const frameOf = (page) => page.evaluate(() => window.gameState.lockstep.frame);
const apartAt = (page) =>
  page.evaluate(() => window.gameState.lockstep.apartAt);

// Brings both games to the same tick of their race (one may be ahead by the keys' delay,
// see src/net/lockstep.js).
const inStep = async (host, guest) => {
  for (let tries = 0; tries < 20; tries++) {
    const hostFrame = await frameOf(host.page);
    const guestFrame = await frameOf(guest.page);
    if (hostFrame == guestFrame) {
      return hostFrame;
    }
    const behind = hostFrame < guestFrame ? host : guest;
    await behind.game.advance();
    await behind.page.waitForTimeout(DELIVERY_MS);
  }
  throw new Error(
    `the games did not get in step: ${await frameOf(host.page)}, ${await frameOf(guest.page)}`,
  );
};

// what both games must have alike (see src/net/raceState.js)
const raceOf = (page) => page.evaluate(() => window.gameState.sharedRace());

const guestState = (page) =>
  page.evaluate(() => {
    const { game } = window.gameState;
    return {
      phase: game.phase,
      carType: game.carTypes[0],
      humans: game.humans,
    };
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

// Two tabs, linked by the relay of the dev server: the host's game starts the race, and
// both compute it.
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
  // (the race's first tick sends it to the guest)
  await host.advance();
  await guestPage.waitForTimeout(DELIVERY_MS);
  await guest.advanceUntil(PHASE.race);
};

// Host and guest, each in a tab of its own, in a race the host started.
const raceTogether = async (context, room) => {
  const games = await openTwoGames(context, `/?host=${room}`, `/?join=${room}`);
  await hostStartsRace(games);
  const { host, guest, hostPage, guestPage } = games;
  return {
    ...games,
    both: [
      { game: host, page: hostPage },
      { game: guest, page: guestPage },
    ],
  };
};

test("host and guest race the same race in two tabs, each driving its car with its keys", async ({
  context,
}) => {
  const { hostPage, guestPage, both } = await raceTogether(context, "test");
  const startOf = (page) =>
    page.evaluate(() => window.gameState.car.map(({ z }) => z));
  const start = await startOf(hostPage);
  // the guest drives the car it chose, as the player
  expect(
    await guestPage.evaluate((c) => {
      const { camera, game } = window.gameState;
      return [game.carTypes[c], game.player, game.humans];
    }, GUEST_CAR),
  ).toEqual([Number(GUEST_TYPE), GUEST_CAR, [0, GUEST_CAR]]);

  await guestPage.keyboard.down("ArrowUp");
  await advanceBoth(...both, 300);
  await inStep(...both);
  // (behind its car since the countdown)
  expect(await guestPage.evaluate(() => window.gameState.camera.target)).toBe(
    GUEST_CAR,
  );
  await guestPage.screenshot({ path: "test-results/multiplayer-guest.png" });
  await hostPage.screenshot({ path: "test-results/multiplayer-host.png" });
  const onHost = await raceOf(hostPage);
  expect(await raceOf(guestPage)).toEqual(onHost);
  // (their fingerprints said so too)
  expect(await apartAt(hostPage)).toBe(-1);
  expect(await apartAt(guestPage)).toBe(-1);
  // the guest's car drove off the grid on the guest's keys, the host's stood
  const now = await startOf(hostPage);
  expect(Math.abs(now[GUEST_CAR] - start[GUEST_CAR])).toBeGreaterThan(500);
  expect(now[0]).toBe(start[0]);
  await guestPage.keyboard.up("ArrowUp");
});

test("a game waits for the other's keys, and says so", async ({ context }) => {
  await recordDrawnTexts(context);
  const { host, guest, hostPage, guestPage, both } = await raceTogether(
    context,
    "wait",
  );
  // (past the countdown, which cannot pause)
  await advanceBoth(...both, 200);
  const frame = await inStep(...both);
  // the guest's keys stop: the host runs on as far as it may guess them
  await host.advance(30);
  const ahead = await hostPage.evaluate(
    () => window.gameState.INPUT_DELAY + window.gameState.MAX_GUESSED,
  );
  expect(await frameOf(hostPage)).toBe(frame + ahead);
  expect(await drawnTexts(hostPage)).toContain("Waiting for player 2...");
  // its HUD stands as drawn, not drawn over itself again tick by tick
  const hud = () =>
    hostPage.evaluate(() =>
      document.querySelector("#canvas2D").toDataURL("image/png"),
    );
  const waiting = await hud();
  await host.advance(20);
  expect(await hud()).toBe(waiting);
  // the host pauses: the guest waits for it
  await host.tap("Escape");
  await host.advanceUntil(PHASE.paused);
  await drawnTexts(guestPage);
  // (it guesses the host's keys a while first)
  await advanceBoth(...both, 50);
  expect(await drawnTexts(guestPage)).toContain("Waiting for the host...");
});

test("the games tell a race gone apart by its fingerprints, say so, and tell what differs", async ({
  context,
}) => {
  await recordDrawnTexts(context);
  const { guestPage, both } = await raceTogether(context, "sync");
  await advanceBoth(...both, 40);
  // a car of the guest's race moves a little, as a race computed apart would
  await guestPage.evaluate(() => (window.gameState.car[3].x += 0.5));
  await advanceBoth(...both, 40);
  for (const { page } of both) {
    expect(await apartAt(page)).toBeGreaterThan(0);
    expect(await drawnTexts(page)).toContain("Out of sync!");
    const differences = await page.evaluate(
      () => window.gameState.lockstep.differences,
    );
    expect(differences.some((line) => line.startsWith("cars.3."))).toBe(true);
  }
});

test("a guest whose host left races on, the host's car the AI's, and gets its own car back after", async ({
  context,
}) => {
  await recordDrawnTexts(context);
  const { hostPage, guestPage, both } = await raceTogether(context, "left");
  await advanceBoth(...both, 10);
  // the host leaves the race
  await hostPage.evaluate(() => {
    const { game, PHASE } = window.gameState;
    game.phase = PHASE.mainMenu;
  });
  await advanceBoth(...both, 3);
  expect(await drawnTexts(guestPage)).toContain("The host left the race");
  expect((await guestState(guestPage)).humans).toEqual([GUEST_CAR]);
  const hostCar = () => guestPage.evaluate(() => window.gameState.car[0].z);
  const standing = await hostCar();
  // past the countdown: the AI drives the host's car
  await both[1].game.advance(300);
  expect(Math.abs((await hostCar()) - standing)).toBeGreaterThan(500);

  // the guest quits the race: back to its menu with its own car
  await guestPage.evaluate(() => {
    const { game, PHASE } = window.gameState;
    game.phase = PHASE.mainMenu;
  });
  await both[1].game.advance();
  expect(await guestState(guestPage)).toMatchObject({
    phase: PHASE.mainMenu,
    carType: Number(GUEST_TYPE),
  });
});

test("the guest leaving the race leaves its car to the host's AI", async ({
  context,
}) => {
  const { host, guest, hostPage, guestPage, both } = await raceTogether(
    context,
    "quit",
  );
  await advanceBoth(...both, 10);
  await guestPage.evaluate(() => {
    const { game, PHASE } = window.gameState;
    game.phase = PHASE.mainMenu;
  });
  await guest.advance();
  await hostPage.waitForTimeout(DELIVERY_MS);
  // (from the frame after the guest's last keys)
  await host.advance(3);
  expect(await hostPage.evaluate(() => window.gameState.game.humans)).toEqual([
    0,
  ]);
  // the host's race waits no more
  const frame = await frameOf(hostPage);
  await host.advance(30);
  expect(await frameOf(hostPage)).toBe(frame + 30);
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
  expect(onHost.humans).toEqual([0]);
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
  await expect(hostPage.getByLabel("Link for your guests")).toHaveValue(
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
  await expect(hostPage.getByRole("status")).toContainText("start a race");
  await expect(guestPage.getByRole("status")).toContainText("Choose your car");
  // and who drives which car
  await expect(
    guestPage.getByRole("list", { name: "Players" }).getByRole("listitem"),
  ).toHaveText([/^Player 1 \(host\): /, /^Player 2 \(you\): /]);
  await hostPage.getByRole("button", { name: "Close" }).click();
  await guestPage.getByRole("button", { name: "Close" }).click();
  await expect(
    hostPage.getByRole("button", { name: `Room ${room}` }),
  ).toBeVisible();
  await hostStartsRace(games);
  expect((await guestState(guestPage)).phase).toBe(PHASE.race);
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

// Every message a page sends to the relay, in window.sentMessages.
const recordSentMessages = (context) =>
  context.addInitScript(() => {
    window.sentMessages = [];
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      window.sentMessages.push(JSON.parse(data));
      return send.call(this, data);
    };
  });

test("the host answers the guest's ping at once", async ({ context }) => {
  const { guest, guestPage } = await raceTogether(context, "ping");
  await guestPage.evaluate(() => (window.gameState.guest.ping = null));
  // (the host's game ticks no more; the guest pings once in so many ticks)
  await guest.advance(31);
  await guestPage.waitForTimeout(DELIVERY_MS);
  expect(await guestPage.evaluate(() => window.gameState.guest.ping)).toEqual(
    expect.any(Number),
  );
});

test.describe("on a phone", () => {
  test.use({ hasTouch: true });

  test("the guest drives with the touch controls", async ({ context }) => {
    await recordSentMessages(context);
    const { guest, guestPage, both } = await raceTogether(context, "touch");
    await advanceBoth(...both, 300);
    // (the accelerator, bottom right, held for a tick)
    await guestPage.evaluate(() => (window.sentMessages = []));
    await guestPage.mouse.move(1150, 558);
    await guestPage.mouse.down();
    await guest.advance(2);
    const sent = await guestPage.evaluate(() =>
      window.sentMessages
        .filter((message) => message.type == "keys")
        .map((message) => message.keys),
    );
    expect(sent).toContainEqual(expect.objectContaining({ up: true }));
    await guestPage.mouse.up();
  });
});

test("each game's HUD tells its player of the stunts it landed and the cars it wasted", async ({
  context,
}) => {
  await recordDrawnTexts(context);
  const { hostPage, guestPage, both } = await raceTogether(context, "events");
  // past the countdown
  while (
    await hostPage.evaluate(() => window.gameState.raceEvents.countdown != 0)
  ) {
    await advanceBoth(...both, 10);
  }
  await advanceBoth(...both, 10);
  await inStep(...both);
  await drawnTexts(hostPage);
  await drawnTexts(guestPage);

  // in the same tick of both games: the guest's car lands a stunt, and wastes the car
  // beside it (wasted with no dent, that car gets the body the hits wasting it would have
  // given it)
  for (const page of [hostPage, guestPage]) {
    await page.evaluate((c) => {
      const { fixcar, racers } = window.gameState;
      fixcar(c + 1);
      // a forward looping, landed
      racers[c].countingStunt = 9;
      racers[c].flipped = 360;
      racers[c].stuntPower = 30;
      racers[c + 1].lastcolido = 70;
      racers[c + 1].lastHitBy = c;
      racers[c + 1].damage = 1e6;
    }, GUEST_CAR);
  }
  await advanceBoth(...both, 20);
  await inStep(...both);
  expect(await raceOf(guestPage)).toEqual(await raceOf(hostPage));

  const onGuest = await drawnTexts(guestPage);
  const onHost = await drawnTexts(hostPage);
  // (with a full power bar, the praise is "POWER TO THE MAX")
  expect(onGuest.some((text) => /^POWER (UP|TO THE MAX)/.test(text))).toBe(
    true,
  );
  expect(onGuest.some((text) => /Forward loop/.test(text))).toBe(true);
  expect(onGuest.some((text) => /^You wasted .+!$/.test(text))).toBe(true);
  // the host did not waste it, nor land the stunt
  expect(onHost.some((text) => /^You wasted /.test(text))).toBe(false);
  expect(onHost.some((text) => / has been wasted!$/.test(text))).toBe(true);
  expect(onHost.some((text) => /Forward loop/.test(text))).toBe(false);
});

// Ticks of every game, each tick's messages delivered before the next game's tick.
const advanceAll = async (games, ticks) => {
  for (let tick = 0; tick < ticks; tick++) {
    for (const { game, page } of games) {
      await game.advance();
      await page.waitForTimeout(1);
    }
  }
};

// Brings every game to the same tick of the race.
const allInStep = async (games) => {
  for (let tries = 0; tries < 40; tries++) {
    const frames = await Promise.all(games.map(({ page }) => frameOf(page)));
    const ahead = Math.max(...frames);
    if (frames.every((frame) => frame == ahead)) {
      return ahead;
    }
    const behind = games[frames.indexOf(Math.min(...frames))];
    await behind.game.advance();
    await behind.page.waitForTimeout(DELIVERY_MS);
  }
  throw new Error("the games did not get in step");
};

const sameRaces = async (games) => {
  await allInStep(games);
  const races = await Promise.all(games.map(({ page }) => raceOf(page)));
  for (const race of races.slice(1)) {
    expect(race).toEqual(races[0]);
  }
  for (const { page } of games) {
    expect(await apartAt(page)).toBe(-1);
  }
};

// (as the pause menu's "Exit to main menu" does)
const backToMainMenu = (page) =>
  page.evaluate(() => {
    const { game, menu, PHASE } = window.gameState;
    menu.animation = 0;
    menu.continuesToCarSelect = false;
    game.phase = PHASE.mainMenu;
  });

test("three race together, one leaves the race to the AI while the others race on alike, and all three race again", async ({
  context,
}) => {
  const { host, guest, hostPage, guestPage } = await openTwoGames(
    context,
    "/?host=trio",
    "/?join=trio",
  );
  const thirdPage = await context.newPage();
  const third = await openGame(thirdPage, {
    storage: { carsel: "2", unlocked: "3" },
    url: "/?join=trio",
  });
  await third.advanceUntil(PHASE.mainMenu);
  const all = [
    { game: host, page: hostPage },
    { game: guest, page: guestPage },
    { game: third, page: thirdPage },
  ];
  const raceAll = async () => {
    await host.tap("Enter");
    await host.advanceUntil(PHASE.carSelect);
    await host.advance(40);
    await host.tap("Enter");
    await host.advanceUntil(PHASE.stageSelect);
    await host.advance(190);
    // the guests say they are there
    await guest.advance(30);
    await third.advance(30);
    await hostPage.waitForTimeout(DELIVERY_MS);
    await host.tap("Enter");
    await host.advanceUntil(PHASE.race);
    await host.advance();
    await guestPage.waitForTimeout(DELIVERY_MS);
    await guest.advanceUntil(PHASE.race);
    await third.advanceUntil(PHASE.race);
  };
  await raceAll();
  // each drives the car beside the one before, the one it chose
  for (const [car, { page }] of all.entries()) {
    expect(
      await page.evaluate(() => {
        const { game } = window.gameState;
        return [game.player, game.humans];
      }),
    ).toEqual([car, [0, 1, 2]]);
  }
  // (the guests' cars: the host's comes from the storage all tabs share)
  expect(
    await hostPage.evaluate(() => window.gameState.game.carTypes.slice(1, 3)),
  ).toEqual([Number(GUEST_TYPE), 2]);
  await guestPage.keyboard.down("ArrowUp");
  await advanceAll(all, 250);
  await sameRaces(all);

  // the third leaves the race: the AI drives its car on in both other games alike
  await backToMainMenu(thirdPage);
  await advanceAll(all, 100);
  const racing = all.slice(0, 2);
  await sameRaces(racing);
  for (const { page } of racing) {
    expect(await page.evaluate(() => window.gameState.game.humans)).toEqual([
      0, 1,
    ]);
  }
  await guestPage.keyboard.up("ArrowUp");

  // back in the menus, all three are in the host's next race
  await backToMainMenu(hostPage);
  await backToMainMenu(guestPage);
  // (the main menu opens up before it takes keys)
  await advanceAll(all, 40);
  await raceAll();
  await advanceAll(all, 60);
  await sameRaces(all);
  expect(await thirdPage.evaluate(() => window.gameState.game.humans)).toEqual([
    0, 1, 2,
  ]);
});

test("the host leaving the room ends it for its guests, who are told so", async ({
  context,
}) => {
  const { host, guest, hostPage, guestPage } = await openTwoGames(
    context,
    "/?host=gone",
    "/?join=gone",
  );
  const both = [
    { game: host, page: hostPage },
    { game: guest, page: guestPage },
  ];
  await advanceBoth(...both, 35);
  await hostPage.getByRole("button", { name: "Room gone" }).click();
  await hostPage.getByRole("button", { name: "Leave the room" }).click();
  await hostPage.waitForTimeout(DELIVERY_MS);
  await guest.advance(2);
  await expect(guestPage.getByRole("dialog")).toBeVisible();
  await expect(guestPage.getByRole("status")).toHaveText(
    "The host left the room.",
  );
  await expect(
    guestPage.getByRole("button", { name: "Join the race" }),
  ).toBeVisible();
});
