// WebGL: the 3D canvas, the shader programs and drawing models and particles.

import { view } from "../ui/view.js";
import { drawCamera, drawMatrix, placeModel } from "./interpolation.js";
import { LOOK, look } from "./look.js";

export const canvas3D = document.querySelector("#canvas3D");
export const gl =
  canvas3D.getContext("webgl") || canvas3D.getContext("experimental-webgl");

// This game's stages are the mirror image of the original Java game's (its HTML5 remake
// turned their x round when loading them): the 3D picture is shown mirrored, so the
// stages look as in the original, and in races the steering is turned round to match
// (see input/controls.js).
canvas3D.style.transform = "scaleX(-1)";

// the original drew into 800 x 450 pixels
const CLASSIC_HEIGHT = 450;

// Sizes the 3D canvas's pixels for the look; on screen it always fills the window.
export const fitCanvas3D = () => {
  // the classic look in the original's few pixels, unless sharp
  const classic = look.current == LOOK.classic && !look.sharp;
  const height = classic ? CLASSIC_HEIGHT : view.height;
  const width = classic ? Math.round(CLASSIC_HEIGHT * view.aspect) : view.width;
  if (canvas3D.width == width && canvas3D.height == height) {
    return;
  }
  canvas3D.height = height;
  canvas3D.width = width;
  canvas3D.style.imageRendering = classic ? "pixelated" : "";
  gl.viewport(0, 0, canvas3D.width, canvas3D.height);
};

export const isPowerOf2 = (value) => (value & (value - 1)) == 0;

// Textures shared by several track pieces (data/3D/textures/g<n>.png), see grouptexture().
export const textureGroups = Array.from({ length: 20 }, () => ({
  loaded: 0,
  texture: null,
}));

export const loadTextureGroup = (group, n) => {
  // a grey pixel until the image is there
  group.texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, group.texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([150, 150, 150, 255]),
  );
  const image = new Image();
  image.onload = () => {
    group.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, group.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    group.loaded = 1;
  };
  image.src = `data/3D/textures/g${n}.png`;
};

// The shader programs, by how a model is lit.
const COLORED = 0; // particles: vertex colours, no light
const LIT = 1; // ambient plus directional light along the normals
const OWN_SHADE = 2; // ownShade(): a stronger ambient light only
const OWN_LIGHT = 3; // ownLight(): an even stronger ambient light only
const FULL_BRIGHT = 4; // ownLight() and ownShade(): the texture as it is

const programs = [];

const glslVec3 = ([x, y, z]) => `vec3(${x},${y},${z})`;

// Fog: the further from the camera, the more the colour turns into the fog colour.
const fogDeclarations = (fogColor, near, far) =>
  `highp vec4 u_fogColor=vec4(${fogColor[0]},${fogColor[1]},${fogColor[2]},1);` +
  `highp float u_fogNear=${near}.0;highp float u_fogFar=${far}.0;`;
const FOG_AMOUNT =
  "float abx=abs(v_posf.x); float aby=abs(v_posf.y); float abz=abs(v_posf.z); " +
  "float fct=(abs(abx-abz)/(abx+abz)); float mav=((abx+abz)/(2.0-fct)); " +
  "float fogDistance=((mav+(mav*(1.0-fct)*0.414))+(aby*0.5)); " +
  "float fogAmount = smoothstep(u_fogNear, u_fogFar, fogDistance);";

const coloredShaders = (fog) => ({
  vertex:
    "attribute vec4 aVertexPosition; attribute vec4 aVertexColor; uniform mat4 uModelViewMatrix; " +
    "uniform mat4 uProjectionMatrix; varying lowp vec4 vColor; varying vec3 v_posf; " +
    "void main(void) { gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition; " +
    "vColor = aVertexColor; v_posf = (uModelViewMatrix * aVertexPosition).xyz; }",
  fragment:
    `precision mediump float; varying vec3 v_posf; varying lowp vec4 vColor; ${fog} ` +
    `void main(void) { ${FOG_AMOUNT}gl_FragColor = mix(vColor, u_fogColor, fogAmount); }`,
});

