# Phase 6: Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the home dashboard (Layout A): hero 🔥 streak with today's goal progress, a 2×2 grid of today's Hasanat/Verses/Time/Pages, a 7-day weekly tracker, and a Continue-reading card — all fed by existing session data.

**Architecture:** Mostly frontend. The dashboard composes data from the existing `GET /stats/summary?date=` (streak + today + goal) plus one new endpoint `GET /stats/week?date=` returning the last 7 days' goal-met status for the tracker dots. Small presentational components (`StreakHero`, `GoalProgress`, `MetricCards`, `WeekTracker`, `ContinueCard`) replace the placeholder `DashboardPage`.

**Tech Stack:** NestJS + Prisma 7, Jest + supertest; React + Vite + Tailwind v3 (Quiet Slate), TanStack Query, react-router-dom.

**Builds on:** Phase 5 (`DailyProgress`, `Streak`, `StatsService`, `GET /stats/summary`), Phase 3 (`useBookmark`, `ThemeToggle`). Commit directly to `main`; push after verification.

---

## File Structure

```
api/src/stats/
├── stats.service.ts (modified)     # + week(userId, date)
├── stats.controller.ts (modified)  # + GET /stats/week
└── (test) api/test/stats.e2e-spec.ts (modified)  # + week cases
web/src/dashboard/
├── useWeek.ts                       # GET /stats/week
├── StreakHero.tsx                   # 🔥 streak + goal progress
├── MetricCards.tsx                  # 2×2 Hasanat/Verses/Time/Pages
├── WeekTracker.tsx                  # 7 day dots
└── ContinueCard.tsx                 # resume / start reading + favorites link
web/src/pages/DashboardPage.tsx (modified)  # compose the above (Layout A)
```

---

## Task 1: Weekly endpoint (TDD e2e)

**Files:** Modify `api/src/stats/stats.service.ts`, `api/src/stats/stats.controller.ts`, `api/test/stats.e2e-spec.ts`.

- [ ] **Step 1: Add the failing e2e cases**

In `api/test/stats.e2e-spec.ts`, add these cases inside the existing `describe('Stats (e2e)', ...)` block (after the existing tests; the `beforeAll` already posts a goal-met session for `2026-06-01`):
```ts
  it('returns 7 days ending at the given date, newest last', async () => {
    const res = await request(app.getHttpServer()).get('/stats/week?date=2026-06-01').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toHaveLength(7);
    expect(res.body[6].date).toBe('2026-06-01');
    expect(res.body[0].date).toBe('2026-05-26');
    expect(res.body[6].goalMet).toBe(true);   // the seeded goal-met day
    expect(res.body[5].goalMet).toBe(false);  // 2026-05-31 had no reading
  });

  it('week requires auth', async () => {
    await request(app.getHttpServer()).get('/stats/week?date=2026-06-01').expect(401);
  });
```

- [ ] **Step 2: Run — confirm fail.** `cd api && npm run test:e2e -- stats` → the two new cases FAIL (404 / no route).

- [ ] **Step 3: Add `week()` to StatsService**

In `api/src/stats/stats.service.ts`, import `isoMinus1` (already exported from `../sessions/streak`) and add a method:
```ts
import { effectiveCurrent, isoMinus1 } from '../sessions/streak';
```
```ts
  async week(userId: string, date: string) {
    // build the 7 dates ending at `date`, oldest first
    const dates: string[] = [];
    let d = date;
    for (let i = 0; i < 7; i++) { dates.unshift(d); d = isoMinus1(d); }
    const rows = await this.prisma.dailyProgress.findMany({ where: { userId, date: { in: dates } } });
    const byDate = new Map(rows.map((r) => [r.date, r]));
    return dates.map((dt) => ({ date: dt, goalMet: byDate.get(dt)?.goalMet ?? false, secondsRead: byDate.get(dt)?.secondsRead ?? 0 }));
  }
```
(Keep the existing `summary()` method. The `import` line must merge `isoMinus1` with the existing `effectiveCurrent` import from `'../sessions/streak'`.)

- [ ] **Step 4: Add the controller route**

