// The stages one can race: this game's own, then the original Java game's stages of Need for
// Madness 1 (its stages 1 to 10) and Need for Madness 2 (its 11 to 27), read from its own
// files and all open from the start.

// this game's own stages, the last of them the final stage the game is won on
export const LAST_STAGE = 17;

const SETS = [
  { prefix: "NFM1 ", first: LAST_STAGE + 1, count: 10, original: 1 },
  { prefix: "NFM2 ", first: LAST_STAGE + 11, count: 17, original: 11 },
];

export const STAGE_COUNT = LAST_STAGE + 27;

const setOf = (stage) =>
  SETS.find((set) => stage >= set.first && stage < set.first + set.count);

// The original's number of the stage, 0 for one of this game's own.
export const originalOf = (stage) => {
  const set = setOf(stage);
  return set ? set.original + stage - set.first : 0;
};

export const stageFile = (stage) =>
  originalOf(stage)
    ? `data/classic/stages/${originalOf(stage)}.txt`
    : `data/stages/${stage}.txt`;

// "Stage 3", "NFM1 Stage 3"; the original's stages counted within their game.
export const stageLabel = (stage) => {
  const set = setOf(stage);
  return set ? `${set.prefix}Stage ${stage - set.first + 1}` : `Stage ${stage}`;
};

// How hard the stage's opponents are, as one of this game's stages: the original's
// stages from easy to hard over the game's.
export const levelOf = (stage) => {
  const set = setOf(stage);
  if (!set) {
    return stage;
  }
  return (
    1 + Math.round(((stage - set.first) * (LAST_STAGE - 2)) / (set.count - 1))
  );
};

// The music of the stage: this game's own in each look, the original's stages always
// their own (the classic look's files).
export const musicOf = (stage) => {
  const original = originalOf(stage);
  if (!original) {
    return { file: `stage${stage}`, classic: false };
  }
  // the classic look plays the original's stages 11 to 27 for this game's 1 to 17
  const file =
    original <= 10 ? `nfm1-stage${original}` : `stage${original - 10}`;
  return { file, classic: true };
};
