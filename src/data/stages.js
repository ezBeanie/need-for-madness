// The stages one can race: this game's own, then the original Java game's stages of Need for
// Madness 1 (its stages 1 to 10 and, as the eleventh, its 27), Need for Madness 2 (its 11
// to 27) and its multiplayer stages (its 28 to 32), read from its own files and all open
// from the start.

// this game's own stages, the last of them the final stage the game is won on
export const LAST_STAGE = 17;

const range = (first, count) =>
  Array.from({ length: count }, (_, i) => first + i);

// each set's stages in this game's numbers, the original's numbers of them and their music
// files (data/classic/music, numbered within the set); NFM1's eleventh came after NFM2,
// so the stages numbered before it (in saved replays) stay as they were
const SETS = [
  {
    prefix: "NFM1 ",
    stages: [...range(LAST_STAGE + 1, 10), LAST_STAGE + 28],
    originals: [...range(1, 10), 27],
    music: "nfm1-stage",
  },
  {
    prefix: "NFM2 ",
    stages: range(LAST_STAGE + 11, 17),
    originals: range(11, 17),
    music: "stage",
  },
  {
    prefix: "Multiplayer ",
    stages: range(LAST_STAGE + 29, 5),
    originals: range(28, 5),
    music: "mp-stage",
  },
];

export const STAGE_COUNT = LAST_STAGE + 33;

// A stage of the player's own (made in the stage editor), raced from its text: how hard its
// opponents are and its music (one of this game's stages' tracks) its file says (see
// loading/stageLoad.js).
export const CUSTOM_STAGE = STAGE_COUNT + 1;
export const customStage = { text: "", level: 8, music: 1 };

// whether the stage is one of this game's own, not one of the original's or the player's
export const ownStage = (stage) => stage <= LAST_STAGE;

const setOf = (stage) => SETS.find((set) => set.stages.includes(stage));

// The stage select's collections of stages: this game's own, then the original's sets.
export const COLLECTIONS = ["Modern", "NFM 1", "NFM 2", "NFM MP"];

export const collectionOf = (stage) => SETS.indexOf(setOf(stage)) + 1;

// the first stage of one of the original's sets (collection 1 to 3)
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

// The stage's number within its set (the original's stages counted within their game).
export const stageNumber = (stage) => {
  const set = setOf(stage);
  return set ? set.stages.indexOf(stage) + 1 : stage;
};

// "Stage 3", "NFM1 Stage 3".
export const stageLabel = (stage) =>
  stage == CUSTOM_STAGE
    ? "Custom Stage"
    : `${setOf(stage)?.prefix ?? ""}Stage ${stageNumber(stage)}`;

// How hard the stage's opponents are, as one of this game's stages: the original's
// stages from easy to hard over the game's.
export const levelOf = (stage) => {
  if (stage == CUSTOM_STAGE) {
    return customStage.level;
  }
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

// The music of the stage, the same in both looks: this game's stages their own, the
// original's theirs (the classic look's files; NFM1's eleventh has a tune of its own, not
// NFM2's party).
export const musicOf = (stage) => {
  if (stage == CUSTOM_STAGE) {
    return { file: `stage${customStage.music}`, classic: false };
  }
  const set = setOf(stage);
  if (!set) {
    return { file: `stage${stage}`, classic: false };
  }
  return {
    file: `${set.music}${set.stages.indexOf(stage) + 1}`,
    classic: true,
  };
};