In `api/src/stats/stats.controller.ts`, add a `week` handler reusing the `SummaryQuery` DTO:
```ts
  @Get('week')
  week(@CurrentUser() user: { id: string }, @Query() q: SummaryQuery) {
    return this.stats.week(user.id, q.date);
  }
```

- [ ] **Step 5: Run — green.** `cd api && npm run test:e2e -- stats` → all stats cases PASS. Then full suite `cd api && npm run test:e2e` → expect 31 passing (was 29 + 2 new).

- [ ] **Step 6: Commit**

```bash
git add api/src/stats/stats.service.ts api/src/stats/stats.controller.ts api/test/stats.e2e-spec.ts
git commit -m "feat(api): add weekly progress endpoint for the dashboard tracker"
```

---

## Task 2: Dashboard hooks + components

**Files:** Create `web/src/dashboard/useWeek.ts`, `StreakHero.tsx`, `MetricCards.tsx`, `WeekTracker.tsx`, `ContinueCard.tsx`.

- [ ] **Step 1: useWeek**

Create `web/src/dashboard/useWeek.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { localDate } from '../reading/useStatsSummary';

export type WeekDay = { date: string; goalMet: boolean; secondsRead: number };

export function useWeek() {
  return useQuery({
    queryKey: ['stats-week'],
    queryFn: async (): Promise<WeekDay[]> => (await api.get(`/stats/week?date=${localDate()}`)).data,
  });
}
```

- [ ] **Step 2: StreakHero (with goal progress)**

Create `web/src/dashboard/StreakHero.tsx`:
```tsx
import type { StatsSummary } from '../reading/useStatsSummary';

function fmt(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

export function StreakHero({ summary }: { summary?: StatsSummary }) {
  const streak = summary?.streak.current ?? 0;
  const secs = summary?.today.secondsRead ?? 0;
  const goal = summary?.goalTargetSeconds ?? 120;
  const pct = Math.min(100, Math.round((secs / goal) * 100));
  return (
    <div className="rounded-2xl bg-card-light dark:bg-card-dark p-6 text-center">
      <div className="text-4xl font-bold">🔥 {streak}</div>
      <div className="text-muted text-sm">{streak === 1 ? 'day streak' : 'day streak'}</div>
      <div className="mt-4 text-xs text-muted flex justify-between">
        <span>Today's goal</span>
        <span>{fmt(secs)} / {fmt(goal)}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-light dark:bg-surface-dark mt-1 overflow-hidden">
        <div className="h-2 rounded-full bg-accent-soft transition-all" style={{ width: `${pct}%` }} />
      </div>
      {summary?.today.goalMet && <div className="text-accent-soft text-xs mt-2">Goal complete ✓</div>}
    </div>
  );
}
```

- [ ] **Step 3: MetricCards**

Create `web/src/dashboard/MetricCards.tsx`:
```tsx
import type { StatsSummary } from '../reading/useStatsSummary';

function fmt(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

export function MetricCards({ summary }: { summary?: StatsSummary }) {
  const t = summary?.today;
  const cards = [
    { label: 'Hasanat', value: (t?.hasanat ?? 0).toLocaleString(), accent: true },
    { label: 'Verses', value: String(t?.versesRead ?? 0) },
    { label: 'Time', value: fmt(t?.secondsRead ?? 0) },
    { label: 'Pages', value: String(t?.pagesRead ?? 0) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl bg-card-light dark:bg-card-dark p-4">
          <div className={`text-xl font-semibold ${c.accent ? 'text-accent-soft' : 'text-ink dark:text-ink-dark'}`}>{c.value}</div>
          <div className="text-xs text-muted">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: WeekTracker**

Create `web/src/dashboard/WeekTracker.tsx`:
```tsx
import type { WeekDay } from './useWeek';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // index by UTC day

