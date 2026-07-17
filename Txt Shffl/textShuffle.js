import { clamp01 } from "./mathUtils.js";
import { quartOut, quadInOut } from "./easing.js";
import { createTicker } from "./ticker.js";
import { buildRevealOrder } from "./revealOrder.js";
import { resolveRandom } from "./random.js";
import { ANIMATIONS, DIRECTIONS, DEFAULT_GLYPHS } from "./constants.js";

const flipDirection = (direction) => {
  if (direction === DIRECTIONS.LEFT) return DIRECTIONS.RIGHT;
  if (direction === DIRECTIONS.RIGHT) return DIRECTIONS.LEFT;
  return direction; // RANDOM/CENTER_OUT/EDGES_IN/WORD_BY_WORD have no opposite
};

/**
 * Given how far into the animation we are (`tRaw`, seconds elapsed
 * divided by duration), works out what the text should look like
 * right now.
 *
 * This takes no timers, no RAF, no `Date.now()` — just numbers in,
 * a string out, so it can be tested directly — `resolveFrame(config,
 * 0.5)` — instead of needing a mocked clock and a fake
 * requestAnimationFrame to ever reach the interesting code.
 *
 * @returns {{ output: string, complete: boolean }}
 */
export const resolveFrame = (
  { text, revealOrder, glyphs, delay, delayResolve, animation, rng },
  tRaw,
) => {
  const t = animation === ANIMATIONS.HIDE ? 1 - tRaw : tRaw;

  const u = quartOut(clamp01(t - delay));
  const vRaw = clamp01(t - delay - delayResolve) * (1 / (1 - delayResolve));
  const v = quadInOut(vRaw);

  const complete = animation === ANIMATIONS.HIDE ? u <= 0 : u >= 1;
  if (complete) {
    // Snap to the exact final value rather than trusting the last
    // eased frame to have landed on it exactly.
    return { output: animation === ANIMATIONS.HIDE ? "" : text, complete };
  }

  const revealedCount = Math.round(u * text.length);
  const resolvedCount = Math.round(v * text.length);

  let output = "";
  for (let i = 0; i < text.length; i++) {
    const revealIndex = revealOrder[i];
    let glyph = text[i];

    if (revealIndex >= revealedCount && animation !== ANIMATIONS.STAY) {
      glyph = " ";
    }
    if (glyph !== " " && revealIndex >= resolvedCount) {
      glyph = rng.pick(glyphs);
    }

    output += glyph;
  }

  return { output, complete };
};

/**
 * Reveals (or hides) `text` character-by-character behind
 * randomized glyphs, on an eased timing curve.
 *
 * @returns {{ cancel: () => void }}
 */
export const shuffle = ({
  text = "",
  duration = 1,
  delay = 0,
  delayResolve = 0.2,
  fps = 60,
  glyphs = DEFAULT_GLYPHS,
  animation = ANIMATIONS.SHOW,
  direction = DIRECTIONS.RIGHT,
  anchor,
  seed,
  onUpdate = null,
  onComplete = null,
} = {}) => {
  const glyphList = glyphs.split("");
  const rng = resolveRandom(seed);
  const effectiveDirection = animation === ANIMATIONS.HIDE ? flipDirection(direction) : direction;
  const revealOrder = buildRevealOrder({
    length: text.length,
    text,
    direction: effectiveDirection,
    seed,
    anchor,
  });
  const frameConfig = {
    text,
    revealOrder,
    glyphs: glyphList,
    delay,
    delayResolve,
    animation,
    rng,
  };

  const start = performance.now();

  const ticker = createTicker({
    fps,
    onFrame: (now) => {
      const t = ((now - start) * 0.001) / duration;
      const { output, complete } = resolveFrame(frameConfig, t);

      if (onUpdate) onUpdate(output);
      if (complete && onComplete) onComplete(output);

      return !complete;
    },
  });

  return { cancel: ticker.cancel };
};
