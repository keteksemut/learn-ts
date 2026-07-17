import { createTicker } from "./ticker.js";
import { buildRevealOrder } from "./revealOrder.js";
import { resolveRandom } from "./random.js";
import { DIRECTIONS, DEFAULT_GLYPHS } from "./constants.js";

/**
 * A band of scramble sweeps across `text` on a loop and never
 * settles. There's no `onComplete` here, and the ticker's `onFrame`
 * always returns `true` — the `cancel()` handle isn't a nice-to-have
 * for this one, it's the only way this ever stops.
 *
 * `direction` reuses the exact same order concept as shuffle/
 * shuffleScroll (see revealOrder.js): `center-out` makes the shimmer
 * radiate from the middle and loop back, `word-by-word` makes it hop
 * whole words at a time, and so on.
 *
 * @returns {{ cancel: () => void }}
 */
export const wave = ({
  text = "",
  fps = 60,
  glyphs = DEFAULT_GLYPHS,
  direction = DIRECTIONS.RIGHT,
  anchor,
  seed,
  bandWidth,
  periodMs = 2200,
  onUpdate = null,
} = {}) => {
  const glyphList = glyphs.split("");
  const rng = resolveRandom(seed);
  const order = buildRevealOrder({ length: text.length, text, direction, seed, anchor });
  const band = bandWidth ?? Math.max(1.5, text.length * 0.18);

  let loopStart = null;

  const ticker = createTicker({
    fps,
    onFrame: (now) => {
      if (loopStart == null) loopStart = now;
      const progress = ((now - loopStart) % periodMs) / periodMs;
      const pos = progress * (text.length + band * 2) - band;

      let output = "";
      for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") {
          output += " ";
          continue;
        }
        const rank = order[i];
        output += Math.abs(rank - pos) < band ? rng.pick(glyphList) : text[i];
      }

      if (onUpdate) onUpdate(output);
      return true;
    },
  });

  return { cancel: ticker.cancel };
};
