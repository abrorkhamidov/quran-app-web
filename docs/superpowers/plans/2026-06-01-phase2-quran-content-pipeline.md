# Phase 2: Quran Content Pipeline + First Mushaf Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible data pipeline that produces page-faithful QCF v2 Mushaf data (per-page word/line/glyph JSON + the 604 page fonts + a seeded `ayah_ref` table with letter counts), and render the first Mushaf pages faithfully in the React app.

**Architecture:** A one-time Node build script fetches per-page word data from the public Quran Foundation v4 content API and writes static `web/public/quran/pages/{n}.json` files plus a `letter-counts` dataset; the QCF v2 glyph fonts are vendored into `web/public/fonts/qcf2/`. A Prisma `AyahRef` model is seeded (surah, ayah, page, juz, letter_count) for later server-side Hasanat validation. A `MushafPage` React component renders a page by registering that page's `@font-face` and laying out words line-by-line using the glyph codes. Reading content stays static (no per-page API round-trip at runtime); only `ayah_ref` lives in Postgres.

**Tech Stack:** Node 18+ (build script, native `fetch`), QCF v2 fonts (`nuqayah/qpc-fonts`), Quran Foundation v4 API (`https://api.quran.com/api/v4`), Prisma 7, React + Vite + Tailwind, Vitest, Playwright (visual verification).

**Builds on:** Phase 1 (monorepo `api/` + `web/`, Prisma, Quiet Slate theme). Branch off the Phase 1 result.

---

## Data Sources (verified, real)

