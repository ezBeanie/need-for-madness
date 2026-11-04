// The stage select: the camera falls onto the stage and then follows its path, framed by a
// jagged border with the stage's name and buttons. Also the screen while a stage loads.

import {
  collections,
  LAST_STAGE,
  collectionOf,
  firstOfCollection,
  ownStage,
  stageAfter,
  stageBefore,
  stageLabel,
  stageNumber,
} from "../data/stages.js";
import {
  isEngineLoaded,
  loadEngine,
  pauseMenuMusic,
  playStageMusic,
} from "../audio/audio.js";
import {
  drawClassicLoading,
  drawClassicStageSelect,
} from "../classic/stageSelect.js";
import { cosDeg, sinDeg } from "../core/math.js";
import { random } from "../core/random.js";
import { MODE, PHASE, RACE_KIND, game, raceSetup } from "../core/state.js";
import { nextStrength } from "../race/career.js";
import { bestTimes, formatTime } from "../race/timeAttack.js";
import { applyFieldSize, nextRaceSize } from "../race/field.js";
import {
  AFTER_LOAD,
  STAGE_LOAD,
  loadStage,
  stageLoad,
} from "../loading/stageLoad.js";
import { CONFIRM, confirm } from "../input/confirm.js";
import { flashIntoRace } from "../race/countdown.js";
import { raceEvents } from "../race/events.js";
import { racers } from "../race/racers.js";
import { spinFixHoops, track } from "../race/track.js";
import {
  camera,
  faceCamera,
  startProjection,
  turnView,
} from "../render/camera.js";
import { classicMenus } from "../render/look.js";
import { setWorld } from "../render/renderer.js";
import { colorStageBackdrop, scene, stageBackdrop } from "../render/scene.js";
import { backdropHue, cssRgb, hslToRgb, rgbToHsl } from "../ui/color.js";
import { images } from "../ui/images.js";
import {
  drawInsano,
  fillSpeechBubble,
  insano,
  insanoScale,
  pickTalkingPicture,
  startBubbleText,
  writeBubbleLines,
} from "../ui/insano.js";
import { canvas2D, rd, view } from "../ui/view.js";
import {
  BUTTON,
  TEXT,
  blink,
  drawButton,
  drawCenteredText,
  drawMusicToggle,
  fillRoundedRect,
  pressOn,
  fillScaledShape,
  pulseButtons,
  strokeScaledPolygon,
} from "../ui/widgets.js";
import { menu } from "./menuState.js";
import { showOpenedReplay } from "./replays.js";
import { showHostedRace } from "../net/guest.js";
import { loadConfetti } from "./raceEnd.js";

export const stageSelect = {
  // the stage is hidden while another one starts loading
  hiddenTicks: 0,
};

const FIRST_STAGE = 1;
// the stage whose guidance arrow is switched off
const NO_ARROW_STAGE = 16;
// from here on, won stages can also be played in switch mode
const FIRST_SWITCH_STAGE = 3;

const inCampaign = () => raceSetup.kind == RACE_KIND.campaign;
const quickRace = () => raceSetup.kind == RACE_KIND.quickRace;
// practice and time attack race alone
const alone = () =>
  raceSetup.kind == RACE_KIND.practice ||
  raceSetup.kind == RACE_KIND.timeAttack;
// the campaign races this game's own stages only, the others every collection
const shownCollections = () =>
  inCampaign() ? collections().slice(0, 1) : collections();
// the campaign goes no further than the stages it opened
const hasNext = () =>
  stageAfter(track.stage) && (!inCampaign() || track.stage < game.unlocked);

const STRENGTH_NAMES = ["Easy", "Normal", "Hard"];

// The camera falls from FALL_FROM to FALL_TO above the stage while it turns and moves its
// view to the stage's first path point. Then it follows the path, one point every
// POINT_TICKS ticks.
const FALL_FROM = 4500;
const FALL_TO = 500;
const POINT_TICKS = 10;
let height = FALL_FROM;
let fallSpeed = 0;
let lookAtX = 0;
let lookAtZ = 0;
let lookAtStepX = 0;
let lookAtStepZ = 0;
let pathPoint = 0;
let pathTicks = -10;

let showingTip = false;
// the PLAY button flashes in the opposite hue for 9 of every 40 frames
let playFlashTicks = 0;

// the loading screen fades in; between two stages it shows the picture of the last one
let loadingFade = 0;
let pictureLeft = null;