function dowLetter(date: string) {
  return DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function WeekTracker({ week }: { week?: WeekDay[] }) {
  if (!week) return null;
  return (
    <div className="flex justify-between px-1">
      {week.map((d, i) => (
        <div key={d.date} className="flex flex-col items-center gap-1">
          <div
            className={
              'w-8 h-8 rounded-full grid place-items-center text-xs ' +
              (d.goalMet
                ? 'bg-accent-soft text-white'
                : i === week.length - 1
                  ? 'border border-accent-soft text-muted'
                  : 'border border-muted/30 text-muted')
            }
          >
            {dowLetter(d.date)}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: ContinueCard**

Create `web/src/dashboard/ContinueCard.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { useBookmark } from '../reading/useBookmark';

export function ContinueCard() {
  const { data: bookmark } = useBookmark();
  const resumePage = bookmark?.page ?? 1;
  return (
    <div className="rounded-2xl bg-card-light dark:bg-card-dark p-4 space-y-3 text-center">
      <Link to={`/read/page/${resumePage}`} className="block rounded-lg bg-accent text-white py-3 font-medium">
        {bookmark ? `Continue · page ${resumePage}` : 'Start reading'}
      </Link>
      <Link to="/favorites" className="text-sm text-accent-soft">View favorites</Link>
    </div>
  );
}
```

- [ ] **Step 6: Type-check + commit**

Run: `cd web && npx tsc -b`. Commit:
```bash
git add web/src/dashboard
git commit -m "feat(web): add dashboard hooks and presentational components"
```

---

## Task 3: Assemble DashboardPage (Layout A)

**Files:** Modify `web/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Replace DashboardPage**

Replace `web/src/pages/DashboardPage.tsx`:
```tsx
import { useAuth } from '../auth/useAuth';
import { useStatsSummary } from '../reading/useStatsSummary';
import { useWeek } from '../dashboard/useWeek';
import { StreakHero } from '../dashboard/StreakHero';
import { MetricCards } from '../dashboard/MetricCards';
import { WeekTracker } from '../dashboard/WeekTracker';
import { ContinueCard } from '../dashboard/ContinueCard';
import { ThemeToggle } from '../components/ThemeToggle';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { data: summary } = useStatsSummary();
  const { data: week } = useWeek();

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-muted">Assalamu alaikum, {user?.name}</span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button className="text-sm text-accent-soft" onClick={logout}>Log out</button>
        </div>
      </div>
      <StreakHero summary={summary} />
      <MetricCards summary={summary} />
      <WeekTracker week={week} />
      <ContinueCard />
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `cd web && npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/DashboardPage.tsx
git commit -m "feat(web): assemble home dashboard (streak, metrics, week, continue)"
```

---

## Task 4: Visual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Ensure the stack runs** (docker + api + web).

- [ ] **Step 2: Browser proof (Playwright)** — log in (an account that has read today, so the metrics are non-zero), open `/`:
1. Confirm the **StreakHero** shows 🔥 + a streak number and a goal progress bar.
2. Confirm **MetricCards** shows today's Hasanat (accent), Verses, Time, Pages.
3. Confirm **WeekTracker** shows 7 dots with the correct day letters; today's reading day is filled (accent) if the goal was met.
4. Confirm **Continue** links to the bookmarked page (or "Start reading").
5. Toggle theme → dashboard switches light/dark.
6. Screenshot the dashboard (ideally in dark mode) with non-zero metrics.

> To guarantee non-zero data for the logged-in browser account, you may first `POST /reading-sessions` for today's `localDate()` via the app (read a page > 3s and let it flush) or directly via curl with that account's token.

- [ ] **Step 3: Report** pass/fail with the screenshot.

---

## Self-Review Notes

- **Spec coverage (§ dashboard, Layout A):** hero streak + goal progress (StreakHero), 2×2 Hasanat/Verses/Time/Pages (MetricCards), weekly tracker dots (WeekTracker + new `/stats/week`), Continue/resume (ContinueCard, reuses Phase 3 bookmark). Reminders, badges/levels, and social are out of scope (never planned for this app).
- **Deferred (correct):** calendar heatmap + progress graph history is Phase 8; configurable goal is Phase 7 (the hero already reads `goalTargetSeconds` from the summary, so it will pick up the per-user value automatically once Phase 7 lands).
- **Type consistency:** `StatsSummary` (from `useStatsSummary`) is the single source consumed by `StreakHero` and `MetricCards`; `WeekDay[]` (from `useWeek`) feeds `WeekTracker`; both query keys (`stats-summary`, `stats-week`) are invalidated by the reading tracker's flush, so the dashboard reflects reading done in the same session. The new `/stats/week` reuses the existing `SummaryQuery` date DTO and `isoMinus1` helper.
```
