# Phase 8: Stats (Calendar Heatmap + Progress Chart) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stats screen showing lifetime totals + current/longest streak, a GitHub-style calendar heatmap of daily reading activity, and a 30-day minutes-per-day chart — all from the existing `DailyProgress` history.

**Architecture:** One new endpoint `GET /stats/calendar?from&to` returns the user's `DailyProgress` rows in a date range. A new `/stats` page fetches a ~17-week window, derives the heatmap (weeks × weekdays) and a 30-day bar chart, and shows lifetime/streak from the existing `/stats/summary`. Both visualizations are hand-rolled (CSS grid heatmap + flex-bar chart) — no charting dependency.

**Tech Stack:** NestJS + Prisma 7, Jest + supertest; React + Vite + Tailwind v3 (Quiet Slate), TanStack Query, react-router-dom.

**Builds on:** Phase 5 (`DailyProgress`, `StatsService`, `useStatsSummary`), Phase 6/7 (dashboard, settings link pattern). Commit directly to `main`; push after verification.

---

## File Structure

```
api/src/stats/
├── stats.service.ts (modified)     # + calendar(userId, from, to)
├── stats.controller.ts (modified)  # + GET /stats/calendar?from&to
└── (test) api/test/stats.e2e-spec.ts (modified)  # + calendar cases
web/src/stats/
├── dateUtils.ts                     # isoAddDays, dow, buildHeatmapWeeks, lastNDays
├── useCalendar.ts                   # GET /stats/calendar
├── Heatmap.tsx                      # weeks × weekdays grid
└── MinutesChart.tsx                 # 30-day minutes bars
web/src/pages/StatsPage.tsx          # compose lifetime + streak + heatmap + chart
web/src/App.tsx (modified)           # + /stats route
web/src/pages/DashboardPage.tsx (modified)  # link to /stats
```

---

## Task 1: Calendar endpoint (TDD e2e)

**Files:** Modify `api/src/stats/stats.service.ts`, `api/src/stats/stats.controller.ts`, `api/test/stats.e2e-spec.ts`.

- [ ] **Step 1: Add failing e2e cases**

In `api/test/stats.e2e-spec.ts`, add inside the existing `describe('Stats (e2e)', ...)` block (the `beforeAll` already posts a goal-met session for `2026-06-01`; add a second day in these cases):
```ts
  it('calendar requires auth', async () => {
    await request(app.getHttpServer()).get('/stats/calendar?from=2026-05-01&to=2026-06-30').expect(401);
  });

  it('returns daily rows within the range', async () => {
    await request(app.getHttpServer()).post('/reading-sessions').set('Authorization', `Bearer ${token}`).send({ date: '2026-06-03', durationSeconds: 200, pages: [4] });
    const res = await request(app.getHttpServer()).get('/stats/calendar?from=2026-05-01&to=2026-06-30').set('Authorization', `Bearer ${token}`).expect(200);
    const dates = res.body.map((r: { date: string }) => r.date);
    expect(dates).toContain('2026-06-01');
    expect(dates).toContain('2026-06-03');
    const row = res.body.find((r: { date: string }) => r.date === '2026-06-01');
    expect(row).toMatchObject({ date: '2026-06-01' });
    expect(typeof row.secondsRead).toBe('number');
    expect(typeof row.hasanat).toBe('number');
  });

  it('excludes rows outside the range', async () => {
    const res = await request(app.getHttpServer()).get('/stats/calendar?from=2026-07-01&to=2026-07-31').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toEqual([]);
  });

  it('rejects a bad date format', async () => {
    await request(app.getHttpServer()).get('/stats/calendar?from=nope&to=2026-06-30').set('Authorization', `Bearer ${token}`).expect(400);
  });
```

- [ ] **Step 2: Run — confirm fail.** `cd api && npm run test:e2e -- stats` → the new cases FAIL.

- [ ] **Step 3: Add `calendar()` to StatsService**

In `api/src/stats/stats.service.ts`, add:
```ts
  async calendar(userId: string, from: string, to: string) {
    const rows = await this.prisma.dailyProgress.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => ({
      date: r.date,
      secondsRead: r.secondsRead,
      versesRead: r.versesRead,
      pagesRead: r.pagesRead,
      hasanat: r.hasanat,
      goalMet: r.goalMet,
    }));
  }
```
(`date` is a `YYYY-MM-DD` string; lexicographic `gte`/`lte` matches chronological order.)

- [ ] **Step 4: Add the controller route**