const colorBackdrop = () => {
  const hue = backdropHue();
  colorStageBackdrop(hslToRgb(hue, 1, 0.94), hslToRgb(hue, 1, 0.7));
};

export function stageSelectTick() {
  const classic = classicMenus();
  if (classic) {
    classicProjection();
  } else {
    startProjection();
  }
  // (the original's camera came 75 lower)
  camera.y = height + (classic ? 25 : 100);
  camera.x = lookAtX - 1700 * sinDeg(camera.yaw);
  camera.z = lookAtZ + 1700 * cosDeg(camera.yaw);
  if (height > FALL_TO) {
    fall();
  } else {
    followPath();
  }
  if (camera.orbitAngle > 360) {
    camera.orbitAngle -= 360;
  }
  camera.yaw = camera.orbitAngle;
  spinFixHoops();
  raceEvents.checkpointFlash++;
  if (raceEvents.checkpointFlash >= 5) {
    raceEvents.checkpointFlash = 0;
  }
  faceCamera(stageBackdrop);
  stageBackdrop.mat[0] *= view.aspect * 0.5625;
  stageBackdrop.mat[1] *= view.aspect * 0.5625;
  stageBackdrop.mat[2] *= view.aspect * 0.5625;
  stageBackdrop.x = camera.x - 106 * stageBackdrop.mat[8];
  stageBackdrop.y = camera.y - 106 * stageBackdrop.mat[9];
  stageBackdrop.z = camera.z - 106 * stageBackdrop.mat[10];
  turnView();
  drawStageSelect();
  menu.redraw = true;
}

// The classic look's wider view, as the original's (its focus 400), and its slow zoom in
// and out while the camera follows the path, to a new goal between 0.35 and 1.65 of it
// whenever it gets there.
const zoom = { now: 1, goal: 1 };

const classicProjection = () => {
  if (height > FALL_TO) {
    zoom.now = 1;
    zoom.goal = 1;
  } else if (Math.abs(zoom.now - zoom.goal) > 0.005) {
    zoom.now += zoom.now < zoom.goal ? 0.005 : -0.005;
  } else {
    zoom.goal = 0.35 + random.fx() * 1.3;
  }
  camera.matrix = mat4.create();
  mat4.perspective(
    camera.matrix,
    2 * Math.atan(225 / (400 * zoom.now)),
    view.aspect,
    0.1,
    7000,
  );
};

const fall = () => {
  if (height == FALL_FROM) {
    pathPoint = 0;
    pathTicks = 0;
    camera.pitch = 67;
    lookAtStepX = (track.x[0] - lookAtX) / 116;
    lookAtStepZ = (track.z[0] - lookAtZ) / 116;
  }
  height -= fallSpeed;
  fallSpeed += 0.7;
  lookAtX += lookAtStepX;
  lookAtZ += lookAtStepZ;
  // close to the ground the camera raises its view
  if (height < 1760) {
    camera.pitch -= 2;
  }
  if (fallSpeed > 50) {
    fallSpeed = 50;
  }
  if (height <= FALL_TO) {
    height = FALL_TO;
    fallSpeed = 0;
  }
  camera.orbitAngle += 3;
};

const followPath = () => {
  camera.orbitAngle++;
  lookAtX -= (lookAtX - track.x[pathPoint]) / 10;
  lookAtZ -= (lookAtZ - track.z[pathPoint]) / 10;
  if (pathTicks == POINT_TICKS) {
    pathPoint++;
    if (pathPoint == track.n) {
      pathPoint = 0;
    }
    pathTicks = 0;
  } else {
    pathTicks++;
  }
};

