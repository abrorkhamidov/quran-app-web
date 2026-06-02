import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { effectiveCurrent, isoMinus1 } from '../sessions/streak';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  async summary(userId: string, date: string) {
    const today = await this.prisma.dailyProgress.findUnique({ where: { userId_date: { userId, date } } });
    const agg = await this.prisma.dailyProgress.aggregate({
      where: { userId },
      _sum: { secondsRead: true, versesRead: true, pagesRead: true, hasanat: true },
    });
    const streak = (await this.prisma.streak.findUnique({ where: { userId } })) ?? { currentStreak: 0, longestStreak: 0, lastActiveDate: null };
    const goal = await this.settings.getGoal(userId);

    return {
      goal,
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

  async week(userId: string, date: string) {
    // build the 7 dates ending at `date`, oldest first
    const dates: string[] = [];
    let d = date;
    for (let i = 0; i < 7; i++) { dates.unshift(d); d = isoMinus1(d); }
    const rows = await this.prisma.dailyProgress.findMany({ where: { userId, date: { in: dates } } });
    const byDate = new Map(rows.map((r) => [r.date, r]));
    return dates.map((dt) => ({ date: dt, goalMet: byDate.get(dt)?.goalMet ?? false, secondsRead: byDate.get(dt)?.secondsRead ?? 0 }));
  }

  async calendar(userId: string, from: string, to: string) {
    const rows = await this.prisma.dailyProgress.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => ({
      date: r.date,
      secondsRead: r.secondsRead,
      versesRead: r.versesRead,
      pagesRead: r.pagesRead,
      hasanat: r.hasanat,
      goalMet: r.goalMet,
    }));
  }
}
