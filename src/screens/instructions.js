// The game instructions: Coach Insano explains the game on eight pages. They open from the
// main menu or from the pause menu.

import { playMenuMusic } from "../audio/audio.js";
import {
  drawClassicInstructions,
  startClassicInstructions,
} from "../classic/instructions.js";
import { isPhone } from "../core/platform.js";
import { language, t } from "../core/language.js";
import { PHASE, game } from "../core/state.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { stunts } from "../input/controls.js";
import { pointer } from "../input/pointer.js";
import { interpolation } from "../render/interpolation.js";
import { classicMenus } from "../render/look.js";
import { backdropHue, cssRgb, hslToRgb } from "../ui/color.js";
import { images } from "../ui/images.js";
import {
  BUBBLE_INK,
  drawStuntMeansPower,
  drawTalkingInsano,
  insano,
  insanoScale,
  startBubbleText,
  writeBubbleLines,
} from "../ui/insano.js";
import { rd, view } from "../ui/view.js";
import {
  BUTTON,
  anyButtonHeld,
  drawBlueButton,
  drawMenuBackground,
} from "../ui/widgets.js";

export const instructions = {
  // opened from the main menu (drawn over the menu background instead of the paused race)
  fromMainMenu: false,
  page: 0,
};

export const PAGE = {
  welcome: 0,
  powerUp: 1,
  arrowAndHoop: 2,
  controls: 3,
  // the last page of the tour, with buttons to the keyboard controls and the credits
  coach: 4,
  keyboard: 5,
  credits: 6,
  moreCredits: 7,
};

// how long Insano talks after the page changes
export const TALK_TICKS = 250;

// the tick the classic instructions were last shown: they open on their first page
let classicTick = -2;

export function instructionsTick() {
  if (classicMenus()) {
    if (classicTick != interpolation.tick - 1) {
      startClassicInstructions();
    }
    classicTick = interpolation.tick;
    if (drawClassicInstructions(MUSIC_CREDITS)) {
      close();
    }
    return;
  }
  rd.fillStyle = "#000000";
  rd.fillRect(0, 0, view.width, view.height);
  if (instructions.fromMainMenu) {
    drawMenuBackground();
  } else {
    drawPausedRaceBackdrop();
  }
  const scale = insanoScale();
  const top = drawTalkingInsano(scale);
  // a page left by a click draws the page it leads to in the same frame
  PAGES.forEach((drawPage, page) => {
    if (instructions.page == page) {
      drawPage(scale, top);
    }
  });
  drawNavigation(scale, top);
  // a click beside the buttons closes the instructions
  if (!anyButtonHeld() && pointer.down) {
    close();
    pointer.down = false;
  }
}

const drawPausedRaceBackdrop = () => {
  rd.clearRect(0, 0, view.width, view.height);
  rd.fillStyle = cssRgb(hslToRgb(backdropHue(), 0.3, 0.2));
  rd.globalAlpha = 0.7;
  rd.fillRect(0, 0, view.width, view.height);
  rd.globalAlpha = 1;
};

const talk = () => {
  insano.talkTicks = TALK_TICKS;
};

const close = () => {
  if (instructions.fromMainMenu) {
    game.phase = PHASE.mainMenu;
    playMenuMusic();
  } else {
    game.phase = PHASE.paused;
  }
};

const confirmed = () => {
  if (confirm.state == CONFIRM.pressed) {
    confirm.state = CONFIRM.used;
    return true;
  }
  return false;
};

const drawWelcome = (scale, top) => {
  const left = 200 * scale;
  rd.letterSpacing = "1px";
  rd.font = "" + 30 * scale + "px junk";
  rd.textBaseline = "middle";
  rd.textAlign = "left";
  rd.fillStyle = BUBBLE_INK;
  rd.fillText(
    t("Welcome to  Need for Madness !"),
    left + 20 * scale,
    top + 30 * scale,
  );
  rd.letterSpacing = "0px";
  rd.font = "" + 30 * scale + "px verd";
  writeBubbleLines(scale, top, [
    [76, "In this game there are two ways to complete a stage."],
    [116, "One is by racing and finishing in first place, the other is by"],
    [156, "wasting and crashing all the other cars in the stage!"],
  ]);
  rd.letterSpacing = "1px";
  rd.font = "" + 40 * scale + "px junk";
  rd.fillText(t("Racing"), left + 80 * scale, top + 220 * scale);
  rd.fillText(
    t("Wasting"),
    left + 130 * scale + 485 * scale,
    top + 220 * scale,
  );
  // (between the pictures only the original's short word fits as big)
  rd.font = "" + (language.current == "en" ? 35 : 20) * scale + "px junk";
  rd.fillText(t("OR"), left + 511 * scale, top + 340 * scale);
  rd.drawImage(
    images.instructions[0],
    left + 20 * scale,
    top + 190 * scale,
    485 * scale,
    265 * scale,
  );
  rd.drawImage(
    images.instructions[1],
    left + 70 * scale + 485 * scale,
    top + 249 * scale,
    485 * scale,
    206 * scale,
  );
};

