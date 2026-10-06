import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { RedisService } from '../../redis/redis.service.js';
import { ApiScopes, ErrorCodes, HeaderNames, RATE_LIMITS, REDIS_CONFIG, REDIS_KEYS } from '../../constants/index.js';
import { env } from '../../config/env.js';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    const url = (request.url || '').split('?')[0];
    if (!url.startsWith('/api') || url.includes('/health')) {
      return true;
    }

    // 1. Resolve auth: Check request.auth or inspect Bearer token
    let auth = (request as any).auth;
    if (!auth) {
      const authHeader = (request.headers['authorization'] || request.headers['Authorization']) as string | undefined;
      let bearerToken: string | undefined;
      if (authHeader?.startsWith('Bearer ')) {
        bearerToken = authHeader.substring(7).trim();
      } else if (authHeader) {
        bearerToken = authHeader.trim();
      }

      if (bearerToken && bearerToken.split('.').length === 3) {
        try {
          const payload = jwt.decode(bearerToken) as any;
          if (payload && (payload.sub || payload.userId || payload.email)) {
            auth = {
              userId: payload.sub || payload.userId || payload.email,
              role: payload.role,
              tenantId: payload.tenantId,
              scopes: payload.scopes || (payload.role === 'super_admin' ? [ApiScopes.WILDCARD] : []),
            };
            (request as any).auth = auth;
          }
        } catch {
          // ignore invalid token decode
        }
      }
    }

    const geoUa = (request as any).geoUa;
    const clientIp = (env.TRUST_PROXY ? geoUa?.clientIp : request.ip) || request.ip || '127.0.0.1';
    const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';

    let keyIdentifier: string;
    let limit: number;

    if (auth) {
      const { keyId, scopes } = auth;
      const isInternal = scopes?.includes(ApiScopes.WILDCARD) || scopes?.includes(ApiScopes.ADMIN) || auth.role === 'super_admin';
      limit = isInternal ? Math.max(env.RATE_LIMIT_INTERNAL_RPM, 1000) : env.RATE_LIMIT_STANDARD_RPM;
      keyIdentifier = keyId ? `apikey:${keyId}` : (auth.userId ? `user:${auth.userId}` : `ip:${clientIp}`);
    } else {
      const xApiKey = request.headers[HeaderNames.X_API_KEY] as string | undefined;
      if (xApiKey) {
        const keyHash = crypto.createHash('sha256').update(xApiKey).digest('hex').slice(0, 16);
        keyIdentifier = `apikey:${keyHash}`;
        limit = env.RATE_LIMIT_STANDARD_RPM;
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