// The loading screen before a stage: it requests the stage file once the screen is shown.
export function stageLoadingTick() {
  rd.clearRect(0, 0, view.width, view.height);
  if (
    stageLoad.progress == STAGE_LOAD.screenShown &&
    (menu.redraw ||
      stageLoad.after == AFTER_LOAD.race ||
      stageLoad.after == AFTER_LOAD.replay ||
      stageLoad.after == AFTER_LOAD.guest ||
      stageLoad.after == AFTER_LOAD.room)
  ) {
    loadStage();
    if (!isEngineLoaded(game.carTypes[0])) {
      loadEngine(game.carTypes[0]);
    }
  }
  if (stageLoad.progress == STAGE_LOAD.requested) {
    loadingFade = 0.2;
    stageLoad.progress = STAGE_LOAD.screenShown;
  }
  if (classicMenus()) {
    // the original shows its title only when loading for the stage select
    drawClassicLoading(stageLoad.after != AFTER_LOAD.race);
  } else if (stageLoad.after == AFTER_LOAD.nextStage) {
    rd.drawImage(pictureLeft, 0, 0);
  } else {
    drawLoadingScreen();
  }
  if (stageLoad.progress == STAGE_LOAD.loaded) {
    if (stageLoad.after == AFTER_LOAD.replay) {
      showOpenedReplay();
    } else if (stageLoad.after == AFTER_LOAD.guest) {
      showHostedRace();
    } else if (stageLoad.after == AFTER_LOAD.room) {
      pauseMenuMusic();
      flashIntoRace();
    } else if (stageLoad.after != AFTER_LOAD.race) {
      openStageSelect();
    } else {
      game.carCount = 1;
      pauseMenuMusic();
      playStageMusic(track.stage);
      game.phase = PHASE.race;
    }
  }
}

const drawLoadingScreen = () => {
  rd.globalAlpha = loadingFade;
  rd.fillStyle = "#9FD3FF";
  rd.fillRect(0, 0, view.width, view.height);
  rd.globalAlpha = 1;
  loadingFade += 0.02;
  if (loadingFade > 0.4) {
    loadingFade = 0.4;
  }
  rd.letterSpacing = "1px";
  rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  rd.strokeStyle = "#2D9FFF";
  rd.lineWidth = 10 * view.scale;
  // the very first race does not tell which stage it is
  const text =
    stageLoad.after == AFTER_LOAD.stageSelect ||
    stageLoad.after == AFTER_LOAD.room
      ? "Loading " + stageLabel(track.stage)
      : "Loading Stage...";
  rd.strokeText(text, 640 * view.scaleX, 330 * view.scaleY);
  rd.fillStyle = "#C1E3FF";
  rd.fillText(text, 640 * view.scaleX, 330 * view.scaleY);
};

const openStageSelect = () => {
  stageSelect.hiddenTicks = 0;
  playFlashTicks = 0;
  height = FALL_FROM;
  colorBackdrop();
  createBorder();
  showingTip = false;
  if (track.tips.length) {
    insano.talkTicks = 0;
    insano.picture = 0;
  }
  game.phase = PHASE.stageSelect;
};

function drawStageSelect() {
  if (classicMenus()) {
    drawClassic();
    return;
  }
  rd.clearRect(0, 0, view.width, view.height);
  if (stageSelect.hiddenTicks && !showingTip) {
    drawHiddenStage();
  }
  if (!showingTip && track.tips.length && !stageSelect.hiddenTicks) {
    drawInsanoWithTip();
  }
  const hue = backdropHue();
  drawBorder(hue);
  if (!stageSelect.hiddenTicks) {
    drawTitles(hue);
    if (!showingTip) {
      drawControls(hue);
    } else {
      drawTip(hue);
    }
  } else if (stageLoad.progress == STAGE_LOAD.requested) {
    // another stage: its loading screen shows this one's picture
    pictureLeft = new Image();
    pictureLeft.src = canvas2D.toDataURL("image/png");
    stageLoad.after = AFTER_LOAD.nextStage;
    game.phase = PHASE.stageLoading;
  }
  drawMusicToggle();
}

