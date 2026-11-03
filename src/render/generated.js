// Textures and models the game makes itself: the cars' glass, the stage's ground, sky and
// dust in its colours, the smoke and sparks, and the checkpoint text's colours.

import { random } from "../core/random.js";
import { game } from "../core/state.js";
import { bodyDamage, fixcar } from "../race/physics.js";
import { car, racers } from "../race/racers.js";
import { hslToRgb, rgbToHsl } from "../ui/color.js";
import { images } from "../ui/images.js";
import { skinOf } from "../net/roomCars.js";
import { gl, keepDamageTexture } from "./renderer.js";
import { paint, paintPixels } from "./skins.js";
import {
  carModels,
  carTextures,
  checkpointText,
  dustTextures,
  ground,
  scene,
  sky,
  sparkModels,
  spriteTextures,
} from "./scene.js";

const CAR_TYPES = 19;
// the colour of the windows in the car textures
const GLASS = [116, 130, 140];
// how many fading steps each kind of dust has
const DUST_FADES = 5;

const mipmapped = () => {
  gl.generateMipmap(gl.TEXTURE_2D);
};

const clamped = () => {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
};

// Makes a texture of a square image and recolours its pixels (recolor(pixels, p) for each
// pixel at p): WebGL gives them back only through a framebuffer. Returns the texture and
// the recoloured pixels (null when the framebuffer did not work).
const recoloredTexture = (image, size, filtering, recolor) => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  filtering();
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  let pixels = null;
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
    pixels = new Uint8Array(size * size * 4);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    for (let p = 0; p < size * size * 4; p += 4) {
      recolor(pixels, p);
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      size,
      size,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    filtering();
  }
  gl.deleteFramebuffer(framebuffer);
  return { texture, pixels };
};

const isGlass = (pixels, p) =>
  pixels[p] == GLASS[0] &&
  pixels[p + 1] == GLASS[1] &&
  pixels[p + 2] == GLASS[2];

// (the race textures' windows have the sky's colour and are see-through)
const isSeeThrough = (pixels, p) => pixels[p + 3] != 255;

// The menu texture of a car type: windows light blue and see-through, the rest in the
// skin's paint.
const menuCarTexture = (type, skin) =>
  recoloredTexture(carTextures[type], 256, clamped, (pixels, p) => {
    if (isGlass(pixels, p)) {
      pixels[p] = 92;
      pixels[p + 1] = 155;
      pixels[p + 2] = 184;
      pixels[p + 3] = 200;
    } else if (skin) {
      pixels.set(paint(pixels[p], pixels[p + 1], pixels[p + 2], skin), p);
    }
  }).texture;

export function menuCarTextures() {
  for (let i = 0; i < CAR_TYPES; i++) {
    carModels[i].nt = 2;
    carModels[i].texture = [];
    carModels[i].texture[0] = menuCarTexture(i, 0);
  }
}

// the menu textures in the skins, by type and skin, made when first shown (the lobby's)
const skinnedMenuTextures = new Map();

export const skinnedMenuTexture = (type, skin) => {
  if (skin == 0) {
    return carModels[type].texture[0];
  }
  const key = `${type} ${skin}`;
  if (!skinnedMenuTextures.has(key)) {
    skinnedMenuTextures.set(key, menuCarTexture(type, skin));
  }
  return skinnedMenuTextures.get(key);
};

// which of a car model's textures it shows (model.shownTexture): the menus' one with
// light blue windows, or the race's with the sky's colour in them and the damage
export const CAR_TEXTURE = { menu: 0, race: 1 };