const texturedFragment = (fog) =>
  "precision mediump float;varying highp vec2 vTextureCoord; varying highp vec3 vLighting; " +
  `varying vec3 v_posf;uniform sampler2D uSampler; ${fog} void main(void) { ` +
  `highp vec4 texelColor = texture2D(uSampler, vTextureCoord); ${FOG_AMOUNT}` +
  "highp vec4 color=vec4(texelColor.rgb * vLighting, texelColor.a); " +
  "gl_FragColor = mix(color, u_fogColor, fogAmount); }";

const litShaders = (fog, ambient, directional, direction) => ({
  vertex:
    "attribute vec4 aVertexPosition; attribute vec3 aVertexNormal; attribute vec2 aTextureCoord; " +
    "uniform mat4 uNormalMatrix; uniform mat4 uModelViewMatrix; uniform mat4 uProjectionMatrix; " +
    "varying highp vec2 vTextureCoord; varying highp vec3 vLighting;varying vec3 v_posf; " +
    "void main(void) { gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition; " +
    `vTextureCoord = aTextureCoord; highp vec3 ambientLight = ${glslVec3(ambient)}; ` +
    `highp vec3 directionalLightColor = ${glslVec3(directional)}; ` +
    `highp vec3 directionalVector = normalize(${glslVec3(direction)}); ` +
    "highp vec4 transformedNormal = uNormalMatrix * vec4(aVertexNormal, 1.0); " +
    "highp float directional = max(dot(transformedNormal.xyz, directionalVector), 0.0); " +
    "vLighting = ambientLight + (directionalLightColor * directional); " +
    "v_posf = (uModelViewMatrix * aVertexPosition).xyz; }",
  fragment: texturedFragment(fog),
});

const ambientShaders = (fog, ambient) => ({
  vertex:
    "attribute vec4 aVertexPosition; attribute vec2 aTextureCoord; uniform mat4 uModelViewMatrix; " +
    "uniform mat4 uProjectionMatrix; varying highp vec2 vTextureCoord; varying highp vec3 vLighting; " +
    "varying vec3 v_posf;void main(void) { gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition; " +
    `vTextureCoord = aTextureCoord; highp vec3 ambientLight=${glslVec3(ambient)}; ` +
    "vLighting = ambientLight; v_posf = (uModelViewMatrix * aVertexPosition).xyz; }",
  fragment: texturedFragment(fog),
});

