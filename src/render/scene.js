import { newModel, newParticleModel } from "./models.js";

// One model and one shadow per car type.
export const carModels = Array.from({ length: 19 }, newModel);
export const carShadows = Array.from({ length: 19 }, newModel);

// The six spark shapes, rebuilt in the stage's colours (see createsparks).
export const sparkModels = Array.from({ length: 6 }, newParticleModel);

// Set per stage: the colour tint of everything (r, g, b offsets) and the colour of car
// windows, which mirror the sky.
export const scene = { tint: [0, 0, 0], glassColor: [] };

// The textures of every car type (see cartextures).
export const carTextures = [];
