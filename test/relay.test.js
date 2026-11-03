import { createServer } from "node:http";
import { afterEach, beforeEach, expect, test } from "vitest";
import { WebSocket } from "ws";
import { ROOM_FULL, answerRooms, attachRelay } from "../server/relay.js";

let server;
let url;
let report;
const sockets = [];

beforeEach(async () => {
  server = createServer();
  report = attachRelay(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `ws://localhost:${server.address().port}`;
});

afterEach(async () => {
  sockets.splice(0).forEach((socket) => socket.terminate());
  await new Promise((resolve) => server.close(resolve));
});

// A game in a room, with every message it gets.
const enter = (path, headers) =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url + path, { headers });
    sockets.push(socket);
    socket.received = [];
    socket.on("message", (data) => socket.received.push(String(data)));
    socket.on("open", () => resolve(socket));
    socket.on("error", reject);
  });

// (generous: under a full parallel run the sockets answer late)
const delivered = () => new Promise((resolve) => setTimeout(resolve, 200));

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

test("the rooms report counts each room's games and tells racing ones, without names", async () => {
  expect(report().rooms).toEqual([]);
  const host = await enter("/net?room=secret-1");
  await enter("/net?room=secret-1");
  await enter("/net?room=secret-2");
  host.send("keys");
  await delivered();
  expect(
    report().rooms.map(({ games, racing }) => ({ games, racing })),
  ).toEqual([
    { games: 2, racing: true },
    { games: 1, racing: false },
  ]);
  const { body } = askRooms(report, "Bearer token");
  expect(body).not.toContain("secret");
  expect(JSON.parse(body).rooms).toHaveLength(2);
});

// What answerRooms (with the token "token") answers a request with this authorization.
const askRooms = (report, authorization, token = "token") => {
  const answer = {};
  answerRooms(report, token)(
    { headers: authorization ? { authorization } : {} },
    {
      writeHead: (status) => (answer.status = status),
      end: (text) => (answer.body = text),
    },
  );
  return answer;
};

test("the rooms report answers only with the right token, and not at all without one set", () => {
  expect(askRooms(report, "Bearer token").status).toBe(200);
  for (const wrong of [undefined, "Bearer tokeN", "Bearer token2", "token"]) {
    expect(askRooms(report, wrong)).toEqual({ status: 401, body: undefined });
  }
  expect(askRooms(report, "Bearer ", "")).toEqual({
    status: 404,
    body: undefined,
  });
  expect(askRooms(report, "Bearer undefined", null).status).toBe(404);
});

test("a room's host is told by the network of the first game in it, never the whole address", async () => {
  await enter("/net?room=hosted", { "X-Real-IP": "2a02:8071:1234:5678::9" });
  await enter("/net?room=hosted", { "X-Real-IP": "89.12.34.56" });
  await delivered();
  expect(report().rooms[0].host).toBe("2a02:8071:1234::");
  expect(JSON.stringify(report())).not.toContain("5678");
});

test("a room no game is left in goes from the report into the past ones", async () => {
  const host = await enter("/net?room=short", { "X-Real-IP": "89.12.34.56" });
  const guest = await enter("/net?room=short");
  host.send("join");
  await delivered();
  host.close();
  guest.close();
  await delivered();
  const { rooms, past } = report();
  expect(rooms).toEqual([]);
  expect(past).toHaveLength(1);
  expect(past[0]).toMatchObject({
    host: "89.12.x.x",
    mostGames: 2,
    raced: false,
  });
  expect(past[0].until).toBeGreaterThanOrEqual(past[0].since);
});