// The classic look's stage select: the original's, with this game's own choices as its
// rounded buttons.
const drawClassic = () => {
  const input = racers[0].u;
  if (stageSelect.hiddenTicks) {
    stageLoad.after = AFTER_LOAD.nextStage;
    game.phase = PHASE.stageLoading;
    return;
  }
  const buttons = quickRace()
    ? [
        ["cars", ` ${game.raceCars} Cars  [C] `, 75, 30],
        [
          "strength",
          ` ${STRENGTH_NAMES[raceSetup.strength]} AI  [B] `,
          220,
          30,
        ],
      ]
    : [];
  if (track.tips.length) {
    buttons.push(["tip", showingTip ? " Okay " : " Tip ", 75, 392]);
  } else if (inCampaign() && (track.stage == 1 || track.stage == 2)) {
    buttons.push(["practice", " Practice ", 220, 392]);
  }
  if (switchOffered()) {
    buttons.push(["switch", " Play Switch ", 480, 392]);
  }
  let x = 75;
  shownCollections().forEach((label, collection) => {
    const current = collection == collectionOf(track.stage);
    const text = current ? ` > ${label} < ` : ` ${label} `;
    buttons.push([collection, text, x, 64]);
    x += Math.round(text.length * 6.6) + 14;
  });
  const chosen = drawClassicStageSelect({
    // as the original, the stage counted within its set (the tab above names the set)
    title:
      track.stage == LAST_STAGE
        ? "Final Stage  >"
        : `Stage ${stageNumber(track.stage)}  >`,
    name: track.name,
    first: track.stage == FIRST_STAGE,
    last: !hasNext(),
    buttons,
    tip: showingTip ? track.tips : null,
  });
  if (input.right || chosen == "next") {
    if (hasNext()) {
      showNextStage();
    }
    input.right = false;
  }
  if (input.left || chosen == "back") {
    if (track.stage > FIRST_STAGE) {
      showPreviousStage();
    }
    input.left = false;
  }
  if (Number.isInteger(chosen)) {
    showCollection(chosen);
  }
  browseCollections();
  if (chosen == "exit") {
    backToCarSelect();
  }
  if (chosen == "cars") {
    nextRaceSize();
  }
  if (chosen == "strength") {
    nextStrength();
  }
  if (chosen == "tip") {
    showingTip = !showingTip;
  }
  if (chosen == "practice") {
    practise();
  }
  if (chosen == "switch") {
    playSwitch();
  }
  if (chosen == "continue" || confirm.state == CONFIRM.pressed) {
    confirm.state = CONFIRM.used;
    play();
  }
  if (track.stage == LAST_STAGE) {
    loadConfetti();
  }
};

// The next stage's name while it starts loading.
const drawHiddenStage = () => {
  rd.globalAlpha = 0.5;
  rd.fillStyle = "#9FD3FF";
  rd.fillRect(0, 0, view.width, view.height);
  rd.globalAlpha = 1;
  rd.letterSpacing = "1px";
  rd.font = "" + 22 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  rd.fillStyle = "#00284A";
  rd.fillText(
    "Loading " + stageLabel(track.stage),
    640 * view.scaleX,
    330 * view.scaleY,
  );
};

// Insano in the bottom left corner, thinking of his tip and mumbling now and then.
const drawInsanoWithTip = () => {
  blink.on = !blink.on;
  if (insano.talkTicks > 50 && blink.on) {
    pickTalkingPicture();
  }
  insano.talkTicks++;
  if (insano.talkTicks >= 67) {
    insano.talkTicks = 0;
  }
  rd.globalAlpha = 0.6;
  rd.drawImage(
    images.insano[insano.picture],
    70 * view.scaleX,
    720 * view.scaleY - 222 * view.scale,
    274 * view.scale * 0.8,
    341 * view.scale * 0.8,
  );
  rd.globalAlpha = 1;
  // a thought bubble: a small one, then the one the TIP button sits in
  rd.globalAlpha = 0.5;
  rd.fillStyle = "#FFFFFF";
  fillRoundedRect(
    70 * view.scaleX + 207 * view.scale,
    720 * view.scaleY - 115 * view.scale,
    30 * view.scale,
    30 * view.scale,
    10 * view.scale,
  );
  fillRoundedRect(
    70 * view.scaleX + 247 * view.scale,
    720 * view.scaleY - 170 * view.scale,
    225 * view.scale,
    90 * view.scale,
    20 * view.scale,
  );
  rd.globalAlpha = 1;
};

const drawBorder = (hue) => {
  rd.strokeStyle = cssRgb(hslToRgb(hue, 1, 0.3));
  rd.lineWidth = 10 * view.scale;
  strokeScaledPolygon(border.x, border.y, BORDER_POINTS);
  rd.fillStyle = cssRgb(hslToRgb(hue, 1, 0.4));
  // the screen outside the border, side by side
  fillScaledShape(0, 0, border.x, border.y, 0, 17, 1280, 0);
  fillScaledShape(1280, 0, border.x, border.y, 16, 26, 1280, 720);
  fillScaledShape(1280, 720, border.x, border.y, 25, 42, 0, 720);
  fillScaledShape(0, 720, border.x, border.y, 41, 51, 0, 0);
};

