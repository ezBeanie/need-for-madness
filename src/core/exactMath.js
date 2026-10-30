// sin, cos, atan and acos that every browser computes to the same bit. The engines' own
// differ in the last bit from engine to engine and version to version (Chrome's cos is not
// Node's), and in a race the differences grow until the cars drive elsewhere; racing
// together by sending each other only the keys (see net/determinism.js) needs every game
// to compute the same race. These are fdlibm's (the C library Java's StrictMath and, for
// years, V8 took them from), in plain additions and multiplications, which every engine
// rounds alike (IEEE 754).

const word = new DataView(new ArrayBuffer(8));
const high = (x) => {
  word.setFloat64(0, x);
  return word.getInt32(0);
};
const low = (x) => {
  word.setFloat64(0, x);
  return word.getInt32(4);
};
// x with its low word cleared
const withoutLow = (x) => {
  word.setFloat64(0, x);
  word.setInt32(4, 0);
  return word.getFloat64(0);
};
const fromHigh = (h) => {
  word.setInt32(0, h);
  word.setInt32(4, 0);
  return word.getFloat64(0);
};

// sin of x + y in [-pi/4, pi/4], y the tail of x (k_sin.c)
const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

const kernelSin = (x, y, hasTail) => {
  if ((high(x) & 0x7fffffff) < 0x3e400000) {
    // |x| < 2^-27
    return x;
  }
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return hasTail
    ? x - (z * (0.5 * y - v * r) - y - v * S1)
    : x + v * (S1 + z * r);
};

// cos of x + y in [-pi/4, pi/4] (k_cos.c)
const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.0875723212981748279e-9;
const C6 = -1.13596475577881948265e-11;

const kernelCos = (x, y) => {
  const ix = high(x) & 0x7fffffff;
  if (ix < 0x3e400000) {
    return 1;
  }
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) {
    // |x| < 0.3
    return 1 - (0.5 * z - (z * r - x * y));
  }
  const qx = ix > 0x3fe90000 ? 0.28125 : fromHigh(ix - 0x00200000);
  const hz = 0.5 * z - qx;
  return 1 - qx - (hz - (z * r - x * y));
};

// x - n pi/2 as head + tail, in [-pi/4, pi/4]; returns n (e_rem_pio2.c, the medium-size
// arguments: exact while n stays below 2^20, far beyond the angles of a race)
const INVPIO2 = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417;
const PIO2_1T = 6.07710050650619224932e-11;
const PIO2_2 = 6.0771005063039659766e-11;
const PIO2_2T = 2.02226624879595063154e-21;
const PIO2_3 = 2.0222662487111664558e-21;
const PIO2_3T = 8.47842766036889956997e-32;
const reduced = { head: 0, tail: 0 };

const reduce = (x) => {
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  const t = Math.abs(x);
  const n = Math.floor(t * INVPIO2 + 0.5);
  let r = t - n * PIO2_1;
  let w = n * PIO2_1T;
  let head = r - w;
  // (cancellation near a multiple of pi/2: more of pi/2's bits)
  const exponent = ix >> 20;
  if (exponent - ((high(head) >> 20) & 0x7ff) > 16) {
    let before = r;
    w = n * PIO2_2;
    r = before - w;
    w = n * PIO2_2T - (before - r - w);
    head = r - w;
    if (exponent - ((high(head) >> 20) & 0x7ff) > 49) {
      before = r;
      w = n * PIO2_3;
      r = before - w;
      w = n * PIO2_3T - (before - r - w);
      head = r - w;
    }
  }
  const tail = r - head - w;
  reduced.head = hx < 0 ? -head : head;
  reduced.tail = hx < 0 ? -tail : tail;
  return hx < 0 ? -n : n;
};

// (which quarter n lands in, for negative n too)
const quarter = (n) => ((n % 4) + 4) % 4;

export const sin = (x) => {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    return kernelSin(x, 0, false);
  }
  if (ix >= 0x7ff00000) {
    return NaN;
  }
  const n = quarter(reduce(x));
  const { head, tail } = reduced;
  return n == 0
    ? kernelSin(head, tail, true)
    : n == 1
      ? kernelCos(head, tail)
      : n == 2
        ? -kernelSin(head, tail, true)
        : -kernelCos(head, tail);
};

