// Plain-Node sanity suite for text-shuffle — no test framework
// required, just `node text-shuffle.test.js`.

import assert from "node:assert";
import { resolveRandom } from "./random.js";
import * as lib from "./index.js";
import { resolveFrame } from "./textShuffle.js";
import { step } from "./textShuffleScroll.js";
import { buildRevealOrder } from "./revealOrder.js";

global.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 1000 / 60);
global.cancelAnimationFrame = (id) => clearTimeout(id);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ---------- mathUtils / easing ----------
// These used to be someone else's tested code (canvas-sketch-util,
// eases). Now that the formulas live here, they get their own
// direct coverage instead of only being exercised indirectly through
// resolveFrame/step.

test("mathUtils: clamp01 clamps into [0, 1]", async () => {
  const { clamp01 } = await import("./mathUtils.js");
  assert.strictEqual(clamp01(-5), 0);
  assert.strictEqual(clamp01(5), 1);
  assert.strictEqual(clamp01(0.3), 0.3);
});

test("mathUtils: mod always returns a same-sign-as-divisor result", async () => {
  const { mod } = await import("./mathUtils.js");
  assert.strictEqual(mod(-1, 5), 4);
  assert.strictEqual(mod(7, 5), 2);
  assert.strictEqual(mod(0, 5), 0);
});

test("easing: quartOut and quadInOut both map 0 to 0 and 1 to 1", async () => {
  const { quartOut, quadInOut } = await import("./easing.js");
  assert.strictEqual(quartOut(0), 0);
  assert.strictEqual(quartOut(1), 1);
  assert.strictEqual(quadInOut(0), 0);
  assert.strictEqual(quadInOut(1), 1);
});

test("random: same seed gives the same sequence, different seeds don't", () => {
  const a = resolveRandom(42);
  const b = resolveRandom(42);
  const c = resolveRandom(7);
  const draw = (rng) => Array.from({ length: 5 }, () => rng.value());
  assert.deepStrictEqual(draw(a), draw(b));
  assert.notDeepStrictEqual(draw(a), draw(c));
});

test("random: shuffle is a permutation and doesn't mutate the input", () => {
  const rng = resolveRandom(1);
  const original = [1, 2, 3, 4, 5, 6];
  const shuffled = rng.shuffle(original);
  assert.deepStrictEqual(original, [1, 2, 3, 4, 5, 6]);
  assert.deepStrictEqual([...shuffled].sort(), [...original].sort());
});

// ---------- public shape ----------

test("exports every effect, old and new, under the same top-level shape", () => {
  assert.deepStrictEqual(lib.animations, { SHOW: "show", HIDE: "hide", STAY: "stay" });
  assert.deepStrictEqual(lib.directions, {
    RIGHT: "right",
    LEFT: "left",
    RANDOM: "random",
    CENTER_OUT: "center-out",
    EDGES_IN: "edges-in",
    WORD_BY_WORD: "word-by-word",
  });
  ["shuffle", "shuffleScroll", "wave", "glitch", "typewriter", "morph", "spotlight"].forEach(
    (name) => assert.strictEqual(typeof lib[name], "function", `${name} should be a function`),
  );
  assert.strictEqual(typeof lib.default.shuffle, "function", "default export should also work");
});

// ---------- buildRevealOrder (shared by shuffle, shuffleScroll, wave, typewriter) ----------

test("buildRevealOrder: right is identity, left is reversed", () => {
  assert.deepStrictEqual(buildRevealOrder({ length: 5, direction: lib.directions.RIGHT }), [
    0, 1, 2, 3, 4,
  ]);
  assert.deepStrictEqual(buildRevealOrder({ length: 5, direction: lib.directions.LEFT }), [
    4, 3, 2, 1, 0,
  ]);
});

test("buildRevealOrder: center-out starts at the middle, edges-in ends there", () => {
  const co = buildRevealOrder({ length: 5, direction: lib.directions.CENTER_OUT });
  assert.strictEqual(co[2], 0);
  assert.strictEqual(Math.max(...co), 4);

  const ei = buildRevealOrder({ length: 5, direction: lib.directions.EDGES_IN });
  assert.strictEqual(ei[2], 4);
  assert.strictEqual(Math.min(ei[0], ei[4]), 0);
});

