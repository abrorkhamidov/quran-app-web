import { IsInt, Min } from 'class-validator';

export class AddFavoriteDto {
  @IsInt() @Min(1) surah: number;
  @IsInt() @Min(1) ayah: number;
}
