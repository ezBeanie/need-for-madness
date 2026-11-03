// Drawing apart from the screen, for small pictures (the lobby's cars, the stage editor's
// piece): a framebuffer of its own, the camera at the middle looking ahead (along -z),
// tilted down; each picture drawn is read back and copied into 2D canvases.

import { drawCamera } from "./interpolation.js";
import { gl } from "./renderer.js";

export const newOffscreen = (width, height) => {
  let framebuffer = null;
  let pixels = null;
  let flipped = null;
  let copy = null;
  // the screen's camera, while the pictures are drawn
  const kept = { x: 0, y: 0, z: 0, projection: mat4.create() };

  const make = () => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
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
      width,
      height,
    );
    framebuffer = gl.createFramebuffer();
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
    pixels = new Uint8Array(width * height * 4);
    flipped = new ImageData(width, height);
    copy = document.createElement("canvas");
    copy.width = width;
    copy.height = height;
  };

  return {
    // The pictures start: the camera with this field of view, tilted down by pitch
    // (degrees), seeing as far as far.
    start(fieldOfView, pitch, far = 1000) {
      if (!framebuffer) {
        make();
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, width, height);
      Object.assign(kept, drawCamera, { projection: kept.projection });
      mat4.copy(kept.projection, drawCamera.projection);
      drawCamera.x = 0;
      drawCamera.y = 0;
      drawCamera.z = 0;
      const p = drawCamera.projection;
      mat4.perspective(
        p,
        (fieldOfView * Math.PI) / 180,
        width / height,
        0.1,
        far,
      );
      mat4.rotate(p, p, (pitch * Math.PI) / 180, [1, 0, 0]);
    },
    // A picture starts, empty.
    clear() {
      // (the classic look's batch turns the depth test off when done)
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    // The picture drawn, into each canvas. (WebGL reads from the bottom row up.)
    copyTo(canvases) {
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const row = width * 4;
      for (let y = 0; y < height; y++) {
        flipped.data.set(
          pixels.subarray((height - 1 - y) * row, (height - y) * row),
          y * row,
        );
      }
      copy.getContext("2d").putImageData(flipped, 0, 0);
      for (const canvas of canvases) {
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(copy, 0, 0);
      }
    },
    // The screen's camera and canvas back.
    end() {
      gl.disable(gl.DEPTH_TEST);
      drawCamera.x = kept.x;
      drawCamera.y = kept.y;
      drawCamera.z = kept.z;
      mat4.copy(drawCamera.projection, kept.projection);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    },
  };
};
