// The instructions in the classic look, as the original game drew them (its inst): Coach
// Insano faintly behind a speech bubble, talking for a while on each page, the controls
// in pictures of keys, over the khaki menu background. Pages 1 to 16 as the original
// counted them, the odd ones shown (16 the controls once again); this game's keys where
// they differ, and its music credits behind a button on the coach's page.
import { random } from "../core/random.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { racers } from "../race/racers.js";
import { drawMenuBackground } from "./mainMenu.js";
import {
  centred,
  draw,
  fill,
  font,
  mouse,
  overImage,
  picture,
  screen,
  startScreen,
  text,
  textButton,
} from "./screen.js";

// the music credits' two pages
const CREDITS = 100;

const state = {
  page: 1,
  // how long Insano still talks, and which of his pictures shows
  talks: 0,
  face: 0,
  blink: false,
  pressed: null,
};

export const startClassicInstructions = () => {
  state.page = 1;
  state.talks = 0;
  state.pressed = null;
};

// how long Insano talks on each page as it opens
const TALKS = { 3: 200, 5: 250, 7: 200, 9: 250, 11: 200, 13: 200, 15: 100 };

const BLACK = [0, 0, 0];
const INK = [0, 64, 128];
const LIGHT_INK = [0, 128, 255];

const lines = (color, ...rows) => {
  rows.forEach((row, i) => {
    if (row) {
      text(row, 262, 67 + 20 * i, color);
    }
  });
};

// the keyboard: Spacebar and the arrows with what they do, at the arrows' top
const drawDriving = (y) => {
  draw(picture("space.gif"), 171, y + 35);
  draw(picture("arrows.gif"), 505, y + 3);
  font(11);
  text("Accelerate", 515, y - 1, BLACK);
  text("Brake/Reverse", 506, y + 77, BLACK);
  text("Turn left", 454, y + 55, BLACK);
  text("Turn right", 590, y + 55, BLACK);
  text("Handbrake", 247, y + 54, BLACK);
};

const drawStunting = (y) => {
  draw(picture("space.gif"), 185, y + 35);
  draw(picture("plus.gif"), 405, y + 38);
  draw(picture("arrows.gif"), 491, y + 3);
  font(11);
  text("Forward Loop", 492, y - 1, BLACK);
  text("Backward Loop", 490, y + 77, BLACK);
  text("Left Roll", 443, y + 55, BLACK);
  text("Right Roll", 576, y + 55, BLACK);
  text("Spacebar", 266, y + 54, BLACK);
};

const drawRacingOrWasting = () => {
  font(13);
  if (state.page == 3) {
    text("Hello!  Welcome to the world of", 262, 67, INK);
    text("!", 657, 67, INK);
    draw(picture("nfm.gif"), 469, 55);
    text("In this game there are two ways to complete a stage.", 262, 107, INK);
    text(
      "One is by racing and finishing in first place, the other is by",
      262,
      127,
      INK,
    );
    text(
      "wasting and crashing all the other cars in the stage!",
      262,
      147,
      INK,
    );
  } else {
    lines(
      LIGHT_INK,
      "While racing, you will need to focus on going fast and passing",
      "through all the checkpoints in the track. To complete a lap, you",
      "must not miss a checkpoint.",
      "While wasting, you will just need to chase the other cars and",
      "crash into them (without worrying about track and checkpoints).",
    );
  }
  draw(picture("racing.gif"), 165, 185);
  draw(picture("ory.gif"), 429, 235);
  draw(picture("wasting.gif"), 492, 185);
  font(11);
  text("Checkpoint", 392, 189, BLACK);
  font(13);
  text("Drive your car using the Arrow Keys and Spacebar", 125, 320, BLACK);
  font(11);
  text(
    "(When your car is on the ground Spacebar is for Handbrake)",
    125,
    341,
    BLACK,
  );
  drawDriving(320);
};

