// The main menu: Insano and the rider fly aside to make room for the logo, then the
// menu's buttons wait (HTML over the canvas, see placeMainMenu). Also the question whether
// to reset the game.

import { pauseMenuMusic, playMenuMusic } from "../audio/audio.js";
import { drawClassicResetQuestion } from "../classic/instructions.js";
import { OPTION, classicMainMenu } from "../classic/mainMenu.js";
import { PHASE, RACE_KIND, game } from "../core/state.js";
import { career, chooseRaceKind } from "../race/career.js";
import { saveSetting } from "../core/storage.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { lookForGamepads } from "../input/gamepad.js";
import { racers } from "../race/racers.js";
import { track } from "../race/track.js";
import { interpolation } from "../render/interpolation.js";
import { classicMenus } from "../render/look.js";
import { setWorld } from "../render/renderer.js";
import { scene } from "../render/scene.js";
import { images } from "../ui/images.js";
import {
  drawTalkingInsano,
  insano,
  insanoScale,
  startBubbleText,
  writeBubbleLines,
} from "../ui/insano.js";
import { rd, view } from "../ui/view.js";
import {
  BUTTON,
  drawBlueButton,
  drawMenuBackground,
  drawMusicToggle,
  pulseButtons,
} from "../ui/widgets.js";
import { PAGE, TALK_TICKS, instructions } from "./instructions.js";
import { menu } from "./menuState.js";
import { SHOWCASE, showcase } from "./showcase.js";
import { openStageEditor } from "../editor/stageEditor.js";
import { openMultiplayer } from "../ui/multiplayerMenu.js";
import { openOptions } from "../ui/optionsMenu.js";
import { chooseReplayFile } from "./replays.js";

// menu.animation of the main menu
const OPENED = 0;
// the buttons wait here
const WAITING = 15;
// PLAY was pressed
const LEAVING = 29;
const BLACK_FROM = 30;
const CAR_SELECT_AT = 40;

// frames of Insano and the rider flying aside
const INTRO_FRAMES = 25;
let introFrame = 0;

// the subtitle under the logo changes the case of one letter every second frame
const SUBTITLES = [
  "rE-LIT",
  "re-LIT",
  "re-lIT",
  "re-liT",
  "re-lit",
  "Re-lit",
  "RE-lit",
  "RE-Lit",
  "RE-LIt",
  "RE-LI T",
];
// -1 before the first change: "RE-LIT"
let subtitle = -1;
let subtitleWait = 0;

export function mainMenuTick() {
  if (classicMenus()) {
    classicTick();
    return;
  }
  rd.fillStyle = "#000000";
  rd.fillRect(0, 0, view.width, view.height);
  if (menu.animation == OPENED) {
    playMenuMusic();
    introFrame = 0;
  }
  drawMenuBackground();
  const screen = layout();
  if (introFrame != 0) {
    drawFlyingAside(screen);
  }
  if (introFrame == INTRO_FRAMES) {
    drawLogo(screen);
  }
  if (!menu.continuesToCarSelect) {
    waitForChoice();
  }
  animate();
  if (menu.animation >= BLACK_FROM) {
    // the canvas ignores alphas below 0: plain black until car select opens
    rd.globalAlpha = (menu.animation - 50) / 10;
    rd.fillStyle = "#000000";
    rd.fillRect(0, 0, view.width, view.height);
    rd.globalAlpha = 1;
    if (menu.animation == CAR_SELECT_AT) {
      openCarSelect();
    }
  }
  pulseButtons();
}

// Where the intro starts (in the background picture, which is centred and as high as the
// screen) and where its pictures end up. Narrow screens crop the background, there the
// pictures end up at the screen's edges.
const layout = () => {
  let left = (view.width - 1280 * view.scaleY) / 2;
  let right = left + 1280 * view.scaleY;
  const insanoStart = [left + 270 * view.scaleY, 39 * view.scaleY];
  const riderStart = [left + 520 * view.scaleY, 43 * view.scaleY];
  let scale = view.scaleY;
  if (left < 0) {
    left = 0;
    right = view.width;
    scale = view.scale;
  }
  return {
    left,
    right,
    scale,
    insanoStart,
    insanoEnd: [left + 40 * scale, 186 * scale],
    riderStart,
    riderEnd: [right - 520 * scale, 102 * scale],
  };
};

const drawFlyingAside = (screen) => {
  const along = (start, end) =>
    (start * (INTRO_FRAMES - introFrame) + end * introFrame) / INTRO_FRAMES;
  const at = (start, end) => [along(start[0], end[0]), along(start[1], end[1])];
  const [insanoX, insanoY] = at(screen.insanoStart, screen.insanoEnd);
  const [riderX, riderY] = at(screen.riderStart, screen.riderEnd);
  rd.globalAlpha = 0.2 + (introFrame / INTRO_FRAMES) * 0.8;
  rd.drawImage(
    images.insano[0],
    insanoX,
    insanoY,
    274 * view.scaleY,
    341 * view.scaleY,
  );
  rd.drawImage(
    images.rider,
    riderX,
    riderY,
    386 * view.scaleY,
    191 * view.scaleY,
  );
  rd.globalAlpha = 1;
};

