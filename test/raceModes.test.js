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

// A race of most kills, past the countdown, the computer driving every car.
const mostKills = async () => {
  const game = await startRace({ stage: 1, car: 5 });
  const { ctx } = game;
  reset = () => {
    ctx.raceSetup.mode = ctx.RACE_MODE.normal;
    ctx.game.humans = [];
  };
  ctx.raceSetup.mode = ctx.RACE_MODE.mostKills;
  ctx.game.humans = [0, 1];
  ctx.startDeathmatch();
  ctx.raceEvents.countdown = 0;
  // (a body as hit before: its corners to dent and burn)
  ctx.fixcar(1);
  return game;
};

test("in most kills a wasted car counts for the car that hit it last, and comes back whole after a while", async () => {
  const { ctx } = await mostKills();
  // car 1, hit by bot 2, damaged beyond what it takes
  const wreck = () => {
    ctx.racers[1].lastcolido = 70;
    ctx.racers[1].lastHitBy = 2;
    ctx.racers[1].damage = 100000;
  };
  wreck();
  let ticks = 0;
  while (!ctx.racers[1].wasted && ticks < 200) {
    ctx.drive();
    ctx.racers[1].lastcolido = 70;
    ticks++;
  }
  expect(ctx.racers[1].wasted).toBe(true);
  expect(ctx.deathmatch.kills[2]).toBe(1);
  expect(ctx.deathmatch.deaths[1]).toBe(1);
  for (let i = 0; i < ctx.respawnTicks(); i++) {
    ctx.drive();
  }
  expect(ctx.racers[1].wasted).toBe(false);
  expect(ctx.racers[1].damage).toBe(0);
  expect([ctx.car[1].xy, ctx.car[1].zy]).toEqual([0, 0]);
});

test("a normal race keeps its wrecks and counts no kills", async () => {
  const { ctx } = await mostKills();
  ctx.raceSetup.mode = ctx.RACE_MODE.normal;
  ctx.racers[1].damage = 100000;
  for (let i = 0; i < 200 + ctx.respawnTicks(); i++) {
    ctx.drive();
  }
  expect(ctx.racers[1].wasted).toBe(true);
  expect(ctx.deathmatch.deaths[1]).toBe(0);
  // (and its state is as it always was)
  expect(ctx.saveRace().deathmatch).toBeUndefined();
});

test("most kills ends when its time is up, its clock and kills going with the race's state", async () => {
  const { ctx } = await mostKills();
  ctx.deathmatch.kills[3] = 2;
  ctx.deathmatch.ticks = ctx.deathmatchTicks() - 1;
  const saved = ctx.saveRace();
  expect(ctx.isRaceState(saved, ctx.game.carCount)).toBe(true);
  ctx.track.haltall = false;
  ctx.drive();
  ctx.updateStandings();
  expect(ctx.track.haltall).toBe(true);
  expect(ctx.killTable()[0]).toMatchObject({ c: 3, kills: 2 });
  // (back to before the last tick: the clock and kills too)
  ctx.deathmatch.kills[3] = 0;
  ctx.restoreRace(saved);
  expect(ctx.deathmatch.ticks).toBe(ctx.deathmatchTicks() - 1);
  expect(ctx.deathmatch.kills[3]).toBe(2);
});

test("a body's copy of its vertices goes in the race's state as null while undented, and comes back as it was", async () => {
  const { ctx } = await mostKills();
  const body = ctx.racers[1].body;
  const undented = body.dvert.slice();
  const saved = ctx.decode(ctx.encode(ctx.saveRace()));
  expect(saved.cars[1].dents).toBeNull();
  body.dvert = [];
  ctx.restoreRace(saved);
  expect(body.dvert).toEqual(undented);
  // a dent goes along
  body.dvert[0] += 5;
  expect(ctx.saveRace().cars[1].dents[0]).toBe(undented[0] + 5);
});

// Bot 2 right behind car 3, the other cars far off, about to think again.
const besideCar3 = (ctx) => {
  for (let c = 0; c < ctx.game.carCount; c++) {
    ctx.car[c].x = 50000 + c * 20000;
    ctx.car[c].z = 50000;
  }
  ctx.car[2].x = ctx.car[3].x - 600;
  ctx.racers[2].power = 98;
  ctx.racers[2].grounded = true;
  ctx.ai[2].attackTicks = 0;
  ctx.ai[2].ticksSinceRethink = 1000;
  ctx.control();
  return ctx.ai[2].attackTicks > 0 && ctx.ai[2].attackedCar == 3;
};

