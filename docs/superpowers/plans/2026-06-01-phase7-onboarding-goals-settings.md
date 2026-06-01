# Phase 7: Onboarding + Goals + Settings Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pick a daily goal (time-based level) during a first-run onboarding, change goal/reciter/theme/font in a settings screen, and persist those per-user on the backend (synced across devices) — replacing the hardcoded `DEFAULT_GOAL_SECONDS`.

**Architecture:** A `UserSettings` row per user (lazily created) holds `onboarded`, `goalLevel`+`goalTargetSeconds`, `preferredReciterId`, `theme`, `fontScale`. `GET/PATCH /settings` expose it; a `SettingsService` derives `goalTargetSeconds` from the level and is the single source the sessions/stats services read for each user's goal. On the client, the existing `SettingsProvider` moves inside `AuthProvider`, hydrates from the server on login, and write-through-PATCHes on every change. A `ProtectedRoute` onboarding gate routes un-onboarded users to a goal-picker; a settings screen edits everything.

**Tech Stack:** NestJS + Prisma 7, Jest + supertest; React + Vite + Tailwind v3 (Quiet Slate), TanStack Query, react-router-dom.

**Builds on:** Phase 5 (`SessionsService`/`StatsService` goal logic), Phase 4 (`SettingsProvider` with theme/font/reciter), Phase 6 (dashboard). Commit directly to `main`; push after verification.

**Goal levels:** `egg` = 120s ("Break the Egg", 2 min), `steady` = 600s ("Steady", 10 min), `beast` = 1800s ("Beast Mode", 30 min). Default `egg` (keeps existing 120s behavior + tests valid).

---

## File Structure

```
api/src/settings/
├── settings.module.ts                 # exports SettingsService
├── settings.service.ts                # getOrCreate, getGoalSeconds, update; GOAL_LEVELS, DEFAULT_GOAL_SECONDS
├── settings.controller.ts             # GET/PATCH /settings
└── dto/update-settings.dto.ts
api/src/sessions/sessions.service.ts   # (modified) read goal via SettingsService
api/src/sessions/sessions.module.ts    # (modified) import SettingsModule
api/src/stats/stats.service.ts         # (modified) read goal via SettingsService
api/src/stats/stats.module.ts          # (modified) import SettingsModule
api/prisma/schema.prisma               # + UserSettings
web/src/settings/SettingsContext.tsx   # (modified) auth-aware hydrate + sync + goal + onboarded
web/src/main.tsx, web/src/App.tsx      # (modified) move SettingsProvider inside AuthProvider
web/src/auth/ProtectedRoute.tsx        # (modified) onboarding gate
web/src/pages/OnboardingPage.tsx       # goal picker
web/src/pages/SettingsPage.tsx         # edit goal/reciter/theme/font
web/src/pages/DashboardPage.tsx        # (modified) settings link
```

---

## Task 1: UserSettings model + migration

**Files:** Modify `api/prisma/schema.prisma`

- [ ] **Step 1: Append the model**

Append to `api/prisma/schema.prisma`:
```prisma
model UserSettings {
  userId            String   @id
  onboarded         Boolean  @default(false)
  goalLevel         String   @default("egg")   // egg | steady | beast
  goalTargetSeconds Int      @default(120)
  preferredReciterId Int     @default(7)
  theme             String   @default("light") // light | dark
  fontScale         Float    @default(1)
  updatedAt         DateTime @updatedAt
}
```

- [ ] **Step 2: Migrate + verify**

Run: `cd api && npx prisma migrate dev --name add_user_settings`
Then: `docker compose exec -T db psql -U quran -d quran -c '\dt'`
Expected: `UserSettings` present.

