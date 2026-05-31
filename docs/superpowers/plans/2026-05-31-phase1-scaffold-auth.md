# Phase 1: Scaffold + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo (NestJS API + React web + Postgres) with a complete email/password JWT auth flow — register, login, refresh, and an authenticated dashboard placeholder.

**Architecture:** A two-app repo: `api/` (NestJS + Prisma + Postgres) exposes a REST auth API with access + refresh JWTs; `web/` (React + Vite + Tailwind, Quiet Slate theme) consumes it via an axios client and TanStack Query, gating a placeholder dashboard behind a protected route. Postgres runs via docker-compose.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL 16, Passport-JWT, argon2, Jest + supertest; React 18, Vite 5, TypeScript, Tailwind 3, react-router-dom 6, @tanstack/react-query 5, axios, Vitest + React Testing Library.

---

## File Structure

```
quran-app/
├── docker-compose.yml          # Postgres 16 service
├── .gitignore
├── api/
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── .env                    # DATABASE_URL, JWT secrets (gitignored)
│   ├── .env.example
│   ├── prisma/
│   │   └── schema.prisma       # User model
│   ├── src/
│   │   ├── main.ts             # bootstrap, global validation pipe, CORS
│   │   ├── app.module.ts
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.service.ts        # register/login/refresh logic
│   │   │   ├── auth.controller.ts     # routes
│   │   │   ├── password.service.ts    # argon2 hash/verify
│   │   │   ├── jwt.strategy.ts        # access-token passport strategy
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── current-user.decorator.ts
│   │   │   └── dto/
│   │   │       ├── register.dto.ts
│   │   │       ├── login.dto.ts
│   │   │       └── refresh.dto.ts
│   │   └── users/
│   │       └── users.service.ts       # db access for users
│   └── test/
│       ├── password.service.spec.ts
│       └── auth.e2e-spec.ts
└── web/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── .env                    # VITE_API_URL
    └── src/
        ├── main.tsx
        ├── App.tsx             # router
        ├── index.css           # tailwind + Quiet Slate tokens
        ├── lib/
        │   ├── api.ts          # axios instance + token handling
        │   └── queryClient.ts
        ├── auth/
        │   ├── AuthContext.tsx
        │   ├── useAuth.ts
        │   └── ProtectedRoute.tsx
        └── pages/
            ├── LoginPage.tsx
            ├── RegisterPage.tsx
            └── DashboardPage.tsx   # placeholder
```

---

## Task 0: Repo scaffold + Postgres

**Files:**
- Create: `docker-compose.yml`
- Modify: `.gitignore` (already exists)

- [ ] **Step 1: Create docker-compose.yml for Postgres**

```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: quran
      POSTGRES_PASSWORD: quran
      POSTGRES_DB: quran
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

- [ ] **Step 2: Ensure .gitignore covers node + env**

Confirm `.gitignore` contains these lines (append any missing):

```
node_modules/
dist/
.env
*.log
.superpowers/
```

- [ ] **Step 3: Start Postgres and verify it is reachable**

Run: `docker compose up -d && sleep 3 && docker compose exec -T db pg_isready -U quran`
Expected: `... accepting connections`

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .gitignore
git commit -m "chore: add Postgres docker-compose and gitignore"
```

---

## Task 1: NestJS API bootstrap

**Files:**
- Create: `api/package.json`, `api/tsconfig.json`, `api/nest-cli.json`, `api/src/main.ts`, `api/src/app.module.ts`, `api/.env`, `api/.env.example`

- [ ] **Step 1: Initialize the API package and install deps**

Run:
```bash
mkdir -p api/src && cd api && npm init -y && \
npm i @nestjs/common@^10 @nestjs/core@^10 @nestjs/platform-express@^10 @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt argon2 class-validator class-transformer reflect-metadata rxjs && \
npm i -D typescript ts-node @types/node @types/passport-jwt @nestjs/cli @nestjs/testing jest ts-jest @types/jest supertest @types/supertest
```
Expected: dependencies installed, `api/node_modules` created.

- [ ] **Step 2: Add tsconfig.json**

