import { newModel, newParticleModel } from "./models.js";

// One model and one shadow per car type.
export const carModels = Array.from({ length: 19 }, newModel);
export const carShadows = Array.from({ length: 19 }, newModel);

// The six spark shapes, rebuilt in the stage's colours (see createsparks).
export const sparkModels = Array.from({ length: 6 }, newParticleModel);

// Set per stage: the colour tint of everything (r, g, b offsets) and the colour of car
// windows, which mirror the sky.
export const scene = { tint: [0, 0, 0], glassColor: [] };

// The tube the time travels through while winding back time (see drawrevtime).
export const timeTube = newParticleModel();

// The textures of every car type (see cartextures).
export const carTextures = [];

// The models of the world and the menus, loaded with the game data (see loaddata).
export const ground = newModel();
export const sky = newModel();
// a wheel's disc, and the tread close up and far away, shaped per car type (createwheels)
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

// the car presented in the menus: its wheels, per car type
export const showcaseWheels = Array.from({ length: 19 }, () =>
  Array.from({ length: 4 }, () => ({ x: 0, y: 0, z: 0, mat: null, dist: 0 })),
);
// the smoke drifting behind the car select
export const menuSmoke = [];