- [ ] **Step 3: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat(api): add UserSettings model"
```

---

## Task 2: SettingsService + endpoints + per-user goal wiring (TDD e2e)

**Files:** Create `api/src/settings/settings.service.ts`, `settings.controller.ts`, `settings.module.ts`, `dto/update-settings.dto.ts`, `api/test/settings.e2e-spec.ts`; modify `api/src/sessions/sessions.service.ts`, `api/src/sessions/sessions.module.ts`, `api/src/stats/stats.service.ts`, `api/src/stats/stats.module.ts`, `api/src/app.module.ts`.

- [ ] **Step 1: Write the e2e (failing)**

Create `api/test/settings.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Settings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const email = `set${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = app.get(PrismaService);
    await app.init();
    const reg = await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password123', name: 'Set' });
    token = reg.body.accessToken;
    userId = reg.body.user.id;
  });

  afterAll(async () => {
    await prisma.userSettings.deleteMany({ where: { userId } });
    await prisma.dailyProgress.deleteMany({ where: { userId } });
    await prisma.readingSession.deleteMany({ where: { userId } });
    await prisma.streak.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('requires auth', async () => {
    await request(app.getHttpServer()).get('/settings').expect(401);
  });

  it('returns defaults for a new user', async () => {
    const res = await request(app.getHttpServer()).get('/settings').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toMatchObject({ onboarded: false, goalLevel: 'egg', goalTargetSeconds: 120, preferredReciterId: 7, theme: 'light', fontScale: 1 });
  });

  it('updates goal level (derives seconds) and onboarded', async () => {
    const res = await request(app.getHttpServer()).patch('/settings').set('Authorization', `Bearer ${token}`).send({ goalLevel: 'beast', onboarded: true }).expect(200);
    expect(res.body.goalLevel).toBe('beast');
    expect(res.body.goalTargetSeconds).toBe(1800);
    expect(res.body.onboarded).toBe(true);
  });

  it('updates theme, fontScale, reciter', async () => {
    const res = await request(app.getHttpServer()).patch('/settings').set('Authorization', `Bearer ${token}`).send({ theme: 'dark', fontScale: 1.4, preferredReciterId: 2 }).expect(200);
    expect(res.body).toMatchObject({ theme: 'dark', fontScale: 1.4, preferredReciterId: 2, goalLevel: 'beast' });
  });

  it('rejects an invalid goal level', async () => {
    await request(app.getHttpServer()).patch('/settings').set('Authorization', `Bearer ${token}`).send({ goalLevel: 'turbo' }).expect(400);
  });

  it('applies the per-user goal to session goalMet (beast=1800 → 130s not met)', async () => {
    const res = await request(app.getHttpServer()).post('/reading-sessions').set('Authorization', `Bearer ${token}`).send({ date: '2026-07-01', durationSeconds: 130, pages: [1] }).expect(201);
    expect(res.body.goalTargetSeconds).toBe(1800);
    expect(res.body.today.goalMet).toBe(false);
  });
});
```

- [ ] **Step 2: Run — confirm fail.** `cd api && npm run test:e2e -- settings` → FAIL.

- [ ] **Step 3: DTO**

Create `api/src/settings/dto/update-settings.dto.ts`:
```ts
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsBoolean() onboarded?: boolean;
  @IsOptional() @IsIn(['egg', 'steady', 'beast']) goalLevel?: string;
  @IsOptional() @IsInt() preferredReciterId?: number;
  @IsOptional() @IsIn(['light', 'dark']) theme?: string;
  @IsOptional() @IsNumber() @Min(0.8) @Max(1.8) fontScale?: number;
}
```

- [ ] **Step 4: Service**

Create `api/src/settings/settings.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

export const GOAL_LEVELS: Record<string, number> = { egg: 120, steady: 600, beast: 1800 };
export const DEFAULT_GOAL_SECONDS = GOAL_LEVELS.egg;

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  private publicShape(s: { onboarded: boolean; goalLevel: string; goalTargetSeconds: number; preferredReciterId: number; theme: string; fontScale: number }) {
    return {
      onboarded: s.onboarded,
      goalLevel: s.goalLevel,
      goalTargetSeconds: s.goalTargetSeconds,
      preferredReciterId: s.preferredReciterId,
      theme: s.theme,
      fontScale: s.fontScale,
    };
  }

  async getOrCreate(userId: string) {
    const row = await this.prisma.userSettings.upsert({ where: { userId }, create: { userId }, update: {} });
    return this.publicShape(row);
  }

  async getGoalSeconds(userId: string): Promise<number> {
    const row = await this.prisma.userSettings.findUnique({ where: { userId } });
    return row?.goalTargetSeconds ?? DEFAULT_GOAL_SECONDS;
  }

  async update(userId: string, dto: UpdateSettingsDto) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.goalLevel) data.goalTargetSeconds = GOAL_LEVELS[dto.goalLevel];
    const row = await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.publicShape(row);
  }
}
```

