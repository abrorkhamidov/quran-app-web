// Fetches per-word tajweed (quran.com `text_uthmani_tajweed`) and overlays it onto
// the AUTHORITATIVE Mushaf page layout (web/public/quran/pages/{n}.json) by zipping
// words in reading order — so the tajweed view has pixel-identical line breaks to
// the QCF Mushaf and is word-aligned for highlight/favoriting.
// Output: web/public/quran/tajweed/{1..604}.json
//   { page, lines: [ { line, words: [ { type, surah, ayah, segments } ] } ] }
// Run: node scripts/build-tajweed.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWordTajweed } from './lib/tajweed.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_DIR = resolve(ROOT, 'web/public/quran/pages');
const OUT_DIR = resolve(ROOT, 'web/public/quran/tajweed');
const API = 'https://api.quran.com/api/v4';
const TOTAL_PAGES = 604;
const fields = 'text_uthmani_tajweed,char_type_name';

async function fetchPage(page) {
  const url = `${API}/verses/by_page/${page}?per_page=300&words=true&word_fields=${fields}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
      return (await res.json()).verses;
    } catch (e) {
      if (attempt === 5) throw e;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

// tajweed words in reading order (verse order, then word order)
function tajWordsInOrder(verses) {
  const out = [];
  for (const v of verses) {
    const [surah, ayah] = v.verse_key.split(':').map(Number);
    for (const w of v.words) {
      out.push({ type: w.char_type_name, surah, ayah, segments: parseWordTajweed(w.text_uthmani_tajweed) });
    }
  }
  return out;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let ayahCountMismatch = 0;
  let unmatched = 0;
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const mushaf = JSON.parse(await readFile(resolve(PAGES_DIR, `${page}.json`), 'utf8'));
    const taj = tajWordsInOrder(await fetchPage(page));

    // group this page's tajweed words by ayah, preserving position order
    const tajByAyah = new Map();
    for (const tw of taj) {
      const k = `${tw.surah}:${tw.ayah}`;
      if (!tajByAyah.has(k)) tajByAyah.set(k, []);
      tajByAyah.get(k).push(tw);
    }
    // per-ayah count sanity vs Mushaf
    const mushafByAyah = new Map();
    for (const w of mushaf.lines.flatMap((l) => l.words)) {
      const k = `${w.surah}:${w.ayah}`;
      mushafByAyah.set(k, (mushafByAyah.get(k) || 0) + 1);
    }
    for (const [k, n] of mushafByAyah) if ((tajByAyah.get(k) || []).length !== n) ayahCountMismatch++;

    // zip each Mushaf word to the same-index tajweed word WITHIN its ayah
    const cursor = new Map();
    const lines = mushaf.lines.map((l) => ({
      line: l.line,
      words: l.words.map((w) => {
        const k = `${w.surah}:${w.ayah}`;
        const idx = cursor.get(k) || 0;
        cursor.set(k, idx + 1);
        const tw = (tajByAyah.get(k) || [])[idx];
        if (!tw) unmatched++;
        return { type: w.type, surah: w.surah, ayah: w.ayah, segments: tw ? tw.segments : [] };
      }),
    }));

    await writeFile(resolve(OUT_DIR, `${page}.json`), JSON.stringify({ page, lines }));
    if (page % 50 === 0) console.log(`...page ${page}/${TOTAL_PAGES}`);
  }
  console.log(`done: ${TOTAL_PAGES} pages | ayah-count mismatches: ${ayahCountMismatch} | unmatched words: ${unmatched}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
