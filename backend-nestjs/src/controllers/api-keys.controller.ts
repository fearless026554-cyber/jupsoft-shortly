import { Controller, Get, Post, Delete, Patch, Param, Query, Body, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthGuard, RequireScope } from '../common/guards/auth.guard.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import { AUTH_CONSTANTS, ApiScopes, DEFAULT_API_KEY_SCOPES, ErrorCodes, RATE_LIMITS, REDIS_KEYS } from '../constants/index.js';

const createKeySchema = z.object({
  name: z.string().min(1).max(128),
  scopes: z.array(z.string()).default([...DEFAULT_API_KEY_SCOPES]),
  expiresAt: z.string().datetime().optional(),
  rateLimitRpm: z.number().int().min(1).max(100000).optional(),
});

const updateRateLimitSchema = z.object({
  rateLimitRpm: z.number().int().min(1).max(100000),
});

@Controller('api/v1/api-keys')
@UseGuards(AuthGuard)
export class ApiKeysController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService
  ) {}

  @Get()
  @RequireScope(ApiScopes.ADMIN)
  async listApiKeys(
    @Query('limit') limitStr: string,
    @Query('cursor') cursor: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply
  ) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;
    const limit = Math.min(Math.max(1, limitStr ? parseInt(limitStr, 10) || 50 : 50), 100);

    const keys = await this.db.withTenantContext(tenantId, async (client) => {
      let query = `SELECT id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at, rate_limit_rpm, created_by FROM api_keys WHERE tenant_id = $1`;
      const params: any[] = [tenantId];
      if (cursor) {
        params.push(new Date(cursor));
        query += ` AND created_at < $2`;
      }
      params.push(limit);
      query += ` ORDER BY created_at DESC LIMIT $${params.length}`;
      const res = await client.query(query, params);
      return res.rows;
    });

    const enrichedKeys = await Promise.all(
      keys.map(async (key) => {
        const [totalCallsStr, limitStr, metaStr] = await Promise.all([
          this.redis.client.get(REDIS_KEYS.API_KEY_TOTAL(key.id)),
          this.redis.client.get(REDIS_KEYS.API_KEY_LIMIT(key.id)),
          this.redis.client.get(REDIS_KEYS.API_KEY_META(key.id)),
        ]);

        let meta: any = {};
        if (metaStr) {
          try {
            meta = JSON.parse(metaStr);
          } catch {}
        }

        const effectiveRpm = limitStr ? parseInt(limitStr, 10) : (key.rate_limit_rpm || RATE_LIMITS.DEFAULT_API_KEY_RPM);
        const creator = meta.created_by || key.created_by || 'Admin';

        return {
          ...key,
          total_calls: totalCallsStr ? parseInt(totalCallsStr, 10) : 0,
          rate_limit_rpm: effectiveRpm,
          created_by: creator,
          created_by_email: meta.created_by_email || null,
          created_by_id: meta.created_by_id || null,
          revoked_by: meta.revoked_by || null,
          revoked_by_email: meta.revoked_by_email || null,
        };
      })
    );

    return reply.send({ success: true, data: enrichedKeys });
  }

  @Post()
  @RequireScope(ApiScopes.ADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  async createApiKey(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = createKeySchema.parse(req.body);
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;
    const creatorScopes = auth.scopes;

    if (!creatorScopes.includes(ApiScopes.WILDCARD) && !creatorScopes.includes(ApiScopes.SUPER_ADMIN)) {
      for (const s of dto.scopes) {
        if (!creatorScopes.includes(s)) {
          return reply.status(403).send({
            success: false,
            error: { code: ErrorCodes.FORBIDDEN, message: `Cannot grant scope '${s}' which exceeds creator permissions` },
          });
        }
      }
    }

    const rawSecret = `${AUTH_CONSTANTS.API_KEY_PREFIX}${crypto.randomBytes(AUTH_CONSTANTS.API_KEY_RANDOM_BYTES).toString('hex')}`;
    const keyPrefix = rawSecret.slice(0, AUTH_CONSTANTS.API_KEY_PREFIX_LEN);
    const keyHash = crypto.createHash(AUTH_CONSTANTS.HASH_ALGO).update(rawSecret).digest('hex');

    const keyRateLimit = dto.rateLimitRpm || RATE_LIMITS.DEFAULT_API_KEY_RPM;
    const creatorName = auth.name || (auth.email ? auth.email.split('@')[0] : 'Admin');

    const created = await this.db.withTenantContext(tenantId, async (client) => {
      const res = await client.query(
        `INSERT INTO api_keys (tenant_id, name, key_prefix, key_hash, scopes, expires_at, rate_limit_rpm, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, key_prefix, scopes, created_at, rate_limit_rpm, created_by`,
        [tenantId, dto.name, keyPrefix, keyHash, dto.scopes, dto.expiresAt ? new Date(dto.expiresAt) : null, keyRateLimit, creatorName]
      );
      return res.rows[0];
    });

    const meta = {
      created_by: creatorName,
      created_by_email: auth.email || null,
      created_by_id: auth.userId || null,
      created_at: created.created_at,
    };

    await Promise.all([
      this.redis.client.set(REDIS_KEYS.API_KEY_LIMIT(created.id), keyRateLimit.toString()),
      this.redis.client.set(REDIS_KEYS.API_KEY_META(created.id), JSON.stringify(meta)),
      this.redis.client.set(REDIS_KEYS.API_KEY_HASH_TO_ID(keyHash), created.id),
      this.redis.client.set(REDIS_KEYS.API_KEY_TOTAL(created.id), '0'),
    ]);

    return reply.status(201).send({
      success: true,
      data: {
        ...created,
        secretKey: rawSecret,
        rate_limit_rpm: keyRateLimit,
        created_by: creatorName,
        created_by_email: auth.email || null,
        total_calls: 0,
      },
    });
  }

  @Patch(':id/rate-limit')
  @RequireScope(ApiScopes.ADMIN)
  async updateApiKeyRateLimit(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply
  ) {
    const auth = (req as any).auth;
    const isSuperAdmin = auth.role === 'super_admin' || auth.scopes?.includes(ApiScopes.WILDCARD) || auth.scopes?.includes(ApiScopes.SUPER_ADMIN);

    if (!isSuperAdmin) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: 'Only Super Admin can dynamically modify API key rate limits',
        },
      });
    }

    const { rateLimitRpm } = updateRateLimitSchema.parse(req.body);

    const updated = await this.db.withSuperAdminContext(async (client) => {
      const res = await client.query(
        'UPDATE api_keys SET rate_limit_rpm = $1 WHERE id = $2 RETURNING id, name, tenant_id, rate_limit_rpm',
        [rateLimitRpm, id]
      );
      return res.rows[0];
    });

    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCodes.NOT_FOUND, message: 'API key not found' },
      });
    }

    await this.redis.client.set(REDIS_KEYS.API_KEY_LIMIT(id), rateLimitRpm.toString());

    return reply.send({
      success: true,
      data: {
        id,
        name: updated.name,
        rate_limit_rpm: rateLimitRpm,
        message: `Rate limit updated to ${rateLimitRpm} req/min for API key "${updated.name}"`,
      },
    });
  }

  @Delete(':id')
  @RequireScope(ApiScopes.ADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  async revokeApiKey(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const revoked = await this.db.withTenantContext(tenantId, async (client) => {
      const res = await client.query(
        `UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id, key_hash, revoked_at`,
        [id, tenantId]
      );
      return res.rows[0];
    });

    if (!revoked) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'API key not found' } });
    }

    await this.redis.client.del(REDIS_KEYS.AUTH_KEY(revoked.key_hash));

    // Update metadata with revoker details
    const revokerName = auth.name || (auth.email ? auth.email.split('@')[0] : 'Admin');
    const existingMetaStr = await this.redis.client.get(REDIS_KEYS.API_KEY_META(id));
    let meta: any = {};
    if (existingMetaStr) {
      try { meta = JSON.parse(existingMetaStr); } catch {}
    }
    meta.revoked_by = revokerName;
    meta.revoked_by_email = auth.email || null;
    meta.revoked_by_id = auth.userId || null;
    meta.revoked_at = revoked.revoked_at || new Date().toISOString();
    await this.redis.client.set(REDIS_KEYS.API_KEY_META(id), JSON.stringify(meta));

    return reply.send({ success: true, message: 'API key revoked successfully' });
  }

  @Post(':id/rotate')
  @RequireScope(ApiScopes.ADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  async rotateApiKey(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const rawSecret = `${AUTH_CONSTANTS.API_KEY_PREFIX}${crypto.randomBytes(AUTH_CONSTANTS.API_KEY_RANDOM_BYTES).toString('hex')}`;
    const newKeyPrefix = rawSecret.slice(0, AUTH_CONSTANTS.API_KEY_PREFIX_LEN);
    const newKeyHash = crypto.createHash(AUTH_CONSTANTS.HASH_ALGO).update(rawSecret).digest('hex');

    const rotated = await this.db.withTenantContext(tenantId, async (client) => {
      const currentRes = await client.query(`SELECT id, key_hash, revoked_at FROM api_keys WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
      if (currentRes.rowCount === 0) return null;
      const oldKey = currentRes.rows[0];
      if (oldKey.revoked_at) {
        const err: any = new Error('Cannot rotate a revoked API key');
        err.statusCode = 400;
        throw err;
      }

      const res = await client.query(
        `UPDATE api_keys SET key_prefix = $1, key_hash = $2, created_at = NOW() WHERE id = $3 AND tenant_id = $4 RETURNING id, name, key_prefix, scopes, created_at`,
        [newKeyPrefix, newKeyHash, id, tenantId]
      );

      return { updated: res.rows[0], oldKeyHash: oldKey.key_hash };
    });

    if (!rotated) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'API key not found' } });
    }

    await Promise.all([
      this.redis.client.del(REDIS_KEYS.AUTH_KEY(rotated.oldKeyHash)),
      this.redis.client.set(REDIS_KEYS.API_KEY_HASH_TO_ID(newKeyHash), id),
    ]);

    return reply.send({ success: true, data: { ...rotated.updated, secretKey: rawSecret } });
  }
}