const drawTitles = (hue) => {
  rd.letterSpacing = "1px";
  rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  rd.strokeStyle = cssRgb(hslToRgb(hue, 1, 0.3));
  rd.lineWidth = 10 * view.scale;
  rd.strokeText(track.name, 640 * view.scaleX, 200 * view.scaleY);
  rd.fillStyle = cssRgb(hslToRgb(hue + 0.05, 1, 0.9));
  rd.fillText(track.name, 640 * view.scaleX, 200 * view.scaleY);
  if (track.stage == NO_ARROW_STAGE && !showingTip) {
    rd.letterSpacing = "0px";
    rd.font = "" + 12 * (view.scaleY + view.scaleX) + "px verd";
    rd.textBaseline = "middle";
    rd.textAlign = "center";
    rd.fillStyle = cssRgb(hslToRgb(hue, 1, 0.3));
    rd.fillText(
      "( Guidance arrow is disabled in this stage... )",
      640 * view.scaleX,
      260 * view.scaleY,
    );
  }
  rd.letterSpacing = "1px";
  rd.font = "" + 22 * (view.scaleY + view.scaleX) + "px junk";
  rd.textAlign = "center";
  rd.textBaseline = "middle";
  rd.lineWidth = 10 * view.scale;
  const title = stageTitle();
  rd.strokeText(title, 640 * view.scaleX, 120 * view.scaleY);
  rd.fillStyle = cssRgb(hslToRgb(hue - 0.05, 1, 0.6));
  rd.fillText(title, 640 * view.scaleX, 120 * view.scaleY);
  if (track.stage == LAST_STAGE) {
    // ready for the end of the game
    loadConfetti();
  }
};

// The colours of the buttons, in the hue of the stage.
const buttonColors = (hue) => ({
  faceTop: cssRgb(hslToRgb(hue - 0.05, 1, 0.5)),
  faceBottom: cssRgb(hslToRgb(hue + 0.05, 1, 0.6)),
  shadowTop: cssRgb(hslToRgb(hue - 0.05, 1, 0.2)),
  shadowBottom: cssRgb(hslToRgb(hue + 0.05, 1, 0.2)),
});

const showStage = (stage) => {
  track.stage = stage;
  stageLoad.progress = STAGE_LOAD.requested;
  stageSelect.hiddenTicks = 1;
};

// The next stage; after the last of this game's stages won, the original's first.
const showNextStage = () => {
  if (!ownStage(track.stage)) {
    showStage(stageAfter(track.stage));
  } else if (track.stage < game.unlocked) {
    showStage(track.stage + 1);
  } else {
    showStage(LAST_STAGE + 1);
  }
};

const showPreviousStage = () => {
  if (track.stage == LAST_STAGE + 1) {
    showStage(Math.min(game.unlocked, LAST_STAGE));
  } else {
    showStage(stageBefore(track.stage));
  }
};

// A collection's stage: of this game's own the last open one, of the original's sets
// the first.
const showCollection = (collection) => {
  if (collection == collectionOf(track.stage)) {
    return;
  }
  showStage(
    collection == 0
      ? Math.min(game.unlocked, LAST_STAGE)
      : firstOfCollection(collection),
  );
};

// The collection step after (1) or before (-1) this one, round and round.
const stepCollection = (step) => {
  const count = shownCollections().length;
  showCollection((collectionOf(track.stage) + step + count) % count);
};

// up and down: the collection before or after this one
const browseCollections = () => {
  const input = racers[0].u;
  const step = input.down ? 1 : input.up ? -1 : 0;
  if (step) {
    stepCollection(step);
  }
  input.up = false;
  input.down = false;
};

const stageTitle = () =>
  track.stage == LAST_STAGE ? "Final Stage" : stageLabel(track.stage);

// Won stages of this game's own can also be played in switch mode.
const switchOffered = () =>
  !alone() &&
  track.stage != game.unlocked &&
  track.stage >= FIRST_SWITCH_STAGE &&
  track.stage <= LAST_STAGE;

