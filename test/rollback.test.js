import { expect, test } from "vitest";
import { PHASE } from "../src/core/state.js";
import { loadGame, seededRandom } from "./harness/loadGame.js";

const FRAMES = 1500;
// how many frames late each other player's keys come where they are guessed, by car
const ON_TIME = { 1: 0, 2: 0 };
const LATE = { 1: 5, 2: 2 };

// another player's keys of each frame: held a while, then others (a while that the frames
// fingerprinted, every SYNC_EVERY, fall in the frames computed again now and then, and
// that differs by player, so that one's guess goes wrong while another's is still open)
const otherKeys = (car) => {
  const random = seededRandom(9 + car);
  const keys = [];
  let held;
  for (let frame = 0; frame <= FRAMES; frame++) {
    if (frame % (5 + car) == 0) {
      held = {
        up: random() > 0.2,
        down: random() > 0.8,
        left: random() > 0.6,
        right: random() > 0.6,
        handb: random() > 0.9,
      };
    }
    keys.push(held);
  }
  return keys;
};

const PLAYERS = ["host0000", "guest001", "guest002"];
// the player who leaves the race, and the frame it leaves the keys of
const LEAVING = { car: 1, frame: 900 };

// The fixed race (see net/determinism.js) raced together by three, in the game of the
// player of car 0 (who got as far as the stage unlocked, if given), each other's keys coming late[car] frames after they were pressed (and
// the leaving player's left as late after its last keys): the fingerprints it sent, and,
// every key there and the race run on one frame, the race and its recordings.
const raceWithKeysLate = async (late, leaving = null, unlocked = null) => {
  const { ctx, stepUntil } = await loadGame({ seed: 5 });
  stepUntil(() => ctx.game.phase === PHASE.mainMenu, 400, "main menu");
  ctx.startFingerprintRace();
  stepUntil(() => ctx.game.phase === PHASE.stageSelect, 400, "stage select");
  // (after the field is drawn: racing together, the host's comes to every game)
  if (unlocked) {
    ctx.game.unlocked = unlocked;
  }
  ctx.beginFingerprintRace();
  // (the two white frames it flashes in with, which set it up)
  ctx.runTick();
  ctx.runTick();
  // (racing together, the wreck's random numbers are apart from the effects', see host.js)
  ctx.random.wreck = seededRandom(3);
  // (and the help for new players off, which the HUD counts down, see host.js)
  ctx.raceEvents.onautocorrect = 0;
  ctx.game.humans = [0, 1, 2];
  const sent = [];
  ctx.link.send = (message) => sent.push(message);
  ctx.startLockstep(0, PLAYERS, 0, null);
  const others = Object.keys(late).map(Number);
  const keys = Object.fromEntries(others.map((car) => [car, otherKeys(car)]));
  const press = (car, frame) =>
    car == leaving?.car && frame >= leaving.frame
      ? frame == leaving.frame &&
        ctx.receiveRaceMessage({
          type: "left",
          from: PLAYERS[car],
          raceId: 0,
          frame: frame + ctx.INPUT_DELAY,
        })
      : ctx.receiveRaceMessage({
          type: "keys",
          from: PLAYERS[car],
          raceId: 0,
          frame: frame + ctx.INPUT_DELAY,
          keys: keys[car][frame],
        });
  for (let frame = 0; frame < FRAMES; frame++) {
    for (const car of others) {
      if (frame >= late[car]) {
        press(car, frame - late[car]);
      }
    }
    ctx.fingerprintRaceTick(ctx.runTick);
  }
  for (const car of others) {
    for (let frame = FRAMES - late[car]; frame < FRAMES; frame++) {
      press(car, frame);
    }
  }
  ctx.fingerprintRaceTick(ctx.runTick);
  expect(ctx.lockstep.frame).toBe(FRAMES + 1);
  expect(ctx.game.humans).toEqual(leaving ? [0, 2] : [0, 1, 2]);
  // (but for the dust, sparks and skids, thrown and heard at random by every game its own
  // way, see random.fx)
  const withoutDust = (tape) =>
    ctx.encode({
      ...tape,
      sparks: null,
      cars: tape.cars.map((carTape) =>
        Object.fromEntries(
          Object.entries(carTape).filter(
            ([field]) =>
              !field.startsWith("dust") && !field.startsWith("sound"),
          ),
        ),
      ),
    });
  return {
    prints: sent.filter((message) => message.type == "sync"),
    race: ctx.encode(ctx.sharedRace()),
    recording: ctx.encode({
      ...ctx.recording,
      tape: withoutDust(ctx.recording.tape),
      highlightTape: withoutDust(ctx.recording.highlightTape),
    }),
    raceTape: withoutDust(ctx.raceTape),
  };
};

test("a game guessing others' keys wrong goes back and races on as with them from the start", async () => {
  const onTime = await raceWithKeysLate(ON_TIME);
  const late = await raceWithKeysLate(LATE);
  expect(onTime.prints.length).toBe(Math.ceil((FRAMES + 1) / 30));
  expect(late.prints).toEqual(onTime.prints);
  expect(late.race).toEqual(onTime.race);
  expect(late.recording).toEqual(onTime.recording);
  expect(late.raceTape).toEqual(onTime.raceTape);
}, 60000);

test("a player leaving the race leaves its car to the AI from the frame after its last keys, in a game told late as in one told at once", async () => {
  const onTime = await raceWithKeysLate(ON_TIME, LEAVING);
  const late = await raceWithKeysLate(LATE, LEAVING);
  expect(late.prints).toEqual(onTime.prints);
  expect(late.race).toEqual(onTime.race);
  expect(late.raceTape).toEqual(onTime.raceTape);
}, 60000);

test("a game whose player races the newest stage it has races it as one whose player got further", async () => {
  const further = await raceWithKeysLate(ON_TIME);
  // (the fixed race's stage is the first)
  const newest = await raceWithKeysLate(ON_TIME, null, 1);
  expect(newest.prints).toEqual(further.prints);
  expect(newest.race).toEqual(further.race);
}, 60000);
