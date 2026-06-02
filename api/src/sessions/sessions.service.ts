import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordSessionDto } from './dto/record-session.dto';
import { nextStreak, StreakState } from './streak';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  async record(userId: string, dto: RecordSessionDto) {
    const pages = [...new Set(dto.pages)].filter((p) => p >= 1 && p <= 604);
    const ayahs = await this.prisma.ayahRef.findMany({
      where: { page: { in: pages } },
      orderBy: [{ surah: 'asc' }, { ayah: 'asc' }],
    });
    const hasanat = ayahs.reduce((sum, a) => sum + a.letterCount, 0);
    const versesCount = ayahs.length;
    const pagesCount = pages.length;
    const first = ayahs[0];
    const last = ayahs[ayahs.length - 1];

    await this.prisma.readingSession.create({
      data: {
        userId,
        date: dto.date,
        durationSeconds: dto.durationSeconds,
        versesCount,
        pagesCount,
        hasanat,
        startSurah: first?.surah ?? 0,
        startAyah: first?.ayah ?? 0,
        endSurah: last?.surah ?? 0,
        endAyah: last?.ayah ?? 0,
      },
    });

    const dp = await this.prisma.dailyProgress.upsert({
      where: { userId_date: { userId, date: dto.date } },
      create: { userId, date: dto.date, secondsRead: dto.durationSeconds, versesRead: versesCount, pagesRead: pagesCount, hasanat },
      update: {
        secondsRead: { increment: dto.durationSeconds },
        versesRead: { increment: versesCount },
        pagesRead: { increment: pagesCount },
        hasanat: { increment: hasanat },
      },
    });

    const goalTargetSeconds = await this.settings.getGoalSeconds(userId);
    const goalMet = dp.secondsRead >= goalTargetSeconds;
    let streakState: StreakState =
      (await this.prisma.streak.findUnique({ where: { userId } })) ?? { currentStreak: 0, longestStreak: 0, lastActiveDate: null };

    if (goalMet && !dp.goalMet) {
      await this.prisma.dailyProgress.update({ where: { userId_date: { userId, date: dto.date } }, data: { goalMet: true } });
      streakState = nextStreak(streakState, dto.date);
      await this.prisma.streak.upsert({
        where: { userId },
        create: { userId, ...streakState },
        update: { currentStreak: streakState.currentStreak, longestStreak: streakState.longestStreak, lastActiveDate: streakState.lastActiveDate },
      });
    }

    return {
      today: {
        secondsRead: dp.secondsRead,
        versesRead: dp.versesRead,
        pagesRead: dp.pagesRead,
        hasanat: dp.hasanat,
        goalMet,
      },
      streak: { current: streakState.currentStreak, longest: streakState.longestStreak },
      goalTargetSeconds,
    };
  }
}
