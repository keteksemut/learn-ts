import { createTicker } from "./ticker.js";
import { buildRevealOrder } from "./revealOrder.js";
import { resolveRandom } from "./random.js";
import { DIRECTIONS, DEFAULT_GLYPHS } from "./constants.js";

/**
 * Resolves one character at a time, in order, each flickering
 * briefly before settling — unlike shuffle, where every character's
 * reveal overlaps on one shared eased curve. Built the same way
 * shuffleScroll's `step` is (a frame-gated state machine) rather
 * than reusing resolveFrame, because the pacing here is discrete and
 * per-character, not one continuous curve.
 *
 * Still built on the shared `order` concept: `order[i]` decides
 * which character's "turn" is first, so `direction` here means
 * exactly what it means everywhere else.
 *
 * @returns {{ cancel: () => void }}
 */
export const typewriter = ({
  text = "",
  fps = 60,
  glyphs = DEFAULT_GLYPHS,
  direction = DIRECTIONS.RIGHT,
  anchor,
  seed,
  flickerFrames = 4,
  holdFrames = 2,
  onUpdate = null,
  onComplete = null,
} = {}) => {
  const glyphList = glyphs.split("");
  const rng = resolveRandom(seed);
  const order = buildRevealOrder({ length: text.length, text, direction, seed, anchor });
  const turnLength = flickerFrames + holdFrames;

  let frame = 0;

  const ticker = createTicker({
    fps,
    onFrame: () => {
      frame++;

      let output = "";
      let resolvedCount = 0;

      for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") {
          output += " ";
          resolvedCount++;
          continue;
        }

        const framesIntoTurn = frame - order[i] * turnLength;

        if (framesIntoTurn < 0) {
          output += " ";
        } else if (framesIntoTurn < flickerFrames) {
          output += rng.pick(glyphList);
        } else {
          output += text[i];
          resolvedCount++;
        }
      }

      const complete = resolvedCount >= text.length;
      if (complete) output = text;

      if (onUpdate) onUpdate(output);
      if (complete && onComplete) onComplete(output);

      return !complete;
    },
  });

  return { cancel: ticker.cancel };
};
