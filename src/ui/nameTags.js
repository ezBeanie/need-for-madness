// The names over the cars in a room's race: each car but the player's and the one the camera
// follows shows who drives it (see net/roomCars.js), and a speaker while its player talks.
// They move with every frame, where the frame draws the car, and only show while it is
// near enough.

import { RACE_PHASES, game } from "../core/state.js";
import { lockstep } from "../net/lockstep.js";
import { inRoomRace, nameOfCar } from "../net/roomCars.js";
import { isTalking } from "../net/voice.js";
import { car } from "../race/racers.js";
import { camera } from "../render/camera.js";
import { drawCamera, drawMatrix, placeModel } from "../render/interpolation.js";
import { canvas3D } from "../render/renderer.js";

const layer = document.getElementById("nameTags");
// farther than this (the depth of the projection) a car's name is gone
const FAR = 2500;
// the name's height above the car's middle, in the view's pixels (720 high) at a depth of 1
const ABOVE = 8000;

const tags = [];

const tagOf = (c) => {
  if (!tags[c]) {
    const tag = document.createElement("span");
    tag.className = "name-tag";
    layer.append(tag);
    tags[c] = tag;
  }
  return tags[c];
};

const hideFrom = (from) => {
  for (let c = from; c < tags.length; c++) {
    if (tags[c] && !tags[c].hidden) {
      tags[c].hidden = true;
    }
  }
};

// Every frame, after the race is drawn.
export const placeNameTags = () => {
  const shown = RACE_PHASES.includes(game.phase) && inRoomRace();
  if (!shown) {
    hideFrom(0);
    return;
  }
  const box = canvas3D.getBoundingClientRect();
  const clip = [0, 0, 0, 0];
  const p = drawCamera.projection;
  for (let c = 0; c < game.carCount; c++) {
    const tag = tagOf(c);
    placeModel(car[c]);
    const [x, y, z] = [drawMatrix[12], drawMatrix[13], drawMatrix[14]];
    for (let row = 0; row < 4; row++) {
      clip[row] = p[row] * x + p[row + 4] * y + p[row + 8] * z + p[row + 12];
    }
    const depth = clip[3];
    if (c == game.player || c == camera.target || depth <= 1 || depth > FAR) {
      tag.hidden = true;
      continue;
    }
    const name = nameOfCar(c);
    const talking = lockstep.active && isTalking(lockstep.players[c]);
    const text = talking ? `${name} \u{1F50A}` : name;
    if (tag.textContent != text) {
      tag.textContent = text;
    }
    const left = box.left + ((clip[0] / depth + 1) / 2) * box.width;
    const top =
      box.top +
      ((1 - clip[1] / depth) / 2) * box.height -
      ((ABOVE / depth) * box.height) / 720;
    tag.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px) translate(-50%, -100%)`;
    tag.hidden = false;
  }
  hideFrom(game.carCount);
};
