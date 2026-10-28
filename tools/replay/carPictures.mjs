// Takes a small picture of every car in each look, as the car select shows it (turned
// to show its front and side, cut out with what lies behind it): the replay viewer's
// list of cars shows them. Runs in Chromium against a dev server started with
// EXPOSE_GAME_STATE=1; the frames advance only when this says so.
// usage: EXPOSE_GAME_STATE=1 npx vite --port 5195 &
//        node tools/replay/carPictures.mjs http://localhost:5195
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [baseURL] = process.argv.slice(2);
const CARS = 19;
const TICK_MS = 35;
// the car's turn (the showcase's spin, before the tick that adds 5) and where it stands,
// in each look's car select at 1280 x 720
const SPIN = 215;
const LOOKS = {
  modern: { look: "0", clip: { x: 390, y: 400, width: 500, height: 300 } },
  classic: { look: "1", clip: { x: 380, y: 240, width: 440, height: 264 } },
};

const browser = await chromium.launch();
for (const [name, { look, clip }] of Object.entries(LOOKS)) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  await page.addInitScript((look) => {
    localStorage.setItem("look", look);
    localStorage.setItem("unlocked", "17");
    const callbacks = [];
    let now = 0;
    window.requestAnimationFrame = (callback) => callbacks.push(callback);
    window.advanceFrames = (count) => {
      for (let i = 0; i < count; i++) {
        now += 35;
        callbacks.splice(0).forEach((callback) => callback(now));
      }
    };
  }, look);
  await page.goto(baseURL);
  const advanceUntil = async (done) => {
    while (!(await page.evaluate(done))) {
      await page.evaluate(() => window.advanceFrames(1));
      await page.waitForTimeout(10);
    }
  };
  await page.waitForFunction(() => window.advanceFrames);
  await page.evaluate(async () => {
    window.gameState = (await import("/src/game.js")).__state;
    window.showcase = (await import("/src/screens/showcase.js")).showcase;
  });
  await advanceUntil(() => window.gameState.game.phase == 1);
  await page.keyboard.down("Enter");
  await page.evaluate(() => window.advanceFrames(1));
  await page.keyboard.up("Enter");
  await advanceUntil(() => window.gameState.game.phase == 2);
  // landed, and every picture the menus need there
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => window.advanceFrames(5));
    await page.waitForTimeout(TICK_MS * 5);
  }
  mkdirSync(`public/data/cars/${name}`, { recursive: true });
  for (let type = 0; type < CARS; type++) {
    await page.evaluate(
      ({ type, spin }) => {
        window.gameState.game.carTypes[0] = type;
        window.showcase.spin = spin;
        // on the floor, resting there (the modern one bobs up and down)
        window.showcase.height = -21;
        window.showcase.bob = -30;
        window.gameState.menu.redraw = true;
        window.advanceFrames(1);
      },
      { type, spin: SPIN },
    );
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `public/data/cars/${name}/car${type}.jpg`,
      clip,
      type: "jpeg",
      quality: 80,
    });
    console.log(`${name} car${type}`);
  }
  await page.close();
}
await browser.close();
