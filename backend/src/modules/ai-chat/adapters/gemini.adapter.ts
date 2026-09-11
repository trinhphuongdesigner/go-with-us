import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import {
  AiProviderAdapter,
  ResolvedProviderConfig,
  SendChatParams,
} from '../ai-chat.types';

const DEFAULT_MODEL = 'gemini-2.0-flash';

@Injectable()
export class GeminiAdapter implements AiProviderAdapter {
  async send(
    config: ResolvedProviderConfig,
    params: SendChatParams,
  ): Promise<string> {
    const client = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: config.baseUrl ? { baseUrl: config.baseUrl } : undefined,
    });

    // Gemini has no separate system-message array in this simple shape —
    // fold it into the first content block as plain instruction text.
    const contents = params.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await client.models.generateContent({
      model: config.model ?? DEFAULT_MODEL,
      contents,
      config: params.systemPrompt
        ? { systemInstruction: params.systemPrompt }
        : undefined,
    });

    return response.text ?? '';
  }
}
