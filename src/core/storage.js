// What the game remembers in the browser: the chosen car, the unlocked stages, the field
// size. Storage can be missing or blocked (private windows); the game then forgets.

export const saveSetting = (name, value) => {
  try {
    localStorage.setItem(name, value);
  } catch {
    // not remembered
  }
};

// The stored whole number, or -1 when nothing (valid) is stored.
export const loadSetting = (name) => {
  try {
    const value = parseInt(localStorage.getItem(name) ?? "-1");
    return Number.isNaN(value) ? -1 : value;
  } catch {
    return -1;
  }
};

// The stored text, or "" when nothing is stored.
export const loadText = (name) => {
  try {
    return localStorage.getItem(name) ?? "";
  } catch {
    return "";
  }
};
