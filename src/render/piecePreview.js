// The stage editor's picture of a piece (see editor/stageEditor.js): the one about to be
// placed, or the one selected, turned as it lies on the map, seen from above and behind
// the map's bottom edge, so that the map's up is ahead.

import { pieceModels } from "../race/track.js";
import { fixHoop } from "./scene.js";
import { drawModel } from "./renderer.js";
import { newOffscreen } from "./offscreen.js";

export const PIECE_PREVIEW_WIDTH = 240;
export const PIECE_PREVIEW_HEIGHT = 160;
const FIELD_OF_VIEW = 40;
const PITCH = 35;
const MARGIN = 1.4;

// canvas: where the picture goes (null: nowhere); piece: its stage file number, -1 none;
// rotation: its turn on the map (degrees)
export const piecePreview = { canvas: null, piece: -1, rotation: 0 };

// (the stage file's fix hoop is a ring with a disk of its own in it)
const FIX_HOOP = 41;

const offscreen = newOffscreen(PIECE_PREVIEW_WIDTH, PIECE_PREVIEW_HEIGHT);
const shown = { x: 0, y: 0, z: 0, mat: mat4.create() };

// Every frame: the picture, if the editor shows one.
export const drawPiecePreview = () => {
  const { canvas, piece, rotation } = piecePreview;
  const model = pieceModels[piece - 10];
  if (!canvas?.isConnected || !model?.loaded) {
    return;
  }
  // far enough to see it whole with room round it, where the camera looks
  const distance =
    (MARGIN * Math.max(model.colrad, 40)) /
    Math.sin((FIELD_OF_VIEW * Math.PI) / 360);
  const pitch = (PITCH * Math.PI) / 180;
  shown.x = 0;
  shown.y = -distance * Math.sin(pitch);
  shown.z = -distance * Math.cos(pitch);
  mat4.identity(shown.mat);
  // (the camera looks along -z: the map's up, +z, is ahead turned half round)
  mat4.rotate(
    shown.mat,
    shown.mat,
    ((rotation + 180) * Math.PI) / 180,
    [0, 1, 0],
  );
  offscreen.start(FIELD_OF_VIEW, PITCH, distance * 4);
  offscreen.clear();
  for (const part of piece == FIX_HOOP ? [model, fixHoop] : [model]) {
    part.x = shown.x;
    part.y = shown.y;
    part.z = shown.z;
    part.mat = shown.mat;
    drawModel(part);
  }
  offscreen.copyTo([canvas]);
  offscreen.end();
};
