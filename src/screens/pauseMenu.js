// The menu of a paused race: resume, instant replay, the game instructions, quit.

import {
  resumeStageMusic,
  stopEngine,
  stopStageMusic,
} from "../audio/audio.js";
import { PHASE, game } from "../core/state.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { fixcar } from "../race/physics.js";
import { racers } from "../race/racers.js";
import { recording, startReplay } from "../race/recording.js";
import { backdropHue, cssRgb, hslToRgb } from "../ui/color.js";
import { hud } from "../ui/hud.js";
import { images } from "../ui/images.js";
import { rd, view } from "../ui/view.js";
import {
  BUTTON,
  TEXT,
  blink,
  drawButton,
  drawCenteredText,
  drawSlantedBar,
  pulseButtons,
} from "../ui/widgets.js";
import { PAGE, TALK_TICKS, instructions } from "./instructions.js";
import { menu } from "./menuState.js";
import { insano } from "../ui/insano.js";

export const pauseMenu = {
  // the highlighted entry
  selected: 0,
};

const RESUME = 0;
const INSTANT_REPLAY = 1;
const INSTRUCTIONS = 2;
const QUIT = 3;

const ENTRIES = [
  { text: "Resume Game ", width: 350, withArrow: true },
  { text: "Instant Replay", width: 350 },
  { text: "Game Instructions", width: 380 },
  { text: "x Quit Game", width: 250 },
];

const BUTTON_COLORS = [
  ["#019DFF", "#01EAFF", "#004A78", "#016D77"],
  ["#01DEFF", "#49FFE3", "#016877", "#017765"],
];

// a replay needs this many recorded ticks
const REPLAY_MIN_TICKS = 430;
// how long "Not enough gameplay was recorded yet!" shows
const TOO_SHORT_TICKS = 30;
// the frame before the instant replay starts
const REPLAY_STARTS = 1;

let tooShortTicks = 0;
// the instant replay started from here and plays the stage music, which keeps playing
// when the race resumes
let musicPlayingForReplay = false;

export function pauseMenuTick() {
  stopEngine();
  rd.clearRect(0, 0, view.width, view.height);
  const hue = backdropHue();
  drawBackdrop(hue);
  if (hud.replayStartsIn == REPLAY_STARTS) {
    startReplay();
  }
  ENTRIES.forEach((entry, index) => {
    if (drawEntry(entry, index)) {
      choose(index);
    }
  });
  moveSelection();
  if (tooShortTicks) {
    drawTooShortMessage(hue);
    tooShortTicks--;
  }
  if (hud.replayStartsIn) {
    rd.globalAlpha = 0.6;
    rd.fillStyle = "#000000";
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
    hud.replayStartsIn--;
  }
  if (confirm.state == CONFIRM.pressed) {
    choose(pauseMenu.selected);
    confirm.state = CONFIRM.used;
  }
  pulseButtons();
}

const drawBackdrop = (hue) => {
  rd.fillStyle = cssRgb(hslToRgb(hue, 0.3, 0.2));
  rd.globalAlpha = 0.7;
  rd.fillRect(0, 0, view.width, view.height);
  rd.globalAlpha = 0.5;
  drawSlantedBar({
    x: 640 * view.scaleX,
    y: 95 * view.scaleY,
    width: 400,
    height: 400,
    fillFrom: "#0093F0",
    fillTo: "#00F088",
    outline: cssRgb(hslToRgb(hue, 1, 0.5)),
    filled: 1,
  });
  rd.globalAlpha = 1;
};

// Returns whether the entry was clicked.
const drawEntry = ({ text, width, withArrow }, index) => {
  const selected = pauseMenu.selected == index ? 1 : 0;
  const [faceTop, faceBottom, shadowTop, shadowBottom] =
    BUTTON_COLORS[selected];
  return drawButton({
    id: index + 1,
    x: 640 * view.scaleX,
    y: 95 * view.scaleY + (35 + 90 * index) * view.scale,
    width,
    height: 60,
    faceTop,
    faceBottom,
    shadowTop,
    shadowBottom,
    layout: withArrow ? BUTTON.textThenImage : BUTTON.textOnly,
    text,
    fontSize: 20,
    textOpacity: 0.8,
    image: withArrow ? images.buttons[1] : null,
    imageOpacity: withArrow ? 0.8 : 0,
    pulsing: selected,
  });
};

const choose = (entry) => {
  if (entry == RESUME) {
    tooShortTicks = 0;
    if (!musicPlayingForReplay) {
      resumeStageMusic();
    } else {
      musicPlayingForReplay = false;
    }
    game.phase = PHASE.race;
  }
  if (entry == INSTANT_REPLAY) {
    if (recording.recordedTicks >= REPLAY_MIN_TICKS) {
      hud.replayStartsIn = 2;
      resumeStageMusic();
      musicPlayingForReplay = true;
      tooShortTicks = 0;
    } else {
      tooShortTicks = TOO_SHORT_TICKS;
    }
  }
  if (entry == INSTRUCTIONS) {
    leaveMenu();
    instructions.fromMainMenu = false;
    instructions.page = PAGE.welcome;
    insano.talkTicks = TALK_TICKS;
    game.phase = PHASE.instructions;
  }
  if (entry == QUIT) {
    for (let c = 0; c < game.carCount; c++) {
      fixcar(c);
    }
    leaveMenu();
    menu.animation = 0;
    menu.continuesToCarSelect = false;
    game.phase = PHASE.mainMenu;
  }
};

const leaveMenu = () => {
  tooShortTicks = 0;
  if (musicPlayingForReplay) {
    stopStageMusic();
    musicPlayingForReplay = false;
  }
};

// Arrow keys move the selection, wrapping around at both ends.
const moveSelection = () => {
  const input = racers[game.player].u;
  if (input.up) {
    pauseMenu.selected--;
    if (pauseMenu.selected == -1) {
      pauseMenu.selected = ENTRIES.length - 1;
    }
    input.up = false;
  }
  if (input.down) {
    pauseMenu.selected++;
    if (pauseMenu.selected == ENTRIES.length) {
      pauseMenu.selected = 0;
    }
    input.down = false;
  }
};

const drawTooShortMessage = (hue) => {
  blink.on = !blink.on;
  const rgb = hslToRgb(hue, 1, blink.on ? 0.6 : 0.7);
  drawCenteredText(
    600,
    "Not enough gameplay was recorded yet!",
    rgb[0],
    rgb[1],
    rgb[2],
    TEXT.small,
  );
};