const drawControls = (hue) => {
  const colors = buttonColors(hue);
  const input = racers[0].u;
  if (input.right) {
    if (hasNext()) {
      showNextStage();
    }
    input.right = false;
  }
  if (input.left) {
    if (track.stage > FIRST_STAGE) {
      showPreviousStage();
    }
    input.left = false;
  }
  browseCollections();
  if (!inCampaign()) {
    drawCollectionPicker(colors, hue);
  }
  if (
    drawButton({
      id: 9,
      x: 210 * view.scale,
      y: 130 * view.scaleY,
      width: 150,
      height: 56,
      ...colors,
      layout: BUTTON.imageThenText,
      text: " Back",
      fontSize: 20,
      textOpacity: 0.7,
      image: images.buttons[5],
      imageOpacity: 0.7,
      pulsing: false,
    })
  ) {
    backToCarSelect();
  }
  if (quickRace()) {
    drawQuickRaceButtons(colors);
  }
  if (raceSetup.kind == RACE_KIND.timeAttack) {
    drawBestTimes(hue);
  }
  if (
    track.stage > FIRST_STAGE &&
    browseButton({
      id: 3,
      x: 190 * view.scale,
      colors,
      layout: BUTTON.imageThenText,
      text: " Prev",
      image: images.buttons[3],
    })
  ) {
    showPreviousStage();
  }
  if (
    hasNext() &&
    browseButton({
      id: 2,
      x: view.width - 190 * view.scale,
      colors,
      layout: BUTTON.textThenImage,
      text: "Next ",
      image: images.buttons[2],
    })
  ) {
    showNextStage();
  }
  if (!stageSelect.hiddenTicks) {
    if (track.tips.length) {
      drawTipButton(colors);
    } else if (inCampaign() && (track.stage == 1 || track.stage == 2)) {
      drawPracticeButton(colors);
    }
  }
  if (switchOffered()) {
    drawPlaySwitchButton(colors);
  }
  drawPlayButton(hue);
  if (confirm.state == CONFIRM.pressed) {
    play();
    confirm.state = CONFIRM.used;
  }
  pulseButtons();
};

// A quick race's field size and how strong its opponents are.
const drawQuickRaceButtons = (colors) => {
  const button = (id, y, text) =>
    drawButton({
      id,
      x: view.width - 225 * view.scale,
      y: y * view.scaleY,
      width: 230,
      height: 50,
      ...colors,
      layout: BUTTON.textOnly,
      text,
      fontSize: 18,
      textOpacity: 0.7,
      image: null,
      imageOpacity: 0,
      pulsing: false,
    });
  if (button(11, 105, `${game.raceCars} Cars  [C]`)) {
    nextRaceSize();
  }
  if (button(16, 165, `AI: ${STRENGTH_NAMES[raceSetup.strength]}  [B]`)) {
    nextStrength();
  }
};

// The stage's best times in time attack, under its collections, dark in the stage's hue.
const drawBestTimes = (hue) => {
  const best = bestTimes(track.stage);
  drawCenteredText(
    310,
    best
      ? `Best lap ${formatTime(best.lap)}   Best race ${formatTime(best.race)}`
      : "No best time yet",
    ...hslToRgb(hue, 1, 0.25),
    TEXT.heading,
  );
};

// The collection under the stage's name, between arrows to the one before and after
// (as up and down do); a tap on its name goes on to the next.
const drawCollectionPicker = (colors, hue) => {
  const label = collections()[collectionOf(track.stage)];
  const arrow = (id, side, text) =>
    drawButton({
      id,
      x: (640 + side * 130) * view.scaleX,
      y: 245 * view.scaleY,
      width: 50,
      height: 40,
      ...colors,
      layout: BUTTON.textOnly,
      text,
      fontSize: 15,
      textOpacity: 0.9,
      image: null,
      imageOpacity: 0,
      pulsing: false,
    });
  if (arrow(12, -1, "<")) {
    stepCollection(-1);
  }
  if (arrow(13, 1, ">")) {
    stepCollection(1);
  }
  drawCenteredText(272, label, ...hslToRgb(hue, 1, 0.25), TEXT.heading);
  const width = 180 * view.scale;
  const height = 40 * view.scale;
  if (
    pressOn(14, 640 * view.scaleX - width / 2, 245 * view.scaleY, width, height)
      .clicked
  ) {
    stepCollection(1);
  }
};

const browseButton = ({ id, x, colors, layout, text, image }) =>
  drawButton({
    id,
    x,
    y: 360 * view.scaleY,
    width: 140,
    height: 47,
    ...colors,
    layout,
    text,
    fontSize: 15,
    textOpacity: 0.9,
    image,
    imageOpacity: 0.9,
    pulsing: false,
  });

const backToCarSelect = () => {
  scene.tint = [0, -0.05, 0.6];
  setWorld(scene.tint, [0, 0, 0], 0, 0.866, -0.5, 10700);
  game.phase = PHASE.carSelect;
  rd.fillStyle = "#FFFFFF";
  rd.fillRect(0, 0, view.width, view.height);
};