- **Fonts (QCF v2, 604 page fonts):** GitHub `nuqayah/qpc-fonts`, directory `mushaf-v2/` (files `QCF2001.ttf`…`QCF2604.ttf`, plus `surah-names/`). We convert TTF→WOFF2 if WOFF2 isn't already provided.
- **Per-page words + layout:** Quran Foundation v4 API, public, no auth:
  `GET https://api.quran.com/api/v4/verses/by_page/{page}?per_page=300&words=true&word_fields=code_v2,line_number,page_number,char_type_name,text_uthmani&fields=text_uthmani`
  Each verse has `verse_key` ("2:255"), `page_number`, `juz_number`, and `words[]`; each word has `code_v2` (the glyph character rendered by that page's font), `line_number`, `char_type_name` (`"word"` or `"end"`), and `text_uthmani`.
- **Letter counts (Hasanat):** computed locally from each word's `text_uthmani`, counting Arabic base letters only (see Task 4 — exact Unicode ranges specified).

> The exact JSON shape is verified in Task 1 (a discovery spike) before any code depends on it.

---

## File Structure

```
quran-app/
├── scripts/
│   ├── build-quran-data.mjs     # fetch API → write page JSON + ayah-ref.json
│   ├── fetch-fonts.mjs          # download + (if needed) convert QCF v2 fonts
│   └── lib/
│       └── letter-count.mjs     # countArabicLetters() — pure, unit-tested
├── scripts/test/
│   └── letter-count.test.mjs    # vitest unit tests for letter counting
├── web/public/
│   ├── quran/
│   │   ├── pages/{1..604}.json  # generated: lines[] → words[]
│   │   └── meta.json            # generated: page count, build date, source
│   └── fonts/qcf2/
│       ├── p{1..604}.woff2      # generated/vendored page fonts
│       └── qcf2.css             # generated: 604 @font-face rules
├── web/src/quran/
│   ├── types.ts                 # MushafPageData, MushafLine, MushafWord
│   ├── usePageData.ts           # fetch + cache a page JSON (TanStack Query)
│   ├── pageFont.ts              # ensure a page's @font-face is loaded
│   ├── MushafWord.tsx           # one glyph word
│   ├── MushafLine.tsx           # one centered line
│   └── MushafPage.tsx           # full page (15 lines)
├── web/src/pages/
│   └── ReadPage.tsx             # route /read/page/:page → MushafPage
└── api/
    ├── prisma/schema.prisma     # + AyahRef model
    └── prisma/seed.ts           # seed AyahRef from generated ayah-ref.json
```

---

## Task 1: Discovery spike — verify API + font shapes

**Files:** none committed (investigation only; record findings in the task report)

- [ ] **Step 1: Verify the API response shape for page 1 and a mid-Mushaf page**

Run:
```bash
curl -s "https://api.quran.com/api/v4/verses/by_page/1?per_page=300&words=true&word_fields=code_v2,line_number,page_number,char_type_name,text_uthmani&fields=text_uthmani" | head -c 2000
echo
curl -s "https://api.quran.com/api/v4/verses/by_page/2?per_page=300&words=true&word_fields=code_v2,line_number,page_number,char_type_name,text_uthmani&fields=text_uthmani" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d['verses'][0]; print('verse_key',v['verse_key']); print('page',v['page_number'],'juz',v['juz_number']); print('word0',{k:v['words'][0].get(k) for k in ['code_v2','line_number','char_type_name','text_uthmani']})"
```
Expected: JSON with `verses[]`, each having `verse_key`, `page_number`, `juz_number`, and `words[]` with `code_v2`, `line_number`, `char_type_name`, `text_uthmani`. Confirm `char_type_name` includes both `"word"` and `"end"` (ayah-number marker).

- [ ] **Step 2: Confirm line counts**

Run:
```bash
curl -s "https://api.quran.com/api/v4/verses/by_page/3?per_page=300&words=true&word_fields=line_number" | python3 -c "import sys,json; d=json.load(sys.stdin); lines={w['line_number'] for v in d['verses'] for w in v['words']}; print('max line', max(lines), 'count', len(lines))"
```
Expected: max line ≤ 15 (page-faithful 15-line layout).

- [ ] **Step 3: Verify the font repo + file naming**

Run:
```bash
curl -s "https://api.github.com/repos/nuqayah/qpc-fonts/contents/mushaf-v2" | python3 -c "import sys,json; d=json.load(sys.stdin); names=[x['name'] for x in d]; print('count', len(names)); print('first', sorted(names)[:3]); print('woff2?', any(n.endswith('.woff2') for n in names), 'ttf?', any(n.endswith('.ttf') for n in names))"
```
Expected: ~604 font files; record whether they are `.ttf` and/or `.woff2`, and the exact filename pattern (e.g. `QCF2001.ttf`). This determines whether Task 5 needs TTF→WOFF2 conversion.

- [ ] **Step 4: Report findings**

Record in the task report: exact API field names confirmed, max line number, the font filename pattern, and whether WOFF2 is available or conversion is needed. **Do not write code in this task** — these findings parameterize Tasks 2–5. If any field name differs from this plan, report it so the controller can adjust.

---

## Task 2: Letter-count utility (TDD)

**Files:**
- Create: `scripts/lib/letter-count.mjs`, `scripts/test/letter-count.test.mjs`
- Modify: root `package.json` (add a vitest dev dep + test script) — create a minimal root `package.json` if none exists.

- [ ] **Step 1: Add a root package.json with vitest (if not present)**

Create (or extend) repo-root `package.json`:
```json
{
  "name": "quran-app-scripts",
  "private": true,
  "type": "module",
  "scripts": {
    "test:scripts": "vitest run scripts/test"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```
Run: `npm install` (repo root).

- [ ] **Step 2: Write the failing test**

Create `scripts/test/letter-count.test.mjs`:
```js
import { describe, it, expect } from 'vitest';
import { countArabicLetters } from '../lib/letter-count.mjs';

describe('countArabicLetters', () => {
  it('counts base Arabic letters, ignoring diacritics and spaces', () => {
    // بِسْمِ = ب س م  => 3 base letters (kasra, sukun ignored)
    expect(countArabicLetters('بِسْمِ')).toBe(3);
  });

  it('ignores spaces between words', () => {
    expect(countArabicLetters('اللَّهِ الرَّحْمَٰنِ')).toBe(countArabicLetters('اللَّه') + countArabicLetters('الرَّحمن'));
  });

  it('returns 0 for empty or non-Arabic input', () => {
    expect(countArabicLetters('')).toBe(0);
    expect(countArabicLetters('123 abc')).toBe(0);
  });

  it('counts alif, lam, lam, he in the word Allah (الله) as 4', () => {
    expect(countArabicLetters('اللّٰه')).toBe(4);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npm run test:scripts`
Expected: FAIL — cannot import `countArabicLetters`.

- [ ] **Step 4: Implement the utility**

Create `scripts/lib/letter-count.mjs`:
```js
// Counts Arabic *base* letters (the rasm), excluding harakat/tanwin/sukun,
// tatweel, spaces, punctuation and Quranic annotation marks.
// Base-letter ranges: U+0621–U+063A and U+0641–U+064A (hamza..ya),
// plus U+0671 (alif wasla) and U+0670 (superscript alif) is a diacritic → excluded.
const BASE_LETTER = /[ء-غف-يٱ]/g;

export function countArabicLetters(text) {
  if (!text) return 0;
  const m = text.match(BASE_LETTER);
  return m ? m.length : 0;
}
```

- [ ] **Step 5: Run it to confirm it passes**

Run: `npm run test:scripts`
Expected: PASS (4 tests). If the "Allah" case disagrees because of the specific alif form used by `text_uthmani`, adjust the test's expected string to match the dataset's actual characters (note the adjustment in the commit message) — the rule (count base consonants, skip diacritics) is what matters.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/lib/letter-count.mjs scripts/test/letter-count.test.mjs
git commit -m "feat(data): add Arabic letter-count utility with tests"
```

---

## Task 3: Page-data build script

**Files:**
- Create: `scripts/build-quran-data.mjs`

- [ ] **Step 1: Write the build script**

Create `scripts/build-quran-data.mjs`:
```js
// Fetches per-page word data from the Quran Foundation v4 API and writes
// static page JSON + an ayah-ref dataset. Run: `node scripts/build-quran-data.mjs`
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
  return (await res.json()).verses;
}

