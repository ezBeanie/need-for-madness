import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const ORIGIN = "https://nfm.example";
const source = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);

// The service worker in a stand-in of its global scope: `online` says whether the network
// answers; what it keeps lands in `kept`, by URL.
const installWorker = () => {
  const handlers = {};
  const kept = new Map();
  const world = { online: true, fetched: [] };
  const cache = {
    put: async (request, response) => kept.set(request.url, response),
  };
  const caches = {
    open: async () => cache,
    match: async (request, { ignoreSearch }) => {
      const url = new URL(request.url);
      for (const [keptUrl, response] of kept) {
        const other = new URL(keptUrl);
        if (
          other.pathname == url.pathname &&
          (ignoreSearch || other.search == url.search)
        ) {
          return response.clone();
        }
      }
      return undefined;
    },
  };
  const fetch = async (request) => {
    world.fetched.push(request.url);
    if (!world.online) {
      throw new TypeError("offline");
    }
    return new Response(`from the network: ${new URL(request.url).pathname}`);
  };
  const self = {
    location: new URL(`${ORIGIN}/`),
    addEventListener: (type, handler) => (handlers[type] = handler),
    skipWaiting: () => {},
    clients: { claim: async () => {} },
  };
  new Function("self", "caches", "fetch", source)(self, caches, fetch);

  // the answer to a request, or null if the worker leaves it to the browser
  world.ask = async (url, init = {}, mode = "no-cors") => {
    const request = new Request(new URL(url, ORIGIN), init);
    Object.defineProperty(request, "mode", { value: mode });
    let answer = null;
    const waits = [];
    handlers.fetch({
      request,
      respondWith: (promise) => (answer = promise),
      waitUntil: (promise) => waits.push(promise),
    });
    const response = await answer;
    await Promise.all(waits);
    return response && (response.type == "error" ? "error" : response.text());
  };
  return world;
};

test("online, the game's files come from the network and are kept", async () => {
  const worker = installWorker();
  expect(await worker.ask("/data/3D/car0.r3d")).toBe(
    "from the network: /data/3D/car0.r3d",
  );
  worker.online = false;
  expect(await worker.ask("/data/3D/car0.r3d")).toBe(
    "from the network: /data/3D/car0.r3d",
  );
  // (never loaded, so not there offline)
  expect(await worker.ask("/data/3D/car1.r3d")).toBe("error");
});

test("offline, a join link opens the page kept from before", async () => {
  const worker = installWorker();
  await worker.ask("/", {}, "navigate");
  worker.online = false;
  expect(await worker.ask("/?join=abcde", {}, "navigate")).toBe(
    "from the network: /",
  );
});

test("music ranges, other servers and other methods are left to the browser", async () => {
  const worker = installWorker();
  expect(
    await worker.ask("/data/music/stage1.mp3", {
      headers: { range: "bytes=0-" },
    }),
  ).toBe(null);
  expect(await worker.ask("https://cdn.example/x.js")).toBe(null);
  expect(await worker.ask("/net", { method: "POST" })).toBe(null);
  expect(worker.fetched).toEqual([]);
});
