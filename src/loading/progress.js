import { isPhone } from "../core/platform.js";

// How far loading the game data is (see loaddata).
export const loading = {
  // which batch of files is requested next
  step: 0,
  // loaded so far and in all, in the loading bar's units (fewer files on phones)
  loaded: 500,
  total: isPhone ? 3770 : 3816,
  // 0 when the game loads, 2 when it loads again after a race or quitting (1 is unused)
};
