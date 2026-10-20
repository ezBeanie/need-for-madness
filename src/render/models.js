// Loading 3D models (.r3d, textured) and particle models (.prt, vertex-coloured) into
// GPU buffers. A model's loaded counter grows as its file and each texture arrive.

import { interfaceResolution } from "../core/platform.js";
import { parseModel } from "../data/modelFormat.js";
import { readFloat, readInt } from "../data/values.js";
import { BLEND, gl, isPowerOf2 } from "./renderer.js";

export const newModel = () => ({
  loaded: 0,
  x: 0,
  y: 0,
  z: 0,
  mat: null,
  ont: 0,
  ni: 0,
  nt: 0,
  tgn: 0,
  alpha: 0,
  ownlight: false,
  ownshade: false,
});

export const newParticleModel = () => ({
  loaded: 0,
  x: 0,
  y: 0,
  z: 0,
  mat: null,
  ni: 0,
  alpha: false,
  copyonly: false,
});

const fetchText = (file, onText) => {
  const request = new XMLHttpRequest();
  request.open("GET", file, true);
  request.onreadystatechange = () => {
    if (
      request.readyState === 4 &&
      (request.status === 200 || request.status == 0)
    ) {
      onText(request.responseText);
    }
  };
  request.send(null);
};

const uploadBuffer = (target, data) => {
  const buffer = gl.createBuffer();
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return buffer;
};

const loadTexture = (file, onLoaded) => {
  const image = new Image();
  image.onload = () => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    onLoaded(texture);
  };
  image.src = file;
};

// What the directives of a .r3d file set on the model; returns how to build the geometry.
const applyModelDirectives = (model, directives) => {
  const build = { flipX: -1, scale: 1, scaleX: 1, textureFiles: [] };
  for (const { command, value } of directives) {
    if (command == "flipX") {
      build.flipX = 1;
    }
    if (command == "scale") {
      build.scale = readFloat(value);
    }
    if (command == "Xscale") {
      build.scaleX = readFloat(value);
    }
    if (command == "enableAlpha") {
      model.alpha = BLEND.alpha;
    }
    if (command == "ownLight") {
      model.ownlight = true;
    }
    if (command == "ownShade") {
      model.ownshade = true;
    }
    if (command == "car") {
      model.iscar = 1;
      model.alpha = BLEND.alpha;
    }
    if (command == "skid") {
      model.skid = readInt(value);
      model.sx = 0;
      model.bx = 0;
      model.sz = 0;
      model.bz = 0;
    }
    if (command == "intershad" || command == "interact") {
      model[command] = true;
      if (model.dam == null) {
        model.dam = 1;
      }
      model.bndmax = 20;
      model.walarc = 0.67;
    }
    if (command == "dam") {
      model.dam = 3;
    }
    if (command == "bndmax") {
      model.bndmax = readFloat(value);
    }
    if (command == "walarc") {
      model.walarc = readFloat(value);
    }
    if (command == "copyonly") {
      model.copyonly = true;
    }
    if (command == "texture") {
      build.textureFiles.push(`data/3D/textures/${value.split(",")[0]}`);
    }
    if (command == "intertexture") {
      build.textureFiles.push(
        `data/interface${interfaceResolution}/${value.split(",")[0]}`,
      );
    }
    if (command == "grouptexture") {
      model.tgn = readInt(value) + 1;
    }
  }
  model.nt += build.textureFiles.length;
  return build;
};

// One vertex per triangle corner; also measures the model (bounds, collision radius).
const buildGeometry = (
  model,
  vertices,
  normals,
  texcoords,
  triangles,
  flipX,
) => {
  const positions = [];
  const vertexNormals = [];
  const uvs = [];
  model.ni = triangles.length / 3;
  model.bx = 0;
  model.by = 0;
  model.bz = 0;
  for (let i = 0; i < model.ni; i++) {
    const x = vertices[triangles[i * 3] * 3] * flipX;
    const y = vertices[triangles[i * 3] * 3 + 1];
    const z = vertices[triangles[i * 3] * 3 + 2];
    positions.push(x, y, z);
    const radius = Math.sqrt(x * x + y * y + z * z);
    if (radius > model.colrad) {
      model.colrad = radius;
    }
    if (Math.abs(x) > model.bx) {
      model.bx = Math.abs(x);
    }
    if (Math.abs(y) > model.by) {
      model.by = Math.abs(y);
    }
    if (Math.abs(z) > model.bz) {
      model.bz = Math.abs(z);
    }
    // skid marks: the extent of the ground plane (bx/bz now hold signed maximums)
    if (model.skid != -1) {
      if (model.sx == 0 || x < model.sx) {
        model.sx = x;
      }
      if (model.bx == 0 || x > model.bx) {
        model.bx = x;
      }
      if (model.sz == 0 || z < model.sz) {
        model.sz = z;
      }
      if (model.bz == 0 || z > model.bz) {
        model.bz = z;
      }
    }
    if (!model.ownlight && !model.ownshade) {
      const normal = triangles[i * 3 + 1] * 3;
      vertexNormals[i * 3] = normals[normal];
      vertexNormals[i * 3 + 1] = normals[normal + 1];
      vertexNormals[i * 3 + 2] = normals[normal + 2];
    }
    const uv = triangles[i * 3 + 2] * 2;
    uvs.push(texcoords[uv], 1 - texcoords[uv + 1]);
  }
  model.vbuf = uploadBuffer(gl.ARRAY_BUFFER, new Float32Array(positions));
  if (!model.ownlight && !model.ownshade) {
    model.nbuf = uploadBuffer(gl.ARRAY_BUFFER, new Float32Array(vertexNormals));
  }
  model.tbuf = uploadBuffer(gl.ARRAY_BUFFER, new Float32Array(uvs));
  model.ibuf = uploadBuffer(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(Array.from({ length: model.ni }, (_, i) => i)),
  );
};

