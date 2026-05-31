# Quran Habit App — Design Doc

**Date:** 2026-05-31
**Status:** Draft for review

A web app inspired by Quranly: a **habit-building Qur'an reading app**, not just a reader. The
core loop is *open → resume reading → hit your daily goal → keep your streak*, with a satisfying
**Hasanat** counter as the emotional hook. Distinct, calmer visual identity than Quranly.

---

## 1. Scope (v1)

**In scope**

- Email/password accounts (JWT), single-user data sync across devices.
- **Daily goals** as time-based levels (e.g. *Break the Egg* 2 min, *Steady* 10 min, *Beast Mode* 30 min).
- **Habit/streak tracking**: daily streak, weekly tracker (missed days), calendar + progress graph history.
- **Reading dashboard**: live **Hasanat / Verses / Time / Pages** while reading.
- **Reading view**: page-faithful KFGQPC Mushaf (604 pages, 15 lines/page), large default Arabic
  text + `Aa` size control, light/dark, resume bookmark, favorites, no ads.
- **Audio**: 2–3 reciters with verified word-level timing, 0.5–2× speed, **word-by-word highlight**.
- English-only UI.

**Explicitly out of scope for v1** (possible later): social/leaderboard, badges/levels gamification,
reminders/notifications, translations/transliteration/tafsir, search, multi-language UI.

---

## 2. Tech Stack

| Layer | Choice |
|------|--------|
| Frontend | React + Vite + TypeScript, React Router, **TanStack Query** (server state) + **Zustand** (player/session local state), **Tailwind CSS** (Quiet Slate theme) |
| Backend | **NestJS** (TypeScript), REST, **Passport-JWT** (access + refresh tokens), bcrypt/argon2 |
| Database | **PostgreSQL** via **Prisma** ORM |
| Quran content | **KFGQPC / Quran.com (Quranic Universal Library, QUL)** dataset — per-page glyph fonts, word-level layout, word-level audio timing, letter counts |
| Audio | Per-ayah/word recitation files from the Quran.com / EveryAyah CDN |

**Visual identity:** *Quiet Slate* — neutral cool greys, soft indigo accent. Only the accent
(streak number, progress bar, primary button, current-word highlight) is saturated; everything else
stays muted. Light + dark mode.

---

## 3. Architecture

Two distinct data domains:

### 3a. Quran reference content (mostly static)
The Mushaf text, page layout, glyph fonts, letter counts, and audio timing are **fixed reference
data**. Shipped as **static assets** (JSON + per-page fonts) served to the frontend so the Mushaf
renders instantly with no API round-trip per page. A lightweight subset is **seeded into Postgres**
(`ayah_ref`) so the backend can validate stats independently.

- Static (frontend/CDN): `pages/{1..604}.json` (lines → words → glyph codes), per-page WOFF2 fonts,
  `audio-timing/{reciterId}/{surah}.json` (word start/end ms), audio file URLs.
- Seeded (Postgres `ayah_ref`): `(surah, ayah, page, juz, letter_count)`.

**Hasanat rule:** 10 hasanat per Arabic *letter*. Letter count = base Arabic letters only (exclude
harakat/tanwin/sukun diacritics, spaces, and ayah-end markers). Precomputed per word (for live
ticking during audio) and per ayah (for session totals). The backend recomputes `hasanat =
Σ letter_count × 10` from `ayah_ref` when a session is submitted, so totals can't be spoofed.

### 3b. User data (Postgres, dynamic)
Accounts, settings, reading sessions, daily aggregates, streak, bookmark, favorites.

### Reading-session tracking
While reading, the frontend runs a **session tracker**: accumulates elapsed time (pauses when tab
hidden/idle), words & ayahs covered, pages turned, and a live Hasanat tally (from per-word letter
counts). It **flushes to the backend periodically (~every 30s) and on exit/navigation**. The backend
writes a `reading_session`, then rolls the values into `daily_progress`, recomputes the streak, and
updates the resume `bookmark`.

```
[React Mushaf + AudioPlayer] --words/time--> [SessionTracker (Zustand)]
        |  periodic + on-exit flush (POST /reading-sessions)
        v
[NestJS] --validate hasanat via ayah_ref--> [reading_session]
        --upsert--> [daily_progress] --recompute--> [streak] --update--> [bookmark]
        ^
[Dashboard / Stats] <--GET /stats/*, /bookmark--
```

---

## 4. Data Model (Postgres / Prisma)

