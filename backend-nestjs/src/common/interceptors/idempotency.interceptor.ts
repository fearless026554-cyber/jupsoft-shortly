import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as crypto from 'node:crypto';
import { RedisService } from '../../redis/redis.service.js';
import { CACHE_TTL, HeaderNames, RedisKeyBuilder } from '../../constants/index.js';

const IDEMPOTENT_METHODS = ['POST', 'PATCH', 'DELETE'];

function getBodyHash(body: unknown): string {
  const raw = body ? JSON.stringify(body) : '';
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    if (!IDEMPOTENT_METHODS.includes(request.method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers[HeaderNames.IDEMPOTENCY_KEY] as string | undefined;
    const auth = (request as any).auth;
    
    if (!idempotencyKey || !auth) {
      return next.handle();
    }

    const bodyHash = getBodyHash(request.body);
    const cacheKey = RedisKeyBuilder.idempotency(auth.tenantId, idempotencyKey.trim());
    const cached = await this.redis.client.get(cacheKey);

    if (cached) {
      const parsed = JSON.parse(cached);
      
      // If the body hash doesn't match, this is a violation of idempotency (same key, different body)
      if (parsed.bodyHash !== bodyHash) {
        reply.status(422).send({
          success: false,
          error: {
            code: 'IDEMPOTENCY_MISMATCH',
            message: 'Idempotency key is being used with a different request body',
          },
        });
        return of();
      }

      reply.header(HeaderNames.X_IDEMPOTENT_REPLAY, 'true');
      reply.status(parsed.statusCode || 200).send(parsed.body);
      return of();
    }

    return next.handle().pipe(
      tap(async (payload) => {
        if (reply.statusCode >= 200 && reply.statusCode < 300) {
          try {
            const dataToCache = {
              statusCode: reply.statusCode,
              body: payload,
              bodyHash,
            };
            await this.redis.client.setex(cacheKey, CACHE_TTL.IDEMPOTENCY_SEC, JSON.stringify(dataToCache));
          } catch {}
        }
      })
    );
  }
}