Create `api/tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "moduleResolution": "node",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "strict": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 3: Add nest-cli.json and package scripts**

Create `api/nest-cli.json`:
```json
{ "collection": "@nestjs/schematics", "sourceRoot": "src" }
```

Edit `api/package.json` `"scripts"` to:
```json
"scripts": {
  "start": "nest start",
  "start:dev": "nest start --watch",
  "build": "nest build",
  "test": "jest",
  "test:e2e": "jest --config ./test/jest-e2e.json",
  "prisma": "prisma"
}
```

- [ ] **Step 4: Create env files**

Create `api/.env`:
```
DATABASE_URL="postgresql://quran:quran@localhost:5432/quran?schema=public"
JWT_ACCESS_SECRET="dev-access-secret-change-me"
JWT_REFRESH_SECRET="dev-refresh-secret-change-me"
JWT_ACCESS_TTL="900s"
JWT_REFRESH_TTL="30d"
WEB_ORIGIN="http://localhost:5173"
```

Create `api/.env.example` with the same keys but empty/placeholder values.

- [ ] **Step 5: Create app.module.ts**

Create `api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
})
export class AppModule {}
```

- [ ] **Step 6: Create main.ts**

Create `api/src/main.ts`:
```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const config = app.get(ConfigService);
  app.enableCors({ origin: config.get('WEB_ORIGIN'), credentials: true });
  await app.listen(3000);
}
bootstrap();
```

- [ ] **Step 7: Verify the API boots**

Run: `cd api && npm run start &` then `sleep 4 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` then stop it (`kill %1`).
Expected: a `404` status (server up, no routes yet — this is success).

- [ ] **Step 8: Commit**

```bash
git add api/package.json api/package-lock.json api/tsconfig.json api/nest-cli.json api/src api/.env.example
git commit -m "feat(api): bootstrap NestJS app with config and validation"
```

---

## Task 2: Prisma + User model

**Files:**
- Create: `api/prisma/schema.prisma`, `api/src/prisma/prisma.service.ts`, `api/src/prisma/prisma.module.ts`

- [ ] **Step 1: Install Prisma and init**

Run: `cd api && npm i -D prisma && npm i @prisma/client && npx prisma init --datasource-provider postgresql`
Expected: `prisma/schema.prisma` created (overwrite its model section next step).

- [ ] **Step 2: Define the User model**

Replace `api/prisma/schema.prisma` with:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  createdAt    DateTime @default(now())
}
```

- [ ] **Step 3: Run the first migration**

Run: `cd api && npx prisma migrate dev --name init_user`
Expected: migration applied, `User` table created, Prisma Client generated.

- [ ] **Step 4: Create PrismaService**

Create `api/src/prisma/prisma.service.ts`:
```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

- [ ] **Step 5: Create PrismaModule (global)**

Create `api/src/prisma/prisma.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 6: Register PrismaModule in AppModule**

Edit `api/src/app.module.ts` imports array to include `PrismaModule`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
})
export class AppModule {}
```

- [ ] **Step 7: Commit**

```bash
git add api/prisma api/src/prisma api/src/app.module.ts api/package.json api/package-lock.json
git commit -m "feat(api): add Prisma with User model and migration"
```

---

## Task 3: Password hashing service (TDD)

**Files:**
- Create: `api/src/auth/password.service.ts`, `api/test/password.service.spec.ts`, `api/jest.config.js`

- [ ] **Step 1: Add Jest config**

Create `api/jest.config.js`:
```js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
};
```

- [ ] **Step 2: Write the failing test**

Create `api/test/password.service.spec.ts`:
```ts
import { PasswordService } from '../src/auth/password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a password to a non-plaintext string', async () => {
    const hash = await service.hash('s3cret!');
    expect(hash).not.toBe('s3cret!');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifies a correct password', async () => {
    const hash = await service.hash('s3cret!');
    expect(await service.verify(hash, 's3cret!')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('s3cret!');
    expect(await service.verify(hash, 'wrong')).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd api && npx jest password.service`
Expected: FAIL — cannot find module `../src/auth/password.service`.

- [ ] **Step 4: Implement PasswordService**

Create `api/src/auth/password.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain);
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd api && npx jest password.service`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add api/jest.config.js api/src/auth/password.service.ts api/test/password.service.spec.ts
git commit -m "feat(api): add argon2 password hashing service with tests"
```

---

## Task 4: Users service

**Files:**
- Create: `api/src/users/users.service.ts`, `api/src/users/users.module.ts`

- [ ] **Step 1: Create UsersService**

Create `api/src/users/users.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: { email: string; passwordHash: string; name: string }) {
    return this.prisma.user.create({ data });
  }
}
```

- [ ] **Step 2: Create UsersModule**

Create `api/src/users/users.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 3: Commit**

```bash
git add api/src/users
git commit -m "feat(api): add users service"
```

---

## Task 5: Auth DTOs + service + register endpoint (TDD e2e)

**Files:**
- Create: `api/src/auth/dto/register.dto.ts`, `api/src/auth/dto/login.dto.ts`, `api/src/auth/dto/refresh.dto.ts`, `api/src/auth/auth.service.ts`, `api/src/auth/auth.controller.ts`, `api/src/auth/auth.module.ts`, `api/test/auth.e2e-spec.ts`, `api/test/jest-e2e.json`

- [ ] **Step 1: Create the DTOs**

Create `api/src/auth/dto/register.dto.ts`:
```ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  name: string;
}
```

Create `api/src/auth/dto/login.dto.ts`:
```ts
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

