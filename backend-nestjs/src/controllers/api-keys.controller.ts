import { Controller, Get, Post, Delete, Param, Body, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthGuard, RequireScope } from '../common/guards/auth.guard.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import { AUTH_CONSTANTS, ApiScopes, DEFAULT_API_KEY_SCOPES, ErrorCodes, REDIS_KEYS } from '../constants/index.js';

const createKeySchema = z.object({
  name: z.string().min(1).max(128),
  scopes: z.array(z.string()).default([...DEFAULT_API_KEY_SCOPES]),
  expiresAt: z.string().datetime().optional(),
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
  async listApiKeys(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const keys = await this.db.withTenantContext(tenantId, async (client) => {
      const res = await client.query(
        `SELECT id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at FROM api_keys WHERE tenant_id = $1 ORDER BY created_at DESC`,
        [tenantId]
      );
      return res.rows;
    });

    return reply.send({ success: true, data: keys });
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

    const created = await this.db.withTenantContext(tenantId, async (client) => {
      const res = await client.query(
        `INSERT INTO api_keys (tenant_id, name, key_prefix, key_hash, scopes, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, key_prefix, scopes, created_at`,
        [tenantId, dto.name, keyPrefix, keyHash, dto.scopes, dto.expiresAt ? new Date(dto.expiresAt) : null]
      );
      return res.rows[0];
    });

    return reply.status(201).send({ success: true, data: { ...created, secretKey: rawSecret } });
  }

  @Delete(':id')
  @RequireScope(ApiScopes.ADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  async revokeApiKey(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const revoked = await this.db.withTenantContext(tenantId, async (client) => {
      const res = await client.query(
        `UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id, key_hash`,
        [id, tenantId]
      );
      return res.rows[0];
    });

    if (!revoked) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'API key not found' } });
    }

    await this.redis.client.del(REDIS_KEYS.AUTH_KEY(revoked.key_hash));
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

    await this.redis.client.del(REDIS_KEYS.AUTH_KEY(rotated.oldKeyHash));
    return reply.send({ success: true, data: { ...rotated.updated, secretKey: rawSecret } });
  }
}
