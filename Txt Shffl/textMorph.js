import { shuffle } from "./textShuffle.js";
import { ANIMATIONS } from "./constants.js";

/**
 * Dissolves `from` into glyphs, then resolves into `to`. Built by
 * composing shuffle() twice, hide then show, chained through
 * onComplete, rather than a new engine. Anything shuffle() accepts
 * (direction, glyphs, fps, delay, seed, anchor, ...) can be passed
 * through and applies to both phases.
 *
 * @returns {{ cancel: () => void }}
 */
export const morph = ({
  from = "",
  to = "",
  hideDuration = 0.4,
  showDuration = 0.4,
  onUpdate = null,
  onComplete = null,
  ...effectOptions
} = {}) => {
  let active = shuffle({
    ...effectOptions,
    text: from,
    animation: ANIMATIONS.HIDE,
    duration: hideDuration,
    onUpdate,
    onComplete: () => {
      active = shuffle({
        ...effectOptions,
        text: to,
        animation: ANIMATIONS.SHOW,
        duration: showDuration,
        onUpdate,
        onComplete,
      });
    },
  });

  return {
    cancel: () => active.cancel(),
  };
};