// Beside the menu's buttons, low on the screen, smaller if they leave less room.
const logoPlace = ({ left, scale }) => {
  // (where the buttons start, see .main-menu in index.html: they are sized in vh)
  const buttonsLeft = view.width - 0.51 * view.height;
  const logoScale = Math.min(
    0.8 * scale,
    (buttonsLeft - left - 30 * scale) / 905,
  );
  return [
    buttonsLeft - 905 * logoScale,
    view.height - (40 * scale + 258 * logoScale),
    logoScale,
  ];
};

const drawLogo = (screen) => {
  const [logoX, logoY, scale] = logoPlace(screen);
  rd.drawImage(images.logo, logoX, logoY, 905 * scale, 258 * scale);
  const text = subtitle < 0 ? "RE-LIT" : SUBTITLES[subtitle];
  const x = logoX + 760 * scale;
  const y = logoY + 150 * scale;
  rd.letterSpacing = "1px";
  rd.font = "" + 48 * scale + "px junk";
  rd.textAlign = "left";
  rd.textBaseline = "middle";
  const gradient = rd.createLinearGradient(
    x,
    y,
    x + rd.measureText(text).width,
    y,
  );
  gradient.addColorStop(0, "#FF5B01");
  gradient.addColorStop(1, "#FF9601");
  rd.fillStyle = gradient;
  rd.fillText(text, x, y);
  if (subtitleWait == 0) {
    subtitle = (subtitle + 1) % SUBTITLES.length;
    subtitleWait = 1;
  } else {
    subtitleWait--;
  }
};

// the dialogs the menu opens over itself: they take the keys while open
const MENU_DIALOGS = ["options", "multiplayer", "stageEditor"];
// up and down as held last tick, so a gamepad's stick goes one button at a time
let heldUp = false;
let heldDown = false;

const waitForChoice = () => {
  const dialogOpen = MENU_DIALOGS.some((id) => element(id).open);
  // (a gamepad's stick, or the arrow keys with the focus outside the menu)
  const { up, down } = racers[game.player].u;
  if (!dialogOpen && up && !heldUp) {
    moveFocus(-1);
  }
  if (!dialogOpen && down && !heldDown) {
    moveFocus(1);
  }
  heldUp = up;
  heldDown = down;
  if (menu.animation < LEAVING && confirm.state == CONFIRM.pressed) {
    // (a gamepad's button chooses the focused button, Enter outside the menu the one
    // chosen last; none behind a dialog)
    confirm.state = CONFIRM.used;
    if (!dialogOpen) {
      (
        choices.get(document.activeElement) ??
        choices.get(chosen) ??
        startCampaign
      )();
    }
  }
  drawMusicToggle();
};

// With buttons the menu opens up to WAITING, then the intro plays. Without, the intro plays
// first and the menu goes on by itself.
const animate = () => {
  if (!menu.continuesToCarSelect) {
    if (menu.animation != WAITING) {
      menu.animation++;
    } else if (introFrame != INTRO_FRAMES) {
      introFrame++;
    }
  } else if (introFrame != INTRO_FRAMES) {
    introFrame++;
    menu.animation = 1;
  } else {
    menu.animation++;
  }
};

// The original's menu waits for a choice, also where this one would go on by itself; back
// in the modern look its buttons wait too.
const classicTick = () => {
  if (menu.animation == OPENED) {
    playMenuMusic();
  }
  menu.animation = WAITING;
  menu.continuesToCarSelect = false;
  introFrame = INTRO_FRAMES;
  const chosen = classicMainMenu(menu.resetOffered);
  // (the original's menu knows the campaign only)
  if (chosen == OPTION.play) {
    chooseRaceKind(RACE_KIND.campaign);
    openCarSelect();
  }
  if (chosen == OPTION.instructions) {
    openInstructions();
  }
  if (chosen == OPTION.reset) {
    insano.talkTicks = TALK_TICKS;
    game.phase = PHASE.resetQuestion;
  }
  if (chosen == OPTION.replay) {
    chooseReplayFile();
  }
};

const openInstructions = () => {
  pauseMenuMusic();
  instructions.fromMainMenu = true;
  instructions.page = PAGE.welcome;
  insano.talkTicks = TALK_TICKS;
  game.phase = PHASE.instructions;
};

const openCarSelect = () => {
  lookForGamepads();
  game.player = 0;
  const input = racers[game.player].u;
  input.left = false;
  input.right = false;
  input.up = false;
  input.down = false;
  input.handb = false;
  showcase.motion = SHOWCASE.droppingIn;
  showcase.dropSpeed = 0;
  showcase.height = 100;
  scene.tint = [0, -0.05, 0.6];
  setWorld(scene.tint, [0, 0, 0], 0, 0.866, -0.5, 10700);
  game.phase = PHASE.carSelect;
};

