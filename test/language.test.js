import { afterEach, expect, test } from "vitest";
import {
  language,
  setLanguage,
  t,
  translatePage,
} from "../src/core/language.js";
import { GERMAN } from "../src/data/german.js";

afterEach(() => {
  language.current = "en";
});

test("a text is English until German is chosen, and English again after", () => {
  expect(language.current).toBe("en");
  expect(t("Options")).toBe("Options");
  language.current = "de";
  expect(t("Options")).toBe("Optionen");
  language.current = "en";
  expect(t("Options")).toBe("Options");
});

test("a text's {names} are filled in, in either language", () => {
  expect(t("Room {room}", { room: "abc12" })).toBe("Room abc12");
  language.current = "de";
  expect(t("Room {room}", { room: "abc12" })).toBe("Raum abc12");
  expect(t("{players} of {most} players", { players: 2, most: 8 })).toBe(
    "2 von 8 Spielern",
  );
  // (a name not given stays as it is)
  expect(t("Room {room}", {})).toBe("Raum {room}");
});

test("a text without German shows in English", () => {
  language.current = "de";
  expect(t("Nothing like this is in the game {n}", { n: 3 })).toBe(
    "Nothing like this is in the game 3",
  );
  expect(t("Stage 4: Bestrack - Burn the Night")).toBe(
    "Stage 4: Bestrack - Burn the Night",
  );
});

test("a word with more than one meaning is told apart by what follows its |", () => {
  expect(t("Turn|piece")).toBe("Turn");
  language.current = "de";
  expect(t("Turn|piece")).toBe("Kurve");
  expect(t("Turn")).toBe("Drehen");
  // (one language asked for, whatever the game's is: the classic look's English)
  expect(t("Wrong Way!", undefined, "en")).toBe("Wrong Way!");
});

test("every German text is there, and has the same {names} as its English", () => {
  const names = (text) => [...text.matchAll(/\{(\w+)\}/g)].map(([, n]) => n);
  for (const [english, german] of Object.entries(GERMAN)) {
    expect(german.trim(), english).not.toBe("");
    expect(german, "the same as English: leave it out").not.toBe(english);
    expect(names(german).sort(), english).toEqual(names(english).sort());
  }
});

// A page of text nodes and elements, as much of the DOM as translatePage walks.
const textNode = (data) => ({ nodeType: 3, data });
const element = (attributes, ...childNodes) => ({
  nodeType: 1,
  localName: "div",
  attributes,
  childNodes,
  getAttribute(name) {
    return this.attributes[name] ?? null;
  },
  setAttribute(name, value) {
    this.attributes[name] = value;
  },
});

test("the page is translated and back, and a text the game wrote since is left to the game", () => {
  const options = textNode("Options");
  const spaced = textNode(" Back ");
  const owned = textNode("Version 1.1.0");
  const button = element({
    "aria-label": "Exit the replay",
    title: "Exit (Esc)",
  });
  globalThis.document = {
    documentElement: {},
    body: element({}, options, spaced, owned, button),
  };
  try {
    setLanguage("de");
    expect(document.documentElement.lang).toBe("de");
    expect(options.data).toBe("Optionen");
    expect(spaced.data).toBe(" Zurück ");
    expect(owned.data).toBe("Version 1.1.0");
    expect(button.attributes["aria-label"]).toBe("Replay verlassen");
    expect(button.attributes.title).toBe("Verlassen (Esc)");
    // (the game writes this one itself from now on)
    options.data = "Optionen!";
    setLanguage("en");
    expect(document.documentElement.lang).toBe("en");
    expect(options.data).toBe("Optionen!");
    expect(spaced.data).toBe(" Back ");
    expect(button.attributes["aria-label"]).toBe("Exit the replay");
    translatePage();
    expect(spaced.data).toBe(" Back ");
  } finally {
    delete globalThis.document;
  }
});
