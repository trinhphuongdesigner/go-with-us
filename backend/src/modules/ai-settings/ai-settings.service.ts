import { Injectable, NotFoundException } from '@nestjs/common';
import { AiProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { UpsertAiSettingDto } from './dto/upsert-ai-setting.dto';

export interface AiSettingPublic {
  provider: AiProvider;
  hasKey: boolean;
  baseUrl: string | null;
  model: string | null;
}

@Injectable()
export class AiSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /** GET — never returns the decrypted key, just whether one is set. */
  async findAll(): Promise<AiSettingPublic[]> {
    const configs = await this.prisma.aiProviderConfig.findMany();
    const byProvider = new Map(configs.map((c) => [c.provider, c]));

    return Object.values(AiProvider).map((provider) => {
      const config = byProvider.get(provider);
      return {
        provider,
        hasKey: !!config,
        baseUrl: config?.baseUrl ?? null,
        model: config?.model ?? null,
      };
    });
  }

  async findOne(provider: AiProvider): Promise<AiSettingPublic> {
    const config = await this.prisma.aiProviderConfig.findUnique({
      where: { provider },
    });
    return {
      provider,
      hasKey: !!config,
      baseUrl: config?.baseUrl ?? null,
      model: config?.model ?? null,
    };
  }

  async upsert(
    provider: AiProvider,
    dto: UpsertAiSettingDto,
  ): Promise<AiSettingPublic> {
    const encryptedKey = this.cryptoService.encrypt(dto.apiKey);
    await this.prisma.aiProviderConfig.upsert({
      where: { provider },
      create: {
        provider,
        apiKey: encryptedKey,
        baseUrl: dto.baseUrl,
        model: dto.model,
      },
      update: { apiKey: encryptedKey, baseUrl: dto.baseUrl, model: dto.model },
    });
    return this.findOne(provider);
  }

  async remove(provider: AiProvider): Promise<{ provider: AiProvider }> {
    const config = await this.prisma.aiProviderConfig.findUnique({
      where: { provider },
    });
    if (!config) {
      throw new NotFoundException(`No stored config for provider ${provider}`);
    }
    await this.prisma.aiProviderConfig.delete({ where: { provider } });
    return { provider };
  }

  /**
   * Internal-only — returns the decrypted key. Only AiChatService should
   * call this; never expose it through a controller.
   */
  async getDecryptedConfig(provider: AiProvider) {
    const config = await this.prisma.aiProviderConfig.findUnique({
      where: { provider },
    });
    if (!config) return null;
    return {
      provider: config.provider,
      apiKey: this.cryptoService.decrypt(config.apiKey),
      baseUrl: config.baseUrl,
      model: config.model,
    };
  }
}
