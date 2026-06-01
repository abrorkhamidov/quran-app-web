// Fetches tajweed-annotated Uthmani text (alquran.cloud) for all 114 surahs,
// parses the bracket markup into colored segments, and writes per-page JSON
// aligned to the existing Mushaf page ordering.
// Output: web/public/quran/tajweed/{1..604}.json
//   [{ surah, ayah, segments: [[text, ruleOrNull], ...] }]
// Run: node scripts/build-tajweed.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTajweed } from './lib/tajweed.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_DIR = resolve(ROOT, 'web/public/quran/pages');
const OUT_DIR = resolve(ROOT, 'web/public/quran/tajweed');
const API = 'https://api.alquran.cloud/v1/surah';
const TOTAL_PAGES = 604;

async function fetchSurah(s) {
  const url = `${API}/${s}/quran-tajweed`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`surah ${s}: HTTP ${res.status}`);
      return (await res.json()).data.ayahs; // [{ numberInSurah, text }]
    } catch (e) {
      if (attempt === 5) throw e;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // 1) build verseKey -> parsed segments for the whole Qur'an
  const byKey = new Map();
  for (let s = 1; s <= 114; s++) {
    const ayahs = await fetchSurah(s);
    for (const a of ayahs) byKey.set(`${s}:${a.numberInSurah}`, parseTajweed(a.text));
    if (s % 20 === 0) console.log(`...surah ${s}/114`);
  }

  // 2) for each page, take the distinct ayahs (in reading order) from the
  //    existing Mushaf page JSON and attach their tajweed segments
  let missing = 0;
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const pageJson = JSON.parse(await readFile(resolve(PAGES_DIR, `${page}.json`), 'utf8'));
    const seen = new Set();
    const ayahs = [];
    for (const line of pageJson.lines) {
      for (const w of line.words) {
        const key = `${w.surah}:${w.ayah}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const segments = byKey.get(key);
        if (!segments) { missing++; continue; }
        ayahs.push({ surah: w.surah, ayah: w.ayah, segments });
      }
    }
    await writeFile(resolve(OUT_DIR, `${page}.json`), JSON.stringify({ page, ayahs }));
  }
  console.log(`done: ${TOTAL_PAGES} tajweed pages (${byKey.size} ayahs, ${missing} unmatched)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