Create `api/src/auth/dto/refresh.dto.ts`:
```ts
import { IsString } from 'class-validator';

export class RefreshDto {
  @IsString()
  refreshToken: string;
}
```

- [ ] **Step 2: Create AuthService with token helpers + register/login/refresh**

Create `api/src/auth/auth.service.ts`:
```ts
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private passwords: PasswordService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  private async issueTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_TTL'),
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_TTL'),
    });
    return { accessToken, refreshToken };
  }

  private publicUser(u: { id: string; email: string; name: string }) {
    return { id: u.id, email: u.email, name: u.name };
  }

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.users.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });
    const tokens = await this.issueTokens(user.id, user.email);
    return { user: this.publicUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await this.passwords.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const tokens = await this.issueTokens(user.id, user.email);
    return { user: this.publicUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; email: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const tokens = await this.issueTokens(payload.sub, payload.email);
    return tokens;
  }
}
```

- [ ] **Step 3: Create AuthController**

Create `api/src/auth/auth.controller.ts`:
```ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { id: string; email: string }) {
    return user;
  }
}
```

- [ ] **Step 4: Create the e2e jest config and the register test (failing)**

Create `api/test/jest-e2e.json`:
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.ts$": "ts-jest" }
}
```

Create `api/test/auth.e2e-spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `t${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('registers a new user and returns tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123', name: 'Test' })
      .expect(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate registration', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123', name: 'Test' })
      .expect(409);
  });

  it('rejects invalid email', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'nope', password: 'password123', name: 'X' })
      .expect(400);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrongpass' })
      .expect(401);
  });

  it('returns the current user from /auth/me with a valid token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' });
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(email);
  });

  it('rejects /auth/me without a token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('refreshes tokens with a valid refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' });
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
  });
});
```

- [ ] **Step 5: Create AuthModule (JWT, strategy, guard wired in Task 6)**

Create `api/src/auth/auth.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordService } from './password.service';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, JwtStrategy],
})
export class AuthModule {}
```

- [ ] **Step 6: Register AuthModule in AppModule**

Edit `api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule],
})
export class AppModule {}
```

(The JWT strategy, guard, and decorator are created in Task 6 — the e2e test is run there once those exist.)

- [ ] **Step 7: Commit**

```bash
git add api/src/auth api/test/auth.e2e-spec.ts api/test/jest-e2e.json api/src/app.module.ts
git commit -m "feat(api): add auth service, controller, DTOs and e2e tests"
```

---

## Task 6: JWT strategy, guard, decorator, and green e2e

**Files:**
- Create: `api/src/auth/jwt.strategy.ts`, `api/src/auth/jwt-auth.guard.ts`, `api/src/auth/current-user.decorator.ts`

- [ ] **Step 1: Create the JWT access-token strategy**

Create `api/src/auth/jwt.strategy.ts`:
```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: user.email, name: user.name };
  }
}
```

- [ ] **Step 2: Create the guard**

