// The replay recorded as a video (see render/video.js): from the camera path's first
// keyframe to its last, the path played (without one: from where the replay is to its
// end). Meanwhile the controls are away and a red mark tells it records (on the controls'
// canvas: not in the video); Esc, or the end, stops it and the file is downloaded.

import { t } from "../core/language.js";
import { TICK_MS } from "../core/tick.js";
import { cameraPath } from "../race/cameraPath.js";
import { lastFrame, seekReplay, viewer } from "../race/replayViewer.js";
import { startVideo, stopVideo, video } from "../render/video.js";
import { saveVideo } from "../screens/replays.js";
import { clockTime } from "./scoreboard.js";
import { rd, view } from "./view.js";

let until = 0;

export const recordReplay = () => {
  const { keys } = cameraPath;
  if (keys.length > 0) {
    seekReplay(keys[0].frame);
    cameraPath.playing = true;
    // (a path's keyframes may lie past the replay's end, as a file brings them)
    until = Math.min(keys.at(-1).frame, lastFrame());
  } else {
    until = lastFrame();
  }
  viewer.playing = true;
  startVideo(saveVideo);
};

// The mark at the top left: a red dot, the time recorded, how to stop.
const drawMark = () => {
  const s = view.scale;
  const ms = performance.now() - video.since;
  rd.save();
  rd.fillStyle = "rgba(0, 0, 0, 0.6)";
  rd.beginPath();
  rd.roundRect(20 * s, 20 * s, 250 * s, 40 * s, 20 * s);
  rd.fill();
  // (the dot blinks each half second)
  rd.fillStyle = Math.floor(ms / 500) % 2 ? "#FF5A3C" : "#B02A18";
  rd.beginPath();
  rd.arc(42 * s, 40 * s, 8 * s, 0, 2 * Math.PI);
  rd.fill();
  rd.fillStyle = "#FFFFFF";
  rd.font = `${Math.round(15 * s)}px junk`;
  rd.textBaseline = "middle";
  rd.textAlign = "left";
  rd.fillText(
    t("REC {time}   Esc: stop", { time: clockTime(ms / TICK_MS) }),
    60 * s,
    41 * s,
  );
  rd.restore();
};

// Every tick of the viewer while recording (escaped: Esc pressed): its end, or its mark.
// Returns whether it still records.
export const recordingTick = (escaped) => {
  if (!video.recording) {
    return false;
  }
  if (escaped || viewer.frame + viewer.between >= until) {
    stopVideo();
    return false;
  }
  drawMark();
  return true;
};
