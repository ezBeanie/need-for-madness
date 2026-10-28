// The look of the game, switched at any time with L: modern (textures, smooth light and
// fog) or classic, the look of the original Java game's own software renderer: faces in
// one colour each lit from straight above, black outlines, fog in steps, few pixels.
import { loadSetting, saveSetting } from "../core/storage.js";

export const LOOK = { modern: 0, classic: 1 };

// sharp: the classic look in the window's pixels instead of the original's 450 rows;
// depth: in the classic look a model's nearer polygons cover its farther ones, which the
// original's order of polygons by their middles at times got wrong (tyres, wheel arches)
export const look = { current: LOOK.modern, sharp: false, depth: true };

export const loadLook = () => {
  look.current =
    loadSetting("look") == LOOK.classic ? LOOK.classic : LOOK.modern;
  look.sharp = loadSetting("classicSharp") == 1;
  look.depth = loadSetting("classicDepth") != 0;
};

export const toggleLook = () => {
  look.current = look.current == LOOK.classic ? LOOK.modern : LOOK.classic;
  saveSetting("look", look.current);
};

export const toggleDepth = () => {
  look.depth = !look.depth;
  saveSetting("classicDepth", look.depth ? 1 : 0);
};

export const toggleSharp = () => {
  look.sharp = !look.sharp;
  saveSetting("classicSharp", look.sharp ? 1 : 0);
};