const compileShader = (type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(
      `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`,
    );
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const linkProgram = ({ vertex, fragment }) => {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    alert(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(program)}`,
    );
    return null;
  }
  return program;
};

const ATTRIBUTES = {
  vertexPosition: "aVertexPosition",
  vertexColor: "aVertexColor",
  vertexNormal: "aVertexNormal",
  textureCoord: "aTextureCoord",
};
const UNIFORMS = {
  projectionMatrix: "uProjectionMatrix",
  modelViewMatrix: "uModelViewMatrix",
  normalMatrix: "uNormalMatrix",
  uSampler: "uSampler",
};

const programInfo = (shaders, attributes, uniforms) => {
  const program = linkProgram(shaders);
  const locations = (names, glNames, locate) =>
    Object.fromEntries(
      names.map((name) => [name, locate(program, glNames[name])]),
    );
  return {
    program,
    attribLocations: locations(attributes, ATTRIBUTES, (p, n) =>
      gl.getAttribLocation(p, n),
    ),
    uniformLocations: locations(uniforms, UNIFORMS, (p, n) =>
      gl.getUniformLocation(p, n),
    ),
  };
};

// Builds the shader programs for a stage: tint brightens all light (stage snap()),
// fogColor (0..255) and fogDistance set the fog, light the direction of the sun.
export const setWorld = (
  tint,
  fogColor,
  lightX,
  lightY,
  lightZ,
  fogDistance,
) => {
  const scaled = (base) => tint.map((t) => (base + t * base) * 0.76);
  const fogTint = fogColor.slice(0, 3).map((c, i) => {
    const color = c / 255;
    return (color + color * tint[i]) * 0.76;
  });
  const fog = fogDeclarations(fogTint, 100, fogDistance);
  classicWorld = { fog, tint, fogTint, sky: classicWorld?.sky ?? [0, 0, 0] };
  classicPrograms = null;
  const textured = ["vertexPosition", "textureCoord"];
  const texturedUniforms = ["projectionMatrix", "modelViewMatrix", "uSampler"];
  programs[COLORED] = programInfo(
    coloredShaders(fog),
    ["vertexPosition", "vertexColor"],
    ["projectionMatrix", "modelViewMatrix"],
  );
  programs[LIT] = programInfo(
    litShaders(fog, scaled(0.6), scaled(0.7), [lightX, lightY, lightZ]),
    ["vertexPosition", "vertexNormal", "textureCoord"],
    ["projectionMatrix", "modelViewMatrix", "normalMatrix", "uSampler"],
  );
  programs[OWN_SHADE] = programInfo(
    ambientShaders(fog, scaled(1.2)),
    textured,
    texturedUniforms,
  );
  programs[OWN_LIGHT] = programInfo(
    ambientShaders(fog, scaled(1.3)),
    textured,
    texturedUniforms,
  );
  programs[FULL_BRIGHT] = programInfo(
    ambientShaders(fog, [1, 1, 1]),
    textured,
    texturedUniforms,
  );
};

// The classic look (see look.js). Its programs are made when it is first drawn, so a stage
// loads as before: the stage's fog and tint (setWorld), then the programs.
let classicWorld = null;
let classicPrograms = null;

// The original's light: from straight above, a face's brightness is how flat it lies plus
// 0.3, between 0.6 and 1. Its fog came in bands, 16 of them.
const CLASSIC_LIGHT = "clamp(abs(normal.y) + 0.3, 0.6, 1.0)";
const STEPPED_FOG = "floor(fogAmount * 16.0) / 16.0";

// The stage's sky colour (0..255), for the classic sky.
export const setClassicSky = (color) => {
  classicWorld = { ...classicWorld, sky: color };
  classicPrograms = null;
};

// The original's sky: bands from the fog colour at the horizon up to the sky's colour.
const classicSkyShaders = (fogTint, skyTint) => ({
  vertex:
    "attribute vec4 aVertexPosition; uniform mat4 uModelViewMatrix; uniform mat4 uProjectionMatrix; " +
    "varying highp vec3 v_posf; void main(void) { " +
    "gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition; " +
    "v_posf = (uModelViewMatrix * aVertexPosition).xyz; }",
  fragment:
    "precision mediump float; varying highp vec3 v_posf; void main(void) { " +
    "float up = clamp(normalize(v_posf).y * 3.0, 0.0, 1.0); " +
    `gl_FragColor = vec4(mix(${glslVec3(fogTint)}, ${glslVec3(skyTint)}, ${"floor(up * 16.0) / 16.0"}), 1.0); }`,
});

const classicShaders = (fog, tint, shaded, derivatives) => ({
  vertex:
    "attribute vec4 aVertexPosition; attribute vec2 aTextureCoord; uniform mat4 uModelViewMatrix; " +
    "uniform mat4 uProjectionMatrix; varying highp vec2 vTextureCoord; varying highp vec3 v_posf; " +
    "void main(void) { gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition; " +
    "vTextureCoord = aTextureCoord; v_posf = (uModelViewMatrix * aVertexPosition).xyz; }",
  fragment:
    (derivatives ? "#extension GL_OES_standard_derivatives : enable\n" : "") +
    "precision mediump float; varying highp vec2 vTextureCoord; varying highp vec3 v_posf; " +
    `uniform sampler2D uSampler; ${fog} void main(void) { ${FOG_AMOUNT}` +
    // the face's normal from how the position changes across it: flat, also when dented
    (shaded && derivatives
      ? "highp vec3 normal = normalize(cross(dFdx(v_posf), dFdy(v_posf))); " +
        `float light = ${CLASSIC_LIGHT}; `
      : "float light = 1.0; ") +
    // every corner of a face samples its middle, a little blurred: one colour a face
    "highp vec4 texel = texture2D(uSampler, vTextureCoord, 2.0); " +
    `highp vec4 color = vec4(texel.rgb * light * ${glslVec3(tint.map((t) => 1 + t))}, texel.a); ` +
    `gl_FragColor = mix(color, u_fogColor, ${STEPPED_FOG}); }`,
});

const outlineShaders = (fog) => ({
  vertex:
    "attribute vec4 aVertexPosition; uniform mat4 uModelViewMatrix; uniform mat4 uProjectionMatrix; " +
    "varying highp vec3 v_posf; void main(void) { " +
    "gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition; " +
    "v_posf = (uModelViewMatrix * aVertexPosition).xyz; }",
  fragment:
    `precision mediump float; varying highp vec3 v_posf; ${fog} void main(void) { ${FOG_AMOUNT}` +
    `gl_FragColor = mix(vec4(0.0, 0.0, 0.0, 1.0), u_fogColor, ${STEPPED_FOG}); }`,
});

const makeClassicPrograms = () => {
  const derivatives = !!gl.getExtension("OES_standard_derivatives");
  const { fog, tint, fogTint, sky } = classicWorld;
  const skyTint = sky.map((c, i) => (c / 255) * (1 + tint[i]) * 0.76);
  const textured = ["vertexPosition", "textureCoord"];
  const uniforms = ["projectionMatrix", "modelViewMatrix", "uSampler"];
  return {
    shaded: programInfo(
      classicShaders(fog, tint, true, derivatives),
      textured,
      uniforms,
    ),
    bright: programInfo(
      classicShaders(fog, tint, false, derivatives),
      textured,
      uniforms,
    ),
    outline: programInfo(
      outlineShaders(fog),
      ["vertexPosition"],
      ["projectionMatrix", "modelViewMatrix"],
    ),
    sky: programInfo(
      classicSkyShaders(fogTint, skyTint),
      ["vertexPosition"],
      ["projectionMatrix", "modelViewMatrix"],
    ),
  };
};

// For the classic look, made from what the model was built from (models.js): each corner
// gets the texture coordinate of its face's middle, and the outlines are the faces' edges,
// leaving out those between two faces in one plane (a quad's diagonal, say).
const classicBuffers = (model) => {
  model.classicReady = true;
  if (!model.positions) {
    return;
  }
  const { positions, uvs } = model;
  const faces = positions.length / 9;
  const middles = new Float32Array(uvs.length);
  const normals = [];
  for (let f = 0; f < faces; f++) {
    for (let axis = 0; axis < 2; axis++) {
      const middle =
        (uvs[f * 6 + axis] + uvs[f * 6 + 2 + axis] + uvs[f * 6 + 4 + axis]) / 3;
      for (let corner = 0; corner < 3; corner++) {
        middles[f * 6 + corner * 2 + axis] = middle;
      }
    }
    const p = (corner, axis) => positions[f * 9 + corner * 3 + axis];
    const ux = p(1, 0) - p(0, 0);
    const uy = p(1, 1) - p(0, 1);
    const uz = p(1, 2) - p(0, 2);
    const vx = p(2, 0) - p(0, 0);
    const vy = p(2, 1) - p(0, 1);
    const vz = p(2, 2) - p(0, 2);
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    normals.push([nx / length, ny / length, nz / length]);
  }
  const key = (i) =>
    `${positions[i * 3].toFixed(2)},${positions[i * 3 + 1].toFixed(2)},${positions[i * 3 + 2].toFixed(2)}`;
  const edges = new Map();
  for (let f = 0; f < faces; f++) {
    for (let corner = 0; corner < 3; corner++) {
      const a = f * 3 + corner;
      const b = f * 3 + ((corner + 1) % 3);
      const [ka, kb] = [key(a), key(b)].sort();
      const id = `${ka}|${kb}`;
      const edge = edges.get(id) ?? { a, b, faces: [] };
      edge.faces.push(f);
      edges.set(id, edge);
    }
  }
  const lines = [];
  for (const edge of edges.values()) {
    if (edge.faces.length == 2) {
      const [n, m] = edge.faces.map((f) => normals[f]);
      if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] > 0.999) {
        continue;
      }
    }
    lines.push(edge.a, edge.b);
  }
  model.middlesBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, model.middlesBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, middles, gl.STATIC_DRAW);
  model.outlineCount = lines.length;
  model.outlineBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.outlineBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(lines),
    gl.STATIC_DRAW,
  );
};

const bindModelTexture = (model, uSampler) => {
  gl.activeTexture(gl.TEXTURE0);
  if (model.tgn) {
    gl.bindTexture(gl.TEXTURE_2D, textureGroups[model.tgn - 1].texture);
  } else {
    gl.bindTexture(
      gl.TEXTURE_2D,
      model.nt == 1 ? model.texture : model.texture[model.shownTexture],
    );
  }
  gl.uniform1i(uSampler, 0);
};

const drawClassicSky = (model) => {
  const { program, attribLocations, uniformLocations } = classicPrograms.sky;
  placeModel(model);
  bindAttribute(attribLocations.vertexPosition, model.vbuf, 3);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.ibuf);
  gl.useProgram(program);
  gl.uniformMatrix4fv(
    uniformLocations.projectionMatrix,
    false,
    drawCamera.projection,
  );
  gl.uniformMatrix4fv(uniformLocations.modelViewMatrix, false, drawMatrix);
  gl.drawElements(gl.TRIANGLES, model.ni, gl.UNSIGNED_SHORT, 0);
};

const drawClassicModel = (model) => {
  classicPrograms ??= makeClassicPrograms();
  if (model.classicSky) {
    drawClassicSky(model);
    return;
  }
  if (!model.classicReady) {
    classicBuffers(model);
  }
  // see-through models but cars (shadows, dust, trees, fences, fire) are shaped by their
  // texture's transparency, so they keep it whole and get no outlines
  const flat = !model.alpha || model.iscar;
  const lighting = lightingOf(model);
  const { program, attribLocations, uniformLocations } =
    lighting == LIT || lighting == OWN_SHADE
      ? classicPrograms.shaded
      : classicPrograms.bright;
  placeModel(model);
  bindAttribute(attribLocations.vertexPosition, model.vbuf, 3);
  bindAttribute(
    attribLocations.textureCoord,
    (flat && model.middlesBuffer) || model.tbuf,
    2,
  );
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.ibuf);
  gl.useProgram(program);
  gl.uniformMatrix4fv(
    uniformLocations.projectionMatrix,
    false,
    drawCamera.projection,
  );
  gl.uniformMatrix4fv(uniformLocations.modelViewMatrix, false, drawMatrix);
  bindModelTexture(model, uniformLocations.uSampler);
  // the faces a little behind their outlines
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1, 1);
  gl.drawElements(gl.TRIANGLES, model.ni, gl.UNSIGNED_SHORT, 0);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  if (flat && model.outlineCount && !model.noOutline) {
    const outline = classicPrograms.outline;
    gl.disableVertexAttribArray(attribLocations.textureCoord);
    bindAttribute(outline.attribLocations.vertexPosition, model.vbuf, 3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.outlineBuffer);
    gl.useProgram(outline.program);
    gl.uniformMatrix4fv(
      outline.uniformLocations.projectionMatrix,
      false,
      drawCamera.projection,
    );
    gl.uniformMatrix4fv(
      outline.uniformLocations.modelViewMatrix,
      false,
      drawMatrix,
    );
    gl.drawElements(gl.LINES, model.outlineCount, gl.UNSIGNED_SHORT, 0);
  }
};

// model.alpha: how a model blends in (0 not at all). The glows (the blend colour stays
// black, so the source counts fully) light up burning and electrified cars.
export const BLEND = { alpha: 1, glow: 2, brightGlow: 3 };

const BLENDING = {
  [BLEND.alpha]: () => gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA),
  [BLEND.glow]: () => gl.blendFunc(gl.ONE_MINUS_CONSTANT_COLOR, gl.DST_COLOR),
  [BLEND.brightGlow]: () =>
    gl.blendFunc(gl.ONE_MINUS_CONSTANT_COLOR, gl.DST_ALPHA),
};

const lightingOf = (model) => {
  if (model.ownlight) {
    return model.ownshade ? FULL_BRIGHT : OWN_LIGHT;
  }
  return model.ownshade ? OWN_SHADE : LIT;
};

const bindAttribute = (location, buffer, size) => {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(location);
};

// Draws a textured model (loaded with loadrad3D) at its x, y, z and mat.
// Car damage: the simulation dents a car model's vertices (model.dvert) and scratches and
// burns a copy of its damage texture (texture[1]). Reading that texture back and uploading
// both after every hit stalled the GPU when many cars collided, so the copy is kept here
// and the changes go up once, when the model is drawn.
export const keepDamageTexture = (model, pixels) => {
  model.damagePixels = pixels;
  model.damagedPixels = false;
};

const uploadDamage = (model) => {
  if (model.damagedVertices) {
    gl.bindBuffer(gl.ARRAY_BUFFER, model.vbuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(model.dvert),
      gl.DYNAMIC_DRAW,
    );
    model.damagedVertices = false;
  }
  if (model.damagedPixels) {
    gl.bindTexture(gl.TEXTURE_2D, model.texture[1]);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      256,
      256,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      model.damagePixels,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
    model.damagedPixels = false;
  }
};

export const drawModel = (model) => {
  if (!model.loaded) {
    return;
  }
  uploadDamage(model);
  if (model.alpha) {
    gl.enable(gl.BLEND);
    BLENDING[model.alpha]?.();
  }
  if (look.current == LOOK.classic) {
    drawClassicModel(model);
    if (model.alpha) {
      gl.disable(gl.BLEND);
    }
    return;
  }
  const lighting = lightingOf(model);
  const { program, attribLocations, uniformLocations } = programs[lighting];
  placeModel(model);
  let normalMatrix = null;
  if (lighting == LIT) {
    normalMatrix = mat4.create();
    mat4.invert(normalMatrix, drawMatrix);
    mat4.transpose(normalMatrix, normalMatrix);
  }
  bindAttribute(attribLocations.vertexPosition, model.vbuf, 3);
  if (lighting == LIT) {
    bindAttribute(attribLocations.vertexNormal, model.nbuf, 3);
  }
  bindAttribute(attribLocations.textureCoord, model.tbuf, 2);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.ibuf);
  gl.useProgram(program);
  gl.uniformMatrix4fv(
    uniformLocations.projectionMatrix,
    false,
    drawCamera.projection,
  );
  gl.uniformMatrix4fv(uniformLocations.modelViewMatrix, false, drawMatrix);
  if (lighting == LIT) {
    gl.uniformMatrix4fv(uniformLocations.normalMatrix, false, normalMatrix);
  }
  bindModelTexture(model, uniformLocations.uSampler);
  gl.drawElements(gl.TRIANGLES, model.ni, gl.UNSIGNED_SHORT, 0);
  if (model.alpha) {
    gl.disable(gl.BLEND);
  }
};

// Draws a vertex-coloured particle model (loaded with loadparticle) at its x, y, z and mat.
export const drawParticle = (particle) => {
  if (!particle.loaded) {
    return;
  }
  if (particle.alpha) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  const { program, attribLocations, uniformLocations } = programs[COLORED];
  placeModel(particle);
  bindAttribute(attribLocations.vertexPosition, particle.vbuf, 3);
  bindAttribute(attribLocations.vertexColor, particle.cbuf, 4);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, particle.ibuf);
  gl.useProgram(program);
  gl.uniformMatrix4fv(
    uniformLocations.projectionMatrix,
    false,
    drawCamera.projection,
  );
  gl.uniformMatrix4fv(uniformLocations.modelViewMatrix, false, drawMatrix);
  gl.drawElements(gl.TRIANGLES, particle.ni, gl.UNSIGNED_SHORT, 0);
  if (particle.alpha) {
    gl.disable(gl.BLEND);
  }
};
