import { expect, test } from "vitest";
import { PHASE } from "../src/core/state.js";
import { startRace } from "./harness/race.js";

const ENTER = 13;
const UP = 38;

const AXES_AT_REST = [0, 0, 0, 0];

// A gamepad with all buttons released, or with the given ones pressed.
const pad = ({ axes = AXES_AT_REST, pressed = [], buttons = 12 } = {}) => ({
  connected: true,
  axes,
  buttons: Array.from({ length: buttons }, (_, i) => ({
    pressed: pressed.includes(i),
  })),
});

// Each step lasts 12 frames, long enough for the input to be released afterwards.
const STEPS = [
  pad(),
  pad({ axes: [-0.5, 0, 0, 0] }),
  pad({ axes: [0.5, 0, 0, 0] }),
  pad({ axes: [0, 0, -0.5, 0] }),
  pad({ axes: [0, 0, 0.05, 0] }),
  pad({ axes: [0, -0.5, 0, 0] }),
  pad({ axes: [0, 0, 0, 0.5] }),
  pad({ pressed: [0] }),
  pad({ pressed: [1] }),
  pad({ pressed: [2] }),
  pad({ pressed: [3] }),
  pad({ pressed: [4] }),
  pad(),
  pad({ pressed: [4] }),
  pad({ pressed: [5] }),
  pad({ pressed: [6] }),
  pad({ pressed: [7] }),
  pad({ pressed: [6, 7] }),
  // a small pad: its shoulder buttons do nothing
  pad({ pressed: [4, 5, 6], buttons: 7 }),
  pad({ pressed: [9] }),
  pad(),
  pad({ pressed: [8] }),
  pad(),
];
const STEP_FRAMES = 12;

// Drives every input of a gamepad in the car select (gamepads are looked for when the main
// menu opens it) and records what the game makes of it, frame by frame.
test("a gamepad steers, toggles, looks back and confirms", async () => {
  const { ctx, step, stepUntil, key } = await startRace({ stage: 1, car: 15 });
  const pads = [null, { connected: false }, pad()];
  globalThis.navigator.getGamepads = () => pads;
  const tap = (keyCode) => {
    key(keyCode, true);
    step();
    key(keyCode, false);
    step();
  };
  for (let frame = 0; frame < 150; frame++) {
    step();
  }
  tap(ENTER);
  tap(UP);
  tap(ENTER);
  stepUntil(() => ctx.game.phase === PHASE.mainMenu, 10, "main menu");
  // (a player whose campaign opened every car)
  ctx.career.progress = 17;
  tap(ENTER);
  stepUntil(() => ctx.game.phase === PHASE.carSelect, 100, "car select");

  const trace = [];
  STEPS.forEach((state, index) => {
    for (let frame = 0; frame < STEP_FRAMES; frame++) {
      pads[2] = state;
      step();
      const u = ctx.racers[ctx.game.player].u;
      trace.push(
        [
          index,
          u.up,
          u.down,
          u.left,
          u.right,
          u.handb,
          u.arrace,
          ctx.camera.lookBack,
          ctx.confirm.state,
          ctx.game.phase,
        ].join(" "),
      );
    }
  });
  expect(trace).toMatchSnapshot();
});
