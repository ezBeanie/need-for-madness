// A replay as a file: the race tape (see raceTape.js) with what is needed to show it again,
// the stage and the cars. Nothing is lost: every number is kept to its last bit. The
// tape's columns are stored one after the other, each number as its bits XORed with the
// one before (a car moves little from tick to tick, so most of them come out 0), split
// into byte planes, and the whole is gzipped.

import { DUST, HIT, PER_TICK, SOUND, SPARK, raceTape } from "./raceTape.js";

const FORMAT = "nfm-replay";
const SPEEDS = ["speedX", "speedY", "speedZ"];
const VERSION = 1;
export const REPLAY_FILE_EXTENSION = ".nfmreplay";

// --- columns ---

const typeOf = (values) =>
  values.every((v) => typeof v == "boolean")
    ? "bool"
    : values.every((v) => typeof v == "number")
      ? "f64"
      : "json";

// A column of numbers, as FPC packs them: each one's 8 bytes XORed with a guess of it,
// the one before or the line through the two before (whichever comes closer), so its
// high bytes come out 0 and are left out. A byte per number tells which guess and how
// many bytes follow, then all the bytes.
const guessBits = new Uint8Array(16);
const guesses = new Float64Array(guessBits.buffer);

const guess = (values, i) => {
  guesses[0] = i > 0 ? values[i - 1] : 0;
  guesses[1] = i > 1 ? 2 * values[i - 1] - values[i - 2] : guesses[0];
};

// how many of the 8 bytes from guess g on are needed: up to the highest one not 0
const neededBytes = (bits, at, g) => {
  let n = 8;
  while (n > 0 && (bits[at + n - 1] ^ guessBits[g * 8 + n - 1]) == 0) {
    n--;
  }
  return n;
};

const packNumbers = (values) => {
  const bits = new Uint8Array(new Float64Array(values).buffer);
  const heads = new Uint8Array(values.length);
  const bytes = [];
  for (let i = 0; i < values.length; i++) {
    guess(values, i);
    const at = i * 8;
    const [byLast, byLine] = [
      neededBytes(bits, at, 0),
      neededBytes(bits, at, 1),
    ];
    const g = byLine < byLast ? 1 : 0;
    const n = Math.min(byLast, byLine);
    heads[i] = n | (g << 4);
    for (let k = 0; k < n; k++) {
      bytes.push(bits[at + k] ^ guessBits[g * 8 + k]);
    }
  }
  const packed = new Uint8Array(heads.length + bytes.length);
  packed.set(heads);
  packed.set(bytes, heads.length);
  return packed;
};

const unpackNumbers = (packed, length) => {
  const values = [];
  const one = new Float64Array(1);
  const oneBits = new Uint8Array(one.buffer);
  let at = length;
  for (let i = 0; i < length; i++) {
    guess(values, i);
    const n = packed[i] & 15;
    const g = packed[i] >> 4;
    for (let k = 0; k < 8; k++) {
      oneBits[k] = guessBits[g * 8 + k] ^ (k < n ? packed[at + k] : 0);
    }
    at += n;
    values.push(one[0]);
  }
  return values;
};

const packColumn = (values, type) => {
  if (type == "bool") {
    return Uint8Array.from(values, (v) => (v ? 1 : 0));
  }
  if (type == "f64") {
    return packNumbers(values);
  }
  return new TextEncoder().encode(JSON.stringify(values));
};

const unpackColumn = (bytes, { type, length }) => {
  if (type == "bool") {
    return Array.from(bytes, (b) => b == 1);
  }
  if (type == "f64") {
    return unpackNumbers(bytes, length);
  }
  return JSON.parse(new TextDecoder().decode(bytes));
};

// --- the tape as named columns ---

