import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const ORIGIN = "https://nfm.example";
const source = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);

// The service worker in a stand-in of its global scope, for what it leaves to the browser;
// what it does with the game's files test/visual/offline.spec.js tries in a real one.
const installWorker = () => {
  const handlers = {};
  const world = { fetched: [] };
  const fetch = async (request) => {
    world.fetched.push(String(request.url ?? request));
    return new Response("from the network");
  };
  const self = {
    registration: { scope: `${ORIGIN}/` },
    addEventListener: (type, handler) => (handlers[type] = handler),
    skipWaiting: () => {},
    clients: { claim: async () => {}, matchAll: async () => [] },
  };
  new Function("self", "caches", "fetch", source)(self, {}, fetch);

  // whether the worker answers the request itself
  world.answers = (url, init = {}) => {
    const request = new Request(new URL(url, ORIGIN), init);
    let answered = false;
    handlers.fetch({
      request,
      clientId: "",
      respondWith: (answer) => {
        answered = true;
        // (no caches in the stand-in)
        answer.catch(() => {});
      },
      waitUntil: () => {},
    });
    return answered;
  };
  return world;
};

test("music ranges, other servers, other methods, the relay and the list are left to the browser", () => {
  const worker = installWorker();
  expect(
    worker.answers("/data/music/stage1.mp3", {
      headers: { range: "bytes=0-" },
    }),
  ).toBe(false);
  expect(worker.answers("https://cdn.example/x.js")).toBe(false);
  expect(worker.answers("/net", { method: "POST" })).toBe(false);
  expect(worker.answers("/net/ice")).toBe(false);
  expect(worker.answers("/offline.json")).toBe(false);
  expect(worker.fetched).toEqual([]);
  // (the counter-check: a file of the game it answers)
  expect(worker.answers("/data/stages/1.txt")).toBe(true);
});
