import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Matches, Max, Min } from 'class-validator';

export class RecordSessionDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsInt() @Min(0) @Max(86400) durationSeconds: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(604) @IsInt({ each: true }) pages: number[];
}