// The race textures of the cars, windows in the colour of the stage's sky; they get the
// damage scratched into them.
export function raceCarTextures() {
  for (let c = 0; c < game.carCount; c++) {
    const model = carModels[car[c].typ];
    if (model.loaded == 4) {
      gl.deleteTexture(model.texture[1]);
      model.texture[1] = null;
    }
    const { texture, pixels } = recoloredTexture(
      carTextures[car[c].typ],
      256,
      mipmapped,
      (pixels, p) => {
        if (isGlass(pixels, p)) {
          pixels[p] = scene.glassColor[0];
          pixels[p + 1] = scene.glassColor[1];
          pixels[p + 2] = scene.glassColor[2];
          pixels[p + 3] = 210;
        }
      },
    );
    model.texture[1] = texture;
    keepDamageTexture(model, pixels);
    model.cleanPixels = pixels && Uint8Array.from(pixels);
    model.shownTexture = CAR_TEXTURE.race;
    model.loaded = 4;
  }
  // The first car of a type dents the type's model, as every car did when all types
  // differed. Further cars of that type, and any in a skin, get their own copy to dent and
  // scratch, sharing what never changes (normals, texture coordinates, the menu texture).
  for (let c = 0; c < game.carCount; c++) {
    const model = carModels[car[c].typ];
    let shared = false;
    for (let o = 0; o < c; o++) {
      if (car[o].typ == car[c].typ) {
        shared = true;
      }
    }
    racers[c].body = model;
    bodyDamage.repair?.(c);
    const skin = skinOf(c);
    if (shared || skin) {
      racers[c].body = {
        ...model,
        texture: [model.texture[0], null],
        vbuf: null,
        // (fixcar makes the race texture of these, the glass kept)
        cleanPixels:
          skin && model.cleanPixels
            ? paintPixels(
                Uint8Array.from(model.cleanPixels),
                skin,
                isSeeThrough,
              )
            : model.cleanPixels,
      };
      fixcar(c);
    }
  }
}

// The ground (texture n) in the stage's colour: darker texture pixels shift hue and
// saturation by hueShift and saturationShift. The stage's dust (kinds 6 to 8) gets a
// lighter shade of it.
export function groundTexture(n, r, g, b, hueShift, saturationShift) {
  if (ground.loaded == 4) {
    gl.deleteTexture(ground.texture);
    ground.texture = null;
    for (let i = 6; i < 9; i++) {
      for (let j = 0; j < DUST_FADES; j++) {
        gl.deleteTexture(dustTextures[i][j]);
        dustTextures[i][j] = null;
      }
    }
  }
  // the stage file leaves them out as -1
  const texture = n == -1 ? 0 : n;
  const hueBy = hueShift == -1 ? 0 : hueShift;
  const saturationBy = saturationShift == -1 ? 0 : saturationShift;
  const hsl = rgbToHsl(r, g, b);
  ground.texture = recoloredTexture(
    images.ground[texture],
    256,
    mipmapped,
    (pixels, p) => {
      let hue = hsl[0] + (1 - pixels[p] / 188) * hueBy;
      if (hue > 1) {
        hue -= 1;
      }
      if (hue < 0) {
        hue += 1;
      }
      const saturation = Math.min(
        Math.max(hsl[1] + (1 - pixels[p] / 188) * saturationBy, 0),
        1,
      );
      const lightness = Math.min(Math.max(hsl[2] * (pixels[p] / 192), 0), 1);
      const rgb = hslToRgb(hue, saturation, lightness);
      pixels[p] = rgb[0];
      pixels[p + 1] = rgb[1];
      pixels[p + 2] = rgb[2];
    },
  ).texture;
  const dust = hslToRgb(hsl[0], hsl[1], Math.min(hsl[2] * 1.2, 1));
  for (let i = 6; i < 9; i++) {
    dustTextures[i] = [];
    for (let j = 0; j < DUST_FADES; j++) {
      dustTextures[i][j] = recoloredTexture(
        images.sprites[i - 6],
        64,
        mipmapped,
        (pixels, p) => {
          pixels[p] = dust[0];
          pixels[p + 1] = dust[1];
          pixels[p + 2] = dust[2];
          pixels[p + 3] *= 0.75 - j * 0.15;
        },
      ).texture;
    }
  }
  ground.loaded = 4;
}

// The pixels of an image, for reading only.
const pixelsOf = (image) => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  const pixels = new Uint8Array(256 * 256 * 4);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  }
  gl.deleteFramebuffer(framebuffer);
  gl.deleteTexture(texture);
  return pixels;
};