Create `api/src/auth/jwt-auth.guard.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 3: Create the current-user decorator**

Create `api/src/auth/current-user.decorator.ts`:
```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().user;
  },
);
```

- [ ] **Step 4: Run the full auth e2e suite (requires Postgres running)**

Run: `docker compose up -d && cd api && npm run test:e2e`
Expected: PASS — all 8 tests in `auth.e2e-spec.ts` green.

- [ ] **Step 5: Commit**

```bash
git add api/src/auth/jwt.strategy.ts api/src/auth/jwt-auth.guard.ts api/src/auth/current-user.decorator.ts
git commit -m "feat(api): add JWT strategy, guard, and current-user decorator"
```

---

## Task 7: Web scaffold + Quiet Slate theme

**Files:**
- Create: `web/` Vite app, `web/tailwind.config.js`, `web/postcss.config.js`, `web/src/index.css`, `web/.env`

- [ ] **Step 1: Scaffold the Vite React-TS app and install deps**

Run:
```bash
npm create vite@latest web -- --template react-ts && cd web && npm install && \
npm i react-router-dom @tanstack/react-query axios && \
npm i -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom
```
Expected: `web/` created, deps installed.

- [ ] **Step 2: Init Tailwind**

Run: `cd web && npx tailwindcss init -p`
Expected: `tailwind.config.js` and `postcss.config.js` created.

- [ ] **Step 3: Configure Tailwind with Quiet Slate tokens**

Replace `web/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Quiet Slate — muted greys, soft indigo accent
        ink: { DEFAULT: '#2b3038', dark: '#e4e6ea' },
        muted: '#8b919b',
        surface: { light: '#f3f4f6', dark: '#1a1d23' },
        card: { light: '#e9ebef', dark: '#23272f' },
        accent: { DEFAULT: '#4a5568', soft: '#7d8aa3' },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 4: Set up index.css and env**

Replace `web/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: light dark; }
body { @apply bg-surface-light text-ink antialiased; }
.dark body { @apply bg-surface-dark text-ink-dark; }
```

Create `web/.env`:
```
VITE_API_URL=http://localhost:3000
```

- [ ] **Step 5: Verify the web app builds**

Run: `cd web && npm run build`
Expected: build succeeds, `web/dist` produced.

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/package-lock.json web/tailwind.config.js web/postcss.config.js web/src/index.css web/.env web/vite.config.ts web/index.html
git commit -m "feat(web): scaffold Vite React app with Quiet Slate Tailwind theme"
```

---

## Task 8: API client + auth context

**Files:**
- Create: `web/src/lib/api.ts`, `web/src/lib/queryClient.ts`, `web/src/auth/AuthContext.tsx`, `web/src/auth/useAuth.ts`

- [ ] **Step 1: Create the axios client with token attach + refresh-on-401**

Create `web/src/lib/api.ts`:
```ts
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

export function setAccessToken(token: string | null) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

export function getStoredRefresh(): string | null {
  return localStorage.getItem('refreshToken');
}

export function storeRefresh(token: string | null) {
  if (token) localStorage.setItem('refreshToken', token);
  else localStorage.removeItem('refreshToken');
}

export default api;
```

- [ ] **Step 2: Create the query client**

Create `web/src/lib/queryClient.ts`:
```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
```

- [ ] **Step 3: Create AuthContext**

Create `web/src/auth/AuthContext.tsx`:
```tsx
import { createContext, useEffect, useState, ReactNode } from 'react';
import api, { setAccessToken, storeRefresh, getStoredRefresh } from '../lib/api';

export type User = { id: string; email: string; name: string };

