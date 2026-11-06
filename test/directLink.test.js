import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  ROLE,
  closeLink,
  decode,
  encode,
  firstHeard,
  link,
  openLink,
} from "../src/net/link.js";
import { direct } from "../src/net/direct.js";

const GUEST = "guest001";
const OTHER = "guest002";

// the relay's socket, as the link opens it
let relay;
class FakeSocket {
  constructor() {
    relay = this;
    this.sent = [];
  }
  send(text) {
    this.sent.push(decode(text));
  }
  close() {}
}

// a guest linked directly with this game
const channelOf = (id) => {
  const channel = { readyState: "open", bufferedAmount: 0, sent: [] };
  channel.send = (text) => channel.sent.push(decode(text));
  direct.peers.set(id, { connection: { close() {} }, channel });
  return channel;
};

let heard;
beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("location", { protocol: "http:", host: "game" });
  heard = [];
});

afterEach(() => {
  closeLink();
  vi.unstubAllGlobals();
});

test("a message is heard once, though it comes over the relay and directly", () => {
  expect(firstHeard({ from: GUEST, seq: 0 })).toBe(true);
  expect(firstHeard({ from: GUEST, seq: 0 })).toBe(false);
  expect(firstHeard({ from: OTHER, seq: 0 })).toBe(true);
  expect(firstHeard({ from: GUEST, seq: 1 })).toBe(true);
  // (one without a number, from a game before them, always)
  expect(firstHeard({ from: GUEST })).toBe(true);
  expect(firstHeard({ from: GUEST })).toBe(true);
});

test("the host passes on what it hears to the guests linked directly, but the one it came from, once", () => {
  openLink(ROLE.host, "room", (message) => heard.push(message));
  relay.onopen();
  const guest = channelOf(GUEST);
  const other = channelOf(OTHER);
  const keys = encode({ type: "keys", from: GUEST, seq: 0 });
  relay.onmessage({ data: keys });
  // (the same again, as it comes directly too: heard and passed on before)
  relay.onmessage({ data: keys });
  expect(heard).toHaveLength(1);
  expect(other.sent).toEqual([{ type: "keys", from: GUEST, seq: 0 }]);
  expect(guest.sent).toEqual([]);
});

test("a guest passes on nothing", () => {
  openLink(ROLE.guest, "room", (message) => heard.push(message));
  relay.onopen();
  const host = channelOf("host0001");
  relay.onmessage({ data: encode({ type: "keys", from: OTHER, seq: 0 }) });
  expect(heard).toHaveLength(1);
  expect(host.sent).toEqual([]);
});

test("every message goes over the relay and directly, numbered", () => {
  openLink(ROLE.guest, "room", () => {});
  relay.onopen();
  const host = channelOf("host0001");
  link.send({ type: "keys" });
  link.send({ type: "keys" });
  const sent = [
    { type: "keys", from: link.id, seq: 0 },
    { type: "keys", from: link.id, seq: 1 },
  ];
  expect(relay.sent).toEqual(sent);
  expect(host.sent).toEqual(sent);
});

test("without the relay the link stays open while a game is linked directly", () => {
  openLink(ROLE.guest, "room", () => {});
  relay.onopen();
  channelOf("host0001");
  vi.useFakeTimers();
  relay.onclose({ code: 1006 });
  vi.useRealTimers();
  expect(link.open).toBe(true);
  link.send({ type: "keys" });
  expect(relay.sent).toEqual([]);
});
