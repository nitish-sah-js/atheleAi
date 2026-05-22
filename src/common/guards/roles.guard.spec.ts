import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  it('allows admins through role-protected endpoints', () => {
    const reflector = {
      getAllAndOverride: (key: string) => (key === ROLES_KEY ? [UserRole.FEDERATION] : undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { roles: [UserRole.ADMIN] },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies users without required roles', () => {
    const reflector = {
      getAllAndOverride: (key: string) => (key === ROLES_KEY ? [UserRole.ADMIN] : undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { roles: [UserRole.ATHLETE] },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow('Insufficient role permissions');
  });
});
