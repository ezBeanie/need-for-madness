import { expect, test } from "@playwright/test";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// Web Audio kept (the driver takes it away so the tests stay silent, see driver.js), and
// what the game plays watched: the audio elements it plays, its contexts, and the long
// sounds (the music) it starts and stops.
const watchAudio = () => {
  window.played = { elements: 0, music: 0, stopped: 0, contexts: [] };
  const Kept = window.AudioContext;
  class Watched extends Kept {
    constructor() {
      super();
      window.played.contexts.push(this);
    }
  }
  Object.defineProperty(window, "AudioContext", {
    value: Watched,
    writable: true,
    configurable: false,
  });
  const { play } = HTMLMediaElement.prototype;
  HTMLMediaElement.prototype.play = function (...args) {
    window.played.elements++;
    return play.apply(this, args);
  };
  const { start, stop } = AudioBufferSourceNode.prototype;
  AudioBufferSourceNode.prototype.start = function (...args) {
    if (this.buffer?.duration > 20) {
      window.played.music++;
      this.isMusic = true;
    }
    return start.apply(this, args);
  };
  AudioBufferSourceNode.prototype.stop = function (...args) {
    if (this.isMusic) {
      window.played.stopped++;
    }
    return stop.apply(this, args);
  };
};

const played = (page) =>
  page.evaluate(() => ({
    ...window.played,
    contexts: window.played.contexts.map((context) => context.state),
  }));

const showPage = (page, visibility) =>
  page.evaluate((state) => {
    Object.defineProperty(document, "visibilityState", {
      value: state,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, visibility);

test("music: the modern look's music plays on Web Audio, never as an audio element, and stops while the game is left", async ({
  page,
}) => {
  await page.addInitScript(watchAudio);
  const game = await openGame(page, { storage: { look: "0" } });
  await game.advanceUntil(PHASE.mainMenu);
  // (a click allows audio)
  await page.mouse.click(5, 5);
  await expect
    .poll(
      async () => {
        await game.advance();
        return (await played(page)).music;
      },
      { timeout: 20_000 },
    )
    .toBe(1);
  expect((await played(page)).elements).toBe(0);
  await showPage(page, "hidden");
  await expect
    .poll(async () => (await played(page)).contexts)
    .toEqual(["suspended", "suspended"]);
  expect((await played(page)).stopped).toBe(1);
  // back: played on
  await showPage(page, "visible");
  await game.advance(2);
  await expect
    .poll(async () => (await played(page)).contexts)
    .toEqual(["running", "running"]);
  expect((await played(page)).music).toBe(2);
  expect((await played(page)).elements).toBe(0);
});
