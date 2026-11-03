// The small turning cars on the lobby's cards of players and bots (see ui/multiplayerMenu.js):
// each car type shown, in each skin shown, is drawn once a frame into a framebuffer and
// copied into every card's canvas of that type and skin.

import { drawClassicPreview } from "../classic/frame.js";
import { carStats } from "../data/carStats.js";
import { poseShowcaseCar } from "../screens/showcase.js";
import { drawWheeledCar } from "./drawFrame.js";
import { CAR_TEXTURE, skinnedMenuTexture } from "./generated.js";
import { LOOK, look } from "./look.js";
import { newOffscreen } from "./offscreen.js";
import { setWorld } from "./renderer.js";
import { carModels, scene, showcaseWheels } from "./scene.js";

// a card's canvas, in pixels
export const PREVIEW_WIDTH = 240;
export const PREVIEW_HEIGHT = 144;
// degrees a tick
const TURN = 3;
// the camera a little above, looking down at the car before it
const PITCH = 14;
const FIELD_OF_VIEW = 34;
const DISTANCE = 52;

let spin = 30;
// the types turned this tick: one chosen since is drawn from the next on
const posed = new Set();
const offscreen = newOffscreen(PREVIEW_WIDTH, PREVIEW_HEIGHT);

// the element holding the cards while they show (see ui/multiplayerMenu.js), else null;
// lit: whether the cars have the car select's light since
export const previews = { root: null, lit: false };

// (a game just started, or back from a race, has none or the stage's)
const lightCars = () => {
  scene.tint = [0, -0.05, 0.6];
  setWorld(scene.tint, [0, 0, 0], 0, 0.866, -0.5, 10700);
  previews.lit = true;
};

const shownTypes = (canvases) => [
  ...new Set(canvases.map((canvas) => Number(canvas.dataset.car))),
];

// the cars shown, each type in each skin once
const shownCars = (canvases) => {
  const keys = new Set(
    canvases.map(({ dataset }) => `${dataset.car} ${dataset.skin ?? 0}`),
  );
  return [...keys].map((key) => key.split(" ").map(Number));
};

const previewsIn = (root) => [
  ...(root.querySelectorAll?.("canvas.car-preview") ?? []),
];

// Every tick: the lobby's cars turn on.
export const turnCarPreviews = () => {
  if (!previews.root) {
    previews.lit = false;
    return;
  }
  if (!previews.lit) {
    lightCars();
  }
  spin = (spin + TURN) % 360;
  posed.clear();
  for (const type of shownTypes(previewsIn(previews.root))) {
    posed.add(type);
    const body = carModels[type];
    body.x = 0;
    body.y = carStats.wly[type][1] + 1.5 * carStats.wlh[type][1] - 16;
    body.z = -DISTANCE;
    body.shownTexture = CAR_TEXTURE.menu;
    poseShowcaseCar(type, spin, 0);
  }
};

// Every frame: the lobby's cars, after the frame's own scene.
export const drawCarPreviews = () => {
  const canvases = previews.root ? previewsIn(previews.root) : [];
  if (canvases.length == 0) {
    return;
  }
  offscreen.start(FIELD_OF_VIEW, PITCH);
  for (const [type, skin] of shownCars(canvases)) {
    if (!posed.has(type)) {
      continue;
    }
    offscreen.clear();
    const body = carModels[type];
    if (look.current == LOOK.classic) {
      drawClassicPreview(body, type, skin, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    } else {
      const own = body.texture[0];
      body.texture[0] = skinnedMenuTexture(type, skin);
      drawWheeledCar(type, body, showcaseWheels[type], body, () => true);
      body.texture[0] = own;
    }
    offscreen.copyTo(
      canvases.filter(
        ({ dataset }) =>
          Number(dataset.car) == type && Number(dataset.skin ?? 0) == skin,
      ),
    );
  }
  offscreen.end();
};
