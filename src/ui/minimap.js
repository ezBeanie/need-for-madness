// The minimap at the left (see drawHud), shown or hidden with G: the stage's path seen from
// above, its start, and the cars on it (the player's in white, the car the arrow points at
// ringed, wasted cars grey).

import { game } from "../core/state.js";
import { loadSetting, saveSetting } from "../core/storage.js";
import { car } from "../race/racers.js";
import { track } from "../race/track.js";
import { camera } from "../render/camera.js";
import { rd, view } from "./view.js";

export const minimap = { shown: false };

export const loadMinimap = () => {
  minimap.shown = loadSetting("minimap") == 1;
};

export const toggleMinimap = () => {
  minimap.shown = !minimap.shown;
  saveSetting("minimap", minimap.shown ? 1 : 0);
};

// where it stands and how big it is at most, in the 1280 x 720 layout
const LEFT = 20;
const SIZE = 160;
const MARGIN = 12;

const PATH = "rgba(1, 234, 255, 0.85)";
const OPPONENT = "#ff5a3c";
const WASTED = "rgba(160, 160, 160, 0.8)";

// The map's axes: the start's direction (from the first path point to the second) up,
// and to its right what is right of a car driving that way.
const axesOfStart = () => {
  const dx = track.x[1] - track.x[0];
  const dz = track.z[1] - track.z[0];
  const length = Math.hypot(dx, dz) || 1;
  const forward = { x: dx / length, z: dz / length };
  return { forward, right: { x: -forward.z, z: forward.x } };
};

// A point on the map's axes: across to the right and along upwards.
const onAxes = (axes, x, z) => ({
  across: x * axes.right.x + z * axes.right.z,
  along: x * axes.forward.x + z * axes.forward.z,
});

// The path's extent on the map's axes.
const extentOfPath = (axes) => {
  let left = Infinity;
  let right = -Infinity;
  let bottom = Infinity;
  let top = -Infinity;
  for (let i = 0; i < track.n; i++) {
    const { across, along } = onAxes(axes, track.x[i], track.z[i]);
    left = Math.min(left, across);
    right = Math.max(right, across);
    bottom = Math.min(bottom, along);
    top = Math.max(top, along);
  }
  return { left, right, bottom, top };
};

const drawCar = (x, y, radius, fill) => {
  rd.beginPath();
  rd.arc(x, y, radius, 0, 2 * Math.PI);
  rd.fillStyle = fill;
  rd.fill();
};

// From top (in pixels) down, as big as it fits above bottom; too small to tell anything
// it is left out.
export const drawMinimap = (top, bottom) => {
  const scale = view.scale;
  const size = Math.min(SIZE * scale, bottom - top);
  if (!minimap.shown || track.n < 2 || size < (SIZE / 2) * scale) {
    return;
  }
  const left = LEFT * scale;
  rd.fillStyle = "rgba(0, 20, 40, 0.45)";
  rd.beginPath();
  rd.roundRect(left, top, size, size, 12 * scale);
  rd.fill();

  const axes = axesOfStart();
  const extent = extentOfPath(axes);
  const inner = size - 2 * MARGIN * scale;
  const zoom =
    inner / Math.max(extent.right - extent.left, extent.top - extent.bottom, 1);
  const middleAcross = (extent.left + extent.right) / 2;
  const middleAlong = (extent.bottom + extent.top) / 2;
  const toMap = (x, z) => {
    const { across, along } = onAxes(axes, x, z);
    return [
      left + size / 2 + (across - middleAcross) * zoom,
      top + size / 2 - (along - middleAlong) * zoom,
    ];
  };

  rd.strokeStyle = PATH;
  rd.lineWidth = 2.5 * scale;
  rd.lineJoin = "round";
  rd.beginPath();
  rd.moveTo(...toMap(track.x[0], track.z[0]));
  for (let i = 1; i < track.n; i++) {
    rd.lineTo(...toMap(track.x[i], track.z[i]));
  }
  rd.closePath();
  rd.stroke();
  // the start
  const [startX, startY] = toMap(track.x[0], track.z[0]);
  rd.fillStyle = "#ffffff";
  rd.fillRect(startX - 3 * scale, startY - 3 * scale, 6 * scale, 6 * scale);

  const radius = 3.5 * scale;
  for (let c = 0; c < game.carCount; c++) {
    if (c == game.player) {
      continue;
    }
    const [x, y] = toMap(car[c].x, car[c].z);
    drawCar(x, y, radius, track.dested[c] ? WASTED : OPPONENT);
    if (c == (camera.lockedCar >= 0 ? camera.lockedCar : camera.aimedCar)) {
      rd.strokeStyle = "#ffe14a";
      rd.lineWidth = 2 * scale;
      rd.beginPath();
      rd.arc(x, y, radius + 3 * scale, 0, 2 * Math.PI);
      rd.stroke();
    }
  }
  // the player's car last, on top
  const [x, y] = toMap(car[game.player].x, car[game.player].z);
  drawCar(x, y, radius + 1.5 * scale, "#000000");
  drawCar(x, y, radius + 0.5 * scale, "#ffffff");
};
