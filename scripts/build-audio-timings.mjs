// Fetches qdc per-chapter verse timings + word segments for 3 reciters and writes
// static JSON. MP3s are NOT downloaded (streamed at runtime). Run: node scripts/build-audio-timings.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'web/public/audio');
const QDC = 'https://api.qurancdn.com/api/qdc/audio/reciters';
const CHAPTERS = 114;
const RECITERS = [
  { id: 7, slug: 'alafasy', name: 'Mishary Alafasy' },
  { id: 2, slug: 'abdulbasit', name: 'AbdulBaset AbdulSamad' },
  { id: 6, slug: 'husary', name: 'Mahmoud Al-Husary' },
];

async function fetchChapter(reciterId, chapter) {
  const url = `${QDC}/${reciterId}/audio_files?chapter=${chapter}&segments=true`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`r${reciterId} ch${chapter}: HTTP ${res.status}`);
      const af = (await res.json()).audio_files[0];
      if (!af) throw new Error(`r${reciterId} ch${chapter}: no audio_files`);
      return af;
    } catch (e) {
      if (attempt === 5) throw e;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

function shape(reciterId, chapter, af) {
  const verses = {};
  for (const vt of af.verse_timings) {
    verses[vt.verse_key] = {
      from: Number(vt.timestamp_from),
      to: Number(vt.timestamp_to),
      segments: (vt.segments || []).map((s) => [Number(s[0]), Number(s[1]), Number(s[2])]),
    };
  }
  return { reciterId, chapter, audioUrl: af.audio_url, durationMs: Number(af.duration), verses };
}

async function main() {
  for (const r of RECITERS) {
    await mkdir(resolve(OUT, 'timings', String(r.id)), { recursive: true });
    for (let ch = 1; ch <= CHAPTERS; ch++) {
      const af = await fetchChapter(r.id, ch);
      await writeFile(resolve(OUT, 'timings', String(r.id), `${ch}.json`), JSON.stringify(shape(r.id, ch, af)));
    }
    console.log(`...reciter ${r.id} (${r.slug}) done`);
  }
  await writeFile(resolve(OUT, 'reciters.json'), JSON.stringify(RECITERS.map(({ id, slug, name }) => ({ id, slug, name }))));
  console.log(`done: ${RECITERS.length} reciters × ${CHAPTERS} chapters`);
}
main().catch((e) => { console.error(e); process.exit(1); });
