// WebGL: the 3D canvas, the shader programs and drawing models and particles.

import { drawCamera, drawMatrix, placeModel } from "./interpolation.js";

export const canvas3D = document.querySelector("#canvas3D");
export const gl =
  canvas3D.getContext("webgl") || canvas3D.getContext("experimental-webgl");

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

const BLENDING = {
  1: () => gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA),
  2: () => gl.blendFunc(gl.ONE_MINUS_CONSTANT_COLOR, gl.DST_COLOR),
  3: () => gl.blendFunc(gl.ONE_MINUS_CONSTANT_COLOR, gl.DST_ALPHA),
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
export const drawModel = (model) => {
  if (!model.loaded) {
    return;
  }
  if (model.alpha) {
    gl.enable(gl.BLEND);
    BLENDING[model.alpha]?.();
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
  gl.activeTexture(gl.TEXTURE0);
  if (model.tgn) {
    gl.bindTexture(gl.TEXTURE_2D, textureGroups[model.tgn - 1].texture);
  } else {
    gl.bindTexture(
      gl.TEXTURE_2D,
      model.nt == 1 ? model.texture : model.texture[model.ont],
    );
  }
  gl.uniform1i(uniformLocations.uSampler, 0);
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
