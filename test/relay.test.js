import { createServer } from "node:http";
import { afterEach, beforeEach, expect, test } from "vitest";
import { WebSocket } from "ws";
import { ROOM_FULL, attachRelay } from "../server/relay.js";

let server;
let url;
const sockets = [];

beforeEach(async () => {
  server = createServer();
  attachRelay(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `ws://localhost:${server.address().port}`;
});

afterEach(async () => {
  sockets.splice(0).forEach((socket) => socket.terminate());
  await new Promise((resolve) => server.close(resolve));
});

// A game in a room, with every message it gets.
const enter = (path) =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url + path);
    sockets.push(socket);
    socket.received = [];
    socket.on("message", (data) => socket.received.push(String(data)));
    socket.on("open", () => resolve(socket));
    socket.on("error", reject);
  });

const delivered = () => new Promise((resolve) => setTimeout(resolve, 50));

test("a message goes to the other games of its room, and only there", async () => {
  const host = await enter("/net?room=race-1");
  const guest = await enter("/net?room=race-1");
  const elsewhere = await enter("/net?room=race-2");
  host.send("from the host");
  guest.send("from the guest");
  await delivered();
  expect(guest.received).toEqual(["from the host"]);
  expect(host.received).toEqual(["from the guest"]);
  expect(elsewhere.received).toEqual([]);
});

test("rooms with odd names are turned away", async () => {
  await expect(enter("/net?room=")).rejects.toThrow();
  await expect(enter("/net?room=a%20b")).rejects.toThrow();
  await expect(enter("/net?room=" + "x".repeat(33))).rejects.toThrow();
});

test("a room takes eight games at most, and tells the ninth it is full", async () => {
  for (let i = 0; i < 8; i++) {
    await enter("/net?room=full");
  }
  const ninth = await enter("/net?room=full");
  const code = await new Promise((resolve) => ninth.on("close", resolve));
  expect(code).toBe(ROOM_FULL);
});

test("a game sending a broken message is dropped, and the relay goes on", async () => {
  const host = await enter("/net?room=broken");
  const guest = await enter("/net?room=broken");
  const broken = await enter("/net?room=broken");
  // a masked text frame marked compressed whose data does not inflate
  broken._socket.write(Buffer.from([0xc1, 0x82, 0, 0, 0, 0, 0xff, 0xff]));
  await delivered();
  host.send("still there");
  await delivered();
  expect(guest.received).toEqual(["still there"]);
  expect(broken.readyState).not.toBe(WebSocket.OPEN);
});
