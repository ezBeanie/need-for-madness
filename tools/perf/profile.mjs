// Plays the race of measure.mjs with Chrome's CPU profiler on and lists the functions
// taking the most time (self time).
// usage: node tools/perf/profile.mjs http://localhost:5173 [seconds] [cars] [profile.json]
// With a file name it also saves the profile (Chrome's .cpuprofile format), with the time
// per source line.
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const [baseURL, secondsArg, carsArg, saveTo] = process.argv.slice(2);
const seconds = Number(secondsArg ?? 15);
const cars = carsArg ?? "20";

const browser = await chromium.launch({ args: ["--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript((count) => {
  localStorage.setItem("carsel", "17");
  localStorage.setItem("unlocked", "16");
  localStorage.setItem("racecars", count);
}, cars);
await page.goto(baseURL);
const phase = () =>
  page.evaluate(async () => (await import("/src/core/state.js")).game.phase);
const stage = () =>
  page.evaluate(async () => (await import("/src/race/track.js")).track.stage);
const waitFor = async (wanted) => {
  while ((await phase()) !== wanted) {
    await page.waitForTimeout(100);
  }
};
const tap = async (key) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(80);
  await page.keyboard.up(key);
};
await waitFor(1);
await page.waitForTimeout(1500);
await tap("Enter");
await waitFor(2);
await page.waitForTimeout(1500);
await tap("Enter");
await waitFor(4);
while ((await stage()) > 7) {
  await page.waitForTimeout(600);
  await tap("ArrowLeft");
  await page.waitForTimeout(400);
  await waitFor(4);
}
await page.waitForTimeout(1000);
await tap("Enter");
await waitFor(7);
await page.waitForTimeout(500);
await tap("Enter");
await page.keyboard.down("ArrowUp");

const cdp = await page.context().newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
await page.waitForTimeout(seconds * 1000);
const { profile } = await cdp.send("Profiler.stop");
await browser.close();
if (saveTo) {
  writeFileSync(saveTo, JSON.stringify(profile));
}

const selfTime = new Map();
const byId = new Map(profile.nodes.map((node) => [node.id, node]));
const intervals = profile.timeDeltas;
profile.samples.forEach((id, i) => {
  const { functionName, url, lineNumber } = byId.get(id).callFrame;
  const file = url.split("/src/")[1]?.split("?")[0] ?? url.split("/").pop();
  const name = `${functionName || "(anonymous)"} ${file}:${lineNumber + 1}`;
  selfTime.set(name, (selfTime.get(name) ?? 0) + (intervals[i] ?? 0) / 1000);
});
const total = [...selfTime.values()].reduce((a, b) => a + b, 0);
[...selfTime.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 18)
  .forEach(([name, ms]) =>
    console.log(
      `${((ms / total) * 100).toFixed(1).padStart(5)}%  ${ms.toFixed(0).padStart(6)} ms  ${name}`,
    ),
  );
