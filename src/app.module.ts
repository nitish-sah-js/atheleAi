import { BullModule } from '@nestjs/bullmq';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env.validation';
import { redisConnectionFromUrl } from './config/redis.config';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { CryptoModule } from './common/crypto/crypto.module';
import { RedisCacheModule } from './common/cache/redis-cache.module';
import { RedisRateLimitModule } from './common/rate-limit/redis-rate-limit.module';
import { RedisThrottlerStorageService } from './common/rate-limit/redis-throttler-storage.service';
import { PrismaModule } from './prisma/prisma.module';
import { EventListenersModule } from './events/event-listeners.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AthleteModule } from './modules/athlete/athlete.module';
import { FederationModule } from './modules/federation/federation.module';
import { CredentialModule } from './modules/credential/credential.module';
import { VerificationModule } from './modules/verification/verification.module';
import { QRVerificationModule } from './modules/qr-verification/qr-verification.module';
import { AbuseReportsModule } from './modules/abuse-reports/abuse-reports.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiModerationModule } from './modules/ai-moderation/ai-moderation.module';
import { StorageModule } from './modules/storage/storage.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get<string>('LOG_LEVEL') ?? 'info',
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.refreshToken',
              'req.body.narrative',
            ],
            remove: true,
          },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [RedisRateLimitModule],
      inject: [ConfigService, RedisThrottlerStorageService],
      useFactory: (
        configService: ConfigService,
        redisThrottlerStorageService: RedisThrottlerStorageService,
      ) => ({
        throttlers: [
          {
            ttl: configService.getOrThrow<number>('RATE_LIMIT_TTL_SECONDS') * 1000,
            limit: configService.getOrThrow<number>('RATE_LIMIT_DEFAULT'),
          },
        ],
        storage: redisThrottlerStorageService,
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: redisConnectionFromUrl(configService.getOrThrow<string>('REDIS_URL')),
      }),
    }),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
    }),
    PrismaModule,
    CryptoModule,
    RedisCacheModule,
    RedisRateLimitModule,
    AuthModule,
    UsersModule,
    AthleteModule,
    FederationModule,
    StorageModule,
    QRVerificationModule,
    CredentialModule,
    VerificationModule,
    AbuseReportsModule,
    AuditLogsModule,
    NotificationsModule,
    AiModerationModule,
    AdminModule,
    HealthModule,
    MetricsModule,
    EventListenersModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
