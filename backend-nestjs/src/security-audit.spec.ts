import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ErrorHandlerFilter } from './common/filters/error-handler.filter.js';
import { ErrorCodes } from './constants/error-codes.js';
import { UserRoles } from './constants/roles.js';
import { UsersController } from './controllers/users.controller.js';
import { AbuseController } from './controllers/abuse.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { TenantsController } from './controllers/tenants.controller.js';

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
    const mockEmail = { sendUserCredentialsEmail: vi.fn().mockResolvedValue(true) } as any;
    const controller = new UsersController(mockDb, mockRedis, mockEmail);

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
    const mockEmail = { sendUserCredentialsEmail: vi.fn().mockResolvedValue(true) } as any;
    const controller = new UsersController(mockDb, mockRedis, mockEmail);

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
    const mockEmail = { sendUserCredentialsEmail: vi.fn().mockResolvedValue(true) } as any;
    const controller = new UsersController(mockDb, mockRedis, mockEmail);

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

  it('Transactional Email: UsersController.inviteUser sends credentials email via EmailService', async () => {
    const mockDb = {
      withSuperAdminContext: vi.fn().mockImplementation(async (cb: any) => {
        return cb({
          query: vi.fn().mockResolvedValue({
            rows: [{ id: 'usr-new-1', name: 'Rohan Sharma', email: 'rohan@jupsoft.com', role: 'user', status: 'invited' }],
          }),
        });
      }),
      withTenantContext: vi.fn().mockImplementation(async (_tenantId: string, cb: any) => {
        return cb({
          query: vi.fn().mockResolvedValue({
            rows: [{ id: 'usr-new-1', name: 'Rohan Sharma', email: 'rohan@jupsoft.com', role: 'user', status: 'invited' }],
          }),
        });
      }),
    } as any;
    const mockRedis = { invalidateUserStatus: vi.fn() } as any;
    const mockEmail = { sendUserCredentialsEmail: vi.fn().mockResolvedValue(true) } as any;
    const controller = new UsersController(mockDb, mockRedis, mockEmail);

    const req: any = {
      body: {
        name: 'Rohan Sharma',
        email: 'rohan@jupsoft.com',
        role: 'user',
      },
      auth: {
        role: UserRoles.SUPER_ADMIN,
        tenantId: 'tenant-abc',
      },
    };
    const reply = createMockReply();

    await controller.inviteUser(req, reply);

    expect(reply.getStatus()).toBe(201);
    expect(mockEmail.sendUserCredentialsEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: 'rohan@jupsoft.com',
        toName: 'Rohan Sharma',
        role: 'user',
        isPasswordReset: false,
      })
    );
  });

  it('Transactional Email: AuthController.forgotPassword dispatches reset link via EmailService', async () => {
    const mockDb = {
      withSuperAdminContext: vi.fn().mockImplementation(async (cb: any) => {
        return cb({
          query: vi.fn().mockResolvedValue({
            rowCount: 1,
            rows: [{ id: 'usr-123', name: 'Sachin', email: 'sachin@jupsoft.com', status: 'active' }],
          }),
        });
      }),
    } as any;

    const mockRedisClient = {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      setex: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue(null),
    };
    const mockRedis = { client: mockRedisClient } as any;
    const mockEmail = { sendPasswordResetLinkEmail: vi.fn().mockResolvedValue(true) } as any;

    const authController = new AuthController(mockDb, mockRedis, mockEmail);
    const reply = createMockReply();
    const req: any = {
      ip: '127.0.0.1',
    };

    await authController.forgotPassword({ email: 'sachin@jupsoft.com' }, req, reply);

    expect(reply.getStatus()).toBe(200);
    expect(reply.getBody()?.success).toBe(true);
    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      expect.stringMatching(/^pwd_reset:/),
      900,
      expect.stringContaining('usr-123')
    );
    expect(mockEmail.sendPasswordResetLinkEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: 'sachin@jupsoft.com',
        resetUrl: expect.stringMatching(/\/login\?resetToken=/),
      })
    );
  });

  it('Security: AuthController.resetPassword validates token from Redis and updates password', async () => {
    let updatedPasswordHash = '';
    const mockDb = {
      withSuperAdminContext: vi.fn().mockImplementation(async (cb: any) => {
        return cb({
          query: vi.fn().mockImplementation(async (q: string, params: any[]) => {
            updatedPasswordHash = params[0];
            return { rowCount: 1 };
          }),
        });
      }),
    } as any;

    const mockRedisClient = {
      get: vi.fn().mockResolvedValue(JSON.stringify({ userId: 'usr-123', email: 'sachin@jupsoft.com' })),
      del: vi.fn().mockResolvedValue(1),
    };
    const mockRedis = {
      client: mockRedisClient,
      incrementUserTokenVersion: vi.fn().mockResolvedValue(1),
      invalidateUserStatus: vi.fn().mockResolvedValue(undefined),
    } as any;
    const mockEmail = {} as any;

    const authController = new AuthController(mockDb, mockRedis, mockEmail);
    const reply = createMockReply();
    const req: any = { ip: '127.0.0.1' };

    await authController.resetPassword(
      {
        token: 'valid-reset-token-64-bytes-sample-token',
        newPassword: 'MySecureNewPassword2026!',
      },
      req,
      reply
    );

    expect(reply.getStatus()).toBe(200);
    expect(reply.getBody()?.success).toBe(true);
    expect(mockRedisClient.del).toHaveBeenCalledWith('pwd_reset:valid-reset-token-64-bytes-sample-token');
    expect(mockRedis.incrementUserTokenVersion).toHaveBeenCalledWith('usr-123');
    expect(updatedPasswordHash).not.toBe('MySecureNewPassword2026!'); // Must be hashed with bcrypt
  });

  describe('Tenants Management Endpoints', () => {
    it('TenantsController.createTenant successfully creates a tenant and trims code', async () => {
      let insertedParams: any[] = [];
      const mockDb = {
        withSuperAdminContext: vi.fn().mockImplementation(async (cb: any) => {
          return cb({
            query: vi.fn().mockImplementation(async (q: string, params: any[]) => {
              if (q.includes('SELECT id FROM tenants')) {
                return { rowCount: 0 };
              }
              if (q.includes('INSERT INTO tenants')) {
                insertedParams = params;
                return {
                  rows: [
                    {
                      id: 'tenant-uuid-1',
                      code: params[0],
                      name: params[1],
                      status: 'active',
                      plan_id: params[2],
                      created_at: new Date().toISOString(),
                    },
                  ],
                };
              }
              return { rows: [] };
            }),
          });
        }),
      } as any;
      const mockRedis = { invalidateTenantStatus: vi.fn() } as any;
      const controller = new TenantsController(mockDb, mockRedis);

      const req: any = {
        body: {
          code: '  acme-corp  ',
          name: 'Acme Corporation',
          planId: 'internal_unlimited',
        },
      };
      const reply = createMockReply();

      await controller.createTenant(req, reply);

      expect(reply.getStatus()).toBe(201);
      expect(reply.getBody()?.success).toBe(true);
      expect(reply.getBody()?.data?.code).toBe('acme-corp');
      expect(insertedParams[0]).toBe('acme-corp');
      expect(insertedParams[1]).toBe('Acme Corporation');
      expect(insertedParams[2]).toBe('internal_unlimited');
    });

    it('TenantsController.createTenant gracefully normalizes enterprise_multi_branch to enterprise', async () => {
      let insertedPlan = '';
      const mockDb = {
        withSuperAdminContext: vi.fn().mockImplementation(async (cb: any) => {
          return cb({
            query: vi.fn().mockImplementation(async (q: string, params: any[]) => {
              if (q.includes('SELECT id FROM tenants')) return { rowCount: 0 };
              if (q.includes('INSERT INTO tenants')) {
                insertedPlan = params[2];
                return { rows: [{ id: 'tenant-uuid-2', code: params[0], name: params[1], plan_id: params[2] }] };
              }
              return { rows: [] };
            }),
          });
        }),
      } as any;
      const mockRedis = { invalidateTenantStatus: vi.fn() } as any;
      const controller = new TenantsController(mockDb, mockRedis);

      const req: any = {
        body: {
          code: 'enterprise-test',
          name: 'Enterprise Branch Co',
          planId: 'enterprise_multi_branch',
        },
      };
      const reply = createMockReply();

      await controller.createTenant(req, reply);

      expect(reply.getStatus()).toBe(201);
      expect(insertedPlan).toBe('enterprise');
    });

    it('TenantsController.createTenant rejects duplicate tenant code with 409 CONFLICT', async () => {
      const mockDb = {
        withSuperAdminContext: vi.fn().mockImplementation(async (cb: any) => {
          return cb({
            query: vi.fn().mockImplementation(async (q: string) => {
              if (q.includes('SELECT id FROM tenants')) {
                return { rowCount: 1 }; // already exists
              }
              return { rows: [] };
            }),
          });
        }),
      } as any;
      const mockRedis = { invalidateTenantStatus: vi.fn() } as any;
      const controller = new TenantsController(mockDb, mockRedis);

      const req: any = {
        body: {
          code: 'existing-code',
          name: 'Existing Tenant',
          planId: 'standard',
        },
      };
      const reply = createMockReply();

      await controller.createTenant(req, reply);

      expect(reply.getStatus()).toBe(409);
      expect(reply.getBody()?.success).toBe(false);
      expect(reply.getBody()?.error?.code).toBe(ErrorCodes.CONFLICT);
      expect(reply.getBody()?.error?.message).toContain('already in use');
    });

    it('TenantsController.updateTenant updates status and invalidates Redis cache', async () => {
      const mockDb = {
        withSuperAdminContext: vi.fn().mockImplementation(async (cb: any) => {
          return cb({
            query: vi.fn().mockResolvedValue({
              rows: [{ id: 'tenant-123', status: 'suspended', name: 'Acme Corp' }],
            }),
          });
        }),
      } as any;
      const mockRedis = { invalidateTenantStatus: vi.fn().mockResolvedValue(undefined) } as any;
      const controller = new TenantsController(mockDb, mockRedis);

      const req: any = {
        body: { status: 'suspended' },
      };
      const reply = createMockReply();

      await controller.updateTenant('tenant-123', req, reply);

      expect(reply.getStatus()).toBe(200);
      expect(reply.getBody()?.success).toBe(true);
      expect(reply.getBody()?.data?.status).toBe('suspended');
      expect(mockRedis.invalidateTenantStatus).toHaveBeenCalledWith('tenant-123');
    });

    it('UsersController.listUsers filters by tenantId query param for super admin', async () => {
      let executedQuery = '';
      let executedParams: any[] = [];
      const mockDb = {
        withSuperAdminContext: vi.fn().mockImplementation(async (cb: any) => {
          return cb({
            query: vi.fn().mockImplementation(async (q: string, params: any[]) => {
              executedQuery = q;
              executedParams = params;
              return { rows: [{ id: 'usr-target', tenant_id: 'tenant-target' }] };
            }),
          });
        }),
      } as any;
      const mockRedis = {} as any;
      const mockEmail = {} as any;
      const controller = new UsersController(mockDb, mockRedis, mockEmail);

      const req: any = {
        auth: {
          role: UserRoles.SUPER_ADMIN,
          tenantId: 'tenant-default',
        },
      };
      const reply = createMockReply();

      await controller.listUsers('50', '', 'tenant-target', req, reply);

      expect(reply.getStatus()).toBe(200);
      expect(executedQuery).toContain('tenant_id = $1');
      expect(executedParams).toContain('tenant-target');
      expect(reply.getBody()?.data).toHaveLength(1);
    });

    it('UsersController.inviteUser rejects cross-tenant invitation by non-super-admin with 403', async () => {
      const mockDb = {
        withTenantContext: vi.fn(),
      } as any;
      const mockRedis = {} as any;
      const mockEmail = {} as any;
      const controller = new UsersController(mockDb, mockRedis, mockEmail);

      const req: any = {
        body: {
          name: 'Jane Doe',
          email: 'jane@othercorp.com',
          role: 'user',
          tenantId: 'a0000000-0000-4000-8000-000000000002',
        },
        auth: {
          role: UserRoles.TENANT_ADMIN,
          tenantId: 'a0000000-0000-4000-8000-000000000001',
        },
      };
      const reply = createMockReply();

      await controller.inviteUser(req, reply);

      expect(reply.getStatus()).toBe(403);
      expect(reply.getBody()?.success).toBe(false);
      expect(reply.getBody()?.error?.code).toBe(ErrorCodes.FORBIDDEN);
      expect(mockDb.withTenantContext).not.toHaveBeenCalled();
    });
  });
});

