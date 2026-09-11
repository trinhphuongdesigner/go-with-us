import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  AiProviderAdapter,
  ResolvedProviderConfig,
  SendChatParams,
} from '../ai-chat.types';

const DEFAULT_MODEL = 'claude-sonnet-4-5';

@Injectable()
export class AnthropicAdapter implements AiProviderAdapter {
  async send(
    config: ResolvedProviderConfig,
    params: SendChatParams,
  ): Promise<string> {
    const client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl ?? undefined,
    });

    const response = await client.messages.create({
      model: config.model ?? DEFAULT_MODEL,
      max_tokens: 4096,
      system: params.systemPrompt,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock && 'text' in textBlock ? textBlock.text : '';
  }
}
