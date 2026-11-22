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

// a server taking visits, and posting one to it from address (as nginx says it)
const visitsServer = async (visits) => {
  server = createServer(visits.answer);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return (body, address = "89.12.34.56") =>
    fetch(`http://127.0.0.1:${port}/net/visit`, {
      method: "POST",
      headers: { "X-Real-IP": address },
      body: typeof body == "string" ? body : JSON.stringify(body),
    }).then((response) => response.status);
};

const VISIT = { version: "1.3.3", device: "phone", installed: true };

test("a game opened is kept by its network and country only, once within ten minutes, and summed up", async () => {
  const file = join(mkdtempSync(join(tmpdir(), "nfm-visits-")), "v.json");
  const visits = keepVisits(file, (address) =>
    address.startsWith("89.") ? "DE" : null,
  );
  const post = await visitsServer(visits);
  expect(await post(VISIT)).toBe(204);
  expect(await post(VISIT)).toBe(204);
  expect(
    await post({ ...VISIT, device: "desktop", installed: false }, "1.0.0.7"),
  ).toBe(204);
  expect(await post({ ...VISIT, device: "fridge" })).toBe(400);
  expect(await post({ ...VISIT, version: "<b>" })).toBe(400);
  expect(await post("not json")).toBe(400);
  const summary = visits.summary();
  expect(summary.total).toBe(2);
  expect(summary.byCountry).toEqual([
    ["DE", 1],
    ["?", 1],
  ]);
  expect(summary.byDevice).toEqual([
    ["phone (app)", 1],
    ["desktop", 1],
  ]);
  expect(summary.latest[1]).toMatchObject({
    network: "89.12.x.x",
    country: "DE",
    device: "phone",
    installed: true,
    version: "1.3.3",
  });
  expect(JSON.stringify(summary)).not.toContain("89.12.34.56");
  // (a new relay knows them)
  expect(keepVisits(file, () => null).summary().total).toBe(2);
});
