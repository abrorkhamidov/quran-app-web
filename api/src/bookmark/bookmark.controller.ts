import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsInt, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BookmarkService } from './bookmark.service';

class SetBookmarkDto {
  @IsInt() @Min(1) @Max(604) page: number;
}

@UseGuards(JwtAuthGuard)
@Controller('bookmark')
export class BookmarkController {
  constructor(private bookmarks: BookmarkService) {}

  @Get()
  async get(@CurrentUser() user: { id: string }) {
    return (await this.bookmarks.get(user.id)) ?? {};
  }

  @Put()
  set(@CurrentUser() user: { id: string }, @Body() dto: SetBookmarkDto) {
    return this.bookmarks.set(user.id, dto.page);
  }
}
