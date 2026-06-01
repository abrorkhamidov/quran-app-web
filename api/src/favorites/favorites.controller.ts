import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FavoritesService } from './favorites.service';
import { AddFavoriteDto } from './dto/add-favorite.dto';

@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.favorites.list(user.id);
  }

  @Post()
  add(@CurrentUser() user: { id: string }, @Body() dto: AddFavoriteDto) {
    return this.favorites.add(user.id, dto.surah, dto.ayah);
  }

  @Delete(':surah/:ayah')
  remove(
    @CurrentUser() user: { id: string },
    @Param('surah', ParseIntPipe) surah: number,
    @Param('ayah', ParseIntPipe) ayah: number,
  ) {
    return this.favorites.remove(user.id, surah, ayah);
  }
}
