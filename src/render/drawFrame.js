// What each display frame draws in 3D: the race (also its replays, rewinding time and the
// switch screen), the car select, the stage select and the car a stage unlocked. A scene
// is drawn once a logic tick has moved it (menu.redraw), then every frame of its phase.

import {
  drawClassicCar,
  drawClassicRace,
  drawClassicStage,
} from "../classic/frame.js";
import { random } from "../core/random.js";
import { MODE, PHASE, RACE_PHASES, game } from "../core/state.js";
import { raceEvents } from "../race/events.js";
import { effects } from "../race/effects.js";
import { paintDents } from "../race/physics.js";
import { car, racers } from "../race/racers.js";
import { pieceModels, pieces, track } from "../race/track.js";
import { menu } from "../screens/menuState.js";
import { UNLOCKED_CAR_SHOWN } from "../screens/raceEnd.js";
import { stageSelect } from "../screens/stageSelect.js";
import { camera } from "./camera.js";
import { attachTo, interpolation, placeCamera } from "./interpolation.js";
import { LOOK, look } from "./look.js";
import { CLASSIC_FLOOR } from "../classic/carSelect.js";
import { CLASSIC_UNLOCKED_FLOOR } from "../classic/raceEnd.js";
import {
  captureFrozen,
  frozenWanted,
  presentScreen,
} from "../classic/screen.js";
import { drawModel, drawParticle, gl } from "./renderer.js";
import {
  carModels,
  carShadows,
  checkpointText,
  dustSprite,
  dustTextures,
  electricity,
  explosionModels,
  finishText,
  fixHoop,
  ground,
  menuBackdrop,
  menuSmoke,
  showcaseWheels,
  sky,
  sparkModels,
  spriteTextures,
  stageBackdrop,
  timeTube,
  wheelDisks,
  wheelTreads,
  wheelTreadsLow,
} from "./scene.js";

// about 2 ms per frame for scratching car damage into textures (see paintDents)
const SCRATCH_STEPS_PER_FRAME = 100000;
// wheels farther from the camera get the low-detail tread
const NEAR_WHEEL = 250;
// the walls around a stage are drawn from inside
const WALL = 29;

// the phase whose scene was drawn from a finished logic tick, and the phase of the last
// frame
let drawnPhase = -1;
let lastPhase = -1;

export function render() {
  interpolation.frame++;
  paintDents(SCRATCH_STEPS_PER_FRAME);
  if (game.phase != lastPhase) {
    drawnPhase = -1;
    lastPhase = game.phase;
  }
  placeCamera(camera.x, camera.y, camera.z, camera.matrix);
  // the classic look draws races the original game's way (see classic/frame.js)
  const classicRace =
    look.current == LOOK.classic && RACE_PHASES.includes(game.phase);
  if (RACE_PHASES.includes(game.phase)) {
    drawWhenDue(classicRace ? drawClassicRace : drawRace);
  }
  if (game.phase == PHASE.carSelect) {
    drawWhenDue(drawCarSelect);
  }
  if (game.phase == PHASE.stageSelect) {
    drawWhenDue(drawStageSelect);
  }
  if (game.phase == PHASE.raceEnd && menu.animation == UNLOCKED_CAR_SHOWN) {
    drawWhenDue(drawUnlockedCar);
  }
  // the race stood still for the classic pause or race end
  if (look.current == LOOK.classic && frozenWanted()) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    drawClassicRace();
    captureFrozen();
  }
  // a classic menu's screen, with the 3D just drawn in its middle
  presentScreen();
}

