# Qur'an Navigation + Juz Progress (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users browse and jump to any surah or juz, resume reading by surah + ayah, and see how many ayahs remain to finish the current juz.

**Architecture:** Generate two small static metadata files (`surahs.json`, `juz.json`) from the already-generated `ayah-ref.json` plus one quran.com `/chapters` call. The web app loads them via react-query and computes all juz/index math client-side with pure helpers — no new API or DB changes. A new Browse page and an in-reader Jump picker navigate by resolving a surah/juz to its starting page (reusing `/read/page/:n`).

**Tech Stack:** Node ESM build scripts + vitest; React 19 + react-router 7 + @tanstack/react-query + Tailwind.

**Scope note:** This is deliverable 1 of the spec `docs/superpowers/specs/2026-06-02-quran-navigation-juz-progress-design.md`. Slices 2 (coverage/khatm), 3 (ayah view), and 4 (flexible goals) get their own plans afterward.

---

## File Structure

**Create**
- `scripts/lib/derive-meta.mjs` — pure functions `deriveSurahs(ayahRef, chapters)` and `deriveJuz(ayahRef)`.
- `scripts/test/derive-meta.test.mjs` — unit tests for the above.
- `scripts/build-quran-meta.mjs` — reads `scripts/generated/ayah-ref.json` + fetches `/chapters`, writes the two JSON files.
- `web/public/quran/surahs.json`, `web/public/quran/juz.json` — generated output (committed).
- `web/vitest.config.ts` — enables `vitest` for web unit tests.
- `web/src/quran/quranIndex.ts` — pure types + helpers (`globalAyahIndex`, `juzOf`, `ayahsLeftInJuz`, `pageForSurah`, `pageForJuz`).
- `web/src/quran/quranIndex.test.ts` — unit tests for the helpers.
- `web/src/quran/useQuranMeta.ts` — react-query loaders for `surahs.json` / `juz.json`.
- `web/src/pages/BrowsePage.tsx` — Surah | Juz tabs.
- `web/src/quran/JumpPicker.tsx` — in-reader surah/juz jump popover.

**Modify**
- `web/src/layout/icons.tsx` — add `ListIcon`.
- `web/src/layout/AppShell.tsx` — add Browse nav item; widen mobile bottom nav.
- `web/src/App.tsx` — add `/browse` route.
- `web/src/pages/ReadPage.tsx` — mount `JumpPicker`; show "ayahs left in juz".
- `web/src/pages/DashboardPage.tsx` — resume label by surah+ayah; "ayahs left in juz" on the continue card.
- `web/package.json` — add `"test": "vitest run"` script.

---

## Task 1: Pure metadata derivation

**Files:**
- Create: `scripts/lib/derive-meta.mjs`
- Test: `scripts/test/derive-meta.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/test/derive-meta.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { deriveSurahs, deriveJuz } from '../lib/derive-meta.mjs';

const ayahRef = [
  { surah: 1, ayah: 1, page: 1, juz: 1, letterCount: 19 },
  { surah: 1, ayah: 2, page: 1, juz: 1, letterCount: 17 },
  { surah: 1, ayah: 3, page: 1, juz: 1, letterCount: 12 },
  { surah: 2, ayah: 1, page: 2, juz: 1, letterCount: 8 },
  { surah: 2, ayah: 2, page: 2, juz: 1, letterCount: 40 },
  { surah: 2, ayah: 3, page: 3, juz: 2, letterCount: 30 },
];
const chapters = [
  { id: 1, name_simple: 'Al-Fatihah', name_arabic: 'الفاتحة', revelation_place: 'makkah' },
  { id: 2, name_simple: 'Al-Baqarah', name_arabic: 'البقرة', revelation_place: 'madinah' },
];

describe('deriveSurahs', () => {
  it('computes ayahCount (max ayah) and startPage (min page) and maps names/revelation', () => {
    const s = deriveSurahs(ayahRef, chapters);
    expect(s).toEqual([
      { id: 1, name: 'Al-Fatihah', arabicName: 'الفاتحة', ayahCount: 3, startPage: 1, revelation: 'meccan' },
      { id: 2, name: 'Al-Baqarah', arabicName: 'البقرة', ayahCount: 3, startPage: 2, revelation: 'medinan' },
    ]);
  });
});

describe('deriveJuz', () => {
  it('groups by juz with ayahCount and the first (surah,ayah,page) as start', () => {
    const j = deriveJuz(ayahRef);
    expect(j).toEqual([
      { juz: 1, startSurah: 1, startAyah: 1, startPage: 1, ayahCount: 5 },
      { juz: 2, startSurah: 2, startAyah: 3, startPage: 3, ayahCount: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/test/derive-meta.test.mjs`
