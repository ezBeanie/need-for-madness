import { createHmac } from "node:crypto";
import { expect, test } from "vitest";
import { iceServers } from "../server/ice.js";

test("without a host the games find each other only in the same network, without a secret by STUN alone", () => {
  expect(iceServers(undefined, "secret")).toEqual([]);
  expect(iceServers("turn.example", undefined)).toEqual([
    { urls: "stun:turn.example:3478" },
  ]);
});

// coturn's use-auth-secret: the username is when the login runs out, the password its
// HMAC with the shared secret
test("the TURN login runs out after a day and is signed with the shared secret", () => {
  const now = Date.UTC(2026, 10, 3);
  const [stun, turn] = iceServers("turn.example", "secret", now);
  expect(stun.urls).toBe("stun:turn.example:3478");
  expect(turn.urls).toContain("turn:turn.example:3478?transport=udp");
  const [until] = turn.username.split(":");
  expect(Number(until)).toBe(now / 1000 + 24 * 60 * 60);
  expect(turn.credential).toBe(
    createHmac("sha1", "secret").update(turn.username).digest("base64"),
  );
  expect(turn.credential).not.toBe(
    createHmac("sha1", "other").update(turn.username).digest("base64"),
  );
});
