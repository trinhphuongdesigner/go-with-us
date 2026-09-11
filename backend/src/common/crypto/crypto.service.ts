import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

/**
 * Encrypts/decrypts AiProviderConfig.apiKey at rest as
 * `iv.authTag.ciphertext` (all hex-encoded, dot-joined) via AES-256-GCM.
 * ENCRYPTION_KEY must be a 32-byte value hex-encoded (64 hex chars) — fails
 * fast at startup if missing or the wrong length, since a broken key would
 * otherwise silently corrupt every stored provider key.
 */
@Injectable()
export class CryptoService implements OnModuleInit {
  private readonly logger = new Logger(CryptoService.name);
  private key!: Buffer;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const rawKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!rawKey) {
      throw new Error(
        'ENCRYPTION_KEY env var is required (32-byte value, hex-encoded — 64 hex chars)',
      );
    }

    const key = Buffer.from(rawKey, 'hex');
    if (key.length !== KEY_LENGTH_BYTES) {
      throw new Error(
        `ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH_BYTES} bytes (64 hex chars); got ${key.length} bytes`,
      );
    }

    this.key = key;
    this.logger.log('CryptoService initialized');
  }

  encrypt(plainText: string): string {
    const iv = crypto.randomBytes(IV_LENGTH_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      iv.toString('hex'),
      authTag.toString('hex'),
      ciphertext.toString('hex'),
    ].join('.');
  }

  decrypt(encoded: string): string {
    const [ivHex, authTagHex, ciphertextHex] = encoded.split('.');
    if (!ivHex || !authTagHex || !ciphertextHex) {
      throw new Error(
        'Malformed encrypted value — expected "iv.authTag.ciphertext" hex triplet',
      );
    }

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }
}