test("buildRevealOrder: center-out respects a custom anchor", () => {
  const anchored = buildRevealOrder({ length: 6, direction: lib.directions.CENTER_OUT, anchor: 0 });
  assert.strictEqual(anchored[0], 0);
  assert.strictEqual(anchored[5], 5);
});

test("buildRevealOrder: word-by-word keeps a word's ranks together and in order", () => {
  const order = buildRevealOrder({
    length: 6,
    text: "GO NOW",
    direction: lib.directions.WORD_BY_WORD,
  });
  assert.strictEqual(order[0], order[1], "both letters of GO share a rank");
  assert.deepStrictEqual(
    [order[3], order[4], order[5]],
    [order[3], order[3], order[3]],
    "NOW shares one rank",
  );
  assert.ok(order[3] > order[0], "NOW resolves after GO");
});

test("buildRevealOrder: same seed gives the same random order, twice", () => {
  const a = buildRevealOrder({ length: 8, direction: lib.directions.RANDOM, seed: 42 });
  const b = buildRevealOrder({ length: 8, direction: lib.directions.RANDOM, seed: 42 });
  assert.deepStrictEqual(a, b);
});

// ---------- resolveFrame (shuffle's pure per-frame function) ----------

test("resolveFrame is pure: plain numbers in, a string out, no timers", () => {
  const config = {
    text: "HELLO",
    revealOrder: [0, 1, 2, 3, 4],
    glyphs: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
    delay: 0,
    delayResolve: 0.2,
    animation: lib.animations.SHOW,
    rng: resolveRandom(),
  };
  assert.strictEqual(resolveFrame(config, 0).complete, false);
  assert.deepStrictEqual(resolveFrame(config, 1), { output: "HELLO", complete: true });
});

// ---------- step (shuffleScroll's per-frame reducer) ----------

test("step advances a SHOW state machine to the resolved text", () => {
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const text = "HI";
  const targetIndices = text.split("").map((c) => glyphs.indexOf(c));
  const state = {
    text,
    glyphs,
    targetIndices,
    currentIndices: targetIndices.map(() => 0),
    animation: lib.animations.SHOW,
    order: [0, 1],
    frame: 0,
  };

  let result;
  for (let frame = 0; frame < 200; frame++) {
    state.frame = frame;
    result = step(state);
    if (result.complete) break;
  }

  assert.strictEqual(result.complete, true);
  assert.strictEqual(result.output, "HI");
});

// ---------- shuffleScroll ----------

test("shuffleScroll throws when text has a character glyphs doesn't have", () => {
  assert.throws(() => lib.shuffleScroll({ text: "Hi!", glyphs: "Hi " }), /missing/);
});

test("shuffleScroll(): runs end-to-end and reports the final text on completion", async () => {
  const finalText = await new Promise((resolve) => {
    lib.shuffleScroll({ text: "HELLO", glyphs: "HELO ", onComplete: resolve });
  });
  assert.strictEqual(finalText, "HELLO");
});

test("shuffleScroll(): now supports direction (used to always be raw left-to-right)", async () => {
  const results = await Promise.all(
    Object.values(lib.directions).map(
      (direction) =>
        new Promise((resolve) => {
          lib.shuffleScroll({
            text: "DIRECTION",
            glyphs: "DIRECTON ",
            direction,
            onComplete: resolve,
          });
        }),
    ),
  );
  results.forEach((finalText) => assert.strictEqual(finalText, "DIRECTION"));
});

// ---------- shuffle ----------

test("shuffle(): runs end-to-end and reports the final text on completion", async () => {
  const updates = [];
  const finalText = await new Promise((resolve) => {
    lib.shuffle({
      text: "READY",
      duration: 0.1,
      onUpdate: (out) => updates.push(out),
      onComplete: resolve,
    });
  });
  assert.strictEqual(finalText, "READY");
  assert.ok(updates.length > 1, "onUpdate should fire more than once across the animation");
});

