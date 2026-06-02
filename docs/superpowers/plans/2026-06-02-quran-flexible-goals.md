# Flexible Goals + Focus Target (Slice 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the daily streak goal be either minutes (existing) or a number of ayahs, and add an optional "focus target" — a juz or surah the user is working to finish — shown on the dashboard with a coverage progress bar (from Slice 2), separate from the streak.

**Architecture:** `UserSettings` gains `goalType` (`time`|`ayahs`) + `goalTargetAyahs`, and `focusType` (`none`|`juz`|`surah`) + `focusId`. The server resolves the active goal to `{ type, target }`; the session flow marks `goalMet` by comparing today's seconds *or* verses to the target, so the streak mechanic is unchanged otherwise. The stats summary returns `goal: { type, target }`. The web app renders the goal in the chosen unit, lets you set the goal type in Settings, set a focus target from Browse, and shows a Focus card driven by `/quran/coverage`.

**Tech Stack:** NestJS + Prisma; React 19 + @tanstack/react-query + Tailwind.

**Scope note:** Deliverable 4 (final) of `docs/superpowers/specs/2026-06-02-quran-navigation-juz-progress-design.md` (§7). Builds on Slice 2 (`/quran/coverage`, `useCoverage`) and Slice 1 (`useSurahs`). **Onboarding stays time-based** (egg/steady/beast); the goal-type choice lives in Settings — an intentional scope decision so first-run UX is untouched. The focus target is deliberately **not** part of the streak.

---

## Existing facts (grounding)

- `api/prisma/schema.prisma` `UserSettings`: `goalLevel String @default("egg")`, `goalTargetSeconds Int @default(120)`, plus theme/fontScale/readingStyle. `String`/`Int` columns (no enums).
- `api/src/settings/settings.service.ts`: `GOAL_LEVELS = { egg:120, steady:600, beast:1800 }`, `DEFAULT_GOAL_SECONDS`; `getGoalSeconds(userId)`; `publicShape(...)`; `update()` maps `goalLevel`→`goalTargetSeconds`.
- `api/src/sessions/sessions.service.ts` `record()`: computes `goalTargetSeconds = settings.getGoalSeconds(userId)`, `goalMet = dp.secondsRead >= goalTargetSeconds`; on first `goalMet` of the day advances the streak; returns `{ today, streak, goalTargetSeconds }`.
- `api/src/stats/stats.service.ts` `summary()`: returns `goalTargetSeconds` and `today.goalMet`.
- `web/src/reading/useStatsSummary.ts`: `StatsSummary` has `goalTargetSeconds: number`.
- Only two web consumers read the goal target: `web/src/pages/DashboardPage.tsx` (line ~31 `summary?.goalTargetSeconds ?? 120`) and `web/src/dashboard/StreakHero.tsx` (line 7). `StreakHero` and `MetricCards` are **not rendered anywhere** (verified by grep) but must keep compiling.
- `web/src/settings/SettingsContext.tsx`: holds `goalLevel`, `readingStyle`, etc.; hydrates from `GET /settings`; `patch(partial)` PATCHes `/settings` when hydrated.
- `web/src/pages/SettingsPage.tsx`: `LEVELS` (egg/steady/beast) rendered as a `grid grid-cols-3`.
- `web/src/quran/useCoverage.ts`: `useCoverage()` → `{ overall, juz: DimensionProgress[], surah: DimensionProgress[] }`, `DimensionProgress = { id, ayahsRead, ayahCount, percent }`.
- `web/src/pages/BrowsePage.tsx`: surah/juz rows are each a single `<button onClick=navigate>` ending in a `<ProgressRing>`.

---

## File Structure

**Modify**
- `api/prisma/schema.prisma` — 4 new `UserSettings` columns (+ migration).
- `api/src/settings/dto/update-settings.dto.ts` — validate the new fields.
- `api/src/settings/settings.service.ts` — `publicShape` + `getGoal()`; drop `getGoalSeconds`.
- `api/src/sessions/sessions.service.ts` — goalMet by goal type; return `goal`.
- `api/src/stats/stats.service.ts` — summary returns `goal`.
- `web/src/reading/useStatsSummary.ts` — `goal` replaces `goalTargetSeconds`.
- `web/src/settings/SettingsContext.tsx` — new state/setters/hydration/patch.
- `web/src/pages/DashboardPage.tsx` — goal in chosen unit + `<FocusCard/>`.
- `web/src/dashboard/StreakHero.tsx` — compile against new `goal` shape.
- `web/src/pages/SettingsPage.tsx` — goal-type toggle + ayah stepper.
- `web/src/pages/BrowsePage.tsx` — per-row "set as focus" toggle.

