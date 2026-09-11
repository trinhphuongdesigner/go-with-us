import { IsOptional, IsString, MinLength } from 'class-validator';

export class AssistantQueryDto {
  @IsString()
  @MinLength(2)
  question!: string;

  /** Continue an existing thread; omit to start a new one. */
  @IsOptional()
  @IsString()
  conversationId?: string;
}
