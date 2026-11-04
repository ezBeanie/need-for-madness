import { afterEach, expect, test } from "vitest";
import { startRace } from "./harness/race.js";

let reset = null;
afterEach(() => reset?.());

test("racing only, a car hit takes no damage and keeps its shape", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  reset = () => (ctx.raceSetup.mode = ctx.RACE_MODE.normal);
  for (let i = 0; i < 3; i++) {
    step();
  }
  const hit = () => {
    const before = ctx.racers[1].damage;
    ctx.regn(ctx.HIT.alongZ, 1, 60, 1);
    return ctx.racers[1].damage - before;
  };
  // (a normal race: the hit damages)
  expect(hit()).toBeGreaterThan(0);
  ctx.raceSetup.mode = ctx.RACE_MODE.onlyRacing;
  const shape = Array.from(ctx.racers[1].body.dvert ?? []);
  expect(hit()).toBe(0);
  expect(Array.from(ctx.racers[1].body.dvert ?? [])).toEqual(shape);
});

test("a race of any other kind is a normal one, whatever the room raced before", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  ctx.raceSetup.mode = ctx.RACE_MODE.onlyRacing;
  ctx.chooseRaceKind(ctx.RACE_KIND.quickRace);
  expect(ctx.raceSetup.mode).toBe(ctx.RACE_MODE.normal);
});

test("as last survivor, finishing the laps ends nothing: the last car not wasted does", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  reset = () => {
    ctx.raceSetup.mode = ctx.RACE_MODE.normal;
    ctx.game.humans = [];
  };
  for (let i = 0; i < 3; i++) {
    step();
  }
  ctx.game.humans = [0, 1];
  const finishedBy = (mode) => {
    ctx.raceSetup.mode = mode;
    ctx.track.haltall = false;
    ctx.racers[1].clear = ctx.track.nlaps * ctx.track.nsp;
    ctx.updateStandings();
    return ctx.track.haltall;
  };
  // (a normal race: car 1 finishing first ends it)
  expect(finishedBy(ctx.RACE_MODE.normal)).toBe(true);
  expect(finishedBy(ctx.RACE_MODE.lastSurvivor)).toBe(false);
  for (let c = 1; c < ctx.game.carCount; c++) {
    ctx.racers[c].wasted = true;
  }
  ctx.updateStandings();
  expect(ctx.track.haltall).toBe(true);
});

test("in a room's time attack the cars pass through each other", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  reset = () => (ctx.raceSetup.mode = ctx.RACE_MODE.normal);
  for (let i = 0; i < 3; i++) {
    step();
  }
  // car 1 right on car 0, or far away: what one tick of driving makes of car 0
  const start = ctx.saveRace();
  const car0After = (mode, onTop) => {
    ctx.restoreRace(start);
    ctx.raceSetup.mode = mode;
    ctx.car[1].x = ctx.car[0].x + (onTop ? 5 : 5000);
    ctx.car[1].z = ctx.car[0].z;
    ctx.racers[1].speed = 40;
    ctx.drive();
    return JSON.stringify(ctx.copyCarState(0));
  };
  // (a normal race: the car on top pushes)
  expect(car0After(ctx.RACE_MODE.normal, true)).not.toEqual(
    car0After(ctx.RACE_MODE.normal, false),
  );
  expect(car0After(ctx.RACE_MODE.timeAttack, true)).toEqual(
    car0After(ctx.RACE_MODE.timeAttack, false),
  );
});

test("a room's time attack goes on until every car is through or wasted, timed from the race's tape", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  reset = () => {
    ctx.raceSetup.mode = ctx.RACE_MODE.normal;
    ctx.game.humans = [];
  };
  for (let i = 0; i < 3; i++) {
    step();
  }
  ctx.game.humans = [0, 1];
  ctx.raceSetup.mode = ctx.RACE_MODE.timeAttack;
  const done = ctx.track.nlaps * ctx.track.nsp;
  ctx.racers[1].clear = done;
  ctx.updateStandings();
  // (the first through ends nothing)
  expect(ctx.track.haltall).toBe(false);
  for (let c = 0; c < ctx.game.carCount; c++) {
    if (c != 1) {
      ctx.racers[c].wasted = c != 0;
      ctx.racers[c].clear = c == 0 ? done : 0;
    }
  }
  ctx.updateStandings();
  expect(ctx.track.haltall).toBe(true);

  // the tape: car 1 crossing the line (across z at 25) halfway through tick 4, car 0
  // never
  ctx.resetRaceTape(ctx.game.carCount);
  const finish = 0;
  ctx.track.typ[finish] = 1;
  ctx.track.z[finish] = 25;
  for (let t = 0; t < 6; t++) {
    for (const tape of ctx.raceTape.cars) {
      tape.x[t] = 0;
      tape.z[t] = 0;
      tape.clear[t] = 0;
      tape.clearedPathPoint[t] = finish;
    }
    const one = ctx.raceTape.cars[1];
    one.z[t] = 10 * t;
    one.clear[t] = 10 * t >= 30 ? done : 0;
  }
  ctx.raceTape.length = 6;
  const times = ctx.finishTimes();
  expect(times[0]).toBe(null);
  // (index 3 is after tick 4: from z 20 to 30, the line halfway)
  expect(times[1]).toBe(3.5);
});

test("in a room's time attack the other cars are seen through, the more the nearer they come", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  reset = () => {
    ctx.raceSetup.mode = ctx.RACE_MODE.normal;
    ctx.game.humans = [];
  };
  ctx.game.humans = [0, 1];
  ctx.camera.target = 0;
  const showsAt = (away) => {
    ctx.car[1].x = ctx.car[0].x + away;
    ctx.car[1].z = ctx.car[0].z;
    return ctx.showsOf(1);
  };
  // (a normal race: all of every car)
  expect(showsAt(10)).toBe(1);
  ctx.raceSetup.mode = ctx.RACE_MODE.timeAttack;
  expect(showsAt(10)).toBe(0.25);
  expect(showsAt(140)).toBeCloseTo(0.625);
  expect(showsAt(1000)).toBe(1);
  // the car followed itself is solid
  expect(ctx.showsOf(0)).toBe(1);
});
