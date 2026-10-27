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
const LEFT = 37;
const RIGHT = 39;
const RACE_CARS = 67;
const NEXT_CAMERA = 86;
const LOOK_BACK_LEFT = 90;
const LOOK_BACK_RIGHT = 88;
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

// Every entry of the pause menu: pauses and resumes, opens the instant replay (up and down
// change its speed there, Enter closes it), pages through the instructions and back, then
// quits to the main menu.
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
    490: ENTER,
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

// Clicks with the mouse at 1280x720: the button is held for three frames, then released.
const CLICK_FRAMES = 3;

// Every page of the game instructions, opened from the pause menu and from the main menu:
// Enter, the buttons of the coach page, Next, Back, closing with a click beside the
// buttons and with Finish.
const instructionsTour = () => {
  const keys = keyTapper();
  const taps = {
    200: ENTER,
    210: DOWN,
    215: DOWN,
    220: ENTER,
    240: ENTER,
    260: ENTER,
    280: ENTER,
    300: ENTER,
    360: ENTER,
    540: DOWN,
    550: ENTER,
    660: ENTER,
    680: ENTER,
    700: ENTER,
    720: ENTER,
    740: ENTER,
  };
  const clicks = {
    320: [525, 344], // Additional Keyboard Controls
    380: [380, 444], // Music Credits
    420: [1095, 524], // Next to the second page of credits
    460: [315, 589], // Back to the coach
    480: [315, 589], // Back to the controls
    500: [1110, 589], // Next to the coach
    520: [700, 200], // beside the buttons: closes the instructions
    620: [1050, 554], // Game Instructions in the main menu
  };
  let clickedAt = null;
  return (ctx, frame, game) => {
    keys.releaseAfterFrame(game);
    Object.assign(ctx.racers[0].u, NO_INPUT);
    if (taps[frame]) {
      keys.tap(game, taps[frame]);
    }
    if (clicks[frame]) {
      clickedAt = frame;
      [ctx.pointer.x[0], ctx.pointer.y[0]] = clicks[frame];
    }
    ctx.pointer.down = clickedAt !== null && frame - clickedAt < CLICK_FRAMES;
  };
};

// Quits a race to the main menu and watches its intro, opens the reset question (offered
// once the last stage was won), cancels it, resets the game and starts with PLAY.
const mainMenuTour = () => {
  const keys = keyTapper();
  const taps = { 200: ENTER, 210: UP, 220: ENTER };
  const clicks = {
    300: [830, 664], // Reset Game
    340: [340, 589], // Cancel
    380: [830, 664], // Reset Game
    420: [730, 439], // Yes!  Reset my game now
    470: [1130, 655], // PLAY
  };
  let clickedAt = null;
  return (ctx, frame, game) => {
    keys.releaseAfterFrame(game);
    Object.assign(ctx.racers[0].u, NO_INPUT);
    if (frame === 225) {
      ctx.menu.resetOffered = true;
    }
    if (taps[frame]) {
      keys.tap(game, taps[frame]);
    }
    if (clicks[frame]) {
      clickedAt = frame;
      [ctx.pointer.x[0], ctx.pointer.y[0]] = clicks[frame];
    }
    ctx.pointer.down = clickedAt !== null && frame - clickedAt < CLICK_FRAMES;
  };
};

// The car select of a player who has won two stages: cars change with the arrow keys and
// with Prev and Next, locked cars show which stage unlocks them. Then the select of a new
// player: a hand points at the buttons, and Practice starts the first race.
const carSelectTour = () => {
  const keys = keyTapper();
  const taps = {
    200: ENTER,
    210: UP,
    220: ENTER,
    240: ENTER,
    300: RIGHT,
    480: LEFT,
    530: LEFT,
    580: LEFT,
    630: LEFT,
    680: LEFT,
    730: LEFT,
  };
  const clicks = {
    360: [120, 455], // Prev
    420: [1160, 455], // Next
    900: [640, 664], // Practice
  };
  let clickedAt = null;
  return (ctx, frame, game) => {
    keys.releaseAfterFrame(game);
    Object.assign(ctx.racers[0].u, NO_INPUT);
    if (frame === 225) {
      ctx.game.unlocked = 3;
    }
    if (frame === 780) {
      ctx.game.unlocked = 1;
    }
    if (taps[frame]) {
      keys.tap(game, taps[frame]);
    }
    if (clicks[frame]) {
      clickedAt = frame;
      [ctx.pointer.x[0], ctx.pointer.y[0]] = clicks[frame];
    }
    ctx.pointer.down = clickedAt !== null && frame - clickedAt < CLICK_FRAMES;
  };
};