**Create**
- `web/src/dashboard/FocusCard.tsx` — dashboard focus target + coverage bar.

---

## Task 1: Schema — flexible-goal + focus columns

**Files:** Modify `api/prisma/schema.prisma`

- [ ] **Step 1: Add columns**

In `api/prisma/schema.prisma`, in `model UserSettings`, after the `goalTargetSeconds` line add:
```prisma
  goalType          String   @default("time")  // time | ayahs
  goalTargetAyahs   Int      @default(10)
  focusType         String   @default("none")  // none | juz | surah
  focusId           Int?
```

- [ ] **Step 2: Migrate**

From `api/`: `npx prisma migrate dev --name add_flexible_goals`
Expected: a new migration folder + `Your database is now in sync with your schema.` + client regenerated. If it reports DRIFT or cannot connect, STOP and report BLOCKED — do NOT run `migrate reset`.

- [ ] **Step 3: Confirm client**

From `api/`: `npx prisma generate` then `npx tsc --noEmit -p tsconfig.json` → no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat(api): add flexible-goal + focus columns to UserSettings"
```

---

## Task 2: Settings DTO + service (getGoal)

**Files:** Modify `api/src/settings/dto/update-settings.dto.ts`, `api/src/settings/settings.service.ts`

- [ ] **Step 1: DTO**

Replace the contents of `api/src/settings/dto/update-settings.dto.ts` with:
```ts
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsBoolean() onboarded?: boolean;
  @IsOptional() @IsIn(['egg', 'steady', 'beast']) goalLevel?: string;
  @IsOptional() @IsIn(['time', 'ayahs']) goalType?: string;
  @IsOptional() @IsInt() @Min(1) goalTargetAyahs?: number;
  @IsOptional() @IsIn(['none', 'juz', 'surah']) focusType?: string;
  @IsOptional() @IsInt() @Min(1) focusId?: number;
  @IsOptional() @IsInt() preferredReciterId?: number;
  @IsOptional() @IsIn(['light', 'dark']) theme?: string;
  @IsOptional() @IsNumber() @Min(0.8) @Max(1.8) fontScale?: number;
  @IsOptional() @IsIn(['mushaf', 'tajweed', 'ayah']) readingStyle?: string;
}
```

- [ ] **Step 2: Service — publicShape + getGoal**

In `api/src/settings/settings.service.ts`:

(a) Add a constant after `export const DEFAULT_GOAL_SECONDS = GOAL_LEVELS.egg;`:
```ts
export const DEFAULT_GOAL_AYAHS = 10;
```

(b) Replace the `publicShape` method with one that includes the new fields:
```ts
  private publicShape(s: {
    onboarded: boolean; goalLevel: string; goalTargetSeconds: number; goalType: string; goalTargetAyahs: number;
    focusType: string; focusId: number | null; preferredReciterId: number; theme: string; fontScale: number; readingStyle: string;
  }) {
    return {
      onboarded: s.onboarded,
      goalLevel: s.goalLevel,
      goalTargetSeconds: s.goalTargetSeconds,
      goalType: s.goalType,
      goalTargetAyahs: s.goalTargetAyahs,
      focusType: s.focusType,
      focusId: s.focusId,
      preferredReciterId: s.preferredReciterId,
      theme: s.theme,
      fontScale: s.fontScale,
      readingStyle: s.readingStyle,
    };
  }
```

(c) Replace the `getGoalSeconds` method with `getGoal`:
```ts
  async getGoal(userId: string): Promise<{ type: 'time' | 'ayahs'; target: number }> {
    const row = await this.prisma.userSettings.findUnique({ where: { userId } });
    const type = row?.goalType === 'ayahs' ? 'ayahs' : 'time';
    const target = type === 'ayahs' ? (row?.goalTargetAyahs ?? DEFAULT_GOAL_AYAHS) : (row?.goalTargetSeconds ?? DEFAULT_GOAL_SECONDS);
    return { type, target };
  }
