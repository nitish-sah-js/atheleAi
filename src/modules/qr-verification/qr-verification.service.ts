import { BadRequestException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CredentialStatus, QRSessionStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AppEvents } from '../../common/constants/events';
import { RedisCacheService } from '../../common/cache/redis-cache.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { PrismaService } from '../../prisma/prisma.service';

interface QRTokenPayload {
  schema: 'athleteshield.qr.v1';
  qrSessionId: string;
  credentialId: string;
  allowedClaims: string[];
  exp: string;
  nonce: string;
}

@Injectable()
export class QRVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly redisCacheService: RedisCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async generateForCredential(params: {
    credentialId: string;
    allowedClaims: string[];
    expiresInSeconds?: number;
  }) {
    const credential = await this.prisma.credential.findFirst({
      where: {
        id: params.credentialId,
        status: CredentialStatus.SIGNED,
        revokedAt: null,
        deletedAt: null,
      },
    });

    if (!credential) {
      throw new NotFoundException('Signed credential not found');
    }

    if (credential.expiresAt && credential.expiresAt <= new Date()) {
      throw new GoneException('Credential has expired');
    }

    const qrSessionId = randomUUID();
    const expiresAt = new Date(Date.now() + (params.expiresInSeconds ?? 24 * 60 * 60) * 1000);
    const payload: QRTokenPayload = {
      schema: 'athleteshield.qr.v1',
      qrSessionId,
      credentialId: credential.id,
      allowedClaims: params.allowedClaims,
      exp: expiresAt.toISOString(),
      nonce: this.cryptoService.randomToken(16),
    };
    const signedToken = this.cryptoService.createSignedToken(payload);

    const qrSession = await this.prisma.qRSession.create({
      data: {
        id: qrSessionId,
        credentialId: credential.id,
        tokenHash: this.cryptoService.tokenDigest(signedToken),
        signedToken,
        allowedClaims: params.allowedClaims,
        expiresAt,
      },
    });

    this.eventEmitter.emit(AppEvents.QR_GENERATED, {
      credentialId: credential.id,
      qrSessionId: qrSession.id,
      expiresAt,
    });

    return {
      token: signedToken,
      qrSessionId: qrSession.id,
      expiresAt,
    };
  }

  async verify(token: string) {
    const tokenDigest = this.cryptoService.tokenDigest(token);
    const cacheKey = `qr:verification:${tokenDigest}`;
    const cached = await this.redisCacheService.getJson(cacheKey);

    if (cached) {
      return cached;
    }

    let payload: QRTokenPayload;

    try {
      payload = this.cryptoService.verifySignedToken<QRTokenPayload>(token);
    } catch {
      throw new BadRequestException('Invalid QR token');
    }

    if (new Date(payload.exp) <= new Date()) {
      throw new GoneException('QR token has expired');
    }

    const session = await this.prisma.qRSession.findUnique({
      where: { tokenHash: tokenDigest },
      include: {
        credential: {
          include: {
            claims: true,
            athleteProfile: {
              select: {
                athleteCode: true,
                primarySport: true,
              },
            },
            federation: {
              select: {
                id: true,
                name: true,
                country: true,
                sport: true,
              },
            },
          },
        },
      },
    });

    if (!session || session.status !== QRSessionStatus.ACTIVE || session.expiresAt <= new Date()) {
      throw new GoneException('QR session is no longer active');
    }

    if (session.id !== payload.qrSessionId || session.credentialId !== payload.credentialId) {
      throw new BadRequestException('QR token does not match session');
    }

    const credential = session.credential;

    if (
      credential.status !== CredentialStatus.SIGNED ||
      !credential.signatureBase64 ||
      credential.revokedAt ||
      credential.deletedAt ||
      (credential.expiresAt && credential.expiresAt <= new Date())
    ) {
      throw new GoneException('Credential is not valid');
    }

    const signatureValid = this.cryptoService.verifyJson(
      credential.payload,
      credential.signatureBase64,
    );

    if (!signatureValid) {
      throw new BadRequestException('Credential signature verification failed');
    }

    const allowedClaimSet = new Set(session.allowedClaims);
    const claims = credential.claims
      .filter((claim) => allowedClaimSet.has(claim.claimKey) && claim.visibility !== 'PRIVATE')
      .map((claim) => ({
        key: claim.claimKey,
        value: claim.claimValue,
        visibility: claim.visibility,
        verifiedAt: claim.verifiedAt,
      }));

    const response = {
      credentialId: credential.id,
      type: credential.type,
      athlete: {
        athleteCode: credential.athleteProfile.athleteCode,
        primarySport: credential.athleteProfile.primarySport,
      },
      issuer: credential.federation,
      claims,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt,
      verifiedAt: new Date(),
      signatureValid: true,
    };

    await this.redisCacheService.setJson(cacheKey, response, 60);
    return response;
  }
}
