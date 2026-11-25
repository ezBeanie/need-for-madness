// What a room's race shows beyond the original's HUD: who wasted whom (a feed at the right in
// the modern look, the message in the middle in the classic one), most kills' clock and
// leaders at the top, time attack's timing (alone too), and at the end every car's result
// in a table.

import { drawClassicMessage } from "../classic/hud.js";
import { RACE_MODE, game, raceSetup, racesRoom } from "../core/state.js";
import { TICK_MS, tick } from "../core/tick.js";
import { nameOfCar } from "../net/roomCars.js";
import {
  deathmatch,
  deathmatchLeft,
  isLapSession,
  killTable,
} from "../race/deathmatch.js";
import { fastestCar, lapTable, laps, timeIsUp } from "../race/lapTimes.js";
import {
  currentLapTicks,
  formatDelta,
  formatTime,
} from "../race/timeAttack.js";
import { racers } from "../race/racers.js";
import { track } from "../race/track.js";
import { classicMenus } from "../render/look.js";
import { t } from "../core/language.js";
import { rd, view } from "./view.js";
import { TEXT, drawCenteredText } from "./widgets.js";

// (say: how the words are told, the classic look's in English)
const PLACE_SUFFIX = ["st", "nd", "rd"];
export const placeName = (place, say = t) =>
  `${place + 1}${say(PLACE_SUFFIX[place] ?? "th")}`;

