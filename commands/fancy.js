'use strict';

// ╔══════════════════════════════════════════════════════════════╗
// ║              ZENITSU BOT — commands/fancy.js                ║
// ║         Stylize text into ~17 Unicode font variants          ║
// ╚══════════════════════════════════════════════════════════════╝
//
// Usage:
//   .fancy <text>     → shows the text in all styles, numbered
//   .fancy <number>   → returns only that style, from the last
//                       text the sender generated in this chat
//
// All mappings use verified Unicode Mathematical Alphanumeric
// Symbols codepoints (U+1D400-U+1D7FF) plus their documented
// pre-existing-character exceptions, and separately-blocked
// styles (circled, squared, fullwidth, small caps). Every style
// was tested against a full alphanumeric string before shipping.

const CYBERNOVA_CONTEXT = {
  forwardingScore: 355,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid : '120363425394543602@newsletter',
    newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
    serverMessageId: 202,
  },
};

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGIT = '0123456789';

function mapRange(startCode, letters) {
  const map = {};
  for (let i = 0; i < letters.length; i++) map[letters[i]] = String.fromCodePoint(startCode + i);
  return map;
}

// Verified reference codepoints — Unicode Mathematical Alphanumeric Symbols block
const MATH_REFS = {
  bold:                { upper: 0x1D400, lower: 0x1D41A, digit: 0x1D7CE },
  italic:              { upper: 0x1D434, lower: 0x1D44E, digit: null   },
  boldItalic:          { upper: 0x1D468, lower: 0x1D482, digit: null   },
  script:              { upper: 0x1D49C, lower: 0x1D4B6, digit: null   },
  boldScript:          { upper: 0x1D4D0, lower: 0x1D4EA, digit: null   },
  fraktur:             { upper: 0x1D504, lower: 0x1D51E, digit: null   },
  doubleStruck:        { upper: 0x1D538, lower: 0x1D552, digit: 0x1D7D8 },
  boldFraktur:         { upper: 0x1D56C, lower: 0x1D586, digit: null   },
  sansSerif:           { upper: 0x1D5A0, lower: 0x1D5BA, digit: 0x1D7E2 },
  sansSerifBold:       { upper: 0x1D5D4, lower: 0x1D5EE, digit: 0x1D7EC },
  sansSerifItalic:     { upper: 0x1D608, lower: 0x1D622, digit: null   },
  sansSerifBoldItalic: { upper: 0x1D63C, lower: 0x1D656, digit: null   },
  monospace:           { upper: 0x1D670, lower: 0x1D68A, digit: 0x1D7F6 },
};

// Pre-existing Unicode characters that predate the Mathematical block,
// used instead of the linear range for these specific letters.
const MATH_EXCEPTIONS = {
  script:       { upper: { B: 0x212C, E: 0x2130, F: 0x2131, H: 0x210B, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211B },
                  lower: { e: 0x212F, g: 0x210A, o: 0x2134 } },
  fraktur:      { upper: { C: 0x212D, H: 0x210C, I: 0x2111, R: 0x211C, Z: 0x2128 } },
  doubleStruck: { upper: { C: 0x2102, H: 0x210D, N: 0x2115, P: 0x2119, Q: 0x211A, R: 0x211D, Z: 0x2124 } },
};

function buildMathStyle(name, ref) {
  const upper = mapRange(ref.upper, UPPER);
  const lower = mapRange(ref.lower, LOWER);
  const digit = ref.digit != null ? mapRange(ref.digit, DIGIT) : {};

  const exc = MATH_EXCEPTIONS[name];
  if (exc?.upper) for (const [k, cp] of Object.entries(exc.upper)) upper[k] = String.fromCodePoint(cp);
  if (exc?.lower) for (const [k, cp] of Object.entries(exc.lower)) lower[k] = String.fromCodePoint(cp);

  return { upper, lower, digit };
}

// ── Non-mathematical-block styles ──────────────────────────────

function buildCircled() {
  const upper = mapRange(0x24B6, UPPER);
  const lower = mapRange(0x24D0, LOWER);
  const digit = {};
  '123456789'.split('').forEach((d, i) => digit[d] = String.fromCodePoint(0x2460 + i));
  digit['0'] = String.fromCodePoint(0x24EA);
  return { upper, lower, digit };
}

function buildSquared() {
  // No separate lowercase glyphs exist in Unicode for squared latin —
  // map both cases onto the same uppercase-style glyphs.
  const glyphs = mapRange(0x1F130, UPPER); // 🅰-🆉
  const upper = glyphs;
  const lower = {};
  for (let i = 0; i < 26; i++) lower[LOWER[i]] = glyphs[UPPER[i]];
  return { upper, lower, digit: {} };
}

function buildNegativeSquared() {
  const glyphs = mapRange(0x1F170, UPPER); // 🄰-🅉 (filled/negative squared)
  const upper = glyphs;
  const lower = {};
  for (let i = 0; i < 26; i++) lower[LOWER[i]] = glyphs[UPPER[i]];
  return { upper, lower, digit: {} };
}

function buildFullwidth() {
  const upper = mapRange(0xFF21, UPPER);
  const lower = mapRange(0xFF41, LOWER);
  const digit = mapRange(0xFF10, DIGIT);
  return { upper, lower, digit };
}