// The sky: the clouds (texture cloudType) in their colour on the sky's, fading into the
// fog towards the horizon (the halo image).
export function skyTexture(skyColor, fogColor, cloudColor, cloudType) {
  if (sky.loaded == 4) {
    gl.deleteTexture(sky.texture);
    sky.texture = null;
  }
  const halo = pixelsOf(images.halo);
  sky.texture = recoloredTexture(
    images.sky[cloudType],
    256,
    mipmapped,
    (pixels, p) => {
      const fog = halo[p] / 510;
      const cloud = Math.min(Math.max(pixels[p] / 128 - fog * 2, 0), 1);
      for (let k = 0; k < 3; k++) {
        pixels[p + k] =
          (skyColor[k] * (1 - cloud) + cloudColor[k] * cloud) * (1 - fog) +
          fogColor[k] * fog;
      }
    },
  ).texture;
  sky.loaded = 4;
}

// The dust of the race (kinds 0 to 2 grey smoke, 3 to 5 sand), each fading in five steps,
// and the blue smoke of the car select.
export function createDustTextures() {
  for (let i = 0; i < 6; i++) {
    dustTextures[i] = [];
    for (let j = 0; j < DUST_FADES; j++) {
      dustTextures[i][j] = recoloredTexture(
        images.sprites[i % 3],
        64,
        mipmapped,
        (pixels, p) => {
          if (i < 3) {
            pixels[p] = 192;
            pixels[p + 1] = 192;
            pixels[p + 2] = 192;
            pixels[p + 3] *= 0.5 - j * 0.1;
          } else {
            pixels[p] = 228;
            pixels[p + 1] = 217;
            pixels[p + 2] = 192;
            pixels[p + 3] *= (5 - j) / 5;
          }
        },
      ).texture;
    }
  }
  for (let i = 0; i < 3; i++) {
    spriteTextures[i] = recoloredTexture(
      images.sprites[i],
      64,
      clamped,
      (pixels, p) => {
        pixels[p] = 65;
        pixels[p + 1] = 186;
        pixels[p + 2] = 255;
        pixels[p + 3] *= 0.5;
      },
    ).texture;
  }
}

// Six sparks: thin triangles of growing size, randomly slanted and long, every second one
// upside down, yellow to red in the stage's tint.
export function createSparks() {
  let flip = 1;
  sparkModels.forEach((spark, s) => {
    if (spark.loaded == 1) {
      gl.deleteBuffer(spark.vbuf);
      spark.vbuf = null;
      gl.deleteBuffer(spark.cbuf);
      spark.cbuf = null;
      gl.deleteBuffer(spark.ibuf);
      spark.ibuf = null;
    }
    let slant = random.fx() * 1;
    if (random.fx() > random.fx()) {
      slant = -slant;
    }
    const length = 20 + random.fx() * 10;
    const size = 0.2 + s * 0.04;
    const vertices = [
      [-0.5 * size, 0.5 * flip * size, slant * size],
      [0.5 * size, -0.5 * flip * size, -slant * size],
      [0, 0, -length],
    ].flat();
    flip = -flip;
    const yellow = [1 + 1 * scene.tint[0], 0.77 + 0.77 * scene.tint[1], 0, 1];
    const colors = [...yellow, ...yellow, 1 + 1 * scene.tint[0], 0, 0, 0.4];
    spark.ni = 3;
    spark.vbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spark.vbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    spark.cbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spark.cbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    spark.ibuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spark.ibuf);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array([0, 1, 2]),
      gl.STATIC_DRAW,
    );
    spark.alpha = true;
    spark.mat = mat4.create();
    spark.x = s * 10;
    spark.y = 5;
    spark.loaded = 1;
  });
}

// The checkpoint text: blue below its middle, white above. The original meant to tint
// both in the stage's colour, but its loop indexed with an unset variable, so they stay
// as they are.
const TEXT_BELOW = [62, 160, 252, 192];
const TEXT_ABOVE = [211, 234, 255, 192];

export function colorCheckpointText() {
  gl.deleteBuffer(checkpointText.cbuf);
  checkpointText.cbuf = null;
  const colors = [];
  for (let i = 0; i < checkpointText.vert.length / 3; i++) {
    const color = checkpointText.vert[i * 3 + 1] < 0 ? TEXT_BELOW : TEXT_ABOVE;
    for (let k = 0; k < 4; k++) {
      colors[i * 4 + k] = color[k] / 255;
    }
  }
  checkpointText.cbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, checkpointText.cbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
}
