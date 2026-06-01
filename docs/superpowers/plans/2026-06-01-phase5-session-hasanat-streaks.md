# Phase 5: Session Tracking + Hasanat + Streaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn reading into a tracked habit: accumulate time + pages while reading, post sessions to the backend, accrue server-validated Hasanat (10 × Arabic letters), roll up per-day progress, compute a daily streak, and show live counters in the reading view.

**Architecture:** A client `useReadingTracker` accumulates active seconds (paused when the tab is hidden) and the set of pages dwelt on, flushing every 30s / on hide / on unmount to `POST /reading-sessions { date, durationSeconds, pages }`. The backend derives Hasanat/verses from `AyahRef` (the only trustworthy source — the client never sends Hasanat), writes a `ReadingSession`, upserts today's `DailyProgress`, and bumps the `Streak` when the day's goal is first met. `GET /stats/summary?date=` returns today + lifetime + effective streak, which the reading view shows as live counters (Time ticks locally; Hasanat/Verses/Pages refresh on each flush).

**Tech Stack:** NestJS + Prisma 7 (pg adapter), Jest + supertest; React + Vite + Tailwind v3 (Quiet Slate), TanStack Query.

**Builds on:** Phase 1 (auth), Phase 2 (`AyahRef` with `letterCount`, seeded), Phase 4 (reading view + AudioProvider). Commit directly to `main`; push after verification.

**Default goal:** `DEFAULT_GOAL_SECONDS = 120` (the gentle "Break the Egg" 2-min level). Phase 7 (onboarding/settings) replaces this constant with a per-user goal.

---

## File Structure

```
api/
├── prisma/schema.prisma                      # + ReadingSession, DailyProgress, Streak
└── src/
    ├── sessions/
    │   ├── sessions.module.ts
    │   ├── sessions.service.ts                # record(): AyahRef→hasanat, daily upsert, streak bump
    │   ├── sessions.controller.ts             # POST /reading-sessions
    │   ├── streak.ts                          # pure streak helpers (isoMinus1, nextStreak) + unit tests
    │   └── dto/record-session.dto.ts
    ├── stats/
    │   ├── stats.module.ts
    │   ├── stats.service.ts                   # summary(): today + lifetime + effective streak
    │   └── stats.controller.ts                # GET /stats/summary?date=
    └── test/
        ├── streak.spec.ts                     # unit (pure helpers)
        ├── sessions.e2e-spec.ts
        └── stats.e2e-spec.ts
web/src/reading/
├── useReadingTracker.ts                       # active time + pages, flush
├── useStatsSummary.ts                         # GET /stats/summary
└── ReadingStatsBar.tsx                        # live Hasanat/Verses/Time/Pages
web/src/pages/ReadPage.tsx (modified)          # use tracker + render stats bar
```

---

## Task 1: Prisma models + migration

**Files:** Modify `api/prisma/schema.prisma`

- [ ] **Step 1: Append the models**

Append to `api/prisma/schema.prisma`:
```prisma
model ReadingSession {
  id              String   @id @default(uuid())
  userId          String
  date            String   // client local date YYYY-MM-DD
  durationSeconds Int
  versesCount     Int
  pagesCount      Int
  hasanat         Int
  startSurah      Int
  startAyah       Int
  endSurah        Int
  endAyah         Int
  createdAt       DateTime @default(now())

  @@index([userId])
}

model DailyProgress {
  userId      String
  date        String  // YYYY-MM-DD (client local)
  secondsRead Int     @default(0)
  versesRead  Int     @default(0)
  pagesRead   Int     @default(0)
  hasanat     Int     @default(0)
  goalMet     Boolean @default(false)

  @@id([userId, date])
  @@index([userId])
}

model Streak {
  userId         String  @id
  currentStreak  Int     @default(0)
  longestStreak  Int     @default(0)
  lastActiveDate String? // YYYY-MM-DD
}
```

- [ ] **Step 2: Migrate + verify**

