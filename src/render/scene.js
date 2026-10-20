import { newModel, newParticleModel } from "./models.js";
import { gl } from "./renderer.js";

// One model and one shadow per car type.
export const carModels = Array.from({ length: 19 }, newModel);
export const carShadows = Array.from({ length: 19 }, newModel);

// The six spark shapes, rebuilt in the stage's colours (see createSparks).
export const sparkModels = Array.from({ length: 6 }, newParticleModel);

// Set per stage: the colour tint of everything (r, g, b offsets) and the colour of car
// windows, which mirror the sky.
export const scene = {
  tint: [0, 0, 0],
  glassColor: [],
  // the stage's fog colour and how far one sees, and where the light comes from
  fog: [],
  fogDistance: 10700,
  light: [0, 1, 0],
};

// The tube the time travels through while winding back time (see drawrevtime).
export const timeTube = newParticleModel();

// The textures of every car type (see menuCarTextures).
export const carTextures = [];

// The models of the world and the menus, loaded with the game data (see loadAssets).
// (in the classic look the ground has no outlines and the sky is bands, as in the original)
export const ground = { ...newModel(), noOutline: true };
export const sky = { ...newModel(), classicSky: true };
// a wheel's disc, and the tread close up and far away, shaped per car type (createWheels)
export const wheelDisk = newModel();
export const wheelTread = newParticleModel();
export const wheelTreadLow = newParticleModel();
export const checkpointText = newParticleModel();
export const finishText = newParticleModel();
// the backdrop of the stage select and the race end, coloured like the stage
export const stageBackdrop = newParticleModel();
// the backdrop of the other menus
export const menuBackdrop = newModel();
export const fixHoop = newModel();
// the sparks of a car being fixed in a fix hoop
export const electricity = newModel();
export const dustSprite = newModel();

// per car type the front and the rear wheel: disk, tread, low-detail tread
const perWheel = (create) =>
  Array.from({ length: 19 }, () => [create(), create()]);
export const wheelDisks = perWheel(newModel);
export const wheelTreads = perWheel(newParticleModel);
export const wheelTreadsLow = perWheel(newParticleModel);
// dust: per kind (the first three on the ground, the others in the air) five fading
// textures; the textures of the dust sprite
export const dustTextures = [];
export const spriteTextures = [];
export const explosionModels = Array.from({ length: 3 }, newModel);

// the car presented in the menus: its wheels, per car type
export const showcaseWheels = Array.from({ length: 19 }, () =>
  Array.from({ length: 4 }, () => ({ x: 0, y: 0, z: 0, mat: null, dist: 0 })),
);
// the smoke drifting behind the car select
export const menuSmoke = [];

// Colours the stage backdrop behind menus: its first vertex `top`, the others `rest` (RGB,
// 0..255). As in the original, as many colours as the checkpoint text has vertices.
export const colorStageBackdrop = (top, rest) => {
  gl.deleteBuffer(stageBackdrop.cbuf);
  stageBackdrop.cbuf = null;
  const colors = [];
  for (let i = 0; i < checkpointText.vert.length / 3; i++) {
    const color = i == 0 ? top : rest;
    for (let k = 0; k < 3; k++) {
      colors[i * 4 + k] = color[k] / 255;
    }
    colors[i * 4 + 3] = 1;
  }
  stageBackdrop.cbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, stageBackdrop.cbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
};
