import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, expect, test } from "vitest";
import { loadCountries } from "../server/geo.js";
import { keepVisits } from "../server/visits.js";

// as DB-IP's file has them: IPv4 ranges, then IPv6 ones
const COUNTRIES = [
  "0.0.0.0,0.255.255.255,ZZ",
  "1.0.0.0,1.0.0.255,AU",
  "89.0.0.0,89.255.255.255,DE",
  "2a00:1f::,2a00:1f:ffff:ffff:ffff:ffff:ffff:ffff,DE",
  "2a02:8071::,2a02:8071:ffff:ffff:ffff:ffff:ffff:ffff,AT",
].join("\n");

const fileOf = (name, content) => {
  const file = join(mkdtempSync(join(tmpdir(), "nfm-visits-")), name);
  writeFileSync(file, content);
  return file;
};

test("an address's country comes from the database file, gzipped or not, else none", () => {
  for (const file of [
    fileOf("c.csv", COUNTRIES),
    fileOf("c.csv.gz", gzipSync(COUNTRIES)),
  ]) {
    const countryOf = loadCountries(file);
    expect(countryOf("1.0.0.7")).toBe("AU");
    expect(countryOf("::ffff:89.12.34.56")).toBe("DE");
    expect(countryOf("2a00:1f:5f04:5d01:1a31:bfff:fe0e:930")).toBe("DE");
    expect(countryOf("2a02:8071::1")).toBe("AT");
    expect(countryOf("1.0.1.0")).toBe(null);
    expect(countryOf("0.1.2.3")).toBe(null);
    expect(countryOf("not an address")).toBe(null);
  }
  expect(loadCountries("/no/such/file")("1.0.0.7")).toBe(null);
});

let server = null;
afterEach(() => server?.close());

// a server taking visits and events, and posting to path from address (as nginx says it)
const visitsServer = async (visits) => {
  server = createServer((request, response) =>
    request.url.endsWith("/event")
      ? visits.answerEvent(request, response)
      : visits.answerVisit(request, response),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return (path, body, address = "89.12.34.56") =>
    fetch(`http://127.0.0.1:${port}/net/${path}`, {
      method: "POST",
      headers: { "X-Real-IP": address },
      body: typeof body == "string" ? body : JSON.stringify(body),
    }).then((response) => response.status);
};

const ANN = { player: "a1a1a1a1a1a1a1a1", name: "Ann" };
const BOB = { player: "b2b2b2b2b2b2b2b2", name: "" };
const VISIT = { version: "1.3.4", device: "phone", installed: true };

test("players, the games they opened and what they played are kept by network and country only, and summed up", async () => {
  const folder = mkdtempSync(join(tmpdir(), "nfm-visits-"));
  const files = [join(folder, "v.json"), join(folder, "e.json")];
  const visits = keepVisits(...files, (address) =>
    address.startsWith("89.") ? "DE" : null,
  );
  const post = await visitsServer(visits);
  const opened = (who, session, address) =>
    post("visit", { ...who, session, ...VISIT }, address);
  expect(await opened(ANN, "51515151")).toBe(204);
  // (a session opens once)
  expect(await opened(ANN, "51515151")).toBe(204);
  expect(await opened(ANN, "52525252")).toBe(204);
  expect(
    await post(
      "visit",
      {
        ...BOB,
        session: "61616161",
        ...VISIT,
        device: "desktop",
        installed: false,
      },
      "1.0.0.7",
    ),
  ).toBe(204);
  expect(await post("visit", { ...ANN, session: "x", ...VISIT })).toBe(400);
  expect(
    await post("visit", {
      ...ANN,
      session: "53535353",
      ...VISIT,
      device: "fridge",
    }),
  ).toBe(400);
  expect(await post("visit", "not json")).toBe(400);
  const race = {
    kind: "campaign",
    stage: "Stage 3",
    car: "MAX Revenge",
    cars: 7,
  };
  expect(
    await post("event", {
      ...ANN,
      session: "52525252",
      kind: "race",
      detail: race,
    }),
  ).toBe(204);
  expect(
    await post("event", {
      ...ANN,
      session: "52525252",
      kind: "result",
      detail: { result: "won" },
    }),
  ).toBe(204);
  expect(
    await post("event", {
      ...ANN,
      session: "52525252",
      kind: "hack",
      detail: {},
    }),
  ).toBe(400);
  expect(
    await post("event", {
      ...ANN,
      session: "52525252",
      kind: "race",
      detail: { long: "x".repeat(41) },
    }),
  ).toBe(400);

  const summary = visits.summary();
  expect(summary.total).toBe(3);
  expect(summary.players).toBe(2);
  const today = new Date().toISOString().slice(0, 10);
  expect(summary.byDay).toEqual([[today, 3, 2, 2]]);
  expect(summary.byCountry).toEqual([
    ["DE", 1],
    ["?", 1],
  ]);
  expect(summary.byEvent).toEqual([
    ["race: campaign", 1],
    ["result", 1],
  ]);
  const ann = summary.latestPlayers.find(({ player }) => player == ANN.player);
  expect(ann).toMatchObject({
    name: "Ann",
    visits: 2,
    races: 1,
    country: "DE",
    device: "phone (app)",
  });
  expect(summary.sessions).toHaveLength(1);
  expect(summary.sessions[0]).toMatchObject({
    session: "52525252",
    name: "Ann",
    network: "89.12.x.x",
    country: "DE",
  });
  expect(summary.sessions[0].events.map(({ kind }) => kind)).toEqual([
    "race",
    "result",
  ]);
  expect(JSON.stringify(summary)).not.toContain("89.12.34.56");
  // (a new relay knows them)
  expect(keepVisits(...files, () => null).summary()).toMatchObject({
    total: 3,
    players: 2,
  });
});
