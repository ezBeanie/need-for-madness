import { describe, test } from "vitest";
import { PHASE } from "../../src/core/state.js";
import {
  expectDrawingMatchesGolden,
  expectMatchesGolden,
} from "../harness/golden.js";
import { NO_INPUT, racingAutopilot, recordFlow } from "../harness/race.js";

const ENTER = 13;
const UP = 38;
const DOWN = 40;
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
      if (ctx.raceEvents.raceOverTicks) {
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

// Every entry of the pause menu: pauses and resumes, asks for an instant replay too early,
// pages through the instructions and back, then quits to the main menu.
const pauseMenuTour = () => {
  const drive = racingAutopilot();
  const keys = keyTapper();
  const taps = {
    200: ENTER,
    230: ENTER,
    400: ENTER,
    420: DOWN,
    440: ENTER,
    460: UP,
    470: UP,
    480: DOWN,
    490: DOWN,
    500: DOWN,
    520: ENTER,
  };
  let quitting = false;
  return (ctx, frame, game) => {
    keys.releaseAfterFrame(game);
    // no gas while pausing: up and down also move the menu selection
    const driving = frame < 180 || (frame >= 240 && frame < 380);
    if (ctx.game.phase === PHASE.race && driving) {
      Object.assign(ctx.racers[0].u, drive(ctx));
    } else {
      Object.assign(ctx.racers[0].u, NO_INPUT);
    }
    if (taps[frame]) {
      keys.tap(game, taps[frame]);
    } else if (frame > 520 && frame % 40 === 0) {
      if (ctx.game.phase === PHASE.instructions) {
        keys.tap(game, ENTER);
      } else if (ctx.game.phase === PHASE.paused && !quitting) {
        quitting = true;
        keys.tap(game, DOWN);
      } else if (ctx.game.phase === PHASE.paused) {
        keys.tap(game, ENTER);
      }
    }
  };
};

// The touch controls of phones, where they are at 1280x720.
const TOUCH = {
  left: [130, 558],
  right: [320, 598],
  accelerate: [1150, 558],
  brake: [960, 598],
  handbrake: [1183, 384.5],
  arrow: [97, 384.5],
};

// A phone: fingers on the touch controls, steering both ways, the handbrake, the arrow
// button twice, braking, and a while without fingers.
const fingers = () => (ctx, frame) => {
  const on = [];
  if (frame < 1000) {
    on.push(TOUCH.accelerate);
  } else if (frame < 1100) {
    on.push(TOUCH.brake);
  }
  if (frame % 200 < 60) {
    on.push(TOUCH.left);
  } else if (frame % 200 >= 100 && frame % 200 < 160) {
    on.push(TOUCH.right);
  }
  if (frame >= 300 && frame < 330) {
    on.push(TOUCH.handbrake);
  }
  if ((frame >= 500 && frame < 505) || (frame >= 800 && frame < 805)) {
    on.push(TOUCH.arrow);
  }
  if (frame >= 1200 && frame < 1250) {
    on.length = 0;
  }
  ctx.pointer.down = on.length > 0;
  ctx.pointer.count = on.length;
  on.forEach(([x, y], i) => {
    ctx.pointer.x[i] = x;
    ctx.pointer.y[i] = y;
  });
};

// Wins stage 1 like finishAndPlayOn, but shows the given highlight afterwards, turning
// to car 1.
const highlightAfterWin = (highlight) => () => {
  const play = finishAndPlayOn();
  let forced = false;
  return (ctx, frame, game) => {
    if (!forced && ctx.raceEvents.raceOverTicks) {
      forced = true;
      Object.assign(ctx.recording, {
        highlight,
        otherCar: 1,
        highlightAt: 300,
      });
    }
    play(ctx, frame, game);
  };
};

const flows = [
  ...[2, 3, 4, 5].map((highlight) => ({
    name: `highlight-${highlight}-stage-01`,
    stage: 1,
    frames: 2600,
    script: highlightAfterWin(highlight),
  })),
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
    // switch mode: when its timer runs out, the switch screen picks the next car to drive
    name: "switch-mode-stage-04",
    stage: 4,
    frames: 1700,
    script: () => {
      const drive = racingAutopilot();
      return (ctx) => {
        ctx.game.mode = 1;
        Object.assign(ctx.racers[ctx.game.player].u, drive(ctx));
      };
    },
  },
  {
    name: "touch-controls-stage-03",
    stage: 3,
    frames: 1400,
    script: fingers,
    userAgent: "iPhone",
  },
  {
    name: "pause-menu-stage-02",
    stage: 2,
    frames: 1600,
    script: pauseMenuTour,
  },
  {
    name: "rewind-time-stage-02",
    stage: 2,
    frames: 1500,
    script: () => driveThen(900, (ctx, game, keys) => keys.tap(game, REWIND)),
  },
];

describe("game flows match the golden master", () => {
  test.each(flows)(
    "$name",
    async ({ name, stage, frames, script, userAgent }) => {
      const car = 15;
      const recording = await recordFlow({
        stage,
        car,
        seed: stage,
        frames,
        script: script(),
        userAgent,
      });
      expectMatchesGolden(name, { stage, car }, recording);
      expectDrawingMatchesGolden(name, recording);
    },
  );
});
