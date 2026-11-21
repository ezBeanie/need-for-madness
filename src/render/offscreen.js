// Drawing apart from the screen, for small pictures (the lobby's cars, the stage editor's
// piece): a framebuffer of its own, the camera at the middle looking ahead (along -z),
// tilted down. It holds up to `tiles` pictures side by side, all read back at once (reading
// back waits for the GPU, so once a frame, not once a picture) and copied into 2D canvases.

import { drawCamera } from "./interpolation.js";
import { gl } from "./renderer.js";

export const newOffscreen = (width, height, tiles = 1) => {
  const columns = Math.min(tiles, 5);
  const rows = Math.ceil(tiles / columns);
  const atlasWidth = columns * width;
  const atlasHeight = rows * height;
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
      atlasWidth,
      atlasHeight,
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
      atlasWidth,
      atlasHeight,
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
    pixels = new Uint8Array(atlasWidth * atlasHeight * 4);
    flipped = new ImageData(atlasWidth, atlasHeight);
    copy = document.createElement("canvas");
    copy.width = atlasWidth;
    copy.height = atlasHeight;
  };

  // where tile i is: in WebGL from the bottom, in the copy (read back) from the top
  const tileX = (i) => (i % columns) * width;
  const tileRow = (i) => Math.floor(i / columns);

  return {
    // The pictures start: the camera with this field of view, tilted down by pitch
    // (degrees), seeing as far as far.
    start(fieldOfView, pitch, far = 1000) {
      if (!framebuffer) {
        make();
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
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
    // Picture i starts, empty.
    clear(i = 0) {
      const x = tileX(i);
      const y = tileRow(i) * height;
      gl.viewport(x, y, width, height);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(x, y, width, height);
      // (the classic look's batch turns the depth test off when done)
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.SCISSOR_TEST);
    },
    // The first `count` pictures drawn, read back. (WebGL reads from the bottom row up.)
    read(count = 1) {
      const shown = tileRow(count - 1) + 1;
      const readHeight = shown * height;
      gl.readPixels(
        0,
        0,
        atlasWidth,
        readHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      const row = atlasWidth * 4;
      for (let y = 0; y < readHeight; y++) {
        flipped.data.set(
          pixels.subarray((readHeight - 1 - y) * row, (readHeight - y) * row),
          y * row,
        );
      }
      copy
        .getContext("2d")
        .putImageData(flipped, 0, 0, 0, 0, atlasWidth, readHeight);
      copy.shown = shown;
    },
    // Picture i, read back, into each canvas.
    copyTile(i, canvases) {
      const y = (copy.shown - 1 - tileRow(i)) * height;
      for (const canvas of canvases) {
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(
          copy,
          tileX(i),
          y,
          width,
          height,
          0,
          0,
          width,
          height,
        );
      }
    },
    // The one picture drawn, into each canvas.
    copyTo(canvases) {
      this.read(1);
      this.copyTile(0, canvases);
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
