import type { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  const config = {
    getOrThrow: (key: string) => {
      const values: Record<string, string> = {
        DOCUMENT_MASTER_KEY_BASE64: Buffer.alloc(32).toString('base64'),
        JWT_ACCESS_SECRET: 'test-access-secret-with-more-than-32-bytes',
      };
      return values[key];
    },
    get: () => '',
  } as unknown as ConfigService;

  it('encrypts and decrypts strings with AES-256-GCM', () => {
    const service = new CryptoService(config);
    const encrypted = service.encryptString('sensitive report narrative');

    expect(encrypted.ciphertextBase64).not.toContain('sensitive');
    expect(
      service.decryptString(
        encrypted.ciphertextBase64,
        encrypted.ivBase64,
        encrypted.authTagBase64,
      ),
    ).toBe('sensitive report narrative');
  });

  it('canonicalizes object keys deterministically', () => {
    const service = new CryptoService(config);

    expect(service.canonicalJson({ b: 2, a: 1 })).toBe(service.canonicalJson({ a: 1, b: 2 }));
  });
});
