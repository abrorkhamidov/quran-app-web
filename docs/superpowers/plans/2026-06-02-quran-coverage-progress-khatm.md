# Qur'an Reading Coverage → Per-Juz/Surah Progress + Khatm % (Slice 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track which pages a user has ever read and surface per-juz / per-surah progress on the Browse page plus an overall khatm (whole-Qur'an completion) percentage on the dashboard and stats page.

**Architecture:** A new `PageRead` table records (userId, page) the first time each page is read, written from the existing reading-session flow. A new `quran` API module exposes `GET /quran/coverage`, computing read/total ayah counts per juz and per surah by grouping `AyahRef` against the user's read pages (ayah-accurate from page-grained coverage), plus an overall pages-read percentage. The web app loads this via react-query and renders progress rings on Browse rows and a khatm bar on the dashboard + stats page.

**Tech Stack:** NestJS 10 + Prisma (PostgreSQL); React 19 + @tanstack/react-query + Tailwind.

**Scope note:** Deliverable 2 of `docs/superpowers/specs/2026-06-02-quran-navigation-juz-progress-design.md` (§5). Builds on Slice 1 (already shipped: `surahs.json`/`juz.json`, `quranIndex`, Browse page). Slices 3 (ayah view) and 4 (flexible goals) follow in their own plans.

**Testing reality:** The API has no service-level unit tests (established pattern); backend tasks are gated by `npm run build` (TypeScript compile) plus an integration check via `curl` against the running dev API. The coverage numbers are verified against the existing test user `vt@test.dev` (password `Test1234!`) who has already read pages 1–~82.

---

## File Structure

**Create**
- `api/src/quran/quran.service.ts` — computes coverage from `PageRead` ⋈ `AyahRef`.
- `api/src/quran/quran.controller.ts` — `GET /quran/coverage` (auth-guarded).
- `api/src/quran/quran.module.ts` — wires the above.
- `web/src/quran/useCoverage.ts` — react-query loader + `Coverage` type.
- `web/src/quran/ProgressRing.tsx` — small SVG percentage ring.
- `web/src/dashboard/KhatmBar.tsx` — overall completion bar (shared by dashboard + stats).

**Modify**
- `api/prisma/schema.prisma` — add `PageRead` model (+ generated migration).
- `api/src/sessions/sessions.service.ts` — upsert `PageRead` rows from `pages[]`.
- `api/src/app.module.ts` — register `QuranModule`.
- `web/src/reading/useReadingTracker.ts` — invalidate `['coverage']` after a flush.
- `web/src/pages/BrowsePage.tsx` — show a progress ring per surah/juz row.
- `web/src/pages/DashboardPage.tsx` — khatm bar.
- `web/src/pages/StatsPage.tsx` — khatm bar.

---

## Task 1: PageRead model + migration

**Files:** Modify `api/prisma/schema.prisma`

- [ ] **Step 1: Add the model**

In `api/prisma/schema.prisma`, after the `Favorite` model (anywhere among the models is fine), add:

```prisma
model PageRead {
  userId      String
  page        Int      // 1..604
  firstReadAt DateTime @default(now())

  @@id([userId, page])
  @@index([userId])
}
```

- [ ] **Step 2: Create and apply the migration**

Run from `api/`: `npx prisma migrate dev --name add_page_read`
Expected: a new folder under `api/prisma/migrations/` and output ending `Your database is now in sync with your schema.` plus the Prisma client regenerating.

