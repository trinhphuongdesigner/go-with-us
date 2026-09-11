import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiProvider } from '@prisma/client';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { OpenAiAdapter } from './adapters/openai.adapter';
import { GeminiAdapter } from './adapters/gemini.adapter';
import {
  AiProviderAdapter,
  SendChatParams,
  SendChatResult,
} from './ai-chat.types';

// Priority order when no explicit provider is requested.
const PROVIDER_ORDER: AiProvider[] = [
  AiProvider.ANTHROPIC,
  AiProvider.OPENAI,
  AiProvider.GEMINI,
];

/**
 * Shared entry point for every AI-assisted feature in the app ("skills" in
 * Workflow Pro's terminology — see D:\Coding\AI_Tool\docs\skills.md for the
 * pattern this mirrors). No other module should call a provider SDK
 * directly; always go through AiChatService.send().
 */
@Injectable()
export class AiChatService {
  private readonly adapters: Record<AiProvider, AiProviderAdapter>;

  constructor(
    private readonly aiSettingsService: AiSettingsService,
    anthropicAdapter: AnthropicAdapter,
    openAiAdapter: OpenAiAdapter,
    geminiAdapter: GeminiAdapter,
  ) {
    this.adapters = {
      [AiProvider.ANTHROPIC]: anthropicAdapter,
      [AiProvider.OPENAI]: openAiAdapter,
      [AiProvider.GEMINI]: geminiAdapter,
    };
  }

  async send(params: SendChatParams): Promise<SendChatResult> {
    const provider =
      params.provider ?? (await this.pickFirstConnectedProvider());
    if (!provider) {
      throw new ServiceUnavailableException(
        'No AI provider is connected — add an API key under Settings > API Keys & Connections',
      );
    }

    const config = await this.aiSettingsService.getDecryptedConfig(provider);
    if (!config) {
      throw new ServiceUnavailableException(
        `Provider ${provider} is not connected`,
      );
    }

    const adapter = this.adapters[provider];
    try {
      const content = await adapter.send(config, params);
      return { content, provider };
    } catch (error) {
      throw new BadGatewayException(
        `AI provider ${provider} request failed: ${(error as Error).message}`,
      );
    }
  }

  private async pickFirstConnectedProvider(): Promise<AiProvider | null> {
    const settings = await this.aiSettingsService.findAll();
    const byProvider = new Map(settings.map((s) => [s.provider, s]));
    for (const provider of PROVIDER_ORDER) {
      if (byProvider.get(provider)?.hasKey) {
        return provider;
      }
    }
    return null;
  }
}
