import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  KeyObject,
  randomBytes,
  sign,
  verify,
} from 'crypto';

export interface EncryptedBuffer {
  ciphertext: Buffer;
  ivBase64: string;
  authTagBase64: string;
  algorithm: 'AES-256-GCM';
  keyVersion: string;
}

export interface EncryptedString {
  ciphertextBase64: string;
  ivBase64: string;
  authTagBase64: string;
  algorithm: 'AES-256-GCM';
  keyVersion: string;
}

@Injectable()
export class CryptoService {
  private readonly documentKey: Buffer;
  private readonly jwtSecret: string;
  private readonly privateKey?: KeyObject;
  private readonly publicKey?: KeyObject;

  constructor(private readonly configService: ConfigService) {
    this.documentKey = Buffer.from(
      this.configService.getOrThrow<string>('DOCUMENT_MASTER_KEY_BASE64'),
      'base64',
    );
    this.jwtSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');

    if (this.documentKey.length !== 32) {
      throw new Error('DOCUMENT_MASTER_KEY_BASE64 must decode to exactly 32 bytes');
    }

    const privateKeyBase64 = this.configService.get<string>('ED25519_PRIVATE_KEY_PEM_BASE64');
    const publicKeyBase64 = this.configService.get<string>('ED25519_PUBLIC_KEY_PEM_BASE64');

    this.privateKey = privateKeyBase64
      ? createPrivateKey(Buffer.from(privateKeyBase64, 'base64').toString('utf8'))
      : undefined;
    this.publicKey = publicKeyBase64
      ? createPublicKey(Buffer.from(publicKeyBase64, 'base64').toString('utf8'))
      : undefined;
  }

  encryptBuffer(plaintext: Buffer): EncryptedBuffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.documentKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    return {
      ciphertext,
      ivBase64: iv.toString('base64'),
      authTagBase64: cipher.getAuthTag().toString('base64'),
      algorithm: 'AES-256-GCM',
      keyVersion: 'v1',
    };
  }

  decryptBuffer(ciphertext: Buffer, ivBase64: string, authTagBase64: string): Buffer {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.documentKey,
      Buffer.from(ivBase64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  encryptString(plaintext: string): EncryptedString {
    const encrypted = this.encryptBuffer(Buffer.from(plaintext, 'utf8'));

    return {
      ciphertextBase64: encrypted.ciphertext.toString('base64'),
      ivBase64: encrypted.ivBase64,
      authTagBase64: encrypted.authTagBase64,
      algorithm: encrypted.algorithm,
      keyVersion: encrypted.keyVersion,
    };
  }

  decryptString(ciphertextBase64: string, ivBase64: string, authTagBase64: string): string {
    return this.decryptBuffer(
      Buffer.from(ciphertextBase64, 'base64'),
      ivBase64,
      authTagBase64,
    ).toString('utf8');
  }

  sha256(input: Buffer | string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  randomToken(bytes = 48): string {
    return randomBytes(bytes).toString('base64url');
  }

  tokenDigest(token: string): string {
    return createHmac('sha256', this.jwtSecret).update(token).digest('hex');
  }

  canonicalJson(value: unknown): string {
    return JSON.stringify(this.sortJson(value));
  }

  signJson(value: unknown): string {
    if (!this.privateKey) {
      throw new Error('Ed25519 private key is not configured');
    }

    return sign(null, Buffer.from(this.canonicalJson(value)), this.privateKey).toString('base64');
  }

  verifyJson(value: unknown, signatureBase64: string): boolean {
    if (!this.publicKey) {
      throw new Error('Ed25519 public key is not configured');
    }

    return verify(
      null,
      Buffer.from(this.canonicalJson(value)),
      this.publicKey,
      Buffer.from(signatureBase64, 'base64'),
    );
  }

  createSignedToken(payload: unknown): string {
    const payloadBase64 = Buffer.from(this.canonicalJson(payload)).toString('base64url');
    const signatureBase64Url = Buffer.from(this.signJson(payload), 'base64').toString('base64url');
    return `${payloadBase64}.${signatureBase64Url}`;
  }

  verifySignedToken<T = Record<string, unknown>>(token: string): T {
    const [payloadPart, signaturePart] = token.split('.');

    if (!payloadPart || !signaturePart) {
      throw new Error('Malformed signed token');
    }

    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as T;
    const signatureBase64 = Buffer.from(signaturePart, 'base64url').toString('base64');

    if (!this.verifyJson(payload, signatureBase64)) {
      throw new Error('Invalid signed token signature');
    }

    return payload;
  }

  private sortJson(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortJson(item));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((accumulator, key) => {
          accumulator[key] = this.sortJson((value as Record<string, unknown>)[key]);
          return accumulator;
        }, {});
    }

    return value;
  }
}
