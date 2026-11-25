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

test("in a room's time attack and racing only the cars pass through each other", async () => {
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
  for (const mode of [ctx.RACE_MODE.timeAttack, ctx.RACE_MODE.onlyRacing]) {
    expect(car0After(mode, true)).toEqual(car0After(mode, false));
  }
});

test("a room's time attack laps for the room's minutes, the fastest lap first, and ends once the time is up and every car through", async () => {
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
  ctx.raceSetup.rules.minutes = 1;
  expect(ctx.isLapSession()).toBe(true);
  expect(ctx.isDeathmatch()).toBe(true);
  ctx.startTimeAttack();
  ctx.deathmatch.ticks = 0;
  ctx.track.haltall = false;
  const nsp = ctx.track.nsp;
  // car 1 laps faster than car 0; the others never get round
  const lapOf = { 0: 400, 1: 300 };
  for (let t = 1; t <= ctx.deathmatchTicks() + 400; t++) {
    for (let c = 0; c < ctx.game.carCount; c++) {
      ctx.racers[c].wasted = false;
      ctx.racers[c].clear = lapOf[c] ? Math.floor((t * nsp) / lapOf[c]) : 0;
    }
    ctx.lapTick(ctx.game.carCount);
    ctx.deathmatch.ticks++;
    ctx.updateStandings();
  }
  const table = ctx.lapTable(ctx.game.carCount);
  expect(table.slice(0, 2).map(({ c }) => c)).toEqual([1, 0]);
  expect(table[0].best).toBeCloseTo(300, 0);
  expect(table[2].best).toBe(0);
  // a checkpoint of car 0 told against car 1's fastest lap: slower
  expect(ctx.laps.marks[0].field).toBeGreaterThan(0);
  // the time up, the two through; the others still drive their first laps
  expect(ctx.laps.through[0]).toBe(true);
  expect(ctx.laps.through[1]).toBe(true);
  expect(ctx.track.haltall).toBe(false);
  // the others' laps counting for nothing, they are through too, and it is over
  for (let c = 2; c < ctx.game.carCount; c++) {
    ctx.racers[c].wasted = true;
  }
  ctx.lapTick(ctx.game.carCount);
  ctx.updateStandings();
  expect(ctx.track.haltall).toBe(true);

  // the times go with the race's state
  const saved = ctx.saveRace();
  expect(ctx.isLapsState(saved.laps)).toBe(true);
  expect(ctx.isRaceState(saved, ctx.game.carCount)).toBe(true);
  const best = ctx.laps.best.slice();
  ctx.laps.best[1] = 5;
  ctx.restoreRace(saved);
  expect(ctx.laps.best).toEqual(best);
  expect(ctx.isLapsState({ ...saved.laps, best: ["fast"] })).toBe(false);
});

test("in a room's time attack a car through stops while its player watches, heard by all", async () => {
  const { ctx, step } = await startRace({ stage: 1, car: 5 });
  reset = () => {
    ctx.raceSetup.mode = ctx.RACE_MODE.normal;
    ctx.game.humans = [];
  };
  const { outOfTheRace, spectating } = await import("../src/race/spectate.js");
  for (let i = 0; i < 3; i++) {
    step();
  }
  ctx.game.humans = [0, 1];
  // (a normal room race has no laps of time attack)
  expect(ctx.isLapSession()).toBe(false);
  ctx.raceSetup.mode = ctx.RACE_MODE.timeAttack;
  ctx.startTimeAttack();
  expect(ctx.throughTheRace(0)).toBe(false);
  expect(spectating()).toBe(false);
  ctx.laps.through[0] = true;
  expect(ctx.throughTheRace(0)).toBe(true);
  expect(spectating()).toBe(true);
  expect(outOfTheRace(0)).toBe(true);
  expect(outOfTheRace(1)).toBe(false);
  ctx.racers[0].u.up = true;
  ctx.drive();
  expect(ctx.racers[0].u.up).toBe(false);
});

