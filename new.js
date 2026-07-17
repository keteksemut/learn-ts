const MAX_INPUT_LENGTH = 10_000;

// Named char-code constants replace the bare numbers in the tokeniser switch.
// The original comment "// / % = ^" on case 94 was also misleading—94 is only ^.
const CC = {
  Digit0: 48,
  Digit9: 57,
  Dot: 46,
  LParen: 40,
  RParen: 41,
  Space: 32,
  Tab: 9,
  LF: 10,
  CR: 13, // CR was missing in original
  Plus: 43,
  Minus: 45,
  Star: 42,
  Slash: 47,
  Pct: 37,
  Equal: 61,
  Caret: 94,
  SurrHiLo: 0xd800,
  SurrHiHi: 0xdbff, // surrogate-pair bounds
} as const;

// ─── types ───────────────────────────────────────────────────────────────────

/** Internal-only transient produced by tokenize(); never exposed publicly. */
type DecTok = { readonly type: "dec"; readonly val: "." };

/**
 * Public token type.  `dec` is intentionally absent: after normalizeTokens()
 * every decimal point has been merged into a `num` or downgraded to `unk`.
 * `ops.val` is a closed union instead of `string` so exhaustiveness checks work.
 */
type Tok =
  | { readonly type: "num"; readonly val: string }
  | {
      readonly type: "ops";
      readonly val: "+" | "-" | "*" | "/" | "%" | "=" | "^";
    }
  | { readonly type: "par"; readonly val: "(" | ")" }
  | { readonly type: "unk"; readonly val: string }
  | { readonly type: "uny"; readonly val: "+" | "-" };

/** Internal token stream (includes the transient `dec` kind). */
type RawTok = Tok | DecTok;

/**
 * Structured error type replaces the bare `hasError: boolean`.
 * Callers can act on `kind` and `index` without string-matching a message.
 */
type ValidationError =
  | { readonly kind: "empty" }
  | { readonly kind: "unbalanced_paren"; readonly depth: number }
  | {
      readonly kind: "trailing_operator";
      readonly index: number;
      readonly token: Tok;
    }
  | {
      readonly kind: "unexpected_token";
      readonly index: number;
      readonly token: Tok;
    };

type NormalizeResult =
  | { readonly ok: true; readonly tokens: Tok[] }
  | { readonly ok: false; readonly error: ValidationError };

// ─── unicode digit normalisation ─────────────────────────────────────────────

/**
 * Stateless single-character digit test — NO /g FLAG.
 *
 * A /g regex retains `lastIndex` across calls.  In a per-iteration loop that
 * creates a fresh one-character string each time, the pattern alternates:
 *   call 1 → matches at 0, lastIndex becomes 1, returns true
 *   call 2 → starts at position 1 of a 1-char string, no match, resets to 0, returns FALSE
 *   call 3 → matches again … and so on, alternating true/false.
 * The original getZeroBase walked back only ONE step instead of reaching the
 * true block boundary, making every non-ASCII digit return the wrong base.
 */
const DIGIT_SINGLE = /^\p{Nd}$/u;

/** Memoises the "zero" code point for each visited Unicode digit block. */
const _zeroBases = new Set<number>();

/**
 * Returns the code point of "0" for the Unicode decimal digit block containing `ch`.
 *
 * @throws {RangeError} if `ch` is empty or not a decimal digit.
 */
function getZeroBase(ch: string): number {
  const cp = ch.codePointAt(0);
  if (cp === undefined) throw new RangeError("getZeroBase: empty string");

  for (const base of _zeroBases) {
    if (cp >= base && cp - base <= 9) return base;
  }

  if (!DIGIT_SINGLE.test(ch)) {
    throw new RangeError(
      `getZeroBase: U+${cp.toString(16).toUpperCase().padStart(4, "0")} is not \\p{Nd}`,
    );
  }

  // Walk back through the block.  DIGIT_SINGLE has no /g, so every call is
  // fully stateless — lastIndex is never touched.
  let p = cp;
  while (p > 0 && DIGIT_SINGLE.test(String.fromCodePoint(p - 1))) p--;

  _zeroBases.add(p);
  return p;
}

