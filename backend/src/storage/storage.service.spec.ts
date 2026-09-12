import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  const service = new StorageService(
    new ConfigService({
      SPACES_ENDPOINT: 'https://sgp1.digitaloceanspaces.com',
      SPACES_ACCESS_KEY_ID: 'test-key',
      SPACES_SECRET_ACCESS_KEY: 'test-secret',
      SPACES_BUCKET_NAME: 'shared-bucket',
    }),
  );

  it('only resolves object keys from its configured bucket', () => {
    expect(
      service.keyFromPublicUrl(
        'https://shared-bucket.sgp1.digitaloceanspaces.com/careermate/avatars/user/avatar.webp',
      ),
    ).toBe('careermate/avatars/user/avatar.webp');
    expect(
      service.keyFromPublicUrl(
        'https://other-bucket.sgp1.digitaloceanspaces.com/careermate/avatars/user/avatar.webp',
      ),
    ).toBeNull();
    expect(
      service.keyFromPublicUrl(
        'https://shared-bucket.sgp1.digitaloceanspaces.com.evil.test/careermate/avatars/user/avatar.webp',
      ),
    ).toBeNull();
  });
});