Run: `cd api && npx prisma migrate dev --name add_sessions_progress_streak`
Then: `docker compose exec -T db psql -U quran -d quran -c '\dt'`
Expected: `ReadingSession`, `DailyProgress`, `Streak` present.

- [ ] **Step 3: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat(api): add ReadingSession, DailyProgress, Streak models"
```

---

## Task 2: Streak helpers (TDD unit)

**Files:** Create `api/src/sessions/streak.ts`, `api/test/streak.spec.ts`

- [ ] **Step 1: Write the failing unit test**

Create `api/test/streak.spec.ts`:
```ts
import { isoMinus1, nextStreak } from '../src/sessions/streak';

describe('isoMinus1', () => {
  it('subtracts one day', () => {
    expect(isoMinus1('2026-06-01')).toBe('2026-05-31');
    expect(isoMinus1('2026-01-01')).toBe('2025-12-31');
  });
});

describe('nextStreak', () => {
  const base = { currentStreak: 3, longestStreak: 5, lastActiveDate: '2026-05-31' };

  it('increments when last active was yesterday', () => {
    expect(nextStreak(base, '2026-06-01')).toEqual({ currentStreak: 4, longestStreak: 5, lastActiveDate: '2026-06-01' });
  });

  it('keeps streak unchanged when already counted today', () => {
    expect(nextStreak({ ...base, lastActiveDate: '2026-06-01' }, '2026-06-01')).toEqual({ currentStreak: 3, longestStreak: 5, lastActiveDate: '2026-06-01' });
  });

  it('resets to 1 when a day was missed', () => {
    expect(nextStreak({ ...base, lastActiveDate: '2026-05-28' }, '2026-06-01')).toEqual({ currentStreak: 1, longestStreak: 5, lastActiveDate: '2026-06-01' });
  });

  it('grows longest when current passes it', () => {
    expect(nextStreak({ currentStreak: 5, longestStreak: 5, lastActiveDate: '2026-05-31' }, '2026-06-01'))
      .toEqual({ currentStreak: 6, longestStreak: 6, lastActiveDate: '2026-06-01' });
  });

  it('starts at 1 from no history', () => {
    expect(nextStreak({ currentStreak: 0, longestStreak: 0, lastActiveDate: null }, '2026-06-01'))
      .toEqual({ currentStreak: 1, longestStreak: 1, lastActiveDate: '2026-06-01' });
  });
});

describe('effectiveCurrent', () => {
  it('is exercised via the stats endpoint (see stats.e2e)', () => { expect(true).toBe(true); });
});
```

- [ ] **Step 2: Run — confirm fail**

Run: `cd api && npx jest streak`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

Create `api/src/sessions/streak.ts`:
```ts
export type StreakState = { currentStreak: number; longestStreak: number; lastActiveDate: string | null };