/**
 * Converts every Unicode decimal digit in `str` to its ASCII equivalent.
 *
 * Uses a regex literal (fresh object per call in ES2015+) rather than a
 * shared module-level /g regex, so `lastIndex` is always 0 at entry and
 * cannot be corrupted by the getZeroBase calls inside the replace callback.
 */
function normalizeDigits(str: string): string {
  return str.replace(/\p{Nd}/gu, (ch) => {
    if (ch >= "0" && ch <= "9") return ch;
    return String(ch.codePointAt(0)! - getZeroBase(ch));
  });
}

// ─── tokeniser ───────────────────────────────────────────────────────────────

/**
 * Converts an ASCII-normalised expression string into a raw token array.
 * Call normalizeDigits() on the input before this function.
 *
 * Non-BMP code points (surrogate pairs) are emitted as a single `unk` token
 * so we never split a code point at a UTF-16 boundary.
 *
 * @throws {RangeError} if src.length > MAX_INPUT_LENGTH.
 */
function tokenize(src: string): RawTok[] {
  if (src.length > MAX_INPUT_LENGTH) {
    throw new RangeError(
      `tokenize: input length ${src.length} exceeds MAX_INPUT_LENGTH (${MAX_INPUT_LENGTH})`,
    );
  }

  const n = src.length;
  const out = new Array<RawTok>(n); // worst-case allocation; trimmed below
  let outIdx = 0;
  let numStart = -1;

  const flushNum = (end: number): void => {
    if (numStart !== -1) {
      out[outIdx++] = { type: "num", val: src.slice(numStart, end) };
      numStart = -1;
    }
  };

  for (let i = 0; i < n; i++) {
    const c = src.charCodeAt(i);

    if (c >= CC.Digit0 && c <= CC.Digit9) {
      if (numStart === -1) numStart = i;
      continue;
    }

    flushNum(i);

    switch (c) {
      case CC.Dot:
        out[outIdx++] = { type: "dec", val: "." };
        break;
      case CC.LParen:
        out[outIdx++] = { type: "par", val: "(" };
        break;
      case CC.RParen:
        out[outIdx++] = { type: "par", val: ")" };
        break;
      case CC.Space:
      case CC.Tab:
      case CC.LF:
      case CC.CR:
        break; // whitespace
      case CC.Plus:
        out[outIdx++] = { type: "ops", val: "+" };
        break;
      case CC.Minus:
        out[outIdx++] = { type: "ops", val: "-" };
        break;
      case CC.Star:
        out[outIdx++] = { type: "ops", val: "*" };
        break;
      case CC.Slash:
        out[outIdx++] = { type: "ops", val: "/" };
        break;
      case CC.Pct:
        out[outIdx++] = { type: "ops", val: "%" };
        break;
      case CC.Equal:
        out[outIdx++] = { type: "ops", val: "=" };
        break;
      case CC.Caret:
        out[outIdx++] = { type: "ops", val: "^" };
        break;
      default:
        if (c >= CC.SurrHiLo && c <= CC.SurrHiHi && i + 1 < n) {
          // High surrogate: consume both code units as one unk token.
          out[outIdx++] = { type: "unk", val: src.slice(i, i + 2) };
          i++;
        } else {
          out[outIdx++] = { type: "unk", val: src[i] };
        }
    }
  }

  flushNum(n);
  out.length = outIdx;
  return out;
}

// ─── token normalisation ─────────────────────────────────────────────────────

/** "007" → "7"  |  "00.5" → "0.5"  |  "0" → "0"  |  "0.5" → "0.5" */
function stripLeadingZeros(val: string): string {
  if (val.length === 1 || val[0] !== "0" || val[1] === ".") return val;
  const dotIdx = val.indexOf(".");
  const intEnd = dotIdx === -1 ? val.length : dotIdx;
  let nz = 1;
  while (nz < intEnd && val[nz] === "0") nz++;
  const intPart = nz === intEnd ? "0" : val.slice(nz, intEnd);
  return dotIdx === -1 ? intPart : intPart + val.slice(dotIdx);
}

