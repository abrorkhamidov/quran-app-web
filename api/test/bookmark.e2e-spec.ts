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