Expected: FAIL — `Failed to resolve import "../lib/derive-meta.mjs"`.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/derive-meta.mjs`:

```js
const REVELATION = { makkah: 'meccan', madinah: 'medinan' };

export function deriveSurahs(ayahRef, chapters) {
  const agg = new Map(); // surah -> { ayahCount, startPage }
  for (const a of ayahRef) {
    const cur = agg.get(a.surah) ?? { ayahCount: 0, startPage: a.page };
    cur.ayahCount = Math.max(cur.ayahCount, a.ayah);
    cur.startPage = Math.min(cur.startPage, a.page);
    agg.set(a.surah, cur);
  }
  return chapters
    .slice()
    .sort((x, y) => x.id - y.id)
    .map((c) => {
      const a = agg.get(c.id);
      if (!a) throw new Error(`no ayah data for surah ${c.id}`);
      return {
        id: c.id,
        name: c.name_simple,
        arabicName: c.name_arabic,
        ayahCount: a.ayahCount,
        startPage: a.startPage,
        revelation: REVELATION[c.revelation_place] ?? c.revelation_place,
      };
    });
}

export function deriveJuz(ayahRef) {
  const agg = new Map(); // juz -> { startSurah, startAyah, startPage, ayahCount }
  for (const a of ayahRef) {
    const cur = agg.get(a.juz);
    if (!cur) {
      agg.set(a.juz, { startSurah: a.surah, startAyah: a.ayah, startPage: a.page, ayahCount: 1 });
      continue;
    }
    cur.ayahCount += 1;
    const earlier = a.surah < cur.startSurah || (a.surah === cur.startSurah && a.ayah < cur.startAyah);
    if (earlier) {
      cur.startSurah = a.surah;
      cur.startAyah = a.ayah;
      cur.startPage = a.page;
    }
  }
  return [...agg.keys()]
    .sort((x, y) => x - y)
    .map((juz) => ({ juz, ...agg.get(juz) }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/test/derive-meta.test.mjs`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/derive-meta.mjs scripts/test/derive-meta.test.mjs
git commit -m "feat(data): pure surah/juz metadata derivation from ayah-ref"
```

---

## Task 2: Generate surahs.json + juz.json

**Files:**
- Create: `scripts/build-quran-meta.mjs`
- Create (generated): `web/public/quran/surahs.json`, `web/public/quran/juz.json`

- [ ] **Step 1: Write the generator script**

Create `scripts/build-quran-meta.mjs`:

```js
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
```

- [ ] **Step 2: Run the generator**

Run: `node scripts/build-quran-meta.mjs`
Expected: `done: 114 surahs, 30 juz, 6236 ayahs` and two files written.

- [ ] **Step 3: Sanity-check the output**

Run: `node --input-type=module -e "import('node:fs').then(async fs => { const s=JSON.parse(fs.readFileSync('web/public/quran/surahs.json')); const j=JSON.parse(fs.readFileSync('web/public/quran/juz.json')); console.log(s[0], s[113], j[0], j[29]); })"`
Expected: surah 1 is `Al-Fatihah` ayahCount 7 startPage 1 revelation `meccan`; surah 114 is `An-Nas`; juz 1 starts 1:1 page 1; juz 30 starts 78:1.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-quran-meta.mjs web/public/quran/surahs.json web/public/quran/juz.json
git commit -m "feat(data): generate surahs.json + juz.json metadata"
```

---

## Task 3: Pure client-side juz/index helpers

**Files:**
- Create: `web/vitest.config.ts`
- Modify: `web/package.json`
- Create: `web/src/quran/quranIndex.ts`
- Test: `web/src/quran/quranIndex.test.ts`

- [ ] **Step 1: Add the vitest config and test script**

Create `web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

In `web/package.json`, add to `"scripts"` (after `"preview": "vite preview"`, with a comma):

```json
    "test": "vitest run"
```

- [ ] **Step 2: Write the failing test**

Create `web/src/quran/quranIndex.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { globalAyahIndex, juzOf, ayahsLeftInJuz, pageForSurah, pageForJuz } from './quranIndex';
import type { Surah, Juz } from './quranIndex';

const surahs: Surah[] = [
  { id: 1, name: 'Al-Fatihah', arabicName: 'الفاتحة', ayahCount: 3, startPage: 1, revelation: 'meccan' },
  { id: 2, name: 'Al-Baqarah', arabicName: 'البقرة', ayahCount: 3, startPage: 2, revelation: 'medinan' },
];
const juzs: Juz[] = [
  { juz: 1, startSurah: 1, startAyah: 1, startPage: 1, ayahCount: 5 },
  { juz: 2, startSurah: 2, startAyah: 3, startPage: 3, ayahCount: 1 },
];

describe('quranIndex', () => {
  it('globalAyahIndex is a 1-based cumulative index', () => {
    expect(globalAyahIndex(surahs, 1, 1)).toBe(1);
    expect(globalAyahIndex(surahs, 2, 1)).toBe(4);
    expect(globalAyahIndex(surahs, 2, 3)).toBe(6);
  });
  it('juzOf finds the containing juz', () => {
    expect(juzOf(surahs, juzs, 1, 1)).toBe(1);
    expect(juzOf(surahs, juzs, 2, 2)).toBe(1);
    expect(juzOf(surahs, juzs, 2, 3)).toBe(2);
  });
  it('ayahsLeftInJuz counts inclusive to end of the juz', () => {
    expect(ayahsLeftInJuz(surahs, juzs, 1, 1)).toBe(5); // whole juz 1
    expect(ayahsLeftInJuz(surahs, juzs, 1, 2)).toBe(4);
    expect(ayahsLeftInJuz(surahs, juzs, 2, 2)).toBe(1); // last ayah of juz 1
    expect(ayahsLeftInJuz(surahs, juzs, 2, 3)).toBe(1); // whole juz 2 (1 ayah)
  });
  it('page lookups', () => {
    expect(pageForSurah(surahs, 2)).toBe(2);
    expect(pageForJuz(juzs, 2)).toBe(3);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd web && npx vitest run src/quran/quranIndex.test.ts`
Expected: FAIL — cannot resolve `./quranIndex`.

- [ ] **Step 4: Write the implementation**

Create `web/src/quran/quranIndex.ts`:

```ts
export type Surah = {
  id: number;
  name: string;
  arabicName: string;
  ayahCount: number;
  startPage: number;
  revelation: 'meccan' | 'medinan';
};

export type Juz = {
  juz: number;
  startSurah: number;
  startAyah: number;
  startPage: number;
  ayahCount: number;
};

/** 1-based cumulative ayah index across the whole Qur'an. */
export function globalAyahIndex(surahs: Surah[], surah: number, ayah: number): number {
  let idx = 0;
  for (const s of surahs) {
    if (s.id < surah) idx += s.ayahCount;
    else break;
  }
  return idx + ayah;
}

/** The juz number containing (surah, ayah). */
export function juzOf(surahs: Surah[], juzs: Juz[], surah: number, ayah: number): number {
  const gi = globalAyahIndex(surahs, surah, ayah);
  let current = juzs[0]?.juz ?? 1;
  for (const j of juzs) {
    if (globalAyahIndex(surahs, j.startSurah, j.startAyah) <= gi) current = j.juz;
    else break;
  }
  return current;
}

/** Ayahs from (surah, ayah) inclusive to the end of its juz. */
export function ayahsLeftInJuz(surahs: Surah[], juzs: Juz[], surah: number, ayah: number): number {
  const gi = globalAyahIndex(surahs, surah, ayah);
  const jz = juzs.find((j) => j.juz === juzOf(surahs, juzs, surah, ayah));
  if (!jz) return 0;
  const startIdx = globalAyahIndex(surahs, jz.startSurah, jz.startAyah);
  const endIdx = startIdx + jz.ayahCount - 1;
  return endIdx - gi + 1;
}

export function pageForSurah(surahs: Surah[], id: number): number {
  return surahs.find((s) => s.id === id)?.startPage ?? 1;
}

export function pageForJuz(juzs: Juz[], n: number): number {
  return juzs.find((j) => j.juz === n)?.startPage ?? 1;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd web && npx vitest run src/quran/quranIndex.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 6: Commit**

```bash
git add web/vitest.config.ts web/package.json web/src/quran/quranIndex.ts web/src/quran/quranIndex.test.ts
git commit -m "feat(web): pure juz/ayah index helpers + vitest setup"
```

---

## Task 4: react-query loader for the metadata

**Files:**
- Create: `web/src/quran/useQuranMeta.ts`

- [ ] **Step 1: Write the loader**

Create `web/src/quran/useQuranMeta.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { Surah, Juz } from './quranIndex';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export function useSurahs() {
  return useQuery({
    queryKey: ['surahs'],
    queryFn: () => fetchJson<Surah[]>('/quran/surahs.json'),
    staleTime: Infinity,
  });
}

export function useJuzList() {
  return useQuery({
    queryKey: ['juz'],
    queryFn: () => fetchJson<Juz[]>('/quran/juz.json'),
    staleTime: Infinity,
  });
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/quran/useQuranMeta.ts
git commit -m "feat(web): react-query loaders for surah/juz metadata"
```

---

## Task 5: Browse page (Surah | Juz tabs) + route + nav

**Files:**
- Modify: `web/src/layout/icons.tsx`
- Create: `web/src/pages/BrowsePage.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/layout/AppShell.tsx`

- [ ] **Step 1: Add the ListIcon**

In `web/src/layout/icons.tsx`, add at the end (before the final newline):

```tsx
export function ListIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}
```

- [ ] **Step 2: Create the Browse page**

Create `web/src/pages/BrowsePage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSurahs, useJuzList } from '../quran/useQuranMeta';
import { pageForSurah, pageForJuz } from '../quran/quranIndex';

type Tab = 'surah' | 'juz';

export default function BrowsePage() {
  const navigate = useNavigate();
  const { data: surahs } = useSurahs();
  const { data: juz } = useJuzList();
  const [tab, setTab] = useState<Tab>('surah');

  const tabBtn = (key: Tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={
        'rounded-xl px-4 py-2 text-sm transition ' +
        (tab === key ? 'bg-accent text-white' : 'text-muted hover:text-ink dark:hover:text-ink-dark')
      }
    >
      {label}
    </button>
  );

  const row = 'flex items-center gap-4 w-full rounded-2xl border border-line-light dark:border-line-dark bg-card-light dark:bg-card-dark px-4 py-3 text-left hover:border-accent-soft transition';

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 lg:px-12 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl tracking-tight">Browse</h1>
        <p className="mt-1 text-muted">Jump to any surah or juz.</p>
      </header>

      <div className="mb-5 inline-flex gap-1 rounded-2xl bg-surface-light dark:bg-surface-dark p-1">
        {tabBtn('surah', 'Surahs')}
        {tabBtn('juz', 'Juz')}
      </div>

      {tab === 'surah' && (
        <div className="space-y-2">
          {surahs?.map((s) => (
            <button key={s.id} onClick={() => navigate(`/read/page/${pageForSurah(surahs, s.id)}`)} className={row}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-sm text-accent-soft">{s.id}</span>
              <span className="flex-1">
                <span className="block font-medium">{s.name}</span>
                <span className="block text-xs text-muted">{s.ayahCount} ayahs · {s.revelation === 'meccan' ? 'Meccan' : 'Medinan'}</span>
              </span>
              <span className="font-quran text-xl">{s.arabicName}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'juz' && (
        <div className="space-y-2">
          {juz?.map((j) => (
            <button key={j.juz} onClick={() => navigate(`/read/page/${pageForJuz(juz, j.juz)}`)} className={row}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-sm text-accent-soft">{j.juz}</span>
              <span className="flex-1">
                <span className="block font-medium">Juz {j.juz}</span>
                <span className="block text-xs text-muted">starts {j.startSurah}:{j.startAyah} · {j.ayahCount} ayahs</span>
              </span>
              <span className="text-xs text-muted">p.{j.startPage}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the route**

In `web/src/App.tsx`, add the import after `import DashboardPage from './pages/DashboardPage';`:

```tsx
import BrowsePage from './pages/BrowsePage';
```

And add the route inside the `AppShell` route group, after the `/read/page/:page` route:

```tsx
              <Route path="/browse" element={<BrowsePage />} />
```

- [ ] **Step 4: Add the nav item**

In `web/src/layout/AppShell.tsx`:

Update the icons import to include `ListIcon`:

```tsx
import { BookIcon, ChartIcon, FlameIcon, GearIcon, HeartIcon, HomeIcon, ListIcon } from './icons';
```

Add a Browse item to the `items` array, right after the Read item:

```tsx
    { to: '/browse', label: 'Browse', icon: ListIcon, prefix: '/browse' },
```

Widen the mobile bottom nav so six items fit — change the bottom-nav `<nav>` className from `grid-cols-5` to `grid-cols-6`:

```tsx
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 grid grid-cols-6 border-t border-line-light dark:border-line-dark bg-sidebar-light/95 dark:bg-sidebar-dark/95 backdrop-blur">
```

- [ ] **Step 5: Type-check and verify in the browser**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

Then with the dev server running, log in and visit `/browse`: the Surahs tab lists 114 surahs (1 Al-Fatihah … 114 An-Nas); switching to Juz lists 30. Tapping "Al-Baqarah" navigates to `/read/page/2`; tapping "Juz 30" navigates to its start page. The Browse item appears in the sidebar and mobile bottom nav.

- [ ] **Step 6: Commit**

```bash
git add web/src/layout/icons.tsx web/src/pages/BrowsePage.tsx web/src/App.tsx web/src/layout/AppShell.tsx
git commit -m "feat(web): Browse page with Surah/Juz tabs + nav entry"
```

---

## Task 6: In-reader Jump picker

**Files:**
- Create: `web/src/quran/JumpPicker.tsx`
- Modify: `web/src/pages/ReadPage.tsx`

- [ ] **Step 1: Create the JumpPicker**

Create `web/src/quran/JumpPicker.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSurahs, useJuzList } from './useQuranMeta';
import { pageForSurah, pageForJuz } from './quranIndex';

export function JumpPicker() {
  const navigate = useNavigate();
  const { data: surahs } = useSurahs();
  const { data: juz } = useJuzList();
  const [open, setOpen] = useState(false);

  const selectCls =
    'w-full rounded-xl border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark text-ink dark:text-ink-dark px-3 py-2 text-sm focus:outline-none';
  const opt = 'bg-card-light dark:bg-card-dark text-ink dark:text-ink-dark';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-line-light dark:border-line-dark px-3 py-1.5 text-sm text-muted hover:text-ink dark:hover:text-ink-dark transition"
      >
        Jump
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 space-y-3 rounded-2xl border border-line-light dark:border-line-dark bg-card-light dark:bg-card-dark p-4 shadow-lift">
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.12em] text-muted">Surah</div>
            <select
              className={selectCls}
              defaultValue=""
              onChange={(e) => {
                if (!surahs || !e.target.value) return;
                navigate(`/read/page/${pageForSurah(surahs, Number(e.target.value))}`);
                setOpen(false);
              }}
            >
              <option value="" className={opt}>Select surah…</option>
              {surahs?.map((s) => (
                <option key={s.id} value={s.id} className={opt}>{s.id}. {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.12em] text-muted">Juz</div>
            <select
              className={selectCls}
              defaultValue=""
              onChange={(e) => {
                if (!juz || !e.target.value) return;
                navigate(`/read/page/${pageForJuz(juz, Number(e.target.value))}`);
                setOpen(false);
              }}
            >
              <option value="" className={opt}>Select juz…</option>
              {juz?.map((j) => (
                <option key={j.juz} value={j.juz} className={opt}>Juz {j.juz}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount it in the reading toolbar**

In `web/src/pages/ReadPage.tsx`, add the import after `import { FontSizeControl } from '../components/FontSizeControl';`:

```tsx
import { JumpPicker } from '../quran/JumpPicker';
```

Replace the toolbar's right-side control block:

```tsx
          <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:block">
            <FontSizeControl />
          </div>
```

with one that includes the JumpPicker:

```tsx
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
            <JumpPicker />
            <span className="hidden sm:block"><FontSizeControl /></span>
          </div>
```

- [ ] **Step 3: Type-check and verify**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

In the browser on a read page, click "Jump", pick a surah → it navigates to that surah's page and the popover closes; same for juz.

- [ ] **Step 4: Commit**

```bash
git add web/src/quran/JumpPicker.tsx web/src/pages/ReadPage.tsx
git commit -m "feat(web): in-reader Jump picker for surah/juz"
```

---

## Task 7: Resume by surah + ayah + ayahs-left on the dashboard card

**Files:**
- Modify: `web/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Wire metadata + position into the dashboard**

In `web/src/pages/DashboardPage.tsx`, add imports after `import { formatDuration } from '../lib/formatDuration';`:

```tsx
import { useSurahs, useJuzList } from '../quran/useQuranMeta';
import { ayahsLeftInJuz, juzOf } from '../quran/quranIndex';
```

Inside the component, after `const { data: bookmark } = useBookmark();`, add:

```tsx
  const { data: surahs } = useSurahs();
  const { data: juz } = useJuzList();
  const resumeSurah = bookmark?.surah;
  const resumeAyah = bookmark?.ayah;
  const surahName = surahs && resumeSurah ? surahs.find((s) => s.id === resumeSurah)?.name : undefined;
  const juzInfo =
    surahs && juz && resumeSurah && resumeAyah
      ? { n: juzOf(surahs, juz, resumeSurah, resumeAyah), left: ayahsLeftInJuz(surahs, juz, resumeSurah, resumeAyah) }
      : undefined;
```

- [ ] **Step 2: Show the juz-left line and a richer resume label**

Add the juz-left line just below the goal progress bar — after this block:

```tsx
          <div className="mt-4 h-2 rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden">
            <div className="h-full rounded-full bg-accent-soft transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
```

insert:

```tsx
          {juzInfo && (
            <p className="mt-3 text-sm text-muted">
              {juzInfo.left} ayah{juzInfo.left === 1 ? '' : 's'} left to finish Juz {juzInfo.n}
            </p>
          )}
```

Then update the resume button label — replace:

```tsx
            {bookmark ? `Continue · page ${resume}` : 'Start reading'}
```

with:

```tsx
            {bookmark
              ? `Continue · ${surahName ?? `page ${resume}`}${surahName ? ` ${resumeSurah}:${resumeAyah}` : ''}`
              : 'Start reading'}
```

- [ ] **Step 3: Type-check and verify**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

In the browser: read a few pages (so a bookmark with surah/ayah saves), return to the dashboard. The continue button reads e.g. `Continue · Al-Baqarah 2:25` and the card shows `N ayahs left to finish Juz 1`.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/DashboardPage.tsx
git commit -m "feat(web): resume by surah+ayah and ayahs-left-in-juz on dashboard"
```

---

## Task 8: Ayahs-left-in-juz in the reader

**Files:**
- Modify: `web/src/pages/ReadPage.tsx`

- [ ] **Step 1: Compute and show the indicator under the page number**

In `web/src/pages/ReadPage.tsx`, add imports after the `JumpPicker` import:

```tsx
import { useSurahs, useJuzList } from '../quran/useQuranMeta';
import { ayahsLeftInJuz, juzOf } from '../quran/quranIndex';
```

Inside `ReadPageInner`, after `const [firstSurahAyah, setFirstSurahAyah] = useState<{ surah: number; ayah: number } | null>(null);`, add:

```tsx
  const { data: surahs } = useSurahs();
  const { data: juz } = useJuzList();
  const juzInfo =
    surahs && juz && firstSurahAyah
      ? { n: juzOf(surahs, juz, firstSurahAyah.surah, firstSurahAyah.ayah), left: ayahsLeftInJuz(surahs, juz, firstSurahAyah.surah, firstSurahAyah.ayah) }
      : undefined;
```

Replace the page-number block:

```tsx
          <div className="text-center leading-none">
            <div className="font-display text-lg">Page {n}</div>
            <div className="text-[11px] text-muted mt-0.5">of 604</div>
          </div>
```

with one that adds the juz line:

```tsx
          <div className="text-center leading-none">
            <div className="font-display text-lg">Page {n}</div>
            <div className="text-[11px] text-muted mt-0.5">
              {juzInfo ? `${juzInfo.left} left in Juz ${juzInfo.n}` : 'of 604'}
            </div>
          </div>
```

- [ ] **Step 2: Type-check and verify**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

In the browser on a read page, the header subtitle shows e.g. `18 left in Juz 1`, and it decreases as you page forward through the juz.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/ReadPage.tsx
git commit -m "feat(web): show ayahs-left-in-juz in the reading toolbar"
```

---

## Final verification

- [ ] **Run all unit tests**

Run: `npx vitest run scripts/test/derive-meta.test.mjs && cd web && npx vitest run`
Expected: all pass.

- [ ] **Type-check the web app**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Manual smoke test** (dev server running, logged in)

  - `/browse` lists 114 surahs and 30 juz; tapping a row opens the right page.
  - In-reader "Jump" navigates by surah and by juz.
  - Dashboard continue button reads `Continue · <Surah> s:a`; card shows ayahs left in the juz.
  - Reader header shows `N left in Juz J`, decreasing as you advance.

---

## Self-review notes (addressed)

- **Spec coverage:** Browse page ✓ (Task 5), jump picker ✓ (Task 6), resume surah+ayah ✓ (Task 7), ayahs-left-in-juz on continue card ✓ (Task 7) and reader ✓ (Task 8), static `surahs.json`/`juz.json` ✓ (Tasks 1–2). Per-juz/surah coverage rings, khatm %, ayah view, and flexible goals are intentionally out of scope (separate slices).
- **Reader placement:** the "ayahs left" indicator lives in the reading toolbar header (which already has the current page's first ayah) rather than inside `ReadingStatsBar` (today's totals) — same information, cleaner data flow.
- **Type consistency:** `Surah`/`Juz` shapes are defined once in `quranIndex.ts` and reused by `useQuranMeta.ts`, `BrowsePage`, `JumpPicker`, and the dashboard/reader. Helper names (`globalAyahIndex`, `juzOf`, `ayahsLeftInJuz`, `pageForSurah`, `pageForJuz`) match across tasks.
