import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

export const GOAL_LEVELS: Record<string, number> = { egg: 120, steady: 600, beast: 1800 };
export const DEFAULT_GOAL_SECONDS = GOAL_LEVELS.egg;
export const DEFAULT_GOAL_AYAHS = 10;

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  private publicShape(s: {
    onboarded: boolean; goalLevel: string; goalTargetSeconds: number; goalType: string; goalTargetAyahs: number;
    focusType: string; focusId: number | null; preferredReciterId: number; theme: string; fontScale: number; readingStyle: string;
  }) {
    return {
      onboarded: s.onboarded,
      goalLevel: s.goalLevel,
      goalTargetSeconds: s.goalTargetSeconds,
      goalType: s.goalType,
      goalTargetAyahs: s.goalTargetAyahs,
      focusType: s.focusType,
      focusId: s.focusId,
      preferredReciterId: s.preferredReciterId,
      theme: s.theme,
      fontScale: s.fontScale,
      readingStyle: s.readingStyle,
    };
  }

  async getOrCreate(userId: string) {
    const row = await this.prisma.userSettings.upsert({ where: { userId }, create: { userId }, update: {} });
    return this.publicShape(row);
  }

  async getGoal(userId: string): Promise<{ type: 'time' | 'ayahs'; target: number }> {
    const row = await this.prisma.userSettings.findUnique({ where: { userId } });
    const type = row?.goalType === 'ayahs' ? 'ayahs' : 'time';
    const target = type === 'ayahs' ? (row?.goalTargetAyahs ?? DEFAULT_GOAL_AYAHS) : (row?.goalTargetSeconds ?? DEFAULT_GOAL_SECONDS);
    return { type, target };
  }

  async update(userId: string, dto: UpdateSettingsDto) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.goalLevel) data.goalTargetSeconds = GOAL_LEVELS[dto.goalLevel];
    const row = await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.publicShape(row);
  }
}
