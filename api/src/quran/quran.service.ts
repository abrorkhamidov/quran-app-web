import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const TOTAL_PAGES = 604;

export type DimensionProgress = { id: number; ayahsRead: number; ayahCount: number; percent: number };
export type Coverage = {
  overall: { pagesRead: number; totalPages: number; percent: number };
  juz: DimensionProgress[];
  surah: DimensionProgress[];
};

@Injectable()
export class QuranService {
  constructor(private prisma: PrismaService) {}

  async coverage(userId: string): Promise<Coverage> {
    const read = await this.prisma.pageRead.findMany({ where: { userId }, select: { page: true } });
    const pages = read.map((r) => r.page);

    const [juzTotals, surahTotals, juzRead, surahRead] = await Promise.all([
      this.prisma.ayahRef.groupBy({ by: ['juz'], _count: { _all: true } }),
      this.prisma.ayahRef.groupBy({ by: ['surah'], _count: { _all: true } }),
      this.prisma.ayahRef.groupBy({ by: ['juz'], where: { page: { in: pages } }, _count: { _all: true } }),
      this.prisma.ayahRef.groupBy({ by: ['surah'], where: { page: { in: pages } }, _count: { _all: true } }),
    ]);

    const readByJuz = new Map(juzRead.map((r) => [r.juz, r._count._all]));
    const readBySurah = new Map(surahRead.map((r) => [r.surah, r._count._all]));
    const pct = (read: number, total: number) => (total ? Math.round((read / total) * 100) : 0);

    const juz = juzTotals
      .map((t) => {
        const ayahsRead = readByJuz.get(t.juz) ?? 0;
        return { id: t.juz, ayahsRead, ayahCount: t._count._all, percent: pct(ayahsRead, t._count._all) };
      })
      .sort((a, b) => a.id - b.id);

    const surah = surahTotals
      .map((t) => {
        const ayahsRead = readBySurah.get(t.surah) ?? 0;
        return { id: t.surah, ayahsRead, ayahCount: t._count._all, percent: pct(ayahsRead, t._count._all) };
      })
      .sort((a, b) => a.id - b.id);

    return {
      overall: { pagesRead: pages.length, totalPages: TOTAL_PAGES, percent: pct(pages.length, TOTAL_PAGES) },
      juz,
      surah,
    };
  }
}
