// The replay's camera path beside the race (see race/cameraPath.js): its keyframes, each
// to jump to or take away, a new one where the replay is, and the path played or not.
// Opened with I or the controls' button, only in the replay viewer.

import { PHASE, game } from "../core/state.js";
import { t } from "../core/language.js";
import { nameOfCar } from "../net/roomCars.js";
import {
  cameraPath,
  dropKey,
  keyHere,
  togglePath,
} from "../race/cameraPath.js";
import { seekReplay, viewer } from "../race/replayViewer.js";
import { CAMERA } from "../render/camera.js";
import { CAMERA_NAMES, time } from "./replayControls.js";

const panel = document.getElementById("cameraPath");
const element = (id) => document.getElementById(id);

// what a keyframe says: when, which camera, whose
const told = (key) => {
  const what = t(CAMERA_NAMES[key.mode] ?? "Camera");
  const whose = key.mode == CAMERA.free ? "" : `, ${nameOfCar(key.target)}`;
  return `${time(key.frame)}  ${what}${whose}`;
};

export const showCameraPath = () => {
  const play = element("cameraPathPlay");
  play.setAttribute("aria-pressed", cameraPath.playing ? "true" : "false");
  play.disabled = cameraPath.keys.length == 0;
  element("cameraPathKeys").replaceChildren(
    ...cameraPath.keys.map((key, index) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = told(key);
      const go = document.createElement("button");
      go.type = "button";
      go.textContent = t("Go");
      go.setAttribute("aria-label", t("Go to {key}", { key: told(key) }));
      go.addEventListener("click", () => {
        viewer.playing = false;
        seekReplay(key.frame);
      });
      const drop = document.createElement("button");
      drop.type = "button";
      drop.textContent = t("Delete");
      drop.setAttribute("aria-label", t("Delete {key}", { key: told(key) }));
      drop.addEventListener("click", () => {
        dropKey(index);
        showCameraPath();
        element("cameraPathAdd").focus();
      });
      item.append(label, go, drop);
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
  element("cameraPathAdd").addEventListener("click", () => {
    keyHere();
    showCameraPath();
  });
  element("cameraPathPlay").addEventListener("click", () => {
    togglePath();
    showCameraPath();
  });
  element("cameraPathClose").addEventListener("click", hidePanel);
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