test("in a room's time attack and racing only the other cars are seen through once racing, the more the nearer they come", async () => {
  const { ctx } = await startRace({ stage: 1, car: 5 });
  reset = () => {
    ctx.raceSetup.mode = ctx.RACE_MODE.normal;
    ctx.game.humans = [];
  };
  ctx.game.humans = [0, 1];
  ctx.raceEvents.countdown = 0;
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
  ctx.raceSetup.mode = ctx.RACE_MODE.onlyRacing;
  expect(showsAt(10)).toBe(0.25);
  // (all of every car while the countdown runs)
  ctx.raceEvents.countdown = 30;
  expect(showsAt(10)).toBe(1);
  ctx.raceEvents.countdown = 0;
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

test("in stunts the cars pass through each other, landed stunts score their power, landings on the roof and wastings cost points", async () => {
  const { ctx } = await mostKills();
  ctx.raceSetup.mode = ctx.RACE_MODE.stunts;
  ctx.startDeathmatch();
  const { carsCrash } = await import("../src/net/roomCars.js");
  const { noteStunt, CRASH_LANDING_POINTS, WASTED_POINTS } = await import(
    "../src/race/deathmatch.js"
  );
  expect(carsCrash(0, 1)).toBe(false);

  noteStunt(0, 123.6);
  noteStunt(0, 0);
  expect(ctx.deathmatch.points[0]).toBe(124);
  expect(ctx.deathmatch.stunts[0]).toBe(1);

  // car 0 coming down on its roof, a stunt still counting
  ctx.racers[0].roll = 180;
  ctx.car[0].y = ctx.car[0].grat + 30;
  ctx.racers[0].countingStunt = 3;
  for (let i = 0; i < 60 && ctx.deathmatch.crashes[0] == 0; i++) {
    ctx.drive();
  }
  expect(ctx.deathmatch.crashes[0]).toBe(1);
  expect(ctx.deathmatch.points[0]).toBe(124 - CRASH_LANDING_POINTS);

  // car 1 wasted, hit by bot 2: no kill, points lost, back after a while
  ctx.racers[1].lastHitBy = 2;
  ctx.racers[1].damage = 100000;
  for (let i = 0; i < 200 && !ctx.racers[1].wasted; i++) {
    ctx.drive();
    ctx.racers[1].lastcolido = 70;
  }
  expect(ctx.racers[1].wasted).toBe(true);
  expect(ctx.deathmatch.kills[2]).toBe(0);
  expect(ctx.deathmatch.points[1]).toBe(-WASTED_POINTS);
  expect(ctx.deathmatch.deaths[1]).toBe(1);
  expect(ctx.killTable()[0]).toMatchObject({ c: 0, score: 74 });

  // (the points go with the race's state)
  const saved = ctx.saveRace();
  expect(ctx.isRaceState(saved, ctx.game.carCount)).toBe(true);
  ctx.deathmatch.points[0] = 0;
  ctx.restoreRace(saved);
  expect(ctx.deathmatch.points[0]).toBe(74);
  for (let i = 0; i < ctx.respawnTicks(); i++) {
    ctx.drive();
  }
  expect(ctx.racers[1].wasted).toBe(false);
  // (the HUD's standing, and once the time is up its results)
  expect(() => ctx.drawHud()).not.toThrow();
  ctx.deathmatch.ticks = ctx.deathmatchTicks();
  ctx.updateStandings();
  expect(ctx.track.haltall).toBe(true);
  expect(() => ctx.drawHud()).not.toThrow();
});

test("in gun game a kill gets the car the next of the ladder a moment later, driving on, and a kill in the last one wins", async () => {
  const { ctx } = await mostKills();
  ctx.raceSetup.mode = ctx.RACE_MODE.gunGame;
  ctx.startDeathmatch();
  const { GUN_LADDER } = await import("../src/race/deathmatch.js");
  // car 1, hit by bot 2, wasted
  ctx.racers[1].lastHitBy = 2;
  ctx.racers[1].damage = 100000;
  for (let i = 0; i < 200 && !ctx.racers[1].wasted; i++) {
    ctx.drive();
    ctx.racers[1].lastcolido = 70;
  }
  expect(ctx.deathmatch.kills[2]).toBe(1);
  const before = ctx.saveRace();
  const body = ctx.racers[2].body;
  ctx.racers[2].speed = 50;
  for (let i = 0; i < 60 && ctx.car[2].typ != GUN_LADDER[1]; i++) {
    ctx.drive();
  }
  expect(ctx.car[2].typ).toBe(GUN_LADDER[1]);
  expect(ctx.game.carTypes[2]).toBe(GUN_LADDER[1]);
  expect(ctx.racers[2].body).not.toBe(body);
  expect(ctx.racers[2].speed).not.toBe(0);
  // (the wasted car comes back in the ladder's first)
  for (let i = 0; i < ctx.respawnTicks() && ctx.racers[1].wasted; i++) {
    ctx.drive();
  }
  expect(ctx.racers[1].wasted).toBe(false);
  expect(ctx.car[1].typ).toBe(GUN_LADDER[0]);

  // wound back to before it changed, the car is the one it was
  ctx.restoreRace(before);
  expect(ctx.car[2].typ).not.toBe(GUN_LADDER[1]);
  expect(ctx.isRaceState(ctx.saveRace(), ctx.game.carCount)).toBe(true);

  // the last kill
  ctx.deathmatch.kills[2] = GUN_LADDER.length - 1;
  ctx.racers[3].lastHitBy = 2;
  ctx.racers[3].damage = 100000;
  ctx.track.haltall = false;
  for (let i = 0; i < 200 && !ctx.racers[3].wasted; i++) {
    ctx.drive();
    ctx.racers[3].lastcolido = 70;
  }
  ctx.updateStandings();
  expect(ctx.track.haltall).toBe(true);
  expect(ctx.killTable()[0].c).toBe(2);
  // (the HUD's results of it)
  expect(() => ctx.drawHud()).not.toThrow();
});

test("a room's bots keep the names of the cars the lobby gave them, whatever they race in", async () => {
  const { ctx } = await mostKills();
  const { setRoomCars, nameOfCar } = await import("../src/net/roomCars.js");
  setRoomCars(["Ann", null, null], [0, 0, 0], [], [5, 17, 17]);
  ctx.game.carTypes[1] = 0;
  ctx.game.carTypes[2] = 0;
  expect([nameOfCar(1), nameOfCar(2)]).toEqual([
    "Radical One 1",
    "Radical One 2",
  ]);
  // (in gun game, whose cars change, by their order)
  ctx.raceSetup.mode = ctx.RACE_MODE.gunGame;
  expect([nameOfCar(1), nameOfCar(2)]).toEqual(["Bot 1", "Bot 2"]);
  setRoomCars([], [], []);
});

test("a room's race the host starts with bots alone is of its mode: in gun game the wasted come back", async () => {
  const { ctx } = await mostKills();
  ctx.game.humans = [];
  ctx.raceSetup.kind = ctx.RACE_KIND.together;
  ctx.raceSetup.mode = ctx.RACE_MODE.gunGame;
  const deathmatch = await import("../src/race/deathmatch.js");
  expect(deathmatch.isGunGame()).toBe(true);
  ctx.startDeathmatch();
  ctx.racers[1].lastHitBy = 2;
  ctx.racers[1].damage = 100000;
  for (let i = 0; i < 200 && !ctx.racers[1].wasted; i++) {
    ctx.drive();
    ctx.racers[1].lastcolido = 70;
  }
  expect(ctx.racers[1].wasted).toBe(true);
  expect(ctx.deathmatch.kills[2]).toBe(1);
  for (let i = 0; i < ctx.respawnTicks() && ctx.racers[1].wasted; i++) {
    ctx.drive();
  }
  expect(ctx.racers[1].wasted).toBe(false);
  // (and it ends as gun game does, not when the player is wasted)
  ctx.updateStandings();
  expect(ctx.track.haltall).toBe(false);
  ctx.raceSetup.kind = ctx.RACE_KIND.campaign;
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
  expect(ctx.wreckText(3, 2)).toBe("Radical One wasted Kool Kat");
  expect(ctx.wreckText(0, 1)).toBe("You wasted Ben");
  expect(ctx.wreckText(1, 0)).toBe("Ben wasted you");
  // (on its own, or hit too long before)
  ctx.track.dested[2] = 1;
  expect(ctx.wastedBy(2)).toBe(-1);
  expect(ctx.wreckText(-1, 2)).toBe("Kool Kat has been wasted");
  ctx.noteWreck(1, 0);
  expect(ctx.feed.at(-1)).toMatchObject({ text: "Ben wasted you", mine: true });
});

test("a wreck burning on but not wasted is wasted, in a room's race and alone", async () => {
  const { ctx } = await mostKills();
  // car 1 burnt out, yet driving
  const burningOn = () => {
    ctx.racers[1].damage = 100000;
    ctx.racers[1].cntdest = 9;
    ctx.racers[1].wasted = false;
    ctx.drive();
    return ctx.racers[1].wasted;
  };
  // (a race alone as the original's: as the original)
  ctx.game.humans = [];
  expect(burningOn()).toBe(false);
  ctx.game.humans = [0, 1];
  expect(burningOn()).toBe(true);
  expect(ctx.deathmatch.deaths[1]).toBe(1);
  // (alone with the fixes: as in a room)
  ctx.game.humans = [];
  ctx.physics.asOriginal = false;
  try {
    expect(burningOn()).toBe(true);
  } finally {
    ctx.physics.asOriginal = true;
  }
});

test("a car hit again and again at one corner keeps taking damage, in a room's race and alone", async () => {
  const { ctx } = await mostKills();
  // the damage of a hit after a hundred at the same corner
  const lastHit = () => {
    ctx.fixcar(1);
    for (let i = 0; i < 100; i++) {
      ctx.regn(ctx.HIT.alongZ, 0, 60, 1);
    }
    const before = ctx.racers[1].damage;
    ctx.regn(ctx.HIT.alongZ, 0, 60, 1);
    return ctx.racers[1].damage - before;
  };
  // (a race alone as the original's: the corner's vertices are out of the hits' reach)
  ctx.game.humans = [];
  expect(lastHit()).toBe(0);
  ctx.game.humans = [0, 1];
  expect(lastHit()).toBeGreaterThan(20);
  // (alone with the fixes: as in a room)
  ctx.game.humans = [];
  ctx.physics.asOriginal = false;
  try {
    expect(lastHit()).toBeGreaterThan(20);
  } finally {
    ctx.physics.asOriginal = true;
  }
});

test("in most kills the race tape has every wasting of a car and its coming back, as the replay shows it", async () => {
  const { ctx, step } = await mostKills();
  const tape = () => ctx.raceTape.cars[1];
  const wreck = () => {
    ctx.racers[1].lastcolido = 70;
    ctx.racers[1].lastHitBy = 2;
    ctx.racers[1].damage = 100000;
  };
  wreck();
  for (let i = 0; i < 300 && tape().backs.length < 1; i++) {
    step();
  }
  for (let i = 0; i < 20; i++) {
    step();
  }
  wreck();
  for (let i = 0; i < 300 && tape().wastes.length < 2; i++) {
    step();
  }
  const [first, second] = tape().wastes;
  const [back] = tape().backs;
  expect(first < back && back < second).toBe(true);
  expect(ctx.wastedSince(tape(), first + 1)).toBe(first);
  expect(ctx.wastedSince(tape(), back)).toBe(Infinity);
  expect(ctx.wastedSince(tape(), second)).toBe(second);
  // the replay shows the wreck burning, then whole again, then burning
  ctx.openReplay(ctx.VIEWER_FROM.pauseMenu, first + 20);
  expect(ctx.racers[1].destnow).toBe(true);
  ctx.seekReplay(back + 2);
  expect(ctx.racers[1].destnow).toBe(false);
  ctx.seekReplay(second + 1);
  expect(ctx.racers[1].destnow).toBe(true);
  // (and played on, as well)
  ctx.seekReplay(back - 3);
  for (let i = 0; i < 50 && ctx.viewer.frame < back + 2; i++) {
    step();
  }
  expect(ctx.racers[1].destnow).toBe(false);
  ctx.closeReplay();
});

test("in most kills the highlight is a car the player wasted, caught before it comes back, and kept over the player's own wreck", async () => {
  const { ctx, step } = await mostKills();
  const HIGHLIGHT = { wasted: 2, wastedThemAll: 3 };
  for (let i = 0; i < 440; i++) {
    step();
  }
  // wasted by car 2, then by the player, then the player's own car wasted
  const wreck = (c, by) => {
    ctx.fixcar(c);
    ctx.racers[c].lastcolido = 70;
    ctx.racers[c].lastHitBy = by;
    ctx.racers[c].damage = 100000;
    for (let i = 0; i < 20 + ctx.respawnTicks(); i++) {
      ctx.racers[c].lastcolido = 70;
      step();
    }
  };
  wreck(1, 2);
  expect(ctx.recording.highlight).toBe(0);
  wreck(3, 0);
  expect(ctx.recording.highlight).toBe(HIGHLIGHT.wastedThemAll);
  expect(ctx.recording.otherCar).toBe(3);
  wreck(0, 1);
  expect(ctx.recording.highlight).toBe(HIGHLIGHT.wastedThemAll);
});

test("in most kills a car that hit another not long before someone else wasted it helped, and each car's damage dealt counts", async () => {
  const { ctx } = await mostKills();
  // car 3 crashes into car 1, car 2 wastes it a moment later
  ctx.fixcar(3);
  ctx.noteHit(1, 3, 0.25);
  ctx.noteHit(1, 2, 0.5);
  expect(ctx.deathmatch.dealt[3]).toBe(0.25);
  expect(ctx.deathmatch.dealt[2]).toBe(0.5);
  ctx.racers[1].lastcolido = 70;
  ctx.racers[1].lastHitBy = 2;
  ctx.noteWasted(1);
  expect(ctx.deathmatch.kills[2]).toBe(1);
  expect(ctx.deathmatch.assists[3]).toBe(1);
  expect(ctx.deathmatch.assists[2]).toBe(0);
  // a hit long before helps no more, and one before the last wasting not again
  ctx.noteHit(1, 4, 0.1);
  ctx.deathmatch.ticks += ctx.ASSIST_TICKS + 1;
  ctx.noteWasted(1);
  expect(ctx.deathmatch.assists[4]).toBe(0);
  expect(ctx.deathmatch.assists[3]).toBe(1);
  // and it goes with the race's state
  expect(ctx.isDeathmatchState(ctx.saveRace().deathmatch)).toBe(true);
  expect(ctx.saveRace().deathmatch.assists[3]).toBe(1);
});

test("in most kills the crashes count the damage each car does the others", async () => {
  const { ctx } = await mostKills();
  const before = reset;
  reset = () => {
    before();
    ctx.raceSetup.rules = ctx.roomRules();
  };
  // (hard bots hunt each other)
  ctx.raceSetup.rules = { ...ctx.roomRules(), strength: ctx.STRENGTH.hard };
  for (let i = 0; i < 1500; i++) {
    ctx.control();
    ctx.drive();
  }
  const dealt = ctx.deathmatch.dealt.slice(0, ctx.game.carCount);
  const taken = ctx.racers
    .slice(0, ctx.game.carCount)
    .map((racer, c) => racer.damage / ctx.carStats.maxmag[ctx.car[c].typ]);
  expect(dealt.some((d) => d > 0)).toBe(true);
  // (no more than the cars took, wrecks repaired as they came back)
  const sum = (list) => list.reduce((a, b) => a + b, 0);
  expect(sum(dealt)).toBeGreaterThan(0);
  expect(sum(dealt)).toBeLessThanOrEqual(
    sum(taken) + sum(ctx.deathmatch.deaths) * 2,
  );
});

test("most kills' results show each car's kills, assists, damage dealt and wastings", async () => {
  const { ctx } = await mostKills();
  expect(ctx.KILL_HEADS).toEqual([
    "",
    "",
    "Kills",
    "Assists",
    "Damage",
    "Wasted",
  ]);
  const row = ctx.killRow(
    { c: 1, kills: 3, assists: 2, dealt: 1.456, deaths: 4 },
    0,
  );
  expect(row.cells.slice(2)).toEqual(["3", "2", "146%", "4"]);
  expect(row.line).toContain("2 assists, 146% damage");
});

test("racing together, a guest finishing just ahead of another car catches the close finish", async () => {
  const { ctx, step } = await startRace({ stage: 3, car: 5 });
  reset = () => {
    ctx.game.humans = [];
    ctx.game.player = 0;
    ctx.track.haltall = false;
  };
  for (let i = 0; i < 3; i++) {
    step();
  }
  // the guest's car 1 through, the host's car 0 right behind it, a lap less
  ctx.game.humans = [0, 1];
  ctx.game.player = 1;
  const done = ctx.track.nlaps * ctx.track.nsp;
  ctx.racers[1].clear = done;
  ctx.racers[0].clear = done - 1;
  ctx.car[0].x = ctx.car[1].x + 30;
  ctx.car[0].z = ctx.car[1].z;
  ctx.recording.finishCatchTicks = 0;
  ctx.updateStandings();
  expect(ctx.recording.finishCatchTicks).toBeGreaterThan(0);
});
