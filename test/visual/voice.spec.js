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

// Host and guest in a room of their own (also for a test run again beside itself), each with
// its settings (the tabs share their storage: each says its own).
const openRoom = async (context, room, settings) => {
  const games = [];
  for (const [i, url] of [`/?host=${room}`, `/?join=${room}`].entries()) {
    const page = await context.newPage();
    // (the tests keep the game silent; the voices need Web Audio, see src/net/voice.js)
    await page.addInitScript(() => {
      window.keptAudioContext = window.AudioContext;
    });
    const game = await openGame(page, {
      storage: { carsel: "5", ...settings[i] },
      url,
    });
    await page.evaluate(() => {
      window.AudioContext = window.keptAudioContext;
    });
    await game.advanceUntil(PHASE.mainMenu);
    games.push({ game, page });
  }
  return games;
};

const connected = async (games) =>
  expect
    .poll(
      async () => {
        await advanceBoth(games, 5);
        const states = [];
        for (const { page } of games) {
          const { state, heard } = await voiceOf(page);
          states.push(`${state} ${heard}`);
        }
        return states;
      },
      { timeout: 60_000 },
    )
    .toEqual(["connected true", "connected true"]);

const hostHearsGuest = (games) =>
  expect.poll(
    async () => {
      await advanceBoth(games, 2);
      return (await voiceOf(games[0].page)).talking;
    },
    { timeout: 15_000 },
  );

test("two games of a room hear each other while one holds its talk key, and not otherwise", async ({
  context,
}, testInfo) => {
  // (the voice chat is off until switched on: the guest's still is)
  const games = await openRoom(context, `voice-${testInfo.repeatEachIndex}`, [
    { voiceChat: "1", voiceByVoice: "0" },
    { voiceChat: "0", voiceByVoice: "0" },
  ]);
  const [host, guest] = games;
  await advanceBoth(games, 40);
  expect((await voiceOf(guest.page)).peers).toBe(0);
  expect((await voiceOf(host.page)).state).not.toBe("connected");
  // switched on later, the host's offer, ignored before, is made anew
  await guest.page.evaluate(() => window.gameState.toggleVoice());
  await expect
    .poll(
      async () => {
        await advanceBoth(games, 5);
        return [await voiceOf(host.page), await voiceOf(guest.page)].map(
          ({ state, heard }) => `${state} ${heard}`,
        );
      },
      { timeout: 60_000 },
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
  // (the key let go where the game does not hear it: leaving the window lets go of it)
  await guest.page.evaluate(() => window.dispatchEvent(new Event("blur")));
  expect(await guest.page.evaluate(() => window.gameState.voice.talking)).toBe(
    false,
  );
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

// (the test's microphone beeps now and then: it speaks by itself)
test("by voice a player is heard whenever the microphone hears it, without a key", async ({
  context,
}, testInfo) => {
  const games = await openRoom(
    context,
    `by-voice-${testInfo.repeatEachIndex}`,
    [
      { voiceChat: "1", voiceByVoice: "0" },
      { voiceChat: "1", voiceByVoice: "1" },
    ],
  );
  const [, guest] = games;
  await connected(games);
  await hostHearsGuest(games).toBe(true);
  // back to push to talk: silent again until the key
  await guest.page.evaluate(() => window.gameState.toggleByVoice());
  await hostHearsGuest(games).toBe(false);
  await advanceBoth(games, 30);
  expect((await voiceOf(games[0].page)).talking).toBe(false);
});
