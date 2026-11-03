// The look of the game, switched at any time with L: modern (textures, smooth light and
// fog) or classic, the look of the original Java game's own software renderer: faces in
// one colour each lit from straight above, black outlines, fog in steps, few pixels.
// The classic look is the races' 3D world; the original's menus and race HUD come with it
// only when asked for (U), the game's own being the default in both looks.
import { RACE_PHASES, game } from "../core/state.js";
import { loadSetting, saveSetting } from "../core/storage.js";

export const LOOK = { modern: 0, classic: 1 };

// sharp: the classic look in the window's pixels instead of the original's 450 rows;
// menus: the classic look's menus and race HUD drawn as the original's
export const look = {
  current: LOOK.modern,
  sharp: false,
  menus: false,
};

export const loadLook = () => {
  look.current =
    loadSetting("look") == LOOK.classic ? LOOK.classic : LOOK.modern;
  look.sharp = loadSetting("classicSharp") == 1;
  look.menus = loadSetting("classicMenus") == 1;
};

// whether the menus and the race HUD are the original's
export const classicMenus = () => look.current == LOOK.classic && look.menus;

// whether the 3D canvas shows the classic look now: in races, and in the menus only when
// they are the original's
export const drawsClassic = () =>
  look.current == LOOK.classic &&
  (look.menus || RACE_PHASES.includes(game.phase));

export const toggleLook = () => {
  look.current = look.current == LOOK.classic ? LOOK.modern : LOOK.classic;
  saveSetting("look", look.current);
};

export const toggleSharp = () => {
  look.sharp = !look.sharp;
  saveSetting("classicSharp", look.sharp ? 1 : 0);
};

export const toggleClassicMenus = () => {
  look.menus = !look.menus;
  saveSetting("classicMenus", look.menus ? 1 : 0);
};
