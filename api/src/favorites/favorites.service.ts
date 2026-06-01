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
