# Qur'an Ayah-by-Ayah Reading Mode (Slice 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third reading mode — a page-aligned ayah-by-ayah list showing each ayah's Uthmani Arabic with its Saheeh International English translation, tappable to favorite or play audio.

**Architecture:** Generate a per-surah dataset of `{ surah, ayah, text, translation }` (from quran.com: Uthmani text + translation resource 20, footnote HTML stripped). Add `'ayah'` as a third `readingStyle`. The reader page branches: `mushaf`/`tajweed` render the existing `MushafPage`; `ayah` renders a new `AyahList` that derives the current page's ordered ayahs from the existing page JSON and looks up text/translation lazily by surah. Bookmark, time tracking, juz-left, and the Jump picker all stay page-based and unchanged.

**Tech Stack:** Node ESM build scripts + vitest; NestJS class-validator DTO; React 19 + @tanstack/react-query + Tailwind.

**Scope note:** Deliverable 3 of `docs/superpowers/specs/2026-06-02-quran-navigation-juz-progress-design.md` (§6). Builds on Slice 1 (`surahs.json`, `useSurahs`) and reuses `FavoriteBar` + audio. Slice 4 (flexible goals) follows in its own plan.

---

## Existing facts (grounding)

- `web/src/settings/SettingsContext.tsx`: `export type ReadingStyle = 'mushaf' | 'tajweed';` (line 8); `readingStyle` persisted to localStorage + synced to API.
- `api/src/settings/dto/update-settings.dto.ts`: `@IsOptional() @IsIn(['mushaf', 'tajweed']) readingStyle?: string;`
- `web/src/pages/SettingsPage.tsx`: a `styles` array (`mushaf`, `tajweed`) rendered in a `grid grid-cols-2 gap-3`.
- `web/src/pages/ReadPage.tsx`: `ReadPageInner` renders `<MushafPage page={n} />` inside a sheet `<div className="mx-auto max-w-3xl rounded-[1.75rem] ... shadow-lift">`. It already computes `firstSurahAyah` from `usePageData(n)` (independent of the rendered view).
- `web/src/quran/usePageData.ts`: `usePageData(page)` → `{ page, lines: [{ line, words: [{ glyph, type, surah, ayah }] }] }` (`MushafPageData`). Static JSON at `/quran/pages/{page}.json`.
- `web/src/quran/FavoriteBar.tsx`: `<FavoriteBar selected={{surah,ayah}} onClose={...} />` — already renders Play + Favorite + close; reuse as-is.
- `web/src/quran/useQuranMeta.ts`: `useSurahs()` → `Surah[]` (has `id`, `name`).
- `web/src/audio/useAudio.ts`: `useAudio()` → `{ highlighted: { surah, ayah, position } | null, playFrom, ... }`.
- Build scripts live in `scripts/`; pure helpers in `scripts/lib/` are vitest-tested in `scripts/test/`. Existing fetch-with-retry pattern in `scripts/build-quran-data.mjs`.

---

## File Structure

**Create**
- `scripts/lib/build-ayahs.mjs` — pure `stripHtml` + `buildAyahList(surah, uthmaniVerses, translations)`.
- `scripts/test/build-ayahs.test.mjs` — unit tests.
- `scripts/build-quran-ayahs.mjs` — fetches + writes `web/public/quran/ayahs/{1..114}.json`.
- `web/public/quran/ayahs/{1..114}.json` — generated (committed).
- `web/src/quran/useAyahTexts.ts` — lazy per-surah text/translation loader (returns a lookup Map).
- `web/src/quran/AyahList.tsx` — the page-aligned ayah list view.

**Modify**
- `api/src/settings/dto/update-settings.dto.ts` — allow `'ayah'`.
- `web/src/settings/SettingsContext.tsx` — extend `ReadingStyle`.
- `web/src/pages/SettingsPage.tsx` — third style option (3-up grid).
- `web/src/pages/ReadPage.tsx` — branch to `AyahList` when `readingStyle === 'ayah'`.

---

## Task 1: Pure ayah-list builder