- [ ] **Step 5: Controller + module**

Create `api/src/settings/settings.controller.ts`:
```ts
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get()
  get(@CurrentUser() user: { id: string }) {
    return this.settings.getOrCreate(user.id);
  }

  @Patch()
  update(@CurrentUser() user: { id: string }, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(user.id, dto);
  }
}
```

Create `api/src/settings/settings.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
```
Edit `api/src/app.module.ts` — add `SettingsModule` to imports.

- [ ] **Step 6: Wire per-user goal into SessionsService**

Edit `api/src/sessions/sessions.service.ts`:
- Remove `export const DEFAULT_GOAL_SECONDS = 120;`.
- Inject `SettingsService` (add to constructor: `private settings: SettingsService`).
- Replace `const goalMet = dp.secondsRead >= DEFAULT_GOAL_SECONDS;` with:
```ts
    const goalTargetSeconds = await this.settings.getGoalSeconds(userId);
    const goalMet = dp.secondsRead >= goalTargetSeconds;
```
- In the returned object, replace `goalTargetSeconds: DEFAULT_GOAL_SECONDS` with `goalTargetSeconds`.
- Add the import: `import { SettingsService } from '../settings/settings.service';`

Edit `api/src/sessions/sessions.module.ts` — import `SettingsModule` and add it to `imports: [...]`:
```ts
import { SettingsModule } from '../settings/settings.module';
```

- [ ] **Step 7: Wire per-user goal into StatsService**

Edit `api/src/stats/stats.service.ts`:
- Replace `import { DEFAULT_GOAL_SECONDS } from '../sessions/sessions.service';` with `import { SettingsService } from '../settings/settings.service';`
- Inject `SettingsService` in the constructor.
- In `summary()`, set `goalTargetSeconds` via `await this.settings.getGoalSeconds(userId)` instead of the constant.

Edit `api/src/stats/stats.module.ts` — import `SettingsModule` and add to `imports`.

- [ ] **Step 8: Run e2e — green.** `cd api && npm run test:e2e -- settings` → PASS (6). Then full suite `cd api && npm run test:e2e` → expect 37 passing (31 + 6 new). The existing sessions/stats suites must still pass (fresh users have no UserSettings row → `getGoalSeconds` returns the 120 default → 130s still meets goal).

- [ ] **Step 9: Commit**

```bash
git add api/src/settings api/src/sessions api/src/stats api/src/app.module.ts api/test/settings.e2e-spec.ts
git commit -m "feat(api): per-user settings with configurable goal wired into sessions/stats"
```

---

## Task 3: Client settings — auth-aware sync + goal + onboarded

**Files:** Modify `web/src/settings/SettingsContext.tsx`, `web/src/main.tsx`, `web/src/App.tsx`.

- [ ] **Step 1: Replace SettingsContext**

