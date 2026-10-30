import { expect, test } from "vitest";
import { acos, atan, cos, sin } from "../src/core/exactMath.js";

// how many doubles apart two numbers are
const bits = new DataView(new ArrayBuffer(8));
const ordered = (x) => {
  bits.setFloat64(0, x);
  const n = bits.getBigInt64(0);
  return n < 0n ? -(n & 0x7fffffffffffffffn) : n;
};
const ulps = (a, b) => {
  const d = ordered(a) - ordered(b);
  return Number(d < 0n ? -d : d);
};

// a fixed spread of inputs over the range the game uses (seeded, so the test is repeatable)
const inputs = (count, low, high) => {
  let a = 12345;
  return Array.from({ length: count }, () => {
    a = (Math.imul(a, 1103515245) + 12345) >>> 0;
    return low + ((high - low) * a) / 4294967296;
  });
};

const DEGREE = Math.PI / 180;

test("sin and cos are within an ulp or two of the engine's, over the game's angles", () => {
  for (const degrees of inputs(20000, -100000, 100000)) {
    const x = degrees * DEGREE;
    // (near a zero the absolute error is what counts)
    expect(Math.abs(sin(x) - Math.sin(x))).toBeLessThan(
      4e-16 + 2e-16 * Math.abs(x) * 1e-6,
    );
    expect(Math.abs(cos(x) - Math.cos(x))).toBeLessThan(
      4e-16 + 2e-16 * Math.abs(x) * 1e-6,
    );
  }
  for (const x of inputs(20000, -Math.PI / 4, Math.PI / 4)) {
    expect(ulps(sin(x), Math.sin(x))).toBeLessThanOrEqual(1);
    expect(ulps(cos(x), Math.cos(x))).toBeLessThanOrEqual(1);
  }
});

test("atan and acos are within an ulp of the engine's", () => {
  for (const x of [...inputs(20000, -50, 50), ...inputs(2000, -1e6, 1e6)]) {
    expect(ulps(atan(x), Math.atan(x))).toBeLessThanOrEqual(1);
  }
  for (const x of inputs(20000, -1, 1)) {
    expect(ulps(acos(x), Math.acos(x))).toBeLessThanOrEqual(1);
  }
});

// (beyond 1e8 radians sin and cos only take x modulo 2 pi: no angle of the game gets there)
test("the edges come out as the engine's", () => {
  for (const x of [
    0,
    -0,
    1,
    -1,
    0.5,
    -0.5,
    Math.PI / 4,
    Math.PI / 2,
    Math.PI,
    1e7,
  ]) {
    expect(sin(x)).toBeCloseTo(Math.sin(x), 15);
    expect(cos(x)).toBeCloseTo(Math.cos(x), 15);
  }
  expect(atan(Infinity)).toBe(Math.PI / 2);
  expect(atan(-Infinity)).toBe(-Math.PI / 2);
  expect(Object.is(atan(-0), -0)).toBe(true);
  expect(acos(1)).toBe(0);
  expect(acos(-1)).toBe(Math.PI);
  expect(acos(0)).toBe(Math.PI / 2);
  expect(acos(1.0000001)).toBeNaN();
  expect(sin(NaN)).toBeNaN();
  expect(cos(Infinity)).toBeNaN();
});
