// Parse quran.com `text_uthmani_tajweed` per-word HTML into ordered segments.
// Markup is plain text interspersed with possibly-NESTED `<rule class=NAME>…</rule>`.
// Some classes are colour rules (below); `custom-*` classes are glyph hints, not
// colours. A text run's colour is the nearest ANCESTOR that is a real tajweed rule.
//   "ذ<rule class=madda_normal><rule class=custom-alef-maksora>ٰ</rule></rule>لِكَ"
//   → [["ذ", null], ["ٰ", "madda_normal"], ["لِكَ", null]]

export const TAJWEED_RULES = new Set([
  'ham_wasl', 'laam_shamsiyah', 'slnt',
  'madda_normal', 'madda_permissible', 'madda_necessary',
  'madda_obligatory_mottasel', 'madda_obligatory_monfasel',
  'ghunnah', 'idgham_ghunnah', 'idgham_wo_ghunnah', 'idgham_shafawi', 'idgham_mutajanisayn',
  'ikhafa', 'ikhafa_shafawi', 'iqlab', 'qalaqah',
]);

const TOKEN = /<rule class=([a-z_-]+)>|<\/rule>|([^<]+)/g;

/** @returns {[string, (string|null)][]} */
export function parseWordTajweed(html) {
  if (!html) return [];
  const out = [];
  const stack = [];
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(html)) !== null) {
    if (m[1] !== undefined) {
      stack.push(m[1]);
    } else if (m[2] !== undefined) {
      let rule = null;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (TAJWEED_RULES.has(stack[i])) { rule = stack[i]; break; }
      }
      out.push([m[2], rule]);
    } else {
      stack.pop();
    }
  }
  const merged = [];
  for (const [t, r] of out) {
    const prev = merged[merged.length - 1];
    if (prev && prev[1] === r) prev[0] += t;
    else merged.push([t, r]);
  }
  return merged;
}