const drawPower = () => {
  font(13);
  if (state.page == 7) {
    lines(
      INK,
      "Whether you are racing or wasting the other cars you will need",
      "to power up your car.",
      "=> More 'Power' makes your car become faster and stronger!",
      "To power up your car (and keep it powered up) you will need to",
      "perform stunts!",
    );
    draw(picture("chil.gif"), 167, 295);
  } else {
    text("The better the stunt the more power you get!", 262, 67, INK);
    lines(
      LIGHT_INK,
      null,
      "Forward looping pushes your car forwards in the air and helps",
      "when racing. Backward looping pushes your car upwards giving it",
      "more hang time in the air making it easier to control its landing.",
      "Left and right rolls shift your car in the air left and right slightly.",
    );
    if (state.blink || state.talks < 150) {
      draw(picture("chil.gif"), 167, 295);
    }
  }
  draw(picture("stunts.png"), 105, 175);
  draw(picture("power.gif"), 540, 253);
  font(13);
  text("To perform stunts. When your car is in the AIR:", 125, 310, BLACK);
  text("Press combo Spacebar + Arrow Keys", 125, 330, BLACK);
  drawStunting(320);
  fill(602, 257, 76, 9, [140, 243, 244]);
};

const drawHoopAndArrow = () => {
  font(13);
  if (state.page == 11) {
    lines(
      INK,
      "When wasting cars, to help you find the other cars in the stage,",
      "press [ Q ] to toggle the guidance arrow from pointing to the track",
      "to pointing to the cars.",
      "When your car is damaged. You fix it (and reset its 'Damage') by",
      "jumping through the electrified hoop.",
    );
  } else {
    lines(
      LIGHT_INK,
      "You will find that in some stages it's easier to waste the other cars",
      "and in some others it's easier to race and finish in first place.",
      "It is up to you to decide when to waste and when to race.",
      "And remember, 'Power' is an important factor in the game. You",
      "will need it whether you are racing or wasting!",
    );
  }
  draw(picture("fixhoop.png"), 185, 218);
  draw(picture("arrow.gif"), 385, 228);
  font(11);
  text("The Electrified Hoop", 192, 216, BLACK);
  text("Jumping through it fixes your car.", 158, 338, BLACK);
  text("Make guidance arrow point to cars.", 385, 216, BLACK);
};

// The coach's page: who he is, the other keys (the original's radar key is this game's
// time rewind) and the music credits.
const drawCoach = () => {
  font(13);
  lines(
    INK,
    "And if you don’t know who I am,",
    "I am Coach Insano, I am the coach and narrator of this game!",
    null,
    null,
    "Good Luck & Have Fun!",
  );
  text("Other Controls :", 155, 205, BLACK);
  font(11);
  draw(picture("kz.gif"), 169, 229);
  text("OR", 206, 251, BLACK);
  draw(picture("kx.gif"), 229, 229);
  text("To look behind you while driving.", 267, 251, BLACK);
  draw(picture("kv.gif"), 169, 279);
  text("Change Views", 207, 301, BLACK);
  draw(picture("kenter.gif"), 169, 329);
  text("Navigate & Pause Game", 275, 351, BLACK);
  draw(picture("km.gif"), 489, 229);
  text("Mute Music", 527, 251, BLACK);
  draw(picture("kn.gif"), 489, 279);
  text("Mute Sound Effects", 527, 301, BLACK);
  font(13);
  text("[ R ]", 492, 351, BLACK);
  font(11);
  text("Rewind Time", 527, 351, BLACK);
  if (textButton(" Music Credits ", 489, 180)) {
    state.page = CREDITS;
  }
};

const drawMainControls = () => {
  font(13);
  centred(
    49,
    state.page == 16
      ? "M A I N    C O N T R O L S   -   once again!"
      : "M A I N    C O N T R O L S",
    BLACK,
  );
  text("Drive your car using the Arrow Keys:", 125, 80, BLACK);
  text("On the GROUND Spacebar is for Handbrake", 125, 101, BLACK);
  drawDriving(80);
  centred(175, "-".repeat(148), INK);
  font(13);
  text("To perform STUNTS:", 125, 200, BLACK);
  text("In the AIR press combo Spacebar + Arrow Keys", 125, 220, BLACK);
  drawStunting(210);
  draw(picture("stunts.png"), 125, 285);
};

const drawCredits = (credits) => {
  const [title, ...rows] = credits[state.page - CREDITS];
  font(13);
  centred(49, title, BLACK);
  rows.forEach((row, i) => text(row, 125, 90 + 30 * i, INK));
};

