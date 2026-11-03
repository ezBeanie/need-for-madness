import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { keepSessions, shortAddress } from "../server/sessions.js";

const DAY_MS = 24 * 60 * 60 * 1000;

test("an address is cut down to its network", () => {
  expect(shortAddress("89.12.34.56")).toBe("89.12.x.x");
  expect(shortAddress("::ffff:192.168.178.20")).toBe("192.168.x.x");
  expect(shortAddress("2a00:1f:5f04:5d01:1007:625c:130b:775b")).toBe(
    "2a00:1f:5f04::",
  );
  expect(shortAddress("2a02:8071::1")).toBe("2a02:8071:0::");
  expect(shortAddress("::1")).toBe("0:0:0::");
  expect(shortAddress(undefined)).toBe("?");
  expect(shortAddress("not an address")).toBe("?");
});

test("sessions are kept in the file for a week and read again by a new relay", () => {
  const file = join(mkdtempSync(join(tmpdir(), "nfm-sessions-")), "s.json");
  const now = Date.now();
  writeFileSync(
    file,
    JSON.stringify([{ since: now - 9 * DAY_MS, until: now - 8 * DAY_MS }]),
  );
  const sessions = keepSessions(file);
  sessions.add({ since: now - 1000, until: now, host: "89.12.x.x" });
  expect(sessions.past()).toEqual([
    { since: now - 1000, until: now, host: "89.12.x.x" },
  ]);
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(sessions.past());
  expect(keepSessions(file).past()).toEqual(sessions.past());
});

test("a file that cannot be written leaves the sessions in memory", () => {
  const sessions = keepSessions("/no/such/dir/s.json");
  sessions.add({ since: 1, until: Date.now() });
  expect(sessions.past()).toHaveLength(1);
});
