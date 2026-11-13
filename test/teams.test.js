import { afterEach, expect, test } from "vitest";
import { canvasCalls } from "./harness/browserStubs.js";
import { startRace } from "./harness/race.js";

let reset = null;
afterEach(() => reset?.());

// A room's race with bots alone in two teams (cars 0, 2, 4... red, 1, 3, 5... blue), past
// the countdown, in the given mode and with these rules.
const inTeams = async (mode, rules = {}) => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  reset = () => {
    ctx.raceSetup.mode = ctx.RACE_MODE.normal;
    ctx.raceSetup.kind = ctx.RACE_KIND.quickRace;
    ctx.raceSetup.rules = ctx.roomRules();
    ctx.game.humans = [];
    ctx.forgetRoomCars();
  };
  ctx.raceSetup.kind = ctx.RACE_KIND.together;
  ctx.raceSetup.mode = ctx.RACE_MODE[mode];
  ctx.raceSetup.rules = { ...ctx.roomRules(), teams: 2, ...rules };
  const cars = Array.from({ length: ctx.game.carCount }, (_, c) => c);
  ctx.setRoomCars(
    cars.map(() => null),
    cars.map(() => 0),
    cars.map((c) => c % 2),
  );
  ctx.game.humans = [0];
  ctx.startDeathmatch();
  ctx.raceEvents.countdown = 0;
  return { ctx, step };
};

test("in teams a car wasted by a team mate counts for nobody, nor do its dents", async () => {
  const { ctx } = await inTeams("mostKills");
  expect(ctx.teamOf(2)).toBe(0);
  expect(ctx.teamMates(0, 2)).toBe(true);
  expect(ctx.teamMates(0, 1)).toBe(false);
  ctx.noteHit(1, 3, 0.5);
  expect(ctx.deathmatch.dealt[3]).toBe(0);
  ctx.racers[1].lastcolido = 70;
  ctx.racers[1].lastHitBy = 3;
  ctx.noteWasted(1);
  expect(ctx.deathmatch.kills[3]).toBe(0);
  ctx.racers[1].lastHitBy = 2;
  ctx.noteWasted(1);
  expect(ctx.deathmatch.kills[2]).toBe(1);
  expect(ctx.teamTable().map(({ team, kills }) => [team, kills])).toEqual([
    [0, 1],
    [1, 0],
  ]);
});

test("in teams the last survivor is the last team with a car not wasted", async () => {
  const { ctx } = await inTeams("lastSurvivor");
  for (let c = 0; c < ctx.game.carCount; c++) {
    ctx.racers[c].wasted = c % 2 == 1 || c > 2;
  }
  // cars 0 and 2 left, both red: the race is over
  ctx.updateStandings();
  expect(ctx.track.haltall).toBe(true);
  ctx.track.haltall = false;
  ctx.raceSetup.rules = { ...ctx.raceSetup.rules, teams: 0 };
  ctx.updateStandings();
  expect(ctx.track.haltall).toBe(false);
});

// how far apart cars 1 and 3, team mates sunk into each other, are after a while
const mates = async (teamCrashes) => {
  const { COLLISIONS } = await import("../src/core/state.js");
  const { ctx } = await inTeams("normal", {
    teamCrashes,
    collisions: COLLISIONS.solid,
  });
  ctx.game.humans = [0, 1, 3];
  ctx.car[3].x = ctx.car[1].x + 6;
  ctx.car[3].z = ctx.car[1].z;
  ctx.car[3].y = ctx.car[1].y;
  for (let i = 0; i < 30; i++) {
    ctx.drive();
  }
  return Math.abs(ctx.car[3].x - ctx.car[1].x);
};

test("team mates pass through each other unless the host lets them crash", async () => {
  expect(await mates(false)).toBeLessThan(8);
  expect(await mates(true)).toBeGreaterThan(12);
});

