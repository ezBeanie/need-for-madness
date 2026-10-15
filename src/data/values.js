// Numbers in the data files are read like the original game did: missing or unreadable is -1.
const readNumber = (raw, parse) => {
  const value = parse(raw === "" ? "-1" : raw);
  return Number.isNaN(value) ? -1 : value;
};

export const readInt = (raw) => readNumber(raw, parseInt);
export const readFloat = (raw) => readNumber(raw, parseFloat);
