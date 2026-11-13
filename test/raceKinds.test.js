import { afterEach, expect, test, vi } from "vitest";
import { loadGame } from "./harness/loadGame.js";
import { openStageSelect } from "./harness/race.js";
import { MODE, PHASE } from "../src/core/state.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const openMainMenu = async (settings = {}) => {
  const stored = new Map(Object.entries({ carsel: "5", ...settings }));
  vi.stubGlobal("localStorage", {
    getItem: (name) => stored.get(name) ?? null,
    setItem: (name, value) => stored.set(name, String(value)),
  });
  const game = await loadGame({ seed: 1 });
  game.stepUntil(() => game.ctx.game.phase === PHASE.mainMenu, 400, "menu");
  return game;
};

const tapEnter = ({ key, step }) => {
  key(13, true);
  step();
  key(13, false);
  step();
};

test("the original's main menu starts the campaign, whatever was raced before", async () => {
  const game = await openMainMenu({
    unlocked: "4",
    look: "1",
    classicMenus: "1",
  });
  const { ctx, stepUntil } = game;
  ctx.chooseRaceKind(ctx.RACE_KIND.timeAttack);
  tapEnter(game);
  stepUntil(() => ctx.game.phase === PHASE.carSelect, 100, "car select");
  expect(ctx.raceSetup.kind).toBe(ctx.RACE_KIND.campaign);
  expect(ctx.game.unlocked).toBe(4);
});

test("a key taken by a dialog over the main menu chooses nothing behind it", async () => {
  const game = await openMainMenu();
  const { ctx, step } = game;
  for (let i = 0; i < 40; i++) {
    step();
  }
  const options = globalThis.document.getElementById("options");
  options.open = true;
  tapEnter(game);
  expect(ctx.menu.animation).toBeLessThan(29);
  options.open = false;
  tapEnter(game);
  expect(ctx.menu.animation).toBeGreaterThanOrEqual(29);
});

test("practice and time attack race alone, one lap or not as the stage has it", async () => {
  const { ctx, key, step, stepUntil } = await openStageSelect({
    stage: 4,
    car: 5,
  });
  ctx.chooseRaceKind(ctx.RACE_KIND.timeAttack);
  // (switch mode, from a quick race before)
  ctx.game.mode = MODE.switchCars;
  key(13, true);
  step();
  key(13, false);
  stepUntil(() => ctx.game.phase === PHASE.race, 20, "race");
  expect(ctx.game.mode).toBe(MODE.championship);
  expect(ctx.game.carCount).toBe(1);
  expect(ctx.track.nlaps).toBeGreaterThan(1);
});

test("a host's bots race only the room's races, and its guests no race of one alone", async () => {
  const { ctx } = await openMainMenu();
  ctx.link.role = ctx.ROLE.host;
  ctx.addBot();
  ctx.hostTick();
  expect(ctx.field.roomCarTypes).toBe(null);
  ctx.chooseRaceKind(ctx.RACE_KIND.together);
  ctx.hostTick();
  expect(ctx.field.roomCarTypes).toEqual(
    ctx.roomBots().map(({ carType }) => carType),
  );

  ctx.roomGuests().push({
    id: "abcdefgh",
    carType: 3,
    ready: true,
    joinedTicks: 0,
    quietTicks: 0,
  });
  ctx.game.mode = MODE.championship;
  ctx.game.carCount = 1;
  ctx.startHostedRace();
  expect(ctx.game.humans).toEqual([]);
});

// (a race of a room leaves its players in game.humans: its cars' names and paints must not
// pass to the next race, which may be no room's)
test("a room race's names and paints are forgotten back in the menus", async () => {
  const { ctx, step } = await openMainMenu();
  ctx.setRoomCars(["Hosti", "Gasti"], [1, 5]);
  ctx.game.humans = [0, 1];
  expect(ctx.skinOf(1)).toBe(5);
  step();
  expect(ctx.skinOf(1)).toBe(0);
  expect(ctx.nameOfCar(1)).toBe(ctx.carStats.names[ctx.game.carTypes[1]]);
});

test("a guest asking to watch the host's race may ask again once the host's race is over or the host does not answer", async () => {
  const { ctx } = await openMainMenu();
  ctx.link.role = ctx.ROLE.guest;
  try {
    const ask = () => {
      ctx.guest.racing = true;
      ctx.watchRoomRace();
      expect(ctx.guest.watchAsked).toBe(true);
    };
    ask();
    for (let i = 0; i < 100; i++) {
      ctx.guestWaitingTick();
    }
    expect(ctx.guest.watchAsked).toBe(true);
    ctx.guest.racing = false;
    ctx.guestWaitingTick();
    expect(ctx.guest.watchAsked).toBe(false);
    ask();
    for (let i = 0; i < 400; i++) {
      ctx.guestWaitingTick();
    }
    expect(ctx.guest.watchAsked).toBe(false);
  } finally {
    ctx.link.role = ctx.ROLE.none;
  }
});
