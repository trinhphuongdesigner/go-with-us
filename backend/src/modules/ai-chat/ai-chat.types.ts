import { AiProvider } from '@prisma/client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SendChatParams {
  messages: ChatMessage[];
  systemPrompt?: string;
  /** Force a specific provider; otherwise the first connected one wins (Anthropic -> OpenAI -> Gemini). */
  provider?: AiProvider;
}

export interface ResolvedProviderConfig {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string | null;
  model: string | null;
}

export interface SendChatResult {
  content: string;
  provider: AiProvider;
}

/** One thin adapter per provider — just enough to compile with the right call shape. */
export interface AiProviderAdapter {
  send(config: ResolvedProviderConfig, params: SendChatParams): Promise<string>;
}