Replace `web/src/settings/SettingsContext.tsx`:
```tsx
import { createContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import api from '../lib/api';
import { useAuth } from '../auth/useAuth';

type Theme = 'light' | 'dark';
export type GoalLevel = 'egg' | 'steady' | 'beast';
export const GOAL_SECONDS: Record<GoalLevel, number> = { egg: 120, steady: 600, beast: 1800 };

type SettingsValue = {
  theme: Theme;
  toggleTheme: () => void;
  fontScale: number;
  setFontScale: (n: number) => void;
  reciterId: number;
  setReciterId: (id: number) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (n: number) => void;
  goalLevel: GoalLevel;
  setGoalLevel: (l: GoalLevel) => void;
  onboarded: boolean;
  completeOnboarding: (l: GoalLevel) => void;
  settingsLoaded: boolean;
};

export const SettingsContext = createContext<SettingsValue | null>(null);

const MIN_SCALE = 0.8;
const MAX_SCALE = 1.8;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [fontScale, setFontScaleState] = useState<number>(() => Number(localStorage.getItem('fontScale')) || 1);
  const [reciterId, setReciterIdState] = useState<number>(() => Number(localStorage.getItem('reciterId')) || 7);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(() => Number(localStorage.getItem('playbackSpeed')) || 1);
  const [goalLevel, setGoalLevelState] = useState<GoalLevel>('egg');
  const [onboarded, setOnboardedState] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  useEffect(() => { localStorage.setItem('fontScale', String(fontScale)); }, [fontScale]);
  useEffect(() => { localStorage.setItem('reciterId', String(reciterId)); }, [reciterId]);
  useEffect(() => { localStorage.setItem('playbackSpeed', String(playbackSpeed)); }, [playbackSpeed]);

  // hydrate from server on login; reset on logout
  useEffect(() => {
    if (!user) { hydrated.current = false; setSettingsLoaded(false); return; }
    let cancelled = false;
    api.get('/settings').then(({ data }) => {
      if (cancelled) return;
      setThemeState(data.theme);
      setFontScaleState(data.fontScale);
      setReciterIdState(data.preferredReciterId);
      setGoalLevelState(data.goalLevel);
      setOnboardedState(data.onboarded);
      hydrated.current = true;
      setSettingsLoaded(true);
    }).catch(() => { hydrated.current = true; setSettingsLoaded(true); });
    return () => { cancelled = true; };
  }, [user]);

  function patch(partial: Record<string, unknown>) {
    if (user && hydrated.current) api.patch('/settings', partial).catch(() => {});
  }

  function setTheme(t: Theme) { setThemeState(t); patch({ theme: t }); }
  function toggleTheme() { setTheme(theme === 'light' ? 'dark' : 'light'); }
  function setFontScale(n: number) { const v = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(n.toFixed(2)))); setFontScaleState(v); patch({ fontScale: v }); }
  function setReciterId(id: number) { setReciterIdState(id); patch({ preferredReciterId: id }); }
  function setPlaybackSpeed(n: number) { setPlaybackSpeedState(SPEEDS.includes(n) ? n : 1); } // local only
  function setGoalLevel(l: GoalLevel) { setGoalLevelState(l); patch({ goalLevel: l }); }
  function completeOnboarding(l: GoalLevel) { setGoalLevelState(l); setOnboardedState(true); patch({ goalLevel: l, onboarded: true }); }

  return (
    <SettingsContext.Provider value={{ theme, toggleTheme, fontScale, setFontScale, reciterId, setReciterId, playbackSpeed, setPlaybackSpeed, goalLevel, setGoalLevel, onboarded, completeOnboarding, settingsLoaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const PLAYBACK_SPEEDS = SPEEDS;
```

- [ ] **Step 2: Move SettingsProvider inside AuthProvider**

Edit `web/src/main.tsx` — remove the `SettingsProvider` import + wrapper (it moves into App):
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

Edit `web/src/App.tsx` — wrap `<Routes>` with `<SettingsProvider>` inside `<AuthProvider>`. Add the import and the wrapper (keep all routes):
```tsx
import { SettingsProvider } from './settings/SettingsContext';
```
The body becomes:
```tsx
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <Routes>
            {/* ...existing routes unchanged... */}
          </Routes>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
```

- [ ] **Step 3: Type-check + commit**

Run: `cd web && npx tsc -b`. Commit:
```bash
git add web/src/settings/SettingsContext.tsx web/src/main.tsx web/src/App.tsx
git commit -m "feat(web): sync settings with backend (auth-aware hydrate + write-through)"
```

---

## Task 4: Onboarding gate + page

**Files:** Modify `web/src/auth/ProtectedRoute.tsx`, `web/src/App.tsx`; create `web/src/pages/OnboardingPage.tsx`.

- [ ] **Step 1: Onboarding gate in ProtectedRoute**

Replace `web/src/auth/ProtectedRoute.tsx`:
```tsx
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { useSettings } from '../settings/useSettings';

export function ProtectedRoute({ children, requireOnboarded = true }: { children: ReactNode; requireOnboarded?: boolean }) {
  const { user, loading } = useAuth();
  const { onboarded, settingsLoaded } = useSettings();
  if (loading) return <div className="p-8 text-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireOnboarded) {
    if (!settingsLoaded) return <div className="p-8 text-muted">Loading…</div>;
    if (!onboarded) return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: OnboardingPage**

Create `web/src/pages/OnboardingPage.tsx`:
```tsx
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../settings/useSettings';
import type { GoalLevel } from '../settings/SettingsContext';

