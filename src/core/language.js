// The game's language: English, or German chosen in the options. English stays the source
// in the code: a text shown goes through t(), which finds its German by the English text.
// What index.html says is translated by walking the page (translatePage).

import { GERMAN } from "../data/german.js";
import { loadText, saveSetting } from "./storage.js";

// (English unless German was chosen: never the browser's language)
export const language = {
  current: loadText("language") == "de" ? "de" : "en",
};

// The text in the language (or in code's), with each {name} replaced by values[name];
// English where German has none. "Turn|piece" is "Turn" where the word means another
// thing than elsewhere (German says the editor's piece and its button apart).
export const t = (english, values, code = language.current) => {
  const text = (code == "de" && GERMAN[english]) || english.split("|")[0];
  if (!values) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (all, name) =>
    name in values ? String(values[name]) : all,
  );
};

// The attributes of index.html that are read out or shown.
const ATTRIBUTES = ["aria-label", "title", "placeholder"];

// Each static text and attribute translated: its English and what was written in its place.
// A text JS has changed since is JS's own (it writes it through t()) and is left alone.
const originals = new WeakMap();

// The text in the language, kept the spaces around it.
const translated = (english) => {
  const trimmed = english.trim();
  return english.replace(trimmed, () => t(trimmed));
};

// The English of a text or an attribute, or null when it is not index.html's to translate.
const englishOf = (record, now) => {
  if (record && record.written == now) {
    return record.english;
  }
  return GERMAN[now.trim()] ? now : null;
};

const translateNode = (node) => {
  if (node.nodeType == 3) {
    const english = englishOf(originals.get(node), node.data);
    if (english != null) {
      node.data = translated(english);
      originals.set(node, { english, written: node.data });
    }
    return;
  }
  if (node.nodeType != 1 || node.localName == "script") {
    return;
  }
  for (const name of ATTRIBUTES) {
    const now = node.getAttribute(name);
    if (now != null) {
      const records = originals.get(node) ?? {};
      const english = englishOf(records[name], now);
      if (english != null) {
        records[name] = { english, written: translated(english) };
        node.setAttribute(name, records[name].written);
        originals.set(node, records);
      }
    }
  }
  for (const child of node.childNodes) {
    translateNode(child);
  }
};

// What JS built and does not update by itself is shown anew in the language.
const listeners = [];
export const onLanguage = (listener) => listeners.push(listener);

export const translatePage = () => {
  document.documentElement.lang = language.current;
  if (document.body.childNodes) {
    translateNode(document.body);
  }
  for (const listener of listeners) {
    listener();
  }
};

export const setLanguage = (code) => {
  language.current = code == "de" ? "de" : "en";
  saveSetting("language", language.current);
  translatePage();
};
