// The rooms the relay had, for admin.html: when, how many games, whether they raced and
// the host's network, its address cut short (see shortAddress), never the whole address.
// Kept for 90 days, in a file if there is one, so a new relay still knows them.

import { readFileSync, writeFileSync } from "node:fs";

export const KEEP_MS = 90 * 24 * 60 * 60 * 1000;
// (rooms are cheap to open; the file must not grow without end)
const MOST_SESSIONS = 5000;

// The network an address is in: the first two parts of an IPv4 one, the first three groups
// (the /48 a provider hands out) of an IPv6 one.
export const shortAddress = (address = "") => {
  const v4 = address.match(/(?:^|:)(\d+)\.(\d+)\.\d+\.\d+$/);
  if (v4) {
    return `${v4[1]}.${v4[2]}.x.x`;
  }
  const [head, tail] = address.split("::");
  const groups = head ? head.split(":") : [];
  if (tail != undefined) {
    const rest = tail ? tail.split(":") : [];
    groups.push(...Array(8 - groups.length - rest.length).fill("0"), ...rest);
  }
  return groups.length == 8 ? groups.slice(0, 3).join(":") + "::" : "?";
};

// What happened lately, oldest first, for KEEP_MS by its time (timeOf) and at most most of
// it: in a file, if given, written anew with each one added.
export const keepRecent = (file, timeOf, most) => {
  let sessions = [];
  if (file) {
    try {
      sessions = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      // none kept yet (or a broken file, which the next session writes anew)
    }
  }
  const recent = () => {
    const now = Date.now();
    sessions = sessions
      .filter((session) => now - timeOf(session) < KEEP_MS)
      .slice(-most);
    return sessions;
  };
  return {
    add: (session) => {
      sessions.push(session);
      recent();
      if (!file) {
        return;
      }
      // the relay goes on without its history rather than ending
      try {
        writeFileSync(file, JSON.stringify(sessions));
      } catch (error) {
        console.error(`history not kept: ${error.code ?? error.message}`);
      }
    },
    past: recent,
  };
};

export const keepSessions = (file) =>
  keepRecent(file, (session) => session.until, MOST_SESSIONS);