```
(Leave `update()` unchanged — it already spreads the DTO and maps `goalLevel`→`goalTargetSeconds`; the new fields pass straight through.)

- [ ] **Step 3: Build**

From `api/`: `npm run build`
Expected: FAILS — `getGoalSeconds` no longer exists but is still called in `sessions.service.ts` and `stats.service.ts`. That's expected; Task 3 fixes the callers. (Do not re-add `getGoalSeconds`.)

- [ ] **Step 4: Commit** (commit together with Task 3 — skip committing now; proceed directly to Task 3 so the build is green before committing.)

---

## Task 3: Goal-met by type (sessions) + summary returns goal (stats)

**Files:** Modify `api/src/sessions/sessions.service.ts`, `api/src/stats/stats.service.ts`

- [ ] **Step 1: sessions.service**

In `api/src/sessions/sessions.service.ts`, replace:
```ts
    const goalTargetSeconds = await this.settings.getGoalSeconds(userId);
    const goalMet = dp.secondsRead >= goalTargetSeconds;
```
with:
```ts
    const goal = await this.settings.getGoal(userId);
    const goalCurrent = goal.type === 'ayahs' ? dp.versesRead : dp.secondsRead;
    const goalMet = goalCurrent >= goal.target;
```
Then in the `return { ... }` at the end of `record()`, replace the trailing `goalTargetSeconds,` line with:
```ts
      goal,
```

- [ ] **Step 2: stats.service**

In `api/src/stats/stats.service.ts`, in `summary()`, replace:
```ts
    const goalTargetSeconds = await this.settings.getGoalSeconds(userId);
```
with:
```ts
    const goal = await this.settings.getGoal(userId);
```
and in that method's `return { ... }`, replace the `goalTargetSeconds,` line with:
```ts
      goal,
```

- [ ] **Step 3: Build**

From `api/`: `npm run build`
Expected: clean (no more `getGoalSeconds` references).

- [ ] **Step 4: Integration check** (dev API on :3000, recompiled)

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"vt@test.dev","password":"Test1234!"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).accessToken))")
curl -s "http://localhost:3000/stats/summary?date=2026-06-02" -H "Authorization: Bearer $TOKEN" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('goal',j.goal,'todayVerses',j.today.versesRead,'goalMet',j.today.goalMet);})"
```
Expected: `goal { type: 'time', target: 120 }` (existing test user defaults), plus today's numbers. If the server isn't running, rely on the clean `npm run build`.

- [ ] **Step 5: Commit** (Tasks 2 + 3 together)

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add api/src/settings/dto/update-settings.dto.ts api/src/settings/settings.service.ts api/src/sessions/sessions.service.ts api/src/stats/stats.service.ts
git commit -m "feat(api): resolve daily goal by type (time|ayahs); summary returns goal"
```

---

## Task 4: Web settings context — goal type + focus

**Files:** Modify `web/src/settings/SettingsContext.tsx`

- [ ] **Step 1: Types + state**

In `web/src/settings/SettingsContext.tsx`:

(a) After `export type ReadingStyle = 'mushaf' | 'tajweed' | 'ayah';` add:
```ts
export type GoalType = 'time' | 'ayahs';
export type FocusType = 'none' | 'juz' | 'surah';
```

(b) In the `SettingsValue` type, after the `setReadingStyle` line, add:
```ts
  goalType: GoalType;
  setGoalType: (t: GoalType) => void;
  goalTargetAyahs: number;
  setGoalTargetAyahs: (n: number) => void;
  focusType: FocusType;
  focusId: number | null;
  setFocus: (type: FocusType, id: number | null) => void;
```

(c) Inside `SettingsProvider`, after the `readingStyle` state line, add:
```ts
  const [goalType, setGoalTypeState] = useState<GoalType>('time');
  const [goalTargetAyahs, setGoalTargetAyahsState] = useState<number>(10);
  const [focusType, setFocusTypeState] = useState<FocusType>('none');
  const [focusId, setFocusIdState] = useState<number | null>(null);
```

(d) In the server-hydration `.then(({ data }) => { ... })` block, after `if (data.readingStyle) setReadingStyleState(data.readingStyle);`, add:
```ts
      if (data.goalType) setGoalTypeState(data.goalType);
      if (typeof data.goalTargetAyahs === 'number') setGoalTargetAyahsState(data.goalTargetAyahs);
      if (data.focusType) setFocusTypeState(data.focusType);
      setFocusIdState(data.focusId ?? null);
