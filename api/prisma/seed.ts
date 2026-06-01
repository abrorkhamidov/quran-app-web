import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Ref = { surah: number; ayah: number; page: number; juz: number; letterCount: number };

async function main() {
  const path = resolve(__dirname, '../../scripts/generated/ayah-ref.json');
  const rows: Ref[] = JSON.parse(readFileSync(path, 'utf8'));
  await prisma.ayahRef.deleteMany();
  for (let i = 0; i < rows.length; i += 500) {
    await prisma.ayahRef.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
  }
  console.log(`seeded ${rows.length} ayah-ref rows`);
}

main().finally(() => prisma.$disconnect());
