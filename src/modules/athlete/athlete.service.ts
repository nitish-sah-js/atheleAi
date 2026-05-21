import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvents } from '../../common/constants/events';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { StorageService } from '../storage/storage.service';
import { AthleteRepository } from './athlete.repository';
import { UpdateAthleteProfileDto } from './dto/update-athlete-profile.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Injectable()
export class AthleteService {
  constructor(
    private readonly repository: AthleteRepository,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getProfile(user: AuthenticatedUser) {
    const profile = await this.repository.findProfileByUserId(user.id);

    if (!profile) {
      throw new NotFoundException('Athlete profile not found');
    }

    return {
      ...profile,
      documents: profile.documents.map((document) => ({
        ...document,
        sizeBytes: document.sizeBytes.toString(),
      })),
    };
  }

  async updateProfile(user: AuthenticatedUser, dto: UpdateAthleteProfileDto) {
    await this.getProfile(user);

    return this.repository.updateProfileByUserId(user.id, {
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      gender: dto.gender,
      nationality: dto.nationality,
      primarySport: dto.primarySport,
      clubName: dto.clubName,
    });
  }

  async uploadDocument(
    user: AuthenticatedUser,
    dto: UploadDocumentDto,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Uploaded file is missing');
    }

    const profile = await this.getProfile(user);

    const storedObject = await this.storageService.uploadEncryptedFile({
      buffer: file.buffer,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      keyPrefix: `athletes/${profile.id}/documents`,
    });

    const document = await this.repository.createDocument({
      athleteProfileId: profile.id,
      uploadedByUserId: user.id,
      documentType: dto.documentType,
      object: storedObject,
    });

    this.eventEmitter.emit(AppEvents.DOCUMENT_UPLOADED, {
      documentId: document.id,
      athleteProfileId: profile.id,
      uploadedByUserId: user.id,
      documentType: dto.documentType,
    });

    return {
      id: document.id,
      documentType: document.documentType,
      status: document.status,
      originalFileName: document.originalFileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes.toString(),
      createdAt: document.createdAt,
    };
  }
}