const drawTipButton = (colors) => {
  if (
    drawButton({
      id: 6,
      x: 70 * view.scaleX + 357 * view.scale,
      y: 720 * view.scaleY - 157 * view.scale,
      width: 120,
      height: 60,
      ...colors,
      layout: BUTTON.textOnly,
      text: "TIP ",
      fontSize: 22,
      textOpacity: 0.9,
      image: null,
      imageOpacity: 0,
      pulsing: false,
    })
  ) {
    showingTip = true;
    insano.talkTicks = 0;
  }
};

// The first stages can be practised alone.
const drawPracticeButton = (colors) => {
  if (
    drawButton({
      id: 8,
      x: view.width - 510 * view.scale,
      y: 720 * view.scaleY - 180 * view.scale,
      width: 220,
      height: 60,
      ...colors,
      layout: BUTTON.textOnly,
      text: "Practice ",
      fontSize: 22,
      textOpacity: 0.9,
      image: null,
      imageOpacity: 0,
      pulsing: false,
    })
  ) {
    practise();
  }
};

const practise = () => {
  game.carCount = 1;
  // (switch mode, from a race before, has no place alone)
  game.mode = MODE.championship;
  pauseMenuMusic();
  flashIntoRace();
};

const drawPlaySwitchButton = (colors) => {
  if (
    drawButton({
      id: 10,
      x: view.width - 550 * view.scale,
      y: 720 * view.scaleY - 190 * view.scale,
      width: 300,
      height: 70,
      ...colors,
      layout: BUTTON.textThenImage,
      text: "PLAY SWITCH ",
      fontSize: 20,
      textOpacity: 0.9,
      image: images.buttons[1],
      imageOpacity: 0.9,
      pulsing: true,
    })
  ) {
    playSwitch();
  }
};

const playSwitch = () => {
  applyFieldSize();
  game.mode = MODE.switchCars;
  pauseMenuMusic();
  flashIntoRace();
};

// The hue of the stage's tint itself (not turned around), for the PLAY button's flash.
const tintHue = () => {
  const channel = (tint) =>
    Math.min(Math.max(Math.floor(128 + 128 * tint), 0), 255);
  return rgbToHsl(
    channel(scene.tint[0]),
    channel(scene.tint[1]),
    channel(scene.tint[2]),
  )[0];
};

const drawPlayButton = (hue) => {
  const flashing = playFlashTicks > 30;
  playFlashTicks++;
  if (playFlashTicks == 40) {
    playFlashTicks = 0;
  }
  if (
    drawButton({
      id: 1,
      x: view.width - 220 * view.scale,
      y: 720 * view.scaleY - 190 * view.scale,
      width: 200,
      height: 70,
      ...buttonColors(flashing ? tintHue() : hue),
      layout: BUTTON.textThenImage,
      text: "PLAY ",
      fontSize: 25,
      textOpacity: 0.9,
      image: images.buttons[1],
      imageOpacity: 0.9,
      pulsing: true,
    })
  ) {
    play();
  }
};

const play = () => {
  if (alone()) {
    practise();
    return;
  }
  applyFieldSize();
  game.mode = MODE.championship;
  pauseMenuMusic();
  flashIntoRace();
};

// Insano tells his tip in a big speech bubble.
const drawTip = (hue) => {
  const scale = insanoScale();
  const top = 260 * view.scaleY;
  blink.on = !blink.on;
  if (insano.talkTicks < 200) {
    if (blink.on) {
      pickTalkingPicture();
    }
    insano.talkTicks++;
  } else {
    insano.picture = 2;
  }
  drawInsano(scale, top);
  rd.fillStyle = "#FFFFFF";
  rd.globalAlpha = 0.6;
  fillSpeechBubble(200 * scale, top, 990 * scale, 300 * scale, 20 * scale);
  rd.globalAlpha = 1;
  startBubbleText(scale);
  writeBubbleLines(
    scale,
    top,
    track.tips.map((tip, i) => [36 + 50 * i, tip]),
  );
  if (
    drawButton({
      id: 6,
      x: 1140 * scale - 80 * view.scale,
      y: top + 210 * scale,
      width: 160,
      height: 60,
      ...buttonColors(hue),
      layout: BUTTON.textThenImage,
      text: "Okay ",
      fontSize: 21,
      textOpacity: 0.9,
      image: images.buttons[1],
      imageOpacity: 0.9,
      pulsing: false,
    })
  ) {
    showingTip = false;
    insano.talkTicks = 0;
  }
};

