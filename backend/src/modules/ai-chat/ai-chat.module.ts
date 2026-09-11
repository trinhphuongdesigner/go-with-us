import { Module } from '@nestjs/common';
import { AiSettingsModule } from '../ai-settings/ai-settings.module';
import { AiChatService } from './ai-chat.service';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { OpenAiAdapter } from './adapters/openai.adapter';
import { GeminiAdapter } from './adapters/gemini.adapter';

/**
 * Exports AiChatService for reuse by any future feature module that needs
 * an AI call (mirrors Workflow Pro's AiChatModule — see
 * D:\Coding\AI_Tool\docs\skills.md). No controller of its own; this module
 * has no directly user-facing routes.
 */
@Module({
  imports: [AiSettingsModule],
  providers: [AiChatService, AnthropicAdapter, OpenAiAdapter, GeminiAdapter],
  exports: [AiChatService],
})
export class AiChatModule {}
