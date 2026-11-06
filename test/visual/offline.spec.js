// The installed game (public/sw.js) against a built game served here: a start without the
// network, a new version at the first start after its deploy, an update cut short, a slow
// server, a file that is not the listed one, and the music kept once played.

import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashOf, listOffline } from "../../tools/offline/list.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const BUILT = join(ROOT, "test-results", "offline-build");
const STAGE = "data/stages/3.txt";
const MUSIC = "data/music/stage1.mp3";
const OTHER_MUSIC = "data/music/stage2.mp3";

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
};

let built;

// The server of the built game, as a deploy would change it: files put in place of the
// built ones (with the list naming them), files it fails, a list it is slow to give, or no
// network at all.
const startServer = async () => {
  const server = {
    changed: {},
    list: built,
    failing: new Set(),
    slowList: 0,
    offline: false,
  };
  const http = createServer(async (request, response) => {
    if (server.offline) {
      request.socket.destroy();
      return;
    }
    let path = decodeURIComponent(new URL(request.url, "http://x").pathname);
    path = path.slice(1) || "index.html";
    if (server.failing.has(path)) {
      response.writeHead(500).end();
      return;
    }
    if (path == "offline.json") {
      await new Promise((resolve) => setTimeout(resolve, server.slowList));
      response
        .writeHead(200, { "content-type": TYPES[".json"] })
        .end(JSON.stringify(server.list));
      return;
    }
    try {
      const body = server.changed[path] ?? (await readFile(join(BUILT, path)));
      response
        .writeHead(200, {
          "content-type": TYPES[extname(path)] ?? "application/octet-stream",
        })
        .end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => http.listen(0, "localhost", resolve));
  server.url = `http://localhost:${http.address().port}/`;
  server.close = () => {
    http.closeAllConnections();
    return new Promise((resolve) => http.close(resolve));
  };
  // A deploy: the files changed, the list naming them. listed: false leaves the list as
  // it was, as on a server half through its deploy.
  server.deploy = (changes, { listed = true } = {}) => {
    Object.assign(server.changed, changes);
    if (listed) {
      const core = { ...server.list.core };
      for (const [path, body] of Object.entries(changes)) {
        core[path] = hashOf(body);
      }
      const later = server.list.later;
      server.list = {
        version: hashOf(JSON.stringify({ core, later })),
        core,
        later,
      };
    }
    return server.list.version;
  };
  return server;
};

const pageOf = async (version) =>
  (await readFile(join(BUILT, "index.html"), "utf8")).replace(
    "<head>",
    `<head><meta name="test-version" content="${version}">`,
  );

const installed = (page) =>
  page.evaluate(async () => {
    const meta = await caches.open("nfm-meta");
    const response = await meta.match(
      new URL("nfm-meta/installed", location.href),
    );
    return response ? response.json() : null;
  });

const waitInstalled = (page, version) =>
  expect.poll(() => installed(page), { timeout: 60_000 }).toBe(version);

const shownVersion = (page) =>
  page.evaluate(
    () => document.querySelector("meta[name=test-version]")?.content ?? "built",
  );

const fetched = (page, path) =>
  page.evaluate(
    (file) =>
      fetch(file).then(
        (response) =>
          response.ok ? response.text() : `failed ${response.status}`,
        () => "failed",
      ),
    path,
  );

test.describe("installed", () => {
  test.describe.configure({ mode: "serial" });
  let server;

  test.beforeAll(async () => {
    execFileSync(
      "npx",
      [
        "vite",
        "build",
        "--outDir",
        BUILT,
        "--emptyOutDir",
        "--logLevel",
        "error",
      ],
      { cwd: ROOT },
    );
    built = await listOffline(BUILT);
  });

  test.beforeEach(async () => {
    server = await startServer();
  });

  test.afterEach(async () => {
    await server.close();
  });

  // Opened once with the network: the game's files are kept; then without it every file the
  // game asks for while it starts comes from them.
  const firstStart = async (page) => {
    await page.goto(server.url);
    await waitInstalled(page, built.version);
  };
  const failedWhileStarting = async (page) => {
    const failed = [];
    page.on("requestfailed", (request) => failed.push(request.url()));
    page.on("response", (response) => {
      if (!response.ok()) {
        failed.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    return failed.filter((url) => !url.endsWith("/offline.json"));
  };

  test("once installed the game starts without the network, every file of it kept", async ({
    page,
  }) => {
    await firstStart(page);
    server.offline = true;
    expect(await failedWhileStarting(page)).toEqual([]);
    expect(await shownVersion(page)).toBe("built");
    expect(await fetched(page, STAGE)).toBe(
      await readFile(join(BUILT, STAGE), "utf8"),
    );
    // a join link is the same page
    await page.goto(`${server.url}?join=abcde`);
    expect(await shownVersion(page)).toBe("built");
  });

  test("a new version plays at the first start after its deploy, and then without the network", async ({
    page,
  }) => {
    await firstStart(page);
    const stage = "// the new version\n";
    const version = server.deploy({
      "index.html": await pageOf("new"),
      [STAGE]: stage,
    });
    await page.reload();
    expect(await shownVersion(page)).toBe("new");
    expect(await fetched(page, STAGE)).toBe(stage);
    await waitInstalled(page, version);
    server.offline = true;
    await page.reload();
    expect(await shownVersion(page)).toBe("new");
    expect(await fetched(page, STAGE)).toBe(stage);
  });

  test("an update cut short leaves the version installed before whole", async ({
    page,
  }) => {
    await firstStart(page);
    const version = server.deploy({
      "index.html": await pageOf("new"),
      [STAGE]: "// the new version\n",
    });
    server.failing.add(STAGE);
    await page.reload();
    expect(await shownVersion(page)).toBe("new");
    // (the update cannot finish: the installed version stays)
    await page.waitForTimeout(1000);
    expect(await installed(page)).toBe(built.version);
    server.offline = true;
    await page.reload();
    expect(await shownVersion(page)).toBe("built");
    expect(await fetched(page, STAGE)).toBe(
      await readFile(join(BUILT, STAGE), "utf8"),
    );
    // back with the network the update finishes
    server.offline = false;
    server.failing.clear();
    await page.reload();
    await waitInstalled(page, version);
  });

  test("a server too slow to tell its version starts the installed one", async ({
    page,
  }) => {
    await firstStart(page);
    server.deploy({ "index.html": await pageOf("new") });
    server.slowList = 10_000;
    const before = Date.now();
    await page.reload();
    expect(await shownVersion(page)).toBe("built");
    expect(Date.now() - before).toBeLessThan(8000);
  });

  test("a page that is not the one listed (a deploy half done) starts the installed version", async ({
    page,
  }) => {
    await firstStart(page);
    server.deploy({ "index.html": await pageOf("new") });
    // the list names the new page, the server still has another
    server.deploy({ "index.html": await pageOf("half") }, { listed: false });
    await page.reload();
    expect(await shownVersion(page)).toBe("built");
  });

  test("music is kept once played, not before", async ({ page }) => {
    await firstStart(page);
    expect(await fetched(page, MUSIC)).not.toMatch(/^failed/);
    server.offline = true;
    await page.reload();
    expect(await fetched(page, MUSIC)).not.toMatch(/^failed/);
    expect(await fetched(page, OTHER_MUSIC)).toMatch(/^failed/);
  });
});
