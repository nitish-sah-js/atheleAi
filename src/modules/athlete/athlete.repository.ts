import { Injectable } from '@nestjs/common';
import { DocumentStatus, DocumentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { StoredEncryptedObject } from '../storage/storage.service';

@Injectable()
export class AthleteRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProfileByUserId(userId: string) {
    return this.prisma.athleteProfile.findFirst({
      where: { userId, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            roles: true,
          },
        },
        documents: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            documentType: true,
            status: true,
            originalFileName: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
        credentials: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            status: true,
            issuedAt: true,
            expiresAt: true,
          },
        },
      },
    });
  }

  updateProfileByUserId(userId: string, data: Prisma.AthleteProfileUpdateInput) {
    return this.prisma.athleteProfile.update({
      where: { userId },
      data,
    });
  }

  createDocument(input: {
    athleteProfileId: string;
    uploadedByUserId: string;
    documentType: DocumentType;
    object: StoredEncryptedObject;
  }) {
    return this.prisma.uploadedDocument.create({
      data: {
        athleteProfileId: input.athleteProfileId,
        uploadedByUserId: input.uploadedByUserId,
        documentType: input.documentType,
        status: DocumentStatus.AVAILABLE,
        originalFileName: input.object.originalFileName,
        mimeType: input.object.mimeType,
        sizeBytes: input.object.sizeBytes,
        checksumSha256: input.object.checksumSha256,
        s3Bucket: input.object.s3Bucket,
        s3Key: input.object.s3Key,
        encryptionAlgorithm: input.object.encryptionAlgorithm,
        encryptionIvBase64: input.object.encryptionIvBase64,
        encryptionAuthTagBase64: input.object.encryptionAuthTagBase64,
        encryptionKeyVersion: input.object.encryptionKeyVersion,
      },
    });
  }
}