const drawPowerUp = (scale, top) => {
  startBubbleText(scale);
  writeBubbleLines(scale, top, [
    [56, "Whether you are racing or wasting, you will need to"],
    [96, "power up your car."],
    [136, "The more powered your car is, the stronger and faster"],
    [176, "it becomes! Which is helpful when racing or wasting."],
    [256, "To power up your car (and keep it powered up) you will need to"],
    [296, "perform stunts!"],
  ]);
  drawStuntMeansPower(scale, top, 310, 300);
};

const drawArrowAndHoop = (scale, top) => {
  const left = 200 * scale;
  startBubbleText(scale);
  writeBubbleLines(scale, top, [
    [36, "When wasting cars, to help you find the other cars in the stage,"],
    [76, "press the 'Arrow Target' button to toggle the guidance arrow"],
    [116, "from pointing to the track to pointing to the cars."],
    [156, "When your car is damaged, you can fix it (and reset its 'Damage')"],
    [196, "by jumping through the electrified hoop."],
  ]);
  rd.drawImage(
    images.instructions[2],
    left + 150 * scale,
    top + 233 * scale,
    402 * scale,
    231 * scale,
  );
  rd.drawImage(
    images.instructions[3],
    left + 600 * scale,
    top + 180 * scale,
    376 * scale,
    284 * scale,
  );
};

const drawControls = (scale, top) => {
  const left = 200 * scale;
  startBubbleText(scale);
  const picture = (image, x, y, width, height) => {
    rd.drawImage(
      image,
      left + x * scale,
      top + y * scale,
      width * scale,
      height * scale,
    );
  };
  if (!isPhone) {
    writeBubbleLines(scale, top, [
      [36, "Drive your car using the keyboard arrows and also use the"],
      [
        76,
        stunts.byKey
          ? "Spacebar, then the arrows, when your car is in the air for stunts."
          : "keyboard arrows when your car is in the air to perform stunts.",
      ],
      [116, "Press Spacebar for Handbrakes to drift while turning and make"],
      [156, "quick 180 turns."],
    ]);
    picture(images.instructions[6], 200, 220, 345, 77);
    picture(images.instructions[5], 670, 170, 220, 155);
    picture(images.instructions[7], 50, 380, 95, 65);
    rd.fillText(
      t("(Gamepad & Joystick control is also possible.)"),
      left + 167 * scale,
      top + 420 * scale,
    );
  } else {
    writeBubbleLines(scale, top, [
      [36, "Drive your car using the arrow buttons on the screen."],
      [
        76,
        stunts.byKey
          ? "In the air press Handbrake, then them, to perform stunts."
          : "Also use them when your car is in the air to perform stunts.",
      ],
    ]);
    picture(images.touchControls[0], 150, 110, 128, 128);
    picture(images.touchControls[1], 300, 110, 128, 128);
    picture(images.touchControls[3], 550, 110, 128, 128);
    picture(images.touchControls[2], 700, 110, 128, 128);
    writeBubbleLines(scale, top, [
      [290, "Press the Handbrake button while turning to drift and make"],
      [330, "quick 180 turns."],
    ]);
    picture(images.touchControls[4], 330, 330, 154, 111);
  }
};

const drawCoach = (scale, top) => {
  startBubbleText(scale);
  writeBubbleLines(scale, top, [
    [36, "And finally my name is Coach Insano, and I am here to help you"],
    [76, "and guide you to become the greatest Need for Madness driver"],
    [116, "you can be!"],
    [156, "I will also offer you hints and tips on the ideal strategy to"],
    [196, "complete each stage. Good luck!"],
  ]);
  // phones have no keyboard
  if (
    !isPhone &&
    drawBlueButton({
      id: 1,
      x: 240 * scale + 285 * view.scale,
      y: top + 250 * scale,
      width: 570,
      layout: BUTTON.textOnly,
      text: "Additional Keyboard Controls",
      fontSize: 18,
      image: null,
      pulsing: false,
    })
  ) {
    talk();
    instructions.page = PAGE.keyboard;
  }
  if (
    drawBlueButton({
      id: 2,
      x: 240 * scale + 140 * view.scale,
      y: top + (isPhone ? 300 : 350) * scale,
      width: 280,
      layout: BUTTON.textOnly,
      text: "Music Credits",
      fontSize: 18,
      image: null,
      pulsing: false,
    })
  ) {
    talk();
    instructions.page = PAGE.credits;
  }
};

