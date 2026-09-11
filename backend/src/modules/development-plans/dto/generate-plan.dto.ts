import { IsOptional, IsString } from 'class-validator';

/**
 * The AI skill's input — proposal only, nothing here is persisted (see
 * DevelopmentPlansService.generate). Mirrors the "instruction" field shape
 * used throughout Workflow Pro's skills (D:\Coding\AI_Tool\docs\skills.md)
 * — free text folded into the prompt, optional so the empty-state
 * "Generate" call (no plan yet) works the same as a targeted "Regenerate,
 * focus more on leadership" follow-up.
 */
export class GeneratePlanDto {
  @IsOptional()
  @IsString()
  instruction?: string;
}
