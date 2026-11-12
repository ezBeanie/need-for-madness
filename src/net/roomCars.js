// Who drives each car of a room's race and in which paint: the players' names, chosen in
// the options, and the skins chosen in the lobby. Every game of the race gets them with its
// start (see host.js and guest.js); other races have none.

import { RACE_KIND, game, raceSetup } from "../core/state.js";
import { carStats } from "../data/carStats.js";
import { loadSetting, loadText, saveSetting } from "../core/storage.js";
import { isSkin } from "../render/skins.js";

export const MOST_NAME_CHARACTERS = 16;

// names: by car, the player's name, "" for one without and null for a bot; skins: by car
export const roomCars = { names: [], skins: [] };

// (control characters and runs of spaces could garble the lists and the name tags)
export const cleanName = (text) =>
  typeof text == "string"
    ? text
        .replace(/[\p{Cc}\p{Cf}]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MOST_NAME_CHARACTERS)
    : "";

// the name this game's player goes by in rooms, and the skin of its car there
export const own = {
  name: cleanName(loadText("playerName")),
  skin: isSkin(loadSetting("carSkin")) ? loadSetting("carSkin") : 0,
};

export const setOwnName = (text) => {
  own.name = cleanName(text);
  saveSetting("playerName", own.name);
};

export const setOwnSkin = (skin) => {
  if (isSkin(skin)) {
    own.skin = skin;
    saveSetting("carSkin", skin);
  }
};

// (a host's race with guests, from the lobby or not, or the lobby's with bots alone; the
// cars are told with its start, and forgotten back in the menus, see forgetRoomCars)
export const inRoomRace = () =>
  roomCars.names.length > 0 &&
  (game.humans.length > 0 || raceSetup.kind == RACE_KIND.together);

// Back in the menus: the next race may be no room's.
export const forgetRoomCars = () => setRoomCars([], []);

export const setRoomCars = (names, skins) => {
  roomCars.names = Array.isArray(names)
    ? names.map((name) => (name === null ? null : cleanName(name)))
    : [];
  roomCars.skins = Array.isArray(skins)
    ? skins.map((skin) => (isSkin(skin) ? skin : 0))
    : [];
};

// the skin car c races in
export const skinOf = (c) => (inRoomRace() ? (roomCars.skins[c] ?? 0) : 0);

// What a room's bots, by their cars, are called: after their cars, and where bots share a
// car numbered in their order ("Radical One 1", "Radical One 2"). The lobby and every game
// of the race know the same cars in the same order, so all show the same names.
export const botNames = (carTypes) =>
  carTypes.map((type, i) => {
    const sharing = carTypes.filter((other) => other == type).length;
    const nth = carTypes
      .slice(0, i + 1)
      .filter((other) => other == type).length;
    return sharing > 1
      ? `${carStats.names[type]} ${nth}`
      : carStats.names[type];
  });

// What car c is called: in a room's race its player's name (or "Player n" when it has
// none) or its bot's, else its car's.
export const nameOfCar = (c) => {
  if (!inRoomRace() || c >= roomCars.names.length) {
    return carStats.names[game.carTypes[c]];
  }
  const name = roomCars.names[c];
  if (name === null) {
    const bots = roomCars.names
      .map((_, k) => k)
      .filter((k) => roomCars.names[k] === null);
    return botNames(bots.map((k) => game.carTypes[k]))[bots.indexOf(c)];
  }
  return name || `Player ${c + 1}`;
};
