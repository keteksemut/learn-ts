/**
 * The two easing curves textShuffle.js needs, reimplemented from
 * the `eases` package rather than kept as a dependency — same
 * reasoning as mathUtils.js. Formulas match `eases` exactly.
 *
 * Both take a linear 0..1 progress value `t` and return a "how far
 * along does this actually look" value — quartOut starts fast and
 * settles in slowly (used for the reveal/hide curve), quadInOut
 * starts slow, speeds up, and settles again (used for the
 * flicker-to-settle curve that trails slightly behind it).
 */

export const quartOut = (t) => Math.pow(t - 1, 3) * (1 - t) + 1;

export const quadInOut = (t) => {
  const x = t / 0.5;
  if (x < 1) return 0.5 * x * x;
  const y = x - 1;
  return -0.5 * (y * (y - 2) - 1);
};
