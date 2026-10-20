// Times the logic ticks of the race of measure.mjs (stage 7, 20 cars, Radical One, the
// player only accelerating, so most cars pile up after the start) in Node: the same ticks
// every run, so a change to the physics can be timed without the browser's noise.
// Prints the slowest ticks, the time per tick and where it goes (drive, AI, the rest).
import { test } from "vitest";
import { startRace } from "../../test/harness/race.js";

const TICKS = Number(process.env.TICKS ?? 600);
const RUNS = Number(process.env.RUNS ?? 5);

test("pile-up ticks", async () => {
  const results = [];
  for (let run = 0; run < RUNS; run++) {
    const { ctx, key } = await startRace({ stage: 7, car: 17, cars: 20 });
    key(38, true);
    const times = [];
    for (let i = 0; i < TICKS; i++) {
      const t = performance.now();
      ctx.runTick();
      times.push(performance.now() - t);
    }
    const sorted = [...times].sort((a, b) => a - b);
    const at = (q) => sorted[Math.floor(q * (sorted.length - 1))].toFixed(2);
    results.push({
      run,
      totalMs: times.reduce((a, b) => a + b, 0).toFixed(0),
      // the ticks of the pile-up after the start
      pileUpMs: times
        .slice(180, 260)
        .reduce((a, b) => a + b, 0)
        .toFixed(0),
      median: at(0.5),
      p95: at(0.95),
      p99: at(0.99),
      max: at(1),
      slowestTicks: times
        .map((ms, i) => [i, ms])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([i, ms]) => `${i}:${ms.toFixed(1)}`)
        .join(" "),
    });
  }
  console.table(results);
});
