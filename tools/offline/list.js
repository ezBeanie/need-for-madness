// The list the service worker installs the game by (see public/sw.js): every file of the
// build with a hash of its content, the version a hash of them all. The stages' music is
// listed apart: it is kept as it is played, not before (the menus' plays at every start).

import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export const LIST_FILE = "offline.json";
// (the service worker comes by its own way, the list is always asked for anew)
const UNLISTED = new Set(["sw.js", LIST_FILE]);
const MENU_MUSIC = new Set([
  "data/music/shift.mp3",
  "data/classic/music/interface.mp3",
]);
const isMusic = (path) =>
  /^data\/(classic\/)?music\/.+\.mp3$/.test(path) && !MENU_MUSIC.has(path);

export const hashOf = (content) =>
  createHash("sha256").update(content).digest("hex").slice(0, 16);

const filesIn = async (dir) => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/"),
    )
    .filter((path) => !UNLISTED.has(path))
    .sort();
};

// (sizes: the music's, for the options to tell how much keeping it all takes)
export const listOffline = async (dir) => {
  const core = {};
  const later = {};
  const sizes = {};
  for (const path of await filesIn(dir)) {
    const content = await readFile(join(dir, path));
    if (isMusic(path)) {
      later[path] = hashOf(content);
      sizes[path] = content.length;
    } else {
      core[path] = hashOf(content);
    }
  }
  const version = hashOf(JSON.stringify({ core, later }));
  return { version, core, later, sizes };
};

export const writeOfflineList = async (dir) => {
  const list = await listOffline(dir);
  await writeFile(join(dir, LIST_FILE), JSON.stringify(list));
  return list;
};
