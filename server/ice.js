// How the games of a room find each other for the voice chat (see src/net/voice.js): the
// STUN server on TURN_HOST, and with TURN_SECRET also its TURN server, which takes logins
// made with the secret it shares with the relay (coturn's use-auth-secret), each good for a
// day. Without a host the games find each other only in the same network.

import { createHmac } from "node:crypto";

export const ICE_PATH = "/net/ice";
const LOGIN_SECONDS = 24 * 60 * 60;

export const iceServers = (host, secret, now = Date.now()) => {
  if (!host) {
    return [];
  }
  const stun = { urls: `stun:${host}:3478` };
  if (!secret) {
    return [stun];
  }
  const username = `${Math.floor(now / 1000) + LOGIN_SECONDS}:nfm`;
  const credential = createHmac("sha1", secret)
    .update(username)
    .digest("base64");
  return [
    stun,
    {
      urls: [
        `turn:${host}:3478?transport=udp`,
        `turn:${host}:3478?transport=tcp`,
      ],
      username,
      credential,
    },
  ];
};

export const answerIce = (host, secret) => (request, response) => {
  response.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify({ iceServers: iceServers(host, secret) }));
};