/**
 * Single-pass normalisation combining the three previously dead-code functions
 * (mergeDecimals, markUnaryOps, stripLeadingZeros) into one coherent pass.
 *
 *   1. Decimal fusion:    num dec num → num  |  dec num → 0.num  |  num dec → num.0
 *   2. Unary detection:   leading +/- become `uny` tokens
 *   3. Zero stripping:    "007" → "7"
 */
function normalizeTokens(tokens: readonly RawTok[]): Tok[] {
  const out: Tok[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // ── 1. Decimal-point fusion ────────────────────────────────────────────
    if (token.type === "dec") {
      const last = out.length > 0 ? out[out.length - 1] : undefined;
      const lastIsNum = last?.type === "num";
      const right = i + 1 < tokens.length ? tokens[i + 1] : undefined;
      const rightIsNum = right?.type === "num";

      if (lastIsNum && rightIsNum) {
        if (!(last!.val as string).includes(".")) {
          out[out.length - 1] = {
            type: "num",
            val: `${last!.val}.${right!.val}`,
          };
          i++;
        } else {
          out.push({ type: "unk", val: "." }); // second decimal → invalid
        }
      } else if (lastIsNum) {
        if ((last!.val as string).includes("."))
          out.push({ type: "unk", val: "." }); // trailing dot after decimal → invalid
        else out[out.length - 1] = { type: "num", val: `${last!.val}.0` }; // "3." → "3.0"
      } else if (rightIsNum) {
        out.push({ type: "num", val: `0.${right!.val}` }); // ".5" → "0.5"
        i++;
      } else {
        out.push({ type: "unk", val: "." });
      }
      continue;
    }

    // ── 2. Unary-operator detection ────────────────────────────────────────
    if (token.type === "ops" && (token.val === "+" || token.val === "-")) {
      const last = out.length > 0 ? out[out.length - 1] : undefined;
      if (
        last === undefined ||
        last.type === "ops" ||
        last.type === "uny" ||
        (last.type === "par" && last.val === "(")
      ) {
        out.push({ type: "uny", val: token.val });
        continue;
      }
    }

    // ── 3. Leading-zero stripping ──────────────────────────────────────────
    out.push(
      token.type === "num"
        ? { type: "num", val: stripLeadingZeros(token.val) }
        : (token as Tok), // safe: `dec` is fully handled above
    );
  }

  return out;
}

// ─── validation ──────────────────────────────────────────────────────────────

/**
 * Validates a fully-normalised token stream.
 *
 * Checks (returns the first error encountered):
 *   – Non-empty
 *   – Does not begin with a binary operator
 *   – Does not end with an operator or unary prefix
 *   – Contains no `unk` tokens
 *   – Parentheses are balanced and never empty
 *   – No adjacent "value" tokens — catches `3 5`, `3(4)`, `)(` (was missing)
 *   – No adjacent binary operators (`3 * * 5`)
 */