// every column of the tape: [name, its values (to read), set (to write it back)]
const columnsOf = (tape) => {
  const columns = [];
  // from: where the column starts (the ticks before are 0)
  const add = (owner, field, length, name, from = 0) =>
    columns.push({
      name,
      length: length - from,
      values: () => owner[field].slice(from, length),
      set: (values) => {
        owner[field] = [...Array(from).fill(0), ...values];
      },
    });
  tape.cars.forEach((car, c) => {
    for (const field of PER_TICK) {
      // the speeds only send a burning wreck's fire off
      const from = SPEEDS.includes(field)
        ? Math.min(car.wastedAt, tape.length)
        : 0;
      add(car, field, tape.length, `car${c}.${field}`, from);
    }
    for (const field of HIT) {
      add(car, field, car.hitCount, `car${c}.${field}`);
    }
    add(car, "fixAt", car.fixCount, `car${c}.fixAt`);
    for (const field of DUST) {
      add(car, field, car.dustCount, `car${c}.${field}`);
    }
    for (const field of SOUND) {
      add(car, field, car.soundCount, `car${c}.${field}`);
    }
  });
  for (const field of SPARK) {
    add(tape.sparks, field, tape.sparks.count, `sparks.${field}`);
  }
  add(tape, "checkpoint", tape.length, "checkpoint");
  add(tape, "lastCheck", tape.length, "lastCheck");
  return columns;
};

// the counts of the tape's events and when each car was wasted (null: never)
const countsOf = (tape) => ({
  length: tape.length,
  cars: tape.cars.map((car) => ({
    hitCount: car.hitCount,
    fixCount: car.fixCount,
    dustCount: car.dustCount,
    soundCount: car.soundCount,
    wastedAt: Number.isFinite(car.wastedAt) ? car.wastedAt : null,
  })),
  sparks: tape.sparks.count,
});

// --- gzip ---

const pipe = async (bytes, stream) =>
  new Uint8Array(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(stream),
    ).arrayBuffer(),
  );

// --- the file ---

// The file of the race tape, with what it was raced in: { stage, name, carTypes, player }.
export const encodeReplay = async (race) => {
  const columns = columnsOf(raceTape).map((column) => {
    const values = column.values();
    const type = typeOf(values);
    return {
      name: column.name,
      type,
      length: values.length,
      bytes: packColumn(values, type),
    };
  });
  const header = {
    format: FORMAT,
    version: VERSION,
    race,
    counts: countsOf(raceTape),
    columns: columns.map(({ name, type, length, bytes }) => ({
      name,
      type,
      length,
      size: bytes.length,
    })),
  };
  const head = new TextEncoder().encode(JSON.stringify(header));
  const size = new Uint8Array(4);
  new DataView(size.buffer).setUint32(0, head.length);
  return pipe(
    new Blob([size, head, ...columns.map(({ bytes }) => bytes)]),
    new CompressionStream("gzip"),
  );
};

// Reads a replay file: { race: what it was raced in (see encodeReplay), tape: its race
// tape }. Throws when it is no replay of this game.
export const decodeReplay = async (file) => {
  let bytes;
  try {
    bytes = await pipe(file, new DecompressionStream("gzip"));
  } catch {
    throw new Error("This is not a replay file.");
  }
  const headSize = new DataView(bytes.buffer).getUint32(0);
  const header = JSON.parse(
    new TextDecoder().decode(bytes.subarray(4, 4 + headSize)),
  );
  if (header.format != FORMAT) {
    throw new Error("This is not a replay file.");
  }
  if (header.version > VERSION) {
    throw new Error("This replay is from a newer version of the game.");
  }
  const { counts } = header;
  const tape = {
    length: counts.length,
    cars: counts.cars.map((car) => ({
      hitCount: car.hitCount,
      fixCount: car.fixCount,
      dustCount: car.dustCount,
      // (none in files of the first version)
      soundCount: car.soundCount ?? 0,
      wastedAt: car.wastedAt ?? Infinity,
    })),
    sparks: { count: counts.sparks },
  };
  // the columns by name: a file of an older version lacks some (they stay 0)
  const stored = new Map();
  let at = 4 + headSize;
  for (const column of header.columns) {
    stored.set(column.name, {
      ...column,
      bytes: bytes.subarray(at, at + column.size),
    });
    at += column.size;
  }
  if (at != bytes.length) {
    throw new Error("This replay file is damaged.");
  }
  for (const column of columnsOf(tape)) {
    const found = stored.get(column.name);
    column.set(
      found ? unpackColumn(found.bytes, found) : Array(column.length).fill(0),
    );
  }
  return { race: header.race, tape };
};
