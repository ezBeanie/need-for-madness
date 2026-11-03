// The service worker of the installed game: every file the game loads comes from the
// network as before and is kept, so the game starts without the network too, with the
// stages and cars it loaded once. Network first, so a new deploy is always what is played
// (the data files are not hashed, and the browser's own cache keeps the game as fast).

const CACHE = "nfm";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

// (a page opened with ?join=<room> is the same page)
const kept = async (request) =>
  (await caches.match(request, { ignoreSearch: request.mode == "navigate" })) ??
  Response.error();

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // (music streams in ranges, which the cache cannot answer; other servers' files and the
  // relay are none of its business)
  const url = new URL(request.url);
  if (
    request.method != "GET" ||
    request.headers.has("range") ||
    url.origin != self.location.origin ||
    url.pathname.startsWith("/net/")
  ) {
    return;
  }
  event.respondWith(
    fetch(request).then(
      (response) => {
        if (response.status == 200) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE).then((cache) => cache.put(request, copy)),
          );
        }
        return response;
      },
      () => kept(request),
    ),
  );
});