function validate(tokens: Tok[]): NormalizeResult {
  if (tokens.length === 0) return { ok: false, error: { kind: "empty" } };

  if (tokens[0].type === "ops")
    return {
      ok: false,
      error: { kind: "unexpected_token", index: 0, token: tokens[0] },
    };

  const last = tokens[tokens.length - 1];
  if (last.type === "ops" || last.type === "uny")
    return {
      ok: false,
      error: {
        kind: "trailing_operator",
        index: tokens.length - 1,
        token: last,
      },
    };

  let depth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const prev = i > 0 ? tokens[i - 1] : undefined;

    if (tok.type === "unk")
      return {
        ok: false,
        error: { kind: "unexpected_token", index: i, token: tok },
      };

    if (tok.type === "par") {
      if (tok.val === "(") {
        depth++;
      } else {
        if (--depth < 0)
          return { ok: false, error: { kind: "unbalanced_paren", depth } };
        if (
          prev &&
          (prev.type === "ops" ||
            prev.type === "uny" ||
            (prev.type === "par" && prev.val === "("))
        )
          return {
            ok: false,
            error: { kind: "unexpected_token", index: i, token: tok },
          };
      }
    }

    // Missing-operator guard: two consecutive "value" tokens.
    if (prev !== undefined) {
      const prevEndsVal =
        prev.type === "num" || (prev.type === "par" && prev.val === ")");
      const tokStartsVal =
        tok.type === "num" || (tok.type === "par" && tok.val === "(");
      if (prevEndsVal && tokStartsVal)
        return {
          ok: false,
          error: { kind: "unexpected_token", index: i, token: tok },
        };
    }

    if (prev && tok.type === "ops" && prev.type === "ops")
      return {
        ok: false,
        error: { kind: "unexpected_token", index: i, token: tok },
      };
  }

  if (depth !== 0)
    return { ok: false, error: { kind: "unbalanced_paren", depth } };

  return { ok: true, tokens };
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Parses and normalises an expression string.
 *
 * Pipeline: normalizeDigits → tokenize → normalizeTokens → validate
 *
 * @param src  Raw expression; Unicode decimal digits (Arabic-Indic, Devanagari …) are accepted.
 * @returns    {ok: true, tokens} on success, {ok: false, error} on failure.
 * @throws {TypeError}  if src is not a string.
 * @throws {RangeError} if src.length > MAX_INPUT_LENGTH.
 *
 * @example
 *   normalize("3.14+.5")  // {ok:true,  tokens:[num 3.14, ops +, num 0.5]}
 *   normalize("-99")       // {ok:true,  tokens:[uny -, num 99]}
 *   normalize("٣+٥")      // {ok:true,  tokens:[num 3, ops +, num 5]}  ← Unicode fixed
 *   normalize("3.1.4")    // {ok:false, error:{kind:"unexpected_token", index:1}}
 *   normalize("3 5")      // {ok:false, error:{kind:"unexpected_token", index:1}}  ← new check
 */
function normalize(src: string): NormalizeResult {
  if (typeof src !== "string")
    throw new TypeError(`normalize: expected string, got ${typeof src}`);
  return validate(normalizeTokens(tokenize(normalizeDigits(src))));
}

// expression-evaluator.ts
// ─────────────────────────────────────────────────────────────────────────────
// Engine: Iterative Band-Fold (IBF)
//
// Beda dari dua algoritma mainstream:
//
//   Pratt         Recursive descent. Satu call-frame per operator/operand.
//                 Overhead tumbuh linear dengan kedalaman ekspresi.
//                 Tiap "nud"/"led" lookup = indirect function dispatch.
//
//   Shunting-Yard Dua fase: (1) bangun postfix queue, (2) evaluasi queue.
//                 Queue isi object Token → alokasi heap, pointer chasing.
//
//   IBF           Satu pass kiri-ke-kanan. Zero rekursi. Zero postfix queue.
//                 Dua typed-array stack (Float64 + Int32) → semua nilai
//                 intermediate tersimpan unboxed, contiguous di memori.
//                 Unary chains (--+-) diserap sign accumulator ±1 → tidak
//                 pernah menyentuh salah satu stack.
//                 -(…) ditangani PAREN_NEG sentinel, bukan slot unary terpisah.
//
// Kompleksitas: O(n) waktu · O(d) ruang tambahan (d = kedalaman paren)
// ─────────────────────────────────────────────────────────────────────────────

// ─── tipe hasil ──────────────────────────────────────────────────────────────

type EvalResult =
  | { readonly ok: true; readonly val: number }
  | { readonly ok: false; readonly error: string };

// ─── tabel operator biner ────────────────────────────────────────────────────