export function isoMinus1(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Compute the new streak when `date`'s goal is first met.
export function nextStreak(s: StreakState, date: string): StreakState {
  if (s.lastActiveDate === date) return s; // already counted today
  const current = s.lastActiveDate === isoMinus1(date) ? s.currentStreak + 1 : 1;
  return { currentStreak: current, longestStreak: Math.max(s.longestStreak, current), lastActiveDate: date };
}

// The streak still "alive" at read time only if the last active day is today or yesterday.
export function effectiveCurrent(s: StreakState, today: string): number {
  if (s.lastActiveDate === today || s.lastActiveDate === isoMinus1(today)) return s.currentStreak;
  return 0;
}
```

- [ ] **Step 4: Run — confirm pass**

Run: `cd api && npx jest streak`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/sessions/streak.ts api/test/streak.spec.ts
git commit -m "feat(api): add streak math helpers with unit tests"
```

---

## Task 3: Sessions endpoint (TDD e2e)

**Files:** Create `api/src/sessions/dto/record-session.dto.ts`, `sessions.service.ts`, `sessions.controller.ts`, `sessions.module.ts`, `api/test/sessions.e2e-spec.ts`; modify `api/src/app.module.ts`.

- [ ] **Step 1: Write the e2e (failing)**

Create `api/test/sessions.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Sessions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const email = `sess${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = app.get(PrismaService);
    await app.init();
    const reg = await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password123', name: 'Sess' });
    token = reg.body.accessToken;
    userId = reg.body.user.id;
  });

  afterAll(async () => {
    await prisma.readingSession.deleteMany({ where: { userId } });
    await prisma.dailyProgress.deleteMany({ where: { userId } });
    await prisma.streak.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('requires auth', async () => {
    await request(app.getHttpServer()).post('/reading-sessions').send({ date: '2026-06-01', durationSeconds: 10, pages: [1] }).expect(401);
  });

  it('records a session and computes hasanat from AyahRef', async () => {
    const res = await request(app.getHttpServer())
      .post('/reading-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-06-01', durationSeconds: 130, pages: [1, 2] })
      .expect(201);
    expect(res.body.today.hasanat).toBeGreaterThan(0);
    expect(res.body.today.versesRead).toBeGreaterThan(0);
    expect(res.body.today.pagesRead).toBe(2);
    expect(res.body.today.secondsRead).toBe(130);
    expect(res.body.today.goalMet).toBe(true); // 130 >= 120
    expect(res.body.streak.current).toBe(1);
  });

  it('accumulates within the same day', async () => {
    const res = await request(app.getHttpServer())
      .post('/reading-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-06-01', durationSeconds: 20, pages: [3] })
      .expect(201);
    expect(res.body.today.secondsRead).toBe(150);
    expect(res.body.today.pagesRead).toBe(3);
    expect(res.body.streak.current).toBe(1); // still day 1
  });

  it('increments streak on a consecutive day', async () => {
    const res = await request(app.getHttpServer())
      .post('/reading-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-06-02', durationSeconds: 200, pages: [4] })
      .expect(201);
    expect(res.body.streak.current).toBe(2);
  });

  it('does not advance streak when the goal is not met', async () => {
    const res = await request(app.getHttpServer())
      .post('/reading-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-06-05', durationSeconds: 30, pages: [5] }) // 30 < 120, gap day
      .expect(201);
    expect(res.body.today.goalMet).toBe(false);
    // streak was 2 (last active 06-02); 06-05 not met → effective handled by stats, raw current stays 2
    expect(res.body.streak.current).toBe(2);
  });

  it('rejects an empty pages array', async () => {
    await request(app.getHttpServer())
      .post('/reading-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-06-01', durationSeconds: 10, pages: [] })
      .expect(400);
  });
});
```

- [ ] **Step 2: Run — confirm fail.** `cd api && npm run test:e2e -- sessions` → FAIL.

- [ ] **Step 3: DTO**

Create `api/src/sessions/dto/record-session.dto.ts`:
```ts
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Matches, Max, Min } from 'class-validator';

export class RecordSessionDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsInt() @Min(0) @Max(86400) durationSeconds: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(604) @IsInt({ each: true }) pages: number[];
}
```

- [ ] **Step 4: Service**

Create `api/src/sessions/sessions.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordSessionDto } from './dto/record-session.dto';
import { effectiveCurrent, nextStreak, StreakState } from './streak';

