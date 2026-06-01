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
