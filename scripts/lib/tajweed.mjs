// Parse the alquran.cloud "quran-tajweed" bracket format into ordered segments.
// Format: plain text with inline `[<rule>[<arabic>]` markers, e.g.
//   "بِسْمِ [h:1[ٱ]للَّهِ [n[ـٰ]نِ ..."
// The rule is the leading letters before an optional ":id". Text outside
// brackets is plain (rule = null).
//
// Rule letters → tajweed category:
//   n natural madd · p permissible madd · o obligatory madd · m necessary madd
//   g ghunnah · a idgham-with-ghunnah · u idgham-without-ghunnah
//   f ikhfa · i iqlab · q qalqalah
//   h hamzat-wasl · s silent · l laam-shamsiyah

const TOKEN = /\[([a-z]+)(?::\d+)?\[([^\]]*)\]/g;

/** @returns {[string, (string|null)][]} ordered [text, ruleLetterOrNull] segments */
export function parseTajweed(text) {
  const out = [];
  let last = 0;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) out.push([text.slice(last, m.index), null]);
    out.push([m[2], m[1]]);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push([text.slice(last), null]);
  // merge adjacent same-rule segments to keep it compact
  const merged = [];
  for (const [t, r] of out) {
    const prev = merged[merged.length - 1];
    if (prev && prev[1] === r) prev[0] += t;
    else merged.push([t, r]);
  }
  return merged;
}