// The stage select of a player who has won three stages: stages change with the arrow
// keys and with Prev and Next, the next locked stage shows a lock, Insano's tip opens and
// closes, the field grows, Back leads to the car select and Practice starts a race.
const stageSelectTour = () => {
  const keys = keyTapper();
  const taps = {
    200: ENTER,
    210: UP,
    220: ENTER,
    240: ENTER,
    300: ENTER,
    420: RIGHT,
    620: RIGHT,
    720: RIGHT,
    900: RACE_CARS,
    1080: ENTER,
    1180: LEFT,
    1280: LEFT,
  };
  const clicks = {
    520: [1090, 384], // Next
    780: [427, 593], // TIP
    860: [1060, 504], // Okay
    920: [190, 384], // Prev
    1020: [210, 158], // Back
    1380: [770, 574], // Practice
  };
  let clickedAt = null;
  return (ctx, frame, game) => {
    keys.releaseAfterFrame(game);
    Object.assign(ctx.racers[0].u, NO_INPUT);
    if (frame === 225) {
      ctx.game.unlocked = 4;
      // car 15 is locked until stage 10
      ctx.game.carTypes[0] = 5;
    }
    if (taps[frame]) {
      keys.tap(game, taps[frame]);
    }
    if (clicks[frame]) {
      clickedAt = frame;
      [ctx.pointer.x[0], ctx.pointer.y[0]] = clicks[frame];
    }
    ctx.pointer.down = clickedAt !== null && frame - clickedAt < CLICK_FRAMES;
  };
};

// Every camera while driving: V orbits the car, then watches from the track side, then
// goes back behind the car; Z and X look back to either side.
const cameraViews = () => {
  const drive = racingAutopilot();
  const keys = keyTapper();
  return (ctx, frame, game) => {
    keys.releaseAfterFrame(game);
    Object.assign(ctx.racers[0].u, drive(ctx));
    if (frame === 300 || frame === 600 || frame === 900) {
      keys.tap(game, NEXT_CAMERA);
    }
    if (frame === 1000) {
      game.key(LOOK_BACK_LEFT, true);
    }
    if (frame === 1060) {
      game.key(LOOK_BACK_LEFT, false);
      game.key(LOOK_BACK_RIGHT, true);
    }
    if (frame === 1120) {
      game.key(LOOK_BACK_RIGHT, false);
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
    // what the "Instant Replay" button of the pause menu opens: the replay viewer at the
    // race's last seconds; it plays them, then waits
    name: "instant-replay-stage-02",
    stage: 2,
    frames: 1700,
    script: () =>
      driveThen(900, (ctx) => {
        ctx.game.phase = PHASE.paused;
        ctx.openReplay(ctx.VIEWER_FROM.pauseMenu, ctx.raceTape.length - 430);
      }),
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
    name: "instructions-stage-01",
    stage: 1,
    frames: 800,
    script: instructionsTour,
  },
  {
    // phones explain the touch controls and have no keyboard page
    name: "instructions-phone-stage-01",
    stage: 1,
    frames: 800,
    script: instructionsTour,
    userAgent: "iPhone",
  },
  {
    name: "main-menu-stage-01",
    stage: 1,
    frames: 560,
    script: mainMenuTour,
  },
  {
    name: "car-select-stage-01",
    stage: 1,
    frames: 1000,
    script: carSelectTour,
  },
  {
    name: "stage-select-stage-01",
    stage: 1,
    frames: 1500,
    script: stageSelectTour,
  },
  ...[
    [2, "start-hint-stage-02"],
    [4, "start-hint-stage-04"],
    [4, "start-hint-phone-stage-04", "iPhone"],
  ].map(([stage, name, userAgent]) => ({
    // a stage just unlocked: Insano tells how to win it while the race starts
    name,
    stage,
    frames: 260,
    script: () => () => {},
    unlocked: stage,
    userAgent,
  })),
  {
    name: "camera-views-stage-03",
    stage: 3,
    frames: 1250,
    script: cameraViews,
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
    async ({ name, stage, frames, script, userAgent, unlocked }) => {
      const car = 15;
      const recording = await recordFlow({
        stage,
        car,
        seed: stage,
        frames,
        script: script(),
        userAgent,
        unlocked,
      });
      expectMatchesGolden(name, { stage, car }, recording);
      expectDrawingMatchesGolden(name, recording);
    },
  );
});
