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
// A WebGL constant's value: the same for a name wherever and in whichever order the game
// uses it (FNV-1a hash), so the recorded WebGL calls do not change when code moves.
const constantFor = (name) => {
  let hash = 0x811c9dc5;
  for (const char of name) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  }
  return 0x10000 + hash;
};

const createWebGLStub = (glNames) => {
  const handle = () => ({});
  const gl = {};
  for (const name of glNames) {
    if (/^[A-Z0-9_]+$/.test(name)) {
      gl[name] = constantFor(name);
    } else {
      gl[name] = name.startsWith("create") ? handle : noop;
    }
  }
  // Textures keep the pixels uploaded to them and read back what a framebuffer shows, like
  // a GPU does: the car damage scratches the texture it reads back. Images carry no pixels
  // here, so textures made from them read back as zeros.
  let texture = null;
  let framebuffer = null;
  Object.assign(gl, {
    bindTexture: (target, t) => {
      // a browser refuses this (INVALID_OPERATION) and draws with whatever is bound
      if (t?.deleted) {
        throw new Error("bound a deleted texture");
      }
      texture = t;
    },
    deleteTexture: (t) => {
      if (t) {
        t.deleted = true;
      }
    },
    texImage2D: (...args) => {
      if (texture) {
        const data = args.length === 9 ? args[8] : null;
        texture.pixels = ArrayBuffer.isView(data)
          ? Uint8Array.from(data)
          : null;
        // what the texture shows, for the WebGL recorder
        texture.label = ArrayBuffer.isView(data)
          ? `pixels ${args[3]}x${args[4]}`
          : (args[5]?.src ?? `${args[3]}x${args[4]}`);
      }
    },
    bindFramebuffer: (target, f) => {
      framebuffer = f;
    },
    framebufferTexture2D: (target, attachment, textarget, t) => {
      if (framebuffer) {
        framebuffer.texture = t;
      }
    },
    readPixels: (x, y, width, height, format, type, out) => {
      const pixels = framebuffer?.texture?.pixels;
      if (pixels) {
        out.set(pixels.subarray(0, width * height * 4));
      }
    },
    getExtension: () => null,
    getParameter: () => 0,
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getShaderInfoLog: () => "",
    getProgramInfoLog: () => "",
    getAttribLocation: () => 0,
    getUniformLocation: (program, name) => ({ uniform: name }),
    checkFramebufferStatus: () => gl.FRAMEBUFFER_COMPLETE,
  });
  for (const [name, fn] of Object.entries(gl)) {
    if (typeof fn === "function") {
      gl[name] = (...args) => {
        glCalls.listener?.(name, args);
        return fn(...args);
      };
    }
  }
  return gl;
};

// Set listener to hear every WebGL call: listener(name, args) (see canvasRecorder.js).
export const glCalls = { listener: null };

// Set listener to hear every call on a 2D canvas: listener(name, args, call) returns what
// the call returns (see canvasRecorder.js).
export const canvasCalls = { listener: null };

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
      const value =
        prop in methods ? methods[prop] : prop in target ? target[prop] : noop;
      if (canvasCalls.listener && typeof value === "function") {
        return (...args) =>
          canvasCalls.listener(prop, args, () => value(...args), target);
      }
      return value;
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
  after: noop,
  toDataURL: () => "",
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
});

// (audio nodes connect as a chain: each connect gives back the node connected to)
const chain = (node) => node;

const createAudioContextClass = (queue) =>
  class AudioContext {
    destination = {};
    currentTime = 0;
    resume() {
      return Promise.resolve();
    }
    suspend() {
      return Promise.resolve();
    }
    createGain() {
      return { gain: { value: 1 }, connect: chain, disconnect: noop };
    }
    createPanner() {
      return {
        positionX: { value: 0 },
        positionZ: { value: 0 },
        connect: chain,
        disconnect: noop,
      };
    }
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        playbackRate: { value: 1 },
        connect: chain,
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

export const createBrowserGlobals = ({
  root,
  queue,
  glNames,
  userAgent = "node-harness",
}) => {
  const gl = createWebGLStub(glNames);
  const ctx2d = create2dContextStub();
  const canvas3D = createCanvasStub(gl);
  const canvas2D = createCanvasStub(ctx2d);
  const canvases = { "#canvas3D": canvas3D, "#canvas2D": canvas2D };
  // one per id, whose click() calls its click listeners (the main menu's buttons)
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      const clicks = [];
      elements.set(id, {
        style: {},
        // (the name tags' layer takes its tags)
        append: noop,
        addEventListener: (type, listener) => {
          if (type == "click") {
            clicks.push(listener);
          }
        },
        click() {
          for (const listener of clicks) {
            listener({ currentTarget: this, target: this });
          }
        },
      });
    }
    return elements.get(id);
  };

  return {
    navigator: { userAgent, getGamepads: () => [] },
    screen: { width: 1280, height: 720 },
    innerWidth: 1280,
    innerHeight: 720,
    document: {
      documentElement: {},
      body: {},
      visibilityState: "visible",
      querySelector: (selector) => canvases[selector] ?? element(selector),
      getElementById: element,
      // (a canvas, or an element with children: the name tags' parts)
      createElement: () => {
        const children = [];
        return {
          ...createCanvasStub(create2dContextStub()),
          children,
          dataset: {},
          style: { setProperty: noop },
          classList: { toggle: noop, add: noop, remove: noop },
          textContent: "",
          offsetWidth: 0,
          offsetHeight: 0,
          append: (...added) => children.push(...added),
          get firstChild() {
            return children[0] ?? null;
          },
          get lastChild() {
            return children.at(-1) ?? null;
          },
        };
      },
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
