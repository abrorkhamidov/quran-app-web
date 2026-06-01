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
