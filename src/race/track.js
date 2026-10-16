import { MAX_CARS } from "../core/state.js";
import { tick } from "../core/tick.js";
import { newModel } from "../render/models.js";
import { fixHoop } from "../render/scene.js";

// The loaded stage: its path points (used by the AI and the race positions), the race
// standings on it, and the pieces placed on it.
class Track {
  x = [];
  y = [];
  z = [];
  typ = [];
  obi = [];
  pcs = 0;
  nsp = 0;
  n = 0;
  obn = [];
  special = [];
  stage = 16;
  nlaps = 0;
  nfix = 0;
  notb = false;
  name = "hogan rewish";
  // pieces after the last path piece that the stage select still shows ("addon" in the
  // stage file)
  addons = 0;
  switchtime = 800;
  // per car: race position (starting as 6, last of the original seven), checkpoints
  // cleared, wasted (0 no, 1 by itself, 2 in a collision), damage (0..1)
  pos = Array(MAX_CARS).fill(6);
  clear = Array(MAX_CARS).fill(0);
  dested = Array(MAX_CARS).fill(0);
  magperc = Array(MAX_CARS).fill(0);
  wasted = 0;
  // Coach Insano's tips for the stage, shown in the stage select
  tips = [];
  haltall = false;
  pcleared = 0;
  // the outer walls (maxr, maxl, maxt, maxb): where they stand and which piece each is
  limr = 0;
  liml = 0;
  limt = 0;
  limb = 0;
  limro = 0;
  limlo = 0;
  limto = 0;
  limbo = 0;
  insih() {
    this.pos = Array(MAX_CARS).fill(6);
    this.clear = Array(MAX_CARS).fill(0);
    this.dested = Array(MAX_CARS).fill(0);
    this.magperc = Array(MAX_CARS).fill(0);
    this.wasted = 0;
    this.haltall = false;
    this.pcleared = 0;
  }
}

export const track = new Track();

// One model per piece type a stage can place.
export const pieceModels = Array.from({ length: 66 }, newModel);

// The pieces placed on the stage (count of them in count), and which of them are fix
// hoops (the first fixCount entries of fixes are indices into list).
export const pieces = { count: 0, list: [], fixCount: 0, fixes: [] };

// The hoops that fix cars spin, and their electricity flickers through five textures.
export const spinFixHoops = () => {
  for (let i = 0; i < pieces.fixCount; i++) {
    const hoop = pieces.list[pieces.fixes[i]];
    mat4.rotate(
      hoop.mat,
      hoop.mat,
      11 * tick.scale * (Math.PI / 180),
      [0, 0, 1],
    );
  }
  fixHoop.ont++;
  if (fixHoop.ont == 5) {
    fixHoop.ont = 0;
  }
};
