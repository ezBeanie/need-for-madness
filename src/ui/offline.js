// The options' offline section: whether the installed game starts without the network, how
// far an update is, and the stages' music kept for it too (public/sw.js keeps the files,
// these only ask). Back from the background in the main menu, the game starts anew when a
// newer version is out (a start does that by itself, an app brought back does not start).
// Without a service worker (the dev server) the section stays hidden and nothing is asked.

import { PHASE, game } from "../core/state.js";
import { link } from "../net/link.js";

// what the service worker told last; version: the one this page plays
export const offline = { status: null, version: null };

const worker = () => globalThis.navigator?.serviceWorker?.controller ?? null;
const ask = (what) => worker()?.postMessage({ offline: what });
export const askOfflineStatus = () => ask("status");

const megabytes = (bytes) => `${Math.round(bytes / 1e6)} MB`;

const readyText = ({ ready, installing }) => {
  if (installing) {
    const percent = Math.floor((100 * installing.done) / installing.total);
    return `Getting the game ready to play without the network: ${percent}%`;
  }
  return ready
    ? "Ready to play without the network."
    : "Not ready yet: it gets ready while the game runs with the network.";
};

const showOffline = () => {
  const { status } = offline;
  document.getElementById("optionsOffline").hidden = !status;
  if (!status) {
    return;
  }
  document.getElementById("offlineReady").textContent = readyText(status);
  const { wanted, keeping, kept, total } = status.music;
  const music = document.getElementById("offlineMusic");
  music.setAttribute("aria-pressed", wanted ? "true" : "false");
  music.querySelector(".state").textContent = wanted ? "On" : "Off";
  document.getElementById("offlineMusicSize").textContent =
    `(${megabytes(total)})`;
  // (how much is kept: while keeping it, or when not all could be)
  document.getElementById("offlineMusicProgress").hidden =
    !wanted || kept >= total;
  const bar = document.getElementById("offlineMusicKept");
  bar.max = Math.max(1, total);
  bar.value = kept;
  document.getElementById("offlineMusicKeptShown").textContent =
    `${megabytes(kept)} of ${megabytes(total)}${keeping ? "" : ", the rest with the network"}`;
};

// Back in the foreground: in the main menu and in no room, a newer version starts at once.
const NEWEST_WAIT_MS = 4000;
export const startNewest = async () => {
  if (
    document.visibilityState != "visible" ||
    !offline.version ||
    game.phase != PHASE.mainMenu ||
    link.open ||
    document.getElementById("options").open
  ) {
    return;
  }
  try {
    const response = await fetch("offline.json", {
      cache: "no-store",
      signal: AbortSignal.timeout?.(NEWEST_WAIT_MS),
    });
    const { version } = await response.json();
    if (version != offline.version && game.phase == PHASE.mainMenu) {
      location.reload();
    }
  } catch {
    // (no network: the version playing goes on)
  }
};

export const installOffline = () => {
  if (!globalThis.navigator?.serviceWorker) {
    return;
  }
  navigator.serviceWorker.addEventListener("message", (event) => {
    const told = event.data?.offline;
    if (told) {
      offline.status = told;
      offline.version = told.version ?? offline.version;
      showOffline();
    }
  });
  // (a page the service worker took over only after it started asks once it has)
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    askOfflineStatus,
  );
  askOfflineStatus();
  document.getElementById("offlineMusic").addEventListener("click", () => {
    ask(offline.status?.music.wanted ? "dropMusic" : "keepMusic");
  });
  document.addEventListener("visibilitychange", startNewest);
};
