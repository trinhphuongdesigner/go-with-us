import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreatePeerReviewDto {
  @IsString()
  @IsNotEmpty()
  revieweeId!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  // Arbitrary rating shape (e.g. { collaboration: 4, communication: 5 }) —
  // deliberately not over-validated field-by-field, just accepted as a
  // plain JSON object and stored as-is in the Json? column.
  @IsOptional()
  @IsObject()
  ratings?: Record<string, unknown>;
}