If the command reports DRIFT or cannot connect to the database, STOP and report BLOCKED with the exact message — do NOT use `migrate reset` (it would wipe the user's data).

- [ ] **Step 3: Confirm the client type exists**

Run from `api/`: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (the generated client now includes `pageRead`).

- [ ] **Step 4: Commit**

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat(api): add PageRead model for reading coverage"
```

---

## Task 2: Record read pages on every session

**Files:** Modify `api/src/sessions/sessions.service.ts`

Context: `record()` already computes `const pages = [...new Set(dto.pages)].filter((p) => p >= 1 && p <= 604);` and creates a `readingSession`. We add a bulk insert of `PageRead` rows (duplicates ignored, so only the first read of each page persists).

- [ ] **Step 1: Insert the PageRead write**

In `api/src/sessions/sessions.service.ts`, locate the `await this.prisma.readingSession.create({ ... });` call. Immediately AFTER that call (and before the `dailyProgress` upsert), insert:

```ts
    if (pages.length) {
      await this.prisma.pageRead.createMany({
        data: pages.map((page) => ({ userId, page })),
        skipDuplicates: true,
      });
    }
```

- [ ] **Step 2: Build**

Run from `api/`: `npm run build`
Expected: compiles with no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add api/src/sessions/sessions.service.ts
git commit -m "feat(api): record read pages into PageRead on session flush"
```

---

## Task 3: Coverage module + endpoint

**Files:** Create `api/src/quran/quran.service.ts`, `api/src/quran/quran.controller.ts`, `api/src/quran/quran.module.ts`; Modify `api/src/app.module.ts`

- [ ] **Step 1: Create the service**

Create `api/src/quran/quran.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const TOTAL_PAGES = 604;

export type DimensionProgress = { id: number; ayahsRead: number; ayahCount: number; percent: number };
export type Coverage = {
  overall: { pagesRead: number; totalPages: number; percent: number };
  juz: DimensionProgress[];
  surah: DimensionProgress[];
};

@Injectable()
export class QuranService {
  constructor(private prisma: PrismaService) {}

  async coverage(userId: string): Promise<Coverage> {
    const read = await this.prisma.pageRead.findMany({ where: { userId }, select: { page: true } });
    const pages = read.map((r) => r.page);

    // empty `in: []` matches no rows, so read-counts default to 0 cleanly
    const [juzTotals, surahTotals, juzRead, surahRead] = await Promise.all([
      this.prisma.ayahRef.groupBy({ by: ['juz'], _count: { _all: true } }),
      this.prisma.ayahRef.groupBy({ by: ['surah'], _count: { _all: true } }),
      this.prisma.ayahRef.groupBy({ by: ['juz'], where: { page: { in: pages } }, _count: { _all: true } }),
      this.prisma.ayahRef.groupBy({ by: ['surah'], where: { page: { in: pages } }, _count: { _all: true } }),
    ]);

    const readByJuz = new Map(juzRead.map((r) => [r.juz, r._count._all]));
    const readBySurah = new Map(surahRead.map((r) => [r.surah, r._count._all]));
    const pct = (read: number, total: number) => (total ? Math.round((read / total) * 100) : 0);

    const juz = juzTotals
      .map((t) => {
        const ayahsRead = readByJuz.get(t.juz) ?? 0;
        return { id: t.juz, ayahsRead, ayahCount: t._count._all, percent: pct(ayahsRead, t._count._all) };
      })
      .sort((a, b) => a.id - b.id);

    const surah = surahTotals
      .map((t) => {
        const ayahsRead = readBySurah.get(t.surah) ?? 0;
        return { id: t.surah, ayahsRead, ayahCount: t._count._all, percent: pct(ayahsRead, t._count._all) };
      })
      .sort((a, b) => a.id - b.id);

    return {
      overall: { pagesRead: pages.length, totalPages: TOTAL_PAGES, percent: pct(pages.length, TOTAL_PAGES) },
      juz,
      surah,
    };
  }
}
```

- [ ] **Step 2: Create the controller**

Create `api/src/quran/quran.controller.ts`:

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { QuranService } from './quran.service';

@UseGuards(JwtAuthGuard)
@Controller('quran')
export class QuranController {
  constructor(private quran: QuranService) {}

  @Get('coverage')
  coverage(@CurrentUser() user: { id: string }) {
    return this.quran.coverage(user.id);
  }
}
```

- [ ] **Step 3: Create the module**

Create `api/src/quran/quran.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { QuranService } from './quran.service';
import { QuranController } from './quran.controller';

@Module({
  controllers: [QuranController],
  providers: [QuranService],
})
export class QuranModule {}
```

- [ ] **Step 4: Register in app.module**

In `api/src/app.module.ts`: add `import { QuranModule } from './quran/quran.module';` with the other module imports, and add `QuranModule` to the `imports: [...]` array (e.g. after `StatsModule`).

- [ ] **Step 5: Build**

Run from `api/`: `npm run build`
Expected: compiles with no errors.

- [ ] **Step 6: Integration check against the running dev API**

The dev API runs on `http://localhost:3000` in watch mode (it will have recompiled). Get a token and call the endpoint:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"vt@test.dev","password":"Test1234!"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).accessToken))")
curl -s http://localhost:3000/quran/coverage -H "Authorization: Bearer $TOKEN" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('overall',j.overall);console.log('juz entries',j.juz.length,'surah entries',j.surah.length);console.log('juz[0..2]',JSON.stringify(j.juz.slice(0,3)));})"
```

Expected: JSON with `overall.totalPages == 604`, `overall.pagesRead` > 0 (the test user has read pages), `juz` an array of 30 entries and `surah` of 114, each with `id`, `ayahsRead`, `ayahCount`, `percent`. Sanity: `overall.percent == round(pagesRead/604*100)`; for a juz the user has fully read, `ayahsRead == ayahCount` and `percent == 100`. If the server is not running, note it and rely on the successful `npm run build` from Step 5 instead.

- [ ] **Step 7: Commit**

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add api/src/quran api/src/app.module.ts
git commit -m "feat(api): GET /quran/coverage (per-juz/surah progress + khatm)"
```

---

## Task 4: Coverage loader + cache invalidation

**Files:** Create `web/src/quran/useCoverage.ts`; Modify `web/src/reading/useReadingTracker.ts`

- [ ] **Step 1: Create the loader**

Create `web/src/quran/useCoverage.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export type DimensionProgress = { id: number; ayahsRead: number; ayahCount: number; percent: number };
export type Coverage = {
  overall: { pagesRead: number; totalPages: number; percent: number };
  juz: DimensionProgress[];
  surah: DimensionProgress[];
};

export function useCoverage() {
  return useQuery({
    queryKey: ['coverage'],
    queryFn: async (): Promise<Coverage> => (await api.get('/quran/coverage')).data,
  });
}
```

- [ ] **Step 2: Invalidate coverage after a reading flush**

In `web/src/reading/useReadingTracker.ts`, find the line `qc.invalidateQueries({ queryKey: ['stats-summary'] });` inside `flush()` and add immediately after it:

```ts
      qc.invalidateQueries({ queryKey: ['coverage'] });
```

- [ ] **Step 3: Type-check**

Run from `web/`: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add web/src/quran/useCoverage.ts web/src/reading/useReadingTracker.ts
git commit -m "feat(web): coverage loader + invalidate on reading flush"
```

---

## Task 5: Progress rings on Browse rows

**Files:** Create `web/src/quran/ProgressRing.tsx`; Modify `web/src/pages/BrowsePage.tsx`

- [ ] **Step 1: Create the ring**

Create `web/src/quran/ProgressRing.tsx`:

```tsx
export function ProgressRing({ percent, size = 34 }: { percent: number; size?: number }) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const offset = circumference * (1 - clamped / 100);
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="currentColor" className="text-line-light dark:text-line-dark" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          className="text-accent-soft"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-[9px] text-muted">{clamped}</span>
    </span>
  );
}
```

- [ ] **Step 2: Wire coverage into BrowsePage**

In `web/src/pages/BrowsePage.tsx`:

Add imports after the existing `import { pageForSurah, pageForJuz } from '../quran/quranIndex';` line:
```tsx
import { useCoverage } from '../quran/useCoverage';
import { ProgressRing } from '../quran/ProgressRing';
```

Inside the component, after the existing `const { data: juz, isLoading: juzLoading } = useJuzList();` line, add:
```tsx
  const { data: coverage } = useCoverage();
  const surahPct = new Map((coverage?.surah ?? []).map((d) => [d.id, d.percent]));
  const juzPct = new Map((coverage?.juz ?? []).map((d) => [d.id, d.percent]));
