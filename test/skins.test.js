import { expect, test } from "vitest";
import { RACE_KIND, game, raceSetup } from "../src/core/state.js";
import { carStats } from "../src/data/carStats.js";
import {
  botNames,
  cleanName,
  nameOfCar,
  setRoomCars,
  skinOf,
} from "../src/net/roomCars.js";
import { hsbToRgb, rgbToHsb } from "../src/classic/color.js";
import { SKINS, isSkin, paint } from "../src/render/skins.js";

const RED = SKINS.indexOf("Red");
const BLUE = SKINS.indexOf("Blue");
const BLACK = SKINS.indexOf("Black");

test("a skin paints a car's colours, but its greys, and the standard paints nothing", () => {
  const orange = [230, 120, 30];
  expect(paint(...orange, 0)).toEqual(orange);
  const [hue, saturation, brightness] = rgbToHsb(...paint(...orange, BLUE));
  expect(hue).toBeCloseTo(0.6, 1);
  // (the paint's shading stays)
  expect(saturation).toBeCloseTo(rgbToHsb(...orange)[1], 1);
  expect(brightness).toBeCloseTo(rgbToHsb(...orange)[2], 1);
  const black = paint(...orange, BLACK);
  expect(rgbToHsb(...black)[1]).toBe(0);
  // tyres, grilles and chrome keep their colour
  for (const grey of [
    [40, 40, 40],
    [200, 200, 205],
  ]) {
    expect(paint(...grey, RED)).toEqual(grey);
  }
});

test("the first paints keep their numbers and colours, stored and sent as before", () => {
  expect(SKINS.slice(0, 9)).toEqual([
    "Standard",
    "Red",
    "Orange",
    "Yellow",
    "Green",
    "Blue",
    "Purple",
    "Black",
    "White",
  ]);
  // (as they were painted before there were more)
  const hues = [null, 0, 0.07, 0.15, 0.33, 0.6, 0.78];
  for (const colour of [
    [230, 120, 30],
    [20, 90, 200],
    [120, 40, 60],
  ]) {
    const [, saturation, brightness] = rgbToHsb(...colour);
    for (let skin = 1; skin < hues.length; skin++) {
      expect(paint(...colour, skin)).toEqual(
        hsbToRgb(hues[skin], saturation, brightness),
      );
    }
    expect(paint(...colour, 7)).toEqual(hsbToRgb(0, 0, brightness * 0.3));
    expect(paint(...colour, 8)).toEqual(hsbToRgb(0, 0, 0.6 + brightness * 0.4));
  }
});

test("there are twice the paints, each telling a car apart from the others", () => {
  expect(SKINS.length).toBe(18);
  expect(new Set(SKINS).size).toBe(SKINS.length);
  expect(isSkin(SKINS.length - 1)).toBe(true);
  expect(isSkin(SKINS.length)).toBe(false);
  // (no two of them closer than the red and the orange there were: the standard paint is
  // the car's own, which may be either)
  const apart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (const colour of [
    [200, 60, 40],
    [60, 160, 60],
  ]) {
    const painted = SKINS.map((_, skin) => paint(...colour, skin));
    const least = apart(painted[1], painted[2]);
    for (let a = 1; a < painted.length; a++) {
      for (let b = a + 1; b < painted.length; b++) {
        expect(
          apart(painted[a], painted[b]),
          `${SKINS[a]}, ${SKINS[b]}`,
        ).toBeGreaterThanOrEqual(least);
      }
    }
  }
});

test("a room's race names each car after its player, Player n or its bot, and paints it", () => {
  game.carTypes[0] = 5;
  game.carTypes[1] = 3;
  game.carTypes[2] = 3;
  game.carTypes[3] = 7;
  game.carTypes[4] = 3;
  setRoomCars(["Jan", "", null, null, null], [0, RED, BLUE, 99, 0]);
  raceSetup.kind = RACE_KIND.together;
  // (only the bots count: car 1 shares the car with two)
  expect([0, 1, 2, 3, 4].map(nameOfCar)).toEqual([
    "Jan",
    "Player 2",
    `${carStats.names[3]} 1`,
    carStats.names[7],
    `${carStats.names[3]} 2`,
  ]);
  // (a skin no game knows is the standard)
  expect([0, 1, 2, 3].map(skinOf)).toEqual([0, RED, BLUE, 0]);
  // another race: the cars' own names and paint
  raceSetup.kind = RACE_KIND.quickRace;
  expect(nameOfCar(1)).toBe(carStats.names[3]);
  expect(nameOfCar(2)).toBe(carStats.names[3]);
  expect(skinOf(1)).toBe(0);
});

test("bots are named after their cars, numbered in their order where they share one", () => {
  const [a, b, c] = carStats.names;
  expect(botNames([0, 1, 0, 2, 0])).toEqual([
    `${a} 1`,
    b,
    `${a} 2`,
    c,
    `${a} 3`,
  ]);
  expect(botNames([])).toEqual([]);
});

test("a name is cut short and has no control characters or runs of spaces", () => {
  expect(cleanName("  Ja\u0000n ‮  der   Erste und Einzige  ")).toBe(
    "Ja n der Erste u",
  );
  expect(cleanName(42)).toBe("");
});