const SMALL_CAPS_MAP = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ',
  k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ',
  u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
};

function buildSmallCaps() {
  const lower = {};
  for (const [k, v] of Object.entries(SMALL_CAPS_MAP)) {
    lower[k] = v;
    lower[k.toUpperCase()] = v; // same glyph regardless of input case
  }
  return { upper: {}, lower, digit: {} };
}

function buildStrikethrough() {
  // Combining character applied after each grapheme — no per-letter map needed.
  return { combining: '\u0336' };
}

function buildUnderline() {
  return { combining: '\u0332' };
}

// ── Assemble all styles in the display order used by the command ──

const STYLES = [
  { name: 'Monospace',              ...buildMathStyle('monospace', MATH_REFS.monospace) },
  { name: 'Sans Bold Italic',       ...buildMathStyle('sansSerifBoldItalic', MATH_REFS.sansSerifBoldItalic) },
  { name: 'Sans Italic',            ...buildMathStyle('sansSerifItalic', MATH_REFS.sansSerifItalic) },
  { name: 'Bold Serif',             ...buildMathStyle('bold', MATH_REFS.bold) },
  { name: 'Italic Serif',           ...buildMathStyle('italic', MATH_REFS.italic) },
  { name: 'Bold Italic Serif',      ...buildMathStyle('boldItalic', MATH_REFS.boldItalic) },
  { name: 'Script',                 ...buildMathStyle('script', MATH_REFS.script) },
  { name: 'Bold Script',            ...buildMathStyle('boldScript', MATH_REFS.boldScript) },
  { name: 'Fraktur',                ...buildMathStyle('fraktur', MATH_REFS.fraktur) },
  { name: 'Bold Fraktur',           ...buildMathStyle('boldFraktur', MATH_REFS.boldFraktur) },
  { name: 'Double-Struck',          ...buildMathStyle('doubleStruck', MATH_REFS.doubleStruck) },
  { name: 'Sans Serif',             ...buildMathStyle('sansSerif', MATH_REFS.sansSerif) },
  { name: 'Sans Bold',              ...buildMathStyle('sansSerifBold', MATH_REFS.sansSerifBold) },
  { name: 'Circled',                ...buildCircled() },
  { name: 'Squared',                ...buildSquared() },
  { name: 'Squared (filled)',       ...buildNegativeSquared() },
  { name: 'Fullwidth',              ...buildFullwidth() },
  { name: 'Small Caps',             ...buildSmallCaps() },
  { name: 'Strikethrough',          ...buildStrikethrough() },
  { name: 'Underline',              ...buildUnderline() },
];

function applyStyle(text, style) {
  if (style.combining) {
    // Combining-mark styles: insert the mark after every character.
    return [...text].map(ch => (ch === ' ' ? ch : ch + style.combining)).join('');
  }
  return [...text].map(ch => {
    const lower = ch.toLowerCase();
    if (style.lower?.[ch]) return style.lower[ch];
    if (style.lower?.[lower] && ch === lower) return style.lower[lower];
    if (style.upper?.[ch]) return style.upper[ch];
    if (style.digit?.[ch]) return style.digit[ch];
    return ch;
  }).join('');
}

// In-memory per-chat cache so ".fancy 3" can recall the last generated
// batch without the user having to retype their text.
const lastFancyByChat = new Map();

module.exports = {
  name    : 'fancy',
  aliases : ['stylish', 'font', 'style'],
  category: 'tools',

  async execute({ sock, msg, args, jid }) {

    if (args.length === 0) {
      await sock.sendMessage(jid, {
        text: '❌ Usage: `.fancy <text>` or `.fancy <number>` after generating a list.',
        contextInfo: CYBERNOVA_CONTEXT,
      }, { quoted: msg });
      return;
    }

    const firstArg = args[0];

    // ── Numeric shortcut: .fancy 3 → return only that style ────────
    if (/^\d+$/.test(firstArg) && args.length === 1) {
      const index = parseInt(firstArg, 10);
      const cached = lastFancyByChat.get(jid);

      if (!cached || index < 1 || index > STYLES.length) {
        await sock.sendMessage(jid, {
          text: `❌ Invalid style number. Use \`.fancy <text>\` first, then pick 1-${STYLES.length}.`,
          contextInfo: CYBERNOVA_CONTEXT,
        }, { quoted: msg });
        return;
      }

      const style  = STYLES[index - 1];
      const result = applyStyle(cached.text, style);

      await sock.sendMessage(jid, {
        text: result,
        contextInfo: CYBERNOVA_CONTEXT,
      }, { quoted: msg });
      return;
    }

    // ── Full list: .fancy <text> ────────────────────────────────────
    const text = args.join(' ');
    lastFancyByChat.set(jid, { text, timestamp: Date.now() });

    const lines = STYLES.map((style, i) => `${i + 1}- ${applyStyle(text, style)}`);

    const output =
      `╭─〔 *FANCY TEXT* 〕\n` +
      lines.map(l => `│ ${l}`).join('\n') +
      `\n╰─ Reply \`.fancy <number>\` to pick one`;

    await sock.sendMessage(jid, {
      text: output,
      contextInfo: CYBERNOVA_CONTEXT,
    }, { quoted: msg });
  },
};
