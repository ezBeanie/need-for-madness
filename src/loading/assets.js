// Loading the game: models, textures, images and sounds, a few per frame, with a\nloading bar.

import { loadSound } from "../audio/audio.js";
import { interfaceResolution, isPhone } from "../core/platform.js";
import { random } from "../core/random.js";
import { PHASE, RACE_SIZES, game } from "../core/state.js";
import { loadSetting } from "../core/storage.js";
import { raceEvents } from "../race/events.js";
import { pieceModels, track } from "../race/track.js";
import { cartextures, creatdustextures } from "../render/generated.js";
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
import { createwheels } from "../render/wheels.js";
import { menu } from "../screens/menuState.js";
import { hud } from "../ui/hud.js";
import { images } from "../ui/images.js";
import { rd, view } from "../ui/view.js";
import { drawSlantedBar } from "../ui/widgets.js";
import { loading } from "./progress.js";

// the picture above the loading bar, the first thing to load
const loadingPicture = new Image();
loadingPicture.src = "data/interface" + interfaceResolution + "/loading.png";

export function loaddata() {
  if (gl) {
    drawloading();
    if (loading.step == 0) {
      menu.continuesToCarSelect = false;
      game.carTypes[0] = loadSetting("carsel");
      if (game.carTypes[0] == -1) {
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
      if (track.stage == 17) {
        track.stage = Math.floor(3 + random.sim() * 13);
        menu.resetOffered = true;
      }
    }
    if (loading.step == 1) {
      loadModel("data/3D/ground.r3d", ground);
      for (var i = 0; i < 3; i++) {
        images.ground[i] = new Image();
        images.ground[i].onload = function () {
          loading.loaded += 17;
        };
        images.ground[i].src = "data/3D/textures/ground" + (i + 1) + ".png";
      }
      loadModel("data/3D/skydom.r3d", sky);
      for (var i = 0; i < 3; i++) {
        images.sky[i] = new Image();
        images.sky[i].onload = function () {
          loading.loaded += 24;
        };
        images.sky[i].src = "data/3D/textures/sky" + (i + 1) + ".png";
      }
      images.halo = new Image();
      images.halo.onload = function () {
        loading.loaded += 5;
      };
      images.halo.src = "data/3D/textures/halo.png";
    }
    if (loading.step == 2) {
      loadModel("data/3D/tiredisk.r3d", wheelDisk);
      loadParticleModel("data/3D/tire.prt", wheelTread);
      loadParticleModel("data/3D/tirelow.prt", wheelTreadLow);
      loadParticleModel("data/3D/cptext.prt", checkpointText);
      loadParticleModel("data/3D/fntext.prt", finishText);
      loadParticleModel("data/3D/timetube.prt", timeTube);

      loadParticleModel("data/3D/bg.prt", stageBackdrop);
    }
    if (loading.step == 3) {
      for (var i = 0; i < 19; i++) {
        loadModel("data/3D/car" + i + ".r3d", carModels[i]);
        loadModel("data/3D/s" + i + ".r3d", carShadows[i]);
        carTextures[i] = new Image();
        carTextures[i].onload = function () {
          loading.loaded += 9;
        };
        carTextures[i].src = "data/3D/textures/car" + i + ".png";
        images.tires[i] = new Image();
        images.tires[i].onload = function () {
          loading.loaded += 2;
        };
        images.tires[i].src = "data/3D/textures/t" + i + ".png";
      }
    }
    if (loading.step == 4) {
      var defb = [
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
      for (var i = 0; i < 66; i++) {
        if (i != 40) {
          loadModel("data/3D/" + defb[i] + ".r3d", pieceModels[i]);
        }
      }
    }
    if (loading.step == 5) {
      loadModel("data/3D/sprite.r3d", dustSprite);
      for (var i = 0; i < 3; i++) {
        images.sprites[i] = new Image();
        images.sprites[i].onload = function () {
          loading.loaded++;
        };
        images.sprites[i].src = "data/3D/textures/sp" + i + ".png";
      }
      loadModel("data/3D/fixdisk.r3d", fixHoop);
      loadModel("data/3D/elec.r3d", electricity);
      for (var i = 0; i < 3; i++) {
        loadModel("data/3D/exp" + i + ".r3d", explosionModels[i]);
      }
    }
    if (loading.step == 6) {
      for (var i = 0; i < 19; i++) {
        loadTextureGroup(textureGroups[i], i);
      }
    }
    if (loading.step == 7) {
      loadModel("data/3D/bg.r3d", menuBackdrop);

      if (isPhone) {
        for (var i = 0; i < 6; i++) {
          images.touchControls[i] = new Image();
          images.touchControls[i].onload = function () {
            loading.loaded++;
          };
          images.touchControls[i].src =
            "data/interface" + interfaceResolution + "/cn" + i + ".png";
        }
      }
      for (var i = 0; i < 7; i++) {
        images.buttons[i] = new Image();
        images.buttons[i].onload = function () {
          loading.loaded++;
        };
        images.buttons[i].src =
          "data/interface" + interfaceResolution + "/btn" + (i + 1) + ".png";
      }
      for (var i = 0; i < 6; i++) {
        images.soundToggles[i] = new Image();
        images.soundToggles[i].onload = function () {
          loading.loaded++;
        };
        images.soundToggles[i].src =
          "data/interface" + interfaceResolution + "/mu" + i + ".png";
      }
    }
    if (loading.step == 8) {
      images.loadingBarLeft = new Image();
      images.loadingBarLeft.onload = function () {
        loading.loaded++;
      };
      images.loadingBarLeft.src =
        "data/interface" + interfaceResolution + "/lbar.png";
      images.loadingBarRight = new Image();
      images.loadingBarRight.onload = function () {
        loading.loaded++;
      };
      images.loadingBarRight.src =
        "data/interface" + interfaceResolution + "/rbar.png";
      images.locked = new Image();
      images.locked.onload = function () {
        loading.loaded++;
      };
      images.locked.src =
        "data/interface" + interfaceResolution + "/locked.png";
      images.menuBackground = new Image();
      images.menuBackground.onload = function () {
        loading.loaded += 402;
      };
      images.menuBackground.src =
        "data/interface" + interfaceResolution + "/mainbg.png";
      images.rider = new Image();
      images.rider.onload = function () {
        loading.loaded += 14;
      };
      images.rider.src = "data/interface" + interfaceResolution + "/rider.png";
      images.logo = new Image();
      images.logo.onload = function () {
        loading.loaded += 20;
      };
      images.logo.src = "data/interface" + interfaceResolution + "/logo.png";

      for (var i = 0; i < 6; i++) {
        images.insano[i] = new Image();
        images.insano[i].onload = function () {
          loading.loaded += 20;
        };
        images.insano[i].src =
          "data/interface" + interfaceResolution + "/insano" + i + ".png";
      }
      for (var i = 0; i < 11; i++) {
        if (i < 5 || !isPhone || i == 8 || i == 10) {
          images.instructions[i] = new Image();
          images.instructions[i].onload = function () {
            loading.loaded += 13;
          };
          images.instructions[i].src = "data/interface1/int" + (i + 1) + ".png";
        }
      }
    }
    if (loading.step != 9) {
      loading.step++;
    }
    if (wheelDisk.loaded == 1) {
      loading.loaded++;
      wheelDisk.loaded++;
    }
    if (wheelTread.loaded == 1) {
      loading.loaded++;
      wheelTread.loaded++;
    }
    if (wheelTreadLow.loaded == 1) {
      loading.loaded++;
      wheelTreadLow.loaded++;
    }
    if (checkpointText.loaded == 1) {
      loading.loaded += 4;
      checkpointText.loaded++;
    }
    if (finishText.loaded == 1) {
      loading.loaded += 4;
      finishText.loaded++;
    }
    if (timeTube.loaded == 1) {
      loading.loaded++;
      timeTube.loaded++;
    }
    if (stageBackdrop.loaded == 1) {
      loading.loaded++;
      stageBackdrop.loaded++;
    }
    if (ground.loaded && ground.loaded == ground.nt + 1) {
      loading.loaded++;
      ground.loaded++;
    }
    if (sky.loaded && sky.loaded == sky.nt + 1) {
      loading.loaded++;
      sky.loaded++;
    }
    for (var i = 0; i < 19; i++) {
      if (carModels[i].loaded && carModels[i].loaded == carModels[i].nt + 1) {
        loading.loaded += 31;
        carModels[i].loaded++;
      }
    }
    for (var i = 0; i < 66; i++) {
      if (
        i != 40 &&
        pieceModels[i].loaded &&
        pieceModels[i].loaded == pieceModels[i].nt + 1
      ) {
        loading.loaded += 7;
        pieceModels[i].loaded++;
      }
    }
    for (var i = 0; i < 19; i++) {
      if (textureGroups[i].loaded == 1) {
        loading.loaded += 44;
        textureGroups[i].loaded++;
      }
    }
    if (dustSprite.loaded && dustSprite.loaded == dustSprite.nt + 1) {
      loading.loaded++;
      dustSprite.loaded++;
    }
    if (fixHoop.loaded && fixHoop.loaded == fixHoop.nt + 1) {
      loading.loaded++;
      fixHoop.loaded++;
    }
    if (electricity.loaded && electricity.loaded == electricity.nt + 1) {
      loading.loaded++;
      electricity.loaded++;
    }
    for (var i = 0; i < 3; i++) {
      if (
        explosionModels[i].loaded &&
        explosionModels[i].loaded == explosionModels[i].nt + 1
      ) {
        loading.loaded += 18;
        explosionModels[i].loaded++;
      }
    }
    if (menuBackdrop.loaded && menuBackdrop.loaded == menuBackdrop.nt + 1) {
      loading.loaded += 309;
      menuBackdrop.loaded++;
    }
    if (loading.loaded == loading.total) {
      cartextures();
      createwheels();
      creatdustextures();
      for (var i = 0; i < 43; i++) {
        loadSound(i);
      }

      menu.animation = 0;
      game.phase = PHASE.mainMenu;
    }
  } else {
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
  }
}
function drawloading() {
  var grd = rd.createLinearGradient(0, 0, view.width, view.height);
  grd.addColorStop(0, "#A87700");
  grd.addColorStop(1, "#9A3300");
  rd.fillStyle = grd;
  rd.fillRect(0, 0, view.width, view.height);
  var perc = loading.loaded / loading.total;
  if (perc > 1) {
    perc = 1;
  }
  if (perc < 0.076) {
    perc = 0.076;
  }
  rd.drawImage(
    loadingPicture,
    640 * view.scaleX - 107 * view.scale,
    100 * view.scaleY,
    215 * view.scale,
    248 * view.scale,
  );
  rd.lineWidth = 4 * view.scale;
  drawSlantedBar({
    x: 640 * view.scaleX,
    y: 100 * view.scaleY + 248 * view.scale + 20 * view.scaleY,
    width: 300,
    height: 25,
    fillFrom: "#FF3D01",
    fillTo: "#EAFF01",
    outline: "#7BAE00",
    filled: perc,
  });
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
      100 * view.scaleY +
        248 * view.scale +
        20 * view.scaleY +
        70 * view.scaleY,
    );
  }
}
