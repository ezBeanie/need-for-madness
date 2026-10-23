// java.util.Random's nextDouble, from a seed: the original Java game made its scenery and
// rock piles with it.
export const javaRandom = (seed) => {
  const MASK = (1n << 48n) - 1n;
  let state = (BigInt(Math.trunc(seed)) ^ 0x5deece66dn) & MASK;
  const next = (bits) => {
    state = (state * 0x5deece66dn + 0xbn) & MASK;
    return Number(state >> BigInt(48 - bits));
  };
  return () => (next(26) * 2 ** 27 + next(27)) / 2 ** 53;
};