/**
 * Opcode operator biner — disimpan di nibble bawah (bit 0–3) tiap slot Int32.
 * Nilai 0 dicadangkan untuk sentinel parenthesis; BOp dimulai dari 1.
 */
const enum BOp {
  Add = 1,
  Sub = 2,
  Mul = 3,
  Div = 4,
  Mod = 5,
  Pow = 6,
}

interface BOpMeta {
  readonly prec: number; // 1 = aditif … 3 = pangkat
  readonly rAssoc: boolean; // true → kanan-asosiatif (hanya ^)
  readonly bop: BOp;
}

/**
 * Lookup table operator ke metadata.
 * Object literal kecil + key string → V8 menggunakan hidden-class lookup,
 * bukan linear scan.  Untuk 6 operator, ini praktis O(1).
 */
const BOPS: { readonly [k: string]: BOpMeta | undefined } = {
  "+": { prec: 1, rAssoc: false, bop: BOp.Add },
  "-": { prec: 1, rAssoc: false, bop: BOp.Sub },
  "*": { prec: 2, rAssoc: false, bop: BOp.Mul },
  "/": { prec: 2, rAssoc: false, bop: BOp.Div },
  "%": { prec: 2, rAssoc: false, bop: BOp.Mod },
  "^": { prec: 3, rAssoc: true, bop: BOp.Pow },
} as const;

// ─── encoding slot op-stack ──────────────────────────────────────────────────
//
//  Slot normal (operator biner) — nilai ≥ 1:
//    bit  0–3 : BOp opcode  (1–6)
//    bit  4–6 : precedence  (1–3)
//    bit  7   : right-associative flag
//
//  Sentinel slot (parenthesis) — nilai ≤ 0:
//    PAREN     =  0   grup biasa; tidak ada flip tanda pada penutupan
//    PAREN_NEG = -1   grup dengan pending negasi (dari unary '-' sebelum '(')
//
// Karena BOp dimulai dari 1, encoding biner selalu menghasilkan nilai ≥ 1.
// Ini memisahkan sentinel dari slot normal tanpa bit flag tambahan.

const PAREN = 0;
const PAREN_NEG = -1;

/** Packs BOpMeta menjadi satu integer untuk disimpan di Int32Array. */
function encodeOp(m: BOpMeta): number {
  return m.bop | (m.prec << 4) | (m.rAssoc ? 0x80 : 0);
}
const slotPrec = (s: number): number => (s >>> 4) & 0x07;
const slotRAssoc = (s: number): boolean => (s & 0x80) !== 0;
const slotBop = (s: number): BOp => (s & 0x0f) as BOp;

// ─── aritmatika ──────────────────────────────────────────────────────────────

/**
 * Terapkan operator biner ke dua operand.
 * Mengikuti semantik IEEE 754: 1/0 → Infinity, 0/0 → NaN, dst.
 * Math.pow dipakai untuk ^ agar konsisten dengan Number spec (termasuk
 * (-1)^0.5 → NaN, bukan bilangan kompleks).
 */
function applyBOp(bop: BOp, a: number, b: number): number {
  switch (bop) {
    case BOp.Add:
      return a + b;
    case BOp.Sub:
      return a - b;
    case BOp.Mul:
      return a * b;
    case BOp.Div:
      return a / b;
    case BOp.Mod:
      return a % b;
    case BOp.Pow:
      return Math.pow(a, b);
  }
}

// ─── evaluator inti ──────────────────────────────────────────────────────────

