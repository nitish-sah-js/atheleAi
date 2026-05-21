import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  DeviceSessionStatus,
  User,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { AppEvents } from '../../common/constants/events';
import { CryptoService } from '../../common/crypto/crypto.service';
import type { ClientContext } from '../../common/utils/client-context';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: {
    id: string;
    email: string;
    roles: UserRole[];
    firstName: string | null;
    lastName: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(dto: RegisterDto, context: ClientContext): Promise<TokenPair> {
    const role = dto.role ?? UserRole.ATHLETE;

    const privilegedSelfRegistrationRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.INVESTIGATOR,
      UserRole.FEDERATION,
    ];

    if (privilegedSelfRegistrationRoles.includes(role)) {
      throw new BadRequestException('Privileged roles require an invitation workflow');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('Email is already registered');
    }

    const passwordHash = await argon2.hash(dto.password);

    let athleteProfileId: string | undefined;

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          roles: [role],
          status: UserStatus.ACTIVE,
        },
      });

      if (role === UserRole.ATHLETE) {
        const athlete = await tx.athleteProfile.create({
          data: {
            userId: createdUser.id,
            athleteCode: this.createAthleteCode(),
            primarySport: dto.primarySport,
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          },
        });

        athleteProfileId = athlete.id;
      }

      return createdUser;
    });

    if (athleteProfileId) {
      this.eventEmitter.emit(AppEvents.ATHLETE_REGISTERED, {
        athleteProfileId,
        userId: user.id,
      });
    }

    return this.issueTokenPair(user, context);
  }

  async login(dto: LoginDto, context: ClientContext): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || user.status !== UserStatus.ACTIVE || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokenPair(user, context);
  }

  async refresh(refreshToken: string, context: ClientContext): Promise<TokenPair> {
    const tokenDigest = this.cryptoService.tokenDigest(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: tokenDigest },
      include: {
        user: true,
        deviceSession: true,
      },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date() ||
      storedToken.user.status !== UserStatus.ACTIVE ||
      storedToken.deviceSession.status !== DeviceSessionStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newRefreshToken = this.cryptoService.randomToken();
    const newRefreshTokenDigest = this.cryptoService.tokenDigest(newRefreshToken);
    const expiresAt = this.refreshTokenExpiresAt();

    await this.prisma.$transaction(async (tx) => {
      const createdRefreshToken = await tx.refreshToken.create({
        data: {
          userId: storedToken.userId,
          deviceSessionId: storedToken.deviceSessionId,
          tokenHash: newRefreshTokenDigest,
          expiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenId: createdRefreshToken.id,
        },
      });

      await tx.deviceSession.update({
        where: { id: storedToken.deviceSessionId },
        data: {
          lastSeenAt: new Date(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
    });

    const accessToken = await this.signAccessToken(storedToken.user, storedToken.deviceSessionId);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.configService.getOrThrow<string>('JWT_ACCESS_TTL'),
      user: this.toAuthUser(storedToken.user),
    };
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    const tokenDigest = this.cryptoService.tokenDigest(refreshToken);
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: tokenDigest },
    });

    if (token) {
      await this.prisma.$transaction([
        this.prisma.refreshToken.update({
          where: { id: token.id },
          data: { revokedAt: new Date() },
        }),
        this.prisma.deviceSession.update({
          where: { id: token.deviceSessionId },
          data: {
            status: DeviceSessionStatus.REVOKED,
            revokedAt: new Date(),
          },
        }),
      ]);
    }

    return { success: true };
  }

  private async issueTokenPair(user: User, context: ClientContext): Promise<TokenPair> {
    const deviceSession = await this.prisma.deviceSession.create({
      data: {
        userId: user.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        lastSeenAt: new Date(),
      },
    });

    const refreshToken = this.cryptoService.randomToken();
    const accessToken = await this.signAccessToken(user, deviceSession.id);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        deviceSessionId: deviceSession.id,
        tokenHash: this.cryptoService.tokenDigest(refreshToken),
        expiresAt: this.refreshTokenExpiresAt(),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.getOrThrow<string>('JWT_ACCESS_TTL'),
      user: this.toAuthUser(user),
    };
  }

  private signAccessToken(user: User, sessionId: string): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        sessionId,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.getOrThrow<string>('JWT_ACCESS_TTL'),
      },
    );
  }

  private refreshTokenExpiresAt(): Date {
    const days = this.configService.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private toAuthUser(user: User): TokenPair['user'] {
    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  private createAthleteCode(): string {
    return `AS-${this.cryptoService.randomToken(9).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;
  }
}
