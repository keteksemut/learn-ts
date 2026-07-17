import { resolveRandom } from "./random.js";
import { DIRECTIONS } from "./constants.js";

const identity = (length) => Array.from({ length }, (_, i) => i);

// Turns "these positions, in this order" into "this position has
// this rank" — the shape every effect actually consumes.
const invert = (orderedPositions) => {
  const order = new Array(orderedPositions.length);
  orderedPositions.forEach((position, rank) => {
    order[position] = rank;
  });
  return order;
};

const byDistanceFrom = (length, anchor, ascending) => {
  const sorted = identity(length).sort((a, b) => {
    const da = Math.abs(a - anchor);
    const db = Math.abs(b - anchor);
    return ascending ? da - db : db - da;
  });
  return invert(sorted);
};

// Characters in the same whitespace-delimited word all get the rank
// of that word's first character, so the word resolves as one unit
// instead of interleaving with its neighbors. A space just inherits
// the rank of the word before it (spaces are never actually
// scrambled by any effect — see resolveFrame/step — so this only
// affects when the gate opens, not what renders).
const byWord = (text) => {
  const order = new Array(text.length);
  let wordStart = null;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === " ") {
      order[i] = wordStart ?? 0;
      wordStart = null;
    } else {
      if (wordStart == null) wordStart = i;
      order[i] = wordStart;
    }
  }
  return order;
};

/**
 * Builds the per-character priority array every effect in this
 * package reveals, resolves, or sweeps by: `order[i]` is the rank at
 * which character `i` becomes "due" (lower ranks are due sooner).
 *
 * `anchor` only applies to center-out/edges-in — it's the character
 * index the sweep radiates from or converges on, defaulting to the
 * middle of the string. `seed` only applies to random — see
 * random.js for what seeding does and doesn't affect.
 *
 * @param {{ length: number, text?: string, direction?: string, seed?: number|string, anchor?: number }} config
 * @returns {number[]}
 */
export const buildRevealOrder = ({
  length,
  text = "",
  direction = DIRECTIONS.RIGHT,
  seed,
  anchor,
}) => {
  switch (direction) {
    case DIRECTIONS.LEFT:
      return identity(length).reverse();
    case DIRECTIONS.RANDOM:
      return resolveRandom(seed).shuffle(identity(length));
    case DIRECTIONS.CENTER_OUT:
      return byDistanceFrom(length, anchor ?? (length - 1) / 2, true);
    case DIRECTIONS.EDGES_IN:
      return byDistanceFrom(length, anchor ?? (length - 1) / 2, false);
    case DIRECTIONS.WORD_BY_WORD:
      return byWord(text);
    default: // RIGHT
      return identity(length);
  }
};