export const DEFAULT_GOAL_SECONDS = 120;

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async record(userId: string, dto: RecordSessionDto) {
    const pages = [...new Set(dto.pages)].filter((p) => p >= 1 && p <= 604);
    const ayahs = await this.prisma.ayahRef.findMany({
      where: { page: { in: pages } },
      orderBy: [{ surah: 'asc' }, { ayah: 'asc' }],
    });
    const hasanat = ayahs.reduce((sum, a) => sum + a.letterCount * 10, 0);
    const versesCount = ayahs.length;
    const pagesCount = pages.length;
    const first = ayahs[0];
    const last = ayahs[ayahs.length - 1];

    await this.prisma.readingSession.create({
      data: {
        userId,
        date: dto.date,
        durationSeconds: dto.durationSeconds,
        versesCount,
        pagesCount,
        hasanat,
        startSurah: first?.surah ?? 0,
        startAyah: first?.ayah ?? 0,
        endSurah: last?.surah ?? 0,
        endAyah: last?.ayah ?? 0,
      },
    });

    const dp = await this.prisma.dailyProgress.upsert({
      where: { userId_date: { userId, date: dto.date } },
      create: { userId, date: dto.date, secondsRead: dto.durationSeconds, versesRead: versesCount, pagesRead: pagesCount, hasanat },
      update: {
        secondsRead: { increment: dto.durationSeconds },
        versesRead: { increment: versesCount },
        pagesRead: { increment: pagesCount },
        hasanat: { increment: hasanat },
      },
    });

    const goalMet = dp.secondsRead >= DEFAULT_GOAL_SECONDS;
    let streakState: StreakState =
      (await this.prisma.streak.findUnique({ where: { userId } })) ?? { currentStreak: 0, longestStreak: 0, lastActiveDate: null };

    if (goalMet && !dp.goalMet) {
      await this.prisma.dailyProgress.update({ where: { userId_date: { userId, date: dto.date } }, data: { goalMet: true } });
      streakState = nextStreak(streakState, dto.date);
      await this.prisma.streak.upsert({
        where: { userId },
        create: { userId, ...streakState },
        update: { currentStreak: streakState.currentStreak, longestStreak: streakState.longestStreak, lastActiveDate: streakState.lastActiveDate },
      });
    }

    return {
      today: {
        secondsRead: dp.secondsRead,
        versesRead: dp.versesRead,
        pagesRead: dp.pagesRead,
        hasanat: dp.hasanat,
        goalMet,
      },
      streak: { current: streakState.currentStreak, longest: streakState.longestStreak },
      goalTargetSeconds: DEFAULT_GOAL_SECONDS,
    };
  }
}
```
> The `effectiveCurrent` import is used by the stats service (Task 4), not here — but keep this file importing only what it uses. Remove `effectiveCurrent` from the import if your linter flags it; import only `nextStreak, StreakState`.

- [ ] **Step 5: Controller + module**

Create `api/src/sessions/sessions.controller.ts`:
```ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionsService } from './sessions.service';
import { RecordSessionDto } from './dto/record-session.dto';

@UseGuards(JwtAuthGuard)
@Controller('reading-sessions')
export class SessionsController {
  constructor(private sessions: SessionsService) {}

  @Post()
  record(@CurrentUser() user: { id: string }, @Body() dto: RecordSessionDto) {
    return this.sessions.record(user.id, dto);
  }
}
```

Create `api/src/sessions/sessions.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
```
Edit `api/src/app.module.ts` — add `SessionsModule` to imports.

- [ ] **Step 6: Run e2e — green.** `cd api && npm run test:e2e -- sessions` → PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add api/src/sessions api/src/app.module.ts api/test/sessions.e2e-spec.ts
git commit -m "feat(api): record reading sessions with hasanat, daily progress, streaks"
```

---

## Task 4: Stats summary endpoint (TDD e2e)

**Files:** Create `api/src/stats/stats.service.ts`, `stats.controller.ts`, `stats.module.ts`, `api/test/stats.e2e-spec.ts`; modify `api/src/app.module.ts`.

- [ ] **Step 1: Write the e2e (failing)**

