import { newModel } from "../render/models.js";

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
  switchtime = 800;
  pos = [6, 6, 6, 6, 6, 6, 6];
  clear = [0, 0, 0, 0, 0, 0, 0];
  dested = [0, 0, 0, 0, 0, 0, 0];
  magperc = [0, 0, 0, 0, 0, 0, 0];
  wasted = 0;
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
    this.pos = [6, 6, 6, 6, 6, 6, 6];
    this.clear = [0, 0, 0, 0, 0, 0, 0];
    this.dested = [0, 0, 0, 0, 0, 0, 0];
    this.magperc = [0, 0, 0, 0, 0, 0, 0];
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
