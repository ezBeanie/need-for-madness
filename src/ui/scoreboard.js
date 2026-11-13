// What a room's race shows beyond the original's HUD: who wasted whom (a feed at the right in
// the modern look, the message in the middle in the classic one), most kills' clock and
// leaders at the top, and at the end every car's result in a table.

import { drawClassicMessage } from "../classic/hud.js";
import { game } from "../core/state.js";
import { TICK_MS, tick } from "../core/tick.js";
import { nameOfCar } from "../net/roomCars.js";
import { deathmatch, deathmatchLeft, killTable } from "../race/deathmatch.js";
import { racers } from "../race/racers.js";
import { track } from "../race/track.js";
import { classicMenus } from "../render/look.js";
import { rd, view } from "./view.js";
import { TEXT, drawCenteredText } from "./widgets.js";

const PLACE_SUFFIX = ["st", "nd", "rd"];
export const placeName = (place) =>
  `${place + 1}${PLACE_SUFFIX[place] ?? "th"}`;

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
export const wreckText = (by, c) => {
  const victim = c == game.player ? "you" : nameOfCar(c);
  if (by == -1) {
    return c == game.player
      ? "You have been wasted"
      : `${nameOfCar(c)} has been wasted`;
  }
  return `${by == game.player ? "You" : nameOfCar(by)} wasted ${victim}`;
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

// Most kills at the left from top on (the middle is the original's, for its messages): the
// time left, under it the leaders (the player too, if not among them). Returns where what
// comes under it may start. In the classic look a line at the bottom, as the original would.
const LEADERS = 3;
export const drawDeathmatchBoard = (top) => {
  const table = killTable();
  if (classicMenus()) {
    const [lead] = table;
    drawCenteredText(
      636,
      `Your kills ${deathmatch.kills[game.player]}` +
        (lead?.kills ? `   Leading: ${nameOfCar(lead.c)} ${lead.kills}` : ""),
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
  for (const { c, kills, place } of shown) {
    bar(left, rowTop, rowWidth, rowHeight, 0.45);
    rd.fillStyle = c == game.player ? "#FFB401" : "#FFFFFF";
    rd.textAlign = "left";
    rd.fillText(
      `${place + 1}  ${c == game.player ? "You" : nameOfCar(c)}`,
      left + 12 * s,
      rowTop + rowHeight / 2,
    );
    rd.textAlign = "right";
    rd.fillText(
      String(kills),
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
