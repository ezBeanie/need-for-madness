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

// (the tabs share their storage: each says its own)
const UNNAMED = { playerName: "", carSkin: "0" };

// A key held for two frames: a game run ahead of the other one's ticks slower than the frames
// come (see tickMs in lockstep.js), and a key let go before a tick is never seen.
const pressInRace = async (game, page, key) => {
  await page.keyboard.down(key);
  await game.advance(2);
  await page.keyboard.up(key);
};

// Two tabs, linked by the relay of the dev server: the host's game starts the race, and
// both compute it.
const openTwoGames = async (
  context,
  hostUrl,
  guestUrl,
  hostStorage = {},
  guestStorage = {},
) => {
  const hostPage = await context.newPage();
  const guestPage = await context.newPage();
  const host = await openGame(hostPage, {
    storage: { ...UNNAMED, carsel: HOST_TYPE, unlocked: "3", ...hostStorage },
    url: hostUrl,
  });
  const guest = await openGame(guestPage, {
    storage: { ...UNNAMED, carsel: GUEST_TYPE, unlocked: "3", ...guestStorage },
    url: guestUrl,
  });
  await host.advanceUntil(PHASE.mainMenu);
  await guest.advanceUntil(PHASE.mainMenu);
  return { host, guest, hostPage, guestPage };
};

// The host goes from the main menu to a race, the guest along into it.
const hostStartsRace = async ({ host, guest, hostPage, guestPage }) => {
  // (the focus is on Multiplayer once its dialog closed)
  await hostPage.locator("#menuCampaign").focus();
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

// Host and guest, each in a tab of its own, in a race the host started (with as many bots
// as given, the room's field otherwise only the two).
const raceTogether = async (
  context,
  room,
  bots = 0,
  hostStorage = {},
  guestStorage = {},
) => {
  const games = await openTwoGames(
    context,
    `/?host=${room}`,
    `/?join=${room}`,
    hostStorage,
    guestStorage,
  );
  await games.hostPage.evaluate((bots) => {
    for (let i = 0; i < bots; i++) {
      window.gameState.addBot();
    }
  }, bots);
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
});

test("racing together, the menu shows over the race, which goes on for the others, and leaves it", async ({
  context,
}) => {
  await recordDrawnTexts(context);
  await recordSentMessages(context);
  const { host, guest, hostPage, guestPage, both } = await raceTogether(
    context,
    "menu",
  );
  // (past the countdown, which has no menu)
  await advanceBoth(...both, 200);
  await host.tap("Escape");
  await drawnTexts(hostPage);
  await drawnTexts(guestPage);
  const frame = await inStep(...both);
  await hostPage.evaluate(() => (window.sentMessages = []));
  // the host holds the throttle in its menu: its car rolls on without it
  await hostPage.keyboard.down("ArrowUp");
  await advanceBoth(...both, 50);
  expect(await hostPage.evaluate(() => window.gameState.game.phase)).toBe(
    PHASE.race,
  );
  await hostPage.keyboard.up("ArrowUp");
  const sent = await hostPage.evaluate(() =>
    window.sentMessages
      .filter((message) => message.type == "keys")
      .map((message) => message.keys),
  );
  expect(sent.length).toBeGreaterThan(45);
  expect(sent).not.toContainEqual(expect.objectContaining({ up: true }));
  expect(await frameOf(guestPage)).toBeGreaterThan(frame + 45);
  expect(await drawnTexts(guestPage)).not.toContain("Waiting for the host...");
  expect(await drawnTexts(hostPage)).toContain("x Leave Race");
  // Escape again: the race as before, its menu gone
  await host.tap("Escape");
  await advanceBoth(...both, 5);
  await drawnTexts(hostPage);
  await advanceBoth(...both, 5);
  expect(await drawnTexts(hostPage)).not.toContain("x Leave Race");
  // so too with a click on Resume (its button in the middle, the first below the notices),
  // in the guest's game, whose HUD has a button of its own where the host's has none
  await guest.tap("Escape");
  await guestPage.mouse.move(640, 365);
  await guestPage.mouse.down();
  await guest.advance();
  await guestPage.mouse.up();
  await advanceBoth(...both, 2);
  expect(
    await guestPage.evaluate(() => window.gameState.pauseMenu.overRace),
  ).toBe(false);
  // down to leaving it: the host is in the main menu, the guest races on without it
  await host.tap("Escape");
  await host.tap("ArrowDown");
  await host.tap("Enter");
  await host.advanceUntil(PHASE.mainMenu);
  await guestPage.waitForTimeout(DELIVERY_MS);
  await guest.advance(5);
  expect(await guestPage.evaluate(() => window.gameState.game.humans)).toEqual([
    1,
  ]);
});

