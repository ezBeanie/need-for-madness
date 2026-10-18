// Loading the game: the saved settings, then models, textures, images and sounds, one batch
// per tick, while a loading bar fills.

import { loadSound } from "../audio/audio.js";
import { interfaceResolution, isPhone } from "../core/platform.js";
import { random } from "../core/random.js";
import { PHASE, RACE_SIZES, game } from "../core/state.js";
import { loadSetting } from "../core/storage.js";
import { raceEvents } from "../race/events.js";
import { pieceModels, track } from "../race/track.js";
import { menuCarTextures, createDustTextures } from "../render/generated.js";
import { loadModel, loadParticleModel } from "../render/models.js";
import { gl, loadTextureGroup, textureGroups } from "../render/renderer.js";
import {
  carModels,
  carShadows,
  carTextures,
  checkpointText,
  dustSprite,
  electricity,
  explosionModels,
  finishText,
  fixHoop,
  ground,
  menuBackdrop,
  sky,
  stageBackdrop,
  timeTube,
  wheelDisk,
  wheelTread,
  wheelTreadLow,
} from "../render/scene.js";
import { createWheels } from "../render/wheels.js";
import { menu } from "../screens/menuState.js";
import { hud } from "../ui/hud.js";
import { images } from "../ui/images.js";
import { rd, view } from "../ui/view.js";
import { drawSlantedBar } from "../ui/widgets.js";
import { loading } from "./progress.js";

const CAR_TYPES = 19;
const LAST_STAGE = 17;
const SOUNDS = 43;
// the texture groups with files (renderer.js keeps one more)
const TEXTURE_GROUPS = 19;

// the stage pieces, by type; piece 40 (launchpad) is not loaded, as in the original
const PIECE_FILES = [
  "road",
  "froad",
  "twister2",
  "twister1",
  "turn",
  "offroad",
  "bumproad",
  "offturn",
  "nroad",
  "nturn",
  "roblend",
  "noblend",
  "rnblend",
  "roadend",
  "offroadend",
  "hpground",
  "ramp30",
  "cramp35",
  "dramp15",
  "dhilo15",
  "slide10",
  "takeoff",
  "sramp22",
  "offbump",
  "offramp",
  "sofframp",
  "halfpipe",
  "spikes",
  "rail",
  "thewall",
  "checkpoint",
  "fixpoint",
  "offcheckpoint",
  "sideoff",
  "bsideoff",
  "uprise",
  "riseroad",
  "sroad",
  "soffroad",
  "tside",
  "launchpad",
  "takeoffb",
  "speedramp",
  "offhill",
  "slider",
  "uphill",
  "roll1",
  "roll2",
  "roll3",
  "roll4",
  "roll5",
  "roll6",
  "opile1",
  "opile2",
  "aircheckpoint",
  "tree1",
  "tree2",
  "tree3",
  "tree4",
  "tree5",
  "tree6",
  "tree7",
  "tree8",
  "cac1",
  "cac2",
  "cac3",
];
const UNLOADED_PIECE = 40;

// the picture above the loading bar, the first thing to load
const loadingPicture = new Image();
loadingPicture.src = "data/interface" + interfaceResolution + "/loading.png";

const interfaceFile = (name) =>
  "data/interface" + interfaceResolution + "/" + name;

// An image that fills the loading bar by `weight` once it has loaded.
const loadImage = (src, weight) => {
  const image = new Image();
  image.onload = () => {
    loading.loaded += weight;
  };
  image.src = src;
  return image;
};

const readSettings = () => {
  menu.continuesToCarSelect = false;
  game.carTypes[0] = loadSetting("carsel");
  if (game.carTypes[0] == -1) {
    // a new player
    game.carTypes[0] = 5;
    menu.continuesToCarSelect = true;
    raceEvents.onautocorrect = 2;
  }
  game.unlocked = loadSetting("unlocked");
  if (game.unlocked == -1) {
    game.unlocked = 1;
  }
  game.raceCars = loadSetting("racecars");
  if (!RACE_SIZES.includes(game.raceCars)) {
    game.raceCars = 7;
  }
  track.stage = game.unlocked;
  if (game.unlocked >= 5) {
    hud.keyHintTicks = 200;
  }
  // after the last stage was won, a random stage is shown and the game can be reset
  if (track.stage == LAST_STAGE) {
    track.stage = Math.floor(3 + random.sim() * 13);
    menu.resetOffered = true;
  }
};

