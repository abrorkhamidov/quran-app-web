import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsBoolean() onboarded?: boolean;
  @IsOptional() @IsIn(['egg', 'steady', 'beast']) goalLevel?: string;
  @IsOptional() @IsInt() preferredReciterId?: number;
  @IsOptional() @IsIn(['light', 'dark']) theme?: string;
  @IsOptional() @IsNumber() @Min(0.8) @Max(1.8) fontScale?: number;
}