const drawWhenDue = (drawScene) => {
  if (menu.redraw || drawnPhase == game.phase) {
    drawnPhase = game.phase;
    // the classic menus show their pictures through it
    const seeThrough =
      look.current == LOOK.classic && !RACE_PHASES.includes(game.phase);
    gl.clearColor(0.0, 0.0, 0.0, seeThrough ? 0.0 : 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // the background first, behind everything
    gl.disable(gl.DEPTH_TEST);
    drawScene();
    menu.redraw = false;
  }
};

const startDepth = () => {
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
};

// Moves a shared model to where an instance is, before drawing it.
const placeAt = (model, at) => {
  model.x = at.x;
  model.y = at.y;
  model.z = at.z;
  model.mat = at.mat;
};

const drawPiece = (piece) => {
  const model = pieceModels[piece.typ];
  placeAt(model, piece);
  drawModel(model);
};

// Checkpoints flash dark and light (on the race: only the next one).
const flashCheckpoint = (piece, flashes) => {
  const model = pieceModels[piece.typ];
  if (
    flashes &&
    (Math.round(raceEvents.checkpointFlash) == 0 ||
      raceEvents.checkpointFlash == 1)
  ) {
    if (Math.round(raceEvents.checkpointFlash) == 0) {
      model.ownshade = true;
    } else {
      model.ownlight = true;
    }
  } else {
    model.ownshade = false;
    model.ownlight = false;
  }
};

const drawFixHoops = () => {
  for (let i = 0; i < pieces.fixCount; i++) {
    placeAt(fixHoop, pieces.list[pieces.fixes[i]]);
    drawModel(fixHoop);
  }
};

// A car with its wheels: the wheels follow the parent's movement between ticks, the treads
// come before the body and the disks after it.
const drawWheeledCar = (type, parent, wheels, body, near) => {
  for (const wheel of wheels) {
    attachTo(wheel.mat, parent);
  }
  wheels.forEach((wheel, w) => {
    const axle = w < 2 ? 0 : 1;
    const tread = (near(wheel) ? wheelTreads : wheelTreadsLow)[type][axle];
    placeAt(tread, wheel);
    drawParticle(tread);
  });
  if (body !== parent) {
    placeAt(body, parent);
  }
  drawModel(body);
  wheels.forEach((wheel, w) => {
    const disk = wheelDisks[type][w < 2 ? 0 : 1];
    placeAt(disk, wheel);
    drawModel(disk);
  });
};

const drawShowcaseCar = (classicFloor = null) => {
  const type = game.carTypes[0];
  if (look.current == LOOK.classic) {
    drawClassicCar(carModels[type], type, classicFloor);
    return;
  }
  drawWheeledCar(
    type,
    carModels[type],
    showcaseWheels[type],
    carModels[type],
    () => true,
  );
};

const drawRace = () => {
  drawModel(ground);
  drawModel(sky);
  if (game.phase == PHASE.timeRewind) {
    drawParticle(timeTube);
  }
  startDepth();
  for (let i = 0; i < pieces.count; i++) {
    const piece = pieces.list[i];
    if (piece.iscp) {
      flashCheckpoint(piece, raceEvents.oncheckpoint + 1 == piece.iscp);
    }
    if (piece.typ == WALL) {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.FRONT);
    }
    drawPiece(piece);
    if (piece.typ == WALL) {
      gl.disable(gl.CULL_FACE);
    }
  }
  for (let i = 0; i < effects.sparkCount; i++) {
    const spark = effects.sparks[i];
    if (spark.stat != 0) {
      const model = sparkModels[spark.typ];
      placeAt(model, spark);
      drawParticle(model);
    }
  }
  for (let c = 0; c < game.carCount; c++) {
    const shadow = Object.assign(carShadows[car[c].typ], racers[c].shadow);
    // a shadow lying on a piece would sink into it
    if (shadow.intershad) {
      gl.disable(gl.DEPTH_TEST);
    }
    drawModel(shadow);
    if (shadow.intershad) {
      gl.enable(gl.DEPTH_TEST);
    }
  }
  for (let i = 0; i < effects.chipCount; i++) {
    drawModel(effects.chips[i]);
  }
  if (raceEvents.oncheckpoint != -1) {
    drawParticle(checkpointText);
    if (raceEvents.onlastcheck) {
      drawParticle(finishText);
    }
  }
  for (let c = 0; c < game.carCount; c++) {
    drawWheeledCar(
      car[c].typ,
      car[c],
      racers[c].wheels,
      racers[c].body,
      (wheel) => wheel.dist < NEAR_WHEEL,
    );
  }
  // cars being fixed crackle with electricity, turned at random
  if (raceEvents.onelec) {
    for (let c = 0; c < game.carCount; c++) {
      if (car[c].fcnt) {
        electricity.x = car[c].x;
        electricity.y = car[c].y;
        electricity.z = car[c].z;
        mat4.rotate(
          electricity.mat,
          electricity.mat,
          random.fx() * 360 * (Math.PI / 180),
          [0, 0, 1],
        );
        drawModel(electricity);
      }
    }
  }
  // switch mode has no fixing
  if (game.mode != MODE.switchCars) {
    drawFixHoops();
  }
  if (game.phase == PHASE.switchScreen) {
    for (let c = 0; c < game.carCount; c++) {
      drawParticle(racers[c].switchLine);
    }
  }
  for (let i = 0; i < effects.explosionCount; i++) {
    const explosion = effects.explosions[effects.explosionsBackToFront[i]];
    if (explosion.ani != -1) {
      const model = explosionModels[explosion.typ];
      model.x = explosion.x;
      model.y = explosion.y;
      model.z = explosion.z;
      model.shownTexture = Math.floor(explosion.ani);
      model.mat = explosion.mat;
      drawModel(model);
    }
  }
  for (let k = 0; k < effects.dustCount; k++) {
    const dust = effects.dustClouds[effects.dustBackToFront[k]];
    if (dust.stg != 0) {
      placeAt(dustSprite, dust);
      dustSprite.texture = dustTextures[dust.tx][Math.floor(dust.ta)];
      drawModel(dustSprite);
    }
  }
};

const drawCarSelect = () => {
  // the classic look's car select has its pictures behind (see classic/carSelect.js)
  if (look.current == LOOK.classic) {
    drawShowcaseCar(CLASSIC_FLOOR);
    return;
  }
  drawModel(menuBackdrop);
  menuSmoke.forEach((puff, i) => {
    placeAt(dustSprite, puff);
    dustSprite.texture = spriteTextures[i % 3];
    drawModel(dustSprite);
  });
  startDepth();
  if (look.current != LOOK.classic) {
    drawModel(carShadows[game.carTypes[0]]);
  }
  drawShowcaseCar();
};

// The stage up to its last path piece and its addons, without the walls.
const drawStageSelect = () => {
  // the classic look's stage select has its pictures behind (see classic/stageSelect.js)
  const classic = look.current == LOOK.classic;
  if (!classic) {
    drawParticle(stageBackdrop);
    startDepth();
  }
  if (stageSelect.hiddenTicks) {
    return;
  }
  if (classic) {
    drawClassicStage(track.obi[track.n - 1] + track.addons);
    return;
  }
  for (let i = 0; i < track.obi[track.n - 1] + track.addons; i++) {
    const piece = pieces.list[i];
    if (piece.iscp) {
      flashCheckpoint(piece, true);
    }
    drawPiece(piece);
  }
  drawFixHoops();
};

const drawUnlockedCar = () => {
  // the classic look's race end has its picture behind (see classic/raceEnd.js)
  if (look.current == LOOK.classic) {
    drawShowcaseCar(CLASSIC_UNLOCKED_FLOOR);
    return;
  }
  drawParticle(stageBackdrop);
  startDepth();
  drawShowcaseCar();
};