**Files:** Create `scripts/lib/build-ayahs.mjs`; Test `scripts/test/build-ayahs.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/test/build-ayahs.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { stripHtml, buildAyahList } from '../lib/build-ayahs.mjs';

describe('stripHtml', () => {
  it('removes tags (e.g. Saheeh footnote markers) and collapses whitespace', () => {
    expect(stripHtml('This is the Book<sup foot_note=1>1</sup> about which')).toBe('This is the Book1 about which');
    expect(stripHtml('  spaced   out\n text ')).toBe('spaced out text');
  });
});

describe('buildAyahList', () => {
  it('zips uthmani verses with cleaned translations by index', () => {
    const uthmani = [
      { verse_key: '2:1', text_uthmani: 'الٓمٓ' },
      { verse_key: '2:2', text_uthmani: 'ذَٰلِكَ ٱلْكِتَٰبُ' },
    ];
    const translations = [
      { text: 'Alif, Lam, Meem.' },
      { text: 'This is the Book<sup foot_note=8>1</sup> about which' },
    ];
    expect(buildAyahList(2, uthmani, translations)).toEqual([
      { surah: 2, ayah: 1, text: 'الٓمٓ', translation: 'Alif, Lam, Meem.' },
      { surah: 2, ayah: 2, text: 'ذَٰلِكَ ٱلْكِتَٰبُ', translation: 'This is the Book1 about which' },
    ]);
  });

  it('throws when lengths differ', () => {
    expect(() => buildAyahList(1, [{ verse_key: '1:1', text_uthmani: 'x' }], [])).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/test/build-ayahs.test.mjs`
Expected: FAIL — cannot resolve `../lib/build-ayahs.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/build-ayahs.mjs`:

```js
export function stripHtml(s) {
  return String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export function buildAyahList(surah, uthmaniVerses, translations) {
  if (uthmaniVerses.length !== translations.length) {
    throw new Error(`surah ${surah}: ${uthmaniVerses.length} verses vs ${translations.length} translations`);
  }
  return uthmaniVerses.map((v, i) => {
    const [s, ayah] = v.verse_key.split(':').map(Number);
    return { surah: s, ayah, text: v.text_uthmani, translation: stripHtml(translations[i].text) };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/test/build-ayahs.test.mjs`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add scripts/lib/build-ayahs.mjs scripts/test/build-ayahs.test.mjs
git commit -m "feat(data): pure ayah text+translation builder"
```

---

## Task 2: Generate the ayah text + translation dataset

**Files:** Create `scripts/build-quran-ayahs.mjs`; generated `web/public/quran/ayahs/{1..114}.json`

- [ ] **Step 1: Write the generator**

Create `scripts/build-quran-ayahs.mjs`:

```js
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
```

- [ ] **Step 2: Run the generator** (needs network; ~228 requests, a minute or two)

Run: `node scripts/build-quran-ayahs.mjs`
Expected: progress lines and `done: 6236 ayahs across 114 files`. If it throws a per-surah count mismatch or total != 6236, STOP and report BLOCKED with the exact error — do NOT relax the assertions.

- [ ] **Step 3: Spot-check the output**

Run: `node --input-type=module -e "import('node:fs').then(fs => { const a=JSON.parse(fs.readFileSync('web/public/quran/ayahs/1.json')); const b=JSON.parse(fs.readFileSync('web/public/quran/ayahs/2.json')); console.log('fatiha[0]',a[0]); console.log('fatiha len',a.length); console.log('baqarah[1]',b[1]); console.log('has html?', /</.test(JSON.stringify(a)+JSON.stringify(b))); })"`
Expected: `fatiha[0]` has `surah:1, ayah:1`, non-empty `text` (Arabic) and `translation` (English); `fatiha len` 7; `baqarah[1]` is `2:2`; `has html?` false (no leftover tags).

- [ ] **Step 4: Commit**

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add scripts/build-quran-ayahs.mjs web/public/quran/ayahs
git commit -m "feat(data): generate per-surah ayah text + Saheeh Intl translation"
```

---

## Task 3: Allow the `ayah` reading style end-to-end

**Files:** Modify `api/src/settings/dto/update-settings.dto.ts`, `web/src/settings/SettingsContext.tsx`, `web/src/pages/SettingsPage.tsx`

- [ ] **Step 1: API DTO**

In `api/src/settings/dto/update-settings.dto.ts`, change:
```ts
  @IsOptional() @IsIn(['mushaf', 'tajweed']) readingStyle?: string;
```
to:
```ts
  @IsOptional() @IsIn(['mushaf', 'tajweed', 'ayah']) readingStyle?: string;
```

- [ ] **Step 2: Web type**

In `web/src/settings/SettingsContext.tsx`, change:
```ts
export type ReadingStyle = 'mushaf' | 'tajweed';
```
to:
```ts
export type ReadingStyle = 'mushaf' | 'tajweed' | 'ayah';
```

- [ ] **Step 3: Settings UI (3-up)**

