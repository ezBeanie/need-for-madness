// The service worker of the installed game. Every start asks the server for the newest
// version and plays it; without the network, or with the server too slow to answer, the
// version last installed whole starts instead.
//
// The build lists every file with a hash of its content (offline.json, see
// tools/offline/list.js). A version is installed once all its files but the music are kept;
// the music is kept as it is played. Each page plays one version from its start to its end:
// the files it asks for are the ones its list names, never another version's, each checked
// against its hash before it is kept. Whatever an update leaves half done, the version
// installed before stays whole until the new one is.

// the files by path and hash; the lists, the installed version and which one each page plays
const FILES = "nfm-files";
const META = "nfm-meta";
// (the cache of the service worker before: every file as last loaded)
const OLD_CACHES = ["nfm"];
// how long a start waits for the server before the installed version starts
const WAIT_MS = 4000;
// how many files an update fetches at once
const AT_ONCE = 6;

const scope = () => new URL(self.registration.scope);
const pathOf = (url) => {
  const root = scope();
  return url.origin == root.origin && url.pathname.startsWith(root.pathname)
    ? decodeURIComponent(url.pathname.slice(root.pathname.length))
    : null;
};
const keyOf = (path, hash) =>
  new URL(`${path}?nfm=${encodeURIComponent(hash)}`, scope()).href;
const metaKey = (name) => new URL(`nfm-meta/${name}`, scope()).href;

const readMeta = async (name) => {
  const response = await (await caches.open(META)).match(metaKey(name));
  return response ? response.json() : null;
};
const writeMeta = async (name, value) =>
  (await caches.open(META)).put(
    metaKey(name),
    new Response(JSON.stringify(value)),
  );

const lists = new Map();
const listOf = async (version) => {
  if (!version) {
    return null;
  }
  if (!lists.has(version)) {
    lists.set(version, await readMeta(`list/${version}`));
  }
  return lists.get(version);
};
const keepList = async (list) => {
  lists.set(list.version, list);
  await writeMeta(`list/${list.version}`, list);
};
const installedList = async () => listOf(await readMeta("installed"));

const versions = new Map();
// (also the version started last, for a browser that does not tell which page asks)
const playsVersion = async (clientId, version) => {
  if (clientId) {
    versions.set(clientId, version);
    await writeMeta(`client/${clientId}`, version);
  }
  await writeMeta("started", version);
};
const versionOf = async (clientId) => {
  if (!clientId) {
    return null;
  }
  if (!versions.has(clientId)) {
    versions.set(clientId, await readMeta(`client/${clientId}`));
  }
  return versions.get(clientId);
};

const hashOf = async (buffer) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
    (byte) => byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .slice(0, 16);

// A file fetched anew (past the browser's cache: it may hold another version of it), kept
// only when it is the one listed.
const fetchKept = async (path, hash) => {
  const response = await fetch(new URL(path, scope()), { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`${path}: ${response.status}`);
  }
  const body = await response.arrayBuffer();
  if ((await hashOf(body)) != hash) {
    throw new Error(`${path} is not the one listed`);
  }
  const headers = {
    "content-type": response.headers.get("content-type") ?? "",
  };
  await (
    await caches.open(FILES)
  ).put(keyOf(path, hash), new Response(body, { headers }));
  return new Response(body, { headers });
};

const kept = async (path, hash) =>
  (await (await caches.open(FILES)).match(keyOf(path, hash))) ??
  fetchKept(path, hash);

const newestList = async () => {
  const response = await fetch(new URL("offline.json", scope()), {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`offline.json: ${response.status}`);
  }
  return response.json();
};