```

(e) After the existing `function setReadingStyle(...) { ... }`, add:
```ts
  function setGoalType(t: GoalType) { setGoalTypeState(t); patch({ goalType: t }); }
  function setGoalTargetAyahs(n: number) { const v = Math.max(1, Math.round(n)); setGoalTargetAyahsState(v); patch({ goalTargetAyahs: v }); }
  function setFocus(type: FocusType, id: number | null) {
    setFocusTypeState(type);
    setFocusIdState(type === 'none' ? null : id);
    patch(type === 'none' ? { focusType: 'none' } : { focusType: type, focusId: id });
  }
```

(f) In the `<SettingsContext.Provider value={{ ... }}>`, add to the value object (before `onboarded`):
```ts
goalType, setGoalType, goalTargetAyahs, setGoalTargetAyahs, focusType, focusId, setFocus,
```

- [ ] **Step 2: Type-check**

From `web/`: `npx tsc --noEmit`
Expected: FAILS only in `useStatsSummary.ts`/`DashboardPage.tsx`/`StreakHero.tsx` if at all (those are Task 5). The context file itself must have no errors — if the errors are only the goal-target consumers, proceed to Task 5; if there are errors inside `SettingsContext.tsx`, fix them before continuing.

- [ ] **Step 3: Commit** (with Task 5 — proceed to Task 5 to reach a green tsc before committing.)

---

## Task 5: Summary type + dashboard goal display + StreakHero

**Files:** Modify `web/src/reading/useStatsSummary.ts`, `web/src/pages/DashboardPage.tsx`, `web/src/dashboard/StreakHero.tsx`

- [ ] **Step 1: Summary type**

In `web/src/reading/useStatsSummary.ts`, in the `StatsSummary` type, replace:
```ts
  goalTargetSeconds: number;
```
with:
```ts
  goal: { type: 'time' | 'ayahs'; target: number };
```

- [ ] **Step 2: Dashboard goal logic + display**

In `web/src/pages/DashboardPage.tsx`:

Replace:
```tsx
  const goal = summary?.goalTargetSeconds ?? 120;
  const secs = t?.secondsRead ?? 0;
  const pct = Math.min(100, Math.round((secs / goal) * 100));
```
with:
```tsx
  const goal = summary?.goal ?? { type: 'time' as const, target: 120 };
  const secs = t?.secondsRead ?? 0;
  const goalCurrent = goal.type === 'ayahs' ? (t?.versesRead ?? 0) : secs;
  const pct = Math.min(100, Math.round((goalCurrent / goal.target) * 100));
  const goalCurrentLabel = goal.type === 'ayahs' ? String(goalCurrent) : formatDuration(goalCurrent);
  const goalTargetLabel = goal.type === 'ayahs' ? `${goal.target} ayahs` : formatDuration(goal.target);
```

Then replace the goal value row:
```tsx
          <div className="mt-5 flex items-end gap-3">
            <span className="font-display text-5xl leading-none">{formatDuration(secs)}</span>
            <span className="text-muted mb-1">/ {formatDuration(goal)}</span>
            {t?.goalMet && <span className="mb-1 text-sm text-accent-soft">complete ✓</span>}
          </div>
```
with:
```tsx
          <div className="mt-5 flex items-end gap-3">
            <span className="font-display text-5xl leading-none">{goalCurrentLabel}</span>
            <span className="text-muted mb-1">/ {goalTargetLabel}</span>
            {t?.goalMet && <span className="mb-1 text-sm text-accent-soft">complete ✓</span>}
          </div>
```

Add the FocusCard import after `import { KhatmBar } from '../dashboard/KhatmBar';`:
```tsx
import { FocusCard } from '../dashboard/FocusCard';
```
And render it in the grid — immediately AFTER the Qur'an-completion `</section>` (the `KhatmBar` section), add:
```tsx
        <FocusCard />
```

- [ ] **Step 3: StreakHero (keep it compiling)**

In `web/src/dashboard/StreakHero.tsx`, replace:
```tsx
  const secs = summary?.today.secondsRead ?? 0;
  const goal = summary?.goalTargetSeconds ?? 120;
  const pct = Math.min(100, Math.round((secs / goal) * 100));
```
with:
```tsx
  const goal = summary?.goal ?? { type: 'time' as const, target: 120 };
  const secs = summary?.today.secondsRead ?? 0;
  const current = goal.type === 'ayahs' ? (summary?.today.versesRead ?? 0) : secs;
  const pct = Math.min(100, Math.round((current / goal.target) * 100));
  const currentLabel = goal.type === 'ayahs' ? String(current) : formatDuration(current);
  const targetLabel = goal.type === 'ayahs' ? `${goal.target} ayahs` : formatDuration(goal.target);
