import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSurahs, deriveJuz } from './lib/derive-meta.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AYAH_REF_PATH = resolve(ROOT, 'scripts/generated/ayah-ref.json');
const OUT_DIR = resolve(ROOT, 'web/public/quran');
const API = 'https://api.quran.com/api/v4';

async function main() {
  const ayahRef = JSON.parse(await readFile(AYAH_REF_PATH, 'utf8'));
  const res = await fetch(`${API}/chapters`);
  if (!res.ok) throw new Error(`/chapters HTTP ${res.status}`);
  const { chapters } = await res.json();

  const surahs = deriveSurahs(ayahRef, chapters);
  const juz = deriveJuz(ayahRef);

  if (surahs.length !== 114) throw new Error(`expected 114 surahs, got ${surahs.length}`);
  if (juz.length !== 30) throw new Error(`expected 30 juz, got ${juz.length}`);
  const totalSurahAyahs = surahs.reduce((n, s) => n + s.ayahCount, 0);
  const totalJuzAyahs = juz.reduce((n, j) => n + j.ayahCount, 0);
  if (totalSurahAyahs !== 6236 || totalJuzAyahs !== 6236) {
    throw new Error(`ayah totals off: surahs=${totalSurahAyahs} juz=${totalJuzAyahs} (want 6236)`);
  }

  await writeFile(resolve(OUT_DIR, 'surahs.json'), JSON.stringify(surahs));
  await writeFile(resolve(OUT_DIR, 'juz.json'), JSON.stringify(juz));
  console.log(`done: ${surahs.length} surahs, ${juz.length} juz, ${totalSurahAyahs} ayahs`);
}
main().catch((e) => { console.error(e); process.exit(1); });
