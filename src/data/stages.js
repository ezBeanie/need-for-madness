// The stages one can race: this game's own, then the original Java game's stages of Need for
// Madness 1 (its stages 1 to 10 and, as the eleventh, its 27) and Need for Madness 2 (its
// 11 to 27), read from its own files and all open from the start.

// this game's own stages, the last of them the final stage the game is won on
export const LAST_STAGE = 17;

const range = (first, count) =>
  Array.from({ length: count }, (_, i) => first + i);

// each set's stages in this game's numbers, and the original's numbers of them; NFM1's
// eleventh came last, so the stages numbered before it (in saved replays) stay as they were
const SETS = [
  {
    prefix: "NFM1 ",
    stages: [...range(LAST_STAGE + 1, 10), LAST_STAGE + 28],
    originals: [...range(1, 10), 27],
  },
  {
    prefix: "NFM2 ",
    stages: range(LAST_STAGE + 11, 17),
    originals: range(11, 17),
  },
];

export const STAGE_COUNT = LAST_STAGE + 28;

const setOf = (stage) => SETS.find((set) => set.stages.includes(stage));

// The stage select's collections of stages: this game's own, then the original's sets.
export const COLLECTIONS = ["Modern", "NFM 1", "NFM 2"];

export const collectionOf = (stage) => SETS.indexOf(setOf(stage)) + 1;

// the first stage of one of the original's sets (collection 1 or 2)
export const firstOfCollection = (collection) => SETS[collection - 1].stages[0];

// the stages in the order the stage select goes through them
const ORDER = [range(1, LAST_STAGE), ...SETS.map((set) => set.stages)].flat();

// The stage after this one in the stage select, 0 after the last.
export const stageAfter = (stage) => ORDER[ORDER.indexOf(stage) + 1] ?? 0;

// The stage before this one in the stage select, 0 before the first.
export const stageBefore = (stage) => ORDER[ORDER.indexOf(stage) - 1] ?? 0;

// The original's number of the stage, 0 for one of this game's own.
export const originalOf = (stage) => {
  const set = setOf(stage);
  return set ? set.originals[set.stages.indexOf(stage)] : 0;
};

export const stageFile = (stage) =>
  originalOf(stage)
    ? `data/classic/stages/${originalOf(stage)}.txt`
    : `data/stages/${stage}.txt`;

// "Stage 3", "NFM1 Stage 3"; the original's stages counted within their game.
export const stageLabel = (stage) => {
  const set = setOf(stage);
  return set
    ? `${set.prefix}Stage ${set.stages.indexOf(stage) + 1}`
    : `Stage ${stage}`;
};

// How hard the stage's opponents are, as one of this game's stages: the original's
// stages from easy to hard over the game's.
export const levelOf = (stage) => {
  const set = setOf(stage);
  if (!set) {
    return stage;
  }
  return (
    1 +
    Math.round(
      (set.stages.indexOf(stage) * (LAST_STAGE - 2)) / (set.stages.length - 1),
    )
  );
};

// The music of the stage: this game's own in each look, the original's stages always
// their own (the classic look's files; NFM1's eleventh has a tune of its own, not NFM2's
// party).
export const musicOf = (stage) => {
  const set = setOf(stage);
  if (!set) {
    return { file: `stage${stage}`, classic: false };
  }
  // the classic look plays the original's stages 11 to 27 for this game's 1 to 17
  const file =
    set == SETS[0]
      ? `nfm1-stage${set.stages.indexOf(stage) + 1}`
      : `stage${originalOf(stage) - 10}`;
  return { file, classic: true };
};