// Group a page's words into lines [{ line, words: [{glyph,type,surah,ayah}] }]
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
      lineMap.get(ln).push({
        glyph: w.code_v2,
        type: w.char_type_name, // 'word' | 'end'
        surah,
        ayah,
      });
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
```

- [ ] **Step 2: Run a limited smoke test (pages 1–3 only)**

Temporarily run a 3-page check without committing data:
```bash
node -e "import('./scripts/build-quran-data.mjs')" 2>/dev/null || true
node --input-type=module -e "
import { countArabicLetters } from './scripts/lib/letter-count.mjs';
const r = await fetch('https://api.quran.com/api/v4/verses/by_page/1?per_page=300&words=true&word_fields=code_v2,line_number,page_number,char_type_name,text_uthmani&fields=text_uthmani');
const { verses } = await r.json();
const lines = new Set(verses.flatMap(v=>v.words.map(w=>w.line_number)));
console.log('page1 verses', verses.length, 'lines', [...lines].sort((a,b)=>a-b).join(','));
console.log('first word glyph length', verses[0].words[0].code_v2.length);
"
```
Expected: page 1 has the 7 verses of Al-Fatihah, lines present (≤15), and a non-empty `code_v2` glyph string.

- [ ] **Step 3: Run the full build**

Run: `node scripts/build-quran-data.mjs`
Expected: console ends with `done: 604 pages, 6236 ayah-ref rows` (6236 = total ayahs). Files appear under `web/public/quran/pages/` and `scripts/generated/ayah-ref.json`.

- [ ] **Step 4: Verify output integrity**

Run:
```bash
ls web/public/quran/pages | wc -l   # expect 604
node --input-type=module -e "
import fs from 'node:fs';
const ref = JSON.parse(fs.readFileSync('scripts/generated/ayah-ref.json'));
console.log('ayahs', ref.length, 'fatiha letters sum', ref.filter(r=>r.surah===1).reduce((a,b)=>a+b.letterCount,0));
const p1 = JSON.parse(fs.readFileSync('web/public/quran/pages/1.json'));
console.log('page1 lines', p1.lines.length);
"
```
Expected: 604 page files, 6236 ayahs, Al-Fatihah letter sum > 0, page 1 has multiple lines.

- [ ] **Step 5: Decide what to commit (large data)**

The 604 page JSON files are generated data. Commit them so the app runs without re-fetching (they total a few MB of small JSON). Add `scripts/generated/` to git too (it feeds the seed). Do NOT gitignore `web/public/quran/`.

```bash
git add scripts/build-quran-data.mjs web/public/quran scripts/generated/ayah-ref.json
git commit -m "feat(data): build script + generated QCF v2 page JSON and ayah-ref"
```

---

## Task 4: AyahRef model + Prisma seed

**Files:**
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/seed.ts`
- Modify: `api/package.json` (prisma seed config + dev deps if needed)

- [ ] **Step 1: Add the AyahRef model**

Append to `api/prisma/schema.prisma`:
```prisma
model AyahRef {
  surah       Int
  ayah        Int
  page        Int
  juz         Int
  letterCount Int

  @@id([surah, ayah])
  @@index([page])
}
```

- [ ] **Step 2: Create the migration**

Run: `cd api && npx prisma migrate dev --name add_ayah_ref`
Expected: `AyahRef` table created.

- [ ] **Step 3: Write the seed script**

