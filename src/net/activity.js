// What the game tells the server for the admin page (see server/visits.js): that it was
// opened, by which player (a random id this browser keeps) in which session (a random id of
// this opening), with the player's name, the version, the kind of device and whether it is
// installed; then what is played (tellActivity), e.g. a race begun and how it ended.

import { RACE_KIND, RACE_MODE_NAMES, game, raceSetup } from "../core/state.js";
import { loadText, saveSetting } from "../core/storage.js";
import { VERSION } from "../data/changelog.js";
import { carStats } from "../data/carStats.js";
import { stageLabel } from "../data/stages.js";
import { isLapSession } from "../race/deathmatch.js";
import { laps } from "../race/lapTimes.js";
import { formatTime } from "../race/timeAttack.js";
import { track } from "../race/track.js";
import { own } from "./roomCars.js";

const VISIT_PATH = "net/visit";
const EVENT_PATH = "net/event";
const PLAYER = "playerId";

const randomId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

const playerId = () => {
  let id = loadText(PLAYER);
  if (!/^[0-9a-f]{16}$/.test(id)) {
    id = randomId();
    saveSetting(PLAYER, id);
  }
  return id;
};

const ids = { player: "", session: "" };

// (a phone's shorter side is under 600 pixels, a tablet's not)
const device = () => {
  if (!globalThis.matchMedia?.("(pointer: coarse)").matches) {
    return "desktop";
  }
  return Math.min(screen.width, screen.height) < 600 ? "phone" : "tablet";
};

const installed = () =>
  Boolean(
    globalThis.matchMedia?.("(display-mode: standalone)").matches ||
      navigator.standalone,
  );

// (served, not opened as a file or tested without a server)
const served = () => globalThis.location?.protocol?.startsWith("http");

const post = (path, body) =>
  fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...ids, name: own.name, ...body }),
    keepalive: true,
  }).catch(() => {});

export const tellVisit = () => {
  if (!served()) {
    return;
  }
  ids.player = playerId();
  ids.session = randomId();
  post(VISIT_PATH, {
    version: VERSION,
    device: device(),
    installed: installed(),
  });
};

// kind: one of the server's EVENTS; detail: a few short texts or numbers
export const tellActivity = (kind, detail = {}) => {
  if (!served() || !ids.session) {
    return;
  }
  post(EVENT_PATH, { kind, detail });
};

// by RACE_KIND
const KINDS = [
  "campaign",
  "quick race",
  "practice",
  "time attack",
  "multiplayer",
];

const race = () => ({
  kind: KINDS[raceSetup.kind],
  stage: stageLabel(track.stage),
  ...(raceSetup.kind == RACE_KIND.together
    ? { mode: RACE_MODE_NAMES[raceSetup.mode] }
    : {}),
});

// As a race begins: what kind, where, in which car, against how many.
export const tellRaceBegun = () =>
  tellActivity("race", {
    ...race(),
    car: carStats.names[game.carTypes[game.player]] ?? "?",
    cars: game.carCount,
    players: Math.max(1, game.humans.length),
  });

// As the race is over for the player: won or not, in time attack its best lap.
export const tellRaceOver = (won) =>
  tellActivity("result", {
    ...race(),
    result: won ? "won" : "lost",
    ...(isLapSession() && laps.best[game.player] > 0
      ? { time: formatTime(laps.best[game.player]) }
      : {}),
  });
