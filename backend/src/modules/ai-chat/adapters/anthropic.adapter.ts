import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  AiProviderAdapter,
  ResolvedProviderConfig,
  SendChatParams,
} from '../ai-chat.types';

const DEFAULT_MODEL = 'claude-sonnet-4-5';

@Injectable()
export class AnthropicAdapter implements AiProviderAdapter {
  private readonly logger = new Logger(AnthropicAdapter.name);

  async send(
    config: ResolvedProviderConfig,
    params: SendChatParams,
  ): Promise<string> {
    const client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl ?? undefined,
    });

    const sysHead = (params.systemPrompt ?? '').slice(0, 600);
    const firstMsg = params.messages[0]?.content?.slice(0, 200) ?? '';
    this.logger.log(
      `Anthropic call: model=${config.model ?? DEFAULT_MODEL} sysLen=${params.systemPrompt?.length ?? 0} msgs=${params.messages.length} sysHead=${sysHead} firstMsg=${firstMsg}`,
    );

    const response = await client.messages.create({
      model: config.model ?? DEFAULT_MODEL,
      max_tokens: 16384,
      system: params.systemPrompt,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // Some proxies (e.g. madison-ai-center) accept Anthropic SDK calls but reply
    // with OpenAI-compatible chat.completion shapes instead of Anthropic Messages.
    // Sniff both shapes defensively.
    const raw: any = response;

    // OpenAI-compatible shape via proxy
    if (raw?.choices && Array.isArray(raw.choices)) {
      const choice = raw.choices[0];
      const text = choice?.message?.content ?? '';
      const finish = choice?.finish_reason ?? raw.finish_reason ?? 'n/a';
      const usage = raw.usage;
      const rid = raw.id;
      this.logger.log(
        `AnthropicAdapter: detected OpenAI-compatible response via proxy finish=${finish} id=${rid ?? 'n/a'} usage=${usage ? JSON.stringify(usage) : 'n/a'}`,
      );
      if (!text) {
        this.logger.warn(`AnthropicAdapter: proxy returned empty choice content finish=${finish}`);
        throw new Error(`Proxy returned empty content (finish_reason=${finish})`);
      }
      return text;
    }

    // Real Anthropic Messages shape
    const content = raw?.content ?? [];
    if (!Array.isArray(content) || content.length === 0) {
      const stopReason = raw?.stop_reason;
      const usage = raw?.usage;
      const respId = raw?.id;
      const err = raw?.error ?? raw?.type;

      this.logger.warn(
        `Anthropic empty content: stop_reason=${stopReason ?? 'n/a'} id=${respId ?? 'n/a'} usage=${usage ? JSON.stringify(usage) : 'n/a'}`,
      );

      throw new Error(
        `Anthropic returned no content${stopReason ? ` (stop_reason=${stopReason})` : ''}${err ? ` error=${JSON.stringify(err)}` : ''}`,
      );
    }

    const textBlock = content.find((block: any) => block?.type === 'text');
    if (!textBlock || !('text' in textBlock)) {
      throw new Error('Anthropic response has no text block (possibly tool_use or refusal)');
    }
    return textBlock.text ?? '';
  }
}
