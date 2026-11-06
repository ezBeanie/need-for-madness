import { afterEach, expect, test } from "vitest";
import { loadGame } from "./harness/loadGame.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete globalThis.location;
});

test("back in the foreground in the main menu a newer version starts at once, not in a race, a room or the options", async () => {
  const { ctx } = await loadGame({ seed: 1 });
  let served = "a";
  let reloads = 0;
  globalThis.fetch = async () => ({ json: async () => ({ version: served }) });
  globalThis.location = { reload: () => reloads++ };
  const startsAnew = async () => {
    const before = reloads;
    await ctx.startNewest();
    return reloads > before;
  };
  ctx.offline.version = "a";
  ctx.game.phase = ctx.PHASE.mainMenu;
  // the same version: nothing
  expect(await startsAnew()).toBe(false);
  served = "b";
  expect(await startsAnew()).toBe(true);
  ctx.game.phase = ctx.PHASE.race;
  expect(await startsAnew()).toBe(false);
  ctx.game.phase = ctx.PHASE.mainMenu;
  ctx.link.open = true;
  expect(await startsAnew()).toBe(false);
  ctx.link.open = false;
  document.getElementById("options").open = true;
  expect(await startsAnew()).toBe(false);
  document.getElementById("options").open = false;
  // without a service worker the version is not known: nothing
  ctx.offline.version = null;
  expect(await startsAnew()).toBe(false);
  // without the network the version playing goes on
  ctx.offline.version = "a";
  globalThis.fetch = async () => {
    throw new TypeError("offline");
  };
  expect(await startsAnew()).toBe(false);
});