/**
 * Evaluasi token stream yang sudah divalidasi menggunakan algoritma IBF.
 *
 * ── Cara kerja IBF ────────────────────────────────────────────────────────
 *
 * Dua typed-array stack dipertahankan secara bersamaan:
 *
 *   valStack  (Float64Array)
 *     Menyimpan hasil numerik intermediate.  Float64Array berarti nilai
 *     double tidak pernah "di-box" menjadi JS object → zero GC pressure
 *     untuk nilai stack.
 *
 *   opStack   (Int32Array)
 *     Menyimpan operator biner yang pending, dikodekan sebagai integer
 *     bit-pack (prec + assoc + opcode dalam 8 bit).  Nilai ≤ 0 adalah
 *     sentinel parenthesis (PAREN / PAREN_NEG).
 *
 * Sign accumulator  (integer ±1)
 *     Menyerap rangkaian token `uny` berturut-turut menjadi scalar tunggal.
 *     Contoh: "---+" → sign = -1.  Tidak ada stack push sama sekali untuk
 *     unary.  Sign diterapkan saat nilai di-commit ke valStack (dari `num`
 *     atau penutupan `)`).
 *
 * PAREN_NEG sentinel
 *     Jika sign = -1 saat kita bertemu `(`, kita push PAREN_NEG ke opStack
 *     (bukan PAREN) dan reset sign = 1.  Saat `)` menutup grup tersebut,
 *     kita negate hasil grup.  Ini menangani -(…) tanpa slot stack tambahan.
 *
 * Band-fold
 *     Saat operator biner baru tiba, semua operator pending di opStack
 *     dengan precedence ≥ (atau > untuk kanan-asosiatif) langsung "dilipat":
 *     dua nilai top valStack di-pop, dihitung, hasilnya di-push balik.
 *     "Band" = semua op dengan precedence sama yang berkumpul sebelum
 *     operator baru yang lebih rendah tiba.
 *
 * ── Konvensi unary minus ──────────────────────────────────────────────────
 *
 *   Sign accumulator menerapkan '-' langsung ke nilai berikutnya.
 *   Akibatnya:  -3^2  dihitung sebagai  (-3)^2 = 9  (konvensi kalkulator).
 *   Matematika formal: -3^2 = -(3^2) = -9.
 *   Ekspresi (-3)^2 tetap menghasilkan 9 dan -(3^2) tetap -9 sesuai harapan
 *   — hanya ekspresi ambiguous "-3^2" yang berbeda dari notasi formal.
 */
