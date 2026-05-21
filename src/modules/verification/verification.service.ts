import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ClaimVisibility,
  MembershipStatus,
  Prisma,
  UserRole,
  VerificationClaimStatus,
  VerificationDecisionStatus,
  VerificationRequestStatus,
} from '@prisma/client';
import { AppEvents } from '../../common/constants/events';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CredentialService } from '../credential/credential.service';
import { ApproveVerificationDto } from './dto/approve-verification.dto';
import { RejectVerificationDto } from './dto/reject-verification.dto';
import { RequestVerificationDto } from './dto/request-verification.dto';
import { VerificationRepository } from './verification.repository';

@Injectable()
export class VerificationService {
  constructor(
    private readonly repository: VerificationRepository,
    private readonly prisma: PrismaService,
    private readonly credentialService: CredentialService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async requestVerification(user: AuthenticatedUser, dto: RequestVerificationDto) {
    const requestedClaims = dto.claims.map((claim) => ({
      claimKey: claim.claimKey,
      claimValue: claim.claimValue ?? null,
      evidenceDocumentId: claim.evidenceDocumentId ?? null,
    }));

    const request = await this.repository.createRequest({
      athleteProfile: { connect: { id: dto.athleteProfileId } },
      federation: { connect: { id: dto.federationId } },
      requestedBy: { connect: { id: user.id } },
      purpose: dto.purpose,
      requestedClaims: requestedClaims as Prisma.InputJsonValue,
      claims: {
        create: dto.claims.map((claim) => ({
          claimKey: claim.claimKey,
          claimValue: (claim.claimValue ?? null) as Prisma.InputJsonValue,
          evidenceDocument: claim.evidenceDocumentId
            ? { connect: { id: claim.evidenceDocumentId } }
            : undefined,
        })),
      },
    });

    this.eventEmitter.emit(AppEvents.VERIFICATION_REQUESTED, {
      verificationRequestId: request.id,
      athleteProfileId: dto.athleteProfileId,
      federationId: dto.federationId,
      requestedByUserId: user.id,
    });

    return request;
  }

  async approve(user: AuthenticatedUser, dto: ApproveVerificationDto) {
    const request = await this.repository.findRequest(dto.verificationRequestId);

    if (!request) {
      throw new NotFoundException('Verification request not found');
    }

    await this.ensureFederationVerifier(user, request.federationId);

    await this.prisma.$transaction([
      this.prisma.verificationRequest.update({
        where: { id: request.id },
        data: { status: VerificationRequestStatus.APPROVED },
      }),
      this.prisma.verificationDecision.create({
        data: {
          verificationRequestId: request.id,
          decidedByUserId: user.id,
          status: VerificationDecisionStatus.APPROVED,
          reason: dto.reason,
        },
      }),
      ...dto.approvedClaims.map((claim) =>
        this.prisma.verificationClaim.updateMany({
          where: {
            verificationRequestId: request.id,
            claimKey: claim.claimKey,
          },
          data: {
            status: VerificationClaimStatus.APPROVED,
            claimValue: (claim.claimValue ?? null) as Prisma.InputJsonValue,
          },
        }),
      ),
    ]);

    this.eventEmitter.emit(AppEvents.VERIFICATION_APPROVED, {
      verificationRequestId: request.id,
      approvedByUserId: user.id,
    });

    return this.credentialService.issueSignedCredential({
      athleteProfileId: request.athleteProfileId,
      federationId: request.federationId,
      issuedByUserId: user.id,
      type: dto.credentialType,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      claims: dto.approvedClaims.map((claim) => ({
        claimKey: claim.claimKey,
        claimValue: (claim.claimValue ?? null) as Prisma.InputJsonValue,
        visibility: claim.visibility ?? ClaimVisibility.RESTRICTED,
      })),
    });
  }

  async reject(user: AuthenticatedUser, dto: RejectVerificationDto) {
    const request = await this.repository.findRequest(dto.verificationRequestId);

    if (!request) {
      throw new NotFoundException('Verification request not found');
    }

    await this.ensureFederationVerifier(user, request.federationId);

    await this.prisma.$transaction([
      this.prisma.verificationRequest.update({
        where: { id: request.id },
        data: { status: VerificationRequestStatus.REJECTED },
      }),
      this.prisma.verificationDecision.create({
        data: {
          verificationRequestId: request.id,
          decidedByUserId: user.id,
          status: VerificationDecisionStatus.REJECTED,
          reason: dto.reason,
        },
      }),
      this.prisma.verificationClaim.updateMany({
        where: { verificationRequestId: request.id },
        data: { status: VerificationClaimStatus.REJECTED },
      }),
    ]);

    return { success: true };
  }

  private async ensureFederationVerifier(user: AuthenticatedUser, federationId: string) {
    if (user.roles.includes(UserRole.ADMIN)) {
      return;
    }

    if (!user.roles.includes(UserRole.FEDERATION)) {
      throw new ForbiddenException('Federation role required');
    }

    const membership = await this.prisma.federationMembership.findFirst({
      where: {
        userId: user.id,
        federationId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Federation membership required');
    }
  }
}
