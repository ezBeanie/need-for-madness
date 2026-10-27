// Replays as files: saving the race the viewer shows, and opening a file from the main
// menu (or dropped onto the game), which loads its stage with its cars and shows it.

import {
  pauseMenuMusic,
  playStageMusic,
  stopStageMusic,
} from "../audio/audio.js";
import { PHASE, game } from "../core/state.js";
import { stageLabel } from "../data/stages.js";
import { AFTER_LOAD, STAGE_LOAD, stageLoad } from "../loading/stageLoad.js";
import { field } from "../race/field.js";
import { raceTape } from "../race/raceTape.js";
import {
  REPLAY_FILE_EXTENSION,
  decodeReplay,
  encodeReplay,
} from "../race/replayFile.js";
import { VIEWER_FROM, openReplay } from "../race/replayViewer.js";
import { track } from "../race/track.js";
import { menu } from "./menuState.js";

// the replay file being opened: its race tape, and the player's car and place before it
let opened = null;

const fileName = () => {
  const label = stageLabel(track.stage).replaceAll(" ", "-");
  const now = new Date();
  const two = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  const time = `${two(now.getHours())}${two(now.getMinutes())}`;
  return `NFM-${label}-${date}-${time}${REPLAY_FILE_EXTENSION}`;
};

// Saves the race the viewer shows as a file, downloaded by the browser.
export const saveReplay = async () => {
  const bytes = await encodeReplay({
    stage: track.stage,
    name: track.name,
    carTypes: game.carTypes.slice(0, game.carCount),
    player: game.player,
  });
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/octet-stream" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName();
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Opens a replay file: its stage loads with its cars, then the viewer shows it.
export const openReplayFile = async (file) => {
  let replay;
  try {
    replay = await decodeReplay(file);
  } catch (error) {
    alert(error.message);
    return;
  }
  const { race, tape } = replay;
  opened = { tape, carType: game.carTypes[0], player: game.player };
  track.stage = race.stage;
  game.player = race.player;
  field.replayCars = race.carTypes;
  pauseMenuMusic();
  stageLoad.after = AFTER_LOAD.replay;
  stageLoad.progress = STAGE_LOAD.requested;
  game.phase = PHASE.stageLoading;
};

// Its stage loaded: the replay plays.
export const showOpenedReplay = () => {
  field.replayCars = null;
  Object.assign(raceTape, opened.tape);
  playStageMusic(track.stage);
  openReplay(VIEWER_FROM.file, 0);
};

// After an opened replay: the main menu, the player's own car chosen again.
export const leaveOpenedReplay = () => {
  stopStageMusic();
  game.carTypes[0] = opened.carType;
  game.player = opened.player;
  opened = null;
  menu.animation = 0;
  menu.continuesToCarSelect = false;
  game.phase = PHASE.mainMenu;
};

// Lets the player pick a replay file (a click or key must have led here: browsers only
// open the file chooser then).
export const chooseReplayFile = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = REPLAY_FILE_EXTENSION;
  input.addEventListener("change", () => {
    if (input.files[0]) {
      openReplayFile(input.files[0]);
    }
  });
  input.click();
};

// A replay file dropped onto the game opens while the main menu shows.
export const installReplayDrop = (target) => {
  target.addEventListener("dragover", (event) => event.preventDefault());
  target.addEventListener("drop", (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file && game.phase == PHASE.mainMenu) {
      openReplayFile(file);
    }
  });
};