In `api/src/stats/stats.controller.ts`, add a query DTO and handler:
```ts
import { IsOptional, Matches } from 'class-validator';
```
```ts
class CalendarQuery {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to: string;
}
```
```ts
  @Get('calendar')
  calendar(@CurrentUser() user: { id: string }, @Query() q: CalendarQuery) {
    return this.stats.calendar(user.id, q.from, q.to);
  }
```
(If `Matches` is already imported for `SummaryQuery`, don't import it twice; reuse the existing import. Remove the unused `IsOptional` import if your linter flags it — it's not needed here.)

- [ ] **Step 5: Run e2e — green.** `cd api && npm run test:e2e -- stats` → all stats cases PASS. Full suite `cd api && npm run test:e2e` → expect 41 passing (37 + 4 new).

- [ ] **Step 6: Commit**

```bash
git add api/src/stats/stats.service.ts api/src/stats/stats.controller.ts api/test/stats.e2e-spec.ts
git commit -m "feat(api): add calendar endpoint for daily reading history"
```

---

## Task 2: Stats page (heatmap + chart)

**Files:** Create `web/src/stats/dateUtils.ts`, `useCalendar.ts`, `Heatmap.tsx`, `MinutesChart.tsx`, `web/src/pages/StatsPage.tsx`; modify `web/src/App.tsx`, `web/src/pages/DashboardPage.tsx`.

- [ ] **Step 1: dateUtils**

Create `web/src/stats/dateUtils.ts`:
```ts
export function isoAddDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dow(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
}

// Columns of weeks (each a 7-length array of date strings, Sun..Sat), last column contains `end`.
export function buildHeatmapWeeks(end: string, weeks = 17): string[][] {
  const lastSat = isoAddDays(end, 6 - dow(end));
  let d = isoAddDays(lastSat, -(weeks * 7 - 1));
  const cols: string[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: string[] = [];
    for (let i = 0; i < 7; i++) { col.push(d); d = isoAddDays(d, 1); }
    cols.push(col);
  }
  return cols;
}

export function lastNDays(end: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(isoAddDays(end, -i));
  return out;
}
```

- [ ] **Step 2: useCalendar**

Create `web/src/stats/useCalendar.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export type CalendarDay = { date: string; secondsRead: number; versesRead: number; pagesRead: number; hasanat: number; goalMet: boolean };

export function useCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['stats-calendar', from, to],
    queryFn: async (): Promise<CalendarDay[]> => (await api.get(`/stats/calendar?from=${from}&to=${to}`)).data,
  });
}
```

- [ ] **Step 3: Heatmap**

Create `web/src/stats/Heatmap.tsx`:
```tsx
import { buildHeatmapWeeks } from './dateUtils';

const LEVELS = ['bg-muted/15', 'bg-accent-soft/30', 'bg-accent-soft/55', 'bg-accent-soft/80', 'bg-accent-soft'];

function level(seconds: number): number {
  const m = seconds / 60;
  if (m <= 0) return 0;
  if (m < 5) return 1;
  if (m < 15) return 2;
  if (m < 30) return 3;
  return 4;
}

export function Heatmap({ end, secondsByDate }: { end: string; secondsByDate: Map<string, number> }) {
  const weeks = buildHeatmapWeeks(end, 17);
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {weeks.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-1">
          {col.map((date) => {
            const future = date > end;
            const lvl = level(secondsByDate.get(date) ?? 0);
            return (
              <div
                key={date}
                title={`${date}: ${Math.round((secondsByDate.get(date) ?? 0) / 60)} min`}
                className={`w-3 h-3 rounded-sm ${future ? 'opacity-0' : LEVELS[lvl]}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: MinutesChart**

Create `web/src/stats/MinutesChart.tsx`:
```tsx
import { lastNDays } from './dateUtils';

export function MinutesChart({ end, secondsByDate, days = 30 }: { end: string; secondsByDate: Map<string, number>; days?: number }) {
  const dates = lastNDays(end, days);
  const minutes = dates.map((d) => Math.round((secondsByDate.get(d) ?? 0) / 60));
  const max = Math.max(1, ...minutes);
  return (
    <div className="flex items-end gap-[2px] h-28">
      {dates.map((d, i) => (
        <div key={d} title={`${d}: ${minutes[i]} min`} className="flex-1 bg-accent-soft/70 rounded-t-sm" style={{ height: `${(minutes[i] / max) * 100}%`, minHeight: minutes[i] > 0 ? '2px' : '0' }} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: StatsPage**

Create `web/src/pages/StatsPage.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { useStatsSummary, localDate } from '../reading/useStatsSummary';
import { useCalendar } from '../stats/useCalendar';
import { isoAddDays } from '../stats/dateUtils';
import { Heatmap } from '../stats/Heatmap';
import { MinutesChart } from '../stats/MinutesChart';

