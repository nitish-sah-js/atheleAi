import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'path';
import { CryptoService } from '../../common/crypto/crypto.service';

export interface StoredEncryptedObject {
  storageDriver: 'local' | 's3';
  originalFileName: string;
  mimeType: string;
  sizeBytes: bigint;
  checksumSha256: string;
  s3Bucket: string;
  s3Key: string;
  encryptionAlgorithm: string;
  encryptionIvBase64: string;
  encryptionAuthTagBase64: string;
  encryptionKeyVersion: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'audio/mpeg',
  'audio/wav',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

@Injectable()
export class StorageService {
  private readonly storageDriver: 'local' | 's3';
  private readonly s3?: S3Client;
  private readonly bucket: string;
  private readonly localStorageRoot: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {
    this.storageDriver = this.configService.get<'local' | 's3'>('FILE_STORAGE_DRIVER') ?? 'local';
    this.localStorageRoot = this.resolveLocalStorageRoot(
      this.configService.get<string>('LOCAL_STORAGE_ROOT') ?? 'uploads/encrypted',
    );
    this.bucket =
      this.storageDriver === 's3'
        ? this.configService.getOrThrow<string>('AWS_S3_BUCKET')
        : 'local-server';

    if (this.storageDriver === 's3') {
      const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');
      const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

      if (!this.bucket || !accessKeyId || !secretAccessKey) {
        throw new Error(
          'S3 storage requires AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY',
        );
      }

      this.s3 = new S3Client({
        region: this.configService.getOrThrow<string>('AWS_REGION'),
        endpoint: endpoint || undefined,
        forcePathStyle: this.configService.get<boolean>('AWS_S3_FORCE_PATH_STYLE') ?? false,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
  }

  async uploadEncryptedFile(params: {
    buffer: Buffer;
    originalFileName: string;
    mimeType: string;
    keyPrefix: string;
  }): Promise<StoredEncryptedObject> {
    this.validateFile(params.buffer, params.mimeType);
    await this.scanFile(params.buffer);

    const checksumSha256 = this.cryptoService.sha256(params.buffer);
    const encrypted = this.cryptoService.encryptBuffer(params.buffer);
    const s3Key = this.buildObjectKey(params.keyPrefix, params.originalFileName);

    if (this.storageDriver === 'local') {
      await this.writeLocalEncryptedObject(s3Key, encrypted.ciphertext);
    } else {
      await this.s3!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: encrypted.ciphertext,
          ContentType: 'application/octet-stream',
          Metadata: {
            encrypted: 'true',
            originalMimeType: params.mimeType,
            checksumSha256,
            algorithm: encrypted.algorithm,
            keyVersion: encrypted.keyVersion,
          },
        }),
      );
    }

    return {
      storageDriver: this.storageDriver,
      originalFileName: params.originalFileName,
      mimeType: params.mimeType,
      sizeBytes: BigInt(params.buffer.length),
      checksumSha256,
      s3Bucket: this.bucket,
      s3Key,
      encryptionAlgorithm: encrypted.algorithm,
      encryptionIvBase64: encrypted.ivBase64,
      encryptionAuthTagBase64: encrypted.authTagBase64,
      encryptionKeyVersion: encrypted.keyVersion,
    };
  }

  async getEncryptedObjectSignedUrl(s3Key: string, expiresInSeconds = 300): Promise<string> {
    if (this.storageDriver === 'local') {
      return `local://${s3Key}`;
    }

    return getSignedUrl(
      this.s3!,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  private validateFile(buffer: Buffer, mimeType: string): void {
    if (!buffer.length) {
      throw new BadRequestException('Uploaded file is empty');
    }

    if (buffer.length > 20 * 1024 * 1024) {
      throw new BadRequestException('File exceeds 20MB upload limit');
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(`Unsupported file type: ${mimeType}`);
    }
  }

  private async scanFile(_buffer: Buffer): Promise<void> {
    // Production deployment should replace this adapter with ClamAV or a managed malware scanner.
    return Promise.resolve();
  }

  private buildObjectKey(prefix: string, originalFileName: string): string {
    const extension = originalFileName.includes('.')
      ? originalFileName.substring(originalFileName.lastIndexOf('.')).toLowerCase()
      : '';
    const safePrefix = prefix.replace(/\\/g, '/').replace(/(^\/+|\.\.)/g, '');
    return `${safePrefix}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
  }

  private async writeLocalEncryptedObject(objectKey: string, ciphertext: Buffer): Promise<void> {
    const targetPath = this.resolveLocalObjectPath(objectKey);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, ciphertext, { flag: 'wx' });
  }

  private resolveLocalStorageRoot(configuredRoot: string): string {
    return isAbsolute(configuredRoot)
      ? resolve(configuredRoot)
      : resolve(process.cwd(), configuredRoot);
  }

  private resolveLocalObjectPath(objectKey: string): string {
    const normalizedKey = normalize(objectKey).replace(/^(\.\.(\/|\\|$))+/, '');
    const targetPath = resolve(join(this.localStorageRoot, normalizedKey));
    const relativePath = relative(this.localStorageRoot, targetPath);

    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new BadRequestException('Invalid storage object path');
    }

    return targetPath;
  }
}
