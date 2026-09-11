import { IsOptional, IsString } from 'class-validator';

export class ListActivityLogsDto {
  @IsOptional()
  @IsString()
  userId?: string;
}
