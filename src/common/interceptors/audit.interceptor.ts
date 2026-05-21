import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_ACTION_KEY } from '../decorators/audit-action.decorator';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { getClientContext } from '../utils/client-context';
import { AuditLogsService } from '../../modules/audit-logs/audit-logs.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const action = this.reflector.getAllAndOverride<string>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!this.shouldAudit(request, action)) {
      return next.handle();
    }

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.writeAuditLog(request, action, startedAt, true),
        error: () => this.writeAuditLog(request, action, startedAt, false),
      }),
    );
  }

  private shouldAudit(request: AuthenticatedRequest, action?: string): boolean {
    if (action) {
      return true;
    }

    if (request.originalUrl.includes('/health') || request.originalUrl.includes('/metrics')) {
      return false;
    }

    return !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  }

  private writeAuditLog(
    request: AuthenticatedRequest,
    action: string | undefined,
    startedAt: number,
    success: boolean,
  ): void {
    const context = getClientContext(request);
    const resourceType = request.route?.path?.toString() ?? request.originalUrl;

    void this.auditLogsService
      .record({
        actorUserId: request.user?.id,
        action: action ?? `${request.method} ${resourceType}`,
        resourceType,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        metadata: this.auditLogsService.metadata({
          method: request.method,
          url: request.originalUrl,
          success,
          durationMs: Date.now() - startedAt,
        }),
      })
      .catch((error) => {
        this.logger.error({ err: error }, 'Audit interceptor failed');
      });
  }
}