test("hard bots hunt the nearest car in the wasting modes, and only there", async () => {
  const { ctx } = await mostKills();
  const before = reset;
  reset = () => {
    before();
    ctx.raceSetup.rules = ctx.roomRules();
  };
  ctx.raceSetup.rules = { ...ctx.roomRules(), strength: ctx.STRENGTH.hard };
  expect(besideCar3(ctx)).toBe(true);
  // (and give up on a car wasted)
  ctx.racers[3].wasted = true;
  ctx.ai[2].ticksSinceRethink = 0;
  ctx.ai[2].rethinkAfter = 1000;
  ctx.control();
  expect(ctx.ai[2].attackTicks).toBe(0);
  ctx.racers[3].wasted = false;
  // normal bots, or a race, race as before
  ctx.raceSetup.rules = ctx.roomRules();
  expect(besideCar3(ctx)).toBe(false);
  ctx.raceSetup.rules = { ...ctx.roomRules(), strength: ctx.STRENGTH.hard };
  ctx.raceSetup.mode = ctx.RACE_MODE.onlyRacing;
  expect(besideCar3(ctx)).toBe(false);
});

test("a room's rules: how long most kills lasts, when the wasted come back, how its bots drive", async () => {
  const { ctx } = await mostKills();
  const before = reset;
  reset = () => {
    before();
    ctx.raceSetup.rules = ctx.roomRules();
  };
  const minute = (60 * 1000) / ctx.TICK_MS;
  expect(ctx.deathmatchTicks()).toBe(Math.round(3 * minute));
  ctx.raceSetup.rules = { ...ctx.roomRules(), minutes: 5, respawnSeconds: 10 };
  expect(ctx.deathmatchTicks()).toBe(Math.round(5 * minute));
  expect(ctx.respawnTicks()).toBe(Math.round(10000 / ctx.TICK_MS));
  expect(ctx.isRoomRules(ctx.raceSetup.rules)).toBe(true);
  expect(ctx.isRoomRules({ ...ctx.roomRules(), minutes: 4 })).toBe(false);
  expect(ctx.isRoomRules({ ...ctx.roomRules(), strength: 3 })).toBe(false);
  expect(ctx.isRoomRules(null)).toBe(false);
  ctx.track.stage = 5;
  ctx.setUpRaceTogether();
  expect(ctx.raceSetup.aiStage).toBe(5);
  ctx.raceSetup.rules = { ...ctx.roomRules(), strength: ctx.STRENGTH.easy };
  ctx.setUpRaceTogether();
  expect(ctx.raceSetup.aiStage).toBe(1);
  ctx.raceSetup.rules = { ...ctx.roomRules(), strength: ctx.STRENGTH.hard };
  ctx.setUpRaceTogether();
  expect(ctx.raceSetup.aiStage).toBe(ctx.LAST_STAGE);
  // (a race of another kind has none)
  ctx.chooseRaceKind(ctx.RACE_KIND.quickRace);
  expect(ctx.raceSetup.rules).toEqual(ctx.roomRules());
});

test("in a room's race the HUD tells who wasted whom, bots too, by the players' names", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  reset = () => {
    ctx.game.humans = [];
    ctx.setRoomCars([], []);
    ctx.clearFeed();
  };
  for (let i = 0; i < 3; i++) {
    step();
  }
  // bot 3 driving into bot 2: whether bot 2 knows who hit it
  const start = ctx.saveRace();
  const hitBy = () => {
    ctx.restoreRace(start);
    ctx.racers[2].lastHitBy = null;
    ctx.car[3].x = ctx.car[2].x + 5;
    ctx.car[3].z = ctx.car[2].z;
    ctx.racers[3].speed = 40;
    ctx.drive();
    return ctx.racers[2].lastHitBy;
  };
  // (alone, as the original: only the player's hits count)
  expect(hitBy()).toBe(null);
  ctx.game.humans = [0, 1];
  expect(hitBy()).toBe(3);

  ctx.setRoomCars(
    ["Anna", "Ben", null, null, null, null, null],
    Array(7).fill(0),
  );
  ctx.track.dested[2] = 2;
  expect(ctx.wastedBy(2)).toBe(3);
  expect(ctx.wreckText(3, 2)).toBe("Bot 2 wasted Bot 1");
  expect(ctx.wreckText(0, 1)).toBe("You wasted Ben");
  expect(ctx.wreckText(1, 0)).toBe("Ben wasted you");
  // (on its own, or hit too long before)
  ctx.track.dested[2] = 1;
  expect(ctx.wastedBy(2)).toBe(-1);
  expect(ctx.wreckText(-1, 2)).toBe("Bot 1 has been wasted");
  ctx.noteWreck(1, 0);
  expect(ctx.feed.at(-1)).toMatchObject({ text: "Ben wasted you", mine: true });
});
