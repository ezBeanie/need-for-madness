// The pieces seen from above for the stage editor's map: their models' triangles flat,
// lighter the higher they are, read from the models' files once the editor opens.

import { parseModel } from "../data/modelFormat.js";
import { PIECE_FILES } from "../loading/assets.js";
import { fetchText } from "../render/models.js";
import { extents, shapeOf } from "./stageModel.js";

// the pieces' shapes as paths, by their stage file number
export const shapes = new Map();

const pathOf = (triangles) => {
  const path = new Path2D();
  for (const [x0, z0, x1, z1, x2, z2] of triangles) {
    path.moveTo(x0, z0);
    path.lineTo(x1, z1);
    path.lineTo(x2, z2);
    path.closePath();
  }
  return path;
};

// Reads every piece's model; onShape(piece) as each arrives.
export const loadShapes = (onShape) => {
  PIECE_FILES.forEach((file, i) => {
    const piece = i + 10;
    if (shapes.has(piece)) {
      return;
    }
    fetchText(`data/3D/${file}.r3d`, (text) => {
      const { extent, heights } = shapeOf(parseModel(text));
      extents.set(piece, extent);
      shapes.set(piece, { extent, heights: heights.map(pathOf) });
      onShape(piece);
    });
  });
};