Create `api/prisma/seed.ts`:
```ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Ref = { surah: number; ayah: number; page: number; juz: number; letterCount: number };

async function main() {
  const path = resolve(__dirname, '../../scripts/generated/ayah-ref.json');
  const rows: Ref[] = JSON.parse(readFileSync(path, 'utf8'));
  await prisma.ayahRef.deleteMany();
  // chunk to keep the statement size reasonable
  for (let i = 0; i < rows.length; i += 500) {
    await prisma.ayahRef.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
  }
  console.log(`seeded ${rows.length} ayah-ref rows`);
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Wire the seed command**

Add to `api/package.json`:
```json
"prisma": { "seed": "ts-node prisma/seed.ts" }
```
(Top-level key, sibling of `"scripts"`. `ts-node` is already a dev dependency from Phase 1.)

- [ ] **Step 5: Run the seed and verify**

Run: `cd api && npx prisma db seed`
Then verify:
```bash
docker compose exec -T db psql -U quran -d quran -c 'select count(*) from "AyahRef"; select "letterCount" from "AyahRef" where surah=1 and ayah=1;'
```
Expected: count = 6236; ayah 1:1 has a positive letter count.

- [ ] **Step 6: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations api/prisma/seed.ts api/package.json
git commit -m "feat(api): add AyahRef model and seed from generated data"
```

---

## Task 5: Vendor QCF v2 fonts + generate @font-face CSS

**Files:**
- Create: `scripts/fetch-fonts.mjs`, `web/public/fonts/qcf2/*` (generated), `web/public/fonts/qcf2/qcf2.css` (generated)

> Use the font filename pattern confirmed in Task 1. The script below assumes the repo serves `mushaf-v2/QCF2{NNN}.ttf` (zero-padded 3 digits) and converts to WOFF2. If Task 1 found WOFF2 already present, skip conversion and download those directly.

- [ ] **Step 1: Ensure a TTF→WOFF2 converter is available**

Run: `python3 -c "import fontTools" 2>/dev/null || pip3 install fonttools brotli`
Expected: `fonttools` importable (provides `fonttools ttLib.woff2`).

- [ ] **Step 2: Write the font fetch/convert script**