// Textures count into model.loaded as they arrive. One texture is model.texture itself,
// several (up to six) are model.texture[n], picked by model.ont.
const loadTextures = (model, files) => {
  if (model.tgn || files.length == 0) {
    model.loaded++;
    return;
  }
  if (model.nt == 1) {
    loadTexture(files[0], (texture) => {
      model.texture = texture;
      model.loaded++;
    });
    return;
  }
  model.texture = [];
  files.slice(0, 6).forEach((file, n) => {
    loadTexture(file, (texture) => {
      model.texture[n] = texture;
      model.loaded++;
    });
  });
};

export const loadModel = (file, model) => {
  model.loaded = 0;
  fetchText(file, (source) => {
    const parsed = parseModel(source);
    Object.assign(model, {
      colrad: 0,
      iscar: 0,
      intershad: false,
      interact: false,
      copyonly: false,
      skid: -1,
    });
    const build = applyModelDirectives(model, parsed.directives);
    const { normals, texcoords, triangles } = parsed;
    const vertices = parsed.vertices;
    // collision, shadows and car damage need the raw geometry
    if (model.copyonly || model.intershad || model.interact || model.iscar) {
      model.vrt = vertices;
      model.tri = triangles;
    }
    if (model.copyonly || model.intershad || model.interact) {
      model.nrm = normals;
    }
    if (model.copyonly || model.iscar) {
      model.tex = texcoords;
    }
    if (model.copyonly) {
      model.loaded = 1;
      return;
    }
    if (model.nt == 0) {
      model.nt = 1;
    }
    if (build.scale != 1) {
      for (let i = 0; i < vertices.length; i++) {
        vertices[i] *= build.scale;
      }
    }
    if (build.scaleX != 1) {
      for (let i = 0; i < vertices.length; i += 3) {
        vertices[i] *= build.scaleX;
      }
      model.vrt = vertices;
    }
    buildGeometry(model, vertices, normals, texcoords, triangles, build.flipX);
    model.loaded = 1;
    model.mat = mat4.create();
    loadTextures(model, build.textureFiles);
  });
};

// Colour gradients of particle models: a colour pair (rgba, rgba) split at mid along x, y
// or z, or the time tube with its own pattern.
const GRADIENTS = { xgrade: 0, ygrade: 1, zgrade: 2, timetube: 3 };

// The time tube: rings along z fading in, coloured by whether a vertex is on the edge.
// Also sets the alphas of both colours by the ring (z) the vertex is on.
const timeTubeShift = (vertices, i, scale, colors) => {
  const x = vertices[i * 3];
  const y = vertices[i * 3 + 1];
  const z = vertices[i * 3 + 2];
  const onEdge = Math.abs(x) == 0.4 * scale || Math.abs(y) == 0.4 * scale;
  const atEnd = z == 1.05 * scale || z == -(0.35 * scale);
  if (z == -1.05 * scale) {
    colors[3] = 10;
    colors[7] = 15;
  }
  if (z == -0.35 * scale) {
    colors[3] = 40;
    colors[7] = 60;
  }
  if (z == 0.35 * scale) {
    colors[3] = 70;
    colors[7] = 105;
  }
  if (z == 1.05 * scale) {
    colors[3] = 100;
    colors[7] = 150;
  }
  return atEnd == onEdge ? 4 : 0;
};

export const loadParticleModel = (file, particle) => {
  particle.loaded = 0;
  fetchText(file, (source) => {
    const { directives, vertices, triangles } = parseModel(source);
    let copyVertices = false;
    let gradient = 0;
    const colors = [255, 255, 0, 255, 255, 0, 0, 255];
    let scale = 1;
    const mid = [0, 0, 0];
    for (const { command, value } of directives) {
      if (command == "scale") {
        scale = readFloat(value);
      }
      if (command == "copyonly") {
        particle.copyonly = true;
      }
      if (command == "copyvert") {
        copyVertices = true;
      }
      if (command == "midx" || command == "midy" || command == "midz") {
        mid["xyz".indexOf(command[3])] = readFloat(value) * scale;
      }
      if (command == "enableAlpha") {
        particle.alpha = true;
      }
      if (command in GRADIENTS) {
        gradient = GRADIENTS[command];
        const parts = value.split(",");
        for (let k = 0; k < 8; k++) {
          colors[k] = readInt(parts[k] ?? "");
        }
      }
    }
    if (particle.copyonly || copyVertices) {
      particle.vert = vertices;
    }
    if (particle.copyonly) {
      particle.indice = triangles;
    }
    if (!particle.copyonly) {
      particle.ni = triangles.length;
      if (scale != 1) {
        for (let i = 0; i < vertices.length; i++) {
          vertices[i] *= scale;
        }
      }
      particle.vbuf = uploadBuffer(gl.ARRAY_BUFFER, new Float32Array(vertices));
      const vertexColors = [];
      for (let i = 0; i < vertices.length / 3; i++) {
        let shift = 0;
        if (gradient <= 2 && vertices[i * 3 + gradient] < mid[gradient]) {
          shift = 4;
        }
        if (gradient == 3) {
          shift = timeTubeShift(vertices, i, scale, colors);
        }
        for (let k = 0; k < 4; k++) {
          vertexColors.push(colors[shift + k] / 255);
        }
      }
      particle.cbuf = uploadBuffer(
        gl.ARRAY_BUFFER,
        new Float32Array(vertexColors),
      );
      particle.ibuf = uploadBuffer(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(triangles),
      );
      particle.mat = mat4.create();
    }
    particle.loaded = 1;
  });
};
