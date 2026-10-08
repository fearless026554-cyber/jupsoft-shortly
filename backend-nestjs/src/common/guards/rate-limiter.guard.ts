import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { RedisService } from '../../redis/redis.service.js';
import { DatabaseService } from '../../db/database.service.js';
import { ApiScopes, ErrorCodes, HeaderNames, RATE_LIMITS, REDIS_CONFIG, REDIS_KEYS } from '../../constants/index.js';
import { env } from '../../config/env.js';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    const url = (request.url || '').split('?')[0];
    if (!url.startsWith('/api') || url.includes('/health')) {
      return true;
    }

    const geoUa = (request as any).geoUa;
    const clientIp = (env.TRUST_PROXY ? geoUa?.clientIp : request.ip) || request.ip || '127.0.0.1';
    const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';

    // 1. Check for API Key (Header X-API-Key or Bearer token that is not a JWT)
    const xApiKey = (request.headers[HeaderNames.X_API_KEY] || request.headers['x-api-key']) as string | undefined;
    const authHeader = (request.headers['authorization'] || request.headers['Authorization']) as string | undefined;

    let bearerApiKey: string | undefined;
    let bearerJwt: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token.split('.').length === 3) {
        bearerJwt = token;
      } else {
        bearerApiKey = token;
      }
    } else if (authHeader) {
      const token = authHeader.trim();
      if (token.split('.').length === 3) {
        bearerJwt = token;
      } else {
        bearerApiKey = token;
      }
    }

    const apiKey = xApiKey || bearerApiKey;

    let limit: number;
    let keyIdentifier: string;

    if (apiKey) {
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      let resolvedKeyId: string | null = null;

      // Check redis hash to id map
      resolvedKeyId = await this.redis.client.get(REDIS_KEYS.API_KEY_HASH_TO_ID(keyHash));

      // Check cached auth session
      if (!resolvedKeyId) {
        const cachedAuth = await this.redis.client.get(REDIS_KEYS.AUTH_KEY(keyHash));
        if (cachedAuth) {
          try {
            const parsed = JSON.parse(cachedAuth);
            if (parsed && typeof parsed.keyId === 'string') {
              const foundId: string = parsed.keyId;
              resolvedKeyId = foundId;
              await this.redis.client.setex(REDIS_KEYS.API_KEY_HASH_TO_ID(keyHash), 86400 * 30, foundId);
            }
          } catch {}
        }
      }

      // Check DB if not yet cached
      if (!resolvedKeyId) {
        try {
          const dbRes = await this.db.withSuperAdminContext(async (client) => {
            return client.query('SELECT id FROM api_keys WHERE key_hash = $1', [keyHash]);
          });
          if (dbRes.rows.length > 0 && dbRes.rows[0]?.id) {
            const foundId: string = dbRes.rows[0].id;
            resolvedKeyId = foundId;
            await this.redis.client.setex(REDIS_KEYS.API_KEY_HASH_TO_ID(keyHash), 86400 * 30, foundId);
          }
        } catch {
          // ignore db errors on rate limiter guard
        }
      }

      if (resolvedKeyId) {
        // Increment lifetime total calls for this API key
        await this.redis.client.incr(REDIS_KEYS.API_KEY_TOTAL(resolvedKeyId));

        // Read per-key rate limit configured by Super Admin (default: 10 req/min)
        const customLimitStr = await this.redis.client.get(REDIS_KEYS.API_KEY_LIMIT(resolvedKeyId));
        limit = customLimitStr ? parseInt(customLimitStr, 10) : RATE_LIMITS.DEFAULT_API_KEY_RPM;
        keyIdentifier = `apikey:${resolvedKeyId}`;
      } else {
        keyIdentifier = `apikey:${keyHash.slice(0, 16)}`;
        limit = RATE_LIMITS.DEFAULT_API_KEY_RPM;
      }
    } else {
      // 2. Resolve user JWT session auth
      let auth = (request as any).auth;
      if (!auth && bearerJwt) {
        try {
          const payload = jwt.decode(bearerJwt) as any;
          if (payload && (payload.sub || payload.userId || payload.email)) {
            auth = {
              userId: payload.sub || payload.userId || payload.email,
              role: payload.role,
              tenantId: payload.tenantId,
              scopes: payload.scopes || (payload.role === 'super_admin' ? [ApiScopes.WILDCARD] : []),
            };
            (request as any).auth = auth;
          }
        } catch {}
      }

      if (auth) {
        const { scopes } = auth;
        const isInternal = scopes?.includes(ApiScopes.WILDCARD) || scopes?.includes(ApiScopes.ADMIN) || auth.role === 'super_admin';
        limit = isInternal ? Math.max(env.RATE_LIMIT_INTERNAL_RPM, 1000) : env.RATE_LIMIT_STANDARD_RPM;
        keyIdentifier = auth.userId ? `user:${auth.userId}` : `ip:${clientIp}`;
      } else {
        keyIdentifier = `ip:${clientIp}`;
        limit = (env.NODE_ENV === 'development' || isLoopback) ? 1000 : env.RATE_LIMIT_STANDARD_RPM;
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % RATE_LIMITS.WINDOW_SIZE_SEC);
    const resetTime = windowStart + RATE_LIMITS.WINDOW_SIZE_SEC;
    const rateLimitKey = REDIS_KEYS.RATE_LIMIT_KEY(keyIdentifier, windowStart);

    const currentCount = await this.redis.client.incr(rateLimitKey);
    if (currentCount === 1) {
      await this.redis.client.expire(
        rateLimitKey,
        RATE_LIMITS.WINDOW_SIZE_SEC + REDIS_CONFIG.RATE_LIMIT_KEY_GRACE_SEC
      );
    }

    const remaining = Math.max(0, limit - currentCount);

    reply.header(HeaderNames.X_RATELIMIT_LIMIT, limit);
    reply.header(HeaderNames.X_RATELIMIT_REMAINING, remaining);
    reply.header(HeaderNames.X_RATELIMIT_RESET, resetTime);

    if (currentCount > limit) {
      reply.status(429).send({
        success: false,
        error: {
          code: ErrorCodes.RATE_LIMIT_EXCEEDED,
          message: `API rate limit of ${limit} requests per minute exceeded. Try again in ${resetTime - now} seconds.`,
        },
      });
      return false;
    }

    return true;
  }
}