Create `scripts/fetch-fonts.mjs`:
```js
// Downloads QCF v2 page fonts from nuqayah/qpc-fonts and emits web/public/fonts/qcf2/p{n}.woff2
// plus qcf2.css with one @font-face per page. Run: node scripts/fetch-fonts.mjs
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'web/public/fonts/qcf2');
const RAW = 'https://raw.githubusercontent.com/nuqayah/qpc-fonts/master/mushaf-v2';
const TOTAL = 604;

const pad = (n) => String(n).padStart(3, '0');

async function main() {
  await mkdir(OUT, { recursive: true });
  const faces = [];
  for (let p = 1; p <= TOTAL; p++) {
    const ttfUrl = `${RAW}/QCF2${pad(p)}.ttf`;
    const res = await fetch(ttfUrl);
    if (!res.ok) throw new Error(`font ${p}: HTTP ${res.status} (${ttfUrl})`);
    const ttfPath = resolve(OUT, `p${p}.ttf`);
    await writeFile(ttfPath, Buffer.from(await res.arrayBuffer()));
    // convert ttf -> woff2 in place (produces p{p}.woff2)
    await run('fonttools', ['ttLib.woff2', 'compress', ttfPath]);
    await rm(ttfPath);
    faces.push(`@font-face{font-family:'QCF2P${p}';src:url('./p${p}.woff2') format('woff2');font-display:swap;}`);
    if (p % 50 === 0) console.log(`...font ${p}/${TOTAL}`);
  }
  await writeFile(resolve(OUT, 'qcf2.css'), faces.join('\n'));
  console.log(`done: ${TOTAL} fonts + qcf2.css`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Smoke test one font (page 1) before the full run**

Run:
```bash
curl -sI "https://raw.githubusercontent.com/nuqayah/qpc-fonts/master/mushaf-v2/QCF2001.ttf" | head -1
```
Expected: `HTTP/2 200`. If 404, adjust `RAW` base path / filename pattern per Task 1 findings before the full run.

- [ ] **Step 4: Run the full font build**

Run: `node scripts/fetch-fonts.mjs`
Expected: `done: 604 fonts + qcf2.css`; `web/public/fonts/qcf2/` holds 604 `.woff2` + `qcf2.css`, no leftover `.ttf`.

- [ ] **Step 5: Verify**

Run: `ls web/public/fonts/qcf2/*.woff2 | wc -l` (expect 604) and `head -1 web/public/fonts/qcf2/qcf2.css` (expect a `@font-face` for `QCF2P1`).

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-fonts.mjs web/public/fonts/qcf2
git commit -m "feat(data): vendor QCF v2 page fonts and generate @font-face CSS"
```

---

## Task 6: Mushaf types + page data hook

**Files:**
- Create: `web/src/quran/types.ts`, `web/src/quran/usePageData.ts`, `web/src/quran/pageFont.ts`

- [ ] **Step 1: Define types**

Create `web/src/quran/types.ts`:
```ts
export type MushafWord = {
  glyph: string;            // code_v2 glyph rendered by the page font
  type: 'word' | 'end';     // 'end' = ayah-number marker
  surah: number;
  ayah: number;
};
export type MushafLine = { line: number; words: MushafWord[] };
export type MushafPageData = { page: number; lines: MushafLine[] };
```

- [ ] **Step 2: Page-font loader**

Create `web/src/quran/pageFont.ts`:
```ts
// Ensures the global qcf2.css (all @font-face rules) is loaded once.
let injected = false;
export function ensureQcf2Css() {
  if (injected) return;
  injected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/fonts/qcf2/qcf2.css';
  document.head.appendChild(link);
}

export function pageFontFamily(page: number): string {
  return `QCF2P${page}`;
}
```

- [ ] **Step 3: Page data hook (TanStack Query)**

Create `web/src/quran/usePageData.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import type { MushafPageData } from './types';

async function fetchPage(page: number): Promise<MushafPageData> {
  const res = await fetch(`/quran/pages/${page}.json`);
  if (!res.ok) throw new Error(`page ${page}: ${res.status}`);
  return res.json();
}

export function usePageData(page: number) {
  return useQuery({
    queryKey: ['quran-page', page],
    queryFn: () => fetchPage(page),
    staleTime: Infinity,
  });
}
```

- [ ] **Step 4: Verify it type-checks**

Run: `cd web && npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/quran/types.ts web/src/quran/pageFont.ts web/src/quran/usePageData.ts
git commit -m "feat(web): add Mushaf types, page-font loader, and page-data hook"
```

---

## Task 7: Mushaf rendering components

**Files:**
- Create: `web/src/quran/MushafWord.tsx`, `web/src/quran/MushafLine.tsx`, `web/src/quran/MushafPage.tsx`

- [ ] **Step 1: MushafWord**

Create `web/src/quran/MushafWord.tsx`:
```tsx
import type { MushafWord as Word } from './types';

export function MushafWord({ word }: { word: Word }) {
  return (
    <span
      className={word.type === 'end' ? 'text-muted' : ''}
      data-surah={word.surah}
      data-ayah={word.ayah}
    >
      {word.glyph}
    </span>
  );
}
```

- [ ] **Step 2: MushafLine — one centered line**

Create `web/src/quran/MushafLine.tsx`:
```tsx
import type { MushafLine as Line } from './types';
import { MushafWord } from './MushafWord';

export function MushafLine({ line }: { line: Line }) {
  return (
    <div className="flex justify-center items-center gap-1 leading-[2.6] whitespace-nowrap" dir="rtl">
      {line.words.map((w, i) => (
        <MushafWord key={i} word={w} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: MushafPage — full page**

Create `web/src/quran/MushafPage.tsx`:
```tsx
import { useEffect } from 'react';
import { usePageData } from './usePageData';
import { ensureQcf2Css, pageFontFamily } from './pageFont';
import { MushafLine } from './MushafLine';

export function MushafPage({ page }: { page: number }) {
  const { data, isLoading, isError } = usePageData(page);
  useEffect(() => { ensureQcf2Css(); }, []);

  if (isLoading) return <div className="p-8 text-muted">Loading page {page}…</div>;
  if (isError || !data) return <div className="p-8 text-red-500">Could not load page {page}.</div>;

  return (
    <div
      className="mx-auto max-w-2xl px-4 py-6 text-[28px] text-ink dark:text-ink-dark"
      style={{ fontFamily: pageFontFamily(page) }}
    >
      {data.lines.map((line) => (
        <MushafLine key={line.line} line={line} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify type-check**

Run: `cd web && npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/quran/MushafWord.tsx web/src/quran/MushafLine.tsx web/src/quran/MushafPage.tsx
git commit -m "feat(web): add Mushaf page/line/word rendering components"
```

---

## Task 8: Read route + wire into the app

**Files:**
- Create: `web/src/pages/ReadPage.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: ReadPage**

Create `web/src/pages/ReadPage.tsx`:
```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { MushafPage } from '../quran/MushafPage';

export default function ReadPage() {
  const { page } = useParams();
  const navigate = useNavigate();
  const n = Math.min(604, Math.max(1, Number(page) || 1));
  return (
    <div className="min-h-screen">
      <div className="flex justify-between items-center px-4 py-3 text-sm text-muted border-b border-muted/20">
        <button onClick={() => navigate(`/read/page/${n - 1}`)} disabled={n <= 1} className="disabled:opacity-30">‹ Prev</button>
        <span>Page {n} / 604</span>
        <button onClick={() => navigate(`/read/page/${n + 1}`)} disabled={n >= 604} className="disabled:opacity-30">Next ›</button>
      </div>
      <MushafPage page={n} />
    </div>
  );
}
```

- [ ] **Step 2: Add the protected route**

Edit `web/src/App.tsx` — add the import and a route inside `<Routes>` (keep existing routes):
```tsx
import ReadPage from './pages/ReadPage';
```
```tsx
          <Route
            path="/read/page/:page"
            element={
              <ProtectedRoute>
                <ReadPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 3: Add a link from the dashboard placeholder**

Edit `web/src/pages/DashboardPage.tsx` — replace the placeholder paragraph with a link to start reading:
```tsx
import { Link } from 'react-router-dom';
```
Replace `<p className="text-muted">Dashboard coming in Phase 6.</p>` with:
```tsx
        <Link to="/read/page/1" className="inline-block rounded-lg bg-accent text-white px-4 py-2">Start reading</Link>
```

- [ ] **Step 4: Build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/ReadPage.tsx web/src/App.tsx web/src/pages/DashboardPage.tsx
git commit -m "feat(web): add /read/page/:page route rendering the Mushaf"
```

---

## Task 9: Visual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start the stack**

Run (background): `docker compose up -d`; `cd api && npm run start:dev`; `cd web && npm run dev`.

- [ ] **Step 2: Drive the browser to page 1 and screenshot**

Log in (Phase 1 account), navigate to `http://localhost:5173/read/page/1`, and capture a screenshot. Verify visually:
- The Arabic renders as connected QCF glyphs (NOT tofu boxes □ or fallback system Arabic) — confirms the page font loaded.
- Lines are centered, right-to-left, roughly the 15-line page structure for Al-Fatihah/start of Al-Baqarah.
- Ayah-end markers (the decorative number circles) appear and are muted.

- [ ] **Step 3: Check a mid-Mushaf page**

Navigate to `http://localhost:5173/read/page/2` and confirm the start of Al-Baqarah renders with its own page font (each page uses `QCF2P{n}`), no tofu.

- [ ] **Step 4: Compare to the reference**

Open the QUL preview for the same page (`https://qul.tarteel.ai/resources/mushaf-layout/` — the QCF v2 layout) or quran.com page 1, and confirm the line breaks match the printed page. Note any line-break mismatch as a concern (line layout comes straight from the API's `line_number`, so it should match).

- [ ] **Step 5: Report**

Report pass/fail with the screenshot. If glyphs are tofu, the font family name or `@font-face` URL is wrong — fix `pageFont.ts` / `qcf2.css` before declaring done.

---

## Self-Review Notes

- **Spec coverage (§3a, §6 reading view groundwork):** page-faithful QCF v2 rendering (Tasks 5–8), per-page word/line data (Task 3), `ayah_ref` with letter counts seeded for Hasanat (Tasks 2–4), large default Arabic font (Task 7, `text-[28px]`). Audio, bookmarks, favorites, font-size control, light/dark toggle are later phases (3–4) — not in this plan.
- **Deferred:** word-level audio timing (Phase 4), reading-session tracking (Phase 5). `MushafWord` already carries `surah`/`ayah` data attributes so later phases can attach highlight/seek without re-architecting.
- **Type consistency:** the build script (Task 3) emits `{ page, lines: [{ line, words: [{ glyph, type, surah, ayah }] }] }`, exactly matching `MushafPageData`/`MushafLine`/`MushafWord` in Task 6. `ayah-ref.json` fields (`surah, ayah, page, juz, letterCount`) match the `AyahRef` Prisma model and the seed's `Ref` type.
- **Risk:** external API/font availability and exact field/filename shapes — de-risked by the Task 1 discovery spike, which gates the dependent tasks. If field names differ, only Task 3/Task 5 constants change.
```
