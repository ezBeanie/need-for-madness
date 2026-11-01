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

// Stages made in the stage editor, raced from their text: one a host or a replay brought
// (visiting), then the player's own, as many as there are (see editor/stageEditor.js).
// How hard their opponents are and their music (one of this game's stages' tracks) their
// texts say (see loading/stageLoad.js).
export const VISITING_STAGE = STAGE_COUNT + 1;
export const FIRST_OWN_STAGE = STAGE_COUNT + 2;
export const customStage = { visiting: "", texts: [], level: 8, music: 1 };

export const isCustom = (stage) => stage >= VISITING_STAGE;

export const customText = (stage) =>
  stage == VISITING_STAGE
    ? customStage.visiting
    : (customStage.texts[stage - FIRST_OWN_STAGE] ?? "");

// What a race takes of its stage to another game (in a replay file, to a guest): its
// number, and the text of one made in the editor, which the other game may not have.
export const raceStage = (stage) =>
  isCustom(stage)
    ? { stage: VISITING_STAGE, stageText: customText(stage) }
    : { stage };

// The stage of a race from another game: one made in the editor as the visiting stage.
export const takeRaceStage = ({ stage, stageText }) => {
  if (isCustom(stage)) {
    customStage.visiting = typeof stageText == "string" ? stageText : "";
    return VISITING_STAGE;
  }
  return stage;
};

const ownStages = () => range(FIRST_OWN_STAGE, customStage.texts.length);

// whether the stage is one of this game's own, not one of the original's or the player's
export const ownStage = (stage) => stage <= LAST_STAGE;

const setOf = (stage) => SETS.find((set) => set.stages.includes(stage));

const OWN_COLLECTION = SETS.length + 1;

// The stage select's collections of stages: this game's own, the original's sets, and
// the player's own once there are some.
export const collections = () => [
  "Modern",
  "NFM 1",
  "NFM 2",
  "NFM MP",
  ...(customStage.texts.length ? ["Own"] : []),
];

export const collectionOf = (stage) =>
  stage >= FIRST_OWN_STAGE ? OWN_COLLECTION : SETS.indexOf(setOf(stage)) + 1;

// the first stage of one of the original's sets or of the player's (collection 1 to 4)
export const firstOfCollection = (collection) =>
  collection == OWN_COLLECTION
    ? FIRST_OWN_STAGE
    : SETS[collection - 1].stages[0];

// the stages in the order the stage select goes through them
const ORDER = [range(1, LAST_STAGE), ...SETS.map((set) => set.stages)].flat();
const order = () => [...ORDER, ...ownStages()];

// The stage after this one in the stage select, 0 after the last.
export const stageAfter = (stage) => order()[order().indexOf(stage) + 1] ?? 0;

// The stage before this one in the stage select, 0 before the first.
export const stageBefore = (stage) => order()[order().indexOf(stage) - 1] ?? 0;

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
  if (stage >= FIRST_OWN_STAGE) {
    return stage - FIRST_OWN_STAGE + 1;
  }
  const set = setOf(stage);
  return set ? set.stages.indexOf(stage) + 1 : stage;
};

// "Stage 3", "NFM1 Stage 3".
export const stageLabel = (stage) =>
  stage == VISITING_STAGE
    ? "Custom Stage"
    : `${stage >= FIRST_OWN_STAGE ? "Own " : (setOf(stage)?.prefix ?? "")}Stage ${stageNumber(stage)}`;

// How hard the stage's opponents are, as one of this game's stages: the original's
// stages from easy to hard over the game's.
export const levelOf = (stage) => {
  if (isCustom(stage)) {
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
  if (isCustom(stage)) {
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