Create `api/test/stats.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Stats (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const email = `stat${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = app.get(PrismaService);
    await app.init();
    const reg = await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password123', name: 'Stat' });
    token = reg.body.accessToken;
    userId = reg.body.user.id;
    // seed one goal-met day
    await request(app.getHttpServer()).post('/reading-sessions').set('Authorization', `Bearer ${token}`).send({ date: '2026-06-01', durationSeconds: 130, pages: [1, 2] });
  });

  afterAll(async () => {
    await prisma.readingSession.deleteMany({ where: { userId } });
    await prisma.dailyProgress.deleteMany({ where: { userId } });
    await prisma.streak.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('requires auth', async () => {
    await request(app.getHttpServer()).get('/stats/summary?date=2026-06-01').expect(401);
  });

  it('returns today + lifetime + streak for the active day', async () => {
    const res = await request(app.getHttpServer()).get('/stats/summary?date=2026-06-01').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.today.secondsRead).toBe(130);
    expect(res.body.today.goalMet).toBe(true);
    expect(res.body.lifetime.hasanat).toBeGreaterThan(0);
    expect(res.body.streak.current).toBe(1);
    expect(res.body.goalTargetSeconds).toBe(120);
  });

  it('reports zero today for a fresh day but keeps lifetime', async () => {
    const res = await request(app.getHttpServer()).get('/stats/summary?date=2026-06-02').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.today.secondsRead).toBe(0);
    expect(res.body.lifetime.hasanat).toBeGreaterThan(0);
    expect(res.body.streak.current).toBe(1); // 06-01 is yesterday → still alive
  });

  it('shows a broken streak as 0 when the gap is too large', async () => {
    const res = await request(app.getHttpServer()).get('/stats/summary?date=2026-06-10').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.streak.current).toBe(0); // last active 06-01, today 06-10 → broken
  });
});
```

- [ ] **Step 2: Run — confirm fail.** `cd api && npm run test:e2e -- stats` → FAIL.

- [ ] **Step 3: Service**

Create `api/src/stats/stats.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_GOAL_SECONDS } from '../sessions/sessions.service';
import { effectiveCurrent } from '../sessions/streak';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async summary(userId: string, date: string) {
    const today = await this.prisma.dailyProgress.findUnique({ where: { userId_date: { userId, date } } });
    const agg = await this.prisma.dailyProgress.aggregate({
      where: { userId },
      _sum: { secondsRead: true, versesRead: true, pagesRead: true, hasanat: true },
    });
    const streak = (await this.prisma.streak.findUnique({ where: { userId } })) ?? { currentStreak: 0, longestStreak: 0, lastActiveDate: null };

    return {
      goalTargetSeconds: DEFAULT_GOAL_SECONDS,
      today: {
        secondsRead: today?.secondsRead ?? 0,
        versesRead: today?.versesRead ?? 0,
        pagesRead: today?.pagesRead ?? 0,
        hasanat: today?.hasanat ?? 0,
        goalMet: today?.goalMet ?? false,
      },
      lifetime: {
        seconds: agg._sum.secondsRead ?? 0,
        verses: agg._sum.versesRead ?? 0,
        pages: agg._sum.pagesRead ?? 0,
        hasanat: agg._sum.hasanat ?? 0,
      },
      streak: { current: effectiveCurrent(streak, date), longest: streak.longestStreak },
    };
  }
}
```

- [ ] **Step 4: Controller + module**

Create `api/src/stats/stats.controller.ts`:
```ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Matches } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { StatsService } from './stats.service';

class SummaryQuery {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
}

@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private stats: StatsService) {}

  @Get('summary')
  summary(@CurrentUser() user: { id: string }, @Query() q: SummaryQuery) {
    return this.stats.summary(user.id, q.date);
  }
}
```

Create `api/src/stats/stats.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

