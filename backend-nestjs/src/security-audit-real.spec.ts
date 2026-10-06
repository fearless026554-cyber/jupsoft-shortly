import { describe, it, expect, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';
import { env } from './config/env.js';
import { ErrorCodes } from './constants/error-codes.js';
import { DatabaseService } from './db/database.service.js';
import { RedisService } from './redis/redis.service.js';

const BASE_API = `http://127.0.0.1:${env.PORT || 3001}/api/v1`;
const PROXY_API = `http://127.0.0.1:${process.env.FRONTEND_PORT || 5001}/api/proxy`;

describe('Real Live E2E & Database Verification (Zero Mocks)', () => {
  let db: DatabaseService;
  let redisTest: Redis;
  const createdApiKeyIds: string[] = [];

  afterAll(async () => {
    if (createdApiKeyIds.length > 0 && db?.pool) {
      await db.pool.query('DELETE FROM api_keys WHERE id = ANY($1)', [createdApiKeyIds]);
    }
    if (db) {
      await db.onModuleDestroy();
    }
    if (redisTest) {
      await redisTest.quit();
    }
  });

  it('Real DB Connection & Health Check: Database and Redis are live', async () => {
    db = new DatabaseService();
    await db.onModuleInit();
    redisTest = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
    });

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
    const defaultHostRes = await fetch(`http://127.0.0.1:${env.PORT || 3001}/nonexistent`, {
      headers: {
        'host': `localhost:${env.PORT || 3001}`,
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
  }, 10000);

  it('Real Live Test (Google Auth via Next.js Proxy): POST /api/proxy/auth/google forwards properly to backend', async () => {
    const res = await fetch(`${PROXY_API}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  it('Real Live Test (Google Auth Security): POST /auth/google handles nonce and state fields', async () => {
    const res = await fetch(`${BASE_API}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: 'invalid.token.here',
        nonce: 'client-nonce-12345',
        state: 'client-state-67890',
      }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('Real Live Test (RLS System Auth Context): System queries on api_keys and users succeed safely', async () => {
    // 1. Create a test API key via super admin context
    const testHash = 'test_rls_key_hash_' + Date.now();
    await db.withSuperAdminContext(async (client) => {
      await client.query(
        `INSERT INTO api_keys (tenant_id, name, key_prefix, key_hash, scopes, expires_at)
         VALUES ('11111111-1111-1111-1111-111111111111', 'RLS Test Key', 'jlmp_test', $1, '{"*"}', NOW() + INTERVAL '1 day')`,
        [testHash]
      );
    });

    // 2. Query key through withSuperAdminContext (as used in auth.guard)
    const keyRes = await db.withSuperAdminContext(async (client) => {
      return client.query(
        `SELECT id, tenant_id, scopes FROM api_keys WHERE key_hash = $1`,
        [testHash]
      );
    });
    expect(keyRes.rowCount).toBe(1);
    expect(keyRes.rows[0].scopes).toContain('*');

    // Clean up
    await db.withSuperAdminContext(async (client) => {
      await client.query(`DELETE FROM api_keys WHERE key_hash = $1`, [testHash]);
    });
  });

  it('Real Live Test (Security H3): Query string API key (?api_key=...) is rejected with 401', async () => {
    // Attempting to authenticate via URL query string is blocked to prevent credential leak in logs
    const res = await fetch(`${BASE_API}/links?api_key=jlp_live_sample_dummy_key_123456`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe(ErrorCodes.UNAUTHORIZED);
    expect(body.error?.message).toContain('Please provide a Bearer token or X-API-Key header');
  });

  it('Real Live Test (Security H4): Password policy rejects passwords under 8 characters or common dictionaries', async () => {
    const superAdminToken = jwt.sign(
      {
        userId: 'cec62ad8-c2bf-4507-b89f-1f902796fcb1',
        tenantId: '11111111-1111-1111-1111-111111111111',
        role: 'super_admin',
        scopes: ['*'],
      },
      env.JWT_SECRET
    );

    // 1. Password under 8 chars
    const shortRes = await fetch(`${BASE_API}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Short Pwd User',
        email: `short_pwd_${Date.now()}@example.com`,
        role: 'user',
        password: '123',
      }),
    });
    expect(shortRes.status).toBe(400);

    // 2. Common dictionary password
    const commonRes = await fetch(`${BASE_API}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Common Pwd User',
        email: `common_pwd_${Date.now()}@example.com`,
        role: 'user',
        password: 'password123',
      }),
    });
    expect(commonRes.status).toBe(400);
    const commonBody = await commonRes.json();
    expect(commonBody.error?.message).toContain('too common');
  });

  it('Real Live Test (Security C1): Dedicated login lockout triggers 429 after 5 failed attempts', async () => {
    if (redisTest) {
      await redisTest.del('lockout:ip:127.0.0.1', 'login:fail:ip:127.0.0.1', 'login:req:ip:127.0.0.1');
    }

    const testEmail = `brute_victim_${Date.now()}@example.com`;

    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${BASE_API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: `wrong_pass_${i}`,
        }),
      });
      expect(res.status).toBe(401);
    }

    // 6th attempt should be locked out with 429
    const lockoutRes = await fetch(`${BASE_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'any_password',
      }),
    });

    expect(lockoutRes.status).toBe(429);
    const lockoutBody = await lockoutRes.json();
    expect(lockoutBody.error?.code).toBe(ErrorCodes.RATE_LIMIT_EXCEEDED);
    expect(lockoutBody.error?.message).toContain('locked out');

    // Clean up test lockout from Redis so other test cases from 127.0.0.1 proceed
    if (redisTest) {
      await redisTest.del('lockout:ip:127.0.0.1');
      await redisTest.del('login:fail:ip:127.0.0.1');
      await redisTest.del('login:req:ip:127.0.0.1');
      await redisTest.del(`lockout:email:${testEmail.toLowerCase()}`);
      await redisTest.del(`login:fail:email:${testEmail.toLowerCase()}`);
    }
  });

  it('Real Live Test (Security C3): Session Versioning invalidates older JWT on password reset', async () => {
    if (redisTest) {
      await redisTest.del('lockout:ip:127.0.0.1', 'login:fail:ip:127.0.0.1', 'login:req:ip:127.0.0.1');
    }

    const superAdminToken = jwt.sign(
      {
        userId: 'cec62ad8-c2bf-4507-b89f-1f902796fcb1',
        tenantId: '11111111-1111-1111-1111-111111111111',
        role: 'super_admin',
        scopes: ['*'],
      },
      env.JWT_SECRET
    );

    // 1. Create a user
    const userEmail = `session_ver_${Date.now()}@example.com`;
    const createRes = await fetch(`${BASE_API}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Session Ver User',
        email: userEmail,
        role: 'user',
        password: 'SecurePassword123!',
      }),
    });
    expect(createRes.status).toBe(201);
    const createBody = await createRes.json();
    const testUserId = createBody.data?.id;

    // 2. Login to obtain JWT with current ver
    const loginRes = await fetch(`${BASE_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        password: 'SecurePassword123!',
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    const userJwt = loginData.data?.token;

    // 3. Verify user token works on /auth/me
    const meRes1 = await fetch(`${BASE_API}/auth/me`, {
      headers: { 'Authorization': `Bearer ${userJwt}` },
    });
    expect(meRes1.status).toBe(200);

    // 4. Admin resets user password (triggering session version bump)
    const resetRes = await fetch(`${BASE_API}/users/${testUserId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password: 'NewSuperSecurePass999!',
      }),
    });
    expect(resetRes.status).toBe(200);

    // 5. Old user JWT is now rejected with 401 Session Invalidated
    const meRes2 = await fetch(`${BASE_API}/auth/me`, {
      headers: { 'Authorization': `Bearer ${userJwt}` },
    });
    expect(meRes2.status).toBe(401);
    const meBody2 = await meRes2.json();
    expect(meBody2.error?.message).toContain('Session has expired or was invalidated');

    // Clean up test user
    if (testUserId) {
      await db.withSuperAdminContext(async (client) => {
        await client.query('DELETE FROM users WHERE id = $1', [testUserId]);
      });
    }
  });

  it('Real Live Test (Security M1): Super Admin can genuinely delete user across tenants without silent no-op', async () => {
    const superAdminToken = jwt.sign(
      {
        userId: 'cec62ad8-c2bf-4507-b89f-1f902796fcb1',
        tenantId: '11111111-1111-1111-1111-111111111111',
        role: 'super_admin',
        scopes: ['*'],
      },
      env.JWT_SECRET
    );

    // 1. Create a user under a specific tenant
    const deleteEmail = `delete_target_${Date.now()}@example.com`;
    const createRes = await fetch(`${BASE_API}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Delete Target',
        email: deleteEmail,
        role: 'user',
        password: 'TempPassword456!',
      }),
    });
    const createBody = await createRes.json();
    const targetUserId = createBody.data?.id;
    expect(targetUserId).toBeDefined();

    // 2. Delete user using Super Admin token (whose tenantId is super admin / null)
    const delRes = await fetch(`${BASE_API}/users/${targetUserId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${superAdminToken}`,
      },
    });
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.success).toBe(true);

    // 3. Verify row in DB is actually gone
    const checkDb = await db.withSuperAdminContext(async (client) => {
      return client.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    });
    expect(checkDb.rowCount).toBe(0);
  });

  it('Real Live Test (Security M2): Hostname normalization strips ports and handles uppercase', async () => {
    const redisService = new RedisService(db);
    redisService.client = redisTest;

    const domain = await redisService.getDomainByHostname('LOCALHOST:3001');
    expect(domain).toBeDefined();
    expect(domain?.id).toBe(env.DEFAULT_DOMAIN_ID);
  });

  it('Real Live Test (PostgreSQL Non-Superuser RLS Enforcement): shortly_app role strictly enforces RLS policies', async () => {
    const { Client } = await import('pg');
    const appClient = new Client({
      host: env.PG_HOST,
      port: env.PG_PORT,
      database: env.PG_DATABASE,
      user: 'shortly_app',
      password: 'shortly_secure_app_pwd',
    });

    await appClient.connect();

    // 1. Verify role is non-superuser
    const userRes = await appClient.query('SELECT usesuper FROM pg_user WHERE usename = current_user');
    expect(userRes.rows[0].usesuper).toBe(false);

    // 2. Query without context: RLS must return 0 rows
    const unauthRes = await appClient.query('SELECT count(*) FROM links');
    expect(Number(unauthRes.rows[0].count)).toBe(0);

    // 3. Query with Super Admin context: RLS bypass returns rows
    await appClient.query('BEGIN');
    await appClient.query("SELECT set_config('app.is_super_admin', 'true', true)");
    const adminRes = await appClient.query('SELECT count(*) FROM links');
    expect(Number(adminRes.rows[0].count)).toBeGreaterThan(0);
    await appClient.query('COMMIT');

    // 4. Query with Tenant A context: returns rows
    await appClient.query('BEGIN');
    await appClient.query("SELECT set_config('app.current_tenant_id', '11111111-1111-1111-1111-111111111111', true)");
    const tenantRes = await appClient.query('SELECT count(*) FROM links');
    expect(Number(tenantRes.rows[0].count)).toBeGreaterThan(0);

    // 5. Query for cross-tenant data while in Tenant B context: RLS returns 0
    await appClient.query("SELECT set_config('app.current_tenant_id', '22222222-2222-2222-2222-222222222222', true)");
    const crossTenantRes = await appClient.query("SELECT count(*) FROM links WHERE tenant_id = '11111111-1111-1111-1111-111111111111'");
    expect(Number(crossTenantRes.rows[0].count)).toBe(0);
    await appClient.query('COMMIT');

    await appClient.end();
  });

  it('Real Live Test (Alias Links): POST /links with custom alias creates short code matching alias and rejects duplicate alias with 409', async () => {
    const testAlias = `test-alias-${Date.now().toString().slice(-6)}`;
    const tenantToken = jwt.sign(
      {
        userId: '4a0e8559-e3f9-496f-bca2-6ef990744fe6',
        tenantId: '11111111-1111-1111-1111-111111111111',
        role: 'tenant_admin',
        scopes: ['links:read', 'links:write'],
      },
      env.JWT_SECRET
    );

    // 1. First creation with custom alias should succeed
    const createRes1 = await fetch(`${BASE_API}/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tenantToken}`,
      },
      body: JSON.stringify({
        destinationUrl: 'https://jupsoft.com/features',
        alias: testAlias,
      }),
    });

    expect(createRes1.status).toBe(201);
    const body1 = await createRes1.json();
    expect(body1.success).toBe(true);
    expect(body1.data.shortCode).toBe(testAlias);
    expect(body1.data.shortUrl).toContain(testAlias);

    // 2. Second creation with duplicate alias should be rejected with 409 ALIAS_CONFLICT
    const createRes2 = await fetch(`${BASE_API}/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tenantToken}`,
      },
      body: JSON.stringify({
        destinationUrl: 'https://jupsoft.com/another-page',
        alias: testAlias,
      }),
    });

    expect(createRes2.status).toBe(409);
    const body2 = await createRes2.json();
    expect(body2.success).toBe(false);
    expect(body2.error?.code).toBe(ErrorCodes.ALIAS_CONFLICT);
    expect(body2.error?.message).toMatch(/duplicate|already in use/i);
  });
});