const requestGroundAndSky = () => {
  loadModel("data/3D/ground.r3d", ground);
  for (let i = 0; i < 3; i++) {
    images.ground[i] = loadImage(
      "data/3D/textures/ground" + (i + 1) + ".png",
      17,
    );
  }
  loadModel("data/3D/skydom.r3d", sky);
  for (let i = 0; i < 3; i++) {
    images.sky[i] = loadImage("data/3D/textures/sky" + (i + 1) + ".png", 24);
  }
  images.halo = loadImage("data/3D/textures/halo.png", 5);
};

const requestWheelsAndTexts = () => {
  loadModel("data/3D/tiredisk.r3d", wheelDisk);
  loadParticleModel("data/3D/tire.prt", wheelTread);
  loadParticleModel("data/3D/tirelow.prt", wheelTreadLow);
  loadParticleModel("data/3D/cptext.prt", checkpointText);
  loadParticleModel("data/3D/fntext.prt", finishText);
  loadParticleModel("data/3D/timetube.prt", timeTube);
  loadParticleModel("data/3D/bg.prt", stageBackdrop);
};

const requestCars = () => {
  for (let i = 0; i < CAR_TYPES; i++) {
    loadModel("data/3D/car" + i + ".r3d", carModels[i]);
    loadModel("data/3D/s" + i + ".r3d", carShadows[i]);
    carTextures[i] = loadImage("data/3D/textures/car" + i + ".png", 9);
    images.tires[i] = loadImage("data/3D/textures/t" + i + ".png", 2);
  }
};

const requestPieces = () => {
  PIECE_FILES.forEach((file, i) => {
    if (i != UNLOADED_PIECE) {
      loadModel("data/3D/" + file + ".r3d", pieceModels[i]);
    }
  });
};

const requestEffects = () => {
  loadModel("data/3D/sprite.r3d", dustSprite);
  for (let i = 0; i < 3; i++) {
    images.sprites[i] = loadImage("data/3D/textures/sp" + i + ".png", 1);
  }
  loadModel("data/3D/fixdisk.r3d", fixHoop);
  loadModel("data/3D/elec.r3d", electricity);
  for (let i = 0; i < 3; i++) {
    loadModel("data/3D/exp" + i + ".r3d", explosionModels[i]);
  }
};

const requestTextureGroups = () => {
  for (let i = 0; i < TEXTURE_GROUPS; i++) {
    loadTextureGroup(textureGroups[i], i);
  }
};

const requestMenuBackdropAndButtons = () => {
  loadModel("data/3D/bg.r3d", menuBackdrop);
  if (isPhone) {
    for (let i = 0; i < 6; i++) {
      images.touchControls[i] = loadImage(interfaceFile("cn" + i + ".png"), 1);
    }
  }
  for (let i = 0; i < 7; i++) {
    images.buttons[i] = loadImage(interfaceFile("btn" + (i + 1) + ".png"), 1);
  }
  for (let i = 0; i < 6; i++) {
    images.soundToggles[i] = loadImage(interfaceFile("mu" + i + ".png"), 1);
  }
};

const requestInterfaceImages = () => {
  images.loadingBarLeft = loadImage(interfaceFile("lbar.png"), 1);
  images.loadingBarRight = loadImage(interfaceFile("rbar.png"), 1);
  images.locked = loadImage(interfaceFile("locked.png"), 1);
  images.menuBackground = loadImage(interfaceFile("mainbg.png"), 402);
  images.rider = loadImage(interfaceFile("rider.png"), 14);
  images.logo = loadImage(interfaceFile("logo.png"), 20);
  for (let i = 0; i < 6; i++) {
    images.insano[i] = loadImage(interfaceFile("insano" + i + ".png"), 20);
  }
  for (let i = 0; i < 11; i++) {
    // phones leave out the keyboard pictures
    if (i < 5 || !isPhone || i == 8 || i == 10) {
      images.instructions[i] = loadImage(
        "data/interface1/int" + (i + 1) + ".png",
        13,
      );
    }
  }
};

const BATCHES = [
  readSettings,
  requestGroundAndSky,
  requestWheelsAndTexts,
  requestCars,
  requestPieces,
  requestEffects,
  requestTextureGroups,
  requestMenuBackdropAndButtons,
  requestInterfaceImages,
];