```

In the surah row, replace the trailing element:
```tsx
              <span className="font-quran text-xl">{s.arabicName}</span>
```
with:
```tsx
              <span className="font-quran text-xl">{s.arabicName}</span>
              <ProgressRing percent={surahPct.get(s.id) ?? 0} />
```

In the juz row, replace the trailing element:
```tsx
              <span className="text-xs text-muted">p.{j.startPage}</span>
```
with:
```tsx
              <span className="text-xs text-muted">p.{j.startPage}</span>
              <ProgressRing percent={juzPct.get(j.juz) ?? 0} />
```

- [ ] **Step 3: Type-check**

Run from `web/`: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add web/src/quran/ProgressRing.tsx web/src/pages/BrowsePage.tsx
git commit -m "feat(web): per-surah/juz progress rings on Browse"
```

---

## Task 6: Khatm bar on dashboard + stats

**Files:** Create `web/src/dashboard/KhatmBar.tsx`; Modify `web/src/pages/DashboardPage.tsx`, `web/src/pages/StatsPage.tsx`

- [ ] **Step 1: Create the shared bar**

Create `web/src/dashboard/KhatmBar.tsx`:

```tsx
import { useCoverage } from '../quran/useCoverage';

export function KhatmBar() {
  const { data: coverage } = useCoverage();
  const o = coverage?.overall;
  const percent = o?.percent ?? 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span className="uppercase tracking-[0.14em]">Qur'an completion</span>
        <span>{percent}% · {o?.pagesRead ?? 0}/{o?.totalPages ?? 604} pages</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-light dark:bg-surface-dark">
        <div className="h-full rounded-full bg-accent-soft transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add it to the dashboard**

In `web/src/pages/DashboardPage.tsx`:

Add the import after `import { formatDuration } from '../lib/formatDuration';`:
```tsx
import { KhatmBar } from '../dashboard/KhatmBar';
```

Find the Week `<section>` (the one with `className="lg:col-span-12 ...` containing "This week"). Immediately AFTER that section's closing `</section>`, add a new section:
```tsx
        {/* Qur'an completion */}
        <section className="lg:col-span-12 rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7">
          <KhatmBar />
        </section>
```

