# Quran Habit App

A habit-building Qur'an reading web app — inspired by Quranly, with a calmer "Quiet Slate" design. It's a *habit* app that happens to be about the Qur'an: open → resume reading → hit your daily goal → keep your streak, with a server-validated **Hasanat** counter as the hook.

Page-faithful **QCF v2 Mushaf** rendering, recitation audio with **word-by-word highlighting**, daily goals + streaks, and a stats screen with a calendar heatmap.

## Features

- **Auth** — email/password with JWT access + refresh tokens
- **Mushaf** — page-faithful KFGQPC **QCF v2** rendering (604 page fonts, 15 lines/page)
- **Reading view** — light/dark, adjustable Arabic font size, resume bookmark, favorite ayahs
- **Audio** — 3 reciters (Mishary Alafasy, AbdulBaset AbdulSamad, Mahmoud Al-Husary), 0.5–2× speed, word-by-word highlight synced to the recitation, "play from here"
- **Habit engine** — session tracking, **Hasanat** (10 × Arabic letters, validated server-side), daily progress aggregation, day-streak
- **Dashboard** — hero streak, today's goal progress, Hasanat/Verses/Time/Pages, weekly tracker, continue-reading
- **Goals & settings** — first-run onboarding goal picker (2/10/30 min levels), settings synced to the backend across devices
- **Stats** — lifetime totals, current/longest streak, 17-week activity heatmap, 30-day minutes chart

## Tech stack

| Layer | Tech |
|------|------|
| Frontend | React 18 + Vite + TypeScript, React Router, TanStack Query, Tailwind CSS v3 |
| Backend | NestJS 10, Passport-JWT, argon2 |
| Database | PostgreSQL 16 via Prisma 7 (pg driver adapter) |
| Content | Quran Foundation API (text/layout/audio timing), `nuqayah/qpc-fonts` (QCF v2) |

## Repository layout

```
quran-app/
├── docker-compose.yml         # Postgres 16
├── api/                       # NestJS API (auth, sessions, stats, settings, …)
├── web/                       # React + Vite frontend
├── scripts/                   # one-time data build scripts
│   ├── build-quran-data.mjs       # → web/public/quran/pages/*.json + ayah-ref.json
│   ├── fetch-fonts.mjs            # → web/public/fonts/qcf2/*.woff2 + qcf2.css
│   ├── build-audio-timings.mjs   # → web/public/audio/timings/**.json
│   └── lib/letter-count.mjs      # Hasanat letter counting (unit-tested)
└── docs/superpowers/          # design spec + per-phase implementation plans
```

## Prerequisites

- **Node.js 18+** and npm
- **Docker** (for Postgres) — or an existing PostgreSQL 16 instance
- For regenerating fonts only: **Python 3** with `fonttools` + `brotli` (TTF→WOFF2)

## Setup

### 1. Database

```bash
docker compose up -d        # Postgres on localhost:5432 (db/user/pass: quran)
```

### 2. API

```bash
cd api
cp .env.example .env        # then edit secrets (see below)
npm install
npx prisma migrate dev      # create the schema
npx prisma db seed          # seed AyahRef (6236 rows) from scripts/generated/ayah-ref.json
npm run start:dev           # http://localhost:3000
```

`api/.env`:
```
DATABASE_URL="postgresql://quran:quran@localhost:5432/quran?schema=public"
JWT_ACCESS_SECRET="change-me"
JWT_REFRESH_SECRET="change-me"
JWT_ACCESS_TTL="900s"
JWT_REFRESH_TTL="30d"
WEB_ORIGIN="http://localhost:5173"
```

### 3. Web

```bash
cd web
npm install
npm run dev                 # http://localhost:5173
```

`web/.env`:
```
VITE_API_URL=http://localhost:3000
```

Open **http://localhost:5173**, create an account, pick a daily goal, and start reading.

## Static content (already committed)

The generated Quran data is committed so the app runs offline out of the box:

- `web/public/quran/pages/{1..604}.json` — per-page word/line/glyph data
- `web/public/fonts/qcf2/` — 604 QCF v2 WOFF2 page fonts + `qcf2.css`
- `web/public/audio/timings/{7,2,6}/{1..114}.json` — word-level audio timing (the MP3s themselves stream from `download.quranicaudio.com`)

### Regenerating the data (only if needed)

```bash
node scripts/build-quran-data.mjs       # page JSON + ayah-ref.json (≈604 API calls)
node scripts/build-audio-timings.mjs    # audio timing JSON (3 reciters × 114 chapters)

# fonts (needs fonttools + brotli):
python3 -m venv .venv-fonts && .venv-fonts/bin/pip install fonttools brotli
node scripts/fetch-fonts.mjs            # downloads QCF v2 TTFs, converts to WOFF2
```

## Tests

```bash
cd api && npm run test:e2e   # 41 end-to-end tests (auth, bookmark, favorites, sessions, stats, settings)
cd api && npx jest streak    # streak math unit tests
npm run test:scripts         # letter-count unit tests (repo root)
```

## API overview

All routes except `/auth/*` require a `Bearer <accessToken>` header.

| Method | Path | Purpose |
|-------|------|---------|
| POST | `/auth/register`, `/auth/login`, `/auth/refresh` | auth + tokens |
| GET | `/auth/me` | current user |
| GET / PUT | `/bookmark` | resume position |
| GET / POST / DELETE | `/favorites` | favorite ayahs |
| POST | `/reading-sessions` | record a reading session (server computes Hasanat) |
| GET | `/stats/summary?date=` | today + lifetime + streak |
| GET | `/stats/week?date=` | last 7 days (tracker) |
| GET | `/stats/calendar?from&to` | daily history (heatmap/chart) |
| GET / PATCH | `/settings` | goal, reciter, theme, font scale |

## Notes

- **Repo size:** the 604 QCF v2 fonts add ~115 MB to git. Consider Git LFS or a CDN for `web/public/fonts/` if clone weight becomes an issue.
- Design spec and per-phase implementation plans live in `docs/superpowers/`.

## Credits

- Qur'an text, layout & audio timing: [Quran Foundation / Quran.com](https://quran.com)
- QCF v2 fonts: King Fahd Glorious Qur'an Printing Complex, via [`nuqayah/qpc-fonts`](https://github.com/nuqayah/qpc-fonts)
- Recitation audio: [quranicaudio.com](https://quranicaudio.com)
