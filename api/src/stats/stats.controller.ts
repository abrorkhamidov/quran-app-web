import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Matches } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { StatsService } from './stats.service';

class SummaryQuery {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
}

@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private stats: StatsService) {}

  @Get('summary')
  summary(@CurrentUser() user: { id: string }, @Query() q: SummaryQuery) {
    return this.stats.summary(user.id, q.date);
  }

  @Get('week')
  week(@CurrentUser() user: { id: string }, @Query() q: SummaryQuery) {
    return this.stats.week(user.id, q.date);
  }
}