- [ ] **Step 3: Add it to the stats page**

In `web/src/pages/StatsPage.tsx`:

Add the import after the existing `import { formatDuration } from '../lib/formatDuration';` line:
```tsx
import { KhatmBar } from '../dashboard/KhatmBar';
```

Find the stats grid `</div>` that closes the `grid grid-cols-2 lg:grid-cols-5 gap-4` block (it ends right before `<div className="mt-5 grid gap-5 lg:grid-cols-2">`). Immediately AFTER that grid's closing `</div>`, insert:
```tsx

      <section className="mt-5 rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7">
        <KhatmBar />
      </section>
```

- [ ] **Step 4: Type-check**

Run from `web/`: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add web/src/dashboard/KhatmBar.tsx web/src/pages/DashboardPage.tsx web/src/pages/StatsPage.tsx
git commit -m "feat(web): khatm completion bar on dashboard + stats"
```

---

## Final verification

- [ ] **API build**: from `api/` run `npm run build` → no errors.
- [ ] **Web typecheck + tests**: from `web/` run `npx tsc --noEmit` (clean) and `npx vitest run` (existing tests still pass).
- [ ] **Coverage endpoint** (server running): re-run the Task 3 Step 6 curl → 30 juz + 114 surah entries, `overall.percent` consistent with `pagesRead/604`.
- [ ] **Manual smoke** (dev app, logged in as the test user):
  - Browse → Surahs and Juz rows show a ring; surahs/juz the user has read show non-zero %, fully-read ones show 100.
  - Dashboard and Stats show the "Qur'an completion" bar with `pagesRead/604`.
  - Read a new page, wait for a flush (or reload), and confirm coverage ticks up.

---

## Self-review notes (addressed)

- **Spec coverage (§5):** `PageRead` model ✓ (Task 1); write path from `pages[]` ✓ (Task 2); `GET /quran/coverage` with overall + per-juz + per-surah ✓ (Task 3); rings on Browse ✓ (Task 5); khatm bar on dashboard + stats ✓ (Task 6); cache invalidation ✓ (Task 4).
- **Ayah-accurate from page coverage:** per-juz/surah counts come from grouping `AyahRef` (each ayah maps to exactly one page and one juz/surah) against the read-pages set — so a page straddling a juz boundary still attributes each ayah to the correct juz.
- **Empty-coverage safety:** `where: { page: { in: [] } }` returns no rows, so a brand-new user gets all-zero progress without special-casing.
- **Type consistency:** `Coverage`/`DimensionProgress` are defined on the API (`quran.service.ts`) and mirrored on the web (`useCoverage.ts`); `percent` is an integer 0–100 everywhere; `ProgressRing` clamps/rounds defensively.
- **No new API unit tests:** matches the existing codebase (no service specs); gated by `npm run build` + a real-data `curl` integration check instead.
