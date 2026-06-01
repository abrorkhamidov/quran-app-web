# Phase 4: Audio + Word-by-Word Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play Quran recitation in the reading view with the current word highlighting in sync, a reciter picker (3 reciters), 0.5–2× speed, and "play from here" on any ayah.

**Architecture:** Audio is per-surah (one streamed MP3 per chapter) with word-level timing `[wordPosition, startMs, endMs]` absolute within that file. A build script vendors only the small **timing JSON** (3 reciters × 114 chapters) as static files; the MP3s stream from the public `download.quranicaudio.com` CDN at runtime. A scoped `AudioProvider` owns one `<audio>` element: it loads a surah's timing + MP3, and on `timeupdate` resolves the current ms to a `{surah, ayah, position}` highlighted word that the Mushaf renders with an accent. Reciter and speed live in the existing client `SettingsProvider`. Tapping an ayah surfaces "♥ Favorite" (Phase 3) plus "▶ Play from here".

**Tech Stack:** Node build script (native fetch); React + Vite + Tailwind v3 (Quiet Slate), TanStack Query, react-router-dom; HTMLAudioElement.

**Builds on:** Phase 2 (Mushaf render, page JSON) + Phase 3 (SettingsProvider, ayah selection/FavoriteBar). Commit directly to `main`; push after verification.

---

## Data Sources (verified)

- **Timing + audio URL:** `GET https://api.qurancdn.com/api/qdc/audio/reciters/{reciterId}/audio_files?chapter={n}&segments=true` → `{ audio_files: [{ audio_url, duration, verse_timings: [{ verse_key, timestamp_from, timestamp_to, segments: [[wordPos, startMs, endMs], ...] }] }] }`. One object per chapter (chapter-level mp3).
- **Reciters (confirmed have word segments):** `7` Mishary Alafasy, `2` AbdulBaset AbdulSamad (Murattal), `6` Mahmoud Al-Husary.
- **Audio CDN:** `audio_url` is absolute (e.g. `https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/1.mp3`) — streamed, not vendored.
- **Segment shape:** `[wordPosition (1-based, counts only recited words, excludes the ayah-end marker), startMs, endMs]`, ms absolute within the chapter mp3. Values may be int or float — coerce to Number.

---

## File Structure

```
scripts/
└── build-audio-timings.mjs            # fetch qdc timings → static JSON + reciters.json
web/public/audio/
├── reciters.json                       # [{ id, slug, name }]
└── timings/{7,2,6}/{1..114}.json       # per reciter per chapter
web/src/audio/
├── types.ts                            # ChapterTiming, Reciter, HighlightedWord, etc.
├── useReciters.ts                      # load reciters.json
├── useChapterTiming.ts                 # load a chapter's timing JSON
├── AudioContext.tsx                    # AudioProvider: <audio>, play/seek/toggle, highlight
├── useAudio.ts                         # consume AudioContext
└── AudioBar.tsx                        # reciter picker + play/pause + speed
web/src/settings/ (modified)
└── SettingsContext.tsx                 # + reciterId, playbackSpeed
web/src/quran/ (modified)
├── MushafWord.tsx                      # + isPlaying highlight + position
├── MushafLine.tsx                      # thread position + isPlaying
├── MushafPage.tsx                      # compute word positions; highlight current word
└── FavoriteBar.tsx                     # + "▶ Play from here"
web/src/pages/ReadPage.tsx (modified)   # wrap in AudioProvider; render AudioBar
```

---

## Task 1: Discovery spike (confirm timing for all 3 reciters)

**Files:** none (verification only)

- [ ] **Step 1: Confirm the qdc endpoint shape + 3 reciters**

Run:
```bash
for r in 7 2 6; do
  curl -s "https://api.qurancdn.com/api/qdc/audio/reciters/$r/audio_files?chapter=1&segments=true" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); a=d['audio_files'][0]; vt=a['verse_timings']; print('reciter $r', a['audio_url']); print('  verses', len(vt), 'v1 segs', (vt[0]['segments'] or [])[:2], 'from/to', vt[0]['timestamp_from'], vt[0]['timestamp_to'])"
done
```
Expected: each prints an `audio_url`, 7 verses for chapter 1, and segment arrays `[[1, …], [2, …]]`. If any reciter lacks `segments`, report it.