// Away with the files, lists and pages' records that neither the installed version nor an
// open page needs any more.
const letGo = async (installed) => {
  const open = await self.clients.matchAll({ includeUncontrolled: true });
  const playing = [installed];
  const meta = await caches.open(META);
  const nameOf = (request) => request.url.slice(metaKey("").length);
  for (const request of await meta.keys()) {
    const id = nameOf(request).split("client/")[1];
    if (id && open.some((client) => client.id == id)) {
      playing.push(await versionOf(id));
    } else if (id) {
      versions.delete(id);
      await meta.delete(request);
    }
  }
  for (const request of await meta.keys()) {
    const version = nameOf(request).split("list/")[1];
    if (version && !playing.includes(version)) {
      lists.delete(version);
      await meta.delete(request);
    }
  }
  const wanted = new Set();
  for (const version of playing) {
    const list = await listOf(version);
    for (const [path, hash] of Object.entries(list?.core ?? {})) {
      wanted.add(keyOf(path, hash));
    }
    for (const [path, hash] of Object.entries(list?.later ?? {})) {
      wanted.add(keyOf(path, hash));
    }
  }
  const files = await caches.open(FILES);
  for (const request of await files.keys()) {
    if (!wanted.has(request.url)) {
      await files.delete(request);
    }
  }
};

// Installs list's version: keeps every file of it but the music, then makes it the
// installed one.
const install = async (list) => {
  await keepList(list);
  if ((await readMeta("installed")) == list.version) {
    return;
  }
  const files = await caches.open(FILES);
  const wanted = Object.entries(list.core);
  let next = 0;
  const fetchNext = async () => {
    while (next < wanted.length) {
      const [path, hash] = wanted[next++];
      if (!(await files.match(keyOf(path, hash)))) {
        await fetchKept(path, hash);
      }
    }
  };
  await Promise.all(Array.from({ length: AT_ONCE }, fetchNext));
  await writeMeta("installed", list.version);
  await letGo(list.version);
};

// (one update at a time; a failed one is tried again at the next start)
let installing = null;
const update = (newest) => {
  newest.catch(() => {});
  installing ??= newest.then(install).finally(() => {
    installing = null;
  });
  return installing.catch(() => {});
};

const waited = (ms) =>
  new Promise((resolve, reject) => setTimeout(() => reject(new Error()), ms));

// A start: the newest version if the server tells it in time and has its page, else the
// installed one.
const start = async (event, newest) => {
  const installed = await installedList();
  const asked = installed ? Promise.race([newest, waited(WAIT_MS)]) : newest;
  const chosen = (await asked.catch(() => null)) ?? installed;
  for (const list of chosen == installed ? [chosen] : [chosen, installed]) {
    if (!list) {
      continue;
    }
    try {
      await keepList(list);
      const page = await kept("index.html", list.core["index.html"]);
      await playsVersion(event.resultingClientId, list.version);
      return page;
    } catch {
      // (the server's page is not yet the one its list names: the installed version)
    }
  }
  // never installed, and nothing from the server: as if there were no service worker
  return fetch(event.request);
};

// A file a page asks for: the one its version lists.
const file = async (event, path) => {
  if (installing) {
    // (the page keeps the service worker alive until its update is done)
    event.waitUntil(installing.catch(() => {}));
  }
  const list =
    (await listOf(await versionOf(event.clientId))) ??
    (await listOf(await readMeta("started"))) ??
    (await installedList());
  const hash = list && (list.core[path] ?? list.later[path]);
  if (!hash) {
    return fetch(event.request);
  }
  try {
    return await kept(path, hash);
  } catch {
    // (the server has another version of it by now: as it comes)
    return fetch(event.request);
  }
};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const name of OLD_CACHES) {
        await caches.delete(name);
      }
      await self.clients.claim();
      // (not waited for: the pages' files would wait for it)
      update(newestList());
    })(),
  ),
);

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const path = pathOf(new URL(request.url));
  // (other servers' files, the relay and the list are none of its business, nor is music
  // streamed in ranges)
  if (
    request.method != "GET" ||
    request.headers.has("range") ||
    path == null ||
    path.startsWith("net/") ||
    path == "offline.json"
  ) {
    return;
  }
  if (request.mode == "navigate" && (path == "" || path == "index.html")) {
    const newest = newestList();
    event.waitUntil(update(newest));
    event.respondWith(start(event, newest));
    return;
  }
  event.respondWith(file(event, path));
});
