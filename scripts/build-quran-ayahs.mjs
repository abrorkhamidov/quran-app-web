import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAyahList } from './lib/build-ayahs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SURAHS_PATH = resolve(ROOT, 'web/public/quran/surahs.json');
const OUT_DIR = resolve(ROOT, 'web/public/quran/ayahs');
const API = 'https://api.quran.com/api/v4';
const TRANSLATION_ID = 20; // Saheeh International

async function fetchJson(url) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === 5) throw e;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

async function main() {
  const surahs = JSON.parse(await readFile(SURAHS_PATH, 'utf8'));
  await mkdir(OUT_DIR, { recursive: true });
  let total = 0;
  for (const s of surahs) {
    const uth = (await fetchJson(`${API}/quran/verses/uthmani?chapter_number=${s.id}&per_page=300`)).verses;
    const tr = (await fetchJson(`${API}/quran/translations/${TRANSLATION_ID}?chapter_number=${s.id}&per_page=300`)).translations;
    const list = buildAyahList(s.id, uth, tr);
    if (list.length !== s.ayahCount) throw new Error(`surah ${s.id}: got ${list.length} ayahs, expected ${s.ayahCount}`);
    await writeFile(resolve(OUT_DIR, `${s.id}.json`), JSON.stringify(list));
    total += list.length;
    if (s.id % 20 === 0) console.log(`...surah ${s.id}/114`);
  }
  if (total !== 6236) throw new Error(`total ${total} != 6236`);
  console.log(`done: ${total} ayahs across ${surahs.length} files`);
}
main().catch((e) => { console.error(e); process.exit(1); });
