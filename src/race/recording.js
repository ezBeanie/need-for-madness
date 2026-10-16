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
};
