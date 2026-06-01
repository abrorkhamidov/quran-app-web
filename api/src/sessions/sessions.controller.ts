import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionsService } from './sessions.service';
import { RecordSessionDto } from './dto/record-session.dto';

@UseGuards(JwtAuthGuard)
@Controller('reading-sessions')
export class SessionsController {
  constructor(private sessions: SessionsService) {}

  @Post()
  record(@CurrentUser() user: { id: string }, @Body() dto: RecordSessionDto) {
    return this.sessions.record(user.id, dto);
  }
}
