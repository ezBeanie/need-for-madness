// The small turning cars on the lobby's cards of players and bots (see ui/multiplayerMenu.js):
// each car type shown is drawn once a frame into a framebuffer and copied into every card's
// canvas of that type.

import { carStats } from "../data/carStats.js";
import { poseShowcaseCar } from "../screens/showcase.js";
import { drawWheeledCar } from "./drawFrame.js";
import { CAR_TEXTURE } from "./generated.js";
import { drawCamera } from "./interpolation.js";
import { gl, setWorld } from "./renderer.js";
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
let target = null;
let pixels = null;
let flipped = null;
let copy = null;
const projection = mat4.create();

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

const makeTarget = () => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  const depth = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
  gl.renderbufferStorage(
    gl.RENDERBUFFER,
    gl.DEPTH_COMPONENT16,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
  );
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  gl.framebufferRenderbuffer(
    gl.FRAMEBUFFER,
    gl.DEPTH_ATTACHMENT,
    gl.RENDERBUFFER,
    depth,
  );
  pixels = new Uint8Array(PREVIEW_WIDTH * PREVIEW_HEIGHT * 4);
  flipped = new ImageData(PREVIEW_WIDTH, PREVIEW_HEIGHT);
  copy = document.createElement("canvas");
  copy.width = PREVIEW_WIDTH;
  copy.height = PREVIEW_HEIGHT;
  return framebuffer;
};

// (WebGL reads from the bottom row up)
const keepPixels = () => {
  gl.readPixels(
    0,
    0,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixels,
  );
  const row = PREVIEW_WIDTH * 4;
  for (let y = 0; y < PREVIEW_HEIGHT; y++) {
    flipped.data.set(
      pixels.subarray(
        (PREVIEW_HEIGHT - 1 - y) * row,
        (PREVIEW_HEIGHT - y) * row,
      ),
      y * row,
    );
  }
  copy.getContext("2d").putImageData(flipped, 0, 0);
};

// Every frame: the lobby's cars, after the frame's own scene.
export const drawCarPreviews = () => {
  const canvases = previews.root ? previewsIn(previews.root) : [];
  if (canvases.length == 0) {
    return;
  }
  target ??= makeTarget();
  gl.bindFramebuffer(gl.FRAMEBUFFER, target);
  gl.viewport(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
  const { x, y, z } = drawCamera;
  mat4.copy(projection, drawCamera.projection);
  drawCamera.x = 0;
  drawCamera.y = 0;
  drawCamera.z = 0;
  mat4.perspective(
    drawCamera.projection,
    (FIELD_OF_VIEW * Math.PI) / 180,
    PREVIEW_WIDTH / PREVIEW_HEIGHT,
    0.1,
    1000,
  );
  mat4.rotate(
    drawCamera.projection,
    drawCamera.projection,
    (PITCH * Math.PI) / 180,
    [1, 0, 0],
  );
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  for (const type of shownTypes(canvases).filter((t) => posed.has(t))) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawWheeledCar(
      type,
      carModels[type],
      showcaseWheels[type],
      carModels[type],
      () => true,
    );
    keepPixels();
    for (const canvas of canvases) {
      if (Number(canvas.dataset.car) == type) {
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(copy, 0, 0);
      }
    }
  }
  gl.disable(gl.DEPTH_TEST);
  Object.assign(drawCamera, { x, y, z });
  mat4.copy(drawCamera.projection, projection);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
};
