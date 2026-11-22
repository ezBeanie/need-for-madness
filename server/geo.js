// The country of an address, offline: DB-IP's "IP to Country Lite" database (CC BY 4.0,
// https://db-ip.com), a CSV of ranges "first,last,country", gzipped or not, read once. No
// address leaves the server for it. Without the file every country is null.

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const ipv4 = (address) => {
  const parts = address.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  return parts
    ? parts.slice(1).reduce((value, part) => value * 256 + Number(part), 0)
    : null;
};

// (the first 64 bits: providers hand out no smaller networks, the ranges end on them)
const ipv6 = (address) => {
  const [head, tail] = address.split("::");
  const groups = head ? head.split(":") : [];
  if (tail != undefined) {
    const rest = tail ? tail.split(":") : [];
    groups.push(...Array(8 - groups.length - rest.length).fill("0"), ...rest);
  }
  if (groups.length != 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) {
    return null;
  }
  return groups
    .slice(0, 4)
    .reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
};

// The ranges of one kind of address, sorted: the last range starting at or below value.
const find = (starts, ends, countries, value) => {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (starts[middle] <= value) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return high >= 0 && value <= ends[high] ? countries[high] : null;
};

export const loadCountries = (file) => {
  let text;
  try {
    const bytes = readFileSync(file);
    text = (bytes[0] == 0x1f ? gunzipSync(bytes) : bytes).toString("utf8");
  } catch {
    return () => null;
  }
  const v4 = { starts: [], ends: [], countries: [] };
  const v6 = { starts: [], ends: [], countries: [] };
  for (const line of text.split("\n")) {
    const [first, last, country] = line.replaceAll('"', "").split(",");
    if (!country) {
      continue;
    }
    const code = country.trim();
    // (ZZ: reserved and private networks, a country of none)
    if (code == "ZZ") {
      continue;
    }
    if (first.includes(":")) {
      const start = ipv6(first);
      const end = ipv6(last);
      if (start !== null && end !== null) {
        v6.starts.push(start);
        v6.ends.push(end);
        v6.countries.push(code);
      }
    } else {
      const start = ipv4(first);
      const end = ipv4(last);
      if (start !== null && end !== null) {
        v4.starts.push(start);
        v4.ends.push(end);
        v4.countries.push(code);
      }
    }
  }
  return (address = "") => {
    // (an IPv4 address as IPv6 sockets see it: ::ffff:1.2.3.4)
    const plain = address.replace(/^::ffff:/i, "");
    const value4 = ipv4(plain);
    if (value4 !== null) {
      return find(v4.starts, v4.ends, v4.countries, value4);
    }
    const value6 = ipv6(plain);
    return value6 === null
      ? null
      : find(v6.starts, v6.ends, v6.countries, value6);
  };
};
