import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { QuranService } from './quran.service';

@UseGuards(JwtAuthGuard)
@Controller('quran')
export class QuranController {
  constructor(private quran: QuranService) {}

  @Get('coverage')
  coverage(@CurrentUser() user: { id: string }) {
    return this.quran.coverage(user.id);
  }
}