- [ ] **Step 2: Confirm a mid-Mushaf chapter (e.g. 2) and the mp3 streams**

Run:
```bash
curl -s "https://api.qurancdn.com/api/qdc/audio/reciters/7/audio_files?chapter=2&segments=true" | python3 -c "import sys,json; d=json.load(sys.stdin); a=d['audio_files'][0]; print('ch2 verses', len(a['verse_timings']), 'url', a['audio_url'])"
curl -sI "$(curl -s 'https://api.qurancdn.com/api/qdc/audio/reciters/7/audio_files?chapter=1&segments=true' | python3 -c 'import sys,json;print(json.load(sys.stdin)["audio_files"][0]["audio_url"])')" | head -1
```
Expected: chapter 2 has 286 verses; the mp3 HEAD returns `HTTP/2 200`.

- [ ] **Step 3: Report** the confirmed field names (`timestamp_from`, `timestamp_to`, `segments`) and audio host. These parameterize Task 2.

---

## Task 2: Audio-timing build script + reciters.json

**Files:** Create `scripts/build-audio-timings.mjs`, generated `web/public/audio/...`

- [ ] **Step 1: Write the build script**

Create `scripts/build-audio-timings.mjs`:
```js
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
```

- [ ] **Step 2: Run it**

Run: `node scripts/build-audio-timings.mjs`
Expected: ends with `done: 3 reciters × 114 chapters` (342 sequential fetches, a few minutes).

- [ ] **Step 3: Verify**