function fmtTime(s: number) { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m}m`; }

export default function StatsPage() {
  const today = localDate();
  const from = isoAddDays(today, -118);
  const { data: summary } = useStatsSummary();
  const { data: calendar } = useCalendar(from, today);
  const secondsByDate = new Map((calendar ?? []).map((d) => [d.date, d.secondsRead]));

  const life = summary?.lifetime;
  const stats = [
    { label: 'Total Hasanat', value: (life?.hasanat ?? 0).toLocaleString() },
    { label: 'Verses', value: (life?.verses ?? 0).toLocaleString() },
    { label: 'Pages', value: (life?.pages ?? 0).toLocaleString() },
    { label: 'Time', value: fmtTime(life?.seconds ?? 0) },
  ];

  return (
    <div className="min-h-screen p-6 max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-accent-soft">‹ Home</Link>
        <h1 className="text-lg font-semibold">Your stats</h1>
        <span className="w-10" />
      </div>

      <div className="flex justify-around rounded-2xl bg-card-light dark:bg-card-dark p-4 text-center">
        <div><div className="text-xl font-bold">🔥 {summary?.streak.current ?? 0}</div><div className="text-xs text-muted">current</div></div>
        <div><div className="text-xl font-bold">{summary?.streak.longest ?? 0}</div><div className="text-xs text-muted">longest</div></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-card-light dark:bg-card-dark p-4">
            <div className="text-lg font-semibold text-accent-soft">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <div className="text-xs uppercase text-muted">Activity (last 17 weeks)</div>
        <Heatmap end={today} secondsByDate={secondsByDate} />
      </section>

      <section className="space-y-2">
        <div className="text-xs uppercase text-muted">Minutes per day (last 30 days)</div>
        <MinutesChart end={today} secondsByDate={secondsByDate} />
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Route + dashboard link**

Edit `web/src/App.tsx` — import `StatsPage` and add a protected route:
```tsx
import StatsPage from './pages/StatsPage';
```
```tsx
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <StatsPage />
              </ProtectedRoute>
            }
          />
```

Edit `web/src/pages/DashboardPage.tsx` — add a "View stats" link next to "View favorites" in the `ContinueCard`... actually the dashboard uses the `ContinueCard` component. Add the stats link to `web/src/dashboard/ContinueCard.tsx` instead, beneath the favorites link:
```tsx
      <Link to="/stats" className="text-sm text-accent-soft">View stats</Link>
```
(Place it after the existing `View favorites` link inside the same card; both can sit in a row or stacked.)

- [ ] **Step 7: Build**

Run: `cd web && npm run build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add web/src/stats web/src/pages/StatsPage.tsx web/src/App.tsx web/src/dashboard/ContinueCard.tsx
git commit -m "feat(web): stats page with calendar heatmap and minutes chart"
```

---

## Task 3: Visual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Ensure the stack runs.**

- [ ] **Step 2: API proof**

With a token that has reading history (e.g. the account used earlier), check:
```bash
curl -s "localhost:3000/stats/calendar?from=2026-01-01&to=2026-12-31" -H "authorization: Bearer $T" | python3 -m json.tool | head -30
```
Expected: an array of `{ date, secondsRead, versesRead, pagesRead, hasanat, goalMet }` for days with reading.

- [ ] **Step 3: Browser proof (Playwright)** — log in (an account with history), open `/stats`:
1. Lifetime cards show non-zero Total Hasanat / Verses / Pages / Time; streak current + longest.
2. The **heatmap** renders a grid of cells with some filled (accent) cells on active days; hovering a cell shows the date + minutes (title attr).
3. The **minutes chart** shows bars with at least one non-zero bar.
4. Screenshot the stats page (dark mode).
5. Confirm the dashboard's **View stats** link navigates here.

- [ ] **Step 4: Regression** — `cd api && npm run test:e2e` → 41 passing.

- [ ] **Step 5: Report** pass/fail with the screenshot.

---

## Self-Review Notes

- **Spec coverage (§ habit tracking — calendar + graph history):** `GET /stats/calendar` (Task 1) + heatmap & 30-day chart (Task 2) complete the "calendar + graph history" requirement; lifetime totals + streak reuse `/stats/summary`. This is the final spec item — after Phase 8 the app covers the full in-scope feature set.
- **No new dependency:** heatmap is a CSS-grid of cells; chart is flex bars — both hand-rolled, keeping the bundle lean.
- **Type consistency:** `CalendarDay` (from `useCalendar`) mirrors the service's row shape; the heatmap/chart consume a `Map<date, secondsRead>` derived in `StatsPage`. `localDate()` + `isoAddDays` define the window; the same `secondsByDate` map feeds both visualizations. The Tailwind level classes are static string literals in the `LEVELS` array so they survive the JIT purge.
- **Edge cases:** future cells in the heatmap render invisible (`opacity-0`); empty days are the lowest level; `max` in the chart is floored at 1 to avoid divide-by-zero.
```
