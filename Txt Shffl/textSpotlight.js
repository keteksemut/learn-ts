import { resolveRandom } from "./random.js";
import { DEFAULT_GLYPHS } from "./constants.js";

/**
 * Every other effect in this package drives itself off a clock.
 * Spotlight can't — "which characters are revealed" depends on where
 * an external focus point currently is, and this module is
 * deliberately headless. So it returns a small controller instead of
 * `{ cancel }`: call `.setFocus()` when your focus point moves,
 * `.render()` when you want the current string. There's no
 * onUpdate/onComplete — no frame loop to fire one from, no finished
 * state to complete into.
 *
 * @returns {{ setFocus: (position: number|null) => void, render: () => string }}
 */
export const spotlight = ({ text = "", glyphs = DEFAULT_GLYPHS, radius = 2.5, seed } = {}) => {
  const glyphList = glyphs.split("");
  const rng = resolveRandom(seed);
  let focus = null; // character-index units; null = nothing revealed

  const render = () => {
    let output = "";
    for (let i = 0; i < text.length; i++) {
      if (text[i] === " ") {
        output += " ";
        continue;
      }
      const revealed = focus != null && Math.abs(i - focus) <= radius;
      output += revealed ? text[i] : rng.pick(glyphList);
    }
    return output;
  };

  return {
    setFocus: (position) => {
      focus = position;
    },
    render,
  };
};
