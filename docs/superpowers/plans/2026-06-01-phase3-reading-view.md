# Phase 3: Reading View Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Mushaf reading view usable day-to-day: light/dark toggle, adjustable Arabic font size, a resume bookmark that remembers your place, and the ability to favorite ayahs and revisit them.

**Architecture:** Two client-only UI preferences (theme + font scale) persist in `localStorage` via a `SettingsProvider` (synced to the backend later in Phase 7). Two pieces of cross-device data — the resume **bookmark** (one row per user) and **favorites** (one row per favorited ayah) — get Prisma models and JWT-guarded REST endpoints following the Phase 1 auth-module pattern, with page numbers derived server-side from `AyahRef`. The reading view gains ayah selection (tap a word → its ayah highlights → a floating bar to favorite it), and the dashboard "Start reading" resumes at the bookmarked page.

**Tech Stack:** NestJS + Prisma 7 (pg adapter), Jest + supertest; React + Vite + Tailwind v3 (Quiet Slate, `darkMode: 'class'`), TanStack Query, react-router-dom.

**Builds on:** Phase 1 (auth, `User`) + Phase 2 (Mushaf rendering, `AyahRef`). Commit directly to `main` (user preference for this personal project) and push after the phase is verified.

---

## File Structure

```
api/
├── prisma/schema.prisma                 # + Bookmark, Favorite models
└── src/
    ├── bookmark/
    │   ├── bookmark.module.ts
    │   ├── bookmark.service.ts           # get/upsert; derive surah/ayah from AyahRef
    │   └── bookmark.controller.ts        # GET/PUT /bookmark
    ├── favorites/
    │   ├── favorites.module.ts
    │   ├── favorites.service.ts           # list/add/remove; join AyahRef for page
    │   ├── favorites.controller.ts        # GET/POST/DELETE /favorites
    │   └── dto/add-favorite.dto.ts
    └── test/
        ├── bookmark.e2e-spec.ts
        └── favorites.e2e-spec.ts
web/src/
├── settings/
│   ├── SettingsContext.tsx               # theme + fontScale, localStorage
│   └── useSettings.ts
├── reading/
│   ├── useBookmark.ts                    # GET/PUT /bookmark (TanStack Query)
│   └── useFavorites.ts                   # GET/POST/DELETE /favorites
├── quran/ (modified)
│   ├── MushafWord.tsx                    # + selection click + highlight
│   ├── MushafLine.tsx                    # + thread selection
│   ├── MushafPage.tsx                    # + selected-ayah state, font scale, FavoriteBar
│   └── FavoriteBar.tsx                   # floating favorite toggle for selected ayah
├── pages/
│   ├── ReadPage.tsx (modified)           # top bar: back, Aa, theme, page nav; bookmark sync
│   ├── DashboardPage.tsx (modified)      # resume link + favorites link + theme toggle
│   └── FavoritesPage.tsx                 # list favorites
├── components/
│   ├── ThemeToggle.tsx
│   └── FontSizeControl.tsx
├── App.tsx (modified)                    # + /favorites route
└── main.tsx (modified)                   # wrap in SettingsProvider
```

---

## Task 1: Bookmark + Favorite models + migration

**Files:** Modify `api/prisma/schema.prisma`

- [ ] **Step 1: Append the models**

Append to `api/prisma/schema.prisma`:
```prisma
model Bookmark {
  userId    String   @id
  surah     Int
  ayah      Int
  page      Int
  updatedAt DateTime @updatedAt
}

model Favorite {
  id        String   @id @default(uuid())
  userId    String
  surah     Int
  ayah      Int
  createdAt DateTime @default(now())

  @@unique([userId, surah, ayah])
  @@index([userId])
}
```

- [ ] **Step 2: Migrate**

Run: `cd api && npx prisma migrate dev --name add_bookmark_favorite`
Expected: `Bookmark` and `Favorite` tables created; Prisma Client regenerated.

- [ ] **Step 3: Verify**

Run: `docker compose exec -T db psql -U quran -d quran -c '\dt'`
Expected: `Bookmark` and `Favorite` listed alongside `User`, `AyahRef`.

