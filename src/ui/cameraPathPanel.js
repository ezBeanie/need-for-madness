// The replay's camera path beside the race (see race/cameraPath.js): its keyframes, each
// to jump to, move to where the replay is, fly on from or cut, or take away, a new one
// where the replay is, and the path played or not.
// Opened with I or the controls' button, only in the replay viewer.

import { PHASE, game } from "../core/state.js";
import { t } from "../core/language.js";
import { nameOfCar } from "../net/roomCars.js";
import {
  cameraPath,
  dropKey,
  flies,
  keyHere,
  moveKey,
  toggleFly,
  togglePath,
} from "../race/cameraPath.js";
import { seekReplay, viewer } from "../race/replayViewer.js";
import { CAMERA, DEFAULT_FOV } from "../render/camera.js";
import { videoType } from "../render/video.js";
import { recordReplay } from "./replayVideo.js";
import { CAMERA_NAMES, time } from "./replayControls.js";

const panel = document.getElementById("cameraPath");
const element = (id) => document.getElementById(id);

// what a keyframe says: when, which camera, whose, how far zoomed
const told = (key) => {
  const what = t(CAMERA_NAMES[key.mode] ?? "Camera");
  const whose = key.mode == CAMERA.free ? "" : `, ${nameOfCar(key.target)}`;
  const fov = Math.round(key.fov ?? DEFAULT_FOV);
  return `${time(key.frame)}  ${what}${whose}, ${fov}\u00b0`;
};

const button = (text, label, onClick) => {
  const made = document.createElement("button");
  made.type = "button";
  made.textContent = text;
  made.setAttribute("aria-label", label);
  made.addEventListener("click", onClick);
  return made;
};

// what a video takes in, or that none can be recorded
const videoHint = () =>
  !videoType()
    ? t("This browser cannot record videos.")
    : cameraPath.keys.length > 0
      ? t("From the first keyframe to the last, as the path plays. Esc stops.")
      : t("From here to the end of the replay. Esc stops.");

export const showCameraPath = () => {
  const recordable = videoType() != null;
  element("cameraPathVideo").disabled = !recordable;
  element("cameraPathVideoHint").textContent = videoHint();
  const play = element("cameraPathPlay");
  play.setAttribute("aria-pressed", cameraPath.playing ? "true" : "false");
  play.disabled = cameraPath.keys.length == 0;
  element("cameraPathKeys").replaceChildren(
    ...cameraPath.keys.map((key, index) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = told(key);
      const go = button(t("Go"), t("Go to {key}", { key: told(key) }), () => {
        viewer.playing = false;
        seekReplay(key.frame);
      });
      const move = button(
        t("Move here"),
        t("Move {key} here", { key: told(key) }),
        () => {
          moveKey(index);
          showCameraPath();
          element("cameraPathAdd").focus();
        },
      );
      const drop = button(
        t("Delete"),
        t("Delete {key}", { key: told(key) }),
        () => {
          dropKey(index);
          showCameraPath();
          element("cameraPathAdd").focus();
        },
      );
      item.append(label, go, move);
      // (on to the next: flown or cut, where a free camera takes part)
      const next = cameraPath.keys[index + 1];
      if (next && (key.mode == CAMERA.free || next.mode == CAMERA.free)) {
        const fly = button(
          t("Fly on"),
          t("Fly on from {key}", { key: told(key) }),
          () => {
            toggleFly(index);
            showCameraPath();
            element("cameraPathKeys")
              .children[index]?.querySelector("[aria-pressed]")
              ?.focus();
          },
        );
        fly.setAttribute("aria-pressed", flies(key, next) ? "true" : "false");
        item.append(fly);
      }
      item.append(drop);
      return item;
    }),
  );
};

// (hidden, it gives up the focus: the replay's keys are the game's again)
const hidePanel = () => {
  panel.hidden = true;
  if (panel.contains?.(document.activeElement)) {
    document.activeElement.blur();
  }
};

// (K, or the panel's button)
export const addKeyHere = () => {
  keyHere();
  if (!panel.hidden) {
    showCameraPath();
  }
};

export const toggleCameraPathPanel = () => {
  if (!panel.hidden) {
    hidePanel();
    return;
  }
  panel.hidden = false;
  showCameraPath();
  element("cameraPathAdd").focus();
};

export const installCameraPathPanel = () => {
  element("cameraPathAdd").addEventListener("click", addKeyHere);
  element("cameraPathPlay").addEventListener("click", () => {
    togglePath();
    showCameraPath();
  });
  element("cameraPathClose").addEventListener("click", hidePanel);
  element("cameraPathVideo").addEventListener("click", () => {
    hidePanel();
    recordReplay();
  });
  // (Escape closes the panel, not the replay)
  panel.addEventListener("keydown", (event) => {
    if (event.key == "Escape") {
      event.stopPropagation();
      hidePanel();
    }
  });
};

// Every tick: only in the replay viewer.
export const placeCameraPathPanel = () => {
  if (game.phase != PHASE.replay && !panel.hidden) {
    hidePanel();
  }
};
