// What changed in each version of the game, the newest first: its number is the game's
// version (see the options). A bigger change raises the middle number, a smaller one the
// last. Shown in English whatever the game's language.

export const CHANGELOG = [
  {
    version: "1.1.0",
    date: "2026-11-13",
    changes: [
      "Phones held upright show the game turned sideways instead of asking to turn them.",
      "A game in a hidden tab stays in its room's race and joins the next one the host starts.",
      "Less stutter for a host of many dented cars, smaller messages in a race together, and fewer waits for a player late a moment.",
      "Most kills in teams shows each team's kills in the HUD.",
      "Browsers no longer translate the page, which made texts flicker.",
      "The version and what changed, in the options.",
      "The game in German, chosen in the options.",
      "Voice chat between players in different networks, through the server's TURN.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-11-13",
    changes: [
      "The original game rebuilt for the browser, with a modern look and HUD beside the classic one.",
      "Campaign, quick race, practice and time attack with a ghost.",
      "Multiplayer rooms of up to eight players with bots, a lobby with chat, public rooms to join from a list, and voice chat.",
      "Race modes: normal, only racing, last survivor, time attack and most kills, also in teams.",
      "The stage editor, replays, the minimap, the target camera and touch controls.",
      "Offline play once installed.",
    ],
  },
];

export const VERSION = CHANGELOG[0].version;