In `web/src/pages/SettingsPage.tsx`, find the `styles` array:
```tsx
  const styles: { key: 'mushaf' | 'tajweed'; name: string; blurb: string }[] = [
    { key: 'mushaf', name: 'Mushaf', blurb: 'Page-faithful QCF script' },
    { key: 'tajweed', name: 'Tajwīd', blurb: 'Colour-coded rules' },
  ];
```
and replace it with:
```tsx
  const styles: { key: 'mushaf' | 'tajweed' | 'ayah'; name: string; blurb: string }[] = [
    { key: 'mushaf', name: 'Mushaf', blurb: 'Page-faithful QCF script' },
    { key: 'tajweed', name: 'Tajwīd', blurb: 'Colour-coded rules' },
    { key: 'ayah', name: 'Translation', blurb: 'Ayah-by-ayah + English' },
  ];
```
Then find the reading-style grid wrapper `<div className="grid grid-cols-2 gap-3">` that renders `styles.map(...)` and change `grid-cols-2` to `grid-cols-3`.

- [ ] **Step 4: Verify**

Run from `api/`: `npm run build` → clean.
Run from `web/`: `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add api/src/settings/dto/update-settings.dto.ts web/src/settings/SettingsContext.tsx web/src/pages/SettingsPage.tsx
git commit -m "feat: allow 'ayah' reading style (settings)"
```

---

## Task 4: Ayah text loader hook

**Files:** Create `web/src/quran/useAyahTexts.ts`

- [ ] **Step 1: Write the loader**

Create `web/src/quran/useAyahTexts.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

export type AyahText = { surah: number; ayah: number; text: string; translation: string };

/** Loads the given surahs' ayah text+translation and returns a `${surah}:${ayah}` → AyahText map. */
export function useAyahTexts(surahs: number[]) {
  const key = [...surahs].sort((a, b) => a - b);
  return useQuery({
    queryKey: ['ayah-text', key],
    enabled: key.length > 0,
    staleTime: Infinity,
    queryFn: async (): Promise<Map<string, AyahText>> => {
      const lists = await Promise.all(
        key.map((s) =>
          fetch(`/quran/ayahs/${s}.json`).then((r) => {
            if (!r.ok) throw new Error(`ayahs ${s}: ${r.status}`);
            return r.json() as Promise<AyahText[]>;
          }),
        ),
      );
      const map = new Map<string, AyahText>();
      for (const list of lists) for (const a of list) map.set(`${a.surah}:${a.ayah}`, a);
      return map;
    },
  });
}
```

- [ ] **Step 2: Type-check**

Run from `web/`: `npx tsc --noEmit` → clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add web/src/quran/useAyahTexts.ts
git commit -m "feat(web): lazy per-surah ayah text loader"
```

---

## Task 5: AyahList component

**Files:** Create `web/src/quran/AyahList.tsx`

- [ ] **Step 1: Write the component**

Create `web/src/quran/AyahList.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { usePageData } from './usePageData';
import { useAyahTexts } from './useAyahTexts';
import { useSurahs } from './useQuranMeta';
import { FavoriteBar } from './FavoriteBar';
import { useSettings } from '../settings/useSettings';
import { useAudio } from '../audio/useAudio';

