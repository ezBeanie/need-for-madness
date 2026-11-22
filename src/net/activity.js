// As the game starts it tells the server it was opened, for the admin page (see
// server/visits.js): its version, the kind of device and whether it is installed. Nothing
// that tells the player apart; the server keeps only the network and the country.

import { VERSION } from "../data/changelog.js";

const VISIT_PATH = "net/visit";

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

export const tellVisit = () => {
  // (served, not opened as a file or tested without a server)
  if (!globalThis.location?.protocol?.startsWith("http")) {
    return;
  }
  fetch(VISIT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      version: VERSION,
      device: device(),
      installed: installed(),
    }),
    keepalive: true,
  }).catch(() => {});
};
