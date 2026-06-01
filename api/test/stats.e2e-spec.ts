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
});
