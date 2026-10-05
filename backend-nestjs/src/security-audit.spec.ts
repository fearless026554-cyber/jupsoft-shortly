import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ErrorHandlerFilter } from './common/filters/error-handler.filter.js';
import { ErrorCodes } from './constants/error-codes.js';
import { UserRoles } from './constants/roles.js';
import { UsersController } from './controllers/users.controller.js';
import { AbuseController } from './controllers/abuse.controller.js';

function createMockReply() {
  let statusCode = 200;
  let sentBody: any = null;
  const reply: any = {
    status: (code: number) => {
      statusCode = code;
      return reply;
    },
    send: (body: any) => {
      sentBody = body;
      return reply;
    },
    getStatus: () => statusCode,
    getBody: () => sentBody,
  };
  return reply;
}

describe('Security Audit Fixes Verification (Controller-Level)', () => {
  it('Critical #7: ErrorHandlerFilter transforms ZodError into 400 VALIDATION_ERROR instead of 500', () => {
    const filter = new ErrorHandlerFilter();
    const reply = createMockReply();
    const mockHost = {
      switchToHttp: () => ({ getResponse: () => reply }),
    } as any;

    try {
      z.string().email().parse('not-an-email');
    } catch (err) {
      filter.catch(err, mockHost);
    }

    expect(reply.getStatus()).toBe(400);
    expect(reply.getBody()?.error?.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(reply.getBody()?.error?.message).toBeDefined();
  });

  it('Critical #1: UsersController.inviteUser rejects non-super_admin assigning super_admin role', async () => {
    const mockDb = {
      withTenantContext: vi.fn(),
    } as any;
    const mockRedis = { invalidateUserStatus: vi.fn() } as any;
    const controller = new UsersController(mockDb, mockRedis);

    const req: any = {
      body: {
        name: 'Attacker User',
        email: 'attacker@example.com',
        role: UserRoles.SUPER_ADMIN,
      },
      auth: {
        role: UserRoles.TENANT_ADMIN,
        tenantId: 'tenant-abc',
      },
    };
    const reply = createMockReply();

    await controller.inviteUser(req, reply);

    expect(reply.getStatus()).toBe(403);
    expect(reply.getBody()?.error?.code).toBe(ErrorCodes.FORBIDDEN);
    expect(reply.getBody()?.error?.message).toContain('super administrators');
    expect(mockDb.withTenantContext).not.toHaveBeenCalled();
  });

  it('Critical #1: UsersController.updateUser prevents non-super_admin from elevating role to super_admin', async () => {
    const mockDb = {
      withTenantContext: vi.fn(),
    } as any;
    const mockRedis = { invalidateUserStatus: vi.fn() } as any;
    const controller = new UsersController(mockDb, mockRedis);

    const req: any = {
      body: {
        role: UserRoles.SUPER_ADMIN,
      },
      auth: {
        role: UserRoles.TENANT_ADMIN,
        tenantId: 'tenant-abc',
      },
    };
    const reply = createMockReply();

    await controller.updateUser('target-user-id', req, reply);

    expect(reply.getStatus()).toBe(403);
    expect(reply.getBody()?.error?.code).toBe(ErrorCodes.FORBIDDEN);
    expect(reply.getBody()?.error?.message).toContain('super administrators');
  });

  it('Critical #1: UsersController.updateUser prevents modifying an existing super_admin account', async () => {
    const mockDb = {
      withTenantContext: vi.fn().mockImplementation(async (_tenantId: string, cb: any) => {
        return cb({
          query: vi.fn().mockResolvedValue({
            rows: [{ role: UserRoles.SUPER_ADMIN }],
          }),
        });
      }),
    } as any;
    const mockRedis = { invalidateUserStatus: vi.fn() } as any;
    const controller = new UsersController(mockDb, mockRedis);

    const req: any = {
      body: {
        status: 'suspended',
      },
      auth: {
        role: UserRoles.TENANT_ADMIN,
        tenantId: 'tenant-abc',
      },
    };
    const reply = createMockReply();

    await controller.updateUser('superadmin-id', req, reply);

    expect(reply.getStatus()).toBe(403);
    expect(reply.getBody()?.error?.code).toBe(ErrorCodes.FORBIDDEN);
    expect(reply.getBody()?.error?.message).toContain('super administrator account');
  });

  it('Critical #2: AbuseController.moderateReport prevents tenant admin from suspending tenants', async () => {
    const mockDb = {
      withTenantContext: vi.fn(),
      withSuperAdminContext: vi.fn(),
    } as any;
    const mockRedis = {
      invalidateLink: vi.fn(),
      invalidateTenantStatus: vi.fn(),
    } as any;
    const controller = new AbuseController(mockDb, mockRedis);

    const req: any = {
      body: {
        status: 'resolved',
        suspendTenant: true,
      },
      auth: {
        role: UserRoles.TENANT_ADMIN,
        tenantId: 'tenant-abc',
        scopes: [],
      },
    };
    const reply = createMockReply();

    await controller.moderateReport('rep-123', req, reply);

    expect(reply.getStatus()).toBe(403);
    expect(reply.getBody()?.error?.code).toBe(ErrorCodes.FORBIDDEN);
    expect(reply.getBody()?.error?.message).toContain('Only super administrators can suspend tenants');
  });

  it('Critical #2: AbuseController.moderateReport scopes tenant admin query strictly by tenant_id', async () => {
    let executedQuery = '';
    let executedParams: any[] = [];

    const mockDb = {
      withTenantContext: vi.fn().mockImplementation(async (_tenantId: string, cb: any) => {
        return cb({
          query: vi.fn().mockImplementation(async (q: string, p: any[]) => {
            executedQuery = q;
            executedParams = p;
            return { rowCount: 0, rows: [] };
          }),
        });
      }),
      withSuperAdminContext: vi.fn(),
    } as any;
    const mockRedis = {
      invalidateLink: vi.fn(),
      invalidateTenantStatus: vi.fn(),
    } as any;
    const controller = new AbuseController(mockDb, mockRedis);

    const req: any = {
      body: {
        status: 'resolved',
      },
      auth: {
        role: UserRoles.TENANT_ADMIN,
        tenantId: 'tenant-abc',
        scopes: [],
      },
    };
    const reply = createMockReply();

    await controller.moderateReport('rep-123', req, reply);

    // Should include tenant scoping in SQL
    expect(executedQuery).toContain('l.tenant_id = $2');
    expect(executedParams).toContain('tenant-abc');
    expect(reply.getStatus()).toBe(404);
  });
});
