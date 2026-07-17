/**
 * A small seeded PRNG plus the handful of derived operations
 * (pick, shuffle, chance, rangeFloor) this package actually uses —
 * reimplemented rather than pulled in from canvas-sketch-util/random.
 *
 * That package's seeding is a full ARC4 stream cipher (via the
 * `seed-random` package) — solid, but built for cases that need
 * cryptographic-quality entropy. Nothing here does; this is picking
 * which glyph flickers next in a UI animation. What actually matters
 * for `seed` is the contract we tested against last time: same seed
 * in, same sequence out, every time. Mulberry32 gives that in about
 * six lines — a well-known, widely used generator for exactly this
 * kind of use (fast, decent statistical spread, not appropriate for
 * anything security-sensitive, which this isn't).
 */

// Mulberry32: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
// Takes a 32-bit integer state and returns a `() => number` in
// [0, 1), advancing the state each call.
const mulberry32 = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// FNV-1a: a simple, standard string hash, used only to turn a string
// seed into the 32-bit integer mulberry32 needs. Numbers pass through
// as-is (masked to an unsigned 32-bit integer).
const hashSeed = (seed) => {
  if (typeof seed === "number") return seed >>> 0;
  let hash = 0x811c9dc5;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

// Builds the pick/shuffle/chance/rangeFloor surface on top of any
// `() => number in [0,1)` source — shared by both the seeded
// (mulberry32) and unseeded (Math.random) cases below, so there's
// exactly one implementation of "how do you turn a 0..1 draw into a
// shuffled array" rather than two copies that could drift apart.
const buildInstance = (value) => {
  const range = (min, max) => {
    if (max === undefined) {
      max = min;
      min = 0;
    }
    return value() * (max - min) + min;
  };

  const rangeFloor = (min, max) => Math.floor(range(min, max));

  const pick = (array) => (array.length === 0 ? undefined : array[rangeFloor(0, array.length)]);

  const chance = (probability = 0.5) => value() < probability;

  const shuffle = (arr) => {
    const result = arr.slice();
    let remaining = result.length;
    while (remaining) {
      const randIndex = Math.floor(value() * remaining--);
      const tmp = result[remaining];
      result[remaining] = result[randIndex];
      result[randIndex] = tmp;
    }
    return result;
  };

  return { value, range, rangeFloor, pick, chance, shuffle };
};

const createSeeded = (seed) => ({
  ...buildInstance(mulberry32(hashSeed(seed))),
  createRandom: (nextSeed) => (nextSeed == null ? createUnseeded() : createSeeded(nextSeed)),
});

const createUnseeded = () => ({
  ...buildInstance(Math.random),
  createRandom: (seed) => (seed == null ? createUnseeded() : createSeeded(seed)),
});

const defaultInstance = createUnseeded();

/**
 * Resolves an optional seed into a random source. No seed falls
 * through to the shared unseeded instance — identical to how every
 * effect worked before seeding existed. A seed gets its own scoped
 * mulberry32 instance instead of mutating global state, so seeding
 * one call can't change randomness anywhere else in a consumer's app.
 *
 * @param {number|string} [seed]
 */
export const resolveRandom = (seed) => (seed == null ? defaultInstance : createSeeded(seed));