```
and replace the line that renders `{formatDuration(secs)} / {formatDuration(goal)}`:
```tsx
        <span>{formatDuration(secs)} / {formatDuration(goal)}</span>
```
with:
```tsx
        <span>{currentLabel} / {targetLabel}</span>
```

- [ ] **Step 4: Type-check (after Task 6 creates FocusCard, this is fully green; for now the only remaining error should be the missing `./FocusCard` import)**

From `web/`: `npx tsc --noEmit`
Expected: the ONLY error is `Cannot find module '../dashboard/FocusCard'` (created in Task 6). All goal-target type errors are resolved. If other errors remain, fix them.

- [ ] **Step 5: Commit** (with Tasks 4 + 6 — proceed to Task 6, then commit the web bundle once tsc is fully clean.)

---

## Task 6: FocusCard + Settings goal-type UI

**Files:** Create `web/src/dashboard/FocusCard.tsx`; Modify `web/src/pages/SettingsPage.tsx`

- [ ] **Step 1: FocusCard**

Create `web/src/dashboard/FocusCard.tsx`:
```tsx
import { useCoverage } from '../quran/useCoverage';
import { useSurahs } from '../quran/useQuranMeta';
import { useSettings } from '../settings/useSettings';

export function FocusCard() {
  const { focusType, focusId, setFocus } = useSettings();
  const { data: coverage } = useCoverage();
  const { data: surahs } = useSurahs();
  if (focusType === 'none' || focusId == null) return null;

  const dim = focusType === 'juz' ? coverage?.juz : coverage?.surah;
  const c = dim?.find((d) => d.id === focusId);
  const name = focusType === 'juz' ? `Juz ${focusId}` : surahs?.find((s) => s.id === focusId)?.name ?? `Surah ${focusId}`;
  const percent = c?.percent ?? 0;
  const left = c ? Math.max(0, c.ayahCount - c.ayahsRead) : 0;

  return (
    <section className="lg:col-span-12 rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.14em] text-muted">Focus</span>
        <button onClick={() => setFocus('none', null)} className="text-xs text-muted hover:text-ink dark:hover:text-ink-dark transition">Clear</button>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="font-display text-2xl">Finish {name}</span>
        <span className="text-sm text-muted">{percent}% · {left} ayah{left === 1 ? '' : 's'} left</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-light dark:bg-surface-dark">
        <div className="h-full rounded-full bg-accent-soft transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Settings goal-type toggle + ayah stepper**

In `web/src/pages/SettingsPage.tsx`:

(a) Destructure the new settings — change the `useSettings()` destructure to also include `goalType, setGoalType, goalTargetAyahs, setGoalTargetAyahs`:
```tsx
  const { goalLevel, setGoalLevel, goalType, setGoalType, goalTargetAyahs, setGoalTargetAyahs, reciterId, setReciterId, theme, toggleTheme, fontScale, setFontScale, readingStyle, setReadingStyle } = useSettings();
```

(b) Replace the entire "Daily goal" `<section>` (the one whose header is `Daily goal` and which maps `LEVELS`) with:
```tsx
        <section className="rounded-3xl bg-card-light dark:bg-card-dark border border-line-light dark:border-line-dark shadow-soft p-7">
          <div className="text-xs uppercase tracking-[0.14em] text-muted mb-4">Daily goal</div>
          <div className="mb-4 inline-flex gap-1 rounded-2xl bg-surface-light dark:bg-surface-dark p-1">
            {(['time', 'ayahs'] as const).map((gt) => (
              <button
                key={gt}
                onClick={() => setGoalType(gt)}
                className={'rounded-xl px-4 py-2 text-sm transition ' + (goalType === gt ? 'bg-accent text-white' : 'text-muted hover:text-ink dark:hover:text-ink-dark')}
              >
                {gt === 'time' ? 'Time' : 'Ayahs'}
              </button>
            ))}
          </div>

          {goalType === 'time' ? (
            <div className="grid grid-cols-3 gap-3">
              {LEVELS.map((l) => {
                const selected = goalLevel === l.key;
                return (
                  <button
                    key={l.key}
                    onClick={() => setGoalLevel(l.key)}
                    className={
                      'rounded-2xl p-4 text-center border transition ' +
                      (selected
                        ? 'bg-accent text-white border-accent'
                        : 'bg-surface-light dark:bg-surface-dark border-line-light dark:border-line-dark hover:border-accent-soft')
                    }
                  >
                    <div className="text-sm font-medium">{l.name}</div>
                    <div className={'text-xs mt-0.5 ' + (selected ? 'opacity-80' : 'text-muted')}>{l.secs}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <button
                onClick={() => setGoalTargetAyahs(goalTargetAyahs - 1)}
                className="h-9 w-9 grid place-items-center rounded-xl border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark text-muted hover:border-accent-soft transition"
                aria-label="Fewer ayahs"
              >
                −
              </button>
              <span className="font-display text-lg w-24 text-center">{goalTargetAyahs} ayah{goalTargetAyahs === 1 ? '' : 's'}</span>
              <button
                onClick={() => setGoalTargetAyahs(goalTargetAyahs + 1)}
                className="h-9 w-9 grid place-items-center rounded-xl border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark text-lg hover:border-accent-soft transition"
                aria-label="More ayahs"
              >
                +
              </button>
            </div>
          )}
        </section>
```

- [ ] **Step 3: Type-check**

From `web/`: `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit** (Tasks 4 + 5 + 6 together — the web bundle is now green)

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add web/src/settings/SettingsContext.tsx web/src/reading/useStatsSummary.ts web/src/pages/DashboardPage.tsx web/src/dashboard/StreakHero.tsx web/src/dashboard/FocusCard.tsx web/src/pages/SettingsPage.tsx
git commit -m "feat(web): goal by time or ayahs; dashboard focus card + settings goal type"
```

---

## Task 7: Set a focus target from Browse

**Files:** Modify `web/src/pages/BrowsePage.tsx`

Context: each surah/juz row is currently a single `<button onClick=navigate>` ending in `<ProgressRing>`. A focus toggle can't be nested inside that button (invalid HTML), so the row becomes a flex container with a navigation button + the ring + a focus toggle button.

- [ ] **Step 1: Wire settings + restructure rows**

In `web/src/pages/BrowsePage.tsx`:

(a) Add to imports:
```tsx
import { useSettings } from '../settings/useSettings';
```

(b) Inside the component, after the `const [tab, setTab] = useState<Tab>('surah');` line, add:
```tsx
  const { focusType, focusId, setFocus } = useSettings();
  const isFocus = (type: 'juz' | 'surah', id: number) => focusType === type && focusId === id;
  const toggleFocus = (type: 'juz' | 'surah', id: number) => setFocus(isFocus(type, id) ? 'none' : type, id);
  const focusBtn = (active: boolean) =>
    'shrink-0 grid h-8 w-8 place-items-center rounded-full border transition ' +
    (active ? 'border-accent-soft text-accent-soft' : 'border-line-light dark:border-line-dark text-muted hover:border-accent-soft');
```

(c) Change the `row` constant from a button style to a container style:
```tsx
  const row = 'flex items-center gap-3 w-full rounded-2xl border border-line-light dark:border-line-dark bg-card-light dark:bg-card-dark px-4 py-3 hover:border-accent-soft transition';
  const nav = 'flex items-center gap-4 flex-1 min-w-0 text-left';
```

(d) Replace the surah row markup:
```tsx
            <button key={s.id} onClick={() => navigate(`/read/page/${pageForSurah(surahs, s.id)}`)} className={row}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-sm text-accent-soft">{s.id}</span>
              <span className="flex-1">
                <span className="block font-medium">{s.name}</span>
                <span className="block text-xs text-muted">{s.ayahCount} ayahs · {s.revelation === 'meccan' ? 'Meccan' : 'Medinan'}</span>
              </span>
              <span className="font-quran text-xl">{s.arabicName}</span>
              <ProgressRing percent={surahPct.get(s.id) ?? 0} />
            </button>
```
with:
```tsx
            <div key={s.id} className={row}>
              <button onClick={() => navigate(`/read/page/${pageForSurah(surahs, s.id)}`)} className={nav}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-sm text-accent-soft">{s.id}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{s.name}</span>
                  <span className="block text-xs text-muted">{s.ayahCount} ayahs · {s.revelation === 'meccan' ? 'Meccan' : 'Medinan'}</span>
                </span>
                <span className="font-quran text-xl">{s.arabicName}</span>
              </button>
              <ProgressRing percent={surahPct.get(s.id) ?? 0} />
              <button onClick={() => toggleFocus('surah', s.id)} className={focusBtn(isFocus('surah', s.id))} aria-label="Set as focus" title="Set as focus">◎</button>
            </div>
```

(e) Replace the juz row markup:
```tsx
            <button key={j.juz} onClick={() => navigate(`/read/page/${pageForJuz(juz, j.juz)}`)} className={row}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-sm text-accent-soft">{j.juz}</span>
              <span className="flex-1">
                <span className="block font-medium">Juz {j.juz}</span>
                <span className="block text-xs text-muted">starts {j.startSurah}:{j.startAyah} · {j.ayahCount} ayahs</span>
              </span>
              <span className="text-xs text-muted">p.{j.startPage}</span>
              <ProgressRing percent={juzPct.get(j.juz) ?? 0} />
            </button>
```
with:
```tsx
            <div key={j.juz} className={row}>
              <button onClick={() => navigate(`/read/page/${pageForJuz(juz, j.juz)}`)} className={nav}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-sm text-accent-soft">{j.juz}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Juz {j.juz}</span>
                  <span className="block text-xs text-muted">starts {j.startSurah}:{j.startAyah} · {j.ayahCount} ayahs</span>
                </span>
                <span className="text-xs text-muted">p.{j.startPage}</span>
              </button>
              <ProgressRing percent={juzPct.get(j.juz) ?? 0} />
              <button onClick={() => toggleFocus('juz', j.juz)} className={focusBtn(isFocus('juz', j.juz))} aria-label="Set as focus" title="Set as focus">◎</button>
            </div>
```

- [ ] **Step 2: Type-check + tests**

From `web/`: `npx tsc --noEmit` (clean) and `npx vitest run` (existing tests pass).

- [ ] **Step 3: Commit**

```bash
cd /Users/abrorkhamidov/Desktop/quran-app
git add web/src/pages/BrowsePage.tsx
git commit -m "feat(web): set a juz/surah focus target from Browse"
```

---

## Final verification

- [ ] **Builds/tests**: `api/` `npm run build` clean; `web/` `npx tsc --noEmit` clean + `npx vitest run` passing; scripts vitest passing.
- [ ] **API**: `GET /stats/summary` returns `goal: { type, target }`. With `goalType:'ayahs'` set via `PATCH /settings`, recording a session marks `goalMet` once `versesRead >= target`.
- [ ] **Manual smoke** (dev app, logged in):
  - Settings → Daily goal: toggle **Time/Ayahs**; in Ayahs mode the stepper sets N; the dashboard goal then reads `X / N ayahs` and the bar fills by verses read.
  - Switch back to Time: dashboard reads `mm:ss-style / target` again.
  - Browse: tap the ◎ on a juz/surah row → it highlights; the dashboard shows a **Focus** card "Finish Juz N / <Surah>" with a coverage bar and "K ayahs left"; tapping ◎ again (or Clear) removes it.
  - Reading a page still advances coverage so the focus bar moves.

---

## Self-review notes (addressed)

- **Spec coverage (§7):** `goalType time|ayahs` + `goalTargetAyahs` ✓ (Tasks 1–6); goalMet by type drives the streak unchanged ✓ (Task 3); focus target (`focusType`/`focusId`) settable from Browse ✓ (Task 7) with a dashboard coverage bar that is **not** part of the streak ✓ (Task 6 FocusCard).
- **Streak safety:** the only change to the streak path is *which* daily metric is compared to *which* target; the "first goalMet of the day advances streak" logic is untouched.
- **Build ordering:** Task 2 intentionally leaves the API non-building (removed `getGoalSeconds`); Task 3 restores green before the shared commit. Tasks 4–6 are committed together so the web bundle never commits in a non-compiling state (Task 5 references `FocusCard`, created in Task 6).
- **Onboarding untouched:** new users default `goalType:'time'`, so the existing egg/steady/beast onboarding keeps working; ayahs is opt-in via Settings.
- **Invalid-nesting avoided:** Browse rows become a flex `div` (nav button + ring + focus button) rather than nesting a button inside a button.
- **Type consistency:** `goal: { type, target }` shape identical on API (`getGoal`) and web (`StatsSummary`); `GoalType`/`FocusType` defined once in `SettingsContext`; `setFocus('none', null)` sends only `{ focusType:'none' }` to satisfy the `@IsInt` `focusId` validator.
