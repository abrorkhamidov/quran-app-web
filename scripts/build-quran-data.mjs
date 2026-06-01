import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countArabicLetters } from './lib/letter-count.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_DIR = resolve(ROOT, 'web/public/quran/pages');
const META_PATH = resolve(ROOT, 'web/public/quran/meta.json');
const AYAH_REF_PATH = resolve(ROOT, 'scripts/generated/ayah-ref.json');
const API = 'https://api.quran.com/api/v4';
const TOTAL_PAGES = 604;
const wordFields = 'code_v2,line_number,page_number,char_type_name,text_uthmani';

async function fetchPage(page) {
  const url = `${API}/verses/by_page/${page}?per_page=300&words=true&word_fields=${wordFields}&fields=text_uthmani`;
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

function toPageData(page, verses) {
  const lineMap = new Map();
  const ayahRef = [];
  for (const v of verses) {
    const [surah, ayah] = v.verse_key.split(':').map(Number);
    let letters = 0;
    for (const w of v.words) {
      if (w.char_type_name === 'word') letters += countArabicLetters(w.text_uthmani);
      const ln = w.line_number;
      if (!lineMap.has(ln)) lineMap.set(ln, []);
      lineMap.get(ln).push({ glyph: w.code_v2, type: w.char_type_name, surah, ayah });
    }
    ayahRef.push({ surah, ayah, page: v.page_number, juz: v.juz_number, letterCount: letters });
  }
  const lines = [...lineMap.keys()].sort((a, b) => a - b).map((line) => ({ line, words: lineMap.get(line) }));
  return { page, lines, ayahRef };
}

async function main() {
  await mkdir(PAGES_DIR, { recursive: true });
  await mkdir(dirname(AYAH_REF_PATH), { recursive: true });
  const allAyahRef = [];
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const verses = await fetchPage(page);
    const { lines, ayahRef } = toPageData(page, verses);
    await writeFile(resolve(PAGES_DIR, `${page}.json`), JSON.stringify({ page, lines }));
    allAyahRef.push(...ayahRef);
    if (page % 50 === 0) console.log(`...page ${page}/${TOTAL_PAGES}`);
  }
  await writeFile(AYAH_REF_PATH, JSON.stringify(allAyahRef));
  await writeFile(META_PATH, JSON.stringify({ totalPages: TOTAL_PAGES, source: 'api.quran.com v4 / QCF v2', generatedPages: TOTAL_PAGES }));
  console.log(`done: ${TOTAL_PAGES} pages, ${allAyahRef.length} ayah-ref rows`);
}
main().catch((e) => { console.error(e); process.exit(1); });
