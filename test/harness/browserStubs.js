// Minimal browser surface so needmad.js runs headless in a vm context.
// Rendering, audio and pixel readback are no-ops: the tests cover the simulation, not the picture.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const noop = () => {};

const fileCache = new Map();
const readProjectFile = (root, url) => {
  const path = join(root, url.split("?")[0]);
  if (!fileCache.has(path)) {
    fileCache.set(path, readFileSync(path));
  }
  return fileCache.get(path);
};

// Callbacks the browser would run asynchronously (XHR, image and audio loads).
export const createTaskQueue = () => {
  const tasks = [];
  return {
    push: (fn) => tasks.push(fn),
    flush: () => {
      while (tasks.length > 0) {
        tasks.shift()();
      }
    },
  };
};

// A plain object with every gl.* name the game uses; a Proxy would cost a trap per access.
const createWebGLStub = (glNames) => {
  const handle = () => ({});
  const gl = {};
  for (const name of glNames) {
    if (/^[A-Z0-9_]+$/.test(name)) {
      gl[name] = 0x1000 + Object.keys(gl).length;
    } else {
      gl[name] = name.startsWith("create") ? handle : noop;
    }
  }
  return Object.assign(gl, {
    getExtension: () => null,
    getParameter: () => 0,
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getShaderInfoLog: () => "",
    getProgramInfoLog: () => "",
    getAttribLocation: () => 0,
    getUniformLocation: handle,
    checkFramebufferStatus: () => gl.FRAMEBUFFER_COMPLETE,
  });
};

const create2dContextStub = () => {
  const methods = {
    measureText: (text) => ({ width: String(text).length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  };
  const state = {};
  return new Proxy(state, {
    get: (target, prop) => {
      if (prop in methods) {
        return methods[prop];
      }
      return prop in target ? target[prop] : noop;
    },
    set: (target, prop, value) => {
      target[prop] = value;
      return true;
    },
  });
};

const createCanvasStub = (context) => ({
  width: 1280,
  height: 720,
  style: {},
  getContext: () => context,
  addEventListener: noop,
  toDataURL: () => "",
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
});

const createAudioContextClass = (queue) =>
  class AudioContext {
    destination = {};
    createGain() {
      return { gain: { value: 1 }, connect: noop };
    }
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        playbackRate: { value: 1 },
        connect: noop,
        start: noop,
        stop: noop,
      };
    }
    decodeAudioData(data, onSuccess) {
      queue.push(() => onSuccess({}));
    }
  };

const createXhrClass = (root, queue) =>
  class XMLHttpRequest {
    readyState = 0;
    status = 0;
    responseType = "";
    open(method, url) {
      this.url = url;
    }
    send() {
      queue.push(() => {
        const data = readProjectFile(root, this.url);
        if (this.responseType === "arraybuffer") {
          this.response = data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
          );
        } else {
          this.responseText = data.toString("utf8");
          this.response = this.responseText;
        }
        this.readyState = 4;
        this.status = 200;
        this.onreadystatechange?.();
        this.onload?.();
      });
    }
  };

const createImageClass = (queue) =>
  class Image {
    width = 64;
    height = 64;
    #src = "";
    get src() {
      return this.#src;
    }
    set src(value) {
      this.#src = value;
      queue.push(() => this.onload?.());
    }
  };

class Audio {
  volume = 1;
  loop = false;
  paused = true;
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

export const createBrowserGlobals = ({ root, queue, glNames }) => {
  const gl = createWebGLStub(glNames);
  const ctx2d = create2dContextStub();
  const canvas3D = createCanvasStub(gl);
  const canvas2D = createCanvasStub(ctx2d);
  const canvases = { "#canvas3D": canvas3D, "#canvas2D": canvas2D };
  const element = () => ({ style: {}, addEventListener: noop });

  return {
    navigator: { userAgent: "node-harness", getGamepads: () => [] },
    screen: { width: 1280, height: 720 },
    innerWidth: 1280,
    innerHeight: 720,
    document: {
      documentElement: {},
      body: {},
      visibilityState: "visible",
      querySelector: (selector) => canvases[selector] ?? element(),
      getElementById: element,
      createElement: () => createCanvasStub(create2dContextStub()),
      addEventListener: noop,
    },
    addEventListener: noop,
    requestAnimationFrame: noop,
    Image: createImageClass(queue),
    Audio,
    AudioContext: createAudioContextClass(queue),
    XMLHttpRequest: createXhrClass(root, queue),
  };
};
