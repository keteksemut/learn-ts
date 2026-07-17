/**
 * The two math helpers the original file pulled in from
 * canvas-sketch-util/math. Reimplemented directly rather than kept
 * as a dependency — both are a few lines of pure arithmetic, so the
 * dependency was buying very little. Formulas match
 * canvas-sketch-util's exactly (same clamp/mod semantics), so
 * nothing about the animations' timing or wrapping changes.
 */

export const clamp = (value, min, max) =>
  min < max
    ? value < min
      ? min
      : value > max
        ? max
        : value
    : value < max
      ? max
      : value > min
        ? min
        : value;

export const clamp01 = (value) => clamp(value, 0, 1);

// Always returns a result with the same sign as `b`, unlike the `%`
// operator — e.g. mod(-1, 5) is 4, not -1. That's what lets a
// negative or out-of-range glyph index wrap around safely instead of
// indexing off the front of the glyph string.
export const mod = (a, b) => ((a % b) + b) % b;
