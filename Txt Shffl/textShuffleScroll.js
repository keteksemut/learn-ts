import { mod } from "./mathUtils.js";
import { createTicker } from "./ticker.js";
import { buildRevealOrder } from "./revealOrder.js";
import { resolveRandom } from "./random.js";
import { ANIMATIONS, DIRECTIONS } from "./constants.js";

const DEFAULT_GLYPHS =
  " '\"“”‘’¹²³!#$&%()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuüvwxyz{|}~½¼¡«»×░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌";

/**
 * shuffleScroll "lands" each character by cycling through `glyphs`
 * until it reaches that character's position in the string. If a
 * character in `text` isn't in `glyphs` at all, there's no position
 * for it to land on. Failing fast here trades a silent runtime bug
 * for an immediate, readable error.
 */
const assertGlyphsCoverText = (text, glyphs) => {
  const missing = [...new Set(text.split("").filter((char) => !glyphs.includes(char)))];
  if (missing.length > 0) {
    const list = missing.map((char) => JSON.stringify(char)).join(", ");
    throw new Error(
      `shuffleScroll: "glyphs" is missing ${list}, which appear in "text". Add them to ` +
        `"glyphs" (or remove them from "text") so every character has somewhere to resolve to.`,
    );
  }
};

const buildStartIndices = ({ targetIndices, glyphCount, animation, stayFrames, rng }) => {
  switch (animation) {
    case ANIMATIONS.HIDE:
      return targetIndices.slice();
    case ANIMATIONS.STAY:
      return targetIndices.map((target) => mod(target - rng.rangeFloor(5, stayFrames), glyphCount));
    default: // SHOW
      return targetIndices.map(() => 0);
  }
};

/**
 * Advances every character one step along the glyph "reel" and
 * renders the result.
 *
 * `order[i]` (see revealOrder.js) is what the gate check runs
 * against, which is how this effect gets direction support at all —
 * it used to be hardcoded to raw left-to-right index order.
 *
 * @returns {{ output: string, complete: boolean }}
 */
export const step = (state) => {
  const { text, glyphs, targetIndices, currentIndices, animation, frame, order } = state;

  let output = "";
  let resolvedCount = 0;

  for (let i = 0; i < currentIndices.length; i++) {
    let current = currentIndices[i];
    const target = targetIndices[i];
    const gateOpen = order[i] < frame;

    if (animation === ANIMATIONS.SHOW) {
      if (current !== target) {
        if (gateOpen) current++;
      } else resolvedCount++;
    } else if (animation === ANIMATIONS.HIDE) {
      if (current > 0) {
        if (gateOpen) current--;
      } else resolvedCount++;
    } else {
      // STAY: no stagger gate — every character drifts back to its
      // target at once, just from a randomized head start per
      // character (see buildStartIndices), which is what gives it
      // a "settling" look instead of a uniform wipe.
      if (current !== target) current++;
      else resolvedCount++;
    }

    current = current % glyphs.length;
    currentIndices[i] = current;
    output += glyphs[current];
  }

  const complete = resolvedCount >= currentIndices.length;
  if (complete) {
    return { output: animation === ANIMATIONS.HIDE ? "" : text, complete };
  }
  return { output, complete };
};

/**
 * "Scrolls" each character of `text` through `glyphs` like an
 * odometer reel until it lands on the right symbol.
 *
 * @returns {{ cancel: () => void }}
 */
export const shuffleScroll = ({
  text = "",
  delay = 0,
  fps = 60,
  glyphs = DEFAULT_GLYPHS,
  animation = ANIMATIONS.SHOW,
  direction = DIRECTIONS.RIGHT,
  anchor,
  seed,
  stayFrames = 25,
  onUpdate = null,
  onComplete = null,
} = {}) => {
  assertGlyphsCoverText(text, glyphs);
  const rng = resolveRandom(seed);

  const targetIndices = text.split("").map((char) => glyphs.indexOf(char));
  const order = buildRevealOrder({ length: text.length, text, direction, seed, anchor });
  const currentIndices = buildStartIndices({
    targetIndices,
    glyphCount: glyphs.length,
    animation,
    stayFrames,
    rng,
  });

  const state = { text, glyphs, targetIndices, currentIndices, animation, frame: 0, order };
  const start = performance.now();

  const ticker = createTicker({
    fps,
    onFrame: (now) => {
      if (now - start > delay * 1000) state.frame++;

      const { output, complete } = step(state);

      if (onUpdate) onUpdate(output);
      if (complete && onComplete) onComplete(output);

      return !complete;
    },
  });

  return { cancel: ticker.cancel };
};
