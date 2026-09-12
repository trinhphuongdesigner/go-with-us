import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('SPACES_ENDPOINT');
    const accessKeyId = config.get<string>('SPACES_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('SPACES_SECRET_ACCESS_KEY');
    const bucket = config.get<string>('SPACES_BUCKET_NAME');
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      throw new InternalServerErrorException(
        'SPACES_ENDPOINT, SPACES_ACCESS_KEY_ID, SPACES_SECRET_ACCESS_KEY and SPACES_BUCKET_NAME must all be set — see backend/.env.example',
      );
    }

    const endpointUrl = new URL(endpoint);
    const region = endpointUrl.hostname.split('.')[0];
    this.client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.bucket = bucket;
    this.publicBaseUrl = `${endpointUrl.protocol}//${bucket}.${endpointUrl.host}`;
  }

  private resolveKey(segments: string[]): string {
    if (
      !segments.length ||
      segments.some(
        (segment) =>
          !segment ||
          segment === '.' ||
          segment === '..' ||
          /[\\/]/.test(segment),
      )
    ) {
      throw new InternalServerErrorException('Invalid storage key segments');
    }
    return segments.join('/');
  }

  async writePublic(
    segments: string[],
    content: Buffer,
    contentType: string,
  ): Promise<string> {
    const key = this.resolveKey(segments);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${this.publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  keyFromPublicUrl(value: string | null): string | null {
    if (!value) return null;
    try {
      const url = new URL(value);
      if (url.origin !== this.publicBaseUrl) return null;
      return url.pathname
        .split('/')
        .filter(Boolean)
        .map(decodeURIComponent)
        .join('/');
    } catch {
      return null;
    }
  }
}
