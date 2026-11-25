import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { openGame } from "./driver.js";
import { PHASE } from "../../src/core/state.js";

// what a page's race tape and field hold
const raced = (page) =>
  page.evaluate(() => {
    const s = window.gameState;
    return {
      length: s.raceTape.length,
      x: s.raceTape.cars.map((car) => car.x[100]),
      cars: s.game.carTypes.slice(0, s.game.carCount),
    };
  });

test("a replay saved from the viewer opens again from the main menu", async ({
  page,
  browser,
}, testInfo) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.settle();
  await page.evaluate(() => {
    const s = window.gameState;
    s.track.stage = 5;
    s.menu.redraw = true;
    s.game.phase = 3;
  });
  await game.advanceUntil(PHASE.stageSelect);
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    window.gameState.game.mode = 0;
    const { flashIntoRace } = await import("/src/race/countdown.js");
    flashIntoRace();
  });
  await game.advanceUntil(PHASE.race);
  await page.keyboard.down("ArrowUp");
  await game.advance(400);
  await page.keyboard.up("ArrowUp");
  const race = await raced(page);
  await page.evaluate((paused) => {
    const s = window.gameState;
    s.game.phase = paused;
    s.openReplay(s.VIEWER_FROM.pauseMenu, 0);
  }, PHASE.paused);
  await game.advance(5);
  // Save, the last of the nine buttons, once H shows the controls
  await game.tap("h");
  const download = page.waitForEvent("download");
  // (a row of nine along the bottom, 16 pixels in from the edges, 6 apart)
  const each = (1248 - 8 * 6) / 9;
  await page.mouse.move(16 + 8 * (each + 6) + each / 2, 686);
  await page.mouse.down();
  await game.advance(1);
  await page.mouse.up();
  await game.advance(1);
  const file = testInfo.outputPath("race.nfmreplay");
  await (await download).saveAs(file);

  const other = await browser.newPage();
  const game2 = await openGame(other, {
    storage: { carsel: "3", unlocked: "17" },
  });
  await game2.advanceUntil(PHASE.mainMenu);
  const chooser = other.waitForEvent("filechooser");
  await other.evaluate(async () =>
    (await import("/src/screens/replays.js")).chooseReplayFile(),
  );
  await (await chooser).setFiles(file);
  await game2.advanceUntil(PHASE.replay);
  expect(await raced(other)).toEqual(race);
  await game2.tap("Enter");
  await game2.advance(2);
  expect(await game2.phase()).toBe(PHASE.mainMenu);
  // the player's own car again
  expect(await other.evaluate(() => window.gameState.game.carTypes[0])).toBe(3);
});

// The way out shows from the start, the controls hidden, on a desktop as on a phone;
// beside Options, not on it, and big enough to touch.
test("the replay's exit button is always in sight", async ({
  browser,
  baseURL,
}) => {
  const exits = async (options) => {
    const context = await browser.newContext({ ...options, baseURL });
    const page = await context.newPage();
    const game = await openGame(page, {
      storage: { carsel: "5", unlocked: "17" },
    });
    await game.advanceUntil(PHASE.mainMenu);
    await game.settle();
    await page.evaluate(() => {
      const s = window.gameState;
      s.track.stage = 5;
      s.menu.redraw = true;
      s.game.phase = 3;
    });
    await game.advanceUntil(PHASE.stageSelect);
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      window.gameState.game.mode = 0;
      const { flashIntoRace } = await import("/src/race/countdown.js");
      flashIntoRace();
    });
    await game.advanceUntil(PHASE.race);
    await game.advance(200);
    await page.evaluate((paused) => {
      const s = window.gameState;
      s.game.phase = paused;
      s.openReplay(s.VIEWER_FROM.pauseMenu, 0);
    }, PHASE.paused);
    await game.advance(5);
    const exit = page.getByRole("button", { name: "Exit the replay" });
    await expect(exit).toBeVisible();
    await expect(exit).toHaveAttribute("aria-keyshortcuts", "Escape");
    const box = await exit.boundingBox();
    const gear = await page.locator("#optionsButton").boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThan(gear.x);
    expect(box.x).toBeGreaterThan(0);
    await exit.click();
    await game.advance(2);
    expect(await game.phase()).toBe(PHASE.paused);
    await expect(exit).toBeHidden();
    await context.close();
  };
  await exits({ viewport: { width: 1280, height: 720 } });
  await exits({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
});

