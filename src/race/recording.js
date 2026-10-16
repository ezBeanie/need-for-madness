import { game } from "../core/state.js";

// What is recorded of a race for the instant replay, the highlight replay and winding
// back time: the last ticks of every car, the sparks, and which highlight to show.
// Fields keep their original names for now.
export const recording = {
  repcar: null,
  hrepcar: null,
  repsprks: null,
  hrepsprks: null,
  reponcheckpoint: [],
  reponlastcheck: [],
  hreponcheckpoint: [],
  hreponlastcheck: [],
  nrec: 0,
  // the replayed tick
  fr: 0,
  htyp: 0,
  hat: 0,
  hscar: 0,
  hcim: 0,
  hpowerup: 0,
  rpdcatch: 0,
  catchfin: 0,
  // the highlight replay holds still on a frame
  onpausefr: false,
  rmode: 0,
  holdf: 0,
};

export function catchnow(hty) {
  if (recording.nrec >= 430) {
    for (var c = 0; c < game.carCount; c++) {
      for (var i = 0; i < 430; i++) {
        recording.hrepcar[c].x[i] = recording.repcar[c].x[i];
        recording.hrepcar[c].y[i] = recording.repcar[c].y[i];
        recording.hrepcar[c].z[i] = recording.repcar[c].z[i];
        recording.hrepcar[c].xy[i] = recording.repcar[c].xy[i];
        recording.hrepcar[c].xz[i] = recording.repcar[c].xz[i];
        recording.hrepcar[c].zy[i] = recording.repcar[c].zy[i];
        recording.hrepcar[c].wzy[i] = recording.repcar[c].wzy[i];
        recording.hrepcar[c].wxz[i] = recording.repcar[c].wxz[i];
        recording.hrepcar[c].avnx[i] = recording.repcar[c].avnx[i];
        recording.hrepcar[c].avny[i] = recording.repcar[c].avny[i];
        recording.hrepcar[c].avnz[i] = recording.repcar[c].avnz[i];
        recording.hrepcar[c].nreg = recording.repcar[c].nreg;
        recording.hrepcar[c].nfix = recording.repcar[c].nfix;
        recording.hrepcar[c].ndst = recording.repcar[c].ndst;
        recording.hrepcar[c].destat = recording.repcar[c].destat;
      }
      for (var i = 0; i < recording.hrepcar[c].nreg; i++) {
        recording.hrepcar[c].regat[i] = recording.repcar[c].regat[i];
        recording.hrepcar[c].regmtch[i] = recording.repcar[c].regmtch[i];
        recording.hrepcar[c].regnr[i] = recording.repcar[c].regnr[i];
        recording.hrepcar[c].regk[i] = recording.repcar[c].regk[i];
        recording.hrepcar[c].regmag[i] = recording.repcar[c].regmag[i];
      }
      for (var i = 0; i < recording.hrepcar[c].nfix; i++) {
        recording.hrepcar[c].fixat[i] = recording.repcar[c].fixat[i];
      }
      for (var i = 0; i < recording.hrepcar[c].ndst; i++) {
        recording.hrepcar[c].dstat[i] = recording.repcar[c].dstat[i];
        recording.hrepcar[c].tskd[i] = recording.repcar[c].tskd[i];
        recording.hrepcar[c].mst[i] = recording.repcar[c].mst[i];
        recording.hrepcar[c].dx[i] = recording.repcar[c].dx[i];
        recording.hrepcar[c].dy[i] = recording.repcar[c].dy[i];
        recording.hrepcar[c].dz[i] = recording.repcar[c].dz[i];
        recording.hrepcar[c].sx[i] = recording.repcar[c].sx[i];
        recording.hrepcar[c].sz[i] = recording.repcar[c].sz[i];
        recording.hrepcar[c].smag[i] = recording.repcar[c].smag[i];
        recording.hrepcar[c].tlt[i] = recording.repcar[c].tlt[i];
        recording.hrepcar[c].capsz[i] = recording.repcar[c].capsz[i];
      }
    }
    recording.hrepsprks.n = recording.repsprks.n;
    for (var i = 0; i < recording.hrepsprks.n; i++) {
      recording.hrepsprks.sprkat[i] = recording.repsprks.sprkat[i];
      recording.hrepsprks.cn[i] = recording.repsprks.cn[i];
      recording.hrepsprks.x[i] = recording.repsprks.x[i];
      recording.hrepsprks.y[i] = recording.repsprks.y[i];
      recording.hrepsprks.z[i] = recording.repsprks.z[i];
      recording.hrepsprks.sx[i] = recording.repsprks.sx[i];
      recording.hrepsprks.sy[i] = recording.repsprks.sy[i];
      recording.hrepsprks.sz[i] = recording.repsprks.sz[i];
      recording.hrepsprks.cap[i] = recording.repsprks.cap[i];
    }
    for (var i = 0; i < 430; i++) {
      recording.hreponcheckpoint[i] = recording.reponcheckpoint[i];
      recording.hreponlastcheck[i] = recording.reponlastcheck[i];
    }
    recording.htyp = hty;
    recording.hcim = game.player;
  } else {
    recording.hpowerup = 0;
  }
}