// The border: 50 points around the screen (in 1280x720 units, the first repeated as the
// 51st), each side jittered and with a few notches pushed inwards, which spare the titles,
// the buttons and Insano's tip.
const BORDER_POINTS = 50;
const border = { x: [], y: [] };

const createBorder = () => {
  const x = border.x;
  const y = border.y;
  let cooldown = 0;
  // top
  for (let i = 0; i < 16; i++) {
    x[i] = 50 + i * 73.75 + random.fx() * 60 - 30;
    y[i] = 50 + random.fx() * 30 - 15;
  }
  for (let i = 0; i < 14; i++) {
    if (
      cooldown == 0 &&
      Math.abs(y[i] - y[i + 1]) < 7 &&
      Math.abs(y[i] - y[i + 2]) < 7 &&
      (x[i + 1] < 460 || x[i + 1] > 820)
    ) {
      if (random.fx() > random.fx() || x[i + 1] > 820) {
        y[i + 1] += 30 + random.fx() * 30;
        x[i] = (x[i + 1] * 5 + x[i]) / 6;
        x[i + 2] = (x[i + 1] * 5 + x[i + 2]) / 6;
      }
      cooldown = 3;
    }
    if (cooldown != 0) {
      cooldown--;
    }
  }
  // right
  for (let i = 16; i < 25; i++) {
    x[i] = 1230 + random.fx() * 30 - 15;
    y[i] = 50 + (i - 16) * 68.88 + random.fx() * 60 - 30;
  }
  cooldown = 0;
  for (let i = 16; i < 23; i++) {
    if (
      cooldown == 0 &&
      Math.abs(x[i] - x[i + 1]) < 7 &&
      Math.abs(x[i] - x[i + 2]) < 7 &&
      y[i + 1] < 330
    ) {
      x[i + 1] -= 30 + random.fx() * 30;
      y[i] = (y[i + 1] * 5 + y[i]) / 6;
      y[i + 2] = (y[i + 1] * 5 + y[i + 2]) / 6;
      cooldown = 10;
    }
    if (cooldown != 0) {
      cooldown--;
    }
  }
  // bottom
  for (let i = 25; i < 41; i++) {
    x[i] = 1230 - (i - 25) * 73.75 + random.fx() * 60 - 30;
    y[i] = 670 + random.fx() * 30 - 15;
  }
  cooldown = 0;
  // left of the PLAY buttons, which reach further left on the first stages
  const notchesLeftOf = track.stage == 1 || track.stage == 2 ? 580 : 876;
  for (let i = 25; i < 39; i++) {
    if (
      cooldown == 0 &&
      Math.abs(y[i] - y[i + 1]) < 7 &&
      Math.abs(y[i] - y[i + 2]) < 7 &&
      x[i + 1] < notchesLeftOf &&
      (x[i + 1] > 572 || !track.tips.length)
    ) {
      if (random.fx() > random.fx()) {
        y[i + 1] -= 30 + random.fx() * 30;
        x[i] = (x[i + 1] * 5 + x[i]) / 6;
        x[i + 2] = (x[i + 1] * 5 + x[i + 2]) / 6;
      }
      cooldown = 3;
    }
    if (cooldown != 0) {
      cooldown--;
    }
  }
  // left
  for (let i = 41; i < 50; i++) {
    x[i] = 50 + random.fx() * 30 - 15;
    y[i] = 670 - (i - 41) * 68.88 + random.fx() * 60 - 30;
  }
  cooldown = 0;
  for (let i = 41; i < 48; i++) {
    if (
      cooldown == 0 &&
      Math.abs(x[i] - x[i + 1]) < 7 &&
      Math.abs(x[i] - x[i + 2]) < 7 &&
      (y[i + 1] < 330 || y[i + 1] > 450)
    ) {
      if (random.fx() > random.fx()) {
        x[i + 1] += 30 + random.fx() * 30;
        y[i] = (y[i + 1] * 5 + y[i]) / 6;
        y[i + 2] = (y[i + 1] * 5 + y[i + 2]) / 6;
      }
      cooldown = 3;
    }
    if (cooldown != 0) {
      cooldown--;
    }
  }
  x[BORDER_POINTS] = x[0];
  y[BORDER_POINTS] = y[0];
};
