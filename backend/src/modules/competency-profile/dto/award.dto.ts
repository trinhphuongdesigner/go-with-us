import {
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateAwardDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** URL to a certificate/photo (outside Spaces) OR Spaces upload (prefix careermate/award-evidence/).
   * No other domain content stored in Spaces (avatar-only + award evidence only). */
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
