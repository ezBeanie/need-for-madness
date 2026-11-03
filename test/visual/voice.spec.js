import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// (a microphone that beeps, allowed without asking)
test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

// Ticks of both games, with time between for their connection to be set up.
const advanceBoth = async (games, ticks) => {
  for (let tick = 0; tick < ticks; tick++) {
    for (const { game, page } of games) {
      await game.advance();
      await page.waitForTimeout(20);
    }
  }
};

const voiceOf = (page) =>
  page.evaluate(() => {
    const { voice, link, isTalking } = window.gameState;
    const [id, peer] = [...voice.peers][0] ?? [];
    return {
      id: link.id,
      peers: voice.peers.size,
      state: peer?.connection.connectionState,
      heard: Boolean(peer?.source),
      talking: id ? isTalking(id) : false,
    };
  });

test("two games of a room hear each other while one holds its talk key, and not otherwise", async ({
  context,
}) => {
  const games = [];
  for (const url of ["/?host=voice", "/?join=voice"]) {
    const page = await context.newPage();
    // (the tests keep the game silent; the voices need Web Audio, see src/net/voice.js)
    await page.addInitScript(() => {
      window.keptAudioContext = window.AudioContext;
    });
    const game = await openGame(page, { storage: { carsel: "5" }, url });
    await page.evaluate(() => {
      window.AudioContext = window.keptAudioContext;
    });
    await game.advanceUntil(PHASE.mainMenu);
    games.push({ game, page });
  }
  const [host, guest] = games;
  await expect
    .poll(
      async () => {
        await advanceBoth(games, 5);
        return [await voiceOf(host.page), await voiceOf(guest.page)].map(
          ({ state, heard }) => `${state} ${heard}`,
        );
      },
      { timeout: 30_000 },
    )
    .toEqual(["connected true", "connected true"]);
  // silent until the guest talks
  await advanceBoth(games, 5);
  expect((await voiceOf(host.page)).talking).toBe(false);
  await guest.page.evaluate(() => window.gameState.talk(true));
  await expect
    .poll(
      async () => {
        await advanceBoth(games, 2);
        return (await voiceOf(host.page)).talking;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  await guest.page.evaluate(() => window.gameState.talk(false));
  await expect
    .poll(
      async () => {
        await advanceBoth(games, 2);
        return (await voiceOf(host.page)).talking;
      },
      { timeout: 15_000 },
    )
    .toBe(false);
  // switched off, the voices are gone
  await host.page.evaluate(() => window.gameState.toggleVoice());
  await advanceBoth(games, 2);
  expect((await voiceOf(host.page)).peers).toBe(0);
  await host.page.evaluate(() => window.gameState.toggleVoice());
});
