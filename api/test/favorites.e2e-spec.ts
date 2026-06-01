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
