import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_GOAL_SECONDS } from '../sessions/sessions.service';
import { effectiveCurrent } from '../sessions/streak';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async summary(userId: string, date: string) {
    const today = await this.prisma.dailyProgress.findUnique({ where: { userId_date: { userId, date } } });
    const agg = await this.prisma.dailyProgress.aggregate({
      where: { userId },
      _sum: { secondsRead: true, versesRead: true, pagesRead: true, hasanat: true },
    });
    const streak = (await this.prisma.streak.findUnique({ where: { userId } })) ?? { currentStreak: 0, longestStreak: 0, lastActiveDate: null };

    return {
      goalTargetSeconds: DEFAULT_GOAL_SECONDS,
      today: {
        secondsRead: today?.secondsRead ?? 0,
        versesRead: today?.versesRead ?? 0,
        pagesRead: today?.pagesRead ?? 0,
        hasanat: today?.hasanat ?? 0,
        goalMet: today?.goalMet ?? false,
      },
      lifetime: {
        seconds: agg._sum.secondsRead ?? 0,
        verses: agg._sum.versesRead ?? 0,
        pages: agg._sum.pagesRead ?? 0,
        hasanat: agg._sum.hasanat ?? 0,
      },
      streak: { current: effectiveCurrent(streak, date), longest: streak.longestStreak },
    };
  }
}