Run:
```bash
ls web/public/audio/timings/7 | wc -l   # expect 114
node --input-type=module -e "
import fs from 'node:fs';
const t = JSON.parse(fs.readFileSync('web/public/audio/timings/7/1.json'));
console.log('audioUrl', t.audioUrl, '| verses', Object.keys(t.verses).length);
const v = t.verses['1:1']; console.log('1:1 from/to', v.from, v.to, '| segs', v.segments.length, v.segments[0]);
console.log('reciters', JSON.parse(fs.readFileSync('web/public/audio/reciters.json')).length);
"
```
Expected: 114 files; `1:1` has segments; reciters.json has 3.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-audio-timings.mjs web/public/audio
git commit -m "feat(data): build script + vendored audio word-timing JSON for 3 reciters"
```

---

## Task 3: Extend settings — reciter + playback speed

**Files:** Modify `web/src/settings/SettingsContext.tsx`

- [ ] **Step 1: Add reciterId + playbackSpeed to the provider**

Edit `web/src/settings/SettingsContext.tsx` — extend the type, state, persistence, and value. Replace the file with:
```tsx
import { createContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';
type SettingsValue = {
  theme: Theme;
  toggleTheme: () => void;
  fontScale: number;
  setFontScale: (n: number) => void;
  reciterId: number;
  setReciterId: (id: number) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (n: number) => void;
};

export const SettingsContext = createContext<SettingsValue | null>(null);

const MIN_SCALE = 0.8;
const MAX_SCALE = 1.8;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [fontScale, setFontScaleState] = useState<number>(() => Number(localStorage.getItem('fontScale')) || 1);
  const [reciterId, setReciterIdState] = useState<number>(() => Number(localStorage.getItem('reciterId')) || 7);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(() => Number(localStorage.getItem('playbackSpeed')) || 1);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  useEffect(() => { localStorage.setItem('fontScale', String(fontScale)); }, [fontScale]);
  useEffect(() => { localStorage.setItem('reciterId', String(reciterId)); }, [reciterId]);
  useEffect(() => { localStorage.setItem('playbackSpeed', String(playbackSpeed)); }, [playbackSpeed]);

  function toggleTheme() { setTheme((t) => (t === 'light' ? 'dark' : 'light')); }
  function setFontScale(n: number) { setFontScaleState(Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(n.toFixed(2))))); }
  function setReciterId(id: number) { setReciterIdState(id); }
  function setPlaybackSpeed(n: number) { setPlaybackSpeedState(SPEEDS.includes(n) ? n : 1); }

  return (
    <SettingsContext.Provider value={{ theme, toggleTheme, fontScale, setFontScale, reciterId, setReciterId, playbackSpeed, setPlaybackSpeed }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const PLAYBACK_SPEEDS = SPEEDS;
```

- [ ] **Step 2: Type-check + commit**

Run: `cd web && npx tsc -b` (no errors). Commit:
```bash
git add web/src/settings/SettingsContext.tsx
git commit -m "feat(web): add reciter and playback speed to settings"
```

---

## Task 4: Audio types + data hooks

**Files:** Create `web/src/audio/types.ts`, `web/src/audio/useReciters.ts`, `web/src/audio/useChapterTiming.ts`

- [ ] **Step 1: types.ts**

Create `web/src/audio/types.ts`:
```ts
export type WordSegment = [position: number, startMs: number, endMs: number];
export type VerseTiming = { from: number; to: number; segments: WordSegment[] };
export type ChapterTiming = {
  reciterId: number;
  chapter: number;
  audioUrl: string;
  durationMs: number;
  verses: Record<string, VerseTiming>; // key "surah:ayah"
};
export type Reciter = { id: number; slug: string; name: string };
export type HighlightedWord = { surah: number; ayah: number; position: number };
```

- [ ] **Step 2: useReciters.ts**

Create `web/src/audio/useReciters.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import type { Reciter } from './types';

export function useReciters() {
  return useQuery({
    queryKey: ['reciters'],
    queryFn: async (): Promise<Reciter[]> => (await fetch('/audio/reciters.json')).json(),
    staleTime: Infinity,
  });
}
```

- [ ] **Step 3: useChapterTiming.ts (imperative fetch + cache)**

Create `web/src/audio/useChapterTiming.ts`:
```ts
import type { ChapterTiming } from './types';

const cache = new Map<string, ChapterTiming>();

export async function loadChapterTiming(reciterId: number, chapter: number): Promise<ChapterTiming> {
  const key = `${reciterId}:${chapter}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const res = await fetch(`/audio/timings/${reciterId}/${chapter}.json`);
  if (!res.ok) throw new Error(`timing ${key}: ${res.status}`);
  const data: ChapterTiming = await res.json();
  cache.set(key, data);
  return data;
}
```

- [ ] **Step 4: Type-check + commit**

Run: `cd web && npx tsc -b`. Commit:
```bash
git add web/src/audio/types.ts web/src/audio/useReciters.ts web/src/audio/useChapterTiming.ts
git commit -m "feat(web): add audio types and timing/reciter data loaders"
```

---

## Task 5: AudioProvider (playback controller)

**Files:** Create `web/src/audio/AudioContext.tsx`, `web/src/audio/useAudio.ts`

- [ ] **Step 1: AudioContext**

Create `web/src/audio/AudioContext.tsx`:
```tsx
import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSettings } from '../settings/useSettings';
import { loadChapterTiming } from './useChapterTiming';
import type { ChapterTiming, HighlightedWord } from './types';

type AudioValue = {
  highlighted: HighlightedWord | null;
  isPlaying: boolean;
  playingSurah: number | null;
  playFrom: (surah: number, ayah: number) => Promise<void>;
  toggle: () => void;
  stop: () => void;
};

export const AudioContext = createContext<AudioValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const { reciterId, playbackSpeed } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timingRef = useRef<ChapterTiming | null>(null);
  const versesRef = useRef<{ ayah: number; from: number; to: number; segments: number[][] }[]>([]);
  const [highlighted, setHighlighted] = useState<HighlightedWord | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingSurah, setPlayingSurah] = useState<number | null>(null);

  if (!audioRef.current && typeof Audio !== 'undefined') audioRef.current = new Audio();

  // keep playbackRate in sync
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = playbackSpeed; }, [playbackSpeed]);

  const onTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const ms = audio.currentTime * 1000;
    const verses = versesRef.current;
    const v = verses.find((x) => ms >= x.from && ms < x.to);
    if (!v) return;
    const seg = v.segments.find((s) => ms >= s[1] && ms < s[2]);
    if (!seg) return;
    const surah = playingSurah;
    if (surah == null) return;
    setHighlighted((prev) =>
      prev && prev.surah === surah && prev.ayah === v.ayah && prev.position === seg[0]
        ? prev
        : { surah, ayah: v.ayah, position: seg[0] },
    );
  }, [playingSurah]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.addEventListener('timeupdate', onTimeUpdate);
    const onEnd = () => { setIsPlaying(false); setHighlighted(null); };
    audio.addEventListener('ended', onEnd);
    return () => { audio.removeEventListener('timeupdate', onTimeUpdate); audio.removeEventListener('ended', onEnd); };
  }, [onTimeUpdate]);

  const playFrom = useCallback(async (surah: number, ayah: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const timing = await loadChapterTiming(reciterId, surah);
    timingRef.current = timing;
    versesRef.current = Object.entries(timing.verses)
      .map(([key, v]) => ({ ayah: Number(key.split(':')[1]), from: v.from, to: v.to, segments: v.segments }))
      .sort((a, b) => a.from - b.from);
    if (playingSurah !== surah || !audio.src.includes(encodeURI(timing.audioUrl).slice(-12))) {
      audio.src = timing.audioUrl;
    }
    const v = timing.verses[`${surah}:${ayah}`];
    audio.currentTime = v ? v.from / 1000 : 0;
    audio.playbackRate = playbackSpeed;
    setPlayingSurah(surah);
    await audio.play();
    setIsPlaying(true);
  }, [reciterId, playbackSpeed, playingSurah]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) { audio.play(); setIsPlaying(true); }
    else { audio.pause(); setIsPlaying(false); }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    setIsPlaying(false);
    setHighlighted(null);
  }, []);

  // reciter change mid-listen: reload current surah audio at current ayah
  useEffect(() => {
    if (playingSurah != null && highlighted) { void playFrom(playingSurah, highlighted.ayah); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reciterId]);

  return (
    <AudioContext.Provider value={{ highlighted, isPlaying, playingSurah, playFrom, toggle, stop }}>
      {children}
    </AudioContext.Provider>
  );
}
```

- [ ] **Step 2: useAudio hook**

Create `web/src/audio/useAudio.ts`:
```ts
import { useContext } from 'react';
import { AudioContext } from './AudioContext';

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
}
```

- [ ] **Step 3: Type-check + commit**

Run: `cd web && npx tsc -b`. Commit:
```bash
git add web/src/audio/AudioContext.tsx web/src/audio/useAudio.ts
git commit -m "feat(web): add audio playback controller with word-timing sync"
```

---

## Task 6: Word positions + current-word highlight in the Mushaf

**Files:** Modify `web/src/quran/MushafWord.tsx`, `web/src/quran/MushafLine.tsx`, `web/src/quran/MushafPage.tsx`

- [ ] **Step 1: MushafWord — add position + isPlaying**

Replace `web/src/quran/MushafWord.tsx`:
```tsx
import type { MushafWord as Word } from './types';

export function MushafWord({
  word,
  position,
  selected,
  isPlaying,
  onSelect,
}: {
  word: Word;
  position: number;
  selected: boolean;
  isPlaying: boolean;
  onSelect: (a: { surah: number; ayah: number }) => void;
}) {
  const base = word.type === 'end' ? 'text-muted' : '';
  const playing = isPlaying ? 'bg-accent text-white rounded' : '';
  const sel = selected && !isPlaying ? 'bg-accent-soft/25 rounded' : '';
  return (
    <span
      className={`${base} ${playing} ${sel} cursor-pointer`}
      data-surah={word.surah}
      data-ayah={word.ayah}
      data-position={position}
      onClick={() => onSelect({ surah: word.surah, ayah: word.ayah })}
    >
      {word.glyph}
    </span>
  );
}
```

- [ ] **Step 2: MushafLine — thread position + highlighted**

Replace `web/src/quran/MushafLine.tsx`:
```tsx
import type { MushafLine as Line } from './types';
import type { HighlightedWord } from '../audio/types';
import { MushafWord } from './MushafWord';

export function MushafLine({
  line,
  positions,
  selected,
  highlighted,
  onSelect,
}: {
  line: Line;
  positions: number[]; // position per word in this line, aligned by index
  selected: { surah: number; ayah: number } | null;
  highlighted: HighlightedWord | null;
  onSelect: (a: { surah: number; ayah: number }) => void;
}) {
  return (
    <div className="flex justify-center items-center gap-1 leading-[2.6] whitespace-nowrap" dir="rtl">
      {line.words.map((w, i) => (
        <MushafWord
          key={i}
          word={w}
          position={positions[i]}
          selected={!!selected && selected.surah === w.surah && selected.ayah === w.ayah}
          isPlaying={
            !!highlighted &&
            highlighted.surah === w.surah &&
            highlighted.ayah === w.ayah &&
            highlighted.position === positions[i]
          }
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: MushafPage — compute positions, pass highlight, auto-scroll**

Replace `web/src/quran/MushafPage.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react';
import { usePageData } from './usePageData';
import { ensureQcf2Css, pageFontFamily } from './pageFont';
import { MushafLine } from './MushafLine';
import { FavoriteBar } from './FavoriteBar';
import { useSettings } from '../settings/useSettings';
import { useAudio } from '../audio/useAudio';

export function MushafPage({ page }: { page: number }) {
  const { data, isLoading, isError } = usePageData(page);
  const { fontScale } = useSettings();
  const { highlighted } = useAudio();
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(null);
  useEffect(() => { ensureQcf2Css(); }, []);
  useEffect(() => { setSelected(null); }, [page]);

  // position per word, computed page-globally: count only 'word' type, per ayah, 1-based
  const positionsByLine = useMemo(() => {
    const counters: Record<string, number> = {};
    return (data?.lines ?? []).map((line) =>
      line.words.map((w) => {
        if (w.type !== 'word') return 0;
        const k = `${w.surah}:${w.ayah}`;
        counters[k] = (counters[k] ?? 0) + 1;
        return counters[k];
      }),
    );
  }, [data]);

  if (isLoading) return <div className="p-8 text-muted">Loading page {page}…</div>;
  if (isError || !data) return <div className="p-8 text-red-500">Could not load page {page}.</div>;

  return (
    <>
      <div
        className="mx-auto max-w-2xl px-4 py-6 text-ink dark:text-ink-dark"
        style={{ fontFamily: pageFontFamily(page), fontSize: `${28 * fontScale}px` }}
      >
        {data.lines.map((line, li) => (
          <MushafLine
            key={line.line}
            line={line}
            positions={positionsByLine[li]}
            selected={selected}
            highlighted={highlighted}
            onSelect={setSelected}
          />
        ))}
      </div>
      {selected && <FavoriteBar selected={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
```

- [ ] **Step 4: Type-check + commit**

Run: `cd web && npx tsc -b`. Commit:
```bash
git add web/src/quran/MushafWord.tsx web/src/quran/MushafLine.tsx web/src/quran/MushafPage.tsx
git commit -m "feat(web): highlight the currently recited word in the Mushaf"
```

---

## Task 7: AudioBar + FavoriteBar "Play from here" + ReadPage wiring

**Files:** Create `web/src/audio/AudioBar.tsx`; modify `web/src/quran/FavoriteBar.tsx`, `web/src/pages/ReadPage.tsx`

- [ ] **Step 1: AudioBar**

Create `web/src/audio/AudioBar.tsx`:
```tsx
import { useReciters } from './useReciters';
import { useAudio } from './useAudio';
import { useSettings, } from '../settings/useSettings';
import { PLAYBACK_SPEEDS } from '../settings/SettingsContext';

export function AudioBar({ firstSurahAyah }: { firstSurahAyah: { surah: number; ayah: number } | null }) {
  const { data: reciters } = useReciters();
  const { isPlaying, toggle, playFrom, playingSurah } = useAudio();
  const { reciterId, setReciterId, playbackSpeed, setPlaybackSpeed } = useSettings();

  function onPlayPause() {
    if (playingSurah == null && firstSurahAyah) void playFrom(firstSurahAyah.surah, firstSurahAyah.ayah);
    else toggle();
  }

  return (
    <div className="sticky bottom-0 bg-card-light dark:bg-card-dark border-t border-muted/20 px-4 py-2 flex items-center gap-3">
      <button onClick={onPlayPause} className="w-9 h-9 rounded-full bg-accent text-white grid place-items-center" aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? '⏸' : '▶'}
      </button>
      <select className="bg-transparent text-sm text-ink dark:text-ink-dark" value={reciterId} onChange={(e) => setReciterId(Number(e.target.value))} aria-label="Reciter">
        {reciters?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <select className="bg-transparent text-sm text-muted ml-auto" value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))} aria-label="Speed">
        {PLAYBACK_SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: FavoriteBar — add "Play from here"**

Replace `web/src/quran/FavoriteBar.tsx`:
```tsx
import { useFavorites, useToggleFavorite } from '../reading/useFavorites';
import { useAudio } from '../audio/useAudio';

export function FavoriteBar({
  selected,
  onClose,
}: {
  selected: { surah: number; ayah: number };
  onClose: () => void;
}) {
  const { data: favorites } = useFavorites();
  const toggle = useToggleFavorite();
  const { playFrom } = useAudio();
  const favorited = !!favorites?.some((f) => f.surah === selected.surah && f.ayah === selected.ayah);

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-card-light dark:bg-card-dark shadow-lg rounded-full px-4 py-2 flex items-center gap-4">
      <span className="text-sm text-muted">{selected.surah}:{selected.ayah}</span>
      <button onClick={() => void playFrom(selected.surah, selected.ayah)} className="text-accent-soft" aria-label="Play from here">▶ Play</button>
      <button
        onClick={() => toggle.mutate({ surah: selected.surah, ayah: selected.ayah, favorited })}
        className={favorited ? 'text-red-500' : 'text-muted'}
        aria-label="Toggle favorite"
      >
        {favorited ? '♥ Favorited' : '♡ Favorite'}
      </button>
      <button onClick={onClose} className="text-muted" aria-label="Close">✕</button>
    </div>
  );
}
```

- [ ] **Step 3: ReadPage — wrap in AudioProvider + render AudioBar**

Replace `web/src/pages/ReadPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MushafPage } from '../quran/MushafPage';
import { useSaveBookmark } from '../reading/useBookmark';
import { ThemeToggle } from '../components/ThemeToggle';
import { FontSizeControl } from '../components/FontSizeControl';
import { AudioProvider } from '../audio/AudioContext';
import { AudioBar } from '../audio/AudioBar';
import { usePageData } from '../quran/usePageData';

function ReadPageInner({ n }: { n: number }) {
  const navigate = useNavigate();
  const saveBookmark = useSaveBookmark();
  const { data } = usePageData(n);
  const [firstSurahAyah, setFirstSurahAyah] = useState<{ surah: number; ayah: number } | null>(null);

  useEffect(() => { saveBookmark.mutate(n); /* eslint-disable-next-line */ }, [n]);
  useEffect(() => {
    const w = data?.lines.flatMap((l) => l.words).find((x) => x.type === 'word');
    setFirstSurahAyah(w ? { surah: w.surah, ayah: w.ayah } : null);
  }, [data]);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex justify-between items-center px-4 py-3 text-sm border-b border-muted/20">
        <Link to="/" className="text-accent-soft">‹ Home</Link>
        <div className="flex items-center gap-4">
          <FontSizeControl />
          <ThemeToggle />
        </div>
      </div>
      <div className="flex justify-between items-center px-4 py-2 text-sm text-muted">
        <button onClick={() => navigate(`/read/page/${n - 1}`)} disabled={n <= 1} className="disabled:opacity-30">‹ Prev</button>
        <span>Page {n} / 604</span>
        <button onClick={() => navigate(`/read/page/${n + 1}`)} disabled={n >= 604} className="disabled:opacity-30">Next ›</button>
      </div>
      <div className="flex-1"><MushafPage page={n} /></div>
      <AudioBar firstSurahAyah={firstSurahAyah} />
    </div>
  );
}

export default function ReadPage() {
  const { page } = useParams();
  const n = Math.min(604, Math.max(1, Number(page) || 1));
  return (
    <AudioProvider>
      <ReadPageInner n={n} />
    </AudioProvider>
  );
}
```

- [ ] **Step 4: Build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/audio/AudioBar.tsx web/src/quran/FavoriteBar.tsx web/src/pages/ReadPage.tsx
git commit -m "feat(web): audio bar with reciter/speed and play-from-here"
```

---

## Task 8: Visual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Ensure the stack is running** (docker + api + web dev servers).

- [ ] **Step 2: Drive the browser (Playwright)** — log in, go to `/read/page/1`:
1. Click the AudioBar **▶** → audio starts; within ~1–2s a word gains the accent highlight. Confirm via `document.querySelector('span.bg-accent')` existing and the audio element's `currentTime > 0` (evaluate).
2. Wait ~2s → the highlighted word advances (different `data-position`/ayah than step 1).
3. Change **speed** to 1.5× → `audio.playbackRate === 1.5` (evaluate).
4. Change **reciter** to AbdulBaset → playback reloads with the new `audio.src` (host `download.quranicaudio.com`, `abdul_baset` in the path).
5. Tap a word → the action bar shows **▶ Play / ♥ Favorite**; tapping **▶ Play** starts playback from that ayah.
6. Screenshot showing a highlighted (accent) word mid-recitation.

- [ ] **Step 3: Confirm no console errors** (allow benign autoplay warnings).

- [ ] **Step 4: Report** pass/fail with the screenshot and the evaluated `{ currentTime, playbackRate, src }` values proving audio + sync work.

---

## Self-Review Notes

- **Spec coverage (§ audio):** reciter picker (Task 7), word-by-word highlight from timing (Tasks 5–6), 0.5–2× speed (Tasks 3, 7), play-from-here / click-to-seek at ayah granularity (Task 7). 3 reciters with verified segment data (Task 2).
- **Scope boundaries (intentional):** playback is per-surah; if a page spans two surahs, "play" starts from the first surah on the page and continues within it — crossing a surah boundary requires tapping an ayah in the next surah (noted; full cross-surah auto-advance is a later refinement). MP3s stream from the CDN (not offline). Syncing reciter/speed to backend `user_settings` is Phase 7.
- **Type consistency:** `HighlightedWord { surah, ayah, position }` is produced in `AudioContext.onTimeUpdate` and matched in `MushafLine`/`MushafWord` against page-global `position` computed in `MushafPage` (count of `type==='word'` per ayah, 1-based) — the same basis as the qdc `segments` word position. `ChapterTiming.verses` is keyed `"surah:ayah"`, matching the build script's `verse_key`. `playFrom(surah, ayah)` is the single entry point used by both `AudioBar` (page start) and `FavoriteBar` (tapped ayah).
- **Risk:** headless autoplay — playback is always initiated by a user click (satisfies the gesture requirement). Word-position alignment between our count and qdc segments is verified visually in Task 8 (the highlight must track the audio); if off-by-one appears, the fix is in `MushafPage` position counting (e.g. whether a segment ever indexes the end marker — it does not, per the data probe).
```
