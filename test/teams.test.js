import { afterEach, expect, test } from "vitest";
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
