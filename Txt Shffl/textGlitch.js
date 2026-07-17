import { createTicker } from "./ticker.js";
import { resolveRandom } from "./random.js";
import { DEFAULT_GLYPHS } from "./constants.js";

/**
 * A brief, chaotic flicker across `text` that always settles back to
 * the original — for a moment that needs attention rather than a
 * reveal or hide transition.
 *
 * No `direction` on purpose: a real glitch reads as chaotic because
 * it doesn't sweep. It takes `intensity` instead — the fraction of
 * characters perturbed on any given frame.
 *
 * @returns {{ cancel: () => void }}
 */
export const glitch = ({
  text = "",
  duration = 0.4,
  intensity = 0.35,
  fps = 60,
  glyphs = DEFAULT_GLYPHS,
  seed,
  onUpdate = null,
  onComplete = null,
} = {}) => {
  const glyphList = glyphs.split("");
  const rng = resolveRandom(seed);
  const start = performance.now();

  const ticker = createTicker({
    fps,
    onFrame: (now) => {
      const t = ((now - start) * 0.001) / duration;
      const complete = t >= 1;

      const output = complete
        ? text
        : text
            .split("")
            .map((char) => (char !== " " && rng.chance(intensity) ? rng.pick(glyphList) : char))
            .join("");

      if (onUpdate) onUpdate(output);
      if (complete && onComplete) onComplete(output);

      return !complete;
    },
  });

  return { cancel: ticker.cancel };
};
