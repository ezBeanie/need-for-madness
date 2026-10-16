// The main menu: Insano and the rider fly aside to make room for the logo, then the
// buttons wait for PLAY. Also the question whether to reset the game.

import { pauseMenuMusic, playMenuMusic } from "../audio/audio.js";
import { PHASE, game } from "../core/state.js";
import { saveSetting } from "../core/storage.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { lookForGamepads } from "../input/gamepad.js";
import { racers } from "../race/racers.js";
import { track } from "../race/track.js";
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
  drawButton,
  drawMenuBackground,
  drawMusicToggle,
  pulseButtons,
} from "../ui/widgets.js";
import { PAGE, TALK_TICKS, instructions } from "./instructions.js";
import { menu } from "./menuState.js";
import { SHOWCASE, showcase } from "./showcase.js";

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

export function drawmain() {
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
    drawButtons(screen);
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
// pictures end up at the screen's edges and the logo moves left.
const layout = () => {
  let left = (view.width - 1280 * view.scaleY) / 2;
  let right = left + 1280 * view.scaleY;
  const insanoStart = [left + 270 * view.scaleY, 39 * view.scaleY];
  const riderStart = [left + 520 * view.scaleY, 43 * view.scaleY];
  let scale = view.scaleY;
  let logoShift = 1;
  if (left < 0) {
    left = 0;
    right = view.width;
    scale = view.scale;
    logoShift = 1 - 0.9752 * ((1 - view.scaleX / view.scaleY) / 0.4375);
  }
  return {
    left,
    right,
    scale,
    logoShift,
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

const drawLogo = ({ left, scale, logoShift }) => {
  const logoX = left + 282 * scale * logoShift;
  const logoY = view.height - 464 * scale;
  rd.drawImage(images.logo, logoX, logoY, 905 * scale, 258 * scale);
  const text = subtitle < 0 ? "RE-LIT" : SUBTITLES[subtitle];
  const x = logoX + 760 * scale;
  const y = logoY + 150 * scale;
  rd.letterSpacing = "1px";
  rd.font = "" + 24 * (view.scaleY + view.scaleX) + "px junk";
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

const drawButtons = ({ right }) => {
  if (
    drawButton({
      id: 1,
      x: right - 230 * view.scale,
      y: 720 * view.scaleY - 200 * view.scale,
      width: 360,
      height: 60,
      faceTop: "#FF1301",
      faceBottom: "#FF8A01",
      shadowTop: "#780800",
      shadowBottom: "#784100",
      layout: BUTTON.textOnly,
      text: "Game Instructions",
      fontSize: 19,
      textOpacity: 0.9,
      image: null,
      imageOpacity: 0,
      pulsing: false,
    })
  ) {
    pauseMenuMusic();
    instructions.fromMainMenu = true;
    instructions.page = PAGE.welcome;
    insano.talkTicks = TALK_TICKS;
    game.phase = PHASE.instructions;
  }
  if (
    drawButton({
      id: 3,
      x: right - 150 * view.scale,
      y: 720 * view.scaleY - 100 * view.scale,
      width: 200,
      height: 70,
      faceTop: "#FF3D01",
      faceBottom: "#FFB401",
      shadowTop: "#771D01",
      shadowBottom: "#775401",
      layout: BUTTON.textThenImage,
      text: "PLAY ",
      fontSize: 25,
      textOpacity: 0.9,
      image: images.buttons[1],
      imageOpacity: 0.9,
      pulsing: true,
    })
  ) {
    menu.animation = LEAVING;
    introFrame = INTRO_FRAMES;
  }
  if (menu.animation < LEAVING && confirm.state == CONFIRM.pressed) {
    menu.animation = LEAVING;
    confirm.state = CONFIRM.used;
  }
  if (
    menu.resetOffered &&
    drawButton({
      id: 7,
      x: right - 450 * view.scale,
      y: 720 * view.scaleY - 90 * view.scale,
      width: 280,
      height: 60,
      faceTop: "#FF1301",
      faceBottom: "#FF8A01",
      shadowTop: "#780800",
      shadowBottom: "#784100",
      layout: BUTTON.textOnly,
      text: "Reset Game",
      fontSize: 22,
      textOpacity: 0.9,
      image: null,
      imageOpacity: 0,
      pulsing: 0,
    })
  ) {
    insano.talkTicks = TALK_TICKS;
    game.phase = PHASE.resetQuestion;
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

export function resetgame() {
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
    game.unlocked = 1;
    track.stage = game.unlocked;
    saveSetting("unlocked", game.unlocked);
    game.carTypes[0] = 5;
    saveSetting("carsel", game.carTypes[0]);
    menu.resetOffered = false;
    game.phase = PHASE.mainMenu;
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
