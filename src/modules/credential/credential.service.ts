import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ClaimVisibility,
  CredentialStatus,
  CredentialType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AppEvents } from '../../common/constants/events';
import { CryptoService } from '../../common/crypto/crypto.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { QRVerificationService } from '../qr-verification/qr-verification.service';
import { CredentialRepository } from './credential.repository';
import { SignCredentialDto } from './dto/sign-credential.dto';

export interface IssueSignedCredentialInput {
  athleteProfileId: string;
  federationId: string;
  issuedByUserId: string;
  type: CredentialType;
  claims: Array<{
    claimKey: string;
    claimValue: Prisma.InputJsonValue;
    visibility?: ClaimVisibility;
  }>;
  expiresAt?: Date;
}

@Injectable()
export class CredentialService {
  constructor(
    private readonly repository: CredentialRepository,
    private readonly cryptoService: CryptoService,
    private readonly eventEmitter: EventEmitter2,
    private readonly qrVerificationService: QRVerificationService,
  ) {}

  async issueSignedCredential(input: IssueSignedCredentialInput) {
    const credentialId = randomUUID();
    const issuedAt = new Date();
    const normalizedClaims = input.claims.map((claim) => ({
      key: claim.claimKey,
      value: claim.claimValue,
      visibility: claim.visibility ?? ClaimVisibility.RESTRICTED,
    }));

    const payload = {
      schema: 'athleteshield.credential.v1',
      credentialId,
      athleteProfileId: input.athleteProfileId,
      federationId: input.federationId,
      type: input.type,
      claims: normalizedClaims,
      issuedAt: issuedAt.toISOString(),
      expiresAt: input.expiresAt?.toISOString() ?? null,
      issuer: {
        userId: input.issuedByUserId,
        federationId: input.federationId,
      },
    };
    const payloadHashSha256 = this.cryptoService.sha256(this.cryptoService.canonicalJson(payload));
    const signatureBase64 = this.cryptoService.signJson(payload);

    const credential = await this.repository.createSigned({
      id: credentialId,
      athleteProfile: { connect: { id: input.athleteProfileId } },
      federation: { connect: { id: input.federationId } },
      issuedBy: { connect: { id: input.issuedByUserId } },
      type: input.type,
      status: CredentialStatus.SIGNED,
      payload,
      payloadHashSha256,
      signatureBase64,
      issuedAt,
      expiresAt: input.expiresAt,
      claims: {
        create: input.claims.map((claim) => ({
          claimKey: claim.claimKey,
          claimValue: claim.claimValue,
          visibility: claim.visibility ?? ClaimVisibility.RESTRICTED,
        })),
      },
    });

    this.eventEmitter.emit(AppEvents.CREDENTIAL_ISSUED, {
      credentialId: credential.id,
      athleteProfileId: input.athleteProfileId,
      federationId: input.federationId,
    });
    this.eventEmitter.emit(AppEvents.CREDENTIAL_SIGNED, {
      credentialId: credential.id,
      payloadHashSha256,
    });

    const allowedClaims = credential.claims
      .filter((claim) => claim.visibility !== ClaimVisibility.PRIVATE)
      .map((claim) => claim.claimKey);
    const qr = await this.qrVerificationService.generateForCredential({
      credentialId: credential.id,
      allowedClaims,
    });

    return { credential, qr };
  }

  async getCredential(id: string, user: AuthenticatedUser) {
    const credential = await this.repository.findById(id);

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    const ownsAthleteProfile = credential.athleteProfile.userId === user.id;
    const privilegedRoles: UserRole[] = [UserRole.ADMIN, UserRole.FEDERATION];
    const privileged = user.roles.some((role) => privilegedRoles.includes(role));

    if (!ownsAthleteProfile && !privileged) {
      throw new ForbiddenException('Credential access denied');
    }

    return {
      id: credential.id,
      type: credential.type,
      status: credential.status,
      athlete: credential.athleteProfile,
      federation: {
        id: credential.federation.id,
        name: credential.federation.name,
        country: credential.federation.country,
        sport: credential.federation.sport,
      },
      claims: credential.claims.map((claim) => ({
        key: claim.claimKey,
        value: privileged || ownsAthleteProfile ? claim.claimValue : undefined,
        visibility: claim.visibility,
        verifiedAt: claim.verifiedAt,
      })),
      payloadHashSha256: credential.payloadHashSha256,
      signatureBase64: credential.signatureBase64,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt,
    };
  }

  async signExistingCredential(dto: SignCredentialDto) {
    const credential = await this.repository.findById(dto.credentialId);

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    if (credential.status === CredentialStatus.REVOKED || credential.revokedAt) {
      throw new BadRequestException('Revoked credentials cannot be signed');
    }

    const payloadHashSha256 = this.cryptoService.sha256(
      this.cryptoService.canonicalJson(credential.payload),
    );
    const signatureBase64 = this.cryptoService.signJson(credential.payload);

    const updated = await this.repository.updateSignature(credential.id, {
      payloadHashSha256,
      signatureBase64,
      issuedAt: credential.issuedAt ?? new Date(),
    });

    const allowedClaims =
      dto.allowedClaims ??
      updated.claims
        .filter((claim) => claim.visibility !== ClaimVisibility.PRIVATE)
        .map((claim) => claim.claimKey);

    const qr = await this.qrVerificationService.generateForCredential({
      credentialId: updated.id,
      allowedClaims,
      expiresInSeconds: dto.expiresInSeconds,
    });

    return { credential: updated, qr };
  }
}