export const cos = (x) => {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    return kernelCos(x, 0);
  }
  if (ix >= 0x7ff00000) {
    return NaN;
  }
  const n = quarter(reduce(x));
  const { head, tail } = reduced;
  return n == 0
    ? kernelCos(head, tail)
    : n == 1
      ? -kernelSin(head, tail, true)
      : n == 2
        ? -kernelCos(head, tail)
        : kernelSin(head, tail, true);
};

// (s_atan.c)
const ATAN_HI = [
  4.63647609000806093515e-1, 7.85398163397448278999e-1,
  9.82793723247329054082e-1, 1.570796326794896558,
];
const ATAN_LO = [
  2.26987774529616870924e-17, 3.06161699786838301793e-17,
  1.39033110312309984516e-17, 6.12323399573676603587e-17,
];
const AT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1,
  1.42857142725034663711e-1, -1.1111110405462355788e-1,
  9.09088713343650656196e-2, -7.69187620504482999495e-2,
  6.66107313738753120669e-2, -5.83357013379057348645e-2,
  4.97687799461593236017e-2, -3.6531572744216915527e-2,
  1.62858201153657823623e-2,
];

export const atan = (x) => {
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x44100000) {
    // |x| >= 2^66
    if (Number.isNaN(x)) {
      return x;
    }
    return hx > 0 ? ATAN_HI[3] + ATAN_LO[3] : -ATAN_HI[3] - ATAN_LO[3];
  }
  let id;
  if (ix < 0x3fdc0000) {
    // |x| < 0.4375
    if (ix < 0x3e200000) {
      return x;
    }
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      if (ix < 0x3fe60000) {
        id = 0;
        x = (2 * x - 1) / (2 + x);
      } else {
        id = 1;
        x = (x - 1) / (x + 1);
      }
    } else if (ix < 0x40038000) {
      id = 2;
      x = (x - 1.5) / (1 + 1.5 * x);
    } else {
      id = 3;
      x = -1 / x;
    }
  }
  const z = x * x;
  const w = z * z;
  const s1 =
    z *
    (AT[0] +
      w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) {
    return x - x * (s1 + s2);
  }
  const result = ATAN_HI[id] - (x * (s1 + s2) - ATAN_LO[id] - x);
  return hx < 0 ? -result : result;
};

// (e_acos.c)
const PIO2_HI = 1.570796326794896558;
const PIO2_LO = 6.12323399573676603587e-17;
const PI = 3.141592653589793116;
const PS = [
  1.66666666666666657415e-1, -3.25565818622400915405e-1,
  2.01212532134862925881e-1, -4.00555345006794114027e-2,
  7.91534994289814532176e-4, 3.4793310759602116757e-5,
];
const QS = [
  -2.40339491173441421878, 2.02094576023350569471, -6.8828397160545329303e-1,
  7.70381505559019352791e-2,
];
const ratio = (z) =>
  (z *
    (PS[0] +
      z * (PS[1] + z * (PS[2] + z * (PS[3] + z * (PS[4] + z * PS[5])))))) /
  (1 + z * (QS[0] + z * (QS[1] + z * (QS[2] + z * QS[3]))));

export const acos = (x) => {
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    // |x| >= 1
    if (((ix - 0x3ff00000) | low(x)) == 0) {
      return hx > 0 ? 0 : PI + 2 * PIO2_LO;
    }
    return NaN;
  }
  if (ix < 0x3fe00000) {
    // |x| < 0.5
    if (ix <= 0x3c600000) {
      return PIO2_HI + PIO2_LO;
    }
    return PIO2_HI - (x - (PIO2_LO - x * ratio(x * x)));
  }
  if (hx < 0) {
    const z = (1 + x) * 0.5;
    const s = Math.sqrt(z);
    const w = ratio(z) * s - PIO2_LO;
    return PI - 2 * (s + w);
  }
  const z = (1 - x) * 0.5;
  const s = Math.sqrt(z);
  const df = withoutLow(s);
  const c = (z - df * df) / (s + df);
  const w = ratio(z) * s + c;
  return 2 * (df + w);
};
