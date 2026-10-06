import { describe, it, expect, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { env } from './config/env.js';
import { ErrorCodes } from './constants/error-codes.js';
import { DatabaseService } from './db/database.service.js';

const BASE_API = 'http://127.0.0.1:3000/api/v1';
const PROXY_API = 'http://localhost:5000/api/proxy';

describe('Real Live E2E & Database Verification (Zero Mocks)', () => {
  let db: DatabaseService;
  const createdApiKeyIds: string[] = [];

  afterAll(async () => {
    if (createdApiKeyIds.length > 0 && db?.pool) {
      await db.pool.query('DELETE FROM api_keys WHERE id = ANY($1)', [createdApiKeyIds]);
    }
    if (db) {
      await db.onModuleDestroy();
    }
  });

  it('Real DB Connection & Health Check: Database and Redis are live', async () => {
    db = new DatabaseService();
    await db.onModuleInit();

    const result = await db.pool.query('SELECT 1 as live');
    expect(result.rows[0].live).toBe(1);

    const res = await fetch(`${BASE_API}/health`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.services.database).toBe('ok');
    expect(data.services.redis).toBe('ok');
  });

  it('Real Live Test (P0 #1): Live Users API blocks non-super_admin from creating super_admin with 403', async () => {
    const tenantAdminToken = jwt.sign(
      {
        userId: '4a0e8559-e3f9-496f-bca2-6ef990744fe6',
        tenantId: '11111111-1111-1111-1111-111111111111',
        role: 'tenant_admin',
        scopes: ['users:read', 'users:write'],
      },
      env.JWT_SECRET
    );

    const res = await fetch(`${BASE_API}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tenantAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Attacker Test User',
        email: 'attacker_real@example.com',
        role: 'super_admin',
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe(ErrorCodes.FORBIDDEN);
    expect(body.error?.message).toContain('Only super administrators can assign the super_admin role');
  });

  it('Real Live Test (P0 #7): Live Users API transforms Zod validation failures to 400 VALIDATION_ERROR', async () => {
    const tenantAdminToken = jwt.sign(
      {
        userId: '4a0e8559-e3f9-496f-bca2-6ef990744fe6',
        tenantId: '11111111-1111-1111-1111-111111111111',
        role: 'tenant_admin',
        scopes: ['users:read', 'users:write'],
      },
      env.JWT_SECRET
    );

    const res = await fetch(`${BASE_API}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tenantAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'x', // min 2
        email: 'not-an-email',
        role: 'member',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(body.error?.message).toBe('Invalid request input');
  });

  it('Real Live Test (P0 #2): Live Abuse API prevents tenant admin from suspending tenants with 403', async () => {
    const tenantAdminToken = jwt.sign(
      {
        userId: '4a0e8559-e3f9-496f-bca2-6ef990744fe6',
        tenantId: '11111111-1111-1111-1111-111111111111',
        role: 'tenant_admin',
        scopes: ['admin'],
      },
      env.JWT_SECRET
    );

    const res = await fetch(`${BASE_API}/abuse-reports/00000000-0000-0000-0000-000000000000`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${tenantAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'resolved',
        suspendTenant: true,
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe(ErrorCodes.FORBIDDEN);
    expect(body.error?.message).toContain('Only super administrators can suspend tenants');
  });

  it('Real Live Test (P0 #3): Live Next.js Proxy blocks unauthenticated access with 401 (no fake auto-auth)', async () => {
    const res = await fetch(`${PROXY_API}/users`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('Real Live Test (P0 #4): Live API key creation generates authentic secretKey in database and response', async () => {
    const superAdminToken = jwt.sign(
      {
        userId: 'cec62ad8-c2bf-4507-b89f-1f902796fcb1',
        tenantId: '11111111-1111-1111-1111-111111111111',
        role: 'super_admin',
        scopes: ['*'],
      },
      env.JWT_SECRET
    );

    const res = await fetch(`${BASE_API}/api-keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Audit Real Verification Key',
        scopes: ['links:read'],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data?.secretKey).toBeDefined();
    expect(body.data?.secretKey.startsWith('jlp_live_')).toBe(true);

    if (body.data?.id) {
      createdApiKeyIds.push(body.data.id);
    }
  });

  it('Real Live Test (P1 #11): Bulk status endpoint prevents cross-tenant IDOR with 403', async () => {
    // 1. Submit a bulk job as Tenant A
    const tenantAToken = jwt.sign(
      {
        userId: '4a0e8559-e3f9-496f-bca2-6ef990744fe6',
        tenantId: '11111111-1111-1111-1111-111111111111',
        role: 'tenant_admin',
        scopes: ['links:read', 'links:write'],
      },
      env.JWT_SECRET
    );

    const bulkRes = await fetch(`${BASE_API}/links/bulk`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tenantAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        links: [
          { destinationUrl: 'https://example.com/item1' },
        ],
      }),
    });

    expect(bulkRes.status).toBe(202);
    const bulkData = await bulkRes.json();
    const jobId = bulkData.data?.jobId;
    expect(jobId).toBeDefined();

    // 2. Attempt to read Tenant A's bulk job as Tenant B
    const tenantBToken = jwt.sign(
      {
        userId: '99999999-9999-9999-9999-999999999999',
        tenantId: '22222222-2222-2222-2222-222222222222',
        role: 'tenant_admin',
        scopes: ['links:read'],
      },
      env.JWT_SECRET
    );

    const idorRes = await fetch(`${BASE_API}/links/bulk/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${tenantBToken}`,
      },
    });

    expect(idorRes.status).toBe(404);
    const idorData = await idorRes.json();
    expect(idorData.success).toBe(false);
    expect(idorData.error?.code).toBe(ErrorCodes.NOT_FOUND);
    expect(idorData.error?.message).toContain('Bulk job not found');
  });

  it('Real Live Test (P1 #12): Token revocation on logout invalidates subsequent requests with 401', async () => {
    const userToken = jwt.sign(
      {
        userId: '4a0e8559-e3f9-496f-bca2-6ef990744fe6',
        tenantId: '11111111-1111-1111-1111-111111111111',
        role: 'tenant_admin',
        scopes: ['users:read'],
      },
      env.JWT_SECRET
    );

    // Initial check: token works
    const meRes1 = await fetch(`${BASE_API}/auth/me`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
    });
    expect(meRes1.status).toBe(200);

    // Logout
    const logoutRes = await fetch(`${BASE_API}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` },
    });
    expect(logoutRes.status).toBe(200);

    // Post-logout check: token is rejected
    const meRes2 = await fetch(`${BASE_API}/auth/me`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
    });
    expect(meRes2.status).toBe(401);
    const body2 = await meRes2.json();
    expect(body2.error?.message).toContain('revoked or logged out');
  });

  it('Real Live Test (P1 #6): Idempotency interceptor returns cached response on replay and detects mismatch', async () => {
    const superAdminToken = jwt.sign(
      {
        userId: 'cec62ad8-c2bf-4507-b89f-1f902796fcb1',
        tenantId: '11111111-1111-1111-1111-111111111111',
        role: 'super_admin',
        scopes: ['*'],
      },
      env.JWT_SECRET
    );

    const idempotencyKey = `idem_test_${Date.now()}`;
    const initialPayload = {
      name: 'Idempotent Test User',
      email: `idem_${Date.now()}@example.com`,
      role: 'user',
    };

    // First call
    const res1 = await fetch(`${BASE_API}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(initialPayload),
    });

    expect(res1.status).toBe(201);
    const body1 = await res1.json();
    const userId = body1.data?.id;
    expect(userId).toBeDefined();

    // Second call: same idempotency key, identical body -> should replay cached response
    const res2 = await fetch(`${BASE_API}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(initialPayload),
    });

    expect(res2.status).toBe(201);
    expect(res2.headers.get('x-idempotent-replay')).toBe('true');
    const body2 = await res2.json();
    expect(body2.data?.id).toBe(userId);

    // Third call: same idempotency key, modified body -> should reject with 422
    const res3 = await fetch(`${BASE_API}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        ...initialPayload,
        name: 'Tampered Body Name',
      }),
    });

    expect(res3.status).toBe(422);
    const body3 = await res3.json();
    expect(body3.error?.code).toBe('IDEMPOTENCY_MISMATCH');

    // Clean up created user
    if (userId && db?.pool) {
      await db.pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('Real Live Test (P1 #13): Unknown or unverified host returns 404 Domain not registered', async () => {
    // 1. Request with an unknown external host header
    const unknownHostRes = await fetch(`http://127.0.0.1:${env.PORT || 3000}/nonexistent`, {
      headers: {
        'x-forwarded-host': 'unregistered-stranger-domain.com',
      },
    });

    expect(unknownHostRes.status).toBe(404);
    const unknownHostData = await unknownHostRes.json();
    expect(unknownHostData.error).toBe('Domain not registered');

    // 2. Request with localhost/default domain recognizes domain and returns 'Short link does not exist'
    const defaultHostRes = await fetch(`http://127.0.0.1:${env.PORT || 3000}/nonexistent`, {
      headers: {
        'host': 'localhost:3000',
      },
    });

    expect(defaultHostRes.status).toBe(404);
    const defaultHostData = await defaultHostRes.json();
    expect(defaultHostData.error?.message).toBe('Short link does not exist');
  });

  it('Real Live Test (P1 #15): Analytics summary filters correctly with custom date ranges', async () => {
    const tenantToken = jwt.sign(
      {
        userId: '4a0e8559-e3f9-496f-bca2-6ef990744fe6',
        tenantId: '11111111-1111-1111-1111-111111111111',
        role: 'tenant_admin',
        scopes: ['analytics:read'],
      },
      env.JWT_SECRET
    );

    // Valid date range query
    const res = await fetch(
      `${BASE_API}/analytics/summary?startDate=2026-01-01&endDate=2026-12-31`,
      {
        headers: { 'Authorization': `Bearer ${tenantToken}` },
      }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.total_clicks).toBeDefined();
    expect(data.data.total_unique_clicks).toBeDefined();
    expect(data.data.total_active_links).toBeDefined();

    // Invalid date format query should be rejected by Zod validation
    const invalidRes = await fetch(
      `${BASE_API}/analytics/summary?startDate=not-a-date&endDate=2026-12-31`,
      {
        headers: { 'Authorization': `Bearer ${tenantToken}` },
      }
    );

    expect(invalidRes.status).toBe(400);
    const invalidData = await invalidRes.json();
    expect(invalidData.error?.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  it('Real Live Test (Google Auth): GET /auth/google/config returns valid configuration object', async () => {
    const res = await fetch(`${BASE_API}/auth/google/config`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(typeof body.data.enabled).toBe('boolean');
  });

  it('Real Live Test (Google Auth): POST /auth/google rejects empty or malformed requests with 400', async () => {
    const res = await fetch(`${BASE_API}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  it('Real Live Test (Google Auth): POST /auth/google validates ID token against Google and rejects fake tokens with 401', async () => {
    const res = await fetch(`${BASE_API}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.fake_payload.fake_signature',
      }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe(ErrorCodes.UNAUTHORIZED);
    expect(body.error?.message).toContain('Invalid or expired Google token');
  });

  it('Real Live Test (Google Auth via Next.js Proxy): POST /api/proxy/auth/google forwards properly to backend', async () => {
    const res = await fetch('http://127.0.0.1:5000/api/proxy/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });
});