test("a guest that raced in switch mode races the host's race by its rules", async ({
  context,
}) => {
  const games = await openTwoGames(context, "/?host=mode", "/?join=mode");
  await games.guestPage.evaluate(() => {
    const { game, MODE } = window.gameState;
    game.mode = MODE.switchCars;
  });
  await hostStartsRace(games);
  expect(await games.guestPage.evaluate(() => window.gameState.game.mode)).toBe(
    await games.hostPage.evaluate(() => window.gameState.game.mode),
  );
});

test("the games tell a race gone apart by its fingerprints, say so, and tell what differs", async ({
  context,
}) => {
  await recordDrawnTexts(context);
  const { guestPage, both } = await raceTogether(context, "sync", 5);
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

// The page hidden (another tab or app), as the browser tells it.
const hide = (page) =>
  page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

test("a guest whose game is hidden leaves the race at once, its car to the AI in every game", async ({
  context,
}) => {
  const { host, guest, hostPage, guestPage, both } = await raceTogether(
    context,
    "hidden",
  );
  await advanceBoth(...both, 250);
  // (a hidden game runs no ticks: it says so as it hides)
  await hide(guestPage);
  expect(await guestState(guestPage)).toMatchObject({
    phase: PHASE.mainMenu,
    humans: [],
  });
  await hostPage.waitForTimeout(DELIVERY_MS);
  await host.advance(3);
  expect(await hostPage.evaluate(() => window.gameState.game.humans)).toEqual([
    0,
  ]);
  const frame = await frameOf(hostPage);
  await host.advance(30);
  expect(await frameOf(hostPage)).toBe(frame + 30);
  expect(await apartAt(hostPage)).toBe(-1);
  // shown again, it stays in its menu, in the room
  await guest.advance(30);
  expect(await guestState(guestPage)).toMatchObject({
    phase: PHASE.mainMenu,
  });
});

test("a guest hidden while the stage of the host's race loads goes to its menu, not to the race", async ({
  context,
}) => {
  const games = await openTwoGames(context, "/?host=hidload", "/?join=hidload");
  const { host, guest, hostPage, guestPage } = games;
  await host.tap("Enter");
  await host.advanceUntil(PHASE.carSelect);
  await host.advance(40);
  await host.tap("Enter");
  await host.advanceUntil(PHASE.stageSelect);
  await host.advance(190);
  await guest.advance(30);
  await hostPage.waitForTimeout(DELIVERY_MS);
  await host.tap("Enter");
  await host.advanceUntil(PHASE.race);
  await host.advance();
  await guestPage.waitForTimeout(DELIVERY_MS);
  await guest.advanceUntil(PHASE.stageLoading);
  await hide(guestPage);
  await guest.advance(100);
  expect(await guestState(guestPage)).toMatchObject({
    phase: PHASE.mainMenu,
    humans: [],
  });
  // (told as the host's race runs on)
  await expect
    .poll(async () => {
      await host.advance();
      return hostPage.evaluate(() => window.gameState.game.humans);
    })
    .toEqual([0]);
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

// The relay between the tabs, cut at will both ways (the sockets left open: as a network
// that reaches the relay no more).
const cuttableRelay = async (context) => {
  const relay = { cut: false };
  await context.routeWebSocket(/\/net\?room=/, (page) => {
    const server = page.connectToServer();
    page.onMessage((message) => relay.cut || server.send(message));
    server.onMessage((message) => relay.cut || page.send(message));
  });
  return relay;
};

const linkedWithHost = (page) =>
  page.evaluate(() => {
    const { guest, linkedDirectly } = window.gameState;
    return linkedDirectly(guest.hostId);
  });

test("games in the same network link directly and race on without the relay", async ({
  context,
}) => {
  const relay = await cuttableRelay(context);
  const { hostPage, guestPage, both } = await raceTogether(context, "near");
  await expect.poll(() => linkedWithHost(guestPage)).toBe(true);
  relay.cut = true;
  const frame = await frameOf(hostPage);
  // (far beyond the frames a game guesses the other's keys for, see src/net/lockstep.js)
  await advanceBoth(...both, 120);
  expect(await frameOf(hostPage)).toBeGreaterThan(frame + 100);
  expect(await frameOf(guestPage)).toBeGreaterThan(frame + 100);
  expect(await apartAt(hostPage)).toBe(-1);
  expect(await apartAt(guestPage)).toBe(-1);
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
  await expect(hostPage.getByRole("status")).toContainText(
    "everyone to be ready",
  );
  await expect(guestPage.getByRole("status")).toContainText("Choose your car");
  // and who drives which car
  await expect(
    guestPage.getByRole("list", { name: "Players" }).getByRole("listitem"),
  ).toHaveText([/^Player 1 \(host\): /, /^Player 2 \(you\): /]);
  // linked directly, in the same network
  await expect
    .poll(async () => {
      await advanceBoth(...both, 1);
      return guestPage
        .getByRole("list", { name: "Players" })
        .getByRole("listitem")
        .first()
        .textContent();
    })
    .toMatch(/, Same network$/);
  await hostPage.getByRole("button", { name: "Back" }).click();
  await guestPage.getByRole("button", { name: "Back" }).click();
  await expect(
    hostPage.getByRole("button", { name: `Room ${room}` }),
  ).toBeVisible();
  await hostStartsRace(games);
  expect((await guestState(guestPage)).phase).toBe(PHASE.race);
});

test("a room's race has only its players' cars, and the bots the host adds with the cars it chooses", async ({
  context,
}) => {
  const games = await openTwoGames(context, "/?host=bots", "/?join=bots");
  const { host, guest, hostPage, guestPage } = games;
  const fieldOf = (page) =>
    page.evaluate(() => {
      const { game } = window.gameState;
      return game.carTypes.slice(0, game.carCount);
    });
  // two bots added, both in the same car: named after it and numbered; then the second
  // taken away again: one left, named after its car alone
  await guest.advance(30);
  await hostPage.waitForTimeout(DELIVERY_MS);
  await hostPage.getByRole("button", { name: "Room bots" }).click();
  await hostPage.getByRole("button", { name: "Add a bot" }).click();
  await hostPage.getByRole("button", { name: "Add a bot" }).click();
  await hostPage
    .locator("#multiplayerBot0")
    .selectOption({ label: "Kool Kat" });
  await hostPage
    .locator("#multiplayerBot1")
    .selectOption({ label: "Kool Kat" });
  await expect(
    hostPage.getByLabel("Kool Kat 1", { exact: true }),
  ).toBeVisible();
  await expect(hostPage.getByLabel("Paint of Kool Kat 2")).toBeAttached();
  await hostPage.getByRole("button", { name: "Remove Kool Kat 2" }).click();
  await expect(hostPage.getByLabel("Kool Kat", { exact: true })).toBeVisible();
  await hostPage.getByRole("button", { name: "Back" }).click();
  // the guest's dialog lists it
  await guestPage.waitForTimeout(DELIVERY_MS);
  await guest.advance(2);
  await guestPage.getByRole("button", { name: "Room bots" }).click();
  // (a bot named after its car, which the card does not tell twice)
  await expect(guestPage.locator("#multiplayerBotList")).toHaveText("Kool Kat");
  await guestPage.getByRole("button", { name: "Back" }).click();
  await hostStartsRace(games);
  const koolKat = await hostPage.evaluate(() =>
    window.gameState.carStats.names.indexOf("Kool Kat"),
  );
  // (the host's own car as the tabs' shared storage left it)
  const field = await fieldOf(hostPage);
  expect(field.slice(1)).toEqual([Number(GUEST_TYPE), koolKat]);
  expect(await fieldOf(guestPage)).toEqual(field);
  // the bot is the AI's, in both games alike
  const both = [
    { game: host, page: hostPage },
    { game: guest, page: guestPage },
  ];
  await advanceBoth(...both, 300);
  expect(await apartAt(hostPage)).toBe(-1);
  expect(await apartAt(guestPage)).toBe(-1);
});

test("leaving the room ends the link", async ({ page }) => {
  const game = await openGame(page, { storage: { carsel: "5" } });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await page.getByRole("button", { name: "Multiplayer" }).click();
  await page.getByRole("button", { name: "Host a race" }).click();
  await expect(page.locator("#multiplayerRoom")).toBeVisible();
  await page.getByRole("button", { name: "Leave the room" }).click();
  await expect(page.getByRole("button", { name: "Host a race" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
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

test("each game's HUD tells its player of the stunts it landed and the cars it wasted, the others who wasted them", async ({
  context,
}) => {
  await recordDrawnTexts(context);
  const { hostPage, guestPage, both } = await raceTogether(
    context,
    "events",
    5,
  );
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
  // the host did not waste it, nor land the stunt, and is told who did
  expect(onHost.some((text) => /^You wasted /.test(text))).toBe(false);
  expect(onHost.some((text) => /^Player 2 wasted .+$/.test(text))).toBe(true);
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
    // (after a race the lobby is back: this race starts from the main menu)
    for (const { page } of all) {
      await page.evaluate(() => document.getElementById("multiplayer").close());
    }
    await hostPage.locator("#menuCampaign").focus();
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
  await expect(guestPage.locator("#multiplayerNotice")).toHaveText(
    "The host left the room.",
  );
  await expect(
    guestPage.getByRole("button", { name: "Join the race" }),
  ).toBeVisible();
});

test("in the lobby the host chooses the stage, the mode and its rules, the guest its car, both chat, and the race starts once the guest is ready", async ({
  context,
}) => {
  const games = await openTwoGames(context, "/?host=lobby", "/?join=lobby");
  const { host, guest, hostPage, guestPage } = games;
  const both = [
    { game: host, page: hostPage },
    { game: guest, page: guestPage },
  ];
  const deliver = async () => {
    await guestPage.waitForTimeout(DELIVERY_MS);
    await advanceBoth(...both, 35);
  };
  await deliver();
  await hostPage.locator("#menuMultiplayer").click();
  await guestPage.locator("#menuMultiplayer").click();

  await hostPage.getByLabel("Stage", { exact: true }).selectOption("3");
  await hostPage.getByLabel("Mode", { exact: true }).selectOption("Most kills");
  await hostPage.getByLabel("Bot strength").selectOption("Hard");
  await hostPage
    .getByRole("region", { name: "The race" })
    .getByLabel("Collisions")
    .selectOption("Solid");
  await hostPage.getByLabel("Time", { exact: true }).selectOption("5 min");
  await guestPage.getByLabel("Your car").selectOption("12");
  // (a chat line is text, whatever it says)
  await hostPage.getByLabel("Message").fill("on <b>three</b>?");
  await hostPage.getByRole("button", { name: "Send" }).click();
  await deliver();
  await expect(guestPage.locator("#lobbyRules dt")).toHaveText([
    "Stage",
    "Mode",
    "Bot strength",
    "Collisions",
    "Time",
    "Back after",
    "Teams",
  ]);
  await expect(guestPage.locator("#lobbyRules dd")).toHaveText([
    "Stage 3",
    "Most kills",
    "Hard",
    "Solid",
    "5 min",
    "3 s",
    "None",
  ]);
  await expect(guestPage.locator("#lobbySettings")).toBeHidden();
  // (the time and the way back are most kills' alone)
  await hostPage
    .getByLabel("Mode", { exact: true })
    .selectOption("Only racing");
  await expect(hostPage.getByLabel("Time", { exact: true })).toBeHidden();
  await deliver();
  await expect(guestPage.locator("#lobbyRules dd")).toHaveText([
    "Stage 3",
    "Only racing",
    "Hard",
    "Solid",
    "None",
  ]);
  await expect(guestPage.locator("#lobbyChat li")).toHaveText([
    "Player 1 (host): on <b>three</b>?",
  ]);
  await expect(hostPage.locator("#lobbyChat li")).toHaveText([
    "Player 1 (host) (you): on <b>three</b>?",
  ]);
  const start = hostPage.getByRole("button", { name: "Start the race" });
  await expect(start).toBeDisabled();
  // (the host starts, the guest gets ready)
  await expect(hostPage.locator("#lobbyReady")).toBeHidden();
  await expect(guestPage.locator("#lobbyStart")).toBeHidden();
  await expect(
    hostPage.getByRole("list", { name: "Players" }).getByRole("listitem"),
  ).toHaveText([/Ready$/, /Not ready(, Same network)?$/]);

  await guestPage.getByRole("button", { name: "Ready" }).click();
  await expect(guestPage.locator("#lobbyReady")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await deliver();
  await expect(hostPage.getByRole("status")).toContainText("start a race");
  await start.click();
  await host.advanceUntil(PHASE.race);
  await host.advance();
  await guestPage.waitForTimeout(DELIVERY_MS);
  await guest.advanceUntil(PHASE.race);
  const raced = (page) =>
    page.evaluate(() => ({
      stage: window.gameState.track.stage,
      mode: window.gameState.raceSetup.mode,
      strength: window.gameState.raceSetup.rules.strength,
      collisions: window.gameState.raceSetup.rules.collisions,
      field: window.gameState.game.carTypes.slice(0, 2),
    }));
  // (the tabs share their storage, and with it the host's car: the games are compared)
  expect(await raced(guestPage)).toMatchObject({
    stage: 3,
    mode: 1,
    strength: 2,
    collisions: 1,
  });
  expect((await raced(guestPage)).field[1]).toBe(12);
  expect(await raced(hostPage)).toEqual(await raced(guestPage));

  // the guest leaves the race: the lobby is back, to get ready again
  await advanceBoth(...both, 150);
  for (const key of ["Escape", "ArrowDown", "Enter"]) {
    await pressInRace(guest, guestPage, key);
  }
  await guest.advanceUntil(PHASE.mainMenu);
  await guest.advance(2);
  await expect(guestPage.locator("#multiplayer")).toBeVisible();
  await expect(guestPage.locator("#lobbyReady")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("a race of the host's own while it waits for guests goes on to the car select, not to the lobby", async ({
  page,
}) => {
  const game = await openGame(page, {
    storage: { carsel: HOST_TYPE, unlocked: "3" },
    url: "/?host=alone",
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.advance(2);
  await page.locator("#menuPractice").click();
  await game.advanceUntil(PHASE.carSelect);
  await game.advance(60);
  await game.tap("Enter");
  await game.advanceUntil(PHASE.stageSelect);
  await game.advance(60);
  await game.tap("Enter");
  await game.advanceUntil(PHASE.race);
  await game.advance();
  await page.evaluate(() => {
    const { game, menu, PHASE } = window.gameState;
    menu.animation = 0;
    menu.continuesToCarSelect = true;
    game.phase = PHASE.mainMenu;
  });
  await game.advance(2);
  await expect(page.locator("#multiplayer")).toBeHidden();
  expect(
    await page.evaluate(() => window.gameState.menu.continuesToCarSelect),
  ).toBe(true);
});

// (skins: 1 red, 5 blue; see src/render/skins.js)
test("in the lobby the host chooses teams and whether team mates crash, each player its team and the host its bots', and the race has them", async ({
  context,
}) => {
  const games = await openTwoGames(context, "/?host=teams", "/?join=teams");
  const { host, guest, hostPage, guestPage } = games;
  const both = [
    { game: host, page: hostPage },
    { game: guest, page: guestPage },
  ];
  const deliver = async () => {
    await guestPage.waitForTimeout(DELIVERY_MS);
    await advanceBoth(...both, 35);
  };
  await deliver();
  await hostPage.locator("#menuMultiplayer").click();
  await guestPage.locator("#menuMultiplayer").click();
  // (no teams: no team to choose)
  await expect(guestPage.getByLabel("Your team")).toBeHidden();
  await expect(hostPage.getByLabel("Team mates crash")).toBeHidden();
  await hostPage.getByLabel("Teams", { exact: true }).selectOption("2 teams");
  await hostPage
    .getByLabel("Team mates crash")
    .selectOption("No, pass through");
  await hostPage.getByRole("button", { name: "Add a bot" }).click();
  await hostPage.getByLabel(/^Team of /).selectOption("Team Blue");
  await deliver();
  await guestPage.getByLabel("Your team").selectOption("Team Red");
  await deliver();
  // the host's car red by its place, the guest's as chosen, the bot's as the host chose
  await expect(
    guestPage.getByRole("list", { name: "Players" }).getByRole("listitem"),
  ).toContainText(["Team Red", "Team Red"]);
  await expect(
    hostPage.getByRole("list", { name: "Players" }).getByRole("listitem"),
  ).toContainText(["Team Red", "Team Red"]);
  await expect(
    guestPage.getByRole("list", { name: "Bots" }).getByRole("listitem"),
  ).toContainText(["Team Blue"]);
  await expect(guestPage.locator("#lobbyRules")).toContainText("2 teams");
  await expect(guestPage.locator("#lobbyRules")).toContainText(
    "No, pass through",
  );
  await guestPage.getByRole("button", { name: "Ready" }).click();
  await deliver();
  await hostPage.getByRole("button", { name: "Start the race" }).click();
  await host.advanceUntil(PHASE.race);
  await host.advance();
  await guestPage.waitForTimeout(DELIVERY_MS);
  await guest.advanceUntil(PHASE.race);
  const teams = (page) =>
    page.evaluate(() => {
      const s = window.gameState;
      return {
        teams: s.raceSetup.rules.teams,
        teamCrashes: s.raceSetup.rules.teamCrashes,
        of: [0, 1, 2].map((c) => s.teamOf(c)),
      };
    });
  const expected = { teams: 2, teamCrashes: false, of: [0, 0, 1] };
  expect(await teams(hostPage)).toEqual(expected);
  expect(await teams(guestPage)).toEqual(expected);
  // the name tags tinted and underlined in their team's colour
  await advanceBoth(...both, 5);
  await expect
    .poll(() =>
      guestPage.evaluate(() =>
        [...document.querySelectorAll("#nameTags .name-tag")]
          .filter((tag) => !tag.hidden && tag.classList.contains("in-team"))
          .map((tag) => tag.dataset.team)
          .sort(),
      ),
    )
    .toEqual(["0", "1"]);
});

test("a room its host makes public is listed for everyone, joined from the list, and gone from it once private again", async ({
  context,
}) => {
  const hostPage = await context.newPage();
  const guestPage = await context.newPage();
  const host = await openGame(hostPage, {
    storage: {
      ...UNNAMED,
      playerName: "Hosti",
      carsel: HOST_TYPE,
      unlocked: "3",
    },
    url: "/?host=listed",
  });
  const guest = await openGame(guestPage, {
    storage: { ...UNNAMED, carsel: GUEST_TYPE, unlocked: "3" },
  });
  await host.advanceUntil(PHASE.mainMenu);
  await guest.advanceUntil(PHASE.mainMenu);
  await guestPage.locator("#menuMultiplayer").click();
  const rooms = guestPage.getByRole("list", { name: "Public rooms" });
  // (the list is asked for every few seconds, and shown as the game ticks)
  const shown = (locator, read) =>
    expect.poll(
      async () => {
        await host.advance();
        await guest.advance();
        return read(locator);
      },
      { timeout: 10000 },
    );
  // (a room is private unless its host chooses otherwise)
  await shown(guestPage.locator("#multiplayerBrowserStatus"), (line) =>
    line.textContent(),
  ).toBe("No public rooms right now: host one, or join with a code.");
  await hostPage.locator("#menuMultiplayer").click();
  await hostPage.getByLabel("Who can join").selectOption("1");
  await shown(rooms.getByRole("listitem"), (items) =>
    items.allTextContents(),
  ).toEqual([
    expect.stringMatching(
      /^Hosti's room: Normal race on Stage \d+, 1 of 8 playersJoin$/,
    ),
  ]);
  await rooms.getByRole("button", { name: "Join Hosti's room" }).click();
  for (let i = 0; i < 5; i++) {
    await guest.advance(30);
    await hostPage.waitForTimeout(DELIVERY_MS);
    await host.advance(2);
    await guestPage.waitForTimeout(DELIVERY_MS);
  }
  await expect(guestPage.locator("#multiplayerPlayers")).toContainText(
    "Hosti (host)",
  );
  // private again: no longer listed
  await hostPage.getByLabel("Who can join").selectOption("0");
  await host.advance(2);
  await expect
    .poll(
      () =>
        guestPage.evaluate(() =>
          fetch("/net/public").then((response) => response.json()),
        ),
      { timeout: 10000 },
    )
    .toEqual({ rooms: [] });
});

test("each game names the cars after their players and paints them as chosen, a name over each car the camera does not follow", async ({
  context,
}) => {
  const { hostPage, guestPage, both } = await raceTogether(
    context,
    "names",
    1,
    { playerName: "Hosti", carSkin: "1" },
    { playerName: "Gasti", carSkin: "5" },
  );
  await advanceBoth(both[0], both[1], 5);
  const cars = (page) =>
    page.evaluate(() => {
      const s = window.gameState;
      return [0, 1, 2].map((c) => ({
        name: s.nameOfCar(c),
        skin: s.skinOf(c),
        ownBody: s.racers[c].body !== s.carModels[s.car[c].typ],
      }));
    });
  // (the bot after its car)
  const botCar = await hostPage.evaluate(() => {
    const { carStats, game } = window.gameState;
    return carStats.names[game.carTypes[2]];
  });
  const expected = [
    { name: "Hosti", skin: 1, ownBody: true },
    { name: "Gasti", skin: 5, ownBody: true },
    { name: botCar, skin: 0, ownBody: false },
  ];
  expect(await cars(hostPage)).toEqual(expected);
  expect(await cars(guestPage)).toEqual(expected);
  // the guest's own car has no name over it, the others theirs
  const tags = (page) =>
    page.locator("#nameTags .name-tag:not([hidden])").allTextContents();
  await expect.poll(() => tags(guestPage)).toContain("Hosti");
  expect(await tags(guestPage)).not.toContain("Gasti");
  await expect.poll(() => tags(hostPage)).toContain("Gasti");
  expect(await tags(hostPage)).not.toContain("Hosti");
  // under each name, its car's damage and power, as the race has them
  const bars = (page) =>
    page.evaluate(() => {
      const s = window.gameState;
      const tag = [...document.querySelectorAll("#nameTags .name-tag")].find(
        (tag) => !tag.hidden && tag.textContent == "Hosti",
      );
      const [damage, power] = [...tag.querySelectorAll(".name-bar > span")].map(
        (fill) => fill.style.width,
      );
      const share = s.barsOf(0);
      return {
        damage,
        power,
        expected: [share.damage, share.power].map(
          (x) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`,
        ),
      };
    });
  await expect
    .poll(async () => {
      const { damage, power, expected } = await bars(guestPage);
      return [damage, power].join() == expected.join() && damage != "";
    })
    .toBe(true);
});

test("the lobby shows each player's name and paint, and a name set in the options at once", async ({
  context,
}) => {
  const { host, guest, hostPage, guestPage } = await openTwoGames(
    context,
    "/?host=lobby-names",
    "/?join=lobby-names",
    { playerName: "Hosti" },
  );
  await guest.advance(30);
  await hostPage.waitForTimeout(DELIVERY_MS);
  await host.advance(2);
  await guestPage.waitForTimeout(DELIVERY_MS);
  await guest.advance(2);
  await guestPage.locator("#menuMultiplayer").click();
  const players = guestPage.locator("#multiplayerPlayers");
  await expect(players).toContainText("Hosti (host)");
  await expect(players).toContainText("Player 2 (you)");
  await guestPage.getByLabel("Your paint").selectOption("Green");
  await host.advance(2);
  await hostPage.locator("#menuMultiplayer").click();
  await expect(hostPage.locator("#multiplayerPlayers")).toContainText(
    "in green",
  );
  // (a name from the options goes to the room)
  await guestPage.getByRole("button", { name: "Back" }).click();
  await guestPage.locator("#menuOptions").click();
  await guestPage.getByLabel("Your name").fill("Gasti");
  await guestPage.getByLabel("Your name").press("Enter");
  await guestPage.getByLabel("Your name").blur();
  await hostPage.waitForTimeout(DELIVERY_MS);
  await host.advance(2);
  await expect(hostPage.locator("#multiplayerPlayers")).toContainText("Gasti");
});

test("a guest coming to the room during its race watches it, running on alike from what the host sends", async ({
  context,
}) => {
  const { hostPage, guestPage, both } = await raceTogether(context, "watch", 1);
  await guestPage.keyboard.down("ArrowUp");
  await advanceBoth(...both, 250);
  const thirdPage = await context.newPage();
  const third = await openGame(thirdPage, {
    storage: { ...UNNAMED, carsel: "2", unlocked: "3" },
    url: "/?join=watch",
  });
  await third.advanceUntil(PHASE.mainMenu);
  const all = [...both, { game: third, page: thirdPage }];
  // the lobby offers the race going on
  await thirdPage.evaluate(() => window.gameState.openMultiplayer());
  await expect
    .poll(async () => {
      await advanceAll(all, 5);
      return thirdPage.locator("#lobbyWatch").isVisible();
    })
    .toBe(true);
  await thirdPage.locator("#lobbyWatch").click();
  await expect
    .poll(
      async () => {
        await advanceAll(all, 5);
        return thirdPage.evaluate(() => window.gameState.game.phase);
      },
      { timeout: 30_000 },
    )
    .toBe(PHASE.race);
  // watching only: no car of its own, the camera on the cars racing
  expect(
    await thirdPage.evaluate(() => {
      const { game, lockstep, spectate } = window.gameState;
      return [
        game.player == game.carCount,
        lockstep.watching,
        spectate.watching,
      ];
    }),
  ).toEqual([true, true, true]);
  await advanceAll(all, 150);
  await sameRaces(all);
  // (its fingerprints were the players' too)
  expect(
    await thirdPage.evaluate(() => window.gameState.lockstep.alike),
  ).toBeGreaterThan(0);
  // the players never heard of it in the race
  expect(await hostPage.evaluate(() => window.gameState.game.humans)).toEqual([
    0, 1,
  ]);
  await thirdPage.screenshot({ path: "test-results/multiplayer-watcher.png" });
  // the race over, it goes back to the lobby
  await thirdPage.evaluate(() => (window.gameState.track.haltall = true));
  await advanceAll(all, 2);
  // (the players race on: its race too, which waits for their keys)
  await thirdPage.keyboard.down("Enter");
  await advanceAll(all, 2);
  await thirdPage.keyboard.up("Enter");
  await advanceAll(all, 5);
  expect(
    await thirdPage.evaluate(() => {
      const { game, lockstep } = window.gameState;
      return [game.phase, lockstep.active];
    }),
  ).toEqual([PHASE.mainMenu, false]);
  await guestPage.keyboard.up("ArrowUp");
});

test("a start too big for one message goes in parts, and the guest races along", async ({
  context,
}) => {
  // (what the host sends over the relay, which takes 256 kB a message at most)
  const sent = [];
  await context.routeWebSocket(/\/net\?room=/, (page) => {
    const server = page.connectToServer();
    page.onMessage((message) => {
      sent.push(String(message));
      server.send(message);
    });
    server.onMessage((message) => page.send(message));
  });
  const games = await openTwoGames(context, "/?host=parts", "/?join=parts");
  const { host, guest, hostPage, guestPage } = games;
  const both = [
    { game: host, page: hostPage },
    { game: guest, page: guestPage },
  ];
  const deliver = async () => {
    await guestPage.waitForTimeout(DELIVERY_MS);
    await advanceBoth(...both, 35);
  };
  await deliver();
  await hostPage.locator("#menuMultiplayer").click();
  await guestPage.locator("#menuMultiplayer").click();
  for (let i = 0; i < 6; i++) {
    await hostPage.getByRole("button", { name: "Add a bot" }).click();
  }
  await deliver();
  await guestPage.getByRole("button", { name: "Ready" }).click();
  await deliver();
  await hostPage.getByRole("button", { name: "Start the race" }).click();
  while ((await host.phase()) != PHASE.race) {
    await host.advance();
  }
  // every car dented all over, as after a few races of most kills
  const dents = await hostPage.evaluate(() => {
    const { game, racers, undentedVertices } = window.gameState;
    for (let c = 0; c < game.carCount; c++) {
      const body = racers[c].body;
      body.dvert = undentedVertices(body).map((v, i) => v + (i % 7) / 3);
      body.iscar = 2;
    }
    return racers[1].body.dvert.slice(0, 3);
  });
  await host.advance();
  await guestPage.waitForTimeout(DELIVERY_MS);
  await guest.advanceUntil(PHASE.race);
  const starts = sent.filter((message) => message.includes('"type":"start"'));
  expect(starts.length).toBeGreaterThan(1);
  for (const message of sent) {
    expect(message.length).toBeLessThan(256 * 1024);
  }
  expect(
    await guestPage.evaluate(() =>
      window.gameState.racers[1].body.dvert.slice(0, 3),
    ),
  ).toEqual(dents);
});

// Ends the race in both games at the same frame: the host's car crosses the line.
const hostFinishes = async (both) => {
  await inStep(...both);
  for (const { page } of both) {
    await page.evaluate(() => {
      const { racers, track } = window.gameState;
      racers[0].clear = track.nlaps * track.nsp;
    });
  }
  await advanceBoth(...both, 60);
};

test("a player watching the replay after the race keeps no one waiting, and the lobby offers no race that is over", async ({
  context,
}) => {
  test.setTimeout(240_000);
  const { guest, hostPage, guestPage, both } = await raceTogether(
    context,
    "replay",
    1,
  );
  await advanceBoth(...both, 200);
  await hostFinishes(both);
  // (as the race over's Watch Replay does)
  await hostPage.evaluate(() => {
    const { VIEWER_FROM, openReplay } = window.gameState;
    openReplay(VIEWER_FROM.raceOver, 0);
  });
  await advanceBoth(...both, 30);
  // the guest goes on past the race over, its race not waiting for the host's keys
  expect(await guestPage.evaluate(() => window.gameState.lockstepWaits())).toBe(
    false,
  );
  await pressInRace(guest, guestPage, "Enter");
  await advanceBoth(...both, 5);
  expect(await guest.phase()).toBe(PHASE.raceEnd);
  // (the race end takes Continue once it faded in)
  while ((await guest.phase()) != PHASE.mainMenu) {
    await pressInRace(guest, guestPage, "Enter");
    await advanceBoth(...both, 10);
  }
  await advanceBoth(...both, 35);
  await expect(guestPage.locator("#multiplayer")).toBeVisible();
  await expect(guestPage.locator("#lobbyWatch")).toBeHidden();
  await expect(guestPage.getByRole("status")).toHaveText(
    "Choose your car, then say you are ready.",
  );
  expect(await hostPage.evaluate(() => window.gameState.game.phase)).toBe(
    PHASE.replay,
  );
});

test("the lobby lists who is still watching the highlight or at the results, and the host starts without them", async ({
  context,
}) => {
  test.setTimeout(240_000);
  const { host, guest, hostPage, guestPage, both } = await raceTogether(
    context,
    "status",
    1,
  );
  await advanceBoth(...both, 200);
  await hostFinishes(both);
  // the guest watches its highlight, the host none
  await guestPage.evaluate(() => {
    const { HIGHLIGHT, catchHighlight, recording } = window.gameState;
    recording.recordedTicks = 1000;
    catchHighlight(HIGHLIGHT.stunt);
  });
  await hostPage.evaluate(() => (window.gameState.recording.highlight = 0));
  await pressInRace(guest, guestPage, "Enter");
  await advanceBoth(...both, 5);
  expect(await guest.phase()).toBe(PHASE.highlights);
  while ((await host.phase()) != PHASE.mainMenu) {
    await pressInRace(host, hostPage, "Enter");
    await advanceBoth(...both, 10);
  }
  // (long after the guest left the race: it is not taken for gone)
  await advanceBoth(...both, 120);
  expect(await guest.phase()).toBe(PHASE.highlights);
  const hostCards = hostPage
    .getByRole("list", { name: "Players" })
    .getByRole("listitem");
  await expect(hostCards).toHaveText([
    /Ready$/,
    /Watching the highlight(, Same network)?$/,
  ]);
  await expect(hostPage.getByRole("status")).toHaveText(
    "Everyone in the lobby is ready: start a race when you like. The others can join the next one.",
  );
  await expect(
    hostPage.getByRole("button", { name: "Start the race" }),
  ).toBeEnabled();
  // (the guest heard the host is back in the lobby)
  expect(
    await guestPage.evaluate(() =>
      window.gameState.guest.players.map(({ status }) => status),
    ),
  ).toEqual([0, 2]);

  // the guest skips the highlight, and is at the results
  await pressInRace(guest, guestPage, "Enter");
  await advanceBoth(...both, 10);
  expect(await guest.phase()).toBe(PHASE.raceEnd);
  await expect(hostCards).toHaveText([
    /Ready$/,
    /At the results(, Same network)?$/,
  ]);
  // back in the lobby, it is not ready yet
  while ((await guest.phase()) != PHASE.mainMenu) {
    await pressInRace(guest, guestPage, "Enter");
    await advanceBoth(...both, 10);
  }
  await advanceBoth(...both, 35);
  await expect(hostCards).toHaveText([/Ready$/, /Not ready(, Same network)?$/]);
  await expect(hostPage.getByRole("status")).toHaveText(
    "Waiting for everyone to be ready...",
  );
  await expect(
    guestPage.getByRole("list", { name: "Players" }).getByRole("listitem"),
  ).toHaveText([/Ready(, Same network)?$/, /Not ready$/]);
});
