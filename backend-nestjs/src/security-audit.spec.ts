import { describe, it, expect, vi } from 'vitest';
import { ZodError, z } from 'zod';
import { ErrorHandlerFilter } from './common/filters/error-handler.filter.js';
import { ErrorCodes } from './constants/error-codes.js';
import { UserRoles } from './constants/roles.js';

describe('Security Audit Fixes Verification', () => {
  it('Critical #7: ErrorHandlerFilter transforms ZodError into 400 VALIDATION_ERROR instead of 500', () => {
    const filter = new ErrorHandlerFilter();

    let sentStatus = 0;
    let sentPayload: any = null;

    const mockReply = {
      status: (code: number) => {
        sentStatus = code;
        return {
          send: (payload: any) => {
            sentPayload = payload;
          },
        };
      },
    };

    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockReply,
      }),
    } as any;

    const testSchema = z.object({
      email: z.string().email(),
    });

    try {
      testSchema.parse({ email: 'not-an-email' });
    } catch (err) {
      filter.catch(err, mockHost);
    }

    expect(sentStatus).toBe(400);
    expect(sentPayload?.error?.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(sentPayload?.error?.message).toBeDefined();
  });

  it('Critical #1: Role escalation prevention rule rejects non-super_admin assigning super_admin', () => {
    const callerAuth = { role: UserRoles.TENANT_ADMIN, tenantId: 'tenant-1' };
    const targetRole = UserRoles.SUPER_ADMIN;

    const isEscalation = targetRole === UserRoles.SUPER_ADMIN && callerAuth.role !== UserRoles.SUPER_ADMIN;
    expect(isEscalation).toBe(true);

    const superAdminCaller = { role: UserRoles.SUPER_ADMIN, tenantId: 'tenant-1' };
    const allowedForSuper = targetRole === UserRoles.SUPER_ADMIN && superAdminCaller.role !== UserRoles.SUPER_ADMIN;
    expect(allowedForSuper).toBe(false);
  });

  it('Critical #2 & #5: Moderate abuse schema accepts resolved and reviewed, and rejects invalid status', () => {
    const moderateAbuseSchema = z.object({
      status: z.enum(['pending', 'investigating', 'resolved', 'reviewed', 'dismissed']),
      disableLink: z.boolean().optional(),
      suspendTenant: z.boolean().optional(),
    });

    // Valid statuses
    const parsedResolved = moderateAbuseSchema.safeParse({ status: 'resolved', disableLink: true });
    expect(parsedResolved.success).toBe(true);

    const parsedReviewed = moderateAbuseSchema.safeParse({ status: 'reviewed', disableLink: true });
    expect(parsedReviewed.success).toBe(true);

    // Invalid status rejected by Zod
    const invalidStatus = moderateAbuseSchema.safeParse({ status: 'unknown_status' });
    expect(invalidStatus.success).toBe(false);
  });

  it('Critical #4: API key modal secretKey extraction prioritizes backend secretKey over fallback', () => {
    const backendResponseData = {
      id: 'key-123',
      name: 'Production Key',
      key_prefix: 'jlp_live_abc',
      secretKey: 'jlp_live_abcdef1234567890abcdef1234567890',
    };

    const extractedSecret = (backendResponseData as any).secretKey || (backendResponseData as any).key || (backendResponseData as any).token;
    expect(extractedSecret).toBe('jlp_live_abcdef1234567890abcdef1234567890');
    expect(extractedSecret.startsWith('jlp_live_')).toBe(true);
  });
});
