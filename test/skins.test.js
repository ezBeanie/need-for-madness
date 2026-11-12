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
import { rgbToHsb } from "../src/classic/color.js";
import { SKINS, paint } from "../src/render/skins.js";

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