export function AyahList({ page }: { page: number }) {
  const { data, isLoading, isError } = usePageData(page);
  const { fontScale } = useSettings();
  const { highlighted } = useAudio();
  const { data: surahs } = useSurahs();
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(null);
  useEffect(() => { setSelected(null); }, [page]);

  // ordered distinct ayahs present on this page, in reading order
  const pageAyahs = useMemo(() => {
    const seen = new Set<string>();
    const out: { surah: number; ayah: number }[] = [];
    for (const line of data?.lines ?? []) {
      for (const w of line.words) {
        const k = `${w.surah}:${w.ayah}`;
        if (!seen.has(k)) { seen.add(k); out.push({ surah: w.surah, ayah: w.ayah }); }
      }
    }
    return out;
  }, [data]);

  const surahIds = useMemo(() => [...new Set(pageAyahs.map((a) => a.surah))], [pageAyahs]);
  const { data: textMap } = useAyahTexts(surahIds);

  if (isLoading) return <div className="p-8 text-muted">Loading page {page}…</div>;
  if (isError || !data) return <div className="p-8 text-red-500">Could not load page {page}.</div>;

  const surahName = (id: number) => surahs?.find((s) => s.id === id)?.name ?? `Surah ${id}`;

  return (
    <>
      <div className="mx-auto max-w-2xl px-5 sm:px-8 py-6 space-y-5">
        {pageAyahs.map((a, i) => {
          const t = textMap?.get(`${a.surah}:${a.ayah}`);
          const isNewSurah = i === 0 || pageAyahs[i - 1].surah !== a.surah;
          const playing = highlighted?.surah === a.surah && highlighted?.ayah === a.ayah;
          return (
            <div key={`${a.surah}:${a.ayah}`}>
              {isNewSurah && (
                <div className="mb-3 mt-2 text-center">
                  <span className="font-display text-lg text-accent-soft">{surahName(a.surah)}</span>
                </div>
              )}
              <button
                onClick={() => setSelected({ surah: a.surah, ayah: a.ayah })}
                className={`w-full rounded-2xl px-4 py-4 text-left transition ${playing ? 'bg-accent/10' : 'hover:bg-line-light/40 dark:hover:bg-line-dark/40'}`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-1 grid h-6 min-w-[1.5rem] shrink-0 place-items-center rounded-full bg-accent/10 px-1.5 text-[11px] text-accent-soft">
                    {a.surah}:{a.ayah}
                  </span>
                  <div className="flex-1 space-y-2">
                    <p dir="rtl" className="font-quran leading-[2] text-ink dark:text-ink-dark" style={{ fontSize: `${26 * fontScale}px` }}>
                      {t?.text ?? '…'}
                    </p>
                    <p className="text-sm leading-relaxed text-muted">{t?.translation ?? ''}</p>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
      {selected && <FavoriteBar selected={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run from `web/`: `npx tsc --noEmit` → clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add web/src/quran/AyahList.tsx
git commit -m "feat(web): page-aligned ayah-by-ayah list view"
```

---

## Task 6: Branch the reader on reading style

**Files:** Modify `web/src/pages/ReadPage.tsx`

- [ ] **Step 1: Import and branch**

In `web/src/pages/ReadPage.tsx`:

Add imports after the existing `import { MushafPage } from '../quran/MushafPage';` line:
```tsx
import { AyahList } from '../quran/AyahList';
import { useSettings } from '../settings/useSettings';
```

Inside `ReadPageInner`, after the existing `const { data: juz } = useJuzList();` line (added in Slice 1), add:
```tsx
  const { readingStyle } = useSettings();
```

Find the sheet that renders the page:
```tsx
        <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-line-light dark:border-line-dark bg-card-light dark:bg-card-dark shadow-lift">
          <MushafPage page={n} />
        </div>
```
and replace the inner `<MushafPage page={n} />` so it becomes:
```tsx
        <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-line-light dark:border-line-dark bg-card-light dark:bg-card-dark shadow-lift">
          {readingStyle === 'ayah' ? <AyahList page={n} /> : <MushafPage page={n} />}
        </div>
```

- [ ] **Step 2: Type-check + tests**

Run from `web/`: `npx tsc --noEmit` (clean) and `npx vitest run` (existing tests still pass).

- [ ] **Step 3: Commit**

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add web/src/pages/ReadPage.tsx
git commit -m "feat(web): render ayah-by-ayah list when reading style is 'ayah'"
```

---

## Final verification

- [ ] **Builds/tests**: `api/` `npm run build` clean; `web/` `npx tsc --noEmit` clean and `npx vitest run` passing; `npx vitest run scripts/test/build-ayahs.test.mjs` passing.
- [ ] **Data**: `web/public/quran/ayahs/` has 114 files; total 6236 ayahs; no HTML tags remain in translations.
- [ ] **Manual smoke** (dev app, logged in):
  - Settings → Reading style now shows three options; pick **Translation**.
  - Open the reader: each ayah shows a `s:a` badge, Arabic (respects font-size setting), and the English translation; a surah name header appears where a new surah starts on the page.
  - Tapping an ayah opens the Favorite/Play bar; Play highlights the playing ayah.
  - Page nav (‹ ›), the juz-left indicator, the Jump picker, and bookmarks still work in this mode.
  - Switching back to Mushaf/Tajwīd restores the page rendering.

---

## Self-review notes (addressed)

- **Spec coverage (§6):** third `readingStyle` ✓ (Task 3); per-ayah text + Saheeh Intl dataset ✓ (Tasks 1–2); page-aligned list with translation ✓ (Task 5); tap to favorite/play via reused `FavoriteBar` ✓; playing-ayah highlight via `useAudio().highlighted` ✓; surah header on surah change ✓.
- **Page-aligned, nothing else disturbed:** `AyahList` derives its ayahs from the same `usePageData(page)` the reader already loads; `ReadPage` only swaps the inner component, so bookmark/tracking/juz-left/Jump are untouched.
- **Lazy data:** `ayahs/{surah}.json` is fetched only when ayah mode renders a page (`useAyahTexts` is `enabled` only with surah ids), and cached `staleTime: Infinity`.
- **Translation cleanliness:** footnote HTML stripped at build time (`stripHtml`), asserted by the unit test and the Task 2 spot-check.
- **No bismillah special-casing** for surah starts in v1 (YAGNI) — a surah-name header marks transitions; revisit if desired.
- **Type/name consistency:** `AyahText` defined once in `useAyahTexts.ts`; `ReadingStyle` extended in the web type and the API DTO together; the SettingsPage option `key` union matches.
