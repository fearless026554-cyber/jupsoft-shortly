import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../../db/database.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { AUTH_CONSTANTS, CACHE_TTL, ErrorCodes, HeaderNames, RedisKeyBuilder, ApiScopes } from '../../constants/index.js';

export const SCOPES_KEY = 'scopes';
export const RequireScope = (...scopes: string[]) => SetMetadata(SCOPES_KEY, scopes);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse();

    const apiKey =
      (request.headers[HeaderNames.X_API_KEY] as string | undefined) ||
      (request.headers['authorization']?.replace(/^Bearer\s+/i, '')) ||
      ((request.query as any)?.api_key as string | undefined);

    if (!apiKey) {
      reply.status(401).send({
        success: false,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Missing X-API-Key authentication header',
        },
      });
      return false;
    }

    const keyHash = crypto.createHash(AUTH_CONSTANTS.HASH_ALGO).update(apiKey).digest('hex');
    const cacheKey = RedisKeyBuilder.authKey(keyHash);
    const cachedAuth = await this.redis.client.get(cacheKey);

    let authData: any = null;

    if (cachedAuth) {
      authData = JSON.parse(cachedAuth);
      if (authData.expiresAt && new Date(authData.expiresAt) < new Date()) {
        await this.redis.client.del(cacheKey);
        reply.status(403).send({
          success: false,
          error: {
            code: ErrorCodes.KEY_EXPIRED,
            message: 'The provided API key has expired',
          },
        });
        return false;
      }
    } else {
      const res = await this.db.pool.query(
        `SELECT id, tenant_id, scopes, revoked_at, expires_at FROM api_keys WHERE key_hash = $1`,
        [keyHash]
      );

      if (res.rowCount === 0) {
        reply.status(401).send({
          success: false,
          error: { code: ErrorCodes.INVALID_API_KEY, message: 'The provided API key is invalid' },
        });
        return false;
      }

      const keyRecord = res.rows[0];

      if (keyRecord.revoked_at) {
        reply.status(403).send({
          success: false,
          error: { code: ErrorCodes.KEY_REVOKED, message: 'The provided API key has been revoked' },
        });
        return false;
      }

      if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
        reply.status(403).send({
          success: false,
          error: { code: ErrorCodes.KEY_EXPIRED, message: 'The provided API key has expired' },
        });
        return false;
      }

      authData = {
        tenantId: keyRecord.tenant_id,
        keyId: keyRecord.id,
        scopes: keyRecord.scopes || [],
        expiresAt: keyRecord.expires_at || null,
      };

      await this.redis.client.setex(cacheKey, CACHE_TTL.AUTH_SESSION_SEC, JSON.stringify(authData));
      this.db.pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [keyRecord.id]).catch(() => {});
    }

    (request as any).auth = authData;

    // Check Scopes
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredScopes || requiredScopes.length === 0) {
      return true; // No specific scopes required, just auth
    }

    const scopes = authData.scopes;
    const scope = requiredScopes[0]; // Usually just one scope is checked
    const isTenantPlatformScope = scope.startsWith('tenants:');

    let hasPermission = false;
    if (isTenantPlatformScope) {
      hasPermission =
        scopes.includes(ApiScopes.SUPER_ADMIN) ||
        (!authData.tenantId && scopes.includes(ApiScopes.WILDCARD)) ||
        scopes.includes(scope);
    } else {
      hasPermission =
        scopes.includes(ApiScopes.WILDCARD) ||
        scopes.includes(ApiScopes.ADMIN) ||
        scopes.includes(ApiScopes.SUPER_ADMIN) ||
        scopes.includes(scope);
    }

    if (!hasPermission) {
      reply.status(403).send({
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: `Insufficient permissions. Required scope: '${scope}'`,
        },
      });
      return false;
    }

    return true;
  }
}
