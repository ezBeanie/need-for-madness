// The room's chat in the lobby: each game sends its player's lines to the others and keeps
// the last ones of all. Lines are only ever shown as text (see ui/multiplayerMenu.js).

import { MESSAGE, link } from "./link.js";

export const MOST_CHAT_CHARACTERS = 200;
// the lines kept, the oldest forgotten first
const KEPT_LINES = 50;

// lines: { from, text } each, the newest last; count: lines ever added, which tells the
// dialog a new one came even once the oldest are forgotten
export const chat = { lines: [], count: 0 };

const addLine = (from, text) => {
  chat.lines = [...chat.lines, { from, text }].slice(-KEPT_LINES);
  chat.count++;
};

// (control characters and runs of spaces could garble the list)
const clean = (text) =>
  typeof text == "string"
    ? text
        .replace(/[\p{Cc}\p{Cf}]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MOST_CHAT_CHARACTERS)
    : "";

export const sendChat = (text) => {
  const line = clean(text);
  if (!line) {
    return;
  }
  link.send({ type: MESSAGE.chat, text: line });
  addLine(link.id, line);
};

export const receiveChat = (message) => {
  const line = clean(message.text);
  if (message.type == MESSAGE.chat && line) {
    addLine(message.from, line);
  }
};

// A new room starts without lines.
export const clearChat = () => {
  chat.lines = [];
  chat.count = 0;
};