// the header of a saved replay file: what it was raced in (see replayFile.js)
const headerOf = (file) => {
  const bytes = gunzipSync(readFileSync(file));
  const size = bytes.readUInt32BE(0);
  return JSON.parse(bytes.subarray(4, 4 + size).toString("utf8"));
};

test("the replay's camera path: keyframes set where the camera is, played back, and saved with the replay", async ({
  page,
}, testInfo) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.settle();
  await page.evaluate(() => {
    const s = window.gameState;
    s.track.stage = 5;
    s.menu.redraw = true;
    s.game.phase = 3;
  });
  await game.advanceUntil(PHASE.stageSelect);
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    window.gameState.game.mode = 0;
    const { flashIntoRace } = await import("/src/race/countdown.js");
    flashIntoRace();
  });
  await game.advanceUntil(PHASE.race);
  await page.keyboard.down("ArrowUp");
  await game.advance(300);
  await page.keyboard.up("ArrowUp");
  await page.evaluate((paused) => {
    const s = window.gameState;
    s.game.phase = paused;
    s.openReplay(s.VIEWER_FROM.pauseMenu, 0);
  }, PHASE.paused);
  await game.advance(5);
  // I opens the path beside the race
  await game.tap("i");
  const panel = page.getByRole("complementary", { name: "Camera path" });
  await expect(panel).toBeVisible();
  const add = panel.getByRole("button", { name: "Add keyframe here" });
  await expect(add).toBeFocused();
  // two free cameras, at frames 20 and 100
  const place = (frame, x) =>
    page.evaluate(
      async ([frame, x]) => {
        const { CAMERA, camera } = await import("/src/render/camera.js");
        const { seekReplay, viewer } = await import(
          "/src/race/replayViewer.js"
        );
        viewer.playing = false;
        seekReplay(frame);
        Object.assign(camera, { mode: CAMERA.free, x, y: 60, z: 0 });
      },
      [frame, x],
    );
  await place(20, 0);
  await add.click();
  await place(100, 200);
  await add.click();
  await expect(panel.getByRole("listitem")).toHaveCount(2);
  // the first flies on to the second
  await expect(
    panel.getByRole("button", { name: /^Fly on from / }),
  ).toHaveAttribute("aria-pressed", "true");
  // the wheel over the race zooms in
  const fov = () =>
    page.evaluate(
      async () => (await import("/src/render/camera.js")).camera.fov,
    );
  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, -500);
  await game.advance(2);
  expect(await fov()).toBeLessThan(55);
  // , and . jump between the keyframes (off the panel, the keys are the replay's)
  await page.evaluate(() => document.activeElement.blur());
  const frame = () =>
    page.evaluate(
      async () => (await import("/src/race/replayViewer.js")).viewer.frame,
    );
  await page.keyboard.press("Comma");
  await game.advance(2);
  expect(await frame()).toBe(20);
  await page.keyboard.press("Period");
  await game.advance(2);
  expect(await frame()).toBe(100);
  // played: the camera flies between them
  await panel.getByRole("button", { name: "Play the path" }).click();
  await expect(
    panel.getByRole("button", { name: "Play the path" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(async () => {
    const { seekReplay, viewer } = await import("/src/race/replayViewer.js");
    seekReplay(60);
    viewer.playing = false;
  });
  await game.advance(2);
  const x = await page.evaluate(
    async () => (await import("/src/render/camera.js")).camera.x,
  );
  expect(x).toBeGreaterThan(50);
  expect(x).toBeLessThan(150);
  // deleted from the list, then saved with the one left
  await panel
    .getByRole("button", { name: /^Delete / })
    .first()
    .click();
  await expect(panel.getByRole("listitem")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  // (the replay's keys are its own again: Ctrl+S saves)
  await page.keyboard.press("Control+s");
  await game.advance(2);
  const file = testInfo.outputPath("path.nfmreplay");
  await (await download).saveAs(file);
  const { cameraPath } = headerOf(file).race;
  expect(cameraPath).toHaveLength(1);
  expect(cameraPath[0]).toMatchObject({ frame: 100, x: 200 });
});

test("a replay records as a video from the camera path's first keyframe to its last, downloaded", async ({
  page,
}, testInfo) => {
  const game = await openGame(page, {
    storage: { carsel: "5", unlocked: "17" },
  });
  await game.advanceUntil(PHASE.mainMenu);
  await game.settle();
  await page.evaluate(() => {
    const s = window.gameState;
    s.track.stage = 5;
    s.menu.redraw = true;
    s.game.phase = 3;
  });
  await game.advanceUntil(PHASE.stageSelect);
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    window.gameState.game.mode = 0;
    const { flashIntoRace } = await import("/src/race/countdown.js");
    flashIntoRace();
  });
  await game.advanceUntil(PHASE.race);
  // (past the countdown, a race of 100 frames)
  await page.evaluate(() => (window.gameState.raceEvents.countdown = 0));
  await page.keyboard.down("ArrowUp");
  await game.advance(100);
  await page.keyboard.up("ArrowUp");
  await page.evaluate((paused) => {
    const s = window.gameState;
    s.game.phase = paused;
    s.openReplay(s.VIEWER_FROM.pauseMenu, 0);
  }, PHASE.paused);
  await game.advance(5);
  // a path of two keyframes, from frame 20 to frame 60
  await page.evaluate(async () => {
    const { CAMERA, camera } = await import("/src/render/camera.js");
    const { cameraPath } = await import("/src/race/cameraPath.js");
    const key = (frame, x) => ({
      frame,
      mode: CAMERA.free,
      target: 0,
      x,
      y: 80,
      z: camera.z,
      yaw: 0,
      pitch: 20,
      fov: 55,
      speed: 2,
      fly: true,
    });
    cameraPath.keys = [key(20, camera.x), key(60, camera.x + 100)];
  });
  await game.tap("i");
  const panel = page.getByRole("complementary", { name: "Camera path" });
  await expect(panel.locator("#cameraPathVideoHint")).toHaveText(
    "From the first keyframe to the last, as the path plays. Esc stops.",
  );
  const download = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Record video" }).click();
  await expect(panel).toBeHidden();
  const recording = () =>
    page.evaluate(
      async () => (await import("/src/render/video.js")).video.recording,
    );
  expect(await recording()).toBe(true);
  // played from the first keyframe, the video stops at the last
  expect(
    await page.evaluate(
      async () => (await import("/src/race/replayViewer.js")).viewer.frame,
    ),
  ).toBeLessThanOrEqual(21);
  for (let i = 0; i < 60 && (await recording()); i++) {
    await game.advance(2);
    await page.waitForTimeout(20);
  }
  expect(await recording()).toBe(false);
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^NFM-.*\.webm$/);
  const saved = testInfo.outputPath("replay.webm");
  await file.saveAs(saved);
  // a WebM file (EBML header), with frames in it
  const bytes = readFileSync(saved);
  expect(bytes.subarray(0, 4).toString("hex")).toBe("1a45dfa3");
  expect(bytes.length).toBeGreaterThan(2000);
  // (the replay goes on, its controls back)
  expect(await page.evaluate(() => window.gameState.game.phase)).toBe(
    PHASE.replay,
  );
});
