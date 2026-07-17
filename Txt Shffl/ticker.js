/**
 * Runs `onFrame` at a throttled rate via requestAnimationFrame.
 *
 * `onFrame(now)` receives the timestamp requestAnimationFrame hands
 * its callback for free — a high-resolution value on the same clock
 * as `performance.now()`.
 *
 * Return `true` from `onFrame` to keep going, `false` once the
 * animation is finished.
 *
 * @param {{ fps?: number, onFrame: (now: number) => boolean }} options
 * @returns {{ cancel: () => void }} handle to stop the loop early
 */
export const createTicker = ({ fps = 60, onFrame }) => {
  const frameDuration = 1000 / fps;
  let lastFrameTime = performance.now();
  let rafId = null;
  let cancelled = false;

  const tick = (now) => {
    if (cancelled) return;

    if (now - lastFrameTime >= frameDuration) {
      lastFrameTime = now;
      if (!onFrame(now)) return;
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return {
    cancel() {
      cancelled = true;
      if (rafId != null) cancelAnimationFrame(rafId);
    },
  };
};