// The khaki background with the clouds faintly over it (light blue on the last page).
const drawBackdrop = (turnsBlue) => {
  drawMenuBackground(2, turnsBlue);
  screen.g.globalAlpha = 0.3;
  draw(picture("bggo.jpg"), 65, 25);
  screen.g.globalAlpha = 1;
  fill(735, 0, 65, 450, BLACK);
  fill(65, 425, 670, 25, BLACK);
  state.blink = !state.blink;
};

// Insano faintly, his mouth moving every other frame while he talks, and his bubble.
const drawTalkingInsano = () => {
  if (state.talks > 0) {
    if (state.blink) {
      state.face = Math.trunc(
        random.fx() * (random.fx() > random.fx() ? 3 : 2),
      );
    }
    state.talks--;
  } else {
    state.face = 0;
  }
  draw(picture(`d${state.face + 1}.png`), 95, 15, 0.4);
  draw(picture("float.gif"), 192, 42);
};

// The question whether to reset the game, which the original never asked: Insano asks it
// as on his instruction pages. Returns "reset", "cancel" or null.
export const drawClassicResetQuestion = (opening) => {
  if (opening) {
    state.talks = 200;
  }
  startScreen();
  drawBackdrop(false);
  drawTalkingInsano();
  font(13);
  text("Reset your Game", 262, 67, BLACK);
  lines(
    INK,
    null,
    "Would you like to play the game from the beginning again?",
    "Note! This will delete all your saved unlocked cars and stages",
    "and will start the game like it was never played before!",
    "Challenge yourself again and reset the game now?",
  );
  if (textButton(" Yes!  Reset my game now ", 300, 250)) {
    return "reset";
  }
  if (textButton(" Cancel ", 365, 300)) {
    return "cancel";
  }
  return null;
};

// back, next and continue: light yellow while held, clicked when let go on them
const imageButton = (file, x, y) => {
  const image = picture(file, state.pressed == file ? "pressed" : "plain");
  draw(image, x, y);
  if (overImage(image, x, y) && mouse.pressed) {
    state.pressed = file;
  }
  const clicked =
    mouse.released && state.pressed == file && overImage(image, x, y);
  if (mouse.released) {
    state.pressed = null;
  }
  return clicked;
};

// The screen for a tick, with this game's music credits (two pages of a title and its
// lines). Returns whether the instructions are over.
export const drawClassicInstructions = (credits) => {
  startScreen();
  drawBackdrop(state.page == 16);
  if (state.page != 1 && state.page != 16 && state.page < CREDITS) {
    drawTalkingInsano();
  }
  if (state.page == 3 || state.page == 5) {
    drawRacingOrWasting();
  }
  if (state.page == 7 || state.page == 9) {
    drawPower();
  }
  if (state.page == 11 || state.page == 13) {
    drawHoopAndArrow();
  }
  if (state.page == 15) {
    drawCoach();
  }
  if (state.page == 1 || state.page == 16) {
    drawMainControls();
  }
  if (state.page >= CREDITS) {
    drawCredits(credits);
  }
  const input = racers[0].u;
  let forward = input.right;
  let back = input.left;
  let enter = false;
  input.right = false;
  input.left = false;
  if (confirm.state == CONFIRM.pressed) {
    confirm.state = CONFIRM.used;
    enter = true;
  }
  const inCredits = state.page >= CREDITS;
  const lastCredits = CREDITS + credits.length - 1;
  const hasNext = inCredits ? state.page < lastCredits : state.page <= 15;
  if (hasNext && imageButton("next.gif", 665, 395)) {
    forward = true;
  }
  if (state.page >= 3 && imageButton("back.gif", 75, 395)) {
    back = true;
  }
  const finishing = inCredits ? state.page == lastCredits : state.page == 16;
  if (finishing && imageButton("continue.gif", 565, 395)) {
    enter = true;
  }
  if (inCredits) {
    // the credits lead back to the coach
    if (forward || enter) {
      state.page = state.page == lastCredits ? 15 : state.page + 1;
    } else if (back) {
      state.page = state.page == CREDITS ? 15 : state.page - 1;
    }
    return false;
  }
  if (enter && state.page == 16) {
    return true;
  }
  if ((forward || enter) && state.page <= 15) {
    state.page = state.page == 15 ? 16 : state.page + 2;
    state.talks = TALKS[state.page] ?? 0;
  } else if (back) {
    state.page = state.page == 16 ? 15 : Math.max(1, state.page - 2);
    state.talks = TALKS[state.page] ?? 0;
  }
  return false;
};