// m:ss
export const clockTime = (ticks) => {
  const seconds = Math.ceil((ticks * TICK_MS) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

// The car that wasted car c, or -1 (it crashed on its own, or was hit too long before).
export const wastedBy = (c) => {
  const { lastHitBy } = racers[c];
  return track.dested[c] == 2 && Number.isInteger(lastHitBy) && lastHitBy != c
    ? lastHitBy
    : -1;
};

// "Kool Kat wasted Anna", "You wasted Kool Kat", "Anna wasted you", "Kool Kat has been
// wasted"
export const wreckText = (by, c, say = t) => {
  if (by == -1) {
    return c == game.player
      ? say("You have been wasted")
      : say("{car} has been wasted", { car: nameOfCar(c) });
  }
  if (by == game.player) {
    return say("You wasted {car}", { car: nameOfCar(c) });
  }
  return c == game.player
    ? say("{car} wasted you", { car: nameOfCar(by) })
    : say("{by} wasted {car}", { by: nameOfCar(by), car: nameOfCar(c) });
};

// the feed's lines, newest last, each with the ticks it has left
const FEED_TICKS = Math.round(5000 / TICK_MS);
const FADE_TICKS = Math.round(1000 / TICK_MS);
const FEED_LINES = 5;
export const feed = [];

export const clearFeed = () => {
  feed.length = 0;
};

export const noteWreck = (by, c) => {
  feed.push({
    text: wreckText(by, c),
    mine: by == game.player || c == game.player,
    ticks: FEED_TICKS,
  });
  if (feed.length > FEED_LINES) {
    feed.shift();
  }
};

// A dark rounded bar behind a text.
const bar = (left, top, width, height, opacity = 0.55) => {
  rd.globalAlpha = opacity;
  rd.fillStyle = "#000000";
  rd.beginPath();
  rd.roundRect(left, top, width, height, height / 2);
  rd.fill();
  rd.globalAlpha = 1;
};

const font = (size) => {
  rd.letterSpacing = "1px";
  rd.font = `${Math.round(size * view.scale)}px junk`;
  rd.textBaseline = "middle";
};

// The feed at the right from top (under the buttons there) on, each line fading out at its
// end: as many of the newest lines as end above bottom (a touch control there).
export const drawFeed = (top, bottom) => {
  const once = tick.fraction >= tick.scale;
  for (const line of feed) {
    if (once) {
      line.ticks--;
    }
  }
  while (feed.length > 0 && feed[0].ticks <= 0) {
    feed.shift();
  }
  const s = view.scale;
  const height = 26 * s;
  const right = view.width - 16 * s;
  const fit = Math.floor((bottom - top + 6 * s) / (height + 6 * s));
  const shown = feed.slice(Math.max(0, feed.length - Math.max(0, fit)));
  rd.save();
  font(14);
  rd.textAlign = "right";
  for (const { text, mine, ticks } of shown) {
    rd.globalAlpha = 1;
    const width = rd.measureText(text).width + 28 * s;
    const fade = Math.min(1, ticks / FADE_TICKS);
    bar(right - width, top, width, height, 0.55 * fade);
    rd.globalAlpha = fade;
    rd.fillStyle = mine ? "#FFB401" : "#FFFFFF";
    rd.fillText(text, right - 14 * s, top + height / 2);
    top += height + 6 * s;
  }
  rd.restore();
};

// A race of a fixed time (most kills, stunts) at the left from top on (the middle is the original's, for its messages): the
// time left, under it the leaders (the player too, if not among them). Returns where what
// comes under it may start. In the classic look a line at the bottom, as the original would.
const LEADERS = 3;
export const drawDeathmatchBoard = (top) => {
  if (isLapSession()) {
    return classicMenus() ? top : drawLapBoard(top);
  }
  const table = killTable();
  if (classicMenus()) {
    const [lead] = table;
    const own = table.find(({ c }) => c == game.player);
    const scored = raceSetup.mode == RACE_MODE.stunts ? "points" : "kills";
    drawCenteredText(
      636,
      `Your ${scored} ${own?.score ?? 0}` +
        (lead?.score ? `   Leading: ${nameOfCar(lead.c)} ${lead.score}` : ""),
      0,
      0,
      0,
      TEXT.label,
    );
    drawCenteredText(670, clockTime(deathmatchLeft()), 0, 0, 0, TEXT.heading);
    return top;
  }
  const s = view.scale;
  const left = 20 * s;
  rd.save();
  const ticksLeft = deathmatchLeft();
  const clockWidth = 120 * s;
  const clockHeight = 40 * s;
  bar(left, top, clockWidth, clockHeight, 0.6);
  font(26);
  rd.textAlign = "center";
  // (the last ten seconds in red)
  rd.fillStyle = ticksLeft * TICK_MS <= 10000 ? "#FF5A3C" : "#FFFFFF";
  rd.fillText(
    clockTime(ticksLeft),
    left + clockWidth / 2,
    top + clockHeight / 2 + 1 * s,
  );
  const own = table.findIndex(({ c }) => c == game.player);
  const shown = table
    .map((row, place) => ({ ...row, place }))
    .filter(({ place }) => place < LEADERS || place == own);
  const rowWidth = 230 * s;
  const rowHeight = 22 * s;
  let rowTop = top + clockHeight + 6 * s;
  font(13);
  for (const { c, score, place } of shown) {
    bar(left, rowTop, rowWidth, rowHeight, 0.45);
    rd.fillStyle = c == game.player ? "#FFB401" : "#FFFFFF";
    rd.textAlign = "left";
    rd.fillText(
      `${place + 1}  ${c == game.player ? t("You") : nameOfCar(c)}`,
      left + 12 * s,
      rowTop + rowHeight / 2,
    );
    rd.textAlign = "right";
    rd.fillText(
      String(score),
      left + rowWidth - 12 * s,
      rowTop + rowHeight / 2,
    );
    rowTop += rowHeight + 3 * s;
  }
  rd.restore();
  return rowTop + 7 * s;
};

// The results at the end: a row per car (cells: place, name, then what it scored, under
// heads; mine: the player's; line: all of it in words), under the race's title. The classic
// look writes the lines, as its messages. More rows than ten go into two tables side by
// side (the lines into two columns), so that twenty cars end above the buttons under them.
const ROWS_IN_ONE = 10;

export const drawResults = (heads, rows) => {
  const tables = rows.length > ROWS_IN_ONE ? 2 : 1;
  const rowsEach = Math.ceil(rows.length / tables);
  if (classicMenus()) {
    rows.forEach(({ line }, i) => {
      const table = Math.floor(i / rowsEach);
      drawClassicMessage(
        200 + 32 * (i % rowsEach),
        line,
        0,
        0,
        0,
        view.width / 2 + (table - (tables - 1) / 2) * (view.width / 2.5),
      );
    });
    return;
  }
  const s = view.scale;
  const rowHeight = 30 * s;
  const top = 178 * view.scaleY;
  // each column as wide as its widest cell
  font(15);
  const pad = 22 * s;
  const widths = heads.map((head, column) =>
    Math.max(
      rd.measureText(head).width,
      ...rows.map(({ cells }) => rd.measureText(cells[column]).width),
    ),
  );
  const width =
    widths.reduce((sum, w) => sum + w, 0) + pad * (widths.length + 1);
  const gap = 16 * s;
  const drawTable = (left, part) => {
    rd.globalAlpha = 0.6;
    rd.fillStyle = "#000000";
    rd.beginPath();
    rd.roundRect(
      left,
      top,
      width,
      rowHeight * (part.length + 1) + 12 * s,
      14 * s,
    );
    rd.fill();
    rd.globalAlpha = 1;
    const drawRow = (cells, y, color) => {
      let x = left + pad;
      cells.forEach((cell, column) => {
        // (the name left, the numbers right)
        rd.textAlign = column == 1 ? "left" : "right";
        rd.fillStyle = color;
        rd.fillText(
          cell,
          column == 1 ? x : x + widths[column],
          y + rowHeight / 2,
        );
        x += widths[column] + pad;
      });
    };
    font(12);
    drawRow(heads, top + 6 * s, "#01EAFF");
    font(15);
    part.forEach(({ cells, mine }, i) =>
      drawRow(
        cells,
        top + 6 * s + rowHeight * (i + 1),
        mine ? "#FFB401" : "#FFFFFF",
      ),
    );
  };
  const left = view.width / 2 - (tables * width + (tables - 1) * gap) / 2;
  rd.save();
  for (let table = 0; table < tables; table++) {
    drawTable(
      left + table * (width + gap),
      rows.slice(table * rowsEach, (table + 1) * rowsEach),
    );
  }
  rd.restore();
};

// --- time attack's timing ---

// A checkpoint's colours: ahead of the best of all (alone: the stage's best lap), ahead of
// the next best (alone: the session's best lap; in a room: the car's own), behind both,
// and a lap that counts for nothing.
const PURPLE = [199, 125, 255];
const GREEN = [60, 220, 80];
const YELLOW = [255, 210, 60];
const RED = [255, 90, 60];
const WHITE = [255, 255, 255];
const hex = (rgb) =>
  `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;

// What a checkpoint passed tells (see Mark in race/lapTimes.js): the difference shown
// (alone to the car's own best, in a room to the session's fastest lap; null: none to tell
// against) and its colour.
export const markTold = (mark, alone) => {
  if (!mark.valid) {
    return { delta: null, color: RED };
  }
  const [best, next] = alone ? [mark.own, mark.field] : [mark.field, mark.own];
  const color =
    best !== null && best < 0
      ? PURPLE
      : next !== null && next < 0
        ? GREEN
        : best === null && next === null
          ? WHITE
          : YELLOW;
  return { delta: best ?? next, color };
};

// how long a checkpoint's times show
const MARK_TICKS = Math.round(3500 / TICK_MS);

// The player's last checkpoint, while it shows: "S2  0:23.456  -0.123", at the line the
// lap's time, a lap that counts for nothing so marked.
export const markText = (mark, alone, say = t) => {
  const { delta } = markTold(mark, alone);
  const what = mark.k == track.nsp - 1 ? say("Lap") : `S${mark.k + 1}`;
  return (
    `${what}  ${formatTime(mark.time)}` +
    (delta === null ? "" : `  ${formatDelta(delta)}`) +
    (mark.valid ? "" : `  ${say("(no time)")}`)
  );
};

const recentMark = (c) => {
  const mark = laps.marks[c];
  return mark && deathmatch.ticks - mark.at < MARK_TICKS ? mark : null;
};

// The colour of each sector car c drove on its lap so far, by the sector's own time against
// the same sector of the lap it is told against (see markTold).
const sectorColors = (c, alone) => {
  const splits = laps.splits[c];
  const fastest = fastestCar();
  const sector = (times, k) =>
    times.length == track.nsp ? times[k] - (k > 0 ? times[k - 1] : 0) : null;
  return splits.map((time, k) => {
    if (!laps.valid[c]) {
      return RED;
    }
    const own = time - (k > 0 ? splits[k - 1] : 0);
    const against = (times) => {
      const ref = sector(times, k);
      return ref === null ? null : own - ref;
    };
    const fieldTimes = fastest == -1 ? [] : laps.bestSplits[fastest];
    return markTold(
      {
        valid: true,
        own: against(alone ? laps.ownSplits[c] : laps.bestSplits[c]),
        field: against(alone ? laps.bestSplits[c] : fieldTimes),
      },
      alone,
    ).color;
  });
};

// Time attack's timing in the classic look: the lines of the original's messages.
const drawClassicLapClock = (alone, say) => {
  const p = game.player;
  const best = laps.best[p];
  const left = alone
    ? ""
    : timeIsUp()
      ? `   ${say("Last lap")}`
      : `   ${say("{time} left", { time: clockTime(deathmatchLeft()) })}`;
  drawCenteredText(
    636,
    (laps.warm[p]
      ? say("Warm-up lap")
      : say("Lap {lap}", { lap: laps.done[p] + 1 })) +
      (best > 0 ? say("   Best {time}", { time: formatTime(best) }) : "") +
      left,
    0,
    0,
    0,
    TEXT.label,
  );
  if (!laps.warm[p]) {
    const rgb = laps.valid[p] ? [0, 0, 0] : RED;
    drawCenteredText(670, formatTime(currentLapTicks()), ...rgb, TEXT.heading);
  }
};

// Time attack under the race (alone: a race alone), in a panel: the lap (or the warm-up
// lap) and the best lap; big the lap's time so far (red while it counts for nothing), for a
// while after a checkpoint with what it told, after the line the lap's time instead; a strip
// of the lap's sectors, each in its colour; and the last lap.
export const drawLapClock = (alone, say = t) => {
  if (classicMenus()) {
    drawClassicLapClock(alone, say);
    return;
  }
  const p = game.player;
  const s = view.scale;
  const width = 400 * s;
  const height = 116 * s;
  const left = (view.width - width) / 2;
  const top = view.height - height - 14 * s;
  const pad = 16 * s;
  rd.save();
  rd.globalAlpha = 0.6;
  rd.fillStyle = "#000000";
  rd.beginPath();
  rd.roundRect(left, top, width, height, 14 * s);
  rd.fill();
  rd.globalAlpha = 1;
  // the lap, and the best
  font(14);
  rd.textAlign = "left";
  rd.fillStyle = "#01EAFF";
  const warm = laps.warm[p];
  rd.fillText(
    warm ? t("Warm-up lap") : t("Lap {lap}", { lap: laps.done[p] + 1 }),
    left + pad,
    top + 18 * s,
  );
  const best = laps.best[p];
  const record = alone ? laps.ownBest[p] : best;
  rd.textAlign = "right";
  rd.fillStyle = "#FFFFFF";
  rd.fillText(
    record > 0
      ? t("Best {time}", { time: formatTime(record) })
      : t("No best lap yet"),
    left + width - pad,
    top + 18 * s,
  );
  // the time, big, and what the last checkpoint told
  const mark = recentMark(p);
  const atLine = mark && mark.k == track.nsp - 1;
  const middle = top + 52 * s;
  font(34);
  rd.textAlign = "center";
  if (warm) {
    font(20);
    rd.fillStyle = "rgba(255, 255, 255, 0.6)";
    rd.fillText(t("Timing starts at the line"), left + width / 2, middle);
  } else {
    const time = atLine ? mark.time : currentLapTicks();
    rd.fillStyle = atLine || laps.valid[p] ? "#FFFFFF" : hex(RED);
    rd.fillText(formatTime(time), left + width / 2 - 40 * s, middle);
  }
  if (mark && !warm) {
    const { delta, color } = markTold(mark, alone);
    font(20);
    rd.textAlign = "left";
    rd.fillStyle = hex(color);
    rd.fillText(
      mark.valid
        ? `${atLine ? t("Lap") : `S${mark.k + 1}`} ${
            delta === null ? "" : formatDelta(delta)
          }`
        : t("(no time)"),
      left + width / 2 + 62 * s,
      middle,
    );
  }
  // the sectors of the lap: driven in their colour, ahead grey
  const strip = top + 78 * s;
  const gap = 4 * s;
  const count = track.nsp;
  const each = (width - 2 * pad - gap * (count - 1)) / count;
  const colors = warm ? [] : sectorColors(p, alone);
  for (let k = 0; k < count; k++) {
    rd.fillStyle = colors[k] ? hex(colors[k]) : "rgba(255, 255, 255, 0.18)";
    rd.beginPath();
    rd.roundRect(left + pad + k * (each + gap), strip, each, 7 * s, 3 * s);
    rd.fill();
  }
  // the last lap
  font(13);
  rd.textAlign = "left";
  rd.fillStyle = laps.lastValid[p] ? "#FFFFFF" : hex(RED);
  if (laps.last[p] > 0) {
    rd.fillText(
      t("Last {time}", { time: formatTime(laps.last[p]) }) +
        (laps.lastValid[p] ? "" : ` ${t("(no time)")}`),
      left + pad,
      top + height - 14 * s,
    );
  }
  rd.restore();
};

// Time attack at the left from top on: the time left (once up: the last laps), and with
// others the cars by their fastest lap, the leader's time and the others' gap to it, each
// with what its last checkpoint told for a while. Returns where what comes under it may
// start.
const drawLapBoard = (top) => {
  // (alone, no time is up: no board)
  if (!racesRoom()) {
    return top;
  }
  const s = view.scale;
  const left = 20 * s;
  rd.save();
  font(26);
  const up = timeIsUp();
  const clock = up ? t("Last lap") : clockTime(deathmatchLeft());
  const clockWidth = Math.max(120 * s, rd.measureText(clock).width + 28 * s);
  const clockHeight = 40 * s;
  bar(left, top, clockWidth, clockHeight, 0.6);
  rd.textAlign = "center";
  rd.fillStyle =
    !up && deathmatchLeft() * TICK_MS <= 10000 ? "#FF5A3C" : "#FFFFFF";
  rd.fillText(clock, left + clockWidth / 2, top + clockHeight / 2 + 1 * s);
  let rowTop = top + clockHeight + 6 * s;
  if (game.carCount > 1) {
    const table = lapTable(game.carCount);
    const leader = table[0].best;
    const rowWidth = 290 * s;
    const rowHeight = 22 * s;
    font(13);
    table.forEach(({ c, best }, place) => {
      bar(left, rowTop, rowWidth, rowHeight, 0.45);
      const middle = rowTop + rowHeight / 2;
      rd.fillStyle = c == game.player ? "#FFB401" : "#FFFFFF";
      rd.textAlign = "left";
      rd.fillText(
        `${place + 1}  ${c == game.player ? t("You") : nameOfCar(c)}`,
        left + 12 * s,
        middle,
      );
      rd.textAlign = "right";
      rd.fillText(
        best == 0
          ? laps.warm[c]
            ? t("Warm-up")
            : "-"
          : place == 0
            ? formatTime(best)
            : formatDelta(best - leader),
        left + rowWidth - 12 * s,
        middle,
      );
      const mark = recentMark(c);
      const told = mark && markTold(mark, false);
      if (told?.delta !== null && told?.delta !== undefined) {
        rd.fillStyle = hex(told.color);
        rd.fillText(formatDelta(told.delta), left + rowWidth - 92 * s, middle);
      }
      rowTop += rowHeight + 3 * s;
    });
  }
  rd.restore();
  return rowTop + 7 * s;
};

// Time attack's results, a row per car: its fastest lap, its gap to the fastest, its laps.
export const LAP_HEADS = ["", "", "Best lap", "Gap", "Laps"];
export const lapRows = (say = t) => {
  const table = lapTable(game.carCount);
  const leader = table[0]?.best ?? 0;
  return table.map(({ c, best, done }, place) => {
    const time = best > 0 ? formatTime(best) : "-";
    const gap = best > 0 && place > 0 ? formatDelta(best - leader) : "";
    return {
      cells: [placeName(place), nameOfCar(c), time, gap, String(done)],
      mine: c == game.player,
      line: `${placeName(place, say)}  ${nameOfCar(c)}  ${time}  ${gap}`,
    };
  });
};
