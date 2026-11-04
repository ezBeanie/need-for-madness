import { expect, test } from "vitest";
import { RACE_KIND, game, raceSetup } from "../src/core/state.js";
import { carStats } from "../src/data/carStats.js";
import {
  arrowNameOf,
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

test("a room's race names each car after its player, or Player n and Bot n, and paints it", () => {
  game.carTypes[0] = 5;
  game.carTypes[1] = 3;
  game.carTypes[2] = 3;
  game.carTypes[3] = 7;
  setRoomCars(["Jan", "", null, null], [0, RED, BLUE, 99]);
  raceSetup.kind = RACE_KIND.together;
  expect([0, 1, 2, 3].map(nameOfCar)).toEqual([
    "Jan",
    "Player 2",
    "Bot 1",
    "Bot 2",
  ]);
  // (a skin no game knows is the standard)
  expect([0, 1, 2, 3].map(skinOf)).toEqual([0, RED, BLUE, 0]);
  // another race: the cars' own names and paint
  raceSetup.kind = RACE_KIND.quickRace;
  expect(nameOfCar(1)).toBe(carStats.names[3]);
  expect(skinOf(1)).toBe(0);
});

test("the arrow names a player's car after the player, and a bot's after its car", () => {
  game.carTypes[0] = 5;
  game.carTypes[1] = 3;
  game.carTypes[2] = 7;
  setRoomCars(["Jan", "", null], [0, 0, 0]);
  raceSetup.kind = RACE_KIND.together;
  expect([0, 1, 2].map(arrowNameOf)).toEqual([
    "Jan",
    "Player 2",
    carStats.names[7],
  ]);
  raceSetup.kind = RACE_KIND.quickRace;
  expect(arrowNameOf(0)).toBe(carStats.names[5]);
});

test("a name is cut short and has no control characters or runs of spaces", () => {
  expect(cleanName("  Ja\u0000n ‮  der   Erste und Einzige  ")).toBe(
    "Ja n der Erste u",
  );
  expect(cleanName(42)).toBe("");
});
