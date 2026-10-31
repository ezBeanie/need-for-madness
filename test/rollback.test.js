import { expect, test } from "vitest";
import { PHASE } from "../src/core/state.js";
import { loadGame, seededRandom } from "./harness/loadGame.js";

const FRAMES = 1500;
// how many frames late the other's keys come where they are guessed
const LATE = 5;

// the other's keys of each frame: held a while, then others (a while that the frames
// fingerprinted, every SYNC_EVERY, fall in the frames computed again now and then)
const otherKeys = () => {
  const random = seededRandom(9);
  const keys = [];
  let held;
  for (let frame = 0; frame <= FRAMES; frame++) {
    if (frame % 7 == 0) {
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

// The fixed race (see net/determinism.js) raced together, in the game of the player of
// car 0, the other's keys coming late frames after they were pressed: the fingerprints it
// sent, and, every key there and the race run on one frame, the race and its recordings.
const raceWithKeysLate = async (late) => {
  const { ctx, stepUntil } = await loadGame({ seed: 5 });
  stepUntil(() => ctx.game.phase === PHASE.mainMenu, 400, "main menu");
  ctx.startFingerprintRace();
  stepUntil(() => ctx.game.phase === PHASE.stageSelect, 400, "stage select");
  ctx.beginFingerprintRace();
  // (the two white frames it flashes in with, which set it up)
  ctx.runTick();
  ctx.runTick();
  // (racing together, the wreck's random numbers are apart from the effects', see host.js)
  ctx.random.wreck = seededRandom(3);
  ctx.game.humans = [0, 1];
  const sent = [];
  ctx.link.send = (message) => sent.push(message);
  ctx.startLockstep(0, 1, null);
  const keys = otherKeys();
  const press = (frame) =>
    ctx.receiveKeys({ frame: frame + ctx.INPUT_DELAY, keys: keys[frame] });
  for (let frame = 0; frame < FRAMES; frame++) {
    if (frame >= late) {
      press(frame - late);
    }
    ctx.fingerprintRaceTick(ctx.runTick);
  }
  for (let frame = FRAMES - late; frame < FRAMES; frame++) {
    press(frame);
  }
  ctx.fingerprintRaceTick(ctx.runTick);
  expect(ctx.lockstep.frame).toBe(FRAMES + 1);
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

test("a game guessing the other's keys wrong goes back and races on as with them from the start", async () => {
  const onTime = await raceWithKeysLate(0);
  const late = await raceWithKeysLate(LATE);
  expect(onTime.prints.length).toBe(Math.ceil((FRAMES + 1) / 30));
  expect(late.prints).toEqual(onTime.prints);
  expect(late.race).toEqual(onTime.race);
  expect(late.recording).toEqual(onTime.recording);
  expect(late.raceTape).toEqual(onTime.raceTape);
}, 60000);