// Models fill the loading bar once they are complete: particle models when loaded is 1,
// models when all their textures (nt) are in. Counting moves loaded on, so each counts
// once.
const countParticleModel = (model, weight) => {
  if (model.loaded == 1) {
    loading.loaded += weight;
    model.loaded++;
  }
};

const countModel = (model, weight) => {
  if (model.loaded && model.loaded == model.nt + 1) {
    loading.loaded += weight;
    model.loaded++;
  }
};

const countLoaded = () => {
  countParticleModel(wheelDisk, 1);
  countParticleModel(wheelTread, 1);
  countParticleModel(wheelTreadLow, 1);
  countParticleModel(checkpointText, 4);
  countParticleModel(finishText, 4);
  countParticleModel(timeTube, 1);
  countParticleModel(stageBackdrop, 1);
  countModel(ground, 1);
  countModel(sky, 1);
  carModels.forEach((model) => countModel(model, 31));
  pieceModels.forEach((model, i) => {
    if (i != UNLOADED_PIECE) {
      countModel(model, 7);
    }
  });
  textureGroups
    .slice(0, TEXTURE_GROUPS)
    .forEach((group) => countParticleModel(group, 44));
  countModel(dustSprite, 1);
  countModel(fixHoop, 1);
  countModel(electricity, 1);
  explosionModels.forEach((model) => countModel(model, 18));
  countModel(menuBackdrop, 309);
};

export function loadAssets() {
  if (!gl) {
    drawNoWebGL();
    return;
  }
  drawLoadingBar();
  if (loading.step < BATCHES.length) {
    BATCHES[loading.step]();
    loading.step++;
  }
  countLoaded();
  if (loading.loaded == loading.total) {
    menuCarTextures();
    createWheels();
    createDustTextures();
    for (let i = 0; i < SOUNDS; i++) {
      loadSound(i);
    }
    menu.animation = 0;
    game.phase = PHASE.mainMenu;
  }
}

const drawLoadingBar = () => {
  const gradient = rd.createLinearGradient(0, 0, view.width, view.height);
  gradient.addColorStop(0, "#A87700");
  gradient.addColorStop(1, "#9A3300");
  rd.fillStyle = gradient;
  rd.fillRect(0, 0, view.width, view.height);
  const filled = Math.max(Math.min(loading.loaded / loading.total, 1), 0.076);
  rd.drawImage(
    loadingPicture,
    640 * view.scaleX - 107 * view.scale,
    100 * view.scaleY,
    215 * view.scale,
    248 * view.scale,
  );
  rd.lineWidth = 4 * view.scale;
  const barY = 100 * view.scaleY + 248 * view.scale + 20 * view.scaleY;
  drawSlantedBar({
    x: 640 * view.scaleX,
    y: barY,
    width: 300,
    height: 25,
    fillFrom: "#FF3D01",
    fillTo: "#EAFF01",
    outline: "#7BAE00",
    filled,
  });
  // only once the game's font has loaded (it draws "crazy game" wider)
  rd.font = "18px junk";
  rd.letterSpacing = "1px";
  if (rd.measureText("crazy game").width > 102) {
    rd.fillStyle = "#BCD800";
    rd.font = "" + 30 * view.scale + "px junk";
    rd.textBaseline = "middle";
    rd.letterSpacing = "1px";
    rd.textAlign = "center";
    rd.fillText(
      "This Game Is Crazy !",
      640 * view.scaleX,
      barY + 70 * view.scaleY,
    );
  }
};

const drawNoWebGL = () => {
  rd.fillStyle = "#000000";
  rd.fillRect(0, 0, view.width, view.height);
  rd.font = "" + 20 * (view.scaleY + view.scaleX) + "px teko";
  rd.textAlign = "left";
  rd.textBaseline = "middle";
  rd.fillStyle = "#FFFFFF";
  rd.fillText(
    "Sorry, your device does not seem to have WEBGL",
    30 * view.scaleX,
    100 * view.scaleY,
  );
  rd.fillText(
    "The game will not be able to work without it",
    30 * view.scaleX,
    160 * view.scaleY,
  );
  rd.fillText(
    "Please try the game on another device",
    30 * view.scaleX,
    220 * view.scaleY,
  );
};
