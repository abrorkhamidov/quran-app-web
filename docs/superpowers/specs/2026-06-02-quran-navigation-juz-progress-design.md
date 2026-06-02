# Qur'an navigation, juz progress, coverage, ayah view & flexible goals — Design

**Date:** 2026-06-02
**Status:** Approved (pending spec review)

## 1. Summary

Today the app reads the Qur'an page-by-page (`/read/page/:n`, pages 1–604) with a page-faithful Mushaf/Tajwid rendering. There is no way to browse or jump by surah or juz, no sense of progress through a juz or the whole Qur'an, and "continue reading" only resumes a page number.

This feature adds, in one spec but built in dependency order:

1. **Navigation + juz progress** — browse by surah & juz, quick jump, resume by surah+ayah, and a positional "ayahs left to finish the juz" nudge.
2. **Coverage → progress + khatm** — track which pages have ever been read; show per-juz / per-surah progress and an overall khatm (completion) percentage.
3. **Ayah-by-ayah reading mode** — a third reading style showing the current page's ayahs as a list with Saheeh International translation.
4. **Flexible goals** — daily goal by minutes *or* ayahs, plus an optional "focus target" to finish a chosen juz/surah.

### Design decisions locked during brainstorming
- Reference data (surah/juz metadata) ships as **static JSON in `web/public/quran/`**, matching the existing page-data pattern.
- Ayah-view translation is **Saheeh International (English)** — quran.com translation resource id `20`.
- Ayah-by-ayah view is **page-aligned** (renders the current page's ayahs; keeps page nav, tracking, bookmark, juz-left intact) — not continuous scroll.
- "Finish juz/surah" is a **separate focus target with a coverage bar**, not the daily streak driver.

## 2. Existing state (grounding facts)

- `AyahRef { surah, ayah, page, juz, letterCount }` — composite id `(surah, ayah)`, index on `page`. 6,236 rows. **Juz is already present (1–30).**
- Page JSON (`web/public/quran/pages/{n}.json`) stores QCF **glyph codes only** — not readable Arabic text or translation. The ayah view therefore needs a **new text+translation dataset**.
- `Bookmark { userId, surah, ayah, page }` — already stores surah & ayah, so resume-by-surah+ayah is nearly free.
- Progress is **count-only**: `DailyProgress { secondsRead, versesRead, pagesRead, hasanat, goalMet }` and `ReadingSession { durationSeconds, versesCount, pagesCount, startSurah/Ayah, endSurah/Ayah }`. **No record of which pages/ayahs were read** → coverage needs a new model.
- Reading tracker (`web/src/reading/useReadingTracker.ts`) posts `{ date, durationSeconds, pages: number[] }` to `POST /reading-sessions`; `sessions.service.record()` already receives the explicit `pages[]`.
- Goals are time-based: `UserSettings.goalLevel (egg|steady|beast)` → `goalTargetSeconds`; `goalMet` when `secondsRead ≥ target`; streak increments on first `goalMet` of the day.
- Reading style: `UserSettings.readingStyle (mushaf | tajweed)`.
- Data build: `scripts/build-quran-data.mjs` pulls from quran.com API v4 and writes static JSON + `scripts/generated/ayah-ref.json` (seeded into `AyahRef` by `api/prisma/seed.ts`).

## 3. Data foundation (generated static JSON)

Extend `scripts/build-quran-data.mjs` to additionally emit, under `web/public/quran/`:

### `surahs.json` — 114 entries
```json
{ "id": 2, "name": "Al-Baqarah", "arabicName": "البقرة",
  "ayahCount": 286, "startPage": 2, "revelation": "medinan" }
```
Source: quran.com `/chapters`. `startPage` from `pages.[0]` / first ayah's page.

### `juz.json` — 30 entries
```json
{ "juz": 1, "startSurah": 1, "startAyah": 1, "startPage": 1, "ayahCount": 148 }
```
Source: quran.com `/juzs` (`verse_mapping`). End of juz *N* is derived as (start of juz *N+1*) − 1; juz 30 ends at 114:6. `ayahCount` precomputed.

### `ayahs/{surah}.json` — per-surah ayah text + translation
```json
[ { "surah": 2, "ayah": 1, "page": 2, "juz": 1,
    "text": "الٓمٓ", "translation": "Alif, Lam, Meem." }, ... ]
```
Source: quran.com `/quran/verses/uthmani` + `/quran/translations/20` (Saheeh International). Per-surah files so the ayah view fetches one surah at a time. Loaded lazily; only when ayah mode is active.

### Client helpers (`web/src/quran/quranMeta.ts`)
A small module that loads `surahs.json` + `juz.json` (react-query, `staleTime: Infinity`) and exposes:
- `surahName(id)`, `surahList()`, `juzList()`
- `globalAyahIndex(surah, ayah)` — prefix-sum over `ayahCount`
- `juzOf(surah, ayah)` and `ayahsLeftInJuz(surah, ayah)` = `juzEndIndex − globalAyahIndex(surah, ayah) + 1`
- `pageForSurah(id)`, `pageForJuz(n)`

## 4. Slice 1 — Navigation + juz progress

Frontend + static data only. **No new API.**

### 4.1 Browse page
- Route `/browse`; new left-nav item ("Browse") in `web/src/layout/` nav.
- New `web/src/pages/BrowsePage.tsx` with **Surah | Juz** tabs.
  - Surah tab: 114 rows — number, English name, Arabic name, ayah count, Meccan/Medinan chip.
  - Juz tab: 30 rows — "Juz N", starting surah:ayah, ayah count.
- Row tap → `navigate('/read/page/' + startPage)`.
- (Per-juz/surah progress rings are added in Slice 2; Browse rows are designed with a trailing slot for them.)

### 4.2 Quick jump picker
- `web/src/quran/JumpPicker.tsx` — a button in the `ReadPage` toolbar opening a bottom-sheet/popover with a Surah select and a Juz select + "Go". Resolves to `startPage` and navigates. Reuses `quranMeta`.

### 4.3 Resume by surah + ayah
- `useBookmark` already returns `{ surah, ayah, page }`. Update the dashboard continue card (`DashboardPage.tsx`) and `StreakHero` to label `Continue · {surahName(surah)} {surah}:{ayah}` instead of `page {n}`.

### 4.4 "Ayahs left to finish the juz" (positional)
- Computed client-side via `ayahsLeftInJuz(surah, ayah)`.
- Shown on: the dashboard continue card (`"{k} ayahs left in Juz {j}"` + thin bar `read/total of juz position`), and the reading stats bar (`ReadingStatsBar.tsx`) using the current page's first ayah.
- Positional meaning: from the current position to the end of the current juz (assumes forward reading). Distinct from coverage (Slice 2).

## 5. Slice 2 — Coverage → per-juz/surah progress + khatm %

### 5.1 Model
```prisma
model PageRead {
  userId      String
  page        Int       // 1..604
  firstReadAt DateTime  @default(now())
  @@id([userId, page])
  @@index([userId])
}
```
At most 604 rows/user. Populated in `sessions.service.record()`: for each page in `pages[]`, `upsert` a `PageRead` (no-op on conflict). No backfill (no historical page sets exist); coverage accrues from first read after launch.

### 5.2 Derivation (`GET /quran/coverage`)
New `quran` API module returning, for the user:
- `overall`: `{ pagesRead, totalPages: 604, percent }` (khatm by pages).
- `juz[]`: for each juz `{ juz, ayahsRead, ayahCount, percent }` where `ayahsRead = COUNT(AyahRef where juz=J and page ∈ readPages)`.
- `surah[]`: same shape per surah.

Implemented with a single `AyahRef` ⋈ `PageRead` query grouped by juz and by surah. Cached client-side (react-query) and invalidated after a session flush.

### 5.3 UI
- Progress rings/bars on Browse rows (Surah & Juz tabs).
- Khatm bar on the dashboard and the Stats page: "Qur'an {percent}% · {pagesRead}/604 pages".

## 6. Slice 3 — Ayah-by-ayah reading mode

- Extend `readingStyle` to `mushaf | tajweed | ayah` (settings + the Settings UI toggle, currently 2-up → 3-up).
- In `ReadPage`/`MushafPage`, when style = `ayah`, render `web/src/quran/AyahList.tsx` instead of the glyph page:
  - Determine the ayahs on the current page from the existing page JSON (`words[].surah/ayah` → distinct ordered ayah keys).
  - For each ayah, pull `text` + `translation` from `ayahs/{surah}.json` (lazy-loaded, react-query).
  - Render: ayah ref badge (`2:2`), Uthmani Arabic, translation beneath. Tap → favorite / play audio via existing `AudioContext.playFrom`.
- **Page-aligned**: prev/next page nav, bookmark, time tracking, and juz-left all unchanged.
- A surah's bismillah/heading shown when the page starts a new surah (reuse page JSON surah transitions).

## 7. Slice 4 — Flexible goals

### 7.1 Daily goal type
- Add `goalType: 'time' | 'ayahs'` and `goalTargetAyahs Int?` to `UserSettings`.
- `time` (existing): `goalMet` when `secondsRead ≥ goalTargetSeconds`.
- `ayahs`: `goalMet` when `DailyProgress.versesRead ≥ goalTargetAyahs`.
- Streak logic keys off `goalMet` either way (unchanged). Onboarding/Settings gain a goal-type choice; minimum 1 ayah/day (matches Quranly).

### 7.2 Focus target (finish a juz/surah)
- Add to `UserSettings`: `focusType: 'none' | 'juz' | 'surah'`, `focusId Int?`.
- The dashboard shows a "Focus" card: "Finish {Juz N | SurahName}" with a coverage bar from Slice 2 (`percent`, `ayahs left`). Settable from Browse ("Set as focus") or Settings.
- Explicitly **not** part of the streak/daily mechanic — it's a long-term nudge.

## 8. Files to add / change

**Add**
- `web/public/quran/surahs.json`, `juz.json`, `ayahs/{1..114}.json` (generated)
- `web/src/quran/quranMeta.ts` (loader + helpers)
- `web/src/pages/BrowsePage.tsx`
- `web/src/quran/JumpPicker.tsx`
- `web/src/quran/AyahList.tsx`
- `web/src/quran/useCoverage.ts` (react-query for `/quran/coverage`)
- `api/src/quran/` module (controller + service: `GET /quran/coverage`)
- Prisma model `PageRead`

**Change**
- `scripts/build-quran-data.mjs` — emit the 3 new artifacts
- `api/prisma/schema.prisma` — `PageRead`; `UserSettings` (+`goalType`, `goalTargetAyahs`, `focusType`, `focusId`); `readingStyle` enum/string accepts `ayah`
- `api/src/sessions/sessions.service.ts` — upsert `PageRead` from `pages[]`; honor `goalType: 'ayahs'` in `goalMet`
- `api/src/settings/*` — new fields in DTO/service
- `web/src/App.tsx` — `/browse` route
- `web/src/layout/*` — nav item
- `web/src/pages/ReadPage.tsx` / `web/src/quran/MushafPage.tsx` — jump picker + ayah mode branch + juz-left in stats bar
- `web/src/pages/DashboardPage.tsx`, `web/src/dashboard/StreakHero.tsx` — resume label, juz-left, khatm bar, focus card
- `web/src/pages/SettingsPage.tsx` — 3-up reading style, goal type, focus target
- `web/src/pages/StatsPage.tsx` — khatm bar

## 9. Build order

1. **Data foundation** (§3) — prerequisite for everything.
2. **Slice 1** (§4) — navigation + positional juz-left; pure frontend + static data.
3. **Slice 2** (§5) — coverage model + `/quran/coverage` + rings + khatm.
4. **Slice 3** (§6) — ayah mode (needs `ayahs/*.json`).
5. **Slice 4** (§7) — goal type + focus target (focus bar uses Slice 2).

Each step ships independently; 1–3 (data) and Slice 1 deliver value without the DB changes.

## 10. Testing

- **Build script**: unit-test juz-end derivation and that `Σ surah.ayahCount = 6236`, `Σ juz.ayahCount = 6236`, every surah's `startPage` ∈ [1,604]. (`scripts/test/` already uses vitest.)
- **quranMeta helpers**: `ayahsLeftInJuz` at juz boundaries (first ayah of juz = full count; last ayah = 1); `globalAyahIndex(114,6) = 6236`; `juzOf` matches `AyahRef`.
- **Coverage**: seed `PageRead` for known pages; assert per-juz/surah counts equal direct `AyahRef` counts; khatm percent math.
- **Goals**: `goalType: 'ayahs'` sets `goalMet` correctly and drives the streak; `time` unchanged.
- **API**: `GET /quran/coverage` shape + auth.

## 11. Risks / open considerations

- **Translation licensing**: Saheeh International via quran.com is fine for personal use; revisit if the app is distributed.
- **Coverage is page-grained**: a partially-read page counts its whole page's ayahs toward juz/surah coverage. Acceptable given tracking is page-based; ayah-level coverage is intentionally out of scope.
- **`ayahs/*.json` size**: ~6,236 ayahs of text+translation, split per surah and lazy-loaded — modest; only fetched in ayah mode.
- **Positional vs coverage juz numbers** are two different figures shown in different places (continue card / reader = positional "ayahs left to end of juz"; Browse = coverage "% of juz read"). Keep labels distinct to avoid confusion.
- **Focus target semantics**: deliberately decoupled from streaks to keep daily goals sane.
