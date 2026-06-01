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
