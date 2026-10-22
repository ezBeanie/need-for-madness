// The look of the game, switched at any time with L: modern (textures, smooth light and
// fog) or classic, the look of the original Java game's own software renderer: faces in
// one colour each lit from straight above, black outlines, fog in steps, few pixels.
import { loadSetting, saveSetting } from "../core/storage.js";

export const LOOK = { modern: 0, classic: 1 };

// sharp: the classic look in the window's pixels instead of the original's 450 rows
export const look = { current: LOOK.modern, sharp: false };

export const loadLook = () => {
  look.current =
    loadSetting("look") == LOOK.classic ? LOOK.classic : LOOK.modern;
  look.sharp = loadSetting("classicSharp") == 1;
};

export const toggleLook = () => {
  look.current = look.current == LOOK.classic ? LOOK.modern : LOOK.classic;
  saveSetting("look", look.current);
};

export const toggleSharp = () => {
  look.sharp = !look.sharp;
  saveSetting("classicSharp", look.sharp ? 1 : 0);
};
