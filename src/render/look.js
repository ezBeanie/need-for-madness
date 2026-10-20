// The look of the game, switched at any time with L: modern (textures, smooth light and
// fog) or classic, the look of the original Java game's own software renderer: faces in
// one colour each lit from straight above, black outlines, fog in steps, few pixels.
import { loadSetting, saveSetting } from "../core/storage.js";

export const LOOK = { modern: 0, classic: 1 };

export const look = { current: LOOK.modern };

export const loadLook = () => {
  look.current =
    loadSetting("look") == LOOK.classic ? LOOK.classic : LOOK.modern;
};

export const toggleLook = () => {
  look.current = look.current == LOOK.classic ? LOOK.modern : LOOK.classic;
  saveSetting("look", look.current);
};