test("in teams the team of the last cars standing wins, though the player's car is wasted", async () => {
  const { ctx } = await inTeams("lastSurvivor");
  const winnerWhenLeft = (left) => {
    for (let c = 0; c < ctx.game.carCount; c++) {
      ctx.racers[c].wasted = c != left;
    }
    ctx.track.haltall = false;
    ctx.updateStandings();
    ctx.drawHud();
    return ctx.raceEvents.winner;
  };
  // (the player's car 0 and car 2 red, car 1 blue)
  expect(winnerWhenLeft(2)).toBe(true);
  expect(winnerWhenLeft(1)).toBe(false);
});

test("in teams the team of the first car through wins a normal race", async () => {
  const { ctx } = await inTeams("normal");
  const winnerWhenFirst = (c) => {
    ctx.track.haltall = false;
    ctx.racers[c].clear = ctx.track.nlaps * ctx.track.nsp;
    ctx.updateStandings();
    ctx.drawHud();
    ctx.racers[c].clear = 0;
    return ctx.raceEvents.winner;
  };
  expect(winnerWhenFirst(2)).toBe(true);
  expect(winnerWhenFirst(3)).toBe(false);
});

test("most kills in teams ends with the teams' results before the cars'", async () => {
  const { ctx } = await inTeams("mostKills");
  ctx.deathmatch.kills[1] = 3;
  ctx.deathmatch.kills[0] = 1;
  ctx.deathmatch.kills[2] = 1;
  ctx.deathmatch.assists[3] = 1;
  const rows = [
    ...ctx.teamTable().map(ctx.killRow),
    ...ctx.killTable().map(ctx.killRow),
  ];
  expect(rows.slice(0, 3).map(({ cells }) => cells.slice(0, 4))).toEqual([
    ["1st", "Team Blue", "3", "1"],
    ["2nd", "Team Red", "2", "0"],
    ["1st", ctx.nameOfCar(1), "3", "0"],
  ]);
  // (the player's team's row and car's row stand out)
  expect(rows.filter(({ mine }) => mine).map(({ cells }) => cells[1])).toEqual([
    "Team Red",
    ctx.nameOfCar(0),
  ]);
  // the HUD says each team's kills, the team ahead first
  const drawn = [];
  canvasCalls.listener = (name, args, call) => {
    if (name == "fillText") {
      drawn.push(String(args[0]));
    }
    return call();
  };
  ctx.drawHud();
  canvasCalls.listener = null;
  const blue = drawn.indexOf("Blue");
  expect(drawn.slice(blue, blue + 4)).toEqual(["Blue", "3", "Red", "2"]);
  // red ahead, though car 1 has the most kills
  ctx.deathmatch.kills[0] = 2;
  ctx.deathmatch.kills[2] = 2;
  ctx.track.haltall = true;
  ctx.drawHud();
  expect(ctx.raceEvents.winner).toBe(true);
});

test("a room's cars race for the teams they chose, the others in turn, so that the teams come out even", async () => {
  const { ctx } = await inTeams("normal");
  expect(ctx.teamsOf([null, null, null, null, null], 2)).toEqual([
    0, 1, 0, 1, 0,
  ]);
  expect(ctx.teamsOf([1, null, 3, null], 3)).toEqual([1, 1, 0, 0]);
  expect(ctx.teamsOf([1, null], 0)).toEqual([0, 0]);
});

test("team mates passing through each other are seen through, the more the nearer, as in time attack", async () => {
  const { ctx } = await inTeams("normal", { teamCrashes: false });
  ctx.camera.target = 0;
  const showsAt = (c, away) => {
    ctx.car[c].x = ctx.car[0].x + away;
    ctx.car[c].z = ctx.car[0].z;
    return ctx.showsOf(c);
  };
  // (car 2 red as the followed car 0, car 1 blue)
  expect(showsAt(2, 10)).toBe(0.25);
  expect(showsAt(2, 1000)).toBe(1);
  expect(showsAt(1, 10)).toBe(1);
  // team mates that crash are solid
  ctx.raceSetup.rules = { ...ctx.raceSetup.rules, teamCrashes: true };
  expect(showsAt(2, 10)).toBe(1);
});
