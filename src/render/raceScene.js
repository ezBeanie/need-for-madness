// What a race shows besides the cars, placed every tick: wheels, shadows, the spinning
// fix hoops with their electricity, and the checkpoint and finish texts.

import { distance } from "../core/math.js";
import { game } from "../core/state.js";
import { raceEvents } from "../race/events.js";
import { GHOST, ghostShown } from "../race/ghost.js";
import { car, racers } from "../race/racers.js";
import { pieceModels, pieces, spinFixHoops, track } from "../race/track.js";
import { camera, faceCamera } from "./camera.js";
import { carModels, checkpointText, electricity, finishText } from "./scene.js";
import { SILHOUETTE, layShadow } from "./shadows.js";
import { isLeftWheel, placeWheel } from "./wheels.js";

// Car c's wheels: the front ones steer, all of them spin (wzy).
const placeWheelsOf = (c) => {
  const body = car[c];
  for (let w = 0; w < 4; w++) {
    const wheel = racers[c].wheels[w];
    placeWheel(wheel, body, body.typ, w, w < 2 ? body.wxz : 0);
    mat4.rotate(
      wheel.mat,
      wheel.mat,
      body.wzy * (Math.PI / 180),
      isLeftWheel(w) ? [0, 0, -1] : [0, 0, 1],
    );
  }
  for (const wheel of racers[c].wheels) {
    wheel.dist = distance(
      wheel.x,
      camera.x,
      wheel.y,
      camera.y,
      wheel.z,
      camera.z,
    );
  }
};

// The wheels of every car, and of the time attack's ghost.
export const placeWheels = () => {
  for (let c = 0; c < game.carCount; c++) {
    placeWheelsOf(c);
  }
  if (ghostShown()) {
    placeWheelsOf(GHOST);
  }
};

// Every car's shadow on the ground, or on a slope of a piece below it.
export const castShadows = () => {
  for (let c = 0; c < game.carCount; c++) {
    const shadow = racers[c].shadow;
    layShadow(shadow, car[c], car[c].typ);
    shadow.intershad = false;
    shadow.y = 0.4;
    for (let i = 0; i < pieces.count; i++) {
      const piece = pieces.list[i];
      const model = pieceModels[piece.typ];
      if (model.intershad) {
        model.x = piece.x;
        model.y = piece.y;
        model.z = piece.z;
        model.mat = piece.mat;
        shadowOnPiece(car[c], shadow, model);
      }
    }
  }
};

// When the shadow falls on an upward facing triangle of the piece, between the car and
// the ground, it lies on that triangle, tilted along it.
const shadowOnPiece = (body, shadow, piece) => {
  const reach = carModels[body.typ].colrad + piece.colrad;
  if (
    !(Math.abs(body.x - piece.x) < reach && Math.abs(body.z - piece.z) < reach)
  ) {
    return;
  }
  const vrt = piece.vrt;
  const m = piece.mat;
  for (let i = 0; i < piece.ni / 3; i++) {
    // the triangle's corners, turned with the piece
    const x = [];
    const y = [];
    const z = [];
    for (let v = 0; v < 3; v++) {
      const p = piece.tri[i * 9 + v * 3];
      x[v] = -(vrt[p * 3] * m[0]) + vrt[p * 3 + 2] * m[8];
      y[v] = vrt[p * 3 + 1];
      z[v] = vrt[p * 3 + 2] * m[10] - vrt[p * 3] * m[2];
    }
    // the shadow is inside the triangle when the three triangles it makes with the
    // corners are no larger than the triangle itself
    const area = Math.abs(
      (x[1] - x[0]) * (z[2] - z[0]) - (x[2] - x[0]) * (z[1] - z[0]),
    );
    const px = shadow.x - piece.x;
    const pz = shadow.z - piece.z;
    const area1 = Math.abs(
      (x[0] - px) * (z[1] - pz) - (x[1] - px) * (z[0] - pz),
    );
    const area2 = Math.abs(
      (x[1] - px) * (z[2] - pz) - (x[2] - px) * (z[1] - pz),
    );
    const area3 = Math.abs(
      (x[2] - px) * (z[0] - pz) - (x[0] - px) * (z[2] - pz),
    );
    if (!(area1 + area2 + area3 <= area + 10)) {
      continue;
    }
    const n = piece.tri[i * 9 + 1];
    const nrm = piece.nrm;
    if (!(nrm[n * 3 + 1] > 0.06)) {
      continue;
    }
    // the height of the triangle under the shadow: along two edges, then between them
    let along =
      z[0] - z[1] != 0 ? (shadow.z - (z[1] + piece.z)) / (z[0] - z[1]) : 0;
    const leftX = x[1] + (x[0] - x[1]) * along;
    const leftY = y[1] + (y[0] - y[1]) * along;
    along =
      z[0] - z[2] != 0 ? (shadow.z - (z[2] + piece.z)) / (z[0] - z[2]) : 0;
    const rightX = x[2] + (x[0] - x[2]) * along;
    const rightY = y[2] + (y[0] - y[2]) * along;
    along =
      rightX - leftX != 0
        ? (shadow.x - (leftX + piece.x)) / (rightX - leftX)
        : 0;
    const height = leftY + (rightY - leftY) * along;
    if (height < body.y && height > shadow.y - 0.5) {
      const normalX = -(nrm[n * 3] * m[0]) + nrm[n * 3 + 2] * m[8];
      const normalY = nrm[n * 3 + 1];
      const normalZ = nrm[n * 3 + 2] * m[10] - nrm[n * 3] * m[2];
      if (Math.abs(normalY) > 0.1) {
        const flip = shadowFlipped(shadow, body) ? 1 : -1;
        shadow.mat[1] =
          -(normalX * shadow.mat[0]) + flip * normalZ * shadow.mat[8];
        shadow.mat[5] = normalY;
        shadow.mat[9] =
          -(normalZ * shadow.mat[10]) + flip * normalX * shadow.mat[2];
        shadow.y = height;
        shadow.intershad = true;
      }
    }
  }
};