- [ ] **Step 4: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat(api): add Bookmark and Favorite models"
```

---

## Task 2: Bookmark module + endpoints (TDD e2e)

**Files:** Create `api/src/bookmark/bookmark.service.ts`, `api/src/bookmark/bookmark.controller.ts`, `api/src/bookmark/bookmark.module.ts`, `api/test/bookmark.e2e-spec.ts`; modify `api/src/app.module.ts`.

- [ ] **Step 1: Write the e2e test (failing)**

Create `api/test/bookmark.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Bookmark (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const email = `bm${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = app.get(PrismaService);
    await app.init();
    const reg = await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password123', name: 'BM' });
    token = reg.body.accessToken;
    userId = reg.body.user.id;
  });

  afterAll(async () => {
    await prisma.bookmark.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('returns null when no bookmark exists', async () => {
    const res = await request(app.getHttpServer()).get('/bookmark').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toEqual({});
  });

  it('requires auth', async () => {
    await request(app.getHttpServer()).get('/bookmark').expect(401);
  });

  it('upserts a bookmark and derives surah/ayah from the page', async () => {
    // page 2 is the start of Al-Baqarah; first ayah on the page exists in AyahRef
    const res = await request(app.getHttpServer()).put('/bookmark').set('Authorization', `Bearer ${token}`).send({ page: 2 }).expect(200);
    expect(res.body.page).toBe(2);
    expect(res.body.surah).toBeGreaterThanOrEqual(1);
    expect(res.body.ayah).toBeGreaterThanOrEqual(1);
  });

  it('returns the saved bookmark', async () => {
    const res = await request(app.getHttpServer()).get('/bookmark').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.page).toBe(2);
  });

  it('overwrites on a second put (one bookmark per user)', async () => {
    await request(app.getHttpServer()).put('/bookmark').set('Authorization', `Bearer ${token}`).send({ page: 10 }).expect(200);
    const res = await request(app.getHttpServer()).get('/bookmark').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.page).toBe(10);
  });
});
```

- [ ] **Step 2: Run it — confirm it fails**

Run: `cd api && npm run test:e2e -- bookmark`
Expected: FAIL (no `/bookmark` route / module not found).

- [ ] **Step 3: Service**

Create `api/src/bookmark/bookmark.service.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookmarkService {
  constructor(private prisma: PrismaService) {}

  async get(userId: string) {
    const bm = await this.prisma.bookmark.findUnique({ where: { userId } });
    return bm ? { surah: bm.surah, ayah: bm.ayah, page: bm.page } : null;
  }

  async set(userId: string, page: number) {
    const first = await this.prisma.ayahRef.findFirst({
      where: { page },
      orderBy: [{ surah: 'asc' }, { ayah: 'asc' }],
    });
    if (!first) throw new NotFoundException(`No ayah found on page ${page}`);
    const data = { surah: first.surah, ayah: first.ayah, page };
    await this.prisma.bookmark.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return data;
  }
}
```

- [ ] **Step 4: Controller**

Create `api/src/bookmark/bookmark.controller.ts`:
```ts
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsInt, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BookmarkService } from './bookmark.service';

class SetBookmarkDto {
  @IsInt() @Min(1) @Max(604) page: number;
}

@UseGuards(JwtAuthGuard)
@Controller('bookmark')
export class BookmarkController {
  constructor(private bookmarks: BookmarkService) {}

  @Get()
  async get(@CurrentUser() user: { id: string }) {
    return (await this.bookmarks.get(user.id)) ?? {};
  }

  @Put()
  set(@CurrentUser() user: { id: string }, @Body() dto: SetBookmarkDto) {
    return this.bookmarks.set(user.id, dto.page);
  }
}
```

- [ ] **Step 5: Module + register**

Create `api/src/bookmark/bookmark.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { BookmarkService } from './bookmark.service';
import { BookmarkController } from './bookmark.controller';

@Module({
  controllers: [BookmarkController],
  providers: [BookmarkService],
})
export class BookmarkModule {}
```

Edit `api/src/app.module.ts` — add `BookmarkModule` to imports (keep existing):
```ts
import { BookmarkModule } from './bookmark/bookmark.module';
```
add `BookmarkModule` to the `imports: [...]` array.

- [ ] **Step 6: Run e2e — confirm green**

Run: `docker compose up -d && cd api && npm run test:e2e -- bookmark`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add api/src/bookmark api/src/app.module.ts api/test/bookmark.e2e-spec.ts
git commit -m "feat(api): add bookmark endpoints with e2e tests"
```

---

## Task 3: Favorites module + endpoints (TDD e2e)

**Files:** Create `api/src/favorites/favorites.service.ts`, `favorites.controller.ts`, `favorites.module.ts`, `dto/add-favorite.dto.ts`, `api/test/favorites.e2e-spec.ts`; modify `api/src/app.module.ts`.

- [ ] **Step 1: Write the e2e test (failing)**

Create `api/test/favorites.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Favorites (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const email = `fav${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = app.get(PrismaService);
    await app.init();
    const reg = await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password123', name: 'Fav' });
    token = reg.body.accessToken;
    userId = reg.body.user.id;
  });

  afterAll(async () => {
    await prisma.favorite.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('starts empty', async () => {
    const res = await request(app.getHttpServer()).get('/favorites').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toEqual([]);
  });

  it('adds a favorite and returns its page from AyahRef', async () => {
    const res = await request(app.getHttpServer()).post('/favorites').set('Authorization', `Bearer ${token}`).send({ surah: 2, ayah: 255 }).expect(201);
    expect(res.body.surah).toBe(2);
    expect(res.body.ayah).toBe(255);
    expect(res.body.page).toBeGreaterThan(0); // Ayat al-Kursi is on a real page
  });

  it('lists the favorite', async () => {
    const res = await request(app.getHttpServer()).get('/favorites').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ surah: 2, ayah: 255 });
  });

  it('is idempotent on duplicate add', async () => {
    await request(app.getHttpServer()).post('/favorites').set('Authorization', `Bearer ${token}`).send({ surah: 2, ayah: 255 }).expect(201);
    const res = await request(app.getHttpServer()).get('/favorites').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toHaveLength(1);
  });

  it('removes a favorite', async () => {
    await request(app.getHttpServer()).delete('/favorites/2/255').set('Authorization', `Bearer ${token}`).expect(200);
    const res = await request(app.getHttpServer()).get('/favorites').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toEqual([]);
  });

  it('requires auth', async () => {
    await request(app.getHttpServer()).get('/favorites').expect(401);
  });
});
```

- [ ] **Step 2: Run it — confirm it fails**

Run: `cd api && npm run test:e2e -- favorites`
Expected: FAIL.

- [ ] **Step 3: DTO**

Create `api/src/favorites/dto/add-favorite.dto.ts`:
```ts
import { IsInt, Min } from 'class-validator';

export class AddFavoriteDto {
  @IsInt() @Min(1) surah: number;
  @IsInt() @Min(1) ayah: number;
}
```

- [ ] **Step 4: Service**

Create `api/src/favorites/favorites.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  private async withPage(rows: { surah: number; ayah: number; createdAt: Date }[]) {
    return Promise.all(
      rows.map(async (r) => {
        const ref = await this.prisma.ayahRef.findUnique({ where: { surah_ayah: { surah: r.surah, ayah: r.ayah } } });
        return { surah: r.surah, ayah: r.ayah, page: ref?.page ?? 1, createdAt: r.createdAt };
      }),
    );
  }

  async list(userId: string) {
    const rows = await this.prisma.favorite.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return this.withPage(rows);
  }

  async add(userId: string, surah: number, ayah: number) {
    await this.prisma.favorite.upsert({
      where: { userId_surah_ayah: { userId, surah, ayah } },
      create: { userId, surah, ayah },
      update: {},
    });
    const ref = await this.prisma.ayahRef.findUnique({ where: { surah_ayah: { surah, ayah } } });
    return { surah, ayah, page: ref?.page ?? 1 };
  }

  async remove(userId: string, surah: number, ayah: number) {
    await this.prisma.favorite.deleteMany({ where: { userId, surah, ayah } });
    return { ok: true };
  }
}
```
> Note: the Prisma composite-key arg names are `surah_ayah` (for `AyahRef`'s `@@id([surah, ayah])`) and `userId_surah_ayah` (for `Favorite`'s `@@unique([userId, surah, ayah])`). Confirm the exact generated names with `npx prisma generate` output / editor autocomplete; adjust if Prisma names them differently.

- [ ] **Step 5: Controller**

Create `api/src/favorites/favorites.controller.ts`:
```ts
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FavoritesService } from './favorites.service';
import { AddFavoriteDto } from './dto/add-favorite.dto';

@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.favorites.list(user.id);
  }

  @Post()
  add(@CurrentUser() user: { id: string }, @Body() dto: AddFavoriteDto) {
    return this.favorites.add(user.id, dto.surah, dto.ayah);
  }

  @Delete(':surah/:ayah')
  remove(
    @CurrentUser() user: { id: string },
    @Param('surah', ParseIntPipe) surah: number,
    @Param('ayah', ParseIntPipe) ayah: number,
  ) {
    return this.favorites.remove(user.id, surah, ayah);
  }
}
```

- [ ] **Step 6: Module + register**

Create `api/src/favorites/favorites.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';

@Module({
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
```
Edit `api/src/app.module.ts` — add `FavoritesModule` to imports.

- [ ] **Step 7: Run e2e — confirm green**

Run: `cd api && npm run test:e2e -- favorites`
Expected: PASS (6 tests). If the composite-key arg names differ, fix the service and re-run.

- [ ] **Step 8: Commit**

```bash
git add api/src/favorites api/src/app.module.ts api/test/favorites.e2e-spec.ts
git commit -m "feat(api): add favorites endpoints with e2e tests"
```

---

## Task 4: Settings provider — theme + font scale (client)

**Files:** Create `web/src/settings/SettingsContext.tsx`, `web/src/settings/useSettings.ts`; modify `web/src/main.tsx`.

- [ ] **Step 1: SettingsContext**

Create `web/src/settings/SettingsContext.tsx`:
```tsx
import { createContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';
type SettingsValue = {
  theme: Theme;
  toggleTheme: () => void;
  fontScale: number;        // multiplier on the base Mushaf size
  setFontScale: (n: number) => void;
};

export const SettingsContext = createContext<SettingsValue | null>(null);

const MIN_SCALE = 0.8;
const MAX_SCALE = 1.8;

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [fontScale, setFontScaleState] = useState<number>(() => Number(localStorage.getItem('fontScale')) || 1);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => { localStorage.setItem('fontScale', String(fontScale)); }, [fontScale]);

  function toggleTheme() { setTheme((t) => (t === 'light' ? 'dark' : 'light')); }
  function setFontScale(n: number) { setFontScaleState(Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(n.toFixed(2))))); }

  return (
    <SettingsContext.Provider value={{ theme, toggleTheme, fontScale, setFontScale }}>
      {children}
    </SettingsContext.Provider>
  );
}
```

- [ ] **Step 2: useSettings hook**

Create `web/src/settings/useSettings.ts`:
```ts
import { useContext } from 'react';
import { SettingsContext } from './SettingsContext';

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
```

- [ ] **Step 3: Wrap the app**

Edit `web/src/main.tsx` — import and wrap `<App/>` with `<SettingsProvider>` (inside `QueryClientProvider`):
```tsx
import { SettingsProvider } from './settings/SettingsContext';
```
```tsx
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </QueryClientProvider>
```

- [ ] **Step 4: Build**

Run: `cd web && npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/settings web/src/main.tsx
git commit -m "feat(web): add settings provider for theme and font scale"
```

---

## Task 5: Theme toggle + font-size controls; apply scale to Mushaf

**Files:** Create `web/src/components/ThemeToggle.tsx`, `web/src/components/FontSizeControl.tsx`; modify `web/src/quran/MushafPage.tsx`.

- [ ] **Step 1: ThemeToggle**

Create `web/src/components/ThemeToggle.tsx`:
```tsx
import { useSettings } from '../settings/useSettings';

export function ThemeToggle() {
  const { theme, toggleTheme } = useSettings();
  return (
    <button onClick={toggleTheme} className="text-sm text-muted hover:text-ink dark:hover:text-ink-dark" aria-label="Toggle theme">
      {theme === 'light' ? '☾' : '☀'}
    </button>
  );
}
```

- [ ] **Step 2: FontSizeControl**

Create `web/src/components/FontSizeControl.tsx`:
```tsx
import { useSettings } from '../settings/useSettings';

export function FontSizeControl() {
  const { fontScale, setFontScale } = useSettings();
  return (
    <div className="flex items-center gap-2 text-muted">
      <button onClick={() => setFontScale(fontScale - 0.1)} className="text-sm" aria-label="Smaller text">A−</button>
      <span className="text-xs w-8 text-center">{Math.round(fontScale * 100)}%</span>
      <button onClick={() => setFontScale(fontScale + 0.1)} className="text-base" aria-label="Larger text">A+</button>
    </div>
  );
}
```

- [ ] **Step 3: Apply scale in MushafPage**

Edit `web/src/quran/MushafPage.tsx` — read `fontScale` from settings and apply it. Replace the render `<div>` so the base 28px is multiplied by `fontScale` via inline `fontSize`:
```tsx
import { useEffect } from 'react';
import { usePageData } from './usePageData';
import { ensureQcf2Css, pageFontFamily } from './pageFont';
import { MushafLine } from './MushafLine';
import { useSettings } from '../settings/useSettings';

export function MushafPage({ page }: { page: number }) {
  const { data, isLoading, isError } = usePageData(page);
  const { fontScale } = useSettings();
  useEffect(() => { ensureQcf2Css(); }, []);
  if (isLoading) return <div className="p-8 text-muted">Loading page {page}…</div>;
  if (isError || !data) return <div className="p-8 text-red-500">Could not load page {page}.</div>;
  return (
    <div
      className="mx-auto max-w-2xl px-4 py-6 text-ink dark:text-ink-dark"
      style={{ fontFamily: pageFontFamily(page), fontSize: `${28 * fontScale}px` }}
    >
      {data.lines.map((line) => (
        <MushafLine key={line.line} line={line} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Build**

Run: `cd web && npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ThemeToggle.tsx web/src/components/FontSizeControl.tsx web/src/quran/MushafPage.tsx
git commit -m "feat(web): theme toggle and font-size control applied to Mushaf"
```

---

## Task 6: Bookmark sync + resume

**Files:** Create `web/src/reading/useBookmark.ts`; modify `web/src/pages/ReadPage.tsx`, `web/src/pages/DashboardPage.tsx`.

- [ ] **Step 1: useBookmark hook**

Create `web/src/reading/useBookmark.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

type Bookmark = { surah: number; ayah: number; page: number };

export function useBookmark() {
  return useQuery({
    queryKey: ['bookmark'],
    queryFn: async (): Promise<Bookmark | null> => {
      const { data } = await api.get('/bookmark');
      return data && typeof data.page === 'number' ? data : null;
    },
  });
}

export function useSaveBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (page: number) => {
      const { data } = await api.put('/bookmark', { page });
      return data as Bookmark;
    },
    onSuccess: (data) => qc.setQueryData(['bookmark'], data),
  });
}
```

- [ ] **Step 2: Save bookmark on page change in ReadPage**

Edit `web/src/pages/ReadPage.tsx` — call `useSaveBookmark()` and persist whenever the page changes:
```tsx
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MushafPage } from '../quran/MushafPage';
import { useSaveBookmark } from '../reading/useBookmark';

