// The small turning cars on the lobby's cards of players and bots (see ui/multiplayerMenu.js):
// each car type shown, in each skin shown, is drawn once a frame into a framebuffer and
// copied into every card's canvas of that type and skin.

import { drawClassicPreview } from "../classic/frame.js";
import { poseShowcaseCar } from "../screens/showcase.js";
import { drawWheeledCar } from "./drawFrame.js";
import { CAR_TEXTURE, skinnedMenuTexture } from "./generated.js";
import { MAX_CARS } from "../core/state.js";
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
// how far the camera is from the smallest cars; bigger ones are farther, to fit the card
// as they turn
const DISTANCE = 52;
const LENGTHS_AWAY = 2.2;
const HEIGHTS_AWAY = 2.4;
// how far below the camera the middle of a car is, by its distance
const BELOW = 0.17;

let spin = 30;
// the types turned this tick: one chosen since is drawn from the next on; whether they have
// been drawn since (between ticks they stand still)
const posed = new Set();
let drawn = false;
const offscreen = newOffscreen(PREVIEW_WIDTH, PREVIEW_HEIGHT, MAX_CARS);

// the element holding the cards while they show (see ui/multiplayerMenu.js), else null;
// lit: whether the cars have the car select's light since
export const previews = { root: null, lit: false };

// The car's distance and height in the card: its height's middle a little below the
// camera's middle, far enough away that neither its length turned sideways nor its height
// leave the card.
const placeInCard = (body) => {
  let lowest = Infinity;
  let highest = -Infinity;
  for (let k = 1; k < body.positions.length; k += 3) {
    lowest = Math.min(lowest, body.positions[k]);
    highest = Math.max(highest, body.positions[k]);
  }
  const distance = Math.max(
    DISTANCE,
    LENGTHS_AWAY * body.colrad,
    body.colrad + HEIGHTS_AWAY * (highest - lowest),
  );
  body.x = 0;
  body.y = -BELOW * distance - (lowest + highest) / 2;
  body.z = -distance;
};

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
  drawn = false;
  for (const type of shownTypes(previewsIn(previews.root))) {
    posed.add(type);
    const body = carModels[type];
    placeInCard(body);
    body.shownTexture = CAR_TEXTURE.menu;
    poseShowcaseCar(type, spin, 0);
  }
};

// Every frame a tick has turned them: the lobby's cars, after the frame's own scene.
export const drawCarPreviews = () => {
  const canvases = previews.root ? previewsIn(previews.root) : [];
  if (canvases.length == 0 || drawn) {
    return;
  }
  drawn = true;
  const cars = shownCars(canvases)
    .filter(([type]) => posed.has(type))
    .slice(0, MAX_CARS);
  if (cars.length == 0) {
    return;
  }
  offscreen.start(FIELD_OF_VIEW, PITCH);
  cars.forEach(([type, skin], i) => {
    offscreen.clear(i);
    const body = carModels[type];
    if (look.current == LOOK.classic) {
      drawClassicPreview(body, type, skin, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    } else {
      const own = body.texture[0];
      body.texture[0] = skinnedMenuTexture(type, skin);
      drawWheeledCar(type, body, showcaseWheels[type], body, () => true);
      body.texture[0] = own;
    }
  });
  offscreen.read(cars.length);
  cars.forEach(([type, skin], i) => {
    offscreen.copyTile(
      i,
      canvases.filter(
        ({ dataset }) =>
          Number(dataset.car) == type && Number(dataset.skin ?? 0) == skin,
      ),
    );
  });
  offscreen.end();
};
