// Plays a heavy race in Chromium and measures how smoothly it runs: stage 7, 20 cars,
// Radical One, the player only accelerating (most cars pile up right after the start).
// usage: node tools/perf/measure.mjs http://localhost:5173 [seconds] [cars] [--headed]
// Prints, as JSON, the work of each display frame (the game's logic ticks and drawing,
// without the GPU) against the budget of a 120 Hz display, the intervals between frames,
// and the long animation frames (Chrome's frames whose work took more than 50 ms).
import { chromium } from "@playwright/test";

const [baseURL, secondsArg, carsArg] = process.argv.slice(2);
const seconds = Number(secondsArg ?? 20);
const cars = carsArg ?? "20";
// a frame of a 120 Hz display
const BUDGET_MS = 8.3;
const headed = process.argv.includes("--headed");

const PHASE = { stageSelect: 4, race: 7, carSelect: 2, mainMenu: 1 };
const RADICAL_ONE = 17;

const browser = await chromium.launch({
  headless: !headed,
  // the Mac's GPU; without it headless Chromium draws WebGL on the CPU (SwiftShader)
  args: ["--use-angle=metal"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(
  ([car, count]) => {
    localStorage.setItem("carsel", String(car));
    localStorage.setItem("unlocked", "16");
    localStorage.setItem("racecars", count);
    // how long each animation frame callback (the game's frame) works
    window.frameWork = [];
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      request((time) => {
        const start = performance.now();
        callback(time);
        window.frameWork.push(performance.now() - start);
      });
  },
  [RADICAL_ONE, cars],
);
await page.goto(baseURL);
const phase = () =>
  page.evaluate(async () => (await import("/src/core/state.js")).game.phase);
const stage = () =>
  page.evaluate(async () => (await import("/src/race/track.js")).track.stage);
const waitFor = async (wanted, what) => {
  for (let i = 0; i < 600; i++) {
    if ((await phase()) === wanted) {
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`${what} not reached`);
};
const tap = async (key) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(80);
  await page.keyboard.up(key);
};

await waitFor(PHASE.mainMenu, "main menu");
await page.waitForTimeout(1500);
await tap("Enter");
await waitFor(PHASE.carSelect, "car select");
await page.waitForTimeout(1500);
await tap("Enter");
await waitFor(PHASE.stageSelect, "stage select");
while ((await stage()) > 7) {
  await page.waitForTimeout(600);
  await tap("ArrowLeft");
  await page.waitForTimeout(400);
  await waitFor(PHASE.stageSelect, "stage select");
}
await page.waitForTimeout(1000);
await tap("Enter");
await waitFor(PHASE.race, "race");
const renderer = await page.evaluate(() => {
  const gl = document.querySelector("#canvas3D").getContext("webgl");
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown";
});
// skip the countdown's flight, then only the gas
await page.waitForTimeout(500);
await tap("Enter");
await page.keyboard.down("ArrowUp");
const result = await page.evaluate(async (ms) => {
  const intervals = [];
  const longFrames = [];
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      longFrames.push(Math.round(entry.duration));
    }
  });
  try {
    observer.observe({ type: "long-animation-frame", buffered: false });
  } catch {
    // older browsers have no long animation frames
  }
  window.frameWork = [];
  await new Promise((done) => {
    let last = performance.now();
    const start = last;
    const frame = (now) => {
      intervals.push(now - last);
      last = now;
      if (now - start < ms) {
        requestAnimationFrame(frame);
      } else {
        done();
      }
    };
    requestAnimationFrame(frame);
  });
  observer.disconnect();
  return { intervals, longFrames, work: window.frameWork };
}, seconds * 1000);
await browser.close();

const sorted = [...result.intervals].sort((a, b) => a - b);
const at = (share) => sorted[Math.floor((sorted.length - 1) * share)];
const median = at(0.5);
const work = [...result.work].sort((a, b) => a - b);
const workAt = (share) =>
  +work[Math.floor((work.length - 1) * share)].toFixed(1);
console.log(
  JSON.stringify({
    renderer,
    cars,
    workMedianMs: workAt(0.5),
    workP95Ms: workAt(0.95),
    workP99Ms: workAt(0.99),
    workMaxMs: workAt(1),
    overBudget: work.filter((ms) => ms > BUDGET_MS).length,
    frames: sorted.length,
    medianMs: +median.toFixed(1),
    p95Ms: +at(0.95).toFixed(1),
    p99Ms: +at(0.99).toFixed(1),
    maxMs: +sorted[sorted.length - 1].toFixed(1),
    // frames that took more than twice as long as usual
    hitches: sorted.filter((ms) => ms > median * 2).length,
    longAnimationFrames: result.longFrames.length,
    longestAnimationFrameMs: Math.max(0, ...result.longFrames),
  }),
);