// the tick the classic reset question was last shown
let classicQuestionTick = -2;

export function resetQuestionTick() {
  if (classicMenus()) {
    const answer = drawClassicResetQuestion(
      classicQuestionTick != interpolation.tick - 1,
    );
    classicQuestionTick = interpolation.tick;
    if (answer == "reset") {
      resetGame();
    }
    if (answer == "cancel") {
      game.phase = PHASE.mainMenu;
    }
    return;
  }
  rd.fillStyle = "#000000";
  rd.fillRect(0, 0, view.width, view.height);
  drawMenuBackground();
  const scale = insanoScale();
  const top = drawTalkingInsano(scale);
  startBubbleText(scale);
  writeBubbleLines(scale, top, [
    [36, "Reset your Game"],
    [76, "Would you like to play the game from the beginning again?"],
    [156, "Note! This will delete all your saved unlocked cars and stages"],
    [196, "and will start the game like it was never played before!"],
    [276, "Challenge yourself again and reset the game now?"],
  ]);
  if (
    drawBlueButton({
      id: 3,
      x: 730 * scale,
      y: top + 410 * scale - 65 * view.scale,
      width: 500,
      layout: BUTTON.textOnly,
      text: "Yes!  Reset my game now",
      fontSize: 20,
      image: null,
      pulsing: false,
    })
  ) {
    resetGame();
  }
  if (
    drawBlueButton({
      id: 4,
      x: 240 * scale + 100 * view.scale,
      y: top + 560 * scale - 65 * view.scale,
      width: 200,
      layout: BUTTON.imageThenText,
      text: " Cancel",
      fontSize: 18,
      image: images.buttons[3],
      pulsing: false,
    })
  ) {
    game.phase = PHASE.mainMenu;
  }
}

const resetGame = () => {
  career.progress = 1;
  game.unlocked = 1;
  track.stage = game.unlocked;
  saveSetting("unlocked", game.unlocked);
  game.carTypes[0] = 5;
  saveSetting("carsel", game.carTypes[0]);
  menu.resetOffered = false;
  game.phase = PHASE.mainMenu;
};

// --- the menu's buttons ---

const nav = document.getElementById("mainMenu");
const element = (id) => document.getElementById(id);
// the button chosen last, focused again when the menu comes back
let chosen = element("menuCampaign");
// what each button does
const choices = new Map();

// The kind of race chosen: the car select opens, after the menu's own way out.
const startRaces = (kind) => {
  chooseRaceKind(kind);
  menu.animation = LEAVING;
  introFrame = INTRO_FRAMES;
};
const startCampaign = () => startRaces(RACE_KIND.campaign);

const offerReset = () => {
  insano.talkTicks = TALK_TICKS;
  game.phase = PHASE.resetQuestion;
};

// The focus one button up or down the menu, round at its ends (from the button chosen last
// when it is elsewhere).
const moveFocus = (step) => {
  const buttons = [...(nav.querySelectorAll?.("button:not([hidden])") ?? [])];
  if (buttons.length == 0) {
    return;
  }
  const focused = buttons.indexOf(document.activeElement);
  const at = focused >= 0 ? focused : Math.max(buttons.indexOf(chosen), 0);
  buttons[(at + step + buttons.length) % buttons.length].focus();
};

export const installMainMenu = () => {
  for (const [id, choose] of [
    ["menuCampaign", startCampaign],
    ["menuQuickRace", () => startRaces(RACE_KIND.quickRace)],
    ["menuPractice", () => startRaces(RACE_KIND.practice)],
    ["menuTimeAttack", () => startRaces(RACE_KIND.timeAttack)],
    ["menuMultiplayer", openMultiplayer],
    ["menuStageEditor", openStageEditor],
    ["menuOptions", openOptions],
    ["menuInstructions", openInstructions],
    ["menuReplay", chooseReplayFile],
    ["menuReset", offerReset],
  ]) {
    const button = element(id);
    choices.set(button, choose);
    button.addEventListener("click", () => {
      chosen = button;
      choose();
    });
  }
  // (the up and down keys go along the menu, round at its ends)
  nav.addEventListener("keydown", (event) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step) {
      event.preventDefault();
      moveFocus(step);
    }
  });
};

// Every tick: the menu's buttons while the modern main menu waits for a choice.
export const placeMainMenu = () => {
  const shown =
    game.phase == PHASE.mainMenu &&
    !classicMenus() &&
    !menu.continuesToCarSelect &&
    menu.animation < LEAVING;
  if (shown != nav.hidden) {
    return;
  }
  nav.hidden = !shown;
  if (shown) {
    element("menuReset").hidden = !menu.resetOffered;
    (chosen.hidden ? element("menuCampaign") : chosen).focus?.();
  } else if (nav.contains?.(document.activeElement)) {
    // (keys on a button of the menu are the page's, see input/keyboard.js: the screens
    // after it take them again, also in browsers that leave the focus on hidden buttons)
    document.activeElement.blur();
  }
};
