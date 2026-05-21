import type { Request } from 'express';

export interface ClientContext {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export function getClientContext(request: Request & { requestId?: string }): ClientContext {
  const forwardedFor = request.headers['x-forwarded-for'];
  const ipAddress =
    typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0]?.trim()
      : request.ip || request.socket.remoteAddress;

  const userAgentHeader = request.headers['user-agent'];

  return {
    ipAddress,
    userAgent: Array.isArray(userAgentHeader) ? userAgentHeader.join(' ') : userAgentHeader,
    requestId: request.requestId,
  };
}