const drawKeyboard = (scale, top) => {
  startBubbleText(scale);
  writeBubbleLines(scale, top, [
    [36, "Additional Keyboard Controls"],
    [116, "[X] & [Z] to look back while driving."],
    [156, "[Q] to toggle the guidance arrow by Keyboard."],
    [196, "[R] to trigger time reversal and rewind time."],
    [236, "[W], [A], [S] & [D] can also be used instead of Keyboard arrows."],
    [276, "[V] for cinematic camera views while driving."],
    [316, "[M] to mute music."],
    [356, "[N] to mute sound effects."],
    [396, "[Enter] & [Esc] to navigate and pause game."],
  ]);
  if (confirmed()) {
    instructions.page = PAGE.coach;
    talk();
  }
};

// the music's credits, on two pages (a title and its lines each)
const MUSIC_CREDITS = [
  [
    "Music Credits",
    "Interface and Game Menus: Neon Nox - Shift",
    "Stage 1: Alpharisc - Video Disco",
    "Stage 2: Sferro & Tommy '86 - We Been 'Round",
    "Stage 3: Jeremiah Kane - All or Nothing",
    "Stage 4: Wolf and Raven - Cyber Samurai",
    "Stage 5: Bestrack - Burn the Night",
    "Stage 6: Midnight Fury - Arcade Hero",
    "Stage 7: DEADLIFE - Punished Survivor",
    "Stage 8: Jeremiah Kane - Street Warriors (feat. FAVORIT89)",
  ],
  [
    "Music Credits",
    "Stage 9: DEADLIFE - We Are One & The Same",
    "Stage 10: Wice - Star Fighter",
    "Stage 11: Neon Nox - The Stash",
    "Stage 12: Neon Nox vs Powernerd - Dopamine",
    "Stage 13: Dreamhour - Small Town Vengeance",
    "Stage 14: LazerHawk - King of The Streets",
    "Stage 15: Jeremiah Kane - Vampirevania",
    "Stage 16: Jeremiah Kane - SPECTER",
    "Stage 17: Midnight Danger - Radio Hell",
  ],
];

// a page's lines in the speech bubble, 40 apart from its top
const creditLines = (page) => page.map((line, i) => [36 + 40 * i, line]);

const drawCredits = (scale, top) => {
  startBubbleText(scale);
  writeBubbleLines(scale, top, creditLines(MUSIC_CREDITS[0]));
  if (
    drawBlueButton({
      id: 1,
      x: 1170 * scale - 75 * view.scale,
      y: top + 430 * scale,
      width: 150,
      layout: BUTTON.textThenImage,
      text: "Next ",
      fontSize: 18,
      image: images.buttons[2],
      pulsing: true,
    })
  ) {
    talk();
    instructions.page++;
  }
  if (confirmed()) {
    instructions.page++;
    talk();
  }
};

const drawMoreCredits = (scale, top) => {
  startBubbleText(scale);
  writeBubbleLines(scale, top, creditLines(MUSIC_CREDITS[1]));
  if (confirmed()) {
    instructions.page = PAGE.coach;
    talk();
  }
};

const PAGES = [
  drawWelcome,
  drawPowerUp,
  drawArrowAndHoop,
  drawControls,
  drawCoach,
  drawKeyboard,
  drawCredits,
  drawMoreCredits,
];

// Back on every page but the first; Next through the tour, Finish at its end.
const drawNavigation = (scale, top) => {
  const y = top + 560 * scale - 65 * view.scale;
  if (instructions.page > PAGE.welcome) {
    if (
      drawBlueButton({
        id: 4,
        x: 240 * scale + 75 * view.scale,
        y,
        width: 150,
        layout: BUTTON.imageThenText,
        text: " Back",
        fontSize: 18,
        image: images.buttons[3],
        pulsing: false,
      })
    ) {
      // the keyboard controls and the credits lead back to the coach
      instructions.page =
        instructions.page > PAGE.coach ? PAGE.coach : instructions.page - 1;
      talk();
    }
  }
  if (instructions.page < PAGE.coach) {
    if (
      drawBlueButton({
        id: 3,
        x: 1280 * scale - 70 * scale - 100 * view.scale,
        y,
        width: 200,
        layout: BUTTON.textThenImage,
        text: "Next ",
        fontSize: 20,
        image: images.buttons[1],
        pulsing: true,
      })
    ) {
      instructions.page++;
      talk();
    }
    if (confirmed()) {
      instructions.page++;
      talk();
    }
  }
  if (instructions.page == PAGE.coach) {
    if (
      drawBlueButton({
        id: 3,
        x: 1280 * scale - 70 * scale - 110 * view.scale,
        y,
        width: 220,
        layout: BUTTON.textThenImage,
        text: "Finish ",
        fontSize: 20,
        image: images.buttons[1],
        pulsing: true,
      })
    ) {
      close();
    }
    if (confirmed()) {
      close();
    }
  }
};
