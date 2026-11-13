// The names over the cars in a room's race: each car but the player's and the one the camera
// follows shows who drives it (see net/roomCars.js), and a speaker while its player talks,
// over two small bars: its damage and its power, as the HUD shows the player's own. In
// teams it is underlined in its team's colour.
// They move with every frame, where the frame draws the car, and only show while it is
// near enough and the race goes on (its end has its own words over the cars).

import { RACE_PHASES, game } from "../core/state.js";
import { lockstep } from "../net/lockstep.js";
import { TEAM_COLORS, inRoomRace, nameOfCar, teamOf } from "../net/roomCars.js";
import { isTalking } from "../net/voice.js";
import { car, racers } from "../race/racers.js";
import { carStats } from "../data/carStats.js";
import { track } from "../race/track.js";
import { camera } from "../render/camera.js";
import { drawCamera, drawMatrix, placeModel } from "../render/interpolation.js";
import { canvas3D } from "../render/renderer.js";

const layer = document.getElementById("nameTags");
// farther than this (the depth of the projection) a car's name is gone
const FAR = 2500;
// the name's height above the car's middle, in the view's pixels (720 high) at a depth of 1
const ABOVE = 12000;

const tags = [];
// by car, the name its tag shows and how big it is, in pixels
const sizes = [];

// a bar's fill, a share of its width
const bar = (kind) => {
  const outer = document.createElement("span");
  outer.className = `name-bar ${kind}`;
  const fill = document.createElement("span");
  outer.append(fill);
  return outer;
};

const tagOf = (c) => {
  if (!tags[c]) {
    const tag = document.createElement("span");
    tag.className = "name-tag";
    const name = document.createElement("span");
    const bars = document.createElement("span");
    bars.className = "name-bars";
    bars.append(bar("damage"), bar("power"));
    tag.append(name, bars);
    layer.append(tag);
    tags[c] = tag;
  }
  return tags[c];
};

// (whole percents, set only when they change: the bars move with every hit and stunt)
const fillBar = (tag, i, share) => {
  const fill = tag.lastChild.children[i].firstChild;
  const width = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`;
  if (fill.style.width != width) {
    fill.style.width = width;
  }
};

// how damaged car c is, and how much power it has, each from 0 to 1
export const barsOf = (c) => ({
  damage: racers[c].damage / carStats.maxmag[car[c].typ],
  power: racers[c].power / 98,
});

const hideFrom = (from) => {
  for (let c = from; c < tags.length; c++) {
    if (tags[c] && !tags[c].hidden) {
      tags[c].hidden = true;
    }
  }
};

// Where car c is in the picture last drawn: its middle in the page's pixels and its depth
// (1 or less: at or behind the camera).
const clip = [0, 0, 0, 0];
export const carOnScreen = (c, box = canvas3D.getBoundingClientRect()) => {
  const p = drawCamera.projection;
  placeModel(car[c]);
  const [x, y, z] = [drawMatrix[12], drawMatrix[13], drawMatrix[14]];
  for (let row = 0; row < 4; row++) {
    clip[row] = p[row] * x + p[row + 4] * y + p[row + 8] * z + p[row + 12];
  }
  const depth = clip[3];
  return {
    left: box.left + ((clip[0] / depth + 1) / 2) * box.width,
    top: box.top + ((1 - clip[1] / depth) / 2) * box.height,
    depth,
  };
};

// Every frame, after the race is drawn.
export const placeNameTags = () => {
  const shown =
    RACE_PHASES.includes(game.phase) && inRoomRace() && !track.haltall;
  if (!shown) {
    hideFrom(0);
    return;
  }
  const box = canvas3D.getBoundingClientRect();
  // the nearest cars' names first: a name that would lie over a nearer one's is left out
  // (in a bunch of cars, as at the start, they would cover each other)
  const cars = [];
  for (let c = 0; c < game.carCount; c++) {
    cars.push({ c, ...carOnScreen(c, box) });
  }
  cars.sort((a, b) => a.depth - b.depth);
  const placed = [];
  for (const { c, left, top: middle, depth } of cars) {
    const tag = tagOf(c);
    if (c == game.player || c == camera.target || depth <= 1 || depth > FAR) {
      tag.hidden = true;
      continue;
    }
    const name = nameOfCar(c);
    const talking = lockstep.active && isTalking(lockstep.players[c]);
    const text = talking ? `${name} \u{1F50A}` : name;
    if (tag.firstChild.textContent != text) {
      tag.firstChild.textContent = text;
    }
    const team = String(teamOf(c));
    if (tag.dataset.team != team) {
      tag.dataset.team = team;
      tag.style.borderColor = TEAM_COLORS[team] ?? "";
    }
    const { damage, power } = barsOf(c);
    fillBar(tag, 0, damage);
    fillBar(tag, 1, power);
    // (measured once a name, not every frame)
    if (sizes[c]?.text != text) {
      tag.hidden = false;
      sizes[c] = { text, width: tag.offsetWidth, height: tag.offsetHeight };
    }
    const { width, height } = sizes[c];
    const top = middle - ((ABOVE / depth) * box.height) / 720;
    const at = {
      left: left - width / 2,
      right: left + width / 2,
      top: top - height,
      bottom: top,
    };
    const covered = placed.some(
      (other) =>
        at.left < other.right &&
        other.left < at.right &&
        at.top < other.bottom &&
        other.top < at.bottom,
    );
    tag.hidden = covered;
    if (!covered) {
      placed.push(at);
      tag.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  hideFrom(game.carCount);
};