// Whether the car lies the other way round for its silhouette (on its roof, other side or
// other end).
const shadowFlipped = (shadow, body) =>
  (shadow.shownTexture == SILHOUETTE.upright && body.mat[5] < 0) ||
  (shadow.shownTexture == SILHOUETTE.onItsSide && body.mat[1] < 0) ||
  (shadow.shownTexture == SILHOUETTE.onItsEnd && body.mat[9] > 0);

// The hoops spin and their electricity flickers, checkpoints flash, and the checkpoint
// the player drives through shows its text (and the finish text on the last one).
export const animateTrack = () => {
  spinFixHoops();
  if (raceEvents.onelec) {
    faceCamera(electricity);
    electricity.shownTexture++;
    if (electricity.shownTexture == 5) {
      electricity.shownTexture = 0;
    }
  }
  // stage 1 flashes its checkpoints five times faster
  if (track.stage == 1) {
    raceEvents.checkpointFlash++;
  } else {
    raceEvents.checkpointFlash += 0.2;
  }
  if (raceEvents.checkpointFlash >= 5) {
    raceEvents.checkpointFlash = 0;
  }
  if (raceEvents.oncheckpoint != -1) {
    placeCheckpointText(pieces.list[track.obn[raceEvents.oncheckpoint]]);
  }
};

// The text stands in the checkpoint, moved towards the camera and turned to it.
const placeCheckpointText = (checkpoint) => {
  checkpointText.x = checkpoint.x;
  checkpointText.y = checkpoint.y + 80;
  checkpointText.z = checkpoint.z;
  for (let i = 0; i < 16; i++) {
    checkpointText.mat[i] = checkpoint.mat[i];
  }
  const m = checkpointText.mat;
  let turned = false;
  if (Math.abs(m[8]) > Math.abs(m[10])) {
    if (camera.x < checkpointText.x) {
      checkpointText.x -= 6.7;
    } else {
      checkpointText.x += 6.7;
    }
    turned =
      (m[8] > 0 && camera.x < checkpointText.x) ||
      (m[8] < 0 && camera.x > checkpointText.x);
  } else {
    if (camera.z < checkpointText.z) {
      checkpointText.z -= 6.7;
    } else {
      checkpointText.z += 6.7;
    }
    turned =
      (m[10] > 0 && camera.z < checkpointText.z) ||
      (m[10] < 0 && camera.z > checkpointText.z);
  }
  if (turned) {
    mat4.rotate(m, m, 180 * (Math.PI / 180), [0, 1, 0]);
  }
  if (raceEvents.onlastcheck) {
    for (let i = 0; i < 16; i++) {
      finishText.mat[i] = m[i];
    }
    finishText.x = checkpoint.x;
    finishText.y = checkpoint.y + 52;
    finishText.z = checkpoint.z;
  }
};