- **user** — `id, email (unique), password_hash, name, created_at`
- **user_settings** — `user_id, theme, font_scale, preferred_reciter_id, goal_level, goal_target_seconds`
- **reading_session** — `id, user_id, started_at, ended_at, duration_seconds, start_surah, start_ayah, end_surah, end_ayah, verses_count, pages_count, hasanat, created_at`
- **daily_progress** — `user_id, date, seconds_read, verses_read, pages_read, hasanat, goal_met` (PK `user_id+date`) — powers streak, weekly tracker, calendar, graph
- **streak** — `user_id, current_streak, longest_streak, last_active_date` (derived/maintained from `daily_progress`)
- **bookmark** — `user_id, surah, ayah, page, updated_at` — the single "resume" position
- **favorite** — `id, user_id, surah, ayah, created_at` (unique `user_id+surah+ayah`)
- **ayah_ref** *(seed/reference)* — `surah, ayah, page, juz, letter_count`

**Streak logic:** a day counts if `goal_met` (that day's `seconds_read ≥ goal_target_seconds`).
`current_streak` = consecutive goal-met days ending today/yesterday; resets after a missed day.
Recomputed on session submit and on day rollover (user's local date).

---

## 5. REST API (NestJS)

| Method | Path | Purpose |
|-------|------|---------|
| POST | `/auth/register` | create account, return tokens |
| POST | `/auth/login` | login, return access + refresh |
| POST | `/auth/refresh` | rotate access token |
| GET  | `/auth/me` | current user |
| GET / PATCH | `/settings` | read/update theme, font scale, reciter, goal level |
| POST | `/reading-sessions` | submit a (partial/closed) reading session → updates aggregates |
| GET  | `/stats/summary` | lifetime totals + today + current streak |
| GET  | `/stats/calendar?from&to` | `daily_progress` rows for calendar heatmap + graph |
| GET / PUT | `/bookmark` | resume position |
| GET / POST / DELETE | `/favorites` | list / add / remove favorite ayahs |

All except `/auth/*` require a valid JWT.

---

## 6. Frontend Structure

**Routes:** `/login`, `/register`, `/onboarding` (pick goal level), `/` (dashboard),
`/read/page/:page` (Mushaf), `/stats`, `/favorites`, `/settings`.

**Key components (each one job, testable in isolation):**

- `MushafPage` — renders a page's lines/words from page JSON + glyph font; emits word-in-view events.
- `WordSpan` — single word; shows highlight state; clickable to seek audio.
- `AudioPlayer` — play/pause/seek/speed, reciter picker; drives word highlight from timing JSON.
- `SessionTracker` (Zustand store) — time/words/ayahs/pages/hasanat accrual + flush scheduling.
- `StreakHero`, `GoalProgress`, `MetricCards` (Hasanat/Verses/Time/Pages), `WeekTracker`,
  `ContinueCard` — dashboard.
- `CalendarHeatmap`, `ProgressChart`, `HistoryList` — stats.

**Dashboard layout:** *Layout A — hero streak, stacked* (streak as the centerpiece, 2×2 metric grid,
continue button). *(Note: you didn't pick A vs B explicitly — defaulting to A; say the word for B.)*

**Reading view:** large default Arabic font (comfortable line-height) with `Aa` to scale; top bar
(back = auto-bookmark, `Aa`, ☆ favorite); pinned audio bar with live Hasanat/Time/Verses counters.

---

## 7. Build Phases (for the implementation plan)

1. **Scaffold + auth** — NestJS + Prisma + Postgres; React + Vite + Tailwind (Quiet Slate); JWT
   register/login/refresh; protected routing; `/auth/me`.
2. **Content pipeline** — import KFGQPC dataset (fonts, page layout JSON, word timing, letter
   counts) as static assets; seed `ayah_ref`; render one page faithfully end-to-end.
3. **Reading view** — full page navigation, large font + `Aa` control, light/dark, favorites,
   resume bookmark.
4. **Audio** — reciter picker, word-by-word highlight from timing, 0.5–2× speed, click-to-seek.
5. **Session tracking + Hasanat** — live counters, periodic/on-exit flush, server validation,
   `daily_progress` aggregation, streak computation.
6. **Dashboard** — StreakHero (Layout A), GoalProgress, MetricCards, WeekTracker, ContinueCard.
7. **Onboarding + settings** — pick time-based goal level; settings screen.
8. **Stats** — calendar heatmap, progress graph, history.

---

## 8. Open Items / Risks

- **Dataset licensing & exact source files**: confirm the specific QUL/KFGQPC packages and reciter
  timing files we may redistribute; pin versions during Phase 2.
- **Reciter set**: finalize the 2–3 reciters with verified word timing (candidate: Mishary Alafasy,
  Abdul Basit, Mahmoud Al-Husary).
- **Idle/pause accuracy** for time tracking (tab hidden, no audio playing) — define the idle timeout.
- **Day boundary**: use the user's local timezone for streak day rollover.
