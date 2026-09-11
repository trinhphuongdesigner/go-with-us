import { AssistantFocus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class AssistantQueryDto {
  @IsString()
  @MinLength(2)
  question!: string;

  /** Continue an existing thread; omit to start a new one. */
  @IsOptional()
  @IsString()
  conversationId?: string;

  /**
   * Topic for a NEW conversation — ignored when continuing one via
   * conversationId (focus is fixed at creation). Omit for the general
   * chat (today's roster-search / personal-companion behaviour).
   */
  @IsOptional()
  @IsEnum(AssistantFocus)
  focus?: AssistantFocus;
}
