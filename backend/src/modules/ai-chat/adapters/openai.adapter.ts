import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import {
  AiProviderAdapter,
  ResolvedProviderConfig,
  SendChatParams,
} from '../ai-chat.types';

const DEFAULT_MODEL = 'gpt-4o-mini';

@Injectable()
export class OpenAiAdapter implements AiProviderAdapter {
  async send(
    config: ResolvedProviderConfig,
    params: SendChatParams,
  ): Promise<string> {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl ?? undefined,
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt });
    }
    for (const m of params.messages) {
      messages.push({ role: m.role, content: m.content });
    }

    const response = await client.chat.completions.create({
      model: config.model ?? DEFAULT_MODEL,
      messages,
    });

    return response.choices[0]?.message?.content ?? '';
  }
}