export default function ReadPage() {
  const { page } = useParams();
  const navigate = useNavigate();
  const n = Math.min(604, Math.max(1, Number(page) || 1));
  const saveBookmark = useSaveBookmark();

  useEffect(() => { saveBookmark.mutate(n); /* eslint-disable-next-line */ }, [n]);

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
(The richer top bar is finalized in Task 8; this step only adds bookmark saving.)

- [ ] **Step 3: Resume from the dashboard**

Edit `web/src/pages/DashboardPage.tsx` — use the bookmark to target the resume link:
```tsx
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useBookmark } from '../reading/useBookmark';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { data: bookmark } = useBookmark();
  const resumePage = bookmark?.page ?? 1;
  return (
    <div className="min-h-screen p-6 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <span className="text-muted">Assalamu alaikum, {user?.name}</span>
        <button className="text-sm text-accent-soft" onClick={logout}>Log out</button>
      </div>
      <div className="bg-card-light dark:bg-card-dark rounded-2xl p-6 text-center space-y-3">
        <Link to={`/read/page/${resumePage}`} className="inline-block rounded-lg bg-accent text-white px-4 py-2">
          {bookmark ? `Continue · page ${resumePage}` : 'Start reading'}
        </Link>
        <div><Link to="/favorites" className="text-sm text-accent-soft">View favorites</Link></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build**

Run: `cd web && npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/reading/useBookmark.ts web/src/pages/ReadPage.tsx web/src/pages/DashboardPage.tsx
git commit -m "feat(web): bookmark sync on read and resume from dashboard"
```

---

## Task 7: Favorites — ayah selection + toggle in the Mushaf

**Files:** Create `web/src/reading/useFavorites.ts`, `web/src/quran/FavoriteBar.tsx`; modify `web/src/quran/MushafWord.tsx`, `web/src/quran/MushafLine.tsx`, `web/src/quran/MushafPage.tsx`.

- [ ] **Step 1: useFavorites hook**

Create `web/src/reading/useFavorites.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export type Favorite = { surah: number; ayah: number; page: number; createdAt?: string };

export function useFavorites() {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: async (): Promise<Favorite[]> => (await api.get('/favorites')).data,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { surah: number; ayah: number; favorited: boolean }) => {
      if (args.favorited) await api.delete(`/favorites/${args.surah}/${args.ayah}`);
      else await api.post('/favorites', { surah: args.surah, ayah: args.ayah });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });
}
```

- [ ] **Step 2: Selectable word**

Edit `web/src/quran/MushafWord.tsx`:
```tsx
import type { MushafWord as Word } from './types';

