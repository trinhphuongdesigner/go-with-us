import { LifeCategory } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateAwardDto {
  @IsString()
  @MinLength(1)
  title!: string;

  /** WORK = best staff, internal hackathon; PERSONAL = sport, volunteering. */
  @IsOptional()
  @IsEnum(LifeCategory)
  category?: LifeCategory;

  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** URL to a certificate/photo — this project has no object storage. */
  @IsOptional()
  @IsString()
  evidenceUrl?: string;

  @IsOptional()
  @IsDateString()
  awardedAt?: string;
}

export class UpdateAwardDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsEnum(LifeCategory)
  category?: LifeCategory;

  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  evidenceUrl?: string;

  @IsOptional()
  @IsDateString()
  awardedAt?: string;
}