function evalTokens(tokens: Tok[]): EvalResult {
  const n = tokens.length;
  if (n === 0) return { ok: false, error: "token stream kosong" };

  // ── alokasi stack ─────────────────────────────────────────────────────────
  //
  // Kasus terburuk: token bergantian num/op tanpa paren → ⌈n/2⌉ slot value
  // dan ⌈n/2⌉ slot op.  Tambah 2 untuk safety margin.
  //
  // Float64Array: tiap slot = 8 byte di memori kontinyu.
  // Int32Array:   tiap slot = 4 byte di memori kontinyu.
  // Keduanya dialokasi sekali dan tidak pernah di-resize.
  const valStack = new Float64Array((n >>> 1) + 2);
  const opStack = new Int32Array(n + 2);
  let vsp = 0; // value stack pointer  (slot kosong berikutnya)
  let osp = 0; // op    stack pointer

  // Sign accumulator: ±1.
  let sign = 1;

  // ── helper inner ──────────────────────────────────────────────────────────
  //
  // Closure atas variabel lokal di atas.  V8 JIT menginline closure pendek
  // yang hanya dipanggil dari satu call-site ke activation record pemanggil,
  // sehingga tidak ada overhead indirect call saat hot.

  /**
   * Pop satu operator biner dan dua nilai teratas; push hasilnya.
   * Dipanggil hanya setelah guard (osp > 0 dan top bukan sentinel).
   */
  const fold = (): string | null => {
    if (vsp < 2) return "stack underflow — ekspresi malformed";
    const enc = opStack[--osp];
    const b = valStack[--vsp];
    const a = valStack[--vsp];
    valStack[vsp++] = applyBOp(slotBop(enc), a, b);
    return null;
  };

  /**
   * Fold semua op pending yang precedence-nya memenuhi relasi terhadap `prec`:
   *   kiri-asosiatif  → fold selama topPrec ≥ prec
   *   kanan-asosiatif → fold selama topPrec > prec
   * Berhenti di sentinel parenthesis.
   */
  const foldPending = (prec: number, rAssoc: boolean): string | null => {
    while (osp > 0) {
      const top = opStack[osp - 1];
      if (top === PAREN || top === PAREN_NEG) break;
      const shouldFold = rAssoc ? slotPrec(top) > prec : slotPrec(top) >= prec;
      if (!shouldFold) break;
      const err = fold();
      if (err !== null) return err;
    }
    return null;
  };

  // ── scan utama ────────────────────────────────────────────────────────────

  for (let i = 0; i < n; i++) {
    const tok = tokens[i];

    switch (tok.type) {
      // Unary op: serap ke sign accumulator. Zero stack operation.
      case "uny":
        if (tok.val === "-") sign = -sign;
        // "+" adalah identity; sign tidak berubah.
        break;

      // Angka: terapkan sign accumulated dalam satu perkalian.
      // `+tok.val` setara Number(tok.val) tapi ~5–10% lebih cepat di V8
      // karena memanggil ToNumber internal tanpa wrapping.
      case "num":
        valStack[vsp++] = sign * +tok.val;
        sign = 1;
        break;

      // Operator biner: fold yang pending, lalu enqueue.
      case "ops": {
        sign = 1; // reset defensif
        const meta = BOPS[tok.val];
        if (meta === undefined) {
          return {
            ok: false,
            error: `Operator '${tok.val}' tidak bisa dievaluasi`,
          };
        }
        const err = foldPending(meta.prec, meta.rAssoc);
        if (err !== null) return { ok: false, error: err };
        opStack[osp++] = encodeOp(meta);
        break;
      }

      // Parenthesis.
      case "par":
        if (tok.val === "(") {
          // Encode pending sign ke dalam tipe sentinel sehingga bisa
          // diterapkan ke hasil grup saat ia ditutup.
          opStack[osp++] = sign === -1 ? PAREN_NEG : PAREN;
          sign = 1;
        } else {
          // ")": fold isi grup, lalu terapkan sign dari sentinel.
          while (
            osp > 0 &&
            opStack[osp - 1] !== PAREN &&
            opStack[osp - 1] !== PAREN_NEG
          ) {
            const err = fold();
            if (err !== null) return { ok: false, error: err };
          }
          if (osp === 0)
            return { ok: false, error: "Kurung ')' tidak punya pasangan" };
          const sentinel = opStack[--osp];
          if (sentinel === PAREN_NEG) valStack[vsp - 1] = -valStack[vsp - 1];
        }
        break;

      case "unk":
        return { ok: false, error: `Token tidak dikenal: '${tok.val}'` };
    }
  }

  // ── fold akhir ────────────────────────────────────────────────────────────
  // Selesaikan semua operator yang masih pending setelah token habis.

  while (osp > 0) {
    const top = opStack[osp - 1];
    if (top === PAREN || top === PAREN_NEG) {
      return { ok: false, error: "Kurung '(' tidak punya pasangan" };
    }
    const err = fold();
    if (err !== null) return { ok: false, error: err };
  }

  if (vsp !== 1) {
    return {
      ok: false,
      error: `Evaluasi selesai dengan ${vsp} nilai di stack; harusnya 1`,
    };
  }

  return { ok: true, val: valStack[0] };
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Parse, normalisasi, dan evaluasi string ekspresi matematika.
 *
 * Pipeline lengkap:
 *   normalizeDigits → tokenize → normalizeTokens → validate → evalTokens
 *
 * Digit Unicode (Arab-India, Devanagari, dll.) diterima.
 * Hasil ekspresi yang menghasilkan ±Infinity atau NaN dikembalikan apa adanya
 * (semantik IEEE 754); periksa dengan Number.isFinite / Number.isNaN jika perlu.
 *
 * @throws  Tidak pernah melempar. Semua error dikembalikan sebagai { ok: false }.
 *
 * @example
 *   evaluate("3 + 4 * 2")        // { ok: true,  val: 11 }
 *   evaluate("(3 + 4) * 2")      // { ok: true,  val: 14 }
 *   evaluate("2^10")              // { ok: true,  val: 1024 }
 *   evaluate("2^3^2")             // { ok: true,  val: 512 }   kanan-asosiatif: 2^(3^2)
 *   evaluate("-(3 + 4) * 2")     // { ok: true,  val: -14 }
 *   evaluate("10 % 3")            // { ok: true,  val: 1 }
 *   evaluate("099 + 1")           // { ok: true,  val: 100 }  leading zero di-strip
 *   evaluate("٣ + ٥")            // { ok: true,  val: 8 }    digit Arab-India
 *   evaluate("1 / 0")             // { ok: true,  val: Infinity }
 *   evaluate("0 / 0")             // { ok: true,  val: NaN }
 *   evaluate("(1 + 2")            // { ok: false, error: "..." }
 *   evaluate("3 5")               // { ok: false, error: "..." }
 */
function evaluate(src: string): EvalResult {
  if (typeof src !== "string") {
    return { ok: false, error: `Diharapkan string, dapat ${typeof src}` };
  }

  const norm = normalize(src);
  if (!norm.ok) {
    const e = norm.error;
    const loc = "index" in e ? ` (token ke-${e.index})` : "";
    return { ok: false, error: `Parse error: ${e.kind}${loc}` };
  }

  return evalTokens(norm.tokens);
}

// ─── test suite ──────────────────────────────────────────────────────────────
// Jalankan dengan: npx vitest expression-evaluator.test.ts
// atau salin ke file .test.ts terpisah.
//
// import { describe, expect, it } from "vitest";
// import { evaluate } from "./expression-evaluator";
//
// describe("evaluate — arithmetic", () => {
//   // precedence & associativity
//   it("left-assoc: 8/4/2 = 1",          () => expect(evaluate("8/4/2")).toEqual({ ok:true, val:1 }));
//   it("right-assoc: 2^3^2 = 512",        () => expect(evaluate("2^3^2")).toEqual({ ok:true, val:512 }));
//   it("mixed prec: 3+4*2 = 11",          () => expect(evaluate("3+4*2")).toEqual({ ok:true, val:11 }));
//   it("paren override: (3+4)*2 = 14",    () => expect(evaluate("(3+4)*2")).toEqual({ ok:true, val:14 }));
//   // unary
//   it("unary chain: ---3 = -3",          () => expect(evaluate("---3")).toEqual({ ok:true, val:-3 }));
//   it("unary paren: -(3+4)*2 = -14",     () => expect(evaluate("-(3+4)*2")).toEqual({ ok:true, val:-14 }));
//   it("double neg: -(-3) = 3",           () => expect(evaluate("-(-3)")).toEqual({ ok:true, val:3 }));
//   // modulo
//   it("10 % 3 = 1",                      () => expect(evaluate("10%3")).toEqual({ ok:true, val:1 }));
//   // unicode digits
//   it("Arabic-Indic: ٣+٥ = 8",          () => expect(evaluate("٣+٥")).toEqual({ ok:true, val:8 }));
//   // IEEE 754 edge cases
//   it("1/0 = Infinity",                  () => expect(evaluate("1/0")).toEqual({ ok:true, val:Infinity }));
//   it("0/0 = NaN",                       () => {
//     const r = evaluate("0/0");
//     expect(r.ok).toBe(true);
//     expect(Number.isNaN((r as any).val)).toBe(true);
//   });
// });
//
// describe("evaluate — errors propagated from normalizer", () => {
//   it("adjacent values",  () => expect(evaluate("3 5").ok).toBe(false));
//   it("unmatched paren",  () => expect(evaluate("(3+4").ok).toBe(false));
//   it("trailing op",      () => expect(evaluate("3+").ok).toBe(false));
//   it("double decimal",   () => expect(evaluate("3.1.4").ok).toBe(false));
//   it("empty string",     () => expect(evaluate("").ok).toBe(false));
//   it("non-string input", () => expect(evaluate(null as any).ok).toBe(false));
// });
//
//

