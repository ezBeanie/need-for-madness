import { expect, test } from "vitest";
import { decode, encode } from "../src/net/link.js";

test("a message reaches the other game to the bit: -0, NaN, infinities and undefined in lists too", () => {
  const message = {
    zero: -0,
    numbers: [NaN, undefined, Infinity, -Infinity, 1.5, -0, 0],
    nested: { one: 1 },
    never: undefined,
    text: "$",
    tagLike: { $: "plain" },
  };
  const arrived = decode(encode(message));
  expect(Object.is(arrived.zero, -0)).toBe(true);
  expect(arrived.numbers).toHaveLength(7);
  expect(Object.is(arrived.numbers[0], NaN)).toBe(true);
  expect(arrived.numbers[1]).toBeUndefined();
  expect(arrived.numbers.slice(2, 5)).toEqual([Infinity, -Infinity, 1.5]);
  expect(Object.is(arrived.numbers[5], -0)).toBe(true);
  expect(Object.is(arrived.numbers[6], 0)).toBe(true);
  expect(arrived.nested).toEqual({ one: 1 });
  expect("never" in arrived).toBe(false);
  expect(arrived.text).toBe("$");
  expect(arrived.tagLike).toEqual({ $: "plain" });
});
