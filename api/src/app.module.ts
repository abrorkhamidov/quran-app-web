import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BookmarkModule } from './bookmark/bookmark.module';
import { FavoritesModule } from './favorites/favorites.module';
import { SessionsModule } from './sessions/sessions.module';
import { StatsModule } from './stats/stats.module';
import { SettingsModule } from './settings/settings.module';
import { QuranModule } from './quran/quran.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, BookmarkModule, FavoritesModule, SessionsModule, StatsModule, SettingsModule, QuranModule],
})
export class AppModule {}