type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  function applySession(data: { user: User; accessToken: string; refreshToken: string }) {
    setAccessToken(data.accessToken);
    storeRefresh(data.refreshToken);
    setUser(data.user);
  }

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    applySession(data);
  }

  async function register(email: string, password: string, name: string) {
    const { data } = await api.post('/auth/register', { email, password, name });
    applySession(data);
  }

  function logout() {
    setAccessToken(null);
    storeRefresh(null);
    setUser(null);
  }

  useEffect(() => {
    const refreshToken = getStoredRefresh();
    if (!refreshToken) { setLoading(false); return; }
    api
      .post('/auth/refresh', { refreshToken })
      .then(async ({ data }) => {
        setAccessToken(data.accessToken);
        storeRefresh(data.refreshToken);
        const me = await api.get('/auth/me');
        setUser(me.data);
      })
      .catch(() => { storeRefresh(null); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 4: Create useAuth hook**

Create `web/src/auth/useAuth.ts`:
```ts
import { useContext } from 'react';
import { AuthContext } from './AuthContext';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 5: Commit**

```bash
git add web/src/lib web/src/auth/AuthContext.tsx web/src/auth/useAuth.ts
git commit -m "feat(web): add api client and auth context"
```

---

## Task 9: Pages, protected route, and router

**Files:**
- Create: `web/src/auth/ProtectedRoute.tsx`, `web/src/pages/LoginPage.tsx`, `web/src/pages/RegisterPage.tsx`, `web/src/pages/DashboardPage.tsx`
- Modify: `web/src/App.tsx`, `web/src/main.tsx`

- [ ] **Step 1: Create ProtectedRoute**

Create `web/src/auth/ProtectedRoute.tsx`:
```tsx
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 2: Create LoginPage**

Create `web/src/pages/LoginPage.tsx`:
```tsx
import { FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Invalid email or password');
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-card-light dark:bg-card-dark rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">Sign in</h1>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <input className="w-full rounded-lg border border-muted/30 bg-transparent px-3 py-2"
          type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full rounded-lg border border-muted/30 bg-transparent px-3 py-2"
          type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="w-full rounded-lg bg-accent text-white py-2" type="submit">Sign in</button>
        <p className="text-sm text-muted">No account? <Link className="text-accent-soft" to="/register">Create one</Link></p>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create RegisterPage**

Create `web/src/pages/RegisterPage.tsx`:
```tsx
import { FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await register(email, password, name);
      navigate('/');
    } catch {
      setError('Could not create account (email may be in use, password min 8 chars)');
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-card-light dark:bg-card-dark rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">Create account</h1>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <input className="w-full rounded-lg border border-muted/30 bg-transparent px-3 py-2"
          placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="w-full rounded-lg border border-muted/30 bg-transparent px-3 py-2"
          type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full rounded-lg border border-muted/30 bg-transparent px-3 py-2"
          type="password" placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="w-full rounded-lg bg-accent text-white py-2" type="submit">Create account</button>
        <p className="text-sm text-muted">Have an account? <Link className="text-accent-soft" to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Create DashboardPage placeholder**

Create `web/src/pages/DashboardPage.tsx`:
```tsx
import { useAuth } from '../auth/useAuth';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen p-6 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <span className="text-muted">Assalamu alaikum, {user?.name}</span>
        <button className="text-sm text-accent-soft" onClick={logout}>Log out</button>
      </div>
      <div className="bg-card-light dark:bg-card-dark rounded-2xl p-6 text-center">
        <p className="text-muted">Dashboard coming in Phase 6.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire the router in App.tsx**

Replace `web/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Wire providers in main.tsx**

Replace `web/src/main.tsx`:
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

- [ ] **Step 7: Commit**

```bash
git add web/src/auth/ProtectedRoute.tsx web/src/pages web/src/App.tsx web/src/main.tsx
git commit -m "feat(web): add auth pages, protected route, and router"
```

---

## Task 10: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start everything**

Run in three terminals (or background): `docker compose up -d`; `cd api && npm run start:dev`; `cd web && npm run dev`.
Expected: API on `:3000`, web on `:5173`, Postgres on `:5432`.

- [ ] **Step 2: Verify the full flow in the browser**

Open `http://localhost:5173`, get redirected to `/login`, click "Create one", register a new account.
Expected: redirected to the dashboard showing "Assalamu alaikum, <name>".

- [ ] **Step 3: Verify session persistence**

Refresh the page.
Expected: still on the dashboard (refresh-token flow restored the session), not bounced to login.

- [ ] **Step 4: Verify logout + login**

Click "Log out" (redirects to login), then sign in with the same credentials.
Expected: back on the dashboard.

- [ ] **Step 5: Final commit (if any tweaks were needed)**

```bash
git add -A
git commit -m "chore: phase 1 scaffold + auth verified end-to-end"
```

---

## Self-Review Notes

- **Spec coverage:** Implements §2 stack (NestJS/Prisma/Postgres/React/Vite/Tailwind), §3b user table (User model), §5 `/auth/*` endpoints (register/login/refresh/me), §6 Quiet Slate theme + protected routing. Other spec sections (content, reading, audio, sessions, dashboard, stats) are explicitly deferred to Phases 2–8.
- **Deferred from full data model:** `user_settings`, `reading_session`, `daily_progress`, `streak`, `bookmark`, `favorite`, `ayah_ref` tables are added in their owning phases (settings in Phase 7, the rest in Phases 2/3/5/8), not Phase 1.
- **Type consistency:** token response shape `{ user, accessToken, refreshToken }` is produced by `AuthService` and consumed identically in `AuthContext.applySession`. `/auth/me` returns `{ id, email, name }` matching the `User` type in the web app.
