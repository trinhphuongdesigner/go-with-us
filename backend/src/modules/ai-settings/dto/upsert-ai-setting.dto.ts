import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertAiSettingDto {
  @IsString()
  @MinLength(1)
  apiKey!: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