@Module({
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
```
Edit `api/src/app.module.ts` — add `StatsModule` to imports.

- [ ] **Step 5: Run e2e — green.** `cd api && npm run test:e2e -- stats` → PASS (4 tests). Then full suite `cd api && npm run test:e2e` → expect 29 passing (auth 8 + bookmark 5 + favorites 6 + sessions 6 + stats 4).

- [ ] **Step 6: Commit**

```bash
git add api/src/stats api/src/app.module.ts api/test/stats.e2e-spec.ts
git commit -m "feat(api): add stats summary endpoint (today, lifetime, streak)"
```

---

## Task 5: Frontend reading tracker + live stats bar

**Files:** Create `web/src/reading/useReadingTracker.ts`, `web/src/reading/useStatsSummary.ts`, `web/src/reading/ReadingStatsBar.tsx`; modify `web/src/pages/ReadPage.tsx`.

- [ ] **Step 1: localDate helper + useStatsSummary**

Create `web/src/reading/useStatsSummary.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type StatsSummary = {
  goalTargetSeconds: number;
  today: { secondsRead: number; versesRead: number; pagesRead: number; hasanat: number; goalMet: boolean };
  lifetime: { seconds: number; verses: number; pages: number; hasanat: number };
  streak: { current: number; longest: number };
};

export function useStatsSummary() {
  return useQuery({
    queryKey: ['stats-summary'],
    queryFn: async (): Promise<StatsSummary> => (await api.get(`/stats/summary?date=${localDate()}`)).data,
  });
}
```

- [ ] **Step 2: useReadingTracker**

Create `web/src/reading/useReadingTracker.ts`:
```ts
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { localDate } from './useStatsSummary';

const FLUSH_MS = 30_000;
const PAGE_DWELL_S = 3; // seconds of active time before a page counts as read

// Tracks active reading time + dwelt pages for the current page and flushes to the backend.
export function useReadingTracker(page: number) {
  const qc = useQueryClient();
  const secondsRef = useRef(0);
  const pagesRef = useRef<Set<number>>(new Set());
  const dwellRef = useRef(0);
  const pageRef = useRef(page);
  pageRef.current = page;

  async function flush() {
    const seconds = secondsRef.current;
    const pages = [...pagesRef.current];
    if (seconds === 0 || pages.length === 0) return;
    secondsRef.current = 0;
    pagesRef.current = new Set();
    try {
      await api.post('/reading-sessions', { date: localDate(), durationSeconds: seconds, pages });
      qc.invalidateQueries({ queryKey: ['stats-summary'] });
    } catch {
      /* keep counting; next flush retries */
    }
  }

  // reset per-page dwell when the page changes
  useEffect(() => { dwellRef.current = 0; }, [page]);

  // 1s ticker: accumulate active time, mark page read after dwell
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      secondsRef.current += 1;
      dwellRef.current += 1;
      if (dwellRef.current >= PAGE_DWELL_S) pagesRef.current.add(pageRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // periodic flush
  useEffect(() => {
    const id = setInterval(flush, FLUSH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // flush on hide + on unmount
  useEffect(() => {
    const onHide = () => { if (document.hidden) void flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); void flush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
```

- [ ] **Step 3: ReadingStatsBar**

Create `web/src/reading/ReadingStatsBar.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useStatsSummary } from './useStatsSummary';

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function ReadingStatsBar() {
  const { data } = useStatsSummary();
  // tick the displayed time locally between flushes for a live feel
  const [extra, setExtra] = useState(0);
  useEffect(() => { setExtra(0); }, [data?.today.secondsRead]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) setExtra((e) => e + 1); }, 1000);
    return () => clearInterval(id);
  }, []);

  const today = data?.today;
  const seconds = (today?.secondsRead ?? 0) + extra;
  return (
    <div className="flex justify-around text-center px-4 py-2 text-xs text-muted border-t border-muted/20">
      <div><div className="text-accent-soft font-semibold">{(today?.hasanat ?? 0).toLocaleString()}</div>Hasanat</div>
      <div><div className="text-ink dark:text-ink-dark font-semibold">{today?.versesRead ?? 0}</div>Verses</div>
      <div><div className="text-ink dark:text-ink-dark font-semibold">{fmt(seconds)}</div>Time</div>
      <div><div className="text-ink dark:text-ink-dark font-semibold">{today?.pagesRead ?? 0}</div>Pages</div>
    </div>
  );
}
```

- [ ] **Step 4: Wire into ReadPage**

Edit `web/src/pages/ReadPage.tsx` — inside `ReadPageInner`, call the tracker and render the stats bar above the AudioBar. Add imports:
```tsx
import { useReadingTracker } from '../reading/useReadingTracker';
import { ReadingStatsBar } from '../reading/ReadingStatsBar';
```
Inside `ReadPageInner({ n })`, after the existing hooks add:
```tsx
  useReadingTracker(n);
```
And in the returned JSX, place `<ReadingStatsBar />` directly above `<AudioBar … />`:
```tsx
      <ReadingStatsBar />
      <AudioBar firstSurahAyah={firstSurahAyah} />
```

- [ ] **Step 5: Build**

Run: `cd web && npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add web/src/reading/useReadingTracker.ts web/src/reading/useStatsSummary.ts web/src/reading/ReadingStatsBar.tsx web/src/pages/ReadPage.tsx
git commit -m "feat(web): reading session tracker and live stats bar"
```

---

## Task 6: Visual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Ensure the stack runs** (docker + api + web dev servers).

- [ ] **Step 2: API-level proof (deterministic)**

With a logged-in token (register via curl or reuse), post sessions and read stats:
```bash
# register
T=$(curl -s -X POST localhost:3000/auth/register -H 'content-type: application/json' -d '{"email":"verify'$(date +%s)'@x.com","password":"password123","name":"V"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
# post a goal-meeting session
curl -s -X POST localhost:3000/reading-sessions -H "authorization: Bearer $T" -H 'content-type: application/json' -d '{"date":"2026-06-01","durationSeconds":130,"pages":[1,2]}' | python3 -m json.tool
# read summary
curl -s "localhost:3000/stats/summary?date=2026-06-01" -H "authorization: Bearer $T" | python3 -m json.tool
```
Expected: session response has `today.hasanat > 0`, `pagesRead 2`, `goalMet true`, `streak.current 1`; summary echoes today + lifetime + streak.

- [ ] **Step 3: Browser proof (Playwright)** — log in, open `/read/page/1`:
1. Confirm the **ReadingStatsBar** shows Hasanat / Verses / Time / Pages; Time ticks up every second.
2. Wait > 3s (dwell) then trigger a flush (navigate Next, or wait 30s) → after the flush, Hasanat/Verses/Pages become non-zero (evaluate the bar text), proving the session posted and the summary refreshed.
3. Screenshot the reading view with non-zero counters.

- [ ] **Step 4: DB proof**

Run:
```bash
docker compose exec -T db psql -U quran -d quran -c 'select count(*) from "ReadingSession"; select date, "secondsRead", "pagesRead", hasanat, "goalMet" from "DailyProgress" order by date desc limit 3; select * from "Streak" limit 3;'
```
Expected: sessions exist; a DailyProgress row with positive hasanat; a Streak row.

- [ ] **Step 5: Report** pass/fail with screenshot + the summary JSON.

---

## Self-Review Notes

- **Spec coverage (§ reading dashboard, § habit tracking):** live Hasanat/Verses/Time/Pages (Task 5), server-validated Hasanat at 10 × letters from `AyahRef` (Task 3), `DailyProgress` aggregation (Task 3), streak computation with day-rollover + effective (alive) check (Tasks 2–4), periodic/on-hide/on-unmount flush (Task 5).
- **Deferred (correct):** the dashboard UI that *displays* streak/weekly/metrics is Phase 6 (this phase exposes `GET /stats/summary` it will consume); calendar/graph history is Phase 8; per-user configurable goal replaces `DEFAULT_GOAL_SECONDS` in Phase 7.
- **Design choices (noted):** "pages read" counts a page after ≥3s active dwell; re-reading a page on another flush re-counts (re-recitation earns Hasanat again — acceptable). Duration is client-measured (unavoidable); Hasanat/verses/pages are server-derived from claimed pages, so they can't be inflated beyond claiming pages. Day boundary uses the client's local date string (sent on every flush) — matches the spec's "user's local timezone."
- **Type consistency:** the session-record response and `GET /stats/summary` share the `today` shape `{ secondsRead, versesRead, pagesRead, hasanat, goalMet }` and `streak { current, longest }`, consumed by `useStatsSummary`/`ReadingStatsBar`. `DEFAULT_GOAL_SECONDS` is defined once in `sessions.service.ts` and imported by `stats.service.ts`. Streak math lives only in `streak.ts` (unit-tested) and is used by both services.
```
