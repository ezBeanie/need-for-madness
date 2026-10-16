import { describe, test } from "vitest";
import { expectMatchesGolden } from "../harness/golden.js";
import { NO_INPUT, racingAutopilot, recordFlow } from "../harness/race.js";

const ENTER = 13;
const REWIND = 82;

// Presses a key for one frame: down now, up on the next frame.
const keyTapper = () => {
  let pressed = null;
  return {
    tap: (game, keyCode) => {
      game.key(keyCode, true);
      pressed = keyCode;
    },
    releaseAfterFrame: (game) => {
      if (pressed !== null) {
        game.key(pressed, false);
        pressed = null;
      }
    },
  };
};

// The racing autopilot wins stage 1. Afterwards Enter is pressed now and then, which
// walks through the highlight replay, the results, the main menu, car and stage select
// (stage 2 is unlocked now), the start of the next race and its pause menu.
const finishAndPlayOn = () => {
  const drive = racingAutopilot();
  const keys = keyTapper();
  let finishedAt = null;
  return (ctx, frame, game) => {
    keys.releaseAfterFrame(game);
    if (finishedAt === null) {
      Object.assign(ctx.racers[0].u, drive(ctx));
      if (ctx.holdcnt) {
        finishedAt = frame;
        Object.assign(ctx.racers[0].u, NO_INPUT);
      }
      return;
    }
    const since = frame - finishedAt;
    if (since === 60 || since % 400 === 399) {
      keys.tap(game, ENTER);
    }
  };
};

// Drives for a while, then does what an action of the player starts.
const driveThen = (afterFrames, action) => {
  const drive = racingAutopilot();
  const keys = keyTapper();
  return (ctx, frame, game) => {
    keys.releaseAfterFrame(game);
    if (frame < afterFrames) {
      Object.assign(ctx.racers[0].u, drive(ctx));
    } else if (frame === afterFrames) {
      Object.assign(ctx.racers[0].u, NO_INPUT);
      action(ctx, game, keys);
    }
  };
};

const flows = [
  {
    name: "finish-and-play-on-stage-01",
    stage: 1,
    frames: 5500,
    script: finishAndPlayOn,
  },
  {
    // what the "Instant Replay" button of the pause menu calls
    name: "instant-replay-stage-02",
    stage: 2,
    frames: 1700,
    script: () => driveThen(900, (ctx) => ctx.rewindreplay()),
  },
  {
    name: "rewind-time-stage-02",
    stage: 2,
    frames: 1500,
    script: () => driveThen(900, (ctx, game, keys) => keys.tap(game, REWIND)),
  },
];

describe("game flows match the golden master", () => {
  test.each(flows)("$name", async ({ name, stage, frames, script }) => {
    const car = 15;
    const recording = await recordFlow({
      stage,
      car,
      seed: stage,
      frames,
      script: script(),
    });
    expectMatchesGolden(name, { stage, car }, recording);
  });
});
