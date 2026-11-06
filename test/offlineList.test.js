import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import {
  hashOf,
  listOffline,
  writeOfflineList,
} from "../tools/offline/list.js";

let dir;
const put = async (path, content) => {
  await mkdir(dirname(join(dir, path)), { recursive: true });
  await writeFile(join(dir, path), content);
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "offline-list-"));
  await put("index.html", "<html></html>");
  await put("assets/index-abc.js", "game");
  await put("data/stages/1.txt", "stage");
  await put("data/music/shift.mp3", "menu music");
  await put("data/classic/music/interface.mp3", "classic menu music");
  await put("data/music/stage1.mp3", "stage music");
  await put("data/classic/music/mp-stage1.mp3", "classic stage music");
  await put("data/classic/music/loops.json", "{}");
  await put("sw.js", "worker");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("every file is listed by the hash of its content, the stages' music apart", async () => {
  const list = await listOffline(dir);
  expect(list.core).toEqual({
    "assets/index-abc.js": hashOf("game"),
    "data/classic/music/interface.mp3": hashOf("classic menu music"),
    "data/classic/music/loops.json": hashOf("{}"),
    "data/music/shift.mp3": hashOf("menu music"),
    "data/stages/1.txt": hashOf("stage"),
    "index.html": hashOf("<html></html>"),
  });
  expect(list.later).toEqual({
    "data/classic/music/mp-stage1.mp3": hashOf("classic stage music"),
    "data/music/stage1.mp3": hashOf("stage music"),
  });
  // the same as the service worker's: 16 hex digits of SHA-256
  expect(hashOf("stage")).toMatch(/^[0-9a-f]{16}$/);
});

test("the version changes with any file, and only then", async () => {
  const { version } = await listOffline(dir);
  expect((await listOffline(dir)).version).toBe(version);
  await put("data/stages/1.txt", "another stage");
  expect((await listOffline(dir)).version).not.toBe(version);
});

test("the list written leaves out itself and the service worker", async () => {
  await writeOfflineList(dir);
  const list = await listOffline(dir);
  expect(list.core["offline.json"]).toBeUndefined();
  expect(list.core["sw.js"]).toBeUndefined();
});