const LEVELS: { key: GoalLevel; name: string; blurb: string }[] = [
  { key: 'egg', name: 'Break the Egg', blurb: '2 minutes a day — the gentlest start' },
  { key: 'steady', name: 'Steady', blurb: '10 minutes a day — build a real habit' },
  { key: 'beast', name: 'Beast Mode', blurb: '30 minutes a day — go deep' },
];

export default function OnboardingPage() {
  const { completeOnboarding } = useSettings();
  const navigate = useNavigate();
  function pick(level: GoalLevel) { completeOnboarding(level); navigate('/'); }
  return (
    <div className="min-h-screen p-6 max-w-md mx-auto flex flex-col justify-center space-y-4">
      <h1 className="text-2xl font-semibold text-center">Set your daily goal</h1>
      <p className="text-muted text-center text-sm">The most beloved deeds are those done consistently, even if small. Pick a level — you can change it anytime.</p>
      <div className="space-y-3 mt-2">
        {LEVELS.map((l) => (
          <button key={l.key} onClick={() => pick(l.key)} className="w-full text-left rounded-2xl bg-card-light dark:bg-card-dark p-4 hover:ring-2 hover:ring-accent-soft">
            <div className="font-medium">{l.name}</div>
            <div className="text-sm text-muted">{l.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Route (auth-only, not onboarding-gated)**

Edit `web/src/App.tsx` — import `OnboardingPage` and add a route that uses `requireOnboarded={false}`:
```tsx
import OnboardingPage from './pages/OnboardingPage';
```
```tsx
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute requireOnboarded={false}>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 4: Build + commit**

Run: `cd web && npm run build`. Commit:
```bash
git add web/src/auth/ProtectedRoute.tsx web/src/pages/OnboardingPage.tsx web/src/App.tsx
git commit -m "feat(web): first-run onboarding goal picker with route gate"
```

---

## Task 5: Settings page

**Files:** Create `web/src/pages/SettingsPage.tsx`; modify `web/src/App.tsx`, `web/src/pages/DashboardPage.tsx`.

- [ ] **Step 1: SettingsPage**

Create `web/src/pages/SettingsPage.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { useSettings } from '../settings/useSettings';
import type { GoalLevel } from '../settings/SettingsContext';
import { useReciters } from '../audio/useReciters';

const LEVELS: { key: GoalLevel; name: string; secs: string }[] = [
  { key: 'egg', name: 'Break the Egg', secs: '2 min' },
  { key: 'steady', name: 'Steady', secs: '10 min' },
  { key: 'beast', name: 'Beast Mode', secs: '30 min' },
];

export default function SettingsPage() {
  const { goalLevel, setGoalLevel, reciterId, setReciterId, theme, toggleTheme, fontScale, setFontScale } = useSettings();
  const { data: reciters } = useReciters();

  return (
    <div className="min-h-screen p-6 max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-accent-soft">‹ Home</Link>
        <h1 className="text-lg font-semibold">Settings</h1>
        <span className="w-10" />
      </div>

      <section className="space-y-2">
        <div className="text-xs uppercase text-muted">Daily goal</div>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => (
            <button key={l.key} onClick={() => setGoalLevel(l.key)}
              className={'rounded-xl p-3 text-center ' + (goalLevel === l.key ? 'bg-accent text-white' : 'bg-card-light dark:bg-card-dark')}>
              <div className="text-sm font-medium">{l.name}</div>
              <div className="text-xs opacity-70">{l.secs}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="text-xs uppercase text-muted">Reciter</div>
        <select className="w-full rounded-lg bg-card-light dark:bg-card-dark p-3" value={reciterId} onChange={(e) => setReciterId(Number(e.target.value))}>
          {reciters?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </section>

      <section className="flex items-center justify-between">
        <div className="text-xs uppercase text-muted">Theme</div>
        <button onClick={toggleTheme} className="rounded-lg bg-card-light dark:bg-card-dark px-4 py-2 text-sm">{theme === 'light' ? '☾ Dark' : '☀ Light'}</button>
      </section>

      <section className="flex items-center justify-between">
        <div className="text-xs uppercase text-muted">Arabic font size</div>
        <div className="flex items-center gap-3">
          <button onClick={() => setFontScale(fontScale - 0.1)} className="text-muted">A−</button>
          <span className="text-sm w-10 text-center">{Math.round(fontScale * 100)}%</span>
          <button onClick={() => setFontScale(fontScale + 0.1)} className="text-lg">A+</button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Route + dashboard link**

Edit `web/src/App.tsx` — import `SettingsPage` and add a protected route:
```tsx
import SettingsPage from './pages/SettingsPage';
```
```tsx
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
```

Edit `web/src/pages/DashboardPage.tsx` — add a settings link in the header next to the theme toggle / log out. Import `Link` and add a gear link:
```tsx
import { Link } from 'react-router-dom';
```
In the header's right-side `div` (with ThemeToggle + Log out), add before Log out:
```tsx
          <Link to="/settings" className="text-sm text-muted" aria-label="Settings">⚙</Link>
```

- [ ] **Step 3: Build + commit**

Run: `cd web && npm run build`. Commit:
```bash
git add web/src/pages/SettingsPage.tsx web/src/App.tsx web/src/pages/DashboardPage.tsx
git commit -m "feat(web): settings page for goal, reciter, theme, font"
```

---

## Task 6: Visual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Ensure the stack runs.**

- [ ] **Step 2: Onboarding flow (Playwright, fresh account)** — register a brand-new account → should land on **/onboarding** (gate). Pick **Steady** → redirect to `/`. Confirm the dashboard hero goal now reads **/ 10:00** (not 2:00), proving the per-user goal flows to `/stats/summary`.

- [ ] **Step 3: Settings sync** — open `/settings`: change goal to **Beast Mode**, switch reciter, toggle theme, bump font. Reload the page → values persist (hydrated from backend). Verify with:
```bash
# using the account's token
curl -s localhost:3000/settings -H "authorization: Bearer $T" | python3 -m json.tool
```
Expected JSON reflects the chosen goalLevel/goalTargetSeconds, reciter, theme, fontScale.

- [ ] **Step 4: Gate re-entry** — log out and log back in → goes straight to the dashboard (already onboarded), not onboarding.

- [ ] **Step 5: Regression** — `cd api && npm run test:e2e` → 37 passing.

- [ ] **Step 6: Report** pass/fail with a screenshot of the onboarding screen and the settings screen.

---

## Self-Review Notes

- **Spec coverage (§ goals, § settings):** time-based goal levels chosen at onboarding (Task 4) and editable later (Task 5); per-user goal replaces the constant and drives `goalMet`/streak (Task 2); reciter/theme/font persisted server-side and synced across devices (Tasks 2–3).
- **Backward compatibility:** users with no `UserSettings` row get the 120s default via `getGoalSeconds`, so Phase 5/6 e2e (which never create settings) stay green; the dashboard hero already reads `goalTargetSeconds` from the summary, so it shows the chosen goal with no dashboard change.
- **Deferred (correct):** `playbackSpeed` stays client-only (not in `UserSettings` per the spec). Stats history (calendar/graph) is Phase 8.
- **Type consistency:** the settings JSON `{ onboarded, goalLevel, goalTargetSeconds, preferredReciterId, theme, fontScale }` is produced by `SettingsService.publicShape` and consumed by the client `SettingsProvider` hydrate. `GoalLevel` and `GOAL_SECONDS` on the client mirror the backend `GOAL_LEVELS`. `getGoalSeconds(userId)` is the single goal source for both `SessionsService` and `StatsService`.
- **Ordering risk:** `SettingsProvider` now depends on `useAuth`, so it must render inside `AuthProvider` (Task 3 moves it). `ProtectedRoute` depends on `useSettings`, so it must render inside `SettingsProvider` — it does, since routes are children of `SettingsProvider`. Hydration guards (`hydrated` ref) prevent the initial server-applied values from echoing back as PATCHes.
```