test("cancel() stops further onUpdate calls", async () => {
  let updateCount = 0;
  const { cancel } = lib.shuffle({
    text: "STOP ME",
    duration: 5,
    onUpdate: () => updateCount++,
  });

  await new Promise((resolve) => setTimeout(resolve, 50));
  cancel();
  const countAtCancel = updateCount;

  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.strictEqual(updateCount, countAtCancel, "no further updates should fire after cancel()");
});

// ---------- wave ----------

test("wave(): has no onComplete and keeps updating until cancelled", async () => {
  let updateCount = 0;
  const { cancel } = lib.wave({ text: "LOOP", periodMs: 100, onUpdate: () => updateCount++ });

  await new Promise((resolve) => setTimeout(resolve, 250));
  cancel();
  const countAtCancel = updateCount;
  assert.ok(countAtCancel > 3, "wave should have produced several updates by now");

  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.strictEqual(updateCount, countAtCancel, "no further updates should fire after cancel()");
});

// ---------- glitch ----------

test("glitch(): always resolves back to the exact original text", async () => {
  let sawADifferentFrame = false;
  const finalText = await new Promise((resolve) => {
    lib.glitch({
      text: "STABLE",
      duration: 0.15,
      intensity: 0.8,
      onUpdate: (out) => {
        if (out !== "STABLE") sawADifferentFrame = true;
      },
      onComplete: resolve,
    });
  });
  assert.strictEqual(finalText, "STABLE");
  assert.ok(sawADifferentFrame, "a high-intensity glitch should visibly perturb at least one frame");
});

// ---------- typewriter ----------

test("typewriter(): resolves strictly left to right, one character ahead of the next", async () => {
  const snapshots = [];
  const finalText = await new Promise((resolve) => {
    lib.typewriter({
      text: "ABCDE",
      flickerFrames: 2,
      holdFrames: 1,
      onUpdate: (out) => snapshots.push(out),
      onComplete: resolve,
    });
  });
  assert.strictEqual(finalText, "ABCDE");

  for (const snap of snapshots) {
    let seenUnresolved = false;
    for (let i = 0; i < snap.length; i++) {
      const isResolved = snap[i] === "ABCDE"[i];
      if (!isResolved) seenUnresolved = true;
      else if (seenUnresolved) {
        assert.fail(`character ${i} resolved before an earlier character in "${snap}"`);
      }
    }
  }
});

// ---------- morph ----------

test("morph(): dissolves `from` and resolves into `to`", async () => {
  const seen = [];
  const finalText = await new Promise((resolve) => {
    lib.morph({
      from: "MENU",
      to: "EXIT",
      hideDuration: 0.08,
      showDuration: 0.08,
      onUpdate: (out) => seen.push(out),
      onComplete: resolve,
    });
  });
  assert.strictEqual(finalText, "EXIT");
  assert.ok(seen.includes(""), "should pass through a fully-hidden frame between the two words");
});

test("morph(): cancel() reaches whichever phase is currently running", async () => {
  let updateCount = 0;
  const { cancel } = lib.morph({
    from: "MENU",
    to: "EXIT",
    hideDuration: 5,
    showDuration: 5,
    onUpdate: () => updateCount++,
  });

  await new Promise((resolve) => setTimeout(resolve, 50));
  cancel();
  const countAtCancel = updateCount;

  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.strictEqual(updateCount, countAtCancel, "no further updates should fire after cancel()");
});

// ---------- spotlight ----------

test("spotlight(): reveals only characters within radius of the focus, nothing with no focus", () => {
  const s = lib.spotlight({ text: "HELLO WORLD", radius: 1, seed: 1 });

  const noFocus = s.render();
  assert.notStrictEqual(noFocus, "HELLO WORLD", "nothing should be revealed with no focus set");

  s.setFocus(0);
  const focused = s.render();
  assert.strictEqual(focused[0], "H", "the focused character should be revealed");
  assert.notStrictEqual(focused[10], "D", "a character far from focus should still be scrambled");
});

// ---------- run ----------

let failed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok   - ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL - ${name}`);
    console.log(err);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
if (failed > 0) process.exit(1);