export function MushafWord({
  word,
  selected,
  onSelect,
}: {
  word: Word;
  selected: boolean;
  onSelect: (a: { surah: number; ayah: number }) => void;
}) {
  const base = word.type === 'end' ? 'text-muted' : '';
  const hl = selected ? 'bg-accent-soft/25 rounded' : '';
  return (
    <span
      className={`${base} ${hl} cursor-pointer`}
      data-surah={word.surah}
      data-ayah={word.ayah}
      onClick={() => onSelect({ surah: word.surah, ayah: word.ayah })}
    >
      {word.glyph}
    </span>
  );
}
```

- [ ] **Step 3: Thread selection through the line**

Edit `web/src/quran/MushafLine.tsx`:
```tsx
import type { MushafLine as Line } from './types';
import { MushafWord } from './MushafWord';

export function MushafLine({
  line,
  selected,
  onSelect,
}: {
  line: Line;
  selected: { surah: number; ayah: number } | null;
  onSelect: (a: { surah: number; ayah: number }) => void;
}) {
  return (
    <div className="flex justify-center items-center gap-1 leading-[2.6] whitespace-nowrap" dir="rtl">
      {line.words.map((w, i) => (
        <MushafWord
          key={i}
          word={w}
          selected={!!selected && selected.surah === w.surah && selected.ayah === w.ayah}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: FavoriteBar**

Create `web/src/quran/FavoriteBar.tsx`:
```tsx
import { useFavorites, useToggleFavorite } from '../reading/useFavorites';

export function FavoriteBar({
  selected,
  onClose,
}: {
  selected: { surah: number; ayah: number };
  onClose: () => void;
}) {
  const { data: favorites } = useFavorites();
  const toggle = useToggleFavorite();
  const favorited = !!favorites?.some((f) => f.surah === selected.surah && f.ayah === selected.ayah);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card-light dark:bg-card-dark shadow-lg rounded-full px-4 py-2 flex items-center gap-4">
      <span className="text-sm text-muted">{selected.surah}:{selected.ayah}</span>
      <button
        onClick={() => toggle.mutate({ surah: selected.surah, ayah: selected.ayah, favorited })}
        className={favorited ? 'text-red-500' : 'text-muted'}
        aria-label="Toggle favorite"
      >
        {favorited ? '♥ Favorited' : '♡ Favorite'}
      </button>
      <button onClick={onClose} className="text-muted" aria-label="Close">✕</button>
    </div>
  );
}
```

- [ ] **Step 5: Wire selection + bar into MushafPage**

Edit `web/src/quran/MushafPage.tsx` — add selection state and render the bar:
```tsx
import { useEffect, useState } from 'react';
import { usePageData } from './usePageData';
import { ensureQcf2Css, pageFontFamily } from './pageFont';
import { MushafLine } from './MushafLine';
import { FavoriteBar } from './FavoriteBar';
import { useSettings } from '../settings/useSettings';

export function MushafPage({ page }: { page: number }) {
  const { data, isLoading, isError } = usePageData(page);
  const { fontScale } = useSettings();
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(null);
  useEffect(() => { ensureQcf2Css(); }, []);
  useEffect(() => { setSelected(null); }, [page]); // clear selection when page changes

  if (isLoading) return <div className="p-8 text-muted">Loading page {page}…</div>;
  if (isError || !data) return <div className="p-8 text-red-500">Could not load page {page}.</div>;

  return (
    <>
      <div
        className="mx-auto max-w-2xl px-4 py-6 text-ink dark:text-ink-dark"
        style={{ fontFamily: pageFontFamily(page), fontSize: `${28 * fontScale}px` }}
      >
        {data.lines.map((line) => (
          <MushafLine key={line.line} line={line} selected={selected} onSelect={setSelected} />
        ))}
      </div>
      {selected && <FavoriteBar selected={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
```

- [ ] **Step 6: Build**

Run: `cd web && npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add web/src/reading/useFavorites.ts web/src/quran/FavoriteBar.tsx web/src/quran/MushafWord.tsx web/src/quran/MushafLine.tsx web/src/quran/MushafPage.tsx
git commit -m "feat(web): favorite ayahs via tap-to-select in the Mushaf"
```

---

## Task 8: Favorites page + read-view top bar

**Files:** Create `web/src/pages/FavoritesPage.tsx`; modify `web/src/App.tsx`, `web/src/pages/ReadPage.tsx`.

- [ ] **Step 1: FavoritesPage**

Create `web/src/pages/FavoritesPage.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { useFavorites } from '../reading/useFavorites';

export default function FavoritesPage() {
  const { data: favorites, isLoading } = useFavorites();
  return (
    <div className="min-h-screen p-6 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <Link to="/" className="text-sm text-accent-soft">‹ Home</Link>
        <h1 className="text-lg font-semibold">Favorites</h1>
        <span className="w-10" />
      </div>
      {isLoading && <p className="text-muted">Loading…</p>}
      {favorites && favorites.length === 0 && <p className="text-muted text-center">No favorites yet. Tap an ayah while reading to save it.</p>}
      <ul className="space-y-2">
        {favorites?.map((f) => (
          <li key={`${f.surah}:${f.ayah}`}>
            <Link to={`/read/page/${f.page}`} className="block bg-card-light dark:bg-card-dark rounded-xl px-4 py-3 hover:opacity-90">
              <span className="font-medium">Surah {f.surah}, Ayah {f.ayah}</span>
              <span className="text-muted text-sm"> · page {f.page}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Add the route**

Edit `web/src/App.tsx` — import and add a protected `/favorites` route:
```tsx
import FavoritesPage from './pages/FavoritesPage';
```
```tsx
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <FavoritesPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 3: Finalize the read-view top bar**

Edit `web/src/pages/ReadPage.tsx` — replace the top bar with one that includes a back link, theme toggle, and font-size control (keep the bookmark-save effect from Task 6):
```tsx
import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MushafPage } from '../quran/MushafPage';
import { useSaveBookmark } from '../reading/useBookmark';
import { ThemeToggle } from '../components/ThemeToggle';
import { FontSizeControl } from '../components/FontSizeControl';

export default function ReadPage() {
  const { page } = useParams();
  const navigate = useNavigate();
  const n = Math.min(604, Math.max(1, Number(page) || 1));
  const saveBookmark = useSaveBookmark();

  useEffect(() => { saveBookmark.mutate(n); /* eslint-disable-next-line */ }, [n]);

  return (
    <div className="min-h-screen">
      <div className="flex justify-between items-center px-4 py-3 text-sm border-b border-muted/20">
        <Link to="/" className="text-accent-soft">‹ Home</Link>
        <div className="flex items-center gap-4">
          <FontSizeControl />
          <ThemeToggle />
        </div>
      </div>
      <div className="flex justify-between items-center px-4 py-2 text-sm text-muted">
        <button onClick={() => navigate(`/read/page/${n - 1}`)} disabled={n <= 1} className="disabled:opacity-30">‹ Prev</button>
        <span>Page {n} / 604</span>
        <button onClick={() => navigate(`/read/page/${n + 1}`)} disabled={n >= 604} className="disabled:opacity-30">Next ›</button>
      </div>
      <MushafPage page={n} />
    </div>
  );
}
```

- [ ] **Step 4: Build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/FavoritesPage.tsx web/src/App.tsx web/src/pages/ReadPage.tsx
git commit -m "feat(web): favorites page and reading-view top bar (back, font, theme)"
```

---

## Task 9: Visual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Ensure the stack is running**

`docker compose up -d`; API `cd api && npm run start:dev`; web `cd web && npm run dev` (skip any already running on :3000/:5173).

- [ ] **Step 2: Verify via browser (Playwright)**

Log in, then:
1. Go to `/read/page/2`. Tap **A+** a few times → the Arabic visibly grows; tap the theme toggle (☾/☀) → page switches to dark Quiet Slate. Reload → font size and theme persist (localStorage).
2. Tap a word → its whole ayah highlights and the floating bar shows `2:N` with **♡ Favorite**. Tap it → becomes **♥ Favorited**.
3. Navigate `Next ›` a couple pages, then go to `/` (dashboard) → the resume link now reads **"Continue · page N"** (the last page visited).
4. Go to `/favorites` → the favorited ayah is listed; clicking it opens its page.
5. Confirm token-auth requests succeed (favorites/bookmark persisted to Postgres).

- [ ] **Step 3: Confirm persistence in Postgres**

Run:
```bash
docker compose exec -T db psql -U quran -d quran -c 'select count(*) from "Favorite"; select * from "Bookmark" limit 3;'
```
Expected: at least 1 favorite; a bookmark row for the test user.

- [ ] **Step 4: Report**

Report pass/fail with a screenshot of the dark-mode reading view showing a selected/favorited ayah. Fix any issue before declaring done.

---

## Self-Review Notes

- **Spec coverage (§6 reading view):** light/dark toggle (Tasks 4–5), adjustable font `Aa` (Task 5), resume bookmark (Tasks 1–2, 6), favorites (Tasks 1, 3, 7–8). Large default Arabic font remains from Phase 2 (base 28px × scale).
- **Deferred (correct):** audio + word-by-word highlight (Phase 4); session tracking / Hasanat counters (Phase 5); syncing theme + font scale into the backend `user_settings` (Phase 7 — kept client-side here on purpose).
- **Type consistency:** bookmark shape `{ surah, ayah, page }` is produced by `BookmarkService.set/get`, returned by the controller, and consumed by `useBookmark`/`useSaveBookmark` and `DashboardPage`. Favorite shape `{ surah, ayah, page }` is produced by `FavoritesService`, consumed by `useFavorites`, `FavoriteBar`, and `FavoritesPage`. Selection object `{ surah, ayah }` is threaded identically through `MushafPage → MushafLine → MushafWord` and into `FavoriteBar`.
- **Prisma composite keys:** the service code assumes generated arg names `surah_ayah` (AyahRef) and `userId_surah_ayah` (Favorite). Task 3 Step 7 re-runs e2e to catch any naming mismatch.
```
