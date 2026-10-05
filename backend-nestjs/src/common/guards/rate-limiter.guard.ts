import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'node:crypto';
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

    const auth = (request as any).auth;
    const geoUa = (request as any).geoUa;

    let keyIdentifier: string;
    let limit: number;

    if (auth) {
      const { keyId, scopes } = auth;
      const isInternal = scopes?.includes(ApiScopes.WILDCARD) || scopes?.includes(ApiScopes.ADMIN);
      limit = isInternal ? env.RATE_LIMIT_INTERNAL_RPM : env.RATE_LIMIT_STANDARD_RPM;
      keyIdentifier = keyId ? `apikey:${keyId}` : (auth.userId ? `user:${auth.userId}` : `ip:${request.ip || '127.0.0.1'}`);
    } else {
      const xApiKey = request.headers[HeaderNames.X_API_KEY] as string | undefined;
      if (xApiKey) {
        const keyHash = crypto.createHash('sha256').update(xApiKey).digest('hex').slice(0, 16);
        keyIdentifier = `apikey:${keyHash}`;
        limit = env.RATE_LIMIT_STANDARD_RPM;
      } else {
        const clientIp = geoUa?.clientIp || request.ip || '127.0.0.1';
        limit = env.RATE_LIMIT_STANDARD_RPM;
        keyIdentifier = `ip:${clientIp}`;
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
